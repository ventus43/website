'use strict';
const items = [['read', '독서했어요', '조금이라도 읽었다면 충분해요'], ['gratitude', '감사일기 썼어요', '다른 곳에 썼어도 체크만 하면 돼요'], ['reflection', '느낀점 나눴어요', '모임이나 대화에서 나눴다면 체크해요']];
const characters = [['🌱','새싹이'],['🌿','잎싹이'],['🌷','꽃봉이'],['🌳','나무'],['🦉','부엉씨앗'],['🌞','햇살씨앗'],['💧','이슬이'],['🪴','뿌리'],['🍊','열매']];
const key = 'seed-bookstore-group-v1';
const $ = id => document.getElementById(id);
function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function count(day) { return items.filter(([id]) => day?.[id] === true).length; }
let state = {name:'우리 독서 정원', character:0, solo:false, days:{}};
let storageError = '';
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && typeof saved.name === 'string' && saved.days && typeof saved.days === 'object' && !Array.isArray(saved.days)) {
    state = {name:saved.name.slice(0,40), character:Number.isInteger(saved.character) && characters[saved.character] ? saved.character : 0, solo:saved.solo === true, days:saved.days};
  }
} catch { storageError = '저장된 기록을 불러오지 못했어요. 현재 화면에서 체험할 수 있어요.'; }
function save() {
  try { localStorage.setItem(key, JSON.stringify(state)); storageError = ''; }
  catch { storageError = '기기에 저장하지 못했어요. 창을 닫으면 이번 변경이 사라질 수 있어요.'; }
  render();
}
for (const [index, [emoji,name]] of characters.entries()) {
  const option = new Option(`${emoji} ${name}`, index); $('character-select').add(option);
}
for (const [id,label,hint] of items) {
  const button = document.createElement('button'); button.className = 'check'; button.dataset.item = id;
  button.innerHTML = `<span class="check-icon" aria-hidden="true"></span><span><strong>${label}</strong><small>${hint}</small></span>`;
  button.addEventListener('click', () => {
    const day = dayKey(); state.days[day] ||= {}; state.days[day][id] = !state.days[day][id]; save();
    $('character').classList.remove('bloom'); requestAnimationFrame(() => $('character').classList.add('bloom'));
  }); $('check-list').append(button);
}
function render() {
  const today = dayKey(), done = count(state.days[today]);
  $('group-name').textContent = state.solo ? '나만의 작은 정원' : state.name;
  $('solo').checked = state.solo;
  $('mode-note').textContent = state.solo ? '체크와 성장을 먼저 경험해 보세요. 언제든 그룹 화면으로 돌아갈 수 있어요.' : '그룹의 첫 구성원으로 시작해 보세요.';
  $('date').textContent = new Date().toLocaleDateString('ko-KR', {month:'long',day:'numeric',weekday:'short'});
  $('character-select').value = state.character;
  $('character').textContent = characters[state.character][0]; $('character-name').textContent = characters[state.character][1];
  $('character-message').textContent = done ? '오늘의 실천 덕분에 조금 더 자랐어요.' : '쉬었다 돌아와도 괜찮아요. 오늘부터 함께해요.';
  const total = Object.values(state.days).reduce((sum,day) => sum + count(day),0);
  $('growth').value = total % 15; $('growth-label').textContent = `성장 ${Math.floor(total/15)+1}단계 · 누적 ${total}개 실천 · 다음 단계까지 ${15-total%15}개`;
  for (const button of document.querySelectorAll('[data-item]')) {
    const checked = state.days[today]?.[button.dataset.item] === true;
    button.setAttribute('aria-pressed', String(checked)); button.querySelector('.check-icon').textContent = checked ? '✓' : '';
  }
  $('completion').textContent = storageError || (done === 3 ? '오늘의 세 가지 실천을 모두 마쳤어요 🌱' : `오늘 ${done}/3 완료 · 내용 입력 없이 체크만 하세요`);
  $('week').replaceChildren(); let activeDays = 0;
  for (let offset=6; offset>=0; offset--) {
    const date = new Date(); date.setDate(date.getDate()-offset); const n = count(state.days[dayKey(date)]); if(n) activeDays++;
    const cell = document.createElement('div'); cell.className = `day${offset===0?' today':''}`;
    cell.innerHTML = `<span>${date.getMonth()+1}/${date.getDate()}</span><span class="day-icon" aria-hidden="true">${n ? '🌱' : '·'}</span><span>${n}/3 완료</span>`;
    $('week').append(cell);
  }
  $('week-count').textContent = `${activeDays}일 함께했어요`;
}
$('solo').addEventListener('change', event => { state.solo = event.target.checked; save(); });
$('character-select').addEventListener('change', event => { state.character = Number(event.target.value); save(); });
$('settings').addEventListener('click', () => { $('group-input').value = state.name; $('group-dialog').showModal(); });
$('cancel').addEventListener('click', () => $('group-dialog').close());
$('group-form').addEventListener('submit', event => {
  event.preventDefault(); const name = $('group-input').value.trim();
  if (!name) { $('group-input').setCustomValidity('모임 이름을 입력해 주세요.'); $('group-input').reportValidity(); return; }
  state.name = name; save(); $('group-dialog').close();
});
$('group-input').addEventListener('input', event => event.target.setCustomValidity(''));
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
render();
