const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/app.js`, 'utf8');
// Actual app helpers: check counts must be independent of content and reject truthy non-booleans.
const helpers = source.slice(source.indexOf('function dayKey'), source.indexOf('let state'));
const context = vm.createContext({items:[['read'],['gratitude'],['reflection']]});
vm.runInContext(helpers, context);
assert.equal(vm.runInContext('count({read:true,gratitude:true,reflection:true})', context),3);
assert.equal(vm.runInContext('count({gratitude:true})', context),1);
assert.equal(vm.runInContext('count({read:false,gratitude:"yes"})', context),0);
assert.equal(vm.runInContext('count(null)', context),0);
assert.equal(vm.runInContext('dayKey(new Date(2026,0,2))', context),'2026-01-02');
console.log('PASS: independent checks, strict boolean counts, empty day, local date');
