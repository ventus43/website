'use strict';
const entryNav=document.createElement('nav'); entryNav.className='entry-nav'; entryNav.setAttribute('aria-label','씨앗책방 시작 방법');
const entryRoutes=[['login','개인 로그인'],['create','관리자 그룹 만들기'],['join','개인 초대 참여'],['solo','혼자 맛보기']];
let entryRoute=invitation?'join':'login';
let entryWasConnected=!!remoteGroup;
for(const [route,label] of entryRoutes){
  const button=document.createElement('button');button.textContent=label;button.dataset.route=route;
  button.onclick=()=>{entryRoute=route;entryRender();};entryNav.append(button);
}
document.querySelector('main').prepend(entryNav);
function entryRender(){
  const connected=!!remoteGroup;
  if(!connected && entryRoute==='create') entryRoute='login';
  if(entryWasConnected&&!connected)entryRoute='login';
  entryWasConnected=connected;
  const solo=!connected&&entryRoute==='solo';
  document.body.dataset.entryRoute=entryRoute;
  entryNav.hidden=connected;
  for(const button of entryNav.querySelectorAll('button')) {
    button.hidden=button.dataset.route==='create' && (!connected || remoteGroup.role!=='manager');
    button.setAttribute('aria-pressed',String(button.dataset.route===entryRoute));
  }
  groupPanel.hidden=!connected&&!['create','join'].includes(entryRoute);
  accountPanel.hidden=!connected&&entryRoute!=='login';
  document.querySelector('aside').hidden=!connected&&!solo;
  document.querySelector('.garden').hidden=!solo;
  document.querySelector('.checks').hidden=!solo;
  document.querySelector('.history:not(#group-panel)').hidden=!solo;
  $('settings').hidden=!solo&&remoteGroup?.role!=='manager';
  document.querySelector('.mode').hidden=true;
  if(solo){state.solo=true;$('group-name').textContent='나만의 작은 정원';$('mode-note').textContent='맛보기 기록은 이 브라우저에만 저장돼요.';}
  if(!connected){
    groupPanel.querySelector('h2').textContent=entryRoute==='create'?'관리자로 새 그룹 만들기':'초대받은 그룹에 참여하기';
    $('new-group-name').closest('label').hidden=entryRoute!=='create';
    $('new-group-name').required=entryRoute==='create';
    $('invite-code').closest('label').hidden=entryRoute!=='join';
    $('invite-code').required=entryRoute==='join';
    for(const action of ['create','join']){
      const button=$('connect-form').querySelector(`[value="${action}"]`);
      button.hidden=entryRoute!==action;button.disabled=entryRoute!==action;
    }
    accountPanel.querySelector('#account-title').textContent='개인 로그인';
  }else{
    groupPanel.querySelector('h2').textContent=remoteGroup.role==='manager'?'관리자 · 그룹 관리':'오늘의 실천';
    accountPanel.querySelector('#account-title').textContent=remoteGroup.role==='manager'?'관리자 계정 및 그룹 관리':'개인 계정';
  }
  // Legacy access keys remain a sign-in option, next to account login.
  const legacy=$('restore-form').closest('details');
  if(!connected&&entryRoute==='login')accountPanel.append(legacy);
  else groupPanel.append(legacy);
}
document.addEventListener('group-state',()=>queueMicrotask(entryRender));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueMicrotask(entryRender);});
entryRender();
