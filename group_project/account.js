'use strict';
const accountPanel=document.createElement('section');
accountPanel.className='history'; accountPanel.style.gridColumn='1 / -1';
accountPanel.innerHTML=`<h2>계정과 그룹 관리</h2>
<p id="account-info"></p>
<form id="account-form">
<label>아이디 <input name="username" pattern="[a-z0-9_]{4,32}" minlength="4" maxlength="32" autocomplete="username" required></label>
<label>비밀번호 / 복구 시 새 비밀번호 <input name="password" type="password" minlength="10" maxlength="128" autocomplete="off" required></label>
<label id="recovery-label">복구 코드 (복구할 때만) <input name="recovery" autocomplete="off" maxlength="128"></label>
<button value="login">로그인</button> <button value="recover">비밀번호 복구</button> <button value="account">현재 구성원 계정 등록</button>
</form>
<form id="manage-form" hidden>
<label>새 그룹 이름 <input name="name" maxlength="40"></label><button value="rename">그룹 이름 변경</button>
<button value="invite">초대 코드 재발급</button>
<label>관리할 팀원 <select name="member" aria-label="관리할 팀원"></select></label>
<button value="reset">팀원 복구 코드 발급</button> <button value="remove">팀원 탈퇴 처리</button>
<p id="member-manage-note" hidden>팀원 참여 후 복구 코드 발급과 탈퇴 처리를 사용할 수 있어요.</p>
<p>탈퇴 시 접속을 차단하고 자리를 비워요. 기존 기록은 서버에 보관하지만 현황에서는 제외돼요.</p>
</form><p id="account-status" role="status"></p>`;
document.querySelector('main').append(accountPanel);
const secretDialog=document.createElement('dialog');
secretDialog.innerHTML='<h2>복구 코드 보관</h2><p>이 코드는 지금 한 번만 표시돼요. 비밀번호처럼 안전한 곳에 보관해 주세요. 복구하면 기존 코드는 만료됩니다.</p><output style="overflow-wrap:anywhere"></output><form method="dialog"><button>보관했어요</button></form>';
document.body.append(secretDialog);
secretDialog.addEventListener('close',()=>{secretDialog.querySelector('output').textContent='';});
function showRecovery(result) {
  if(!result.recovery) return;
  secretDialog.querySelector('output').textContent=`${result.username ? result.username+' · ' : ''}${result.recovery}`;
  secretDialog.showModal();
}
function accountRender() {
  const connected=!!remoteGroup;
  $('account-info').textContent=remoteGroup?.username ? `등록된 아이디: ${remoteGroup.username} · 새로 로그인하면 이전 기기의 접속은 종료돼요.` : connected ? '아이디를 등록하면 접속 키를 잃어도 로그인할 수 있어요.' : '등록한 아이디로 로그인하거나 복구 코드로 새 비밀번호를 설정하세요.';
  $('account-form').hidden=!!remoteGroup?.username;
  $('account-form').querySelector('[value="account"]').hidden=!connected;
  for(const action of ['login','recover']) $('account-form').querySelector(`[value="${action}"]`).hidden=connected;
  $('recovery-label').hidden=connected;
  $('manage-form').hidden=remoteGroup?.role!=='manager';
  const select=$('manage-form').elements.member;
  const selected=select.value; select.replaceChildren();
  for(const member of remoteGroup?.members || []) if(member.role==='member') select.add(new Option(member.name,member.id));
  if([...select.options].some(option=>option.value===selected)) select.value=selected;
  select.disabled=!select.options.length;
  $('member-manage-note').hidden=!!select.options.length;
  for(const action of ['reset','remove']) $('manage-form').querySelector(`[value="${action}"]`).disabled=!select.options.length;
  if(!connected) { if(secretDialog.open) secretDialog.close(); }
}
document.addEventListener('group-state',accountRender);
accountRender();
async function submitAccount(event) {
  event.preventDefault();
  const form=event.currentTarget, action=remoteGroup ? 'account' : (event.submitter?.value || 'login');
  const data=Object.fromEntries(new FormData(form));
  const buttons=[...form.querySelectorAll('button')]; buttons.forEach(button=>button.disabled=true);
  try {
    const result=await api('/'+action,'POST',data);
    if(result.token) {sessionToken=result.token; sessionStorage.setItem('seed-group-token',sessionToken);}
    form.reset(); showRecovery(result); await refreshRemote();
    $('account-status').textContent=action==='account'?'계정을 등록했어요. 복구 코드를 보관하세요.':'접속했어요.';
  } catch(error) {$('account-status').textContent=error.message;}
  finally {buttons.forEach(button=>button.disabled=false);}
}
$('account-form').addEventListener('submit',submitAccount);
$('manage-form').addEventListener('submit',async event=>{
  event.preventDefault(); const form=event.currentTarget, action=event.submitter?.value;
  if(['reset','remove'].includes(action)&&!form.elements.member.value) return;
  const messages={remove:'선택한 팀원의 접속을 차단하고 그룹에서 제외할까요?',reset:'팀원의 기존 비밀번호와 접속 키를 무효화하고 새 복구 코드를 발급할까요?',invite:'기존 초대 링크를 무효화하고 새로 발급할까요?'};
  if(messages[action] && !confirm(messages[action])) return;
  const data={...Object.fromEntries(new FormData(form)),action};
  const buttons=[...form.querySelectorAll('button')]; buttons.forEach(button=>button.disabled=true);
  try {const result=await api('/manage','POST',data);showRecovery(result);await refreshRemote();$('account-status').textContent='그룹 관리 변경을 반영했어요.';}
  catch(error){$('account-status').textContent=error.message;}
  finally{buttons.forEach(button=>button.disabled=false);accountRender();}
});
