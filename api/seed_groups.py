"""Small group API. Tokens are private access keys, not public member IDs."""
import hashlib
import os
import secrets
import sqlite3
import re
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

groups = Blueprint('seed_groups', __name__)

def db():
    path = os.environ.get('SEED_GROUP_DB', '/home/ubuntu/report/data/seed-groups.sqlite3')
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.executescript('''
      CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY, name TEXT NOT NULL, invite TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY, gid TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, token TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS checks(mid TEXT, day TEXT, item TEXT, value INTEGER NOT NULL, PRIMARY KEY(mid,day,item));
      CREATE TABLE IF NOT EXISTS characters(mid TEXT PRIMARY KEY, choice INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts(mid TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, recovery TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_attempts(bucket TEXT PRIMARY KEY, started REAL NOT NULL, attempts INTEGER NOT NULL);
    ''')
    return connection

def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()

def password_hash(password):
    return generate_password_hash(password, method='pbkdf2:sha256:1000000')

def body():
    value = request.get_json(silent=True)
    return value if isinstance(value, dict) else {}

def valid_name(value):
    return isinstance(value, str) and 1 <= len(value.strip()) <= 40

def identity(connection):
    header = request.headers.get('Authorization', '')
    token = header.removeprefix('Bearer ')
    return connection.execute("SELECT * FROM members WHERE token=? AND role IN ('member','manager')", (digest(token),)).fetchone()

@groups.post('/groups')
def create():
    data = body()
    if not valid_name(data.get('name')) or not valid_name(data.get('member')):
        return jsonify(error='모임 이름과 지도사 이름을 1~40자로 입력해 주세요.'), 400
    gid, mid, token, invite = [secrets.token_urlsafe(24) for _ in range(4)]
    connection = db()
    try:
        with connection:
            connection.execute('INSERT INTO groups VALUES(?,?,?)', (gid,data['name'].strip(),invite))
            connection.execute('INSERT INTO members VALUES(?,?,?,?,?)', (mid,gid,data['member'].strip(),'manager',digest(token)))
        return jsonify(token=token), 201
    finally:
        connection.close()

@groups.post('/groups/join')
def join():
    data = body()
    if not valid_name(data.get('member')) or not isinstance(data.get('invite'), str):
        return jsonify(error='이름과 초대 코드를 확인해 주세요.'), 400
    connection = db()
    try:
        with connection:
            connection.execute('BEGIN IMMEDIATE')
            group = connection.execute('SELECT * FROM groups WHERE invite=?', (data['invite'],)).fetchone()
            if not group:
                return jsonify(error='유효하지 않은 초대 코드예요.'), 404
            size = connection.execute("SELECT COUNT(*) FROM members WHERE gid=? AND role='member'", (group['id'],)).fetchone()[0]
            if size >= 3:
                return jsonify(error='팀원 3명이 모두 참여했어요.'), 409
            token = secrets.token_urlsafe(24)
            connection.execute('INSERT INTO members VALUES(?,?,?,?,?)', (secrets.token_urlsafe(24),group['id'],data['member'].strip(),'member',digest(token)))
        return jsonify(token=token), 201
    finally:
        connection.close()

@groups.get('/groups/me')
def get_group():
    connection = db()
    try:
        me = identity(connection)
        if not me:
            return jsonify(error='그룹에 접속해 주세요.'), 401
        group = connection.execute('SELECT * FROM groups WHERE id=?', (me['gid'],)).fetchone()
        members = []
        for member in connection.execute("SELECT id,name,role FROM members WHERE gid=? AND role IN ('member','manager') ORDER BY rowid", (me['gid'],)):
            value = dict(member)
            value['days'] = {}
            choice = connection.execute('SELECT choice FROM characters WHERE mid=?', (member['id'],)).fetchone()
            value['character'] = choice['choice'] if choice else 0
            # Only the manager and the member themselves can see individual checks.
            if me['role'] == 'manager' or me['id'] == member['id']:
                for check in connection.execute('SELECT day,item,value FROM checks WHERE mid=?', (member['id'],)):
                    value['days'].setdefault(check['day'], {})[check['item']] = bool(check['value'])
            members.append(value)
        account = connection.execute('SELECT username FROM accounts WHERE mid=?', (me['id'],)).fetchone()
        return jsonify(name=group['name'], me=me['id'], role=me['role'], members=members, username=account['username'] if account else None,
                       today=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat(),
                       invite=group['invite'] if me['role'] == 'manager' else None)
    finally:
        connection.close()

def credentials(data):
    username = data.get('username', '')
    password = data.get('password', '')
    return (isinstance(username,str) and re.fullmatch(r'[a-z0-9_]{4,32}', username) is not None
            and isinstance(password,str) and 10 <= len(password) <= 128)

@groups.post('/groups/account')
def register_account():
    data = body()
    if not credentials(data):
        return jsonify(error='아이디는 영문 소문자·숫자·밑줄 4~32자, 비밀번호는 10~128자예요.'), 400
    connection = db()
    try:
        me = identity(connection)
        if not me:
            return jsonify(error='먼저 그룹에 접속해 주세요.'), 401
        recovery = secrets.token_urlsafe(24)
        with connection:
            connection.execute('INSERT INTO accounts VALUES(?,?,?,?)', (me['id'],data['username'],password_hash(data['password']),digest(recovery)))
        return jsonify(recovery=recovery), 201
    except sqlite3.IntegrityError:
        return jsonify(error='이미 등록된 계정이거나 사용 중인 아이디예요.'), 409
    finally:
        connection.close()

@groups.post('/groups/login')
@groups.post('/groups/recover')
def authenticate():
    data = body()
    if not credentials(data):
        return jsonify(error='아이디와 비밀번호 형식을 확인해 주세요.'), 400
    recovery_mode = request.path.endswith('/recover')
    recovery = data.get('recovery','')
    if recovery_mode and (not isinstance(recovery,str) or len(recovery)>128):
        return jsonify(error='복구 코드를 확인해 주세요.'), 400
    connection = db()
    try:
        # Shared SQLite limit works across gunicorn workers; raw proxy headers are not trusted.
        buckets = ['user:'+data['username'], 'ip:'+(request.remote_addr or 'unknown')]
        now=time.time()
        with connection:
            connection.execute('BEGIN IMMEDIATE')
            connection.execute('DELETE FROM auth_attempts WHERE started<?', (now-900,))
            for bucket in buckets:
                row=connection.execute('SELECT attempts FROM auth_attempts WHERE bucket=?',(bucket,)).fetchone()
                if row and row['attempts'] >= (10 if bucket.startswith('user:') else 100):
                    return jsonify(error='시도가 많아요. 15분 후 다시 시도해 주세요.'),429
            for bucket in buckets:
                connection.execute('INSERT INTO auth_attempts VALUES(?,?,1) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1',(bucket,now))
        with connection:
            connection.execute('BEGIN IMMEDIATE')
            account=connection.execute("SELECT a.* FROM accounts a JOIN members m ON m.id=a.mid WHERE username=? AND m.role IN ('member','manager')",(data['username'],)).fetchone()
            valid = account and (secrets.compare_digest(account['recovery'],digest(recovery)) if recovery_mode else check_password_hash(account['password'],data['password']))
            if not valid:
                return jsonify(error='로그인 정보 또는 복구 코드를 확인해 주세요.'),401
            token=secrets.token_urlsafe(24)
            new_recovery=secrets.token_urlsafe(24) if recovery_mode else None
            if recovery_mode:
                connection.execute('UPDATE accounts SET password=?,recovery=? WHERE mid=?',(password_hash(data['password']),digest(new_recovery),account['mid']))
            connection.execute('UPDATE members SET token=? WHERE id=?',(digest(token),account['mid']))
            connection.execute('DELETE FROM auth_attempts WHERE bucket=?',(buckets[0],))
        return jsonify(token=token,recovery=new_recovery)
    finally:
        connection.close()

@groups.post('/groups/manage')
def manage():
    data=body()
    connection=db()
    try:
        with connection:
            connection.execute('BEGIN IMMEDIATE')
            me=identity(connection)
            if not me or me['role']!='manager':
                return jsonify(error='지도사만 사용할 수 있어요.'),403
            action=data.get('action')
            if action=='rename' and valid_name(data.get('name')):
                connection.execute('UPDATE groups SET name=? WHERE id=?',(data['name'].strip(),me['gid']))
            elif action=='invite':
                connection.execute('UPDATE groups SET invite=? WHERE id=?',(secrets.token_urlsafe(24),me['gid']))
            elif action in ('remove','reset') and isinstance(data.get('member'),str):
                member=connection.execute("SELECT * FROM members WHERE id=? AND gid=? AND role='member'",(data['member'],me['gid'])).fetchone()
                if not member:
                    return jsonify(error='이 그룹의 팀원을 찾지 못했어요.'),404
                if action=='remove':
                    # Retain historical records; release seat and revoke all access.
                    connection.execute("UPDATE members SET role='inactive',token=? WHERE id=?",(digest(secrets.token_urlsafe(24)),member['id']))
                else:
                    account=connection.execute('SELECT username FROM accounts WHERE mid=?',(member['id'],)).fetchone()
                    if not account:
                        return jsonify(error='팀원이 먼저 아이디를 등록해야 해요.'),409
                    recovery=secrets.token_urlsafe(24)
                    connection.execute('UPDATE accounts SET recovery=?,password=? WHERE mid=?',(digest(recovery),password_hash(secrets.token_urlsafe(32)),member['id']))
                    connection.execute('UPDATE members SET token=? WHERE id=?',(digest(secrets.token_urlsafe(24)),member['id']))
                    return jsonify(recovery=recovery,username=account['username'])
            else:
                return jsonify(error='변경 내용을 확인해 주세요.'),400
        return jsonify(ok=True)
    finally:
        connection.close()

@groups.put('/groups/check')
def check():
    data = body()
    if data.get('item') not in ('read','gratitude','reflection') or type(data.get('value')) is not bool:
        return jsonify(error='체크 항목을 확인해 주세요.'), 400
    connection = db()
    try:
        me = identity(connection)
        if not me:
            return jsonify(error='그룹에 접속해 주세요.'), 401
        if me['role'] != 'member':
            return jsonify(error='지도사는 팀원 기록을 변경할 수 없어요.'), 403
        today = datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
        with connection:
            connection.execute('INSERT INTO checks VALUES(?,?,?,?) ON CONFLICT(mid,day,item) DO UPDATE SET value=excluded.value', (me['id'],today,data['item'],data['value']))
        return jsonify(ok=True)
    finally:
        connection.close()

@groups.put('/groups/character')
def choose_character():
    choice = body().get('character')
    if type(choice) is not int or not 0 <= choice < 9:
        return jsonify(error='캐릭터를 다시 선택해 주세요.'), 400
    connection = db()
    try:
        me = identity(connection)
        if not me:
            return jsonify(error='그룹에 접속해 주세요.'), 401
        if me['role'] != 'member':
            return jsonify(error='팀원만 자신의 캐릭터를 선택할 수 있어요.'), 403
        with connection:
            connection.execute('INSERT INTO characters VALUES(?,?) ON CONFLICT(mid) DO UPDATE SET choice=excluded.choice', (me['id'], choice))
        return jsonify(ok=True)
    finally:
        connection.close()
