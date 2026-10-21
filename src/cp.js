/* ---------- Curiplay round ----------
   Quiz logic follows Curiplay's design-quiz-v6.js (render phases, pips, streak, feedback copy).
   Words, articles, levels, example sentences and wrong answers come from Curiplay's word bank. */
const CP_WORDS = [
  { article: 'der', word: 'Kaffee', level: 'A1', options: ['coffee', 'tea', 'library', 'bus stop'], correct: 0,
    example: 'Möchtest du eine Tasse Kaffee?', translation: 'Would you like a cup of coffee?',
    note: 'Every right answer in Curiplay earns money for your café. That is the whole loop.' },
  { article: 'das', word: 'Fahrrad', level: 'A1', options: ['racket', 'bicycle', 'darling', 'contentment'], correct: 1,
    example: 'Mein Fahrrad hat einen platten Reifen.', translation: 'My bicycle has a flat tire.',
    note: 'Mine is fine, thanks. When the code ships, I go for a ride.' },
  { article: 'die', word: 'Behörde', level: 'B1', options: ['position', 'innovation', 'authority', 'classmate'], correct: 2,
    example: 'Man muss sich bei der zuständigen Behörde anmelden.', translation: 'You have to register with the responsible authority.',
    note: 'Germany runs on Behörden. My other product, Expadu, gets you through them in English.' },
  { article: 'die', word: 'Warteschlange', level: 'A2', options: ['cash register', 'entrance', 'exit', 'queue'], correct: 3,
    example: 'Die Warteschlange ist heute sehr lang.', translation: 'The queue is very long today.',
    note: 'Queues are my day job. In my PHP backends, RabbitMQ and Symfony Messenger do the waiting.' },
  { article: 'der', word: 'Feierabend', level: 'B1', options: ['end of work', 'start of work', 'lunch break', 'morning shift'], correct: 0,
    example: 'Endlich ist Feierabend!', translation: 'Finally, the workday is over!',
    note: 'Feierabend is when I build. My busiest commit hour is 21:00.' },
  { article: 'der', word: 'Entwickler', level: 'C1', options: ['politician', 'developer', 'reform', 'banner'], correct: 1,
    example: 'Die Entwickler arbeiten an einer neuen Version der App.', translation: 'The developers are working on a new version of the app.',
    note: "That's me. Hi, I'm Anar, der Entwickler of this app." },
];

function mountCuriplay() {
  const dlg = document.getElementById('cp');
  const q = (sel) => dlg.querySelector(sel);
  const qa = (sel) => [...dlg.querySelectorAll(sel)];
  const board = q('[data-cp-board]');
  const buttons = qa('[data-cp-answer]');
  const pips = qa('[data-cp-pip]');
  const results = q('[data-cp-results]');
  const cafe = q('[data-cp-cafe]');
  const next = q('[data-cp-next]');
  const sounds = {
    correct: new Audio('{{A_RIGHT}}'), retry: new Audio('{{A_WRONG}}'),
    complete: new Audio('{{A_COMPLETE}}'), money: new Audio('{{A_MONEY}}'),
  };
  sounds.money.volume = 0.5;
  let soundOn = true;
  const play = (name) => {
    if (!soundOn) return;
    try { const a = sounds[name]; a.currentTime = 0; a.play().catch(() => {}); } catch (e) { /* sound is optional */ }
  };

  const state = { index: 0, selected: null, results: [], scene: 'quiz', startedAt: 0, marked: new Set() };
  const score = () => state.results.filter(Boolean).length;
  const streak = () => { let n = 0; for (let i = state.results.length - 1; i >= 0 && state.results[i]; i--) n++; return n; };
  const bestStreak = () => { let best = 0, run = 0; state.results.forEach((r) => { run = r ? run + 1 : 0; best = Math.max(best, run); }); return best; };
  // Curiplay's rule: $3 per correct first try, +min(streak / 3, 3) every 3 in a row, +$10 for finishing the round
  const reward = () => { let total = 10, run = 0; state.results.forEach((r) => { run = r ? run + 1 : 0; if (r) total += 3 + (run % 3 === 0 ? Math.min(run / 3, 3) : 0); }); return total; };

  function setScene(scene) {
    state.scene = scene;
    dlg.dataset.scene = scene;
    board.hidden = scene !== 'quiz';
    results.hidden = scene !== 'results';
    cafe.hidden = scene !== 'cafe';
    dlg.scrollTop = 0;
  }

  function render() {
    const question = CP_WORDS[state.index];
    const answered = state.selected !== null;
    board.dataset.phase = answered ? 'answered' : 'question';
    board.dataset.verdict = answered ? (state.results.at(-1) ? 'correct' : 'incorrect') : '';
    q('[data-cp-round]').textContent = `Card ${state.index + 1} of ${CP_WORDS.length}`;
    q('[data-cp-streak]').textContent = streak();
    const badge = q('[data-cp-streak-badge]');
    badge.setAttribute('aria-label', `${streak()} correct in a row`);
    badge.dataset.lit = String(streak() > 0);
    q('[data-cp-level]').textContent = question.level;
    const article = q('[data-article]');
    article.textContent = question.article;
    article.dataset.gender = question.article;
    q('[data-word]').textContent = question.word;
    pips.forEach((pip, i) => {
      const r = state.results[i];
      pip.dataset.result = r === undefined ? 'pending' : r ? 'correct' : 'incorrect';
      pip.setAttribute('aria-label', `Card ${i + 1}: ${r === undefined ? 'unanswered' : r ? 'correct' : 'incorrect'}`);
      pip.setAttribute('aria-current', i === state.index ? 'step' : 'false');
      pip.querySelector('.ms').textContent = r === undefined ? '' : r ? 'check' : 'close';
    });
    buttons.forEach((button, i) => {
      button.querySelector('[data-answer-label]').textContent = question.options[i];
      button.setAttribute('aria-disabled', String(answered));
      const correct = answered && i === question.correct;
      const incorrect = answered && i === state.selected && !correct;
      button.dataset.result = correct ? 'correct' : incorrect ? 'incorrect' : '';
      button.querySelector('[data-answer-icon]').textContent = correct ? 'check' : incorrect ? 'close' : '';
      button.querySelector('[data-answer-status]').textContent = correct ? 'Correct answer' : incorrect ? 'Your answer, incorrect' : '';
    });
    const feedback = q('[data-cp-feedback]');
    feedback.textContent = !answered ? 'Pick a tile. Trust your memory.' : state.results.at(-1)
      ? `That's right! ${question.article} ${question.word} means ${question.options[question.correct]}.`
      : `Not quite. ${question.article} ${question.word} means ${question.options[question.correct]}.`;
    q('[data-cp-example]').hidden = !answered;
    q('[data-cp-example-de]').textContent = answered ? question.example : '';
    q('[data-cp-example-en]').textContent = answered ? question.translation : '';
    q('[data-cp-note]').hidden = !answered;
    q('[data-cp-note-text]').textContent = answered ? question.note : '';
    next.hidden = !answered;
    next.querySelector('span').textContent = state.index === CP_WORDS.length - 1 ? 'See my results' : 'Next card';
    q('[data-cp-hint]').textContent = answered ? 'Enter for the next card' : '1–4 to choose';
  }

  function answer(choice) {
    if (state.scene !== 'quiz' || state.selected !== null) return;
    state.selected = choice;
    state.results.push(choice === CP_WORDS[state.index].correct);
    render();
    play(state.results.at(-1) ? 'correct' : 'retry');
    next.focus({ preventScroll: true });
  }

  function advance() {
    if (state.selected === null) return;
    if (state.index === CP_WORDS.length - 1) { showResults(); return; }
    state.index += 1;
    state.selected = null;
    render();
    q('[data-cp-question-title]').focus({ preventScroll: true });
  }

  function showResults() {
    const n = score();
    const total = CP_WORDS.length;
    q('[data-cp-results-title]').textContent = n === total ? 'Your knowledge keeps working.' : 'A little more learned.';
    q('[data-cp-pct]').textContent = `${Math.round((n / total) * 100)}%`;
    q('[data-cp-correct]').textContent = `${n} of ${total} correct`;
    q('[data-cp-reward]').textContent = `+$${reward()}`;
    q('[data-cp-door]').textContent = `+$${reward()} at the door`;
    q('[data-cp-best]').textContent = bestStreak();
    const minutes = Math.max(1, Math.round((Date.now() - state.startedAt) / 60000));
    q('[data-cp-time]').textContent = `${minutes} min`;
    const list = q('[data-cp-words]');
    list.textContent = '';
    CP_WORDS.forEach((w, i) => {
      const ok = state.results[i];
      const li = document.createElement('li');
      li.className = 'word-row';
      const body = document.createElement('div');
      const h3 = document.createElement('h3');
      const word = document.createElement('span');
      word.lang = 'de';
      word.textContent = `${w.article} ${w.word}`;
      const outcome = document.createElement('span');
      outcome.className = 'outcome';
      outcome.dataset.review = String(!ok);
      outcome.textContent = ok ? 'Correct!' : 'Again';
      h3.append(word, outcome);
      const meaning = document.createElement('p');
      meaning.textContent = w.options[w.correct];
      const said = document.createElement('p');
      said.className = 'said';
      said.textContent = w.note;
      body.append(h3, meaning, said);
      const mark = document.createElement('button');
      mark.type = 'button';
      mark.className = 'mark';
      const markedNow = state.marked.has(w.word) || !ok;
      if (markedNow) state.marked.add(w.word);
      mark.setAttribute('aria-pressed', String(markedNow));
      mark.setAttribute('aria-label', `Mark ${w.article} ${w.word} for review`);
      mark.innerHTML = '<span class="ms" aria-hidden="true">bookmark</span>';
      mark.addEventListener('click', () => {
        const on = mark.getAttribute('aria-pressed') !== 'true';
        mark.setAttribute('aria-pressed', String(on));
        if (on) state.marked.add(w.word); else state.marked.delete(w.word);
        q('[data-cp-marked]').textContent = state.marked.size ? `${state.marked.size} marked` : `${total} words`;
      });
      li.append(body, mark);
      list.append(li);
    });
    q('[data-cp-marked]').textContent = state.marked.size ? `${state.marked.size} marked` : `${total} words`;
    setScene('results');
    play('complete');
    q('[data-cp-results-title]').focus({ preventScroll: true });
  }

  function showCafe() {
    const scene = q('[data-cp-scene]');
    scene.dataset.open = 'false';
    q('[data-cp-sign]').textContent = 'Geschlossen';
    q('[data-cp-cafe-sub]').textContent = 'Your café is still closed today.';
    const open = q('[data-cp-open]');
    open.disabled = false;
    open.firstChild.textContent = 'Open café ';
    setScene('cafe');
    play('money');
    q('#cp-cafe-title').focus({ preventScroll: true });
  }

  function openCafe() {
    const scene = q('[data-cp-scene]');
    if (scene.dataset.open === 'true') return;
    scene.dataset.open = 'true';
    q('[data-cp-sign]').textContent = 'Geöffnet';
    q('[data-cp-cafe-sub]').textContent = `Your café is open. You brought ${q('[data-cp-reward]').textContent.replace('+', '')} to the door.`;
    const open = q('[data-cp-open]');
    open.disabled = true;
    open.firstChild.textContent = 'Open ';
    play('correct');
  }

  function start() {
    state.index = 0; state.selected = null; state.results = []; state.marked = new Set(); state.startedAt = Date.now();
    setScene('quiz');
    render();
  }

  buttons.forEach((button, i) => button.addEventListener('click', () => answer(i)));
  next.addEventListener('click', advance);
  qa('[data-cp-again]').forEach((b) => b.addEventListener('click', () => { start(); q('[data-cp-question-title]').focus({ preventScroll: true }); }));
  q('[data-cp-collect]').addEventListener('click', showCafe);
  q('[data-cp-open]').addEventListener('click', openCafe);
  q('[data-cp-back-results]').addEventListener('click', () => setScene('results'));
  q('[data-cp-sound]').addEventListener('click', (e) => {
    soundOn = !soundOn;
    e.currentTarget.setAttribute('aria-pressed', String(soundOn));
  });
  dlg.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.target.closest('input, textarea, select')) return;
    if (state.scene !== 'quiz') return;
    if (/^[1-4]$/.test(event.key)) { event.preventDefault(); answer(Number(event.key) - 1); }
    else if (event.key === 'Enter' && state.selected !== null && event.target === dlg) { event.preventDefault(); advance(); }
  });

  return { start, focus: () => q('[data-cp-question-title]').focus({ preventScroll: true }) };
}
