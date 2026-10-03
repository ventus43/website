'use strict';
(() => {
  const home = document.getElementById('main');
  const team = document.getElementById('team');
  const homeTitle = document.title;
  const back = document.getElementById('view-back');
  let step = Number.isInteger(history.state?.ventusStep) ? history.state.ventusStep : 0;
  history.replaceState({...history.state, ventusStep: step}, '');
  function showView() {
    if (Number.isInteger(history.state?.ventusStep)) step = history.state.ventusStep;
    else history.replaceState({...history.state, ventusStep: ++step}, '');
    const intro = location.hash === '#team' || location.hash.startsWith('#team-');
    const changed = team.hidden === intro;
    home.hidden = intro;
    team.hidden = !intro;
    back.hidden = step === 0 && !intro;
    document.getElementById('home-return').hidden = !intro;
    document.querySelectorAll('[data-home-nav]').forEach(link => { link.hidden = intro; });
    const nav = document.getElementById('team-nav');
    if (intro) nav.setAttribute('aria-current', 'page');
    else nav.removeAttribute('aria-current');
    document.querySelector('.skip-link').href = intro ? '#team' : '#main';
    document.querySelector('.back-top').href = intro ? '#team' : '#top';
    document.title = intro ? '기획단 소개 — VENTUS' : homeTitle;
    requestAnimationFrame(() => {
      const target = document.getElementById(location.hash.slice(1));
      if (location.hash === '#team') window.scrollTo({top: 0, behavior: 'instant'});
      else if (target) target.scrollIntoView({behavior: 'instant', block: 'start'});
      else if (!location.hash) window.scrollTo({top: 0, behavior: 'instant'});
      if (changed && intro) document.getElementById('team-title').focus({preventScroll: true});
      else if (changed) document.getElementById('team-nav').focus({preventScroll: true});
    });
  }
  back.addEventListener('click', () => {
    if (step > 0) history.back();
    else location.hash = '#top';
  });
  window.addEventListener('hashchange', showView);
  showView();
})();
