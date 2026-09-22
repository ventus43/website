'use strict';
// ponytail: private access key for this pilot; replace with account sessions for recovery across devices.
let sessionToken = sessionStorage.getItem('seed-group-token') || '';
let remoteGroup = null;
let refreshVersion = 0;
let saving = false;
const groupPanel = document.createElement('section');
groupPanel.className = 'history';
groupPanel.id = 'group-panel';
groupPanel.innerHTML = `<p class="eyebrow">THREE READERS, ONE GUIDE</p><h2>팀원 3명과 지도사 1명</h2>
<p>지도사는 팀원별 실천 현황을 확인하고, 팀원은 자신의 체크를 남겨요.</p>
<form id="connect-form"><label>내 이름 <input id="member-name" maxlength="40" required></label>
<label>모임 이름 (생성할 때) <input id="new-group-name" maxlength="40"></label>
<label>초대 코드 (참여할 때) <input id="invite-code" autocomplete="off"></label>
<p>체크 여부는 지도사에게 공개됩니다. 지도사는 모임 중 ‘함께 보기’ 화면으로 팀원별 상태와 그룹 정원을 보여줄 수 있어요.</p>
<button name="action" value="create">지도사로 그룹 만들기</button> <button name="action" value="join">팀원으로 참여하기</button></form>
<p id="group-status" role="status"></p><div id="remote-content"></div><button id="refresh-group" hidden>현황 새로고침</button>
<button id="leave-session" hidden>접속 종료</button><p id="key-notice" hidden>이 탭을 닫기 전 개인 접속 키를 보관하세요. 키를 아는 사람은 내 권한으로 접속할 수 있어요.</p>
<details><summary>개인 접속 키로 다시 접속</summary><form id="restore-form"><input id="access-key" type="password" aria-label="개인 접속 키" required><button>접속</button></form><button id="show-key" type="button">내 접속 키 보기</button><output id="key-output"></output></details>`;
document.querySelector('main').prepend(groupPanel);
function invitationUrl(code) {
  const url=new URL(location.href); url.search='';
  url.hash=new URLSearchParams({invite:code}).toString();
  return url.href;
}
const invitation=new URLSearchParams(location.hash.slice(1)).get('invite');
if(invitation) {
  $('invite-code').value=invitation;
  $('new-group-name').closest('label').hidden=true;
  $('connect-form').querySelector('[value="create"]').hidden=true;
  $('group-status').textContent='초대받은 모임에 참여하려면 내 이름을 입력해 주세요.';
}
const presentationButton = document.createElement('button');
presentationButton.textContent = '함께 보기'; presentationButton.hidden = true;
groupPanel.insertBefore(presentationButton, $('refresh-group'));
const presentation = document.createElement('dialog');
presentation.className = 'presentation';
presentation.setAttribute('aria-labelledby','presentation-title');
presentation.innerHTML = '<div class="presentation-top"><p>씨앗책방 · 함께 보는 우리 정원</p><button autofocus>관리 화면으로 돌아가기</button></div><h1 id="presentation-title"></h1><p class="presentation-sync" role="status"></p><div class="presentation-body"></div>';
document.body.append(presentation);
presentation.querySelector('button').onclick = () => presentation.close();
presentationButton.onclick = () => {
  if(remoteGroup?.role !== 'manager') return;
  renderPresentation(); presentation.showModal();
};
function gardenSummary(group) {
  const members=group.members.filter(member=>member.role==='member');
  return {members, today:members.reduce((sum,member)=>sum+count(member.days[group.today]),0),
    total:members.reduce((sum,member)=>sum+Object.values(member.days).reduce((n,day)=>n+count(day),0),0)};
}
function renderPresentation() {
  if(remoteGroup?.role !== 'manager') { if(presentation.open) presentation.close(); return; }
  const {members,today,total}=gardenSummary(remoteGroup);
  $('presentation-title').textContent=remoteGroup.name;
  const content=presentation.querySelector('.presentation-body'); content.replaceChildren();
  const overview=document.createElement('section'); overview.className='garden-overview';
  const heading=document.createElement('h2'); heading.textContent='우리 그룹 정원';
  const description=document.createElement('p');
  description.textContent=`오늘 ${today}/${members.length*3}개 실천 · 누적 ${total}개 · 팀원 ${members.length}/3명`;
  const plants=gardenScene(members,remoteGroup.today);
  overview.append(heading,plants,description); content.append(overview);
  const cards=document.createElement('div'); cards.className='presentation-members';
  for(const member of members) {
    const card=document.createElement('article'); card.className='member-card';
    const title=document.createElement('h2'); title.textContent=member.name;
    const totalChecks=Object.values(member.days).reduce((sum,day)=>sum+count(day),0);
    const growth=document.createElement('p'); growth.textContent=`${characters[member.character][0]} ${characters[member.character][1]} · 성장 ${Math.floor(totalChecks/15)+1}단계`;
    const list=document.createElement('ul');
    for(const [item,label] of items) {
      const entry=document.createElement('li');
      const completed=member.days[remoteGroup.today]?.[item]===true;
      entry.textContent=`${completed?'✓':'○'} ${label} · ${completed?'완료':'아직 체크 전'}`;
      entry.className=completed?'completed':''; list.append(entry);
    }
    const caption=document.createElement('p'); caption.textContent=`누적 ${totalChecks}개 실천 · 쉬어간 날에도 성장은 남아요.`;
    card.append(title,seedArt(member.character,totalChecks,count(member.days[remoteGroup.today])),growth,list,caption); cards.append(card);
  }
  for(let index=members.length;index<3;index++) {
    const empty=document.createElement('article'); empty.className='member-card empty-seat';
    empty.textContent='함께할 팀원을 기다리는 자리'; cards.append(empty);
  }
  content.append(cards);
  presentation.querySelector('.presentation-sync').textContent=`${remoteGroup.today} · 한국 시간 · 15초마다 갱신`;
}
async function api(path, method='GET', data) {
  const response = await fetch(`/api/groups${path}`, {method, headers:{'Content-Type':'application/json', Authorization:`Bearer ${sessionToken}`}, body:data ? JSON.stringify(data) : undefined});
  const result = await response.json().catch(() => ({error:'그룹 서버에 연결할 수 없어요. 서버 실행 상태를 확인해 주세요.'}));
  if (!response.ok) {
    if(response.status===401 && ['/me','/check','/character','/account'].includes(path)) {
      sessionToken=''; remoteGroup=null; sessionStorage.removeItem('seed-group-token');
      $('key-output').textContent=''; render(); remoteRender();
    }
    throw new Error(result.error || '요청을 처리하지 못했어요.');
  }
  return result;
}
function remoteRender() {
  const connected = !!remoteGroup;
  document.dispatchEvent(new Event('group-state'));
  presentationButton.hidden = remoteGroup?.role !== 'manager';
  if(presentation.open) renderPresentation();
  $('connect-form').hidden = connected;
  $('refresh-group').hidden = $('leave-session').hidden = $('key-notice').hidden = !connected;
  $('remote-content').replaceChildren();
  document.querySelector('.checks').hidden = connected;
  document.querySelector('.garden').hidden = connected;
  document.querySelector('.history:not(#group-panel)').hidden = connected;
  document.querySelector('.notice').textContent = connected ? '그룹 서버 연결됨 · 15초마다 현황을 갱신해요.' : '로컬 체험 버전 · 이 브라우저에만 저장됩니다.';
  $('solo').disabled = connected; $('settings').disabled = connected && remoteGroup.role!=='manager';
  if (!connected) return;
  $('group-name').textContent = remoteGroup.name;
  const manager = remoteGroup.role === 'manager';
  $('mode-note').textContent = manager ? '팀원을 초대하고 실천 현황을 살펴보세요. 함께 보기로 정원을 보여줄 수 있어요.' : '그룹에 참여했어요. 내용 입력 없이 오늘의 실천을 체크해 보세요.';
  $('group-status').textContent = manager ? '지도사 관리 화면 · 팀원 3명 기준 · 한국 시간' : '팀원 화면 · 체크는 서버에 저장됩니다 · 한국 시간';
  if(manager) {
    const invite = document.createElement('p'); invite.textContent = `팀원 초대 코드: ${remoteGroup.invite}`; invite.style.overflowWrap = 'anywhere'; $('remote-content').append(invite);
    const linkLabel=document.createElement('label'); linkLabel.textContent='팀원 초대 링크';
    const link=document.createElement('input'); link.readOnly=true; link.value=invitationUrl(remoteGroup.invite); linkLabel.append(link);
    const copy=document.createElement('button'); copy.textContent='초대 링크 복사';
    copy.onclick=async()=>{
      try {await navigator.clipboard.writeText(link.value);$('group-status').textContent='초대 링크를 복사했어요. 팀원에게 전달해 주세요.';}
      catch {link.focus();link.select();$('group-status').textContent='링크를 선택했어요. 직접 복사해 주세요.';}
    };
    $('remote-content').append(linkLabel,copy);
  }
  const members = remoteGroup.members.filter(m => m.role === 'member');
  const summary = document.createElement('p'); summary.textContent = `팀원 ${members.length}/3명 · 지도사 1명`; $('remote-content').append(summary);
  if(manager) $('remote-content').append(gardenScene(members,remoteGroup.today));
  for(const member of members) {
    if(!manager && member.id !== remoteGroup.me) continue;
    const card = document.createElement('article'); card.className='member-card';
    const title = document.createElement('h3'); title.textContent = member.name; card.append(title);
    const total = Object.values(member.days).reduce((sum,day) => sum + count(day), 0);
    const character = document.createElement('p'); character.className = 'member-growth';
    character.textContent = `${characters[member.character][0]} ${characters[member.character][1]} · 성장 ${Math.floor(total/15)+1}단계 · 누적 ${total}개 실천`;
    card.append(seedArt(member.character,total,count(member.days[remoteGroup.today])),character);
    const progress = document.createElement('progress'); progress.max=15; progress.value=total%15;
    progress.setAttribute('aria-label', `${member.name} 다음 성장까지 ${15-total%15}개 실천`); card.append(progress);
    if(!manager) {
      const label=document.createElement('label'); label.textContent=' 함께 자랄 친구 ';
      const select=document.createElement('select');
      characters.forEach(([emoji,name],i)=>select.add(new Option(`${emoji} ${name}`, i)));
      select.value=member.character;
      select.onchange=()=>changeRemote('/character',{character:Number(select.value)});
      label.append(select); card.append(label);
    }
    const day = member.days[remoteGroup.today] || {};
    for(const [item,label] of items) {
      const button = document.createElement('button'); button.textContent = `${day[item] ? '✓' : '○'} ${label}`;
      button.setAttribute('aria-pressed',String(day[item] === true)); button.disabled = manager;
      button.dataset.focusItem=item;
      button.addEventListener('click', () => changeRemote('/check',{item,value:!day[item]})); card.append(button);
    }
    {
      const history=document.createElement('p');
      history.textContent=Array.from({length:7},(_,i)=>{const d=new Date(`${remoteGroup.today}T12:00:00`);d.setDate(d.getDate()-6+i);return `${dayKey(d).slice(5)} ${count(member.days[dayKey(d)])}/3`;}).join(' · ');
      card.append(history);
    }
    $('remote-content').append(card);
  }
  if(manager && !members.length) { const p=document.createElement('p');p.textContent='아직 참여한 팀원이 없어요. 초대 코드를 전달해 주세요.';$('remote-content').append(p); }
}
async function refreshRemote() {
  const version=++refreshVersion, token=sessionToken;
  const result=await api('/me');
  if(version!==refreshVersion || token!==sessionToken) return;
  const changed=JSON.stringify(remoteGroup)!==JSON.stringify(result);
  remoteGroup=result;
  // Avoid replacing focused controls during unchanged background polls.
  if(changed) remoteRender();
  if(presentation.open) presentation.querySelector('.presentation-sync').textContent=`${result.today} · 한국 시간 · 방금 동기화했어요`;
  $('group-status').textContent=`${result.role==='manager'?'지도사 관리':'팀원'} 화면 · 한국 시간 · 방금 동기화했어요`;
}
async function changeRemote(path, data) {
  if(saving) return;
  saving=true; ++refreshVersion;
  const focusItem=document.activeElement?.dataset.focusItem;
  $('remote-content').querySelectorAll('button,select').forEach(control=>control.disabled=true);
  try {
    await api(path,'PUT',data); await refreshRemote();
    $('group-status').textContent='저장했어요. 오늘의 실천이 성장에 반영됐어요.';
  } catch(error) { $('group-status').textContent=`저장 상태를 확인하지 못했어요. ${error.message} 새로고침으로 확인해 주세요.`; }
  finally {
    saving=false;
    if(remoteGroup?.role==='member') $('remote-content').querySelectorAll('button,select').forEach(control=>control.disabled=false);
    if(focusItem) $('remote-content').querySelector(`[data-focus-item="${focusItem}"]`)?.focus();
  }
}
$('connect-form').addEventListener('submit', async event => {
  event.preventDefault(); const route=document.body.dataset.entryRoute;
  const action=route==='join'?'join':route==='create'?'create':(event.submitter?.value || 'create');
  const buttons=[...event.currentTarget.querySelectorAll('button')]; buttons.forEach(b=>b.disabled=true);
  try {
    const result=await api(action==='create'?'':'/join','POST',{member:$('member-name').value.trim(),name:$('new-group-name').value.trim(),invite:$('invite-code').value.trim()});
    sessionToken=result.token; sessionStorage.setItem('seed-group-token',sessionToken);
    if(action==='join') history.replaceState(null,'',location.pathname+location.search);
    await refreshRemote();
  } catch(error) { $('group-status').textContent=error.message; }
  finally {buttons.forEach(b=>b.disabled=false);}
});
$('restore-form').addEventListener('submit',async event=>{event.preventDefault();const previous=sessionToken;sessionToken=$('access-key').value.trim();try{await refreshRemote();sessionStorage.setItem('seed-group-token',sessionToken);$('access-key').value='';}catch(error){sessionToken=previous;$('group-status').textContent=error.message;}});
$('show-key').onclick=()=>{$('key-output').textContent=sessionToken || '접속한 그룹이 없어요.';};
$('refresh-group').onclick=()=>{if(!saving) refreshRemote().catch(error=>$('group-status').textContent=error.message);};
$('leave-session').onclick=()=>{sessionToken='';remoteGroup=null;sessionStorage.removeItem('seed-group-token');$('key-output').textContent='';$('group-status').textContent='접속을 종료했어요. 개인 키로 다시 접속할 수 있어요.';render();remoteRender();};
if(sessionToken) refreshRemote().catch(error=>$('group-status').textContent=error.message);
function backgroundRefresh() {
  if(!sessionToken || document.hidden || saving) return;
  refreshRemote().catch(()=>{
    const message='연결이 잠시 끊겼어요. 마지막 확인 기록을 표시하고 있어요.';
    $('group-status').textContent=message;
    if(presentation.open) presentation.querySelector('.presentation-sync').textContent=message;
  });
}
setInterval(backgroundRefresh,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(remoteGroup) remoteRender();backgroundRefresh();}});
