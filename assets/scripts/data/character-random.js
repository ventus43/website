(function () {
  'use strict';

  function getRandomCharacter(characters, random = Math.random) {
    return characters[Math.floor(random() * characters.length)];
  }

  function shuffleCharacters(characters, random = Math.random) {
    const result = [...characters];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function rouletteRotation(current, index, count, reducedMotion) {
    const normalized = ((current % 360) + 360) % 360;
    const desired = (360 - index * 360 / count) % 360;
    return current + (reducedMotion ? 0 : 1800) + (desired - normalized + 360) % 360;
  }

  window.CharacterRandom = { getRandomCharacter, shuffleCharacters, rouletteRotation };
})();
