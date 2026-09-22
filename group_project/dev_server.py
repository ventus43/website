"""Run from repository root: python3 group_project/dev_server.py"""
import os
import sys
from pathlib import Path
from flask import Flask, send_from_directory

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'api'))
from seed_groups import groups

os.environ.setdefault('SEED_GROUP_DB', str(Path.home() / '.local/share/seed-bookstore/groups.sqlite3'))
app = Flask(__name__)
app.register_blueprint(groups, url_prefix='/api')

@app.route('/')
@app.route('/group_project/')
def index():
    return send_from_directory(root / 'group_project', 'index.html')

@app.route('/<path:path>')
def static_file(path):
    return send_from_directory(root / 'group_project', path.removeprefix('group_project/'))

if __name__ == '__main__':
    app.run(port=8080)
