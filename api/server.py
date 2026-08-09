import os
import json
import urllib.request
import urllib.error
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv('/home/ubuntu/report/.env')

BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
CHAT_ID   = os.environ.get('TELEGRAM_CHAT_ID')

if not BOT_TOKEN or not CHAT_ID:
    raise RuntimeError('[FATAL] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 .env에 없습니다.')

print(f'[OK] .env 로딩 완료 / chat_id: {CHAT_ID}')

app = Flask(__name__)


def send_telegram(text: str) -> None:
    payload = json.dumps({
        'chat_id':    CHAT_ID,
        'text':       text,
        'parse_mode': 'HTML',
    }).encode('utf-8')

    req = urllib.request.Request(
        f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage',
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )

    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        if not result.get('ok'):
            raise RuntimeError(result.get('description', 'Telegram API 오류'))


@app.route('/contact', methods=['POST'])
def contact():
    body    = request.get_json(silent=True) or {}
    name    = body.get('name', '').strip()
    email   = body.get('email', '').strip()
    type_   = body.get('type', '미선택') or '미선택'
    message = body.get('message', '').strip()

    if not name or not email or not message:
        return jsonify({'ok': False, 'error': '필수 항목을 입력해주세요.'}), 400

    text = '\n'.join([
        '📬 <b>새로운 문의가 도착했습니다</b>',
        '',
        f'<b>이름:</b> {name}',
        f'<b>이메일:</b> {email}',
        f'<b>유형:</b> {type_}',
        '<b>내용:</b>',
        message,
    ])

    try:
        send_telegram(text)
        return jsonify({'ok': True})
    except Exception as e:
        app.logger.error('[Telegram 오류] %s', e)
        return jsonify({'ok': False, 'error': '전송 중 오류가 발생했습니다.'}), 500


@app.route('/survey', methods=['POST'])
def survey():
    body = request.get_json(silent=True) or {}

    text = '\n'.join([
        '📋 <b>ventus 제출양식 도착</b>',
        '',
        f'<b>타임스탬프:</b> {body.get("타임스탬프", "-")}',
        f'<b>참여한 문화행사:</b> {body.get("참여한문화행사", "-")}',
        f'<b>참여하고 싶은 문화행사:</b> {body.get("참여하고싶은문화행사", "-")}',
        f'<b>무료 티켓 수령 의향:</b> {body.get("무료티켓의향", "-")}',
        f'<b>인터뷰 일정:</b> {body.get("인터뷰일정", "-")}',
        f'<b>이름:</b> {body.get("이름", "-")}',
        f'<b>나이:</b> {body.get("나이", "-")}',
        f'<b>연락처:</b> {body.get("연락처", "-")}',
    ])

    try:
        send_telegram(text)
        return jsonify({'ok': True})
    except Exception as e:
        app.logger.error('[Telegram 오류] %s', e)
        return jsonify({'ok': False, 'error': '전송 중 오류가 발생했습니다.'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('API_PORT', 3000))
    app.run(host='0.0.0.0', port=port)
