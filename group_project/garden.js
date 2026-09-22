'use strict';
const seedPalette = ['#99bc60','#5eae84','#e99cad','#719d5d','#9b87bc','#edbe58','#7abcc5','#b79975','#ec9b60'];
const seedNames = ['새싹이','잎싹이','꽃봉이','나무','부엉씨앗','햇살씨앗','이슬이','뿌리','열매'];
function seedStage(total) { return Math.min(3, Math.floor(Math.max(0, Number(total)||0)/15)); }
function seedArt(choice, total, done = 0) {
  const active=done>0;
  const id = Number.isInteger(choice) && choice>=0 && choice<9 ? choice : 0;
  const stage=seedStage(total), color=seedPalette[id];
  const figure=document.createElement('figure'); figure.className=`seed-art stage-${stage}${active?' is-active':''}`;
  figure.setAttribute('role','img');
  figure.setAttribute('aria-label',`${seedNames[id]} · ${['씨앗','새싹','풍성한 잎','활짝 자란 친구'][stage]} · 오늘 ${done}/3 실천${done===3?' · 세 가지 모두 완료':''}`);
  const leaf='<path d="M99 74Q60 80 58 50Q90 44 99 74Z" fill="#66985a"/><path d="M101 65Q106 32 135 39Q139 63 101 65Z" fill="#9abb65"/>';
  const crowns=[leaf,
    leaf+'<path d="M101 64Q77 36 94 18Q119 30 101 64Z" fill="#7bad73"/>',
    '<g fill="#e99cad"><ellipse cx="100" cy="42" rx="16" ry="25"/><ellipse cx="81" cy="49" rx="16" ry="23" transform="rotate(-38 81 49)"/><ellipse cx="119" cy="49" rx="16" ry="23" transform="rotate(38 119 49)"/></g><circle cx="100" cy="55" r="12" fill="#f7da87"/>',
    '<path d="M100 72V30" stroke="#897356" stroke-width="9"/><g fill="#739c5b"><circle cx="76" cy="49" r="22"/><circle cx="123" cy="48" r="23"/><circle cx="100" cy="29" r="25"/></g>',
    '<path d="M58 106L60 50L88 79M142 106L140 50L112 79" fill="#9b87bc" stroke="#786b98" stroke-width="3"/>',
    '<g stroke="#e7b951" stroke-width="6" stroke-linecap="round"><path d="M100 27V14M70 37L61 27M130 37L139 27M60 61H47M140 61H153"/></g><circle cx="100" cy="58" r="24" fill="#f2cf69"/>',
    '<path d="M100 17Q60 57 80 69Q110 87 122 61Q129 44 100 17Z" fill="#7abcc5"/><path d="M88 49Q83 58 91 62" stroke="#e5fbf8" stroke-width="5" fill="none" stroke-linecap="round"/>',
    leaf+'<path d="M100 154V183M100 163L84 176M101 165L119 179" stroke="#ae8a65" stroke-width="5" fill="none" stroke-linecap="round"/>',
    leaf+'<circle cx="133" cy="66" r="17" fill="#ef9c58"/><path d="M132 47Q144 29 156 38Q151 53 132 47Z" fill="#729953"/>'
  ];
  const ornaments=stage>=2 ? '<path d="M56 128Q27 119 37 96Q64 98 66 118M142 125Q171 118 165 98Q141 97 135 115" fill="#84ab68"/>' : '';
  const book=stage>=3 ? '<path d="M69 151Q86 143 100 152Q115 142 131 151V171Q113 164 100 174Q84 164 69 171Z" fill="#fff6d9" stroke="#b29363" stroke-width="3"/><path d="M100 153V173" stroke="#b29363" stroke-width="2"/>' : '';
  figure.innerHTML=`<svg viewBox="0 0 200 210" aria-hidden="true" focusable="false"><ellipse cx="100" cy="189" rx="57" ry="9" fill="#46673c" opacity=".12"/><g class="seed-body"><g opacity="${stage===0?'.6':'1'}" transform="translate(${stage===0?20:0} ${stage===0?36:0}) scale(${stage===0?'.8':'1'})">${crowns[id]}${ornaments}<path d="M100 65C137 65 153 98 148 132C145 159 126 172 100 172C72 172 53 156 52 130C49 101 64 66 100 65Z" fill="${color}" stroke="#426243" stroke-opacity=".22" stroke-width="2"/><ellipse cx="79" cy="100" rx="12" ry="18" fill="white" opacity=".16"/>${id===4?'<circle cx="81" cy="114" r="17" fill="#f6ecd8"/><circle cx="119" cy="114" r="17" fill="#f6ecd8"/>':''}<g fill="#354637"><ellipse cx="82" cy="116" rx="4" ry="6"/><ellipse cx="118" cy="116" rx="4" ry="6"/></g><ellipse cx="69" cy="129" rx="8" ry="4" fill="#e78b86" opacity=".65"/><ellipse cx="131" cy="129" rx="8" ry="4" fill="#e78b86" opacity=".65"/><path d="M94 131Q100 ${active?'143':'138'} 107 131" stroke="#354637" stroke-width="3" fill="none" stroke-linecap="round"/>${book}</g>${active?'<g fill="#e4b45a"><path d="M159 44l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><circle cx="39" cy="77" r="3"/></g>':''}</g></svg>`;
  return figure;
}
function gardenScene(members,today) {
  const scene=document.createElement('div'); scene.className='seed-scene';
  scene.setAttribute('aria-label','팀원 세 자리의 그룹 정원');
  for(let i=0;i<3;i++) {
    const plot=document.createElement('div'); plot.className='seed-plot';
    const member=members[i];
    if(member) {
      const total=Object.values(member.days).reduce((sum,day)=>sum+count(day),0);
      plot.append(seedArt(member.character,total,count(member.days[today])));
      const label=document.createElement('span'); label.className='plot-label'; label.textContent=member.name; plot.append(label);
    } else {
      const empty=document.createElement('div'); empty.className='empty-plot'; empty.textContent='＋';empty.setAttribute('aria-hidden','true');
      const label=document.createElement('span'); label.className='plot-label'; label.textContent='기다리는 자리';plot.append(empty,label);
    }
    scene.append(plot);
  }
  return scene;
}
