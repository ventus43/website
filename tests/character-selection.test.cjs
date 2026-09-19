const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['seedsbook-characters.js', 'character-random.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/scripts/data', file), 'utf8'), sandbox);
}
const characters = sandbox.window.SEEDSBOOK_CHARACTERS;
const { getRandomCharacter, shuffleCharacters, rouletteRotation } = sandbox.window.CharacterRandom;

test('9개 캐릭터의 ID가 고유하며 원본 이미지와 대사가 존재한다', () => {
  assert.equal(characters.length, 9);
  assert.equal(new Set(characters.map(character => character.id)).size, 9);
  for (const character of characters) {
    assert.ok(character.name && character.shortMessage);
    assert.ok(fs.existsSync(path.join(root, character.image)));
  }
});

test('난수 구간 9개가 각각 한 캐릭터에 대응하고 재추첨도 동일 결과를 허용한다', () => {
  for (let index = 0; index < 9; index++) {
    const random = () => (index + 0.5) / 9;
    assert.equal(getRandomCharacter(characters, random), characters[index]);
    assert.equal(getRandomCharacter(characters, random), characters[index]);
  }
  assert.equal(getRandomCharacter(characters, () => 0), characters[0]);
  assert.equal(getRandomCharacter(characters, () => 1 - Number.EPSILON), characters[8]);
});

test('섞기는 입력 배열을 바꾸지 않고 9장을 모두 유지한다', () => {
  const original = characters.map(character => character.id).join(',');
  const shuffled = shuffleCharacters(characters, () => 0);
  assert.notEqual(shuffled, characters);
  assert.equal(new Set(shuffled).size, 9);
  assert.ok(shuffled.every(character => characters.includes(character)));
  assert.notEqual(shuffled.map(character => character.id).join(','), original);
  assert.equal(characters.map(character => character.id).join(','), original);
});

test('모든 시작 각도와 결과에서 캐릭터 중앙이 상단 포인터에 일치한다', () => {
  for (const reduced of [false, true]) {
    for (const current of [0, 40, 320, 1800, 3760, 9760]) {
      for (let index = 0; index < 9; index++) {
        const rotation = rouletteRotation(current, index, 9, reduced);
        assert.equal((rotation + index * 40) % 360, 0);
        assert.ok(rotation >= current);
        assert.ok(reduced ? rotation - current < 360 : rotation - current >= 1800);
      }
    }
  }
});

test('최종 확인만 기존 선택 콜백을 한 번 호출하며 reduced motion에서는 지연하지 않는다', () => {
  const tasks = [];
  sandbox.window.matchMedia = () => ({ matches: true });
  sandbox.window.setTimeout = fn => { tasks.push(fn); return tasks.length; };
  sandbox.window.clearTimeout = () => {};
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/scripts/pages/character-select.js'), 'utf8'), sandbox);
  const selection = Object.create(sandbox.window.CharacterSelect.prototype);
  selection.timers = [];
  selection.root = { classList: { add() {}, remove() {} } };
  const received = [];
  selection.onSelect = character => received.push(character);
  const button = { disabled: false };
  selection.confirm(characters[3], button);
  selection.confirm(characters[7], button);
  assert.equal(button.disabled, true);
  assert.equal(received.length, 0);
  tasks.forEach(fn => fn());
  assert.equal(received.length, 1);
  assert.equal(received[0], characters[3]);
});
