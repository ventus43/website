const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(`${__dirname}/garden.js`,'utf8');
const context=vm.createContext({document:{createElement:()=>({setAttribute(key,value){this[key]=value;},className:'',innerHTML:''})}});
vm.runInContext(source,context);
for(const [total,stage] of [[-1,0],[0,0],[14,0],[15,1],[29,1],[30,2],[44,2],[45,3],[150,3]])assert.equal(vm.runInContext(`seedStage(${total})`,context),stage);
const variants=new Set();for(let id=0;id<9;id++)variants.add(vm.runInContext(`seedArt(${id},45,3).innerHTML`,context));
assert.equal(variants.size,9);
assert.equal(vm.runInContext('seedArt(99,0).innerHTML',context),vm.runInContext('seedArt(0,0).innerHTML',context));
for(let done=0;done<=3;done++){
  const label=vm.runInContext(`seedArt(0,0,${done})['aria-label']`,context);
  assert.ok(label.includes(`오늘 ${done}/3 실천`));
  assert.equal(label.includes('세 가지 모두 완료'),done===3);
}
console.log('PASS: growth boundaries, nine characters, fallback, partial/full completion labels');
