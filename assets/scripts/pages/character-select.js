(function () {
  'use strict';

  const VARIANTS = [
    { id: 'slider', label: 'Slider' },
    { id: 'deck', label: 'Deck' },
    { id: 'roulette', label: 'Roulette' }
  ];

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { getRandomCharacter, shuffleCharacters, rouletteRotation } = window.CharacterRandom;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function characterImage(character, className) {
    return `<img class="${className}" src="${character.image}" alt="${character.name}" width="256" height="256" loading="lazy" decoding="async">`;
  }

  class CharacterSelect {
    constructor({ root, characters, onSelect, initialVariant = 'slider' }) {
      this.root = root;
      this.characters = characters;
      this.onSelect = onSelect;
      this.variant = VARIANTS.some(item => item.id === initialVariant) ? initialVariant : 'slider';
      this.timers = [];
      this.render();
    }

    later(fn, delay) {
      const timer = window.setTimeout(fn, delay);
      this.timers.push(timer);
      return timer;
    }

    clearTimers() {
      this.timers.forEach(window.clearTimeout);
      this.timers = [];
    }

    reset() {
      this.clearTimers();
      this.render();
    }

    setVariant(variant) {
      if (variant === this.variant) return;
      this.variant = variant;
      this.clearTimers();
      const url = new URL(window.location.href);
      url.searchParams.set('characterVariant', variant);
      window.history.replaceState({}, '', url);
      this.render();
      this.root.querySelector('[data-variant-toggle]').focus();
    }

    render() {
      this.clearTimers();
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.confirmed = false;
      this.root.classList.remove('is-confirming');
      this.root.innerHTML = `
        <button type="button" class="variant-toggle" data-variant-toggle aria-haspopup="dialog" aria-expanded="false" aria-controls="variantMenu">☰</button>
        <dialog id="variantMenu" class="variant-switcher" aria-label="캐릭터 선택 화면 변경">
            <button type="button" class="variant-close" data-variant-close aria-label="화면 선택 닫기">×</button>
            ${VARIANTS.map(item => `
              <button type="button" data-variant="${item.id}" aria-pressed="${item.id === this.variant}">
                ${item.label}
              </button>`).join('')}
        </dialog>
        <div class="character-select__frame">
          <div class="character-select__prototype" data-prototype="${this.variant}"></div>
        </div>`;

      const menu = this.root.querySelector('#variantMenu');
      const toggle = this.root.querySelector('[data-variant-toggle]');
      toggle.addEventListener('click', () => {
        menu.showModal();
        toggle.setAttribute('aria-expanded', 'true');
      });
      this.root.querySelector('[data-variant-close]').addEventListener('click', () => menu.close());
      menu.addEventListener('close', () => {
        toggle.setAttribute('aria-expanded', 'false');
        if (toggle.isConnected) toggle.focus();
      });
      this.root.querySelectorAll('[data-variant]').forEach(button => {
        button.addEventListener('click', () => {
          menu.close();
          this.setVariant(button.dataset.variant);
        });
      });

      const mount = this.root.querySelector('.character-select__prototype');
      if (this.variant === 'deck') this.renderDeck(mount);
      else if (this.variant === 'roulette') this.renderRoulette(mount);
      else this.renderSlider(mount);
      // transform으로 조정한 실제 높이만 확보해 하단에 빈 레이아웃 공간이 남지 않게 한다.
      const frame = this.root.querySelector('.character-select__frame');
      const updateHeight = () => { frame.style.height = `${mount.offsetHeight * 0.92}px`; };
      this.resizeObserver = new ResizeObserver(updateHeight);
      this.resizeObserver.observe(mount);
      updateHeight();
    }

    confirm(character, trigger) {
      if (this.confirmed) return;
      this.confirmed = true;
      this.clearTimers();
      if (trigger) trigger.disabled = true;
      this.root.classList.add('is-confirming');
      this.later(() => {
        this.root.classList.remove('is-confirming');
        this.onSelect(character);
      }, prefersReducedMotion() ? 0 : 180);
    }

    renderSlider(mount) {
      let index = 0;
      let busy = false;
      let pointerStart = null;

      mount.innerHTML = `
        <section class="select-panel slider-select" aria-labelledby="sliderTitle">
          <header class="select-heading">
            <span class="select-kicker">A · SLIDE &amp; RANDOM</span>
            <h1 id="sliderTitle">어떤 친구를<br>만나볼까요?</h1>
          </header>
          <div class="slider-stage" tabindex="0" aria-label="캐릭터 슬라이더. 좌우 방향키로 이동할 수 있습니다.">
            <div class="slider-peek slider-peek--prev" aria-hidden="true"></div>
            <div class="slider-focus">
              <div class="slider-orbit" aria-hidden="true"></div>
              <img class="slider-character" src="" alt="" width="256" height="256">
              <span class="slider-reaction" aria-hidden="true">!</span>
            </div>
            <div class="slider-peek slider-peek--next" aria-hidden="true"></div>
          </div>
          <div class="slider-copy" role="status" aria-live="polite">
            <strong class="slider-name"></strong>
            <p class="slider-message"></p>
          </div>
          <div class="slider-nav">
            <button type="button" class="round-button" data-slider-prev aria-label="이전 캐릭터">←</button>
            <span class="slider-count" aria-label="현재 캐릭터 순서"></span>
            <button type="button" class="round-button" data-slider-next aria-label="다음 캐릭터">→</button>
          </div>
          <div class="select-actions">
            <button type="button" class="select-primary" data-slider-confirm>이 친구 선택</button>
            <button type="button" class="select-secondary" data-slider-random><span aria-hidden="true">✦</span> 아무나 골라줘</button>
            <button type="button" class="text-button" data-slider-all>전체보기</button>
          </div>
          <dialog class="all-characters" aria-label="친구들 한눈에 보기">
            <div class="all-characters__header"><strong>친구들 한눈에 보기</strong><button type="button" data-slider-close aria-label="전체보기 닫기">×</button></div>
            <div class="all-characters__grid"></div>
          </dialog>
        </section>`;

      const stage = mount.querySelector('.slider-stage');
      const panel = mount.querySelector('.slider-select');
      const image = mount.querySelector('.slider-character');
      const name = mount.querySelector('.slider-name');
      const message = mount.querySelector('.slider-message');
      const count = mount.querySelector('.slider-count');
      const reaction = mount.querySelector('.slider-reaction');
      const randomButton = mount.querySelector('[data-slider-random]');
      const confirmButton = mount.querySelector('[data-slider-confirm]');
      const allPanel = mount.querySelector('.all-characters');
      const allGrid = mount.querySelector('.all-characters__grid');

      const update = (direction = 1, announce = false) => {
        const current = this.characters[index];
        const prev = this.characters[(index - 1 + this.characters.length) % this.characters.length];
        const next = this.characters[(index + 1) % this.characters.length];
        image.src = current.image;
        image.alt = `${current.name} 캐릭터`;
        name.textContent = current.name;
        message.textContent = `“${current.shortMessage}”`;
        count.textContent = `${pad(index + 1)} / ${pad(this.characters.length)}`;
        mount.querySelector('.slider-peek--prev').style.backgroundImage = `url("${prev.image}")`;
        mount.querySelector('.slider-peek--next').style.backgroundImage = `url("${next.image}")`;
        stage.dataset.direction = direction > 0 ? 'next' : 'prev';
        stage.classList.remove('is-changing');
        void stage.offsetWidth;
        stage.classList.add('is-changing');
        stage.setAttribute('aria-label', `${current.name}. ${current.shortMessage}. 좌우 방향키로 이동할 수 있습니다.`);
        if (announce) name.textContent = `처음 만난 친구 · ${current.name}`;
      };

      const move = direction => {
        if (busy) return;
        panel.classList.remove('has-random-result');
        randomButton.textContent = '✦ 아무나 골라줘';
        index = (index + direction + this.characters.length) % this.characters.length;
        update(direction);
      };

      const runRandom = () => {
        if (busy) return;
        busy = true;
        mount.querySelectorAll('button').forEach(button => { button.disabled = true; });
        mount.querySelector('.slider-copy').setAttribute('aria-live', 'off');
        panel.classList.add('is-busy');
        panel.classList.remove('has-random-result');
        const steps = prefersReducedMotion() ? 1 : 5;
        const target = this.characters.indexOf(getRandomCharacter(this.characters));

        const tick = step => {
          index = step === steps - 1 ? target : (index + 1) % this.characters.length;
          update(1);
          if (step < steps - 1) {
            this.later(() => tick(step + 1), prefersReducedMotion() ? 30 : 75 + step * 28);
          } else {
            busy = false;
            mount.querySelectorAll('button').forEach(button => { button.disabled = false; });
            mount.querySelector('.slider-copy').setAttribute('aria-live', 'polite');
            randomButton.textContent = '다시 뽑기';
            panel.classList.remove('is-busy');
            panel.classList.add('has-random-result');
            reaction.textContent = '♥';
            update(1, true);
          }
        };
        tick(0);
      };

      allGrid.innerHTML = this.characters.map((character, characterIndex) => `
        <button type="button" data-character-index="${characterIndex}" aria-label="${character.name} 보기">
          ${characterImage(character, '')}<span>${character.name}</span>
        </button>`).join('');

      mount.querySelector('[data-slider-prev]').addEventListener('click', () => move(-1));
      mount.querySelector('[data-slider-next]').addEventListener('click', () => move(1));
      randomButton.addEventListener('click', runRandom);
      confirmButton.addEventListener('click', () => { if (!busy) this.confirm(this.characters[index], confirmButton); });
      mount.querySelector('[data-slider-all]').addEventListener('click', () => { if (!busy) allPanel.showModal(); });
      mount.querySelector('[data-slider-close]').addEventListener('click', () => allPanel.close());
      allGrid.addEventListener('click', event => {
        const button = event.target.closest('[data-character-index]');
        if (!button || busy) return;
        index = Number(button.dataset.characterIndex);
        randomButton.textContent = '✦ 아무나 골라줘';
        panel.classList.remove('has-random-result');
        allPanel.close();
        update(1);
        stage.focus();
      });
      stage.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      });
      stage.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0 || busy) return;
        // 화면 가장자리의 브라우저 뒤로가기 제스처를 가로채지 않는다.
        if (event.clientX < 24 || event.clientX > window.innerWidth - 24) return;
        pointerStart = { x: event.clientX, y: event.clientY };
        stage.setPointerCapture(event.pointerId);
      });
      stage.addEventListener('pointerup', event => {
        if (!pointerStart) return;
        const dx = event.clientX - pointerStart.x;
        const dy = event.clientY - pointerStart.y;
        pointerStart = null;
        if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3) move(dx > 0 ? -1 : 1);
      });
      stage.addEventListener('pointercancel', () => { pointerStart = null; });

      update();
    }

    renderDeck(mount) {
      let order = this.characters.map((_, index) => index);
      let busy = false;
      let revealed = null;
      let deckEntered = false;

      mount.innerHTML = `
        <section class="select-panel deck-select" aria-label="카드 덱으로 친구 고르기">
          <div class="deck-warmup">
            <header class="select-heading">
              <span class="select-kicker">D · CHARACTER DECK</span>
              <h1 id="deckTitle">책을 고를 때<br>나는…</h1>
            </header>
            <p class="deck-warmup__hint">마음이 가는 쪽을 하나 골라보세요.</p>
            <div class="deck-taste-options" role="group" aria-label="책을 고르는 방식">
              <button type="button" data-deck-taste="comfortable"><span>📖</span>익숙하고 편한 책</button>
              <button type="button" data-deck-taste="new"><span>🚪</span>새로운 세계의 책</button>
              <button type="button" data-deck-taste="instinct"><span>✨</span>그냥 마음이 가는 책</button>
            </div>
            <div class="deck-taste-reaction" role="status" aria-live="polite" hidden></div>
            <button type="button" class="text-button deck-warmup__skip" data-deck-skip>바로 카드 고르기</button>
          </div>
          <div class="deck-main" hidden>
            <header class="select-heading">
              <span class="select-kicker">D · CHARACTER DECK</span>
              <h2>친구 한 명을<br>골라보세요.</h2>
            </header>
            <div class="deck-stage">
              <div class="deck-stack" aria-hidden="true">
                <span></span><span></span><span><b>SEEDS<br>BOOK</b><i>?</i></span>
              </div>
              <div class="deck-spread" role="group" aria-label="펼쳐진 캐릭터 카드" hidden></div>
              <div class="deck-result" hidden></div>
            </div>
          </div>
        </section>`;

      const warmup = mount.querySelector('.deck-warmup');
      const main = mount.querySelector('.deck-main');
      const reaction = mount.querySelector('.deck-taste-reaction');
      const stack = mount.querySelector('.deck-stack');
      const spread = mount.querySelector('.deck-spread');
      const result = mount.querySelector('.deck-result');

      const tasteReactions = {
        comfortable: {
          ids: ['white-rice', 'brown-rice', 'glutinous-rice'],
          message: '편안하게 시작하는 거, 우리도 좋아!'
        },
        new: {
          ids: ['black-rice', 'barley', 'corn'],
          message: '새로운 세계라면 우리도 함께 갈래!'
        },
        instinct: {
          ids: ['pea', 'lentil', 'kidney-bean'],
          message: '마음이 가는 게 제일 중요하지!'
        }
      };

      const enterDeck = () => {
        if (deckEntered) return;
        deckEntered = true;
        warmup.classList.add('is-leaving');
        this.later(() => {
          warmup.hidden = true;
          main.hidden = false;
          busy = false;
          requestAnimationFrame(() => main.classList.add('is-entering'));
          this.later(runShuffle, prefersReducedMotion() ? 0 : 260);
        }, prefersReducedMotion() ? 0 : 240);
      };

      const reactToTaste = taste => {
        if (busy) return;
        busy = true;
        warmup.querySelectorAll('button').forEach(button => { button.disabled = true; });
        const choice = tasteReactions[taste];
        const friends = choice.ids.map(id => this.characters.find(character => character.id === id));
        reaction.innerHTML = `
          <div class="deck-taste-reaction__friends">
            ${friends.map(character => characterImage(character, '')).join('')}
          </div>
          <strong>${choice.message}</strong>`;
        reaction.hidden = false;
        requestAnimationFrame(() => reaction.classList.add('is-visible'));
        this.later(enterDeck, prefersReducedMotion() ? 80 : 1050);
      };

      mount.querySelectorAll('[data-deck-taste]').forEach(button => {
        button.addEventListener('click', () => reactToTaste(button.dataset.deckTaste));
      });
      mount.querySelector('[data-deck-skip]').addEventListener('click', enterDeck);

      const shuffleOrder = () => {
        order = shuffleCharacters(order);
      };

      const showSpread = () => {
        revealed = null;
        result.hidden = true;
        stack.hidden = true;
        spread.hidden = false;
        spread.innerHTML = order.map((characterIndex, position) => {
          const offset = position - (order.length - 1) / 2;
          return `
            <button type="button" class="photo-card photo-card--back" data-card-index="${characterIndex}"
              style="--card-offset:${offset};--card-rise:${Math.abs(offset) * 5}px;--card-order:${position}" aria-label="${position + 1}번째 카드 뒤집기">
              <span class="photo-card__face photo-card__back"><b>SEEDS<br>BOOK</b><i>?</i><small>처음 만난 친구</small></span>
              <span class="photo-card__face photo-card__front"></span>
            </button>`;
        }).join('');
        requestAnimationFrame(() => spread.classList.add('is-open'));
        spread.querySelector('button').focus({ preventScroll: true });
      };

      const runShuffle = () => {
        if (busy) return;
        busy = true;
        revealed = null;
        result.hidden = true;
        spread.hidden = true;
        spread.classList.remove('is-open');
        stack.hidden = false;
        shuffleOrder();
        requestAnimationFrame(() => stack.classList.add('is-shuffling'));
        this.later(() => {
          stack.classList.remove('is-shuffling');
          busy = false;
          showSpread();
        }, prefersReducedMotion() ? 80 : 820);
      };

      const revealCard = button => {
        if (busy || revealed) return;
        busy = true;
        const character = this.characters[Number(button.dataset.cardIndex)];
        revealed = character;
        spread.querySelectorAll('.photo-card').forEach(card => { card.disabled = true; });
        button.querySelector('.photo-card__front').innerHTML = `
          <span class="photo-card__number">${pad(this.characters.indexOf(character) + 1)}</span>
          ${characterImage(character, 'photo-card__image')}
          <strong>${character.name}</strong>`;
        button.classList.add('is-flipped');
        this.later(() => {
          spread.hidden = true;
          result.hidden = false;
          result.innerHTML = `
            <div class="picked-card">
              ${characterImage(character, 'picked-card__image')}
              <strong>${character.name}</strong>
              <p class="picked-card__message">“${character.shortMessage}”</p>
            </div>
            <div class="select-actions">
              <button type="button" class="select-primary" data-deck-confirm>이 친구와 시작</button>
              <button type="button" class="select-secondary" data-deck-again>다시 뽑기</button>
            </div>`;
          const confirmButton = result.querySelector('[data-deck-confirm]');
          confirmButton.focus({ preventScroll: true });
          confirmButton.addEventListener('click', () => this.confirm(character, confirmButton));
          result.querySelector('[data-deck-again]').addEventListener('click', () => {
            runShuffle();
          });
          busy = false;
        }, prefersReducedMotion() ? 80 : 650);
      };

      spread.addEventListener('click', event => {
        const button = event.target.closest('[data-card-index]');
        if (button) revealCard(button);
      });
    }

    renderRoulette(mount) {
      let busy = false;
      let currentRotation = 0;
      let selected = null;
      const slice = 360 / this.characters.length;

      mount.innerHTML = `
        <section class="select-panel roulette-select" aria-labelledby="rouletteTitle">
          <header class="select-heading">
            <span class="select-kicker">E · CHARACTER ROULETTE</span>
            <h1 id="rouletteTitle" style="margin-bottom: 30px;">누구랑 책 읽어볼까?</h1>
          </header>
          <div class="roulette-stage">
            <span class="roulette-pointer" aria-hidden="true"></span>
            <div class="roulette-wheel" role="img" aria-label="9명의 캐릭터 룰렛">
              ${this.characters.map((character, index) => `
                <span class="roulette-face" style="--face-angle:${index * slice}deg">
                  <img src="${character.image}" alt="" width="64" height="64">
                </span>`).join('')}
            </div>
            <div class="roulette-center">
              <svg viewBox="0 0 100 70" role="img" aria-label="SEEDS BOOK">
                <text x="50" y="27" text-anchor="middle" font-size="20" letter-spacing="2">SEEDS</text>
                <text x="50" y="54" text-anchor="middle" font-size="27" font-family="Georgia, serif" font-weight="bold">BOOK</text>
              </svg>
            </div>
          </div>
          <div class="roulette-status" role="status">돌리기를 눌러 친구를 만나보세요</div>
          <div class="select-actions roulette-actions">
            <button type="button" class="select-primary roulette-spin" data-roulette-spin>돌리기</button>
            <button type="button" class="text-button" data-roulette-direct>직접 고르기 →</button>
          </div>
          <div class="roulette-result" hidden></div>
          <dialog class="roulette-direct" aria-label="직접 고르기">
            <div class="all-characters__header"><strong>직접 고르기</strong><button type="button" data-roulette-close aria-label="직접 고르기 닫기">×</button></div>
            <div class="all-characters__grid"></div>
          </dialog>
        </section>`;

      const heading = mount.querySelector('.select-heading');
      const wheel = mount.querySelector('.roulette-wheel');
      const status = mount.querySelector('.roulette-status');
      const actions = mount.querySelector('.roulette-actions');
      const result = mount.querySelector('.roulette-result');
      const direct = mount.querySelector('.roulette-direct');
      const spinButton = mount.querySelector('[data-roulette-spin]');

      const showResult = character => {
        const selectedIndex = this.characters.indexOf(character);
        wheel.querySelectorAll('.roulette-face').forEach((face, index) => {
          face.classList.toggle('is-selected', index === selectedIndex);
        });
        wheel.classList.remove('has-landed');
        wheel.classList.add('is-exiting');
        heading.hidden = true;
        status.hidden = true;
        actions.hidden = true;
        // 룰렛이 화면에서 완전히 사라진 뒤에 결과 화면으로 전환한다.
        this.later(() => {
          mount.classList.add('has-roulette-result');
          result.hidden = false;
          result.classList.remove('is-visible');
          result.innerHTML = `
            <div class="roulette-result__card">
              <div>${characterImage(character, 'roulette-result__image')}</div>
              <span>만난 친구는</span>
              <strong>${character.name}</strong>
              <p class="roulette-result__message">“${character.shortMessage}”</p>
            </div>
            <div class="select-actions">
              <button type="button" class="select-primary" data-roulette-confirm>이 친구 선택</button>
              <button type="button" class="select-secondary" data-roulette-again>다시 돌리기</button>
            </div>`;
          const confirmButton = result.querySelector('[data-roulette-confirm]');
          confirmButton.focus({ preventScroll: true });
          confirmButton.addEventListener('click', () => this.confirm(character, confirmButton));
          result.querySelector('[data-roulette-again]').addEventListener('click', () => {
            const nextIndex = this.characters.indexOf(getRandomCharacter(this.characters));
            mount.classList.remove('has-roulette-result');
            wheel.classList.remove('is-exiting');
            wheel.classList.add('is-reappearing');
            result.classList.remove('is-visible');
            status.hidden = false;
            this.later(() => {
              wheel.classList.remove('is-reappearing');
              spinTo(nextIndex);
            }, prefersReducedMotion() ? 0 : 220);
          });
          this.later(() => { result.classList.add('is-visible'); }, prefersReducedMotion() ? 0 : 20);
        }, prefersReducedMotion() ? 0 : 560);
      };

      const spinTo = targetIndex => {
        if (busy) return;
        busy = true;
        selected = this.characters[targetIndex];
        result.hidden = true;
        mount.classList.remove('has-roulette-result');
        heading.hidden = false;
        actions.hidden = false;
        result.classList.remove('is-visible');
        status.hidden = false;
        spinButton.disabled = true;
        mount.querySelector('[data-roulette-direct]').disabled = true;
        status.textContent = '친구를 찾는 중…';
        currentRotation = rouletteRotation(currentRotation, targetIndex, this.characters.length, prefersReducedMotion());
        wheel.classList.remove('has-landed', 'is-spinning');
        void wheel.offsetWidth; // 직전 애니메이션(is-reappearing 등)을 리셋해 다시 돌리기가 멈춰 보이지 않게 한다.
        wheel.classList.add('is-spinning');
        wheel.style.setProperty('--wheel-rotation', `${currentRotation}deg`);
        this.later(() => {
          wheel.classList.remove('is-spinning');
          wheel.classList.add('has-landed');
          status.textContent = `${selected.name}! 반가워요.`;
          spinButton.disabled = false;
          mount.querySelector('[data-roulette-direct]').disabled = false;
          wheel.setAttribute('aria-label', `룰렛 결과: ${selected.name}`);
          busy = false;
          // has-landed 바운스가 다 보인 뒤에 결과 전환을 시작한다 (룰렛이 사라지는 동안은 showResult가 처리).
          this.later(() => showResult(selected), prefersReducedMotion() ? 0 : 420);
        }, prefersReducedMotion() ? 120 : 2450);
      };

      spinButton.addEventListener('click', () => spinTo(this.characters.indexOf(getRandomCharacter(this.characters))));
      mount.querySelector('[data-roulette-direct]').addEventListener('click', () => { if (!busy) direct.showModal(); });
      mount.querySelector('[data-roulette-close]').addEventListener('click', () => direct.close());
      const directGrid = direct.querySelector('.all-characters__grid');
      directGrid.innerHTML = this.characters.map((character, index) => `
        <button type="button" data-direct-index="${index}" aria-label="${character.name} 선택">
          ${characterImage(character, '')}<span>${character.name}</span>
        </button>`).join('');
      directGrid.addEventListener('click', event => {
        const button = event.target.closest('[data-direct-index]');
        if (!button || busy) return;
        direct.close();
        showResult(this.characters[Number(button.dataset.directIndex)]);
      });
    }
  }

  window.CharacterSelect = CharacterSelect;
})();
