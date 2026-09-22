const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{querySelector:key=>node(id+key)});return nodes.get(id);};
const select={value:'',options:[],replaceChildren(){this.options=[];this.value='';},add(option){this.options.push(option);if(!this.value)this.value=option.value;}};
node('manage-form').elements={member:select};
const context=vm.createContext({$:node,remoteGroup:null,secretDialog:{open:false},Option:function(name,value){this.value=value;}});
const source=fs.readFileSync(`${__dirname}/account.js`,'utf8');
vm.runInContext(source.slice(source.indexOf('function accountRender()'),source.indexOf("document.addEventListener('group-state'")),context);
for(const size of [0,3,0]){
  context.remoteGroup={role:'manager',members:Array.from({length:size},(_,id)=>({role:'member',id:String(id),name:`팀원 ${id}`}))};
  vm.runInContext('accountRender()',context);
  assert.equal(node('manage-form').hidden,false);
  assert.equal(select.disabled,size===0);
  assert.equal(node('member-manage-note').hidden,size>0);
  for(const action of ['reset','remove'])assert.equal(node(`manage-form[value="${action}"]`).disabled,size===0);
}
context.remoteGroup={role:'member',members:[]};vm.runInContext('accountRender()',context);
assert.equal(node('manage-form').hidden,true);
console.log('PASS: zero/three/zero members disable and restore management actions; member cannot see manager form');
