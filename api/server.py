import os
import json
import urllib.request
import urllib.error
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv('/home/ubuntu/report/.env')

BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
CHAT_ID   = os.environ.get('TELEGRAM_CHAT_ID')

BRAIN_TOKEN   = os.environ.get('TELEGRAM_BRAINFORM_TOKEN')
BRAIN_CHAT_ID = os.environ.get('TELEGRAM_BRAINFORM_CHAT')

if not BOT_TOKEN or not CHAT_ID:
    raise RuntimeError('[FATAL] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 .env에 없습니다.')

if not BRAIN_TOKEN or not BRAIN_CHAT_ID:
    print('[WARN] TELEGRAM_BRAINFORM_TOKEN 또는 TELEGRAM_BRAINFORM_CHAT이 .env에 없습니다. /brain-popup 전송 비활성화.')

print(f'[OK] .env 로딩 완료 / chat_id: {CHAT_ID}')

app = Flask(__name__)


def _post_telegram(token: str, chat_id: str, text: str) -> None:
    payload = json.dumps({
        'chat_id':    chat_id,
        'text':       text,
        'parse_mode': 'HTML',
    }).encode('utf-8')
    req = urllib.request.Request(
        f'https://api.telegram.org/bot{token}/sendMessage',
        data=payload,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        if not result.get('ok'):
            raise RuntimeError(result.get('description', 'Telegram API 오류'))


def send_telegram(text: str) -> None:
    _post_telegram(BOT_TOKEN, CHAT_ID, text)


def send_brain_telegram(text: str) -> None:
    if not BRAIN_TOKEN or not BRAIN_CHAT_ID:
        raise RuntimeError('TELEGRAM_BRAINFORM_TOKEN 또는 TELEGRAM_BRAINFORM_CHAT이 설정되지 않았습니다.')
    _post_telegram(BRAIN_TOKEN, BRAIN_CHAT_ID, text)


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
        f'<b>인터뷰 일정:</b> {body.get("인터뷰일정", "-")}',
        f'<b>이름:</b> {body.get("이름", "-")}',
        f'<b>나이:</b> {body.get("나이", "-")}',
        f'<b>연락처:</b> {body.get("연락처", "-")}',
        f'<b>MBTI:</b> {body.get("MBTI", "-")}',
        f'<b>개인정보 이용동의:</b> {body.get("개인정보동의", "-")}',
    ])

    try:
        send_telegram(text)
        return jsonify({'ok': True})
    except Exception as e:
        app.logger.error('[Telegram 오류] %s', e)
        return jsonify({'ok': False, 'error': '전송 중 오류가 발생했습니다.'}), 500


@app.route('/sabujak-book', methods=['POST'])
def sabujak_book():
    body = request.get_json(silent=True) or {}

    text = '\n'.join([
        '📚 <b>사부작 북클럽 참여 신청</b>',
        '',
        f'<b>타임스탬프:</b> {body.get("타임스탬프", "-")}',
        f'<b>하루 일과 후:</b> {body.get("하루일과후", "-")}',
        f'<b>모임 분위기:</b> {body.get("모임분위기", "-")}',
        f'<b>참여 방식:</b> {body.get("참여방식", "-")}',
        f'<b>참여 동기:</b> {body.get("참여동기", "-")}',
        f'<b>가능 시간:</b> {body.get("가능시간", "-")}',
        f'<b>이름:</b> {body.get("이름", "-")}',
        f'<b>나이:</b> {body.get("나이", "-")}',
        f'<b>연락처:</b> {body.get("연락처", "-")}',
        f'<b>개인정보 동의:</b> {body.get("개인정보동의", "-")}',
    ])

    try:
        send_telegram(text)
        return jsonify({'ok': True})
    except Exception as e:
        app.logger.error('[Telegram 오류] %s', e)
        return jsonify({'ok': False, 'error': '전송 중 오류가 발생했습니다.'}), 500


@app.route('/seedsbook', methods=['POST'])
def seedsbook():
    body  = request.get_json(silent=True) or {}
    type_ = body.get('type', 'unknown')

    if type_ == 'survey':
        text = '\n'.join([
            '🌱 <b>씨앗책방 설문조사 제출</b>',
            '',
            f'<b>타임스탬프:</b> {body.get("timestamp", "-")}',
            f'<b>캐릭터:</b> {body.get("character", "-")}',
            f'<b>이름:</b> {body.get("name", "-")}',
            f'<b>나이:</b> {body.get("age", "-")}',
            f'<b>MBTI:</b> {body.get("mbti", "-")}',
            f'<b>책 선호도:</b> {body.get("preference", "-")}',
            f'<b>책에 대한 인식:</b> {body.get("bookThought", "-")}',
            f'<b>책을 접한 계기:</b> {body.get("bookTrigger", "-")}',
            f'<b>선호 카테고리:</b> {body.get("categories", "-")}',
            f'<b>취미/활동:</b> {body.get("hobby", "-")}',
            f'<b>추후 참여 횟수:</b> {body.get("participation", "-")}',
            f'<b>기타:</b> {body.get("etc", "-")}',
            f'<b>개인정보 동의:</b> {body.get("privacyConsent", "-")}',
        ])

    elif type_ == 'checklist':
        top    = body.get('top', [])
        scores = body.get('scores', {})
        score_lines = '\n'.join(
            f'  유형 {k}: {v}점' for k, v in sorted(scores.items(), key=lambda x: int(x[0]))
        )
        text = '\n'.join([
            '📋 <b>씨앗책방 체크리스트 제출</b>',
            '',
            f'<b>타임스탬프:</b> {body.get("timestamp", "-")}',
            f'<b>이름:</b> {body.get("name", "-")}',
            f'<b>MBTI:</b> {body.get("mbti", "-")}',
            f'<b>상위 유형:</b> {", ".join(top)}',
            f'<b>유형별 점수:</b>\n{score_lines}',
        ])

    else:
        text = f'🌱 <b>씨앗책방 (알 수 없는 유형)</b>\n{body}'

    try:
        send_telegram(text)
        return jsonify({'ok': True})
    except Exception as e:
        app.logger.error('[Telegram 오류] %s', e)
        return jsonify({'ok': False, 'error': '전송 중 오류가 발생했습니다.'}), 500


@app.route('/brain-popup', methods=['POST'])
def brain_popup():
    body  = request.get_json(silent=True) or {}
    name  = body.get('name', '').strip()
    phone = body.get('phone', '').strip()
    count = body.get('count', '-')
    staff = body.get('staffConfirmed', '-')

    if not name or not phone or not count:
        return jsonify({'ok': False, 'error': '필수 항목을 입력해주세요.'}), 400

    future = body.get('futureProgram', '미선택')

    text = '\n'.join([
        '🧠 <b>뇌게임 상품 수령 신청</b>',
        '',
        f'<b>성함:</b> {name}',
        f'<b>연락처:</b> {phone}',
        f'<b>통과 개수:</b> {count}',
        f'<b>스태프 확인:</b> {staff}',
        f'<b>차후 체험 신청:</b> {future}',
    ])

    try:
        send_brain_telegram(text)
        return jsonify({'ok': True})
    except Exception as e:
        app.logger.error('[Telegram 오류] %s', e)
        return jsonify({'ok': False, 'error': '전송 중 오류가 발생했습니다.'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('API_PORT', 3000))
    app.run(host='0.0.0.0', port=port)
