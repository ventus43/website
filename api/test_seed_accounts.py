import os
import tempfile
from flask import Flask
from seed_groups import groups, db

with tempfile.TemporaryDirectory() as directory:
    os.environ['SEED_GROUP_DB']=directory+'/accounts.sqlite3'
    app=Flask(__name__); app.register_blueprint(groups); client=app.test_client()
    def auth(token): return {'Authorization':'Bearer '+token}
    def post(path,data,token=''): return client.post('/groups'+path,json=data,headers=auth(token))
    manager=post('',{'name':'정원','member':'지도사'}).json['token']
    def me(token): return client.get('/groups/me',headers=auth(token))
    invite=me(manager).json['invite']
    member=post('/join',{'invite':invite,'member':'팀원'}).json['token']
    mid=me(member).json['me']
    password='test-only-password-123'
    creds={'username':'reader_1','password':password}
    recovery=post('/account',creds,member).json['recovery']
    assert post('/account',creds,manager).status_code==409
    assert post('/login',{**creds,'password':'wrong-password'}).status_code==401
    member2=post('/login',creds).json['token']
    assert me(member).status_code==401
    assert me(member2).json['username']=='reader_1'
    recovered=post('/recover',{**creds,'password':'changed-test-password','recovery':recovery}).json
    assert recovered['recovery']!=recovery
    assert me(member2).status_code==401
    assert post('/recover',{**creds,'recovery':recovery}).status_code==401
    assert post('/login',creds).status_code==401
    member3=recovered['token']
    assert post('/manage',{'action':'invite'},member3).status_code==403
    othermanager=post('',{'name':'다른 그룹','member':'다른 지도사'}).json['token']
    assert post('/manage',{'action':'remove','member':mid},othermanager).status_code==404
    assert post('/manage',{'action':'reset','member':me(manager).json['me']},manager).status_code==404
    issued=post('/manage',{'action':'reset','member':mid},manager).json
    assert me(member3).status_code==401
    assert post('/login',{**creds,'password':'changed-test-password'}).status_code==401
    member4=post('/recover',{**creds,'recovery':issued['recovery']}).json['token']
    assert me(member4).status_code==200
    assert post('/manage',{'action':'rename','name':'새 정원'},manager).status_code==200
    assert me(manager).json['name']=='새 정원'
    assert post('/manage',{'action':'invite'},manager).status_code==200
    assert post('/join',{'invite':invite,'member':'늦은 팀원'}).status_code==404
    assert post('/manage',{'action':'remove','member':mid},manager).status_code==200
    assert me(member4).status_code==401
    assert post('/login',creds).status_code==401
    assert all(m['id']!=mid for m in me(manager).json['members'])
    invite=me(manager).json['invite']
    for i in range(3): assert post('/join',{'invite':invite,'member':str(i)}).status_code==201
    assert post('/join',{'invite':invite,'member':'초과'}).status_code==409
    for i in range(10): assert post('/login',{'username':'unknown_user','password':password}).status_code==401
    assert post('/login',{'username':'unknown_user','password':password}).status_code==429
    connection=db()
    stored=connection.execute('SELECT password,recovery FROM accounts WHERE mid=?',(mid,)).fetchone()
    assert stored['password']!=password and stored['recovery']!=issued['recovery']
    connection.close()
    print('PASS: account hashes, login rotation, one-use recovery, reset invalidation, group isolation, invite rotation, soft removal, capacity, rate limit')
