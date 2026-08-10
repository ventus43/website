const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwj-Oj7SxvZPefNuf3C2wKrXSlkacpzTI4rQ0v2ER2NYEi7YGOGZ3v_KUgbq75ZQjCLhA/exec'; // ← 배포 후 교체

const answers = { q2: [], q3: [], q5: '', q6: '', q7: '', q8: '' };
const TOTAL = 3;

/* ── Date range setup ── */
document.addEventListener('DOMContentLoaded', () => {
  const d = document.getElementById('q5-date');
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate  = new Date(); maxDate.setMonth(maxDate.getMonth() + 1);
  const fmtDate = dt => {
    const pad = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  };
  d.min = fmtDate(tomorrow);
  d.max = fmtDate(maxDate);

  document.getElementById('privacyModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById('q8-tel').addEventListener('input', function () { formatTel(this); });
});

/* ── Navigation ── */
function nextStep(from, to) {
  document.getElementById('progressContainer').style.display = 'block';
  document.getElementById('homeBtn').style.display = 'flex';
  goTo(from, to);
}

function goTo(from, to) {
  document.getElementById('step-' + from).classList.remove('active');
  setTimeout(() => {
    document.getElementById('step-' + to).classList.add('active');
    setProgress(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 110);
}

function setProgress(step) {
  if (step === 0) return;
  const pct = step === 3 ? 100 : Math.round((step / TOTAL) * 100);
  document.getElementById('progressBar').style.width = pct + '%';
}

/* ── Radio (single, auto-advance) ── */
function selectRadio(el, key, value, from, to) {
  el.parentElement.querySelectorAll('.option-label').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  answers[key] = value;
  setTimeout(() => goTo(from, to), 300);
}

/* ── Checkbox (multi) ── */
function toggleCheck(el, key, value) {
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) {
    if (!answers[key].includes(value)) answers[key].push(value);
  } else {
    answers[key] = answers[key].filter(v => v !== value);
  }
}

/* ── User info + 인터뷰 일정 + open modal ── */
function openPrivacyModal() {
  const name    = document.getElementById('q6-name').value.trim();
  const age     = document.getElementById('q7-age').value.trim();
  const tel     = document.getElementById('q8-tel').value.trim();
  const dateVal = document.getElementById('q5-date').value;
  const timeVal = document.getElementById('q5-time').value.trim();
  const err     = document.getElementById('q6-error');
  if (!name || !age || !tel || !dateVal || !timeVal) { err.style.display = 'block'; return; }
  err.style.display = 'none';
  const [y, m, d] = dateVal.split('-');
  answers.q5 = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 ${timeVal}`;
  answers.q6 = name; answers.q7 = age; answers.q8 = tel;
  document.getElementById('privacyModal').classList.add('open');
}

/* ── Modal ── */
function closeModal() {
  document.getElementById('privacyModal').classList.remove('open');
  document.getElementById('privacyConsent').checked = false;
}

function confirmAndSubmit() {
  if (!document.getElementById('privacyConsent').checked) {
    alert('개인정보 수집 및 이용에 동의해 주세요.');
    return;
  }
  closeModal();
  renderSummary();
  goTo(2, 3);
  const payload = buildPayload();
  sendToSheets(payload);
  sendToTelegram(payload);
}

/* ── 공통 payload 빌더 ── */
function buildPayload() {
  return {
    type:               'survey',
    타임스탬프:           new Date().toLocaleString('ko-KR'),
    참여한문화행사:        answers.q2.join(', '),
    참여하고싶은문화행사:  answers.q3.join(', '),
    인터뷰일정:           answers.q5,
    이름:                answers.q6,
    나이:                answers.q7,
    연락처:              answers.q8,
    개인정보동의:         '동의'
  };
}

/* ── Google Sheets (Apps Script) ── */
function sendToSheets(payload) {
  if (!APPS_SCRIPT_URL) return;
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  }).catch(err => console.error('시트 전송 실패:', err));
}

/* ── Telegram 알림 ── */
function sendToTelegram(payload) {
  fetch('/api/survey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.error('텔레그램 전송 실패:', err));
}

/* ── 데이터 초기화 및 첫 화면 이동 ── */
function resetSurvey() {
  answers.q2 = []; answers.q3 = [];
  answers.q5 = ''; answers.q6 = ''; answers.q7 = ''; answers.q8 = '';

  document.querySelectorAll('.option-label.selected, .category-card.selected').forEach(el => el.classList.remove('selected'));

  ['q5-date', 'q5-time', 'q6-name', 'q7-age', 'q8-tel'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('q6-error').style.display = 'none';

  document.getElementById('progressContainer').style.display = 'none';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('homeBtn').style.display = 'none';

  document.getElementById('privacyModal').classList.remove('open');
  document.getElementById('privacyConsent').checked = false;

  document.querySelector('.step.active')?.classList.remove('active');
  document.getElementById('step-0').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── 제출 결과 요약 렌더링 ── */
function renderSummary() {
  const rows = [
    { label: '참여한 문화행사',        value: answers.q2.join(', ') },
    { label: '참여하고 싶은 문화행사', value: answers.q3.join(', ') },
    { label: '인터뷰 일정',           value: answers.q5 },
    { label: '이름',                  value: answers.q6 },
    { label: '나이',                  value: answers.q7 },
    { label: '연락처',                value: answers.q8 },
    { label: '개인정보 이용동의',      value: '동의' },
  ];
  document.getElementById('summaryBlock').innerHTML = rows.map(r =>
    `<div class="summary-row">
      <span class="summary-label">${r.label}</span>
      <span class="summary-value">${r.value || '-'}</span>
    </div>`
  ).join('');
}

/* ── 전화번호 자동 포맷 ── */
function formatTel(el) {
  const digits = el.value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 11) {
    el.value = digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
  } else {
    el.value = digits;
  }
}

/* ── Info 이미지 모달 ── */
let infoIndex = 0;
const INFO_TOTAL = 2;

function openInfoModal() {
  infoIndex = 0;
  updateInfoSlider(false);
  document.getElementById('infoModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeInfoModal() {
  document.getElementById('infoModal').classList.remove('open');
  document.body.style.overflow = '';
}

function slideInfo(dir) {
  infoIndex = (infoIndex + dir + INFO_TOTAL) % INFO_TOTAL;
  updateInfoSlider(true);
}

function updateInfoSlider(animate) {
  const slider = document.getElementById('infoSlider');
  slider.style.transition = animate ? 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
  slider.style.transform = `translateX(-${infoIndex * 100}%)`;
  document.querySelectorAll('.info-dot').forEach((d, i) => {
    d.classList.toggle('active', i === infoIndex);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const slider = document.getElementById('infoSlider');
  let tx = 0;

  slider.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 36) slideInfo(dx < 0 ? 1 : -1);
  });

  document.getElementById('infoModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeInfoModal();
  });
});

/* ── 전역 노출 (HTML onclick에서 호출) ── */
window.nextStep         = nextStep;
window.goTo             = goTo;
window.selectRadio      = selectRadio;
window.toggleCheck      = toggleCheck;
window.openPrivacyModal = openPrivacyModal;
window.closeModal       = closeModal;
window.confirmAndSubmit = confirmAndSubmit;
window.resetSurvey      = resetSurvey;
window.formatTel        = formatTel;
window.openInfoModal    = openInfoModal;
window.closeInfoModal   = closeInfoModal;
window.slideInfo        = slideInfo;
