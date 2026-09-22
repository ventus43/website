import os
import tempfile
from flask import Flask
from seed_groups import groups

with tempfile.TemporaryDirectory() as directory:
    os.environ['SEED_GROUP_DB'] = directory + '/test.sqlite3'
    app = Flask(__name__)
    app.register_blueprint(groups)
    client = app.test_client()
    assert client.get('/groups/me').status_code == 401
    assert client.post('/groups', json={'name':[], 'member':'지도사'}).status_code == 400
    manager = client.post('/groups', json={'name':'정원','member':'지도사'}).json['token']
    def auth(token): return {'Authorization':'Bearer '+token}
    group = client.get('/groups/me', headers=auth(manager)).json
    tokens = [client.post('/groups/join', json={'invite':group['invite'],'member':f'팀원{i}'}).json['token'] for i in range(3)]
    assert client.post('/groups/join', json={'invite':group['invite'],'member':'네번째'}).status_code == 409
    assert client.put('/groups/check', headers=auth(manager), json={'item':'read','value':True}).status_code == 403
    for item in ('read','gratitude','reflection'):
        assert client.put('/groups/check', headers=auth(tokens[0]), json={'item':item,'value':True}).status_code == 200
    assert client.put('/groups/check', headers=auth(tokens[0]), json={'item':'read','value':'yes'}).status_code == 400
    snapshot = client.get('/groups/me', headers=auth(manager)).json
    assert snapshot['members'][1]['days'][snapshot['today']] == dict(read=True,gratitude=True,reflection=True)
    other = client.get('/groups/me', headers=auth(tokens[1])).json
    assert other['invite'] is None and other['members'][1]['days'] == {}
    assert client.put('/groups/character',json={'character':2}).status_code == 401
    assert client.put('/groups/character',headers=auth(manager),json={'character':2}).status_code == 403
    for invalid in (-1,9,True,'2',None):
        assert client.put('/groups/character',headers=auth(tokens[0]),json={'character':invalid}).status_code == 400
    assert client.put('/groups/character',headers=auth(tokens[0]),json={'character':8}).status_code == 200
    after = client.get('/groups/me',headers=auth(manager)).json
    assert after['members'][1]['character'] == 8
    assert after['members'][2]['character'] == 0
    assert after['members'][1]['days'] == snapshot['members'][1]['days']
    client.put('/groups/check', headers=auth(tokens[0]), json={'item':'read','value':False})
    assert client.get('/groups/me', headers=auth(manager)).json['members'][1]['days'][snapshot['today']]['read'] is False
    print('PASS: authentication, validation, capacity, manager permissions, independent checks, privacy, undo')
