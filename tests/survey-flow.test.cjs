const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('survey preserves answer payload, renders text safely, prevents duplicate submissions and resets', () => {
  const elements = new Map();
  function element() {
    const classes = new Set();
    return {
      value: '', checked: false, style: {}, children: [], attributes: {},
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, force = !classes.has(value)) { force ? classes.add(value) : classes.delete(value); return force; }
      },
      setAttribute(key, value) { this.attributes[key] = String(value); },
      removeAttribute(key) { delete this.attributes[key]; },
      replaceChildren(...children) { this.children = children; },
      append(...children) { this.children.push(...children); },
      focus() {}, close() { this.open = false; }, showModal() { this.open = true; },
      reportValidity() { return true; }
    };
  }
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const cards = [element(), element()];
  const steps = Array.from({length: 4}, element);
  const indicators = Array.from({length: 3}, element);
  const requests = [];
  const context = vm.createContext({
    document: {
      getElementById: get, createElement: element, addEventListener() {},
      querySelector: () => element(),
      querySelectorAll: selector => selector === '.step' ? steps : selector === '.step-list li' ? indicators : selector === '.category-card' ? cards : []
    },
    window: {matchMedia: () => ({matches: true}), scrollTo() {}},
    fetch: (url, options) => { requests.push({url, body: JSON.parse(options.body)}); return Promise.resolve({ok: true}); },
    console, alert() {}, setTimeout, Date
  });
  vm.runInContext(fs.readFileSync(require.resolve('../assets/scripts/pages/survey.js'), 'utf8'), context);
  context.toggleCheck(cards[0], 'q2', '전시회/팝업');
  context.toggleCheck(cards[1], 'q3', '영화');
  assert.equal(cards[1].attributes['aria-pressed'], 'true');
  const values = {'q6-name': '<img src=x onerror=alert(1)>', 'q7-age': '25', 'q8-tel': '010-0000-0000', 'q9-mbti': 'infp', 'q5-date': '2026-10-01', 'q5-time': '14:00'};
  for (const [id, value] of Object.entries(values)) get(id).value = value;
  context.openPrivacyModal();
  assert.equal(get('privacyModal').open, true);
  context.confirmAndSubmit();
  assert.equal(requests.length, 0, 'consent is required');
  get('privacyConsent').checked = true;
  context.confirmAndSubmit();
  context.confirmAndSubmit();
  assert.equal(requests.length, 2, 'one request per existing destination');
  assert.equal(requests[1].url, '/api/survey');
  assert.equal(requests[1].body.참여한문화행사, '전시회/팝업');
  assert.equal(requests[1].body.참여하고싶은문화행사, '영화');
  assert.equal(requests[1].body.MBTI, 'INFP');
  assert.equal(get('summaryBlock').children[3].children[1].textContent, values['q6-name']);
  assert.equal(get('interestTags').children[0].textContent, '영화');
  assert.equal(steps[3].classList.contains('active'), true);
  context.resetSurvey();
  assert.equal(get('q6-name').value, '');
  assert.equal(get('summaryBlock').children.length, 0);
  assert.equal(cards[0].attributes['aria-pressed'], 'false');
  assert.equal(steps[0].classList.contains('active'), true);
});
