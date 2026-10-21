/* ---------- Machine: Curiplay, one answer, two ledgers. Money follows AdaptiveChallengeAnswerService ($3 per correct
   first try, +min(streak/3, 3) every 3 in a row, +$10 for finishing); stars and levels follow CafeLearningLinkService and
   economy.js; the memory steps follow FsrsSchedulerTest's reference sequence. ---------- */
function mountCuriplayDesign() {
  const $ = (id) => document.getElementById(id);
  const WORDS = [
    { art: 'der', de: 'Kaffee', en: 'coffee' },
    { art: 'die', de: 'Tasse', en: 'cup' },
    { art: 'das', de: 'Glas', en: 'glass' },
    { art: 'der', de: 'Kuchen', en: 'cake' },
    { art: 'die', de: 'Milch', en: 'milk' },
  ];
  const LEVEL_STARS = [0, 0, 2, 5, 8, 12, 16, 21, 26, 32, 38];
  const PADS = { 1: ['Table $20', 'Carry 5 $35', 'Table $40'], 2: ['Cashier $65', 'Tempo 1 $75', 'Rack $50'] };
  // Reference sequence, fuzz off, each review on its due day: Good ×6, Again ×2, Good ×5
  const GOOD = ['10 min', '2 days', '11 days', '46 days', '163 days', '498 days'];
  const RELEARN = ['10 min', '10 min', '2 days', '4 days', '7 days', '12 days', '21 days'];
  const label = (iv) => {
    if (iv.includes('min')) return 'Learning';
    const d = parseInt(iv, 10);
    return d < 7 ? 'Familiar' : d < 21 ? 'Practiced' : d < 60 ? 'Known' : 'Mastered';
  };
  let queue, at, streak, money, firsts, firstRight, mem, cash, busy, timers = [], stampsState;

  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

  function starsFor(pct) { return 1 + (pct >= 0.8 ? 1 : 0) + (pct >= 0.95 ? 1 : 0); }
  function levelFor(stars) { let l = 1; LEVEL_STARS.forEach((n, i) => { if (i >= 1 && stars >= n) l = i; }); return l; }

  function renderTotals(stars) {
    $('lp-money').textContent = `$${money}`;
    $('lp-stars').textContent = stars == null ? '☆☆☆' : '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('lp-sched').textContent = Object.keys(mem).length;
  }
  function renderLedgers() {
    $('lp-mem').innerHTML = Object.values(mem).map((m) => `<li class="${m.cls}"><b>${m.word}</b><span>${m.text}</span></li>`).join('') || '<li class="empty"><span>Nothing scheduled yet.</span></li>';
    $('lp-cash').innerHTML = cash.map((c) => `<li class="${c.cls}"><b>${c.amt}</b><span>${c.text}</span></li>`).join('') || '<li class="empty"><span>No money yet.</span></li>';
  }
  function renderPips() {
    $('lp-pips').innerHTML = queue.map((q, i) => `<i class="${q.result || ''}${i === at ? ' now' : ''}${q.comeback ? ' back' : ''}">${q.result === 'right' ? '✓' : q.result === 'wrong' ? '✕' : ''}</i>`).join('');
  }
  function renderCafe(stars) {
    const lv = levelFor(stars);
    $('lp-meter').style.width = `${Math.min(100, (stars / LEVEL_STARS[2]) * 100)}%`;
    $('lp-level').textContent = lv >= 2 ? `Level 2 is open: ${stars} ★ from this round.` : `Level 1. Level 2 needs 2 ★${stars ? `, you have ${stars}` : ''}. Stars come only from learning.`;
    $('lp-pads').innerHTML = [1, 2].map((l) => PADS[l].map((p) => `<span class="${l <= lv ? 'open' : 'locked'}">${l > lv ? '🔒 ' : ''}${p}</span>`).join('')).join('');
  }

  function ask() {
    const q = queue[at];
    const w = q.word;
    $('lp-art').textContent = w.art; $('lp-art').className = `lp-art a-${w.art}`;
    $('lp-word').textContent = w.de;
    $('lp-prompt').textContent = q.comeback ? 'Comeback: one more try.' : 'Pick a tile. Trust your memory.';
    const opts = shuffle([w, ...shuffle(WORDS.filter((x) => x !== w)).slice(0, 3)]);
    $('lp-tiles').innerHTML = opts.map((o, i) => `<button type="button" class="lp-tile" data-en="${o.en}"><kbd>${i + 1}</kbd>${o.en}</button>`).join('');
    $('lp-feedback').textContent = '';
    renderPips();
    busy = false;
  }

  function answer(btn) {
    if (busy) return;
    busy = true;
    const q = queue[at], w = q.word, right = btn.dataset.en === w.en;
    const name = `${w.art} ${w.de}`;
    $('lp-tiles').querySelectorAll('button').forEach((b) => { b.disabled = true; if (b.dataset.en === w.en) b.classList.add('ok'); });
    if (!right) btn.classList.add('bad');
    q.result = right ? 'right' : 'wrong';
    if (q.comeback) {
      cash.push({ amt: '$0', text: `${name}: comeback, practice`, cls: 'zero' });
      mem[name].text += ' · comeback stored as practice, schedule unchanged';
      $('lp-feedback').textContent = right ? 'Right. Comebacks are practice: no money, no streak change.' : `Not quite. ${name} means ${w.en}.`;
    } else if (right) {
      firstRight++; streak++;
      let coins = 3, bonus = 0;
      if (streak % 3 === 0) { bonus = Math.min(Math.floor(streak / 3), 3); coins += bonus; }
      money += coins;
      cash.push({ amt: `+$3`, text: `${name}, first try`, cls: 'plus' });
      if (bonus) cash.push({ amt: `+$${bonus}`, text: `${streak} in a row`, cls: 'plus' });
      mem[name] = { word: name, text: 'Learning · back in 10 min', cls: 'good' };
      $('lp-feedback').textContent = `That's right! ${name} means ${w.en}.`;
    } else {
      streak = 0;
      cash.push({ amt: '$0', text: `${name}, missed`, cls: 'zero' });
      mem[name] = { word: name, text: 'Again · back in 1 min', cls: 'again' };
      queue.push({ word: w, comeback: true });
      $('lp-feedback').textContent = `Not quite. ${name} means ${w.en}. We'll ask it again at the end.`;
    }
    if (!q.comeback) firsts++;
    renderTotals(); renderLedgers(); renderPips();
    later(right ? 900 : 1700, () => { at++; if (at < queue.length) ask(); else finish(); });
  }

  function finish() {
    money += 10;
    cash.push({ amt: '+$10', text: 'round finished', cls: 'plus' });
    const pct = firstRight / firsts, stars = starsFor(pct);
    renderTotals(stars); renderLedgers(); renderCafe(stars);
    $('lp-res-stars').textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  ${firstRight} of ${firsts} on the first try`;
    $('lp-res-money').textContent = `+$${money} waiting at your café door`;
    $('lp-card').hidden = true; $('lp-tiles').innerHTML = ''; $('lp-feedback').textContent = '';
    $('lp-results').hidden = false;
    renderPips();
  }

  // ----- time travel on one word -----
  function renderStamps(note) {
    const s = stampsState;
    $('lp-stamps').innerHTML = s.log.map((x) => `<li class="${x.cls}"><b>${x.grade}</b><span>${x.iv}</span><em>${x.label}</em></li>`).join('')
      + (s.drills ? `<li class="practice"><b>Practice${s.drills > 1 ? ` ×${s.drills}` : ''}</b><span>no change</span><em>$0</em></li>` : '');
    $('lp-due').disabled = s.phase === 'done';
    $('lp-due').textContent = s.phase === 'relearn-again' ? 'Miss it again ▸' : 'Answer it on the due day ▸';
    $('lp-forget').hidden = !(s.phase === 'good' && s.i >= GOOD.length);
    if (s.phase === 'good' && s.i >= GOOD.length) $('lp-due').disabled = true;
    $('lp-time-p').textContent = note || $('lp-time-p').textContent;
  }
  function resetStamps() {
    stampsState = { phase: 'good', i: 1, r: 0, drills: 0, log: [{ grade: 'Good', iv: GOOD[0], label: label(GOOD[0]), cls: 'good' }] };
    renderStamps('A word starts as Learning. Each time you remember it on the due day, the gap grows.');
  }
  $('lp-due').addEventListener('click', () => {
    const s = stampsState;
    s.drills = 0;
    if (s.phase === 'good' && s.i < GOOD.length) {
      s.log.push({ grade: 'Good', iv: GOOD[s.i], label: label(GOOD[s.i]), cls: 'good' }); s.i++;
      renderStamps(s.i === GOOD.length ? 'Mastered: next review in 498 days. Now try forgetting it.' : `Remembered on the due day. Next review in ${GOOD[s.i - 1]}.`);
    } else if (s.phase === 'relearn-again') {
      s.log.push({ grade: 'Again', iv: RELEARN[1], label: 'Relearning', cls: 'again' }); s.phase = 'relearn'; s.r = 2;
      renderStamps('Missed twice. Still not back to new: it relearns from what you knew.');
    } else if (s.phase === 'relearn' && s.r < RELEARN.length) {
      s.log.push({ grade: 'Good', iv: RELEARN[s.r], label: label(RELEARN[s.r]), cls: 'good' }); s.r++;
      if (s.r === RELEARN.length) s.phase = 'done';
      renderStamps(s.phase === 'done' ? 'Back to Known after five good answers. A miss weakened it; it never reset it to new.' : `Relearning: next review in ${RELEARN[s.r - 1]}.`);
    }
  });
  $('lp-forget').addEventListener('click', () => {
    const s = stampsState;
    s.drills = 0;
    s.log.push({ grade: 'Again', iv: RELEARN[0], label: 'Relearning', cls: 'again' }); s.phase = 'relearn-again';
    renderStamps('Forgot it after 498 days: it drops into relearning, back in 10 min. Not reset to new.');
  });
  $('lp-drill').addEventListener('click', () => {
    const s = stampsState;
    s.drills++;
    renderStamps(s.drills === 1
      ? "Not due yet, so it's practice: the answer is stored, the schedule doesn't move, and it pays nothing."
      : `Drilled ${s.drills} times before it was due: still $0, and the next review hasn't moved. There's nothing to farm.`);
  });

  function startRound() {
    timers.forEach(clearTimeout); timers = [];
    queue = WORDS.map((w) => ({ word: w })); at = 0; streak = 0; money = 0; firsts = 0; firstRight = 0; mem = {}; cash = []; busy = false;
    $('lp-card').hidden = false; $('lp-results').hidden = true;
    renderTotals(); renderLedgers(); renderCafe(0); ask();
  }

  $('lp-tiles').addEventListener('click', (e) => { const b = e.target.closest('.lp-tile'); if (b) answer(b); });
  $('m-cp').addEventListener('keydown', (e) => {
    if (!/^[1-4]$/.test(e.key) || e.target.closest('input, textarea')) return;
    const b = $('lp-tiles').querySelectorAll('.lp-tile')[Number(e.key) - 1];
    if (b && !b.disabled) answer(b);
  });
  $('lp-again').addEventListener('click', startRound);
  $('lp-idle').addEventListener('click', () => { $('lp-idle-p').hidden = !$('lp-idle-p').hidden; });

  return {
    start() { startRound(); resetStamps(); $('lp-idle-p').hidden = true; },
    stop() { timers.forEach(clearTimeout); timers = []; },
    focus: () => $('lp-h').focus({ preventScroll: true }),
  };
}
