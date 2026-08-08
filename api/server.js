require('dotenv').config({ path: '/home/ubuntu/report/.env' });

const https   = require('https');
const express = require('express');
const app     = express();

// .env 로딩 검증 — 누락 시 즉시 종료
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('[FATAL] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 .env에 없습니다.');
  process.exit(1);
}
console.log('[OK] .env 로딩 완료 / chat_id:', TELEGRAM_CHAT_ID);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id:    TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
    });

    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path:     `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(raw);
            if (!result.ok) reject(new Error(result.description || 'Telegram API 오류'));
            else resolve(result);
          } catch (e) {
            reject(new Error('Telegram 응답 파싱 실패: ' + raw));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

app.post('/contact', async (req, res) => {
  const { name, email, type, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: '필수 항목을 입력해주세요.' });
  }

  const text = [
    '📬 <b>새로운 문의가 도착했습니다</b>',
    '',
    `<b>이름:</b> ${name}`,
    `<b>이메일:</b> ${email}`,
    `<b>유형:</b> ${type || '미선택'}`,
    '<b>내용:</b>',
    message,
  ].join('\n');

  try {
    await sendTelegram(text);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Telegram 오류]', err.message);
    res.status(500).json({ ok: false, error: '전송 중 오류가 발생했습니다.' });
  }
});

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => console.log(`[API] 포트 ${PORT} 에서 실행 중`));
