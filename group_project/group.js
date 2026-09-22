'use strict';
// ponytail: private access key for this pilot; replace with account sessions for recovery across devices.
let sessionToken = sessionStorage.getItem('seed-group-token') || '';
let remoteGroup = null;
const groupPanel = document.createElement('section');
groupPanel.className = 'history';
groupPanel.id = 'group-panel';
groupPanel.innerHTML = `<p class="eyebrow">THREE READERS, ONE GUIDE</p><h2>팀원 3명과 지도사 1명</h2>
<p>지도사는 팀원별 실천 현황을 확인하고, 팀원은 자신의 체크를 남겨요.</p>
<form id="connect-form"><label>내 이름 <input id="member-name" maxlength="40" required></label>
<label>모임 이름 (생성할 때) <input id="new-group-name" maxlength="40"></label>
<label>초대 코드 (참여할 때) <input id="invite-code" autocomplete="off"></label>
<p>체크 여부는 지도사에게 공개됩니다. 다른 팀원에게는 개인별 기록을 표시하지 않아요.</p>
<button name="action" value="create">지도사로 그룹 만들기</button> <button name="action" value="join">팀원으로 참여하기</button></form>
<p id="group-status" role="status"></p><div id="remote-content"></div><button id="refresh-group" hidden>현황 새로고침</button>
<button id="leave-session" hidden>접속 종료</button><p id="key-notice" hidden>이 탭을 닫기 전 개인 접속 키를 보관하세요. 키를 아는 사람은 내 권한으로 접속할 수 있어요.</p>
<details><summary>개인 접속 키로 다시 접속</summary><form id="restore-form"><input id="access-key" type="password" aria-label="개인 접속 키" required><button>접속</button></form><button id="show-key" type="button">내 접속 키 보기</button><output id="key-output"></output></details>`;
document.querySelector('main').prepend(groupPanel);
async function api(path, method='GET', data) {
  const response = await fetch(`/api/groups${path}`, {method, headers:{'Content-Type':'application/json', Authorization:`Bearer ${sessionToken}`}, body:data ? JSON.stringify(data) : undefined});
  const result = await response.json().catch(() => ({error:'그룹 서버에 연결할 수 없어요. 서버 실행 상태를 확인해 주세요.'}));
  if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했어요.');
  return result;
}
function remoteRender() {
  const connected = !!remoteGroup;
  $('connect-form').hidden = connected;
  $('refresh-group').hidden = $('leave-session').hidden = $('key-notice').hidden = !connected;
  $('remote-content').replaceChildren();
  document.querySelector('.checks').hidden = connected;
  document.querySelector('.garden').hidden = connected;
  document.querySelector('.history:not(#group-panel)').hidden = connected;
  document.querySelector('.notice').textContent = connected ? '그룹 서버 연결됨 · 새로고침으로 최신 현황을 확인하세요.' : '로컬 체험 버전 · 이 브라우저에만 저장됩니다.';
  $('solo').disabled = connected; $('settings').disabled = connected;
  if (!connected) return;
  $('group-name').textContent = remoteGroup.name;
  const manager = remoteGroup.role === 'manager';
  $('group-status').textContent = manager ? '지도사 관리 화면 · 팀원 3명 기준 · 한국 시간' : '팀원 화면 · 체크는 서버에 저장됩니다 · 한국 시간';
  if(manager) {
    const invite = document.createElement('p'); invite.textContent = `팀원 초대 코드: ${remoteGroup.invite}`; invite.style.overflowWrap = 'anywhere'; $('remote-content').append(invite);
  }
  const members = remoteGroup.members.filter(m => m.role === 'member');
  const summary = document.createElement('p'); summary.textContent = `팀원 ${members.length}/3명 · 지도사 1명`; $('remote-content').append(summary);
  for(const member of members) {
    if(!manager && member.id !== remoteGroup.me) continue;
    const card = document.createElement('article'); card.className='member-card';
    const title = document.createElement('h3'); title.textContent = member.name; card.append(title);
    const day = member.days[remoteGroup.today] || {};
    for(const [item,label] of items) {
      const button = document.createElement('button'); button.textContent = `${day[item] ? '✓' : '○'} ${label}`;
      button.setAttribute('aria-pressed',String(day[item] === true)); button.disabled = manager;
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await api('/check','PUT',{item,value:!day[item]}); await refreshRemote(); }
        catch(error) { $('group-status').textContent=error.message; button.disabled=false; }
      }); card.append(button);
    }
    if(manager) {
      const history=document.createElement('p');
      history.textContent=Array.from({length:7},(_,i)=>{const d=new Date(`${remoteGroup.today}T12:00:00`);d.setDate(d.getDate()-6+i);return `${dayKey(d).slice(5)} ${count(member.days[dayKey(d)])}/3`;}).join(' · ');
      card.append(history);
    }
    $('remote-content').append(card);
  }
  if(manager && !members.length) { const p=document.createElement('p');p.textContent='아직 참여한 팀원이 없어요. 초대 코드를 전달해 주세요.';$('remote-content').append(p); }
}
async function refreshRemote() { remoteGroup=await api('/me'); remoteRender(); }
$('connect-form').addEventListener('submit', async event => {
  event.preventDefault(); const action=event.submitter.value;
  const buttons=[...event.currentTarget.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);
  try {
    const result=await api(action==='create'?'':'/join','POST',{member:$('member-name').value.trim(),name:$('new-group-name').value.trim(),invite:$('invite-code').value.trim()});
    sessionToken=result.token; sessionStorage.setItem('seed-group-token',sessionToken); await refreshRemote();
  } catch(error) { $('group-status').textContent=error.message; }
  finally {buttons.forEach(b=>b.disabled=false);}
});
$('restore-form').addEventListener('submit',async event=>{event.preventDefault();const previous=sessionToken;sessionToken=$('access-key').value.trim();try{await refreshRemote();sessionStorage.setItem('seed-group-token',sessionToken);$('access-key').value='';}catch(error){sessionToken=previous;$('group-status').textContent=error.message;}});
$('show-key').onclick=()=>{$('key-output').textContent=sessionToken || '접속한 그룹이 없어요.';};
$('refresh-group').onclick=()=>refreshRemote().catch(error=>$('group-status').textContent=error.message);
$('leave-session').onclick=()=>{sessionToken='';remoteGroup=null;sessionStorage.removeItem('seed-group-token');$('key-output').textContent='';$('group-status').textContent='접속을 종료했어요. 개인 키로 다시 접속할 수 있어요.';render();remoteRender();};
if(sessionToken) refreshRemote().catch(error=>$('group-status').textContent=error.message);
