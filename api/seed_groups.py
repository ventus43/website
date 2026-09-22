"""Small group API. Tokens are private access keys, not public member IDs."""
import hashlib
import os
import secrets
import sqlite3
from datetime import datetime
from zoneinfo import ZoneInfo
from flask import Blueprint, request, jsonify

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
    ''')
    return connection

def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()

def body():
    value = request.get_json(silent=True)
    return value if isinstance(value, dict) else {}

def valid_name(value):
    return isinstance(value, str) and 1 <= len(value.strip()) <= 40

def identity(connection):
    header = request.headers.get('Authorization', '')
    token = header.removeprefix('Bearer ')
    return connection.execute('SELECT * FROM members WHERE token=?', (digest(token),)).fetchone()

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
        for member in connection.execute('SELECT id,name,role FROM members WHERE gid=? ORDER BY rowid', (me['gid'],)):
            value = dict(member)
            value['days'] = {}
            # Only the manager and the member themselves can see individual checks.
            if me['role'] == 'manager' or me['id'] == member['id']:
                for check in connection.execute('SELECT day,item,value FROM checks WHERE mid=?', (member['id'],)):
                    value['days'].setdefault(check['day'], {})[check['item']] = bool(check['value'])
            members.append(value)
        return jsonify(name=group['name'], me=me['id'], role=me['role'], members=members,
                       today=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat(),
                       invite=group['invite'] if me['role'] == 'manager' else None)
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
