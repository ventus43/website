'use strict';
function count(day){return Object.values(day||{}).filter(value=>value===true).length;}
function preview(){
  const total=Number(document.getElementById('preview-stage').value), active=document.getElementById('preview-active').checked;
  const cards=document.getElementById('preview-cards');cards.replaceChildren();
  seedNames.forEach((name,index)=>{const card=document.createElement('article');card.className='member-card';const title=document.createElement('h2');title.textContent=name;card.append(title,seedArt(index,total,active?1:0));cards.append(card);});
  const days={};for(let i=0;i<total;i++)days['past'+i]={read:true};if(active)days.today={read:true};
  document.getElementById('preview-scene').replaceChildren(gardenScene([0,2,4].map((character,index)=>({name:['팀원 하나','팀원 둘','팀원 셋'][index],character,days})), 'today'));
}
document.getElementById('preview-stage').onchange=preview;document.getElementById('preview-active').onchange=preview;preview();
