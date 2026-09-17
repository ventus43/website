function showResultPage() {
  $('resultCharImg').src = selectedChar.image;
  $('resultSub').textContent = `${selectedChar.name} 캐릭터로 참여해주셨습니다`;
  const cats = [...data.categories];
  const card = ([label, value]) =>
    `<div class="res-card"><div class="res-label">${label}</div><div class="res-value">${value || '미입력'}</div></div>`;
  const grid = [
    ['책 선호도',     data.preference],
    ['선호 카테고리', cats.length ? cats.join(', ') : ''],
    ['추후 참여 횟수', data.participation],
    ['이름',          $('userName').value],
    ['나이',          `${$('userAge').value}세`],
    ['MBTI',          $('userMbti').value],
  ];
  $('resultList').innerHTML =
    card(['책에 대한 인식', data.bookThought]) +
    card(['책을 접한 계기', data.bookTrigger]) +
    `<div class="res-grid">${grid.map(card).join('')}</div>` +
    card(['취미/해보고 싶은 활동', $('hobby').value]) +
    `<div class="res-card res-card-consent"><div class="res-label">개인정보 수집·이용 동의</div><div class="res-value res-value-consent"><i class="fa-solid fa-shield-halved"></i> 동의함</div></div>`;

  // 이름이 있을 때만 스프레드시트 전송
  if ($('userName').value.trim()) {
    sendToSheet({
      type:          'survey',
      timestamp:     new Date().toLocaleString('ko-KR'),
      character:     selectedChar.name,
      name:          $('userName').value,
      age:           $('userAge').value,
      mbti:          $('userMbti').value,
      preference:    data.preference,
      bookThought:   data.bookThought,
      bookTrigger:   data.bookTrigger,
      categories:    [...data.categories].join(', '),
      hobby:         $('hobby').value,
      participation: data.participation,
      etc:           $('q6etc').value,
      privacyConsent: '동의함'
    });
  }

  hidePage('pageSurvey'); showPage('pageResult');
  requestAnimationFrame(() => {
    const wrap = $('pageResult').querySelector('.result-wrap');
    wrap.style.transform = 'scale(1)';
    const pageH = $('pageResult').clientHeight - 32;
    const wrapH = wrap.scrollHeight;
    if (wrapH > pageH) wrap.style.transform = `scale(${pageH / wrapH})`;
  });
}
