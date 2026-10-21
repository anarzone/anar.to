/* ---------- Machine: DDD in three moves. 1 layers and the dependency rule, 2 entities, value objects and an
   aggregate, 3 bounded contexts that talk through domain events. One idea per move. ---------- */
function mountDdd() {
  const $ = (id) => document.getElementById(id);
  let level = 0;
  const done = [false, false, false];

  // ----- move 1: layers -----
  const LAYERS = [
    { id: 'presentation', name: 'Presentation', what: 'HTTP, CLI, the screens' },
    { id: 'application', name: 'Application', what: 'use cases that coordinate' },
    { id: 'domain', name: 'Domain', what: 'the business rules, no framework' },
    { id: 'infrastructure', name: 'Infrastructure', what: 'database, mail, payments' },
  ];
  const CLASSES = [
    { id: 'JobController', layer: 'presentation', role: 'turns an HTTP request into a use case', hint: 'It speaks HTTP, so it sits at the edge.' },
    { id: 'HireCandidateHandler', layer: 'application', role: 'a use case: load, ask the domain, save', hint: 'It coordinates a use case. The rules themselves live deeper.' },
    { id: 'Application', layer: 'domain', role: 'the aggregate that owns the hiring rules', hint: 'Business rules live in the domain.' },
    { id: 'Money', layer: 'domain', role: 'a value object: an amount in a currency', hint: 'A pure business idea, no framework needed.' },
    { id: 'CandidateHired', layer: 'domain', role: 'a domain event: something that happened', hint: 'Events describe the business, so they belong to the domain.' },
    { id: 'ApplicationRepository', layer: 'domain', role: 'the interface: "save this application"', hint: 'The domain says what it needs. Only the implementation is technical.' },
    { id: 'DoctrineApplicationRepository', layer: 'infrastructure', role: 'the implementation, talking to the database', hint: 'Anything that knows the database is infrastructure.' },
    { id: 'StripeInvoiceGateway', layer: 'infrastructure', role: 'talks to the payment provider', hint: 'Outside services sit at the edge.' },
  ];
  let placed1 = {}, picked1 = null, broken = false;

  function render1() {
    const left = CLASSES.filter((c) => !placed1[c.id]);
    $('md-chips0').innerHTML = left.map((c) => `<button type="button" class="md-chip" data-c="${c.id}" aria-pressed="${picked1 === c.id}">${c.id}</button>`).join('')
      || '<p class="stage-empty">Every class has a home.</p>';
    $('md-layers').innerHTML = LAYERS.map((l) => {
      const mine = CLASSES.filter((c) => placed1[c.id] === l.id);
      const bad = broken && l.id === 'domain';
      return `<button type="button" class="md-layer k-${l.id}${picked1 ? ' ready' : ''}${bad ? ' broken' : ''}" data-layer="${l.id}" aria-label="Place ${picked1 || 'the picked class'} in ${l.name}">
        <span class="md-layer-h"><b>${l.name}</b><small>${l.what}</small></span>
        <span class="md-layer-m">${mine.map((c) => `<i title="${c.role}">${c.id}</i>`).join('')}${bad ? '<i class="bad">use Doctrine\\ORM\\EntityManager;</i>' : ''}${!mine.length && !bad ? '<em>empty</em>' : ''}</span>
        ${l.id === 'infrastructure' ? '<span class="md-arrow" aria-hidden="true">↑ implements the domain\'s interfaces</span>' : l.id !== 'domain' ? '<span class="md-arrow" aria-hidden="true">↓ depends on</span>' : `<span class="md-arrow core" aria-hidden="true">${bad ? '✗ now depends on the database' : '● depends on nothing'}</span>`}
      </button>`;
    }).join('');
    $('md-rule').hidden = left.length > 0;
    if (!left.length && !done[0]) { done[0] = true; status('Move 1 done. Every class sits in its layer, and every dependency points at the domain.'); renderMoves(); }
  }
  function place1(layer) {
    if (!picked1) { $('md-how0').textContent = 'First pick a class on the left.'; return; }
    const c = CLASSES.find((x) => x.id === picked1);
    if (c.layer !== layer) { $('md-how0').textContent = `Not quite: ${c.hint}`; shake(`#md-layers [data-layer="${layer}"]`); return; }
    placed1[c.id] = layer; picked1 = null;
    $('md-how0').textContent = `${c.id}: ${c.role}.`;
    render1();
  }

  // ----- move 2: same or different -----
  const PAIRS = [
    { a: "new Money(50, 'EUR')", b: "new Money(50, 'EUR')", same: true, kind: 'Value object', why: 'No identity. Two amounts with the same value are the same thing, so you can swap one for the other.' },
    { a: 'Candidate #812 · Ana Kaya', b: 'Candidate #977 · Ana Kaya', same: false, kind: 'Entity', why: 'Two people can share a name. The identity decides, not the data.' },
    { a: 'Application #31 · applied', b: 'Application #31 · hired', same: true, kind: 'Entity, later', why: 'Same application, new state. An entity keeps its identity while its data changes.' },
  ];
  let answers = [];
  function render2() {
    $('md-same').innerHTML = PAIRS.map((p, i) => {
      const a = answers[i];
      return `<div class="md-pair${a ? (a.ok ? ' ok' : ' no') : ''}">
        <p class="md-pair-items"><code>${p.a}</code><span>vs</span><code>${p.b}</code></p>
        ${a?.ok ? `<p class="md-pair-why"><b>${p.kind}.</b> ${p.why}</p>` : `<div class="md-pair-btns"><button type="button" class="ride ghost" data-pair="${i}" data-same="1">Same</button><button type="button" class="ride ghost" data-pair="${i}" data-same="0">Different</button></div>${a ? '<p class="md-pair-why">Not quite. What decides it here: the value, or the identity?</p>' : ''}`}
      </div>`;
    }).join('');
    if (answers.filter((a) => a?.ok).length === PAIRS.length && !done[1]) { done[1] = true; status('Move 2 done. Value objects compare by value, entities by identity. Now try the double hire: that is what an aggregate is for.'); renderMoves(); }
  }

  // ----- move 3: contexts -----
  const CTX = [
    { id: 'hiring', name: 'Hiring', what: 'jobs and applications' },
    { id: 'candidates', name: 'Candidates', what: 'people, CVs and skills' },
    { id: 'interviews', name: 'Interviews', what: 'slots, invites and feedback' },
    { id: 'billing', name: 'Billing', what: 'clients, contracts and invoices' },
  ];
  const METHODS = [
    { id: 'publishJob', ctx: 'hiring', hint: 'Opening a position is the heart of hiring.' },
    { id: 'closeJob', ctx: 'hiring', hint: 'It changes a job, so it lives with jobs.' },
    { id: 'submitApplication', ctx: 'hiring', hint: 'An application is someone applying to one job.' },
    { id: 'hireCandidate', ctx: 'hiring', hint: 'Hiring decides an application; billing only hears about it.' },
    { id: 'parseCv', ctx: 'candidates', hint: 'A CV describes the person, not the job.' },
    { id: 'updateProfile', ctx: 'candidates', hint: 'Profiles belong to the person.' },
    { id: 'matchSkills', ctx: 'candidates', hint: 'Skills are part of who the candidate is.' },
    { id: 'scheduleInterview', ctx: 'interviews', hint: 'Time slots are an interview concern.' },
    { id: 'sendCalendarInvite', ctx: 'interviews', hint: 'Invites follow the interview, not the job.' },
    { id: 'recordFeedback', ctx: 'interviews', hint: 'Feedback is what an interview produces.' },
    { id: 'invoiceClient', ctx: 'billing', hint: 'Money lives in Billing.' },
    { id: 'applyContractDiscount', ctx: 'billing', hint: 'Discounts come from the client contract.' },
  ];
  const CALLS = [
    ['submitApplication', 'parseCv'], ['submitApplication', 'matchSkills'], ['submitApplication', 'scheduleInterview'], ['submitApplication', 'updateProfile'],
    ['hireCandidate', 'invoiceClient'], ['hireCandidate', 'closeJob'], ['hireCandidate', 'updateProfile'], ['hireCandidate', 'applyContractDiscount'],
    ['scheduleInterview', 'sendCalendarInvite'], ['scheduleInterview', 'updateProfile'], ['recordFeedback', 'hireCandidate'], ['recordFeedback', 'updateProfile'],
    ['publishJob', 'invoiceClient'], ['publishJob', 'matchSkills'], ['closeJob', 'sendCalendarInvite'], ['invoiceClient', 'applyContractDiscount'],
    ['parseCv', 'matchSkills'], ['matchSkills', 'publishJob'], ['parseCv', 'updateProfile'], ['recordFeedback', 'scheduleInterview'],
    ['applyContractDiscount', 'publishJob'], ['sendCalendarInvite', 'updateProfile'], ['closeJob', 'invoiceClient'],
  ];
  const EVENTS = [
    { name: 'ApplicationSubmitted', from: 'hiring', to: ['candidates', 'interviews'], needs: ['submitApplication', 'parseCv', 'scheduleInterview'] },
    { name: 'InterviewCompleted', from: 'interviews', to: ['hiring'], needs: ['recordFeedback', 'hireCandidate'] },
    { name: 'CandidateHired', from: 'hiring', to: ['billing', 'candidates'], needs: ['hireCandidate', 'invoiceClient', 'updateProfile'] },
    { name: 'JobPublished', from: 'hiring', to: ['billing'], needs: ['publishJob', 'invoiceClient'] },
  ];
  const LANG = [
    { ctx: 'Hiring', text: 'A candidate is an applicant for one job, with a status: applied, shortlisted, hired.' },
    { ctx: 'Candidates', text: 'A candidate is a person with a CV, skills and a profile, across every job.' },
    { ctx: 'Billing', text: 'There are no candidates here, only placements the client pays for.' },
  ];
  const byId = Object.fromEntries(METHODS.map((m) => [m.id, m]));
  let placed = {}, picked = null;
  const crossCalls = () => CALLS.filter(([a, b]) => byId[a].ctx !== byId[b].ctx && !(placed[a] && placed[b])).length;
  const liveEvents = () => EVENTS.filter((e) => e.needs.every((m) => placed[m]));

  function renderTangle() {
    const pos = {};
    METHODS.forEach((m, i) => { const a = (i / METHODS.length) * Math.PI * 2 - Math.PI / 2; pos[m.id] = [180 + 135 * Math.cos(a), 130 + 105 * Math.sin(a)]; });
    let out = '';
    CALLS.forEach(([a, b]) => {
      if (placed[a] && placed[b]) return;
      const [x1, y1] = pos[a], [x2, y2] = pos[b];
      out += `<path class="${placed[a] || placed[b] ? 'half' : ''}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q180 130 ${x2.toFixed(1)} ${y2.toFixed(1)}"></path>`;
    });
    METHODS.forEach((m) => { const [x, y] = pos[m.id]; out += `<circle class="${placed[m.id] ? `gone c-${placed[m.id]}` : ''}${picked === m.id ? ' pick' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${placed[m.id] ? 4 : 7}"></circle>`; });
    $('md-tangle').innerHTML = out;
  }
  function render3() {
    const left = METHODS.filter((m) => !placed[m.id]);
    $('md-chips').innerHTML = left.map((m) => `<button type="button" class="md-chip" data-m="${m.id}" aria-pressed="${picked === m.id}">${m.id}()</button>`).join('')
      || '<p class="stage-empty">Nothing left. <code>JobService.php</code> can go.</p>';
    $('md-left').textContent = left.length ? `${left.length} method${left.length > 1 ? 's' : ''} in one class` : 'empty, and deleted';
    $('md-calls').textContent = crossCalls();
    $('md-ctxs').innerHTML = CTX.map((c) => {
      const mine = METHODS.filter((m) => placed[m.id] === c.id);
      return `<button type="button" class="md-ctx k-${c.id}${picked ? ' ready' : ''}" data-ctx="${c.id}" aria-label="Move ${picked ? `${picked}()` : 'the picked method'} to ${c.name}">
        <span class="md-ctx-h"><b>${c.name}</b><small>${c.what}</small></span>
        <span class="md-ctx-m">${mine.map((m) => `<i>${m.id}()</i>`).join('') || '<em>empty</em>'}</span></button>`;
    }).join('');
    const ev = liveEvents();
    $('md-bus').innerHTML = `<span class="md-bus-l">Event bus</span>${ev.length ? ev.map((e) => `<span class="md-ev k-${e.from}"><b>${e.name}</b><small>${CTX.find((c) => c.id === e.from).name} → ${e.to.map((t) => CTX.find((c) => c.id === t).name).join(', ')}</small></span>`).join('') : '<span class="md-bus-empty">Events appear once both sides of a call are sorted.</span>'}`;
    $('md-lang').innerHTML = LANG.map((l) => `<li><b>${l.ctx}</b><span>${l.text}</span></li>`).join('');
    $('md-lang-box').hidden = left.length > 0;
    renderTangle();
    if (!left.length && !done[2]) { done[2] = true; status(`Move 3 done. Four parts, ${ev.length} events, no calls across a boundary. That's the untangled codebase.`); renderMoves(); }
  }
  function place3(ctx) {
    if (!picked) { $('md-how').textContent = 'First pick a method on the left.'; return; }
    const m = byId[picked];
    if (m.ctx !== ctx) { $('md-how').textContent = `Not quite: ${m.hint}`; shake(`#md-ctxs [data-ctx="${ctx}"]`); return; }
    placed[m.id] = ctx; picked = null;
    $('md-how').textContent = 'Pick the next method.';
    render3();
  }

  // ----- shared -----
  function shake(sel) { const el = document.querySelector(sel); if (!el) return; el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); }
  function status(t) { $('md-status').textContent = t; }
  function renderMoves() {
    document.querySelectorAll('#m-ddd .md-moves [data-level]').forEach((b) => {
      const i = Number(b.dataset.level);
      b.setAttribute('aria-selected', String(i === level));
      b.classList.toggle('done', done[i]);
    });
    document.querySelectorAll('#m-ddd .md-level').forEach((s) => { s.hidden = Number(s.dataset.level) !== level; });
    $('md-next').hidden = !(done[level] && level < 2);
  }
  function go(i) {
    level = i;
    renderMoves();
    const intro = ['Pick a class, then the layer it belongs in.', 'Same thing, or not? Decide for each pair.', 'Pick a method, then the part of the business that owns it.'];
    status(done[i] ? ['Move 1 is done. Try breaking the rule.', 'Move 2 is done.', 'Move 3 is done.'][i] : intro[i]);
  }
  function reset() {
    placed1 = {}; picked1 = null; broken = false; answers = []; placed = {}; picked = null;
    done.fill(false);
    $('md-inv-out').textContent = ''; $('md-inv-out').className = 'md-inv-out';
    $('md-how0').textContent = 'Pick a class, then the layer it belongs in.';
    $('md-how').textContent = 'Pick a method, then the part of the business that owns it.';
    $('md-break').innerHTML = 'Break the rule: put Doctrine inside <code>Application.php</code>';
    $('md-rule-p').textContent = 'Every arrow points at the domain. It depends on nothing, so a test of a hiring rule needs no database, no HTTP and no framework.';
    render1(); render2(); render3(); go(0);
  }

  $('m-ddd').addEventListener('click', (e) => {
    const t = e.target;
    const tab = t.closest('.md-moves [data-level]'); if (tab) { go(Number(tab.dataset.level)); return; }
    const c = t.closest('[data-c]'); if (c) { picked1 = picked1 === c.dataset.c ? null : c.dataset.c; $('md-how0').textContent = picked1 ? `${picked1}: which layer?` : 'Pick a class, then the layer it belongs in.'; render1(); return; }
    const l = t.closest('[data-layer]'); if (l) { place1(l.dataset.layer); return; }
    const pr = t.closest('[data-pair]'); if (pr) { const i = Number(pr.dataset.pair); answers[i] = { ok: (pr.dataset.same === '1') === PAIRS[i].same }; render2(); return; }
    const m = t.closest('[data-m]'); if (m) { picked = picked === m.dataset.m ? null : m.dataset.m; $('md-how').textContent = picked ? `${picked}(): which part of the business owns it?` : 'Pick a method, then the part of the business that owns it.'; render3(); return; }
    const x = t.closest('[data-ctx]'); if (x) { place3(x.dataset.ctx); }
  });
  $('md-break').addEventListener('click', () => {
    broken = !broken;
    $('md-break').innerHTML = broken ? 'Undo it' : 'Break the rule: put Doctrine inside <code>Application.php</code>';
    $('md-rule-p').textContent = broken
      ? 'Now the domain needs Doctrine, so every test of a hiring rule needs a database, a schema and fixtures. That is the codebase I started with.'
      : 'Every arrow points at the domain again. Its tests run in memory, in milliseconds.';
    render1();
  });
  $('md-legacy-hire').addEventListener('click', () => {
    $('md-inv-out').innerHTML = '<b>Legacy:</b> both calls go through. The client gets <b>2 invoices</b> for one hire, and someone finds out a month later.';
    $('md-inv-out').className = 'md-inv-out bad';
  });
  $('md-ddd-hire').addEventListener('click', () => {
    $('md-inv-out').innerHTML = '<b>Aggregate:</b> the second call throws <code>CandidateAlreadyHired</code>. One <code>CandidateHired</code> event, <b>1 invoice</b>, and a unit test proves it without a database.';
    $('md-inv-out').className = 'md-inv-out good';
  });
  $('md-solve').addEventListener('click', () => {
    METHODS.filter((m) => !placed[m.id]).forEach((m, i) => setTimeout(() => { placed[m.id] = m.ctx; picked = null; render3(); }, i * 110));
  });
  $('md-next').addEventListener('click', () => { if (level < 2) go(level + 1); $('md-h').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  $('md-reset').addEventListener('click', reset);

  return { start: reset, stop() {}, focus: () => $('md-h').focus({ preventScroll: true }) };
}
