require('dotenv').config({ path: '/home/ubuntu/report/.env' });

const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    const tgRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'HTML',
        }),
      }
    );

    const result = await tgRes.json();
    if (!result.ok) throw new Error(result.description);

    res.json({ ok: true });
  } catch (err) {
    console.error('Telegram error:', err.message);
    res.status(500).json({ ok: false, error: '전송 중 오류가 발생했습니다.' });
  }
});

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => console.log(`API server listening on port ${PORT}`));
