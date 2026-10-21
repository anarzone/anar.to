/* ---------- Machine: 60 → 10. Manual steps cost their minutes one after another; automated steps become CI jobs.
   A stage takes as long as its slowest job, and the stages run in order, the way GitLab runs them. ---------- */
function mountRelease() {
  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STAGES = ['Build', 'Test', 'Deploy', 'Check'];
  const STEPS = [
    { id: 'pull', hand: 'SSH into the server, pull the release branch', min: 5, auto: 'Checkout in CI', stage: 0, job: 'build:php', amin: 0.5 },
    { id: 'deps', hand: 'composer install on the live server', min: 8, auto: 'Dependencies from the CI cache', stage: 0, job: 'build:php', amin: 1 },
    { id: 'cache', hand: 'Clear and warm the cache', min: 5, auto: 'Cache warmed inside the build', stage: 0, job: 'build:php', amin: 0.5 },
    { id: 'assets', hand: 'Build the frontend assets on the server', min: 7, auto: 'Assets built once, in their own job', stage: 0, job: 'build:assets', amin: 1.5 },
    { id: 'maint', hand: 'Put up the maintenance page', min: 3, auto: 'Atomic symlink switch, no downtime', stage: 2, job: 'deploy', amin: 0.5 },
    { id: 'migrate', hand: 'Run the database migrations', min: 6, auto: 'Migrations as a deploy step', stage: 2, job: 'deploy', amin: 0.5 },
    { id: 'restart', hand: 'Restart PHP-FPM and the workers', min: 6, auto: 'Graceful reload of PHP-FPM and workers', stage: 2, job: 'deploy', amin: 0.5 },
    { id: 'click', hand: 'Click through the key pages', min: 12, auto: 'Automated smoke checks', stage: 3, job: 'smoke', amin: 1 },
    { id: 'tell', hand: 'Take the page down, tell the team', min: 8, auto: 'Release note posted by the pipeline', stage: 3, job: 'notify', amin: 0.2 },
  ];
  const TESTS = [
    { id: 'unit', auto: 'PHPUnit, unit tests', stage: 1, job: 'test:unit', amin: 2 },
    { id: 'feature', auto: 'Pest, feature tests', stage: 1, job: 'test:feature', amin: 3 },
  ];
  const fmt = (m) => { const s = Math.round(m * 60); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const minLabel = (m) => (m < 1 ? `${Math.round(m * 60)} s` : `${String(m).replace('.5', '½')} min`);

  let auto = new Set(), tests = false, shown = 60, target = 60, raf = 0, timers = [], running = false;

  const jobsByStage = () => {
    const out = STAGES.map(() => ({}));
    [...STEPS.filter((s) => auto.has(s.id)), ...(tests ? TESTS : [])].forEach((s) => {
      const j = (out[s.stage][s.job] ??= { steps: [], min: 0 });
      j.steps.push(s.auto); j.min += s.amin;
    });
    return out;
  };
  const stageMin = (jobs) => Math.max(0, ...Object.values(jobs).map((j) => j.min));
  const total = () => STEPS.filter((s) => !auto.has(s.id)).reduce((a, s) => a + s.min, 0) + jobsByStage().reduce((a, j) => a + stageMin(j), 0);

  function tick() {
    const d = target - shown;
    shown = Math.abs(d) < 0.02 ? target : shown + d * 0.18;
    $('mr-clock').textContent = fmt(shown);
    $('mr-bar').style.width = `${Math.min(100, (shown / 60) * 100)}%`;
    raf = shown === target ? 0 : requestAnimationFrame(tick);
  }
  function setClock(m) {
    target = m;
    if (reduced) { shown = m; $('mr-clock').textContent = fmt(m); $('mr-bar').style.width = `${Math.min(100, (m / 60) * 100)}%`; return; }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function render() {
    $('mr-hand').innerHTML = STEPS.map((s) => auto.has(s.id)
      ? `<li class="hs done" data-step="${s.id}"><span class="hs-t">${s.hand}</span><span class="hs-m">${minLabel(s.min)}</span><span class="hs-ok">automated ✓</span></li>`
      : `<li class="hs" data-step="${s.id}"><span class="hs-t">${s.hand}</span><span class="hs-m">${minLabel(s.min)}</span><button type="button" class="ride" data-auto="${s.id}">Automate ▸</button></li>`).join('');
    const jobs = jobsByStage();
    $('mr-stages').innerHTML = jobs.map((js, i) => {
      const list = Object.entries(js);
      return `<div class="stage" data-stage="${i}"><p class="stage-h"><span>${STAGES[i]}</span><span>${list.length ? minLabel(stageMin(js)) : ''}</span></p>${list.length
        ? list.map(([name, j]) => `<div class="job"><b>${name}</b><ul>${j.steps.map((t) => `<li>${t}</li>`).join('')}</ul><span>${minLabel(j.min)}</span></div>`).join('')
        : `<p class="stage-empty">${i === 1 ? 'No tests yet' : 'Nothing here yet'}</p>`}</div>`;
    }).join('');
    const t = total(), all = auto.size === STEPS.length;
    setClock(t);
    $('mr-tests').disabled = tests || running;
    $('mr-tests').textContent = tests ? 'Tests added ✓' : "Add the tests that didn't exist ▸";
    $('mr-all').disabled = all || running;
    $('mr-safety').textContent = tests ? 'Checked by: PHPUnit and Pest, on every push' : auto.has('click') ? 'Checked by: smoke checks only' : 'Checked by: someone clicking around';
    $('mr-stamp').hidden = !(all && tests);
    $('mr-status').textContent = all && tests ? `Summit: 60 → ${fmt(t)} minutes, and every release is tested. That's the climb.`
      : all ? 'Under ten minutes. But nothing checks the code yet: add the tests.'
      : auto.size ? `${auto.size} of ${STEPS.length} steps automated. ${tests ? '' : 'The code still has no tests.'}`
      : 'One person, about an hour, every release. Start automating.';
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function run() {
    if (running) return;
    running = true;
    document.querySelectorAll('#m-release .mach-actions button, #mr-tests').forEach((b) => { b.disabled = true; });
    const manual = STEPS.filter((s) => !auto.has(s.id));
    const jobs = jobsByStage();
    const perMin = reduced ? 10 : 90; // ms of animation per release minute
    let at = 0, elapsed = 0;
    $('mr-clock-l').textContent = 'Release running';
    shown = 0; target = 0; $('mr-clock').textContent = fmt(0); $('mr-bar').style.width = '0%';
    const advance = (m) => { elapsed += m; const e = elapsed; return () => { $('mr-clock').textContent = fmt(e); $('mr-bar').style.width = `${Math.min(100, (e / 60) * 100)}%`; }; };
    manual.forEach((s) => {
      const li = document.querySelector(`#mr-hand [data-step="${s.id}"]`);
      later(at, () => li?.classList.add('running'));
      at += s.min * perMin;
      later(at, advance(s.min));
      later(at, () => { li?.classList.remove('running'); li?.classList.add('ran'); });
    });
    jobs.forEach((js, i) => {
      const m = stageMin(js);
      if (!m) return;
      const col = document.querySelector(`#mr-stages [data-stage="${i}"]`);
      later(at, () => col?.classList.add('running'));
      at += Math.max(300, m * perMin * 2);
      later(at, advance(m));
      later(at, () => { col?.classList.remove('running'); col?.classList.add('passed'); });
    });
    later(at + 200, () => {
      running = false;
      $('mr-clock-l').textContent = 'Minutes per release';
      document.querySelectorAll('#mr-hand .ran').forEach((li) => li.classList.remove('ran'));
      $('mr-status').textContent = `Released in ${fmt(elapsed)}. ${manual.length ? `${manual.length} step${manual.length > 1 ? 's' : ''} still by hand.` : tests ? 'Tested, deployed, checked.' : 'Fast, but untested.'}`;
      document.querySelectorAll('#m-release .mach-actions button').forEach((b) => { b.disabled = false; });
      $('mr-all').disabled = auto.size === STEPS.length;
      $('mr-tests').disabled = tests;
      shown = elapsed; target = elapsed;
    });
  }

  $('m-release').addEventListener('click', (e) => {
    const a = e.target.closest('[data-auto]');
    if (a && !running) { auto.add(a.dataset.auto); render(); }
  });
  $('mr-tests').addEventListener('click', () => { if (!running) { tests = true; render(); } });
  $('mr-all').addEventListener('click', () => {
    if (running) return;
    STEPS.filter((s) => !auto.has(s.id)).forEach((s, i) => later(reduced ? 0 : i * 140, () => { auto.add(s.id); render(); }));
  });
  $('mr-run').addEventListener('click', run);
  $('mr-reset').addEventListener('click', () => { clearTimers(); running = false; auto = new Set(); tests = false; $('mr-clock-l').textContent = 'Minutes per release'; render(); });

  function start() { clearTimers(); running = false; auto = new Set(); tests = false; shown = 60; target = 60; $('mr-clock-l').textContent = 'Minutes per release'; render(); }
  function stop() { clearTimers(); running = false; cancelAnimationFrame(raf); raf = 0; }
  return { start, stop };
}
