/* ---------- Machine: SQL time trial. sql.js (SQLite in WebAssembly) loads on first open; a seeded
   generator fills a job board; each stage times the old way and the visitor's query with performance.now(). ---------- */
function mountSql() {
  const $ = (id) => document.getElementById(id);
  const CDN = '{{SQLJS_BASE}}';
  const RTT_MS = 1; // a typical app-to-database round trip, used only for the labelled estimate in stage 1
  const STAGES = [
    { name: 'The N+1 sprint',
      brief: "The job board's front page lists the 20 newest jobs in Köln, each with its company. The ORM fetched the jobs, then went back to the database once per job to get the company.",
      legacy: "$jobs = $jobRepository->findBy(\n    ['city' => 'Köln'], ['postedAt' => 'DESC'], 20\n);\nforeach ($jobs as $job) {\n    echo $job->getCompany()->getName(); // +1 query\n}",
      start: "SELECT j.id, j.title, j.posted_at\nFROM jobs j\nWHERE j.city = 'Köln'\nORDER BY j.posted_at DESC\nLIMIT 20;",
      task: 'Bring the company name into the same query: one query instead of 21.',
      line: "SELECT j.id, j.title, c.name AS company, j.posted_at\nFROM jobs j\nJOIN companies c ON c.id = j.company_id\nWHERE j.city = 'Köln'\nORDER BY j.posted_at DESC\nLIMIT 20;" },
    { name: 'The index climb',
      brief: 'Recruiters open a job and see how many people applied. With 80,000 applications and no index, every count reads the whole table.',
      legacy: 'SELECT COUNT(*)\nFROM applications\nWHERE job_id = 4711;\n-- plan: SCAN applications (every row)',
      start: 'SELECT COUNT(*)\nFROM applications\nWHERE job_id = 4711;',
      task: 'Add an index, then run the count again. Watch the plan change from SCAN to SEARCH.',
      line: 'CREATE INDEX idx_applications_job ON applications (job_id);\nSELECT COUNT(*)\nFROM applications\nWHERE job_id = 4711;' },
    { name: 'One-query report',
      brief: 'Finance wants applications and hires per month for 2025. The old report loaded every application into PHP and counted them in a loop.',
      legacy: "$rows = $db->fetchAllAssociative('SELECT * FROM applications');\nforeach ($rows as $row) {\n    $month = substr($row['applied_at'], 0, 7);\n    $all[$month] = ($all[$month] ?? 0) + 1;\n    if ($row['status'] === 'hired') {\n        $hired[$month] = ($hired[$month] ?? 0) + 1;\n    }\n}",
      start: 'SELECT status, applied_at\nFROM applications\nLIMIT 5;',
      task: 'Let the database count: one row per month of 2025, with all applications and the hires.',
      line: "SELECT strftime('%Y-%m', applied_at) AS month,\n       COUNT(*) AS applications,\n       SUM(status = 'hired') AS hired\nFROM applications\nWHERE applied_at >= '2025-01-01' AND applied_at < '2026-01-01'\nGROUP BY month\nORDER BY month;" },
    { name: 'Free ride',
      brief: 'No clock to beat. Ask the job board anything. Indexes you create stay until you reset the database.',
      legacy: '', task: '', line: '',
      start: "-- Which cities pay best for developers?\nSELECT city, COUNT(*) AS jobs, ROUND(AVG(salary)) AS avg_salary\nFROM jobs\nWHERE title LIKE '%Developer%'\nGROUP BY city\nORDER BY avg_salary DESC;" },
  ];
  const SCHEMA = 'companies    (id, name, city, industry)                      400 rows\njobs         (id, company_id, title, city, salary, posted_at)  12,000 rows\napplications (id, job_id, candidate, status, applied_at)    80,000 rows\n\nstatus: applied, shortlisted, interview, rejected, hired\nOnly the primary keys are indexed to begin with.';

  let SQL = null, db = null, loading = null, stage = 0, ready = false, companyNames = null, baseline = {};
  const won = [false, false, false];
  const score = [{}, {}, {}];

  const fmt = (ms) => (ms < 0.1 ? `${Math.max(1, Math.round(ms * 1000))} µs` : `${ms < 1 ? ms.toFixed(2) : ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`);
  const esc = (t) => String(t ?? 'NULL').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const msg = (text, cls = '') => { $('sq-msg').textContent = text; $('sq-msg').className = `sq-msg ${cls}`; };
  // repeat until ~30 ms have passed (or max runs) and average, so fast queries measure well even with coarse timers
  function timeIt(fn, max = 400) {
    const first = performance.now();
    let out = fn(), runs = 1;
    while (runs < max && performance.now() - first < 30) { fn(); runs++; }
    return { out, ms: (performance.now() - first) / runs };
  }

  // ----- engine and data -----
  const loadScript = (src) => new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src; el.onload = resolve; el.onerror = () => reject(new Error(`${src} did not load`));
    document.head.appendChild(el);
  });
  const within = (ms, p) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
  // Can this page compile WebAssembly and fetch the .wasm file? Some embeds forbid one or the other.
  async function wasmAllowed() {
    try { new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])); } catch (e) { return false; }
    try { const r = await within(3000, fetch(`${CDN}sql-wasm.wasm`, { method: 'HEAD' })); return r.ok; } catch (e) { return false; }
  }
  // WebAssembly when allowed; otherwise the plain-JavaScript build of the same SQLite, loaded as a normal script
  const asm = () => loadScript(`${CDN}sql-asm-memory-growth.min.js`).then(() => window.initSqlJs());
  function loadEngine() {
    loading ??= wasmAllowed()
      .then((ok) => (ok ? within(10000, loadScript(`${CDN}sql-wasm.js`).then(() => window.initSqlJs({ locateFile: (f) => CDN + f }))).catch(asm) : asm()))
      .then((S) => { SQL = S; });
    return loading;
  }
  function rng(seed) {
    return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function build() {
    const r = rng(20261020), pick = (a) => a[Math.floor(r() * a.length)];
    const day = (from, span) => new Date(Date.UTC(2025, 0, 1) + Math.floor(from + r() * span) * 864e5).toISOString().slice(0, 10);
    const CITIES = ['Köln', 'Köln', 'Köln', 'Berlin', 'Hamburg', 'München', 'Düsseldorf', 'Bonn', 'Frankfurt', 'Leipzig'];
    const A = ['Rhein', 'Dom', 'Veedel', 'Hafen', 'Brücke', 'Kranhaus', 'Südstadt', 'Ehrenfeld', 'Deutz', 'Severin', 'Agnes', 'Ring'];
    const B = ['Logistik', 'Daten', 'Werk', 'Studio', 'Küche', 'Pflege', 'Handel', 'Software', 'Bau', 'Medien'];
    const S = ['GmbH', 'AG', 'KG', 'Labs', '& Co'];
    const IND = ['Logistics', 'Software', 'Retail', 'Food service', 'Health', 'Construction', 'Media'];
    const TITLES = ['Backend Developer', 'PHP Developer', 'Frontend Developer', 'Barista', 'Warehouse Lead', 'Data Analyst', 'Store Manager', 'Nurse', 'Electrician', 'Product Designer', 'Bookkeeper', 'Driver', 'Line Cook', 'Recruiter', 'QA Engineer', 'Sales Assistant'];
    const FIRST = ['Ana', 'Ben', 'Cem', 'Dana', 'Elif', 'Finn', 'Gül', 'Hannah', 'Ilya', 'Jonas', 'Kaan', 'Lea', 'Mara', 'Noah', 'Olga', 'Paul', 'Rana', 'Sami', 'Tara', 'Yusuf'];
    const LAST = ['Kaya', 'Müller', 'Schmidt', 'Aliyev', 'Yılmaz', 'Wagner', 'Becker', 'Hoffmann', 'Novak', 'Rossi', 'Klein', 'Wolf'];
    const d = new SQL.Database();
    d.exec(`CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT, city TEXT, industry TEXT);
      CREATE TABLE jobs (id INTEGER PRIMARY KEY, company_id INTEGER, title TEXT, city TEXT, salary INTEGER, posted_at TEXT);
      CREATE TABLE applications (id INTEGER PRIMARY KEY, job_id INTEGER, candidate TEXT, status TEXT, applied_at TEXT);`);
    d.exec('BEGIN');
    let st = d.prepare('INSERT INTO companies VALUES (?, ?, ?, ?)');
    for (let i = 1; i <= 400; i++) st.run([i, `${pick(A)} ${pick(B)} ${pick(S)}`, pick(CITIES), pick(IND)]);
    st.free();
    st = d.prepare('INSERT INTO jobs VALUES (?, ?, ?, ?, ?, ?)');
    for (let i = 1; i <= 12000; i++) st.run([i, 1 + Math.floor(r() * 400), pick(TITLES), pick(CITIES), 28000 + Math.floor(r() * 60) * 1000, day(0, 658)]);
    st.free();
    st = d.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?)');
    for (let i = 1; i <= 80000; i++) {
      const x = r();
      st.run([i, 1 + Math.floor(r() * 12000), `${pick(FIRST)} ${pick(LAST)}`, x < 0.6 ? 'applied' : x < 0.8 ? 'shortlisted' : x < 0.9 ? 'interview' : x < 0.98 ? 'rejected' : 'hired', day(0, 658)]);
    }
    st.free();
    d.exec('COMMIT');
    return d;
  }
  function fresh() {
    db?.close();
    db = build();
    companyNames = new Set(db.exec('SELECT name FROM companies')[0].values.map((v) => v[0]));
    const c = timeIt(() => db.exec('SELECT COUNT(*) FROM applications WHERE job_id = 4711'));
    baseline.count = { ms: c.ms, n: c.out[0].values[0][0] };
    score[1] = {};
  }

  // ----- the stages -----
  function oldWay() {
    if (!ready) return;
    if (stage === 0) {
      const t = timeIt(() => {
        const jobs = db.exec("SELECT id, company_id FROM jobs WHERE city = 'Köln' ORDER BY posted_at DESC LIMIT 20")[0].values;
        const st = db.prepare('SELECT name FROM companies WHERE id = ?');
        jobs.forEach(([, cid]) => { st.bind([cid]); st.step(); st.get(); st.reset(); });
        st.free();
        return jobs.length;
      });
      score[0].old = { q: 21, ms: t.ms };
      showClock(t.ms + 21 * RTT_MS, '21 trips to the database');
      msg(`21 queries, so 21 trips to the database. Here the database sits in your browser; on a server every trip also costs about ${RTT_MS} ms of network, before any work happens.`);
    } else if (stage === 1) {
      score[1].old = { ms: baseline.count.ms };
      showClock(baseline.count.ms, 'no index');
      renderPlan([{ values: [[0, 0, 0, 'SCAN applications']] }]);
      msg(`Measured before any index existed: ${fmt(baseline.count.ms)} to count ${baseline.count.n} applications, reading all 80,000 rows.`);
    } else if (stage === 2) {
      const t = timeIt(() => {
        const rows = db.exec('SELECT * FROM applications')[0].values;
        const all = {}, hired = {};
        rows.forEach((row) => { const m = row[4].slice(0, 7); if (m < '2025-01' || m > '2025-12') return; all[m] = (all[m] || 0) + 1; if (row[3] === 'hired') hired[m] = (hired[m] || 0) + 1; });
        return rows.length;
      }, 3);
      score[2].old = { rows: t.out, ms: t.ms };
      showClock(t.ms, `${t.out.toLocaleString('en')} rows moved`);
      msg(`The loop pulled ${t.out.toLocaleString('en')} rows out of the database to produce 12 numbers.`);
    }
    renderScore();
  }

  const splitSql = (sql) => sql.split(';').map((x) => x.trim()).filter((x) => x.replace(/--[^\n]*/g, '').trim());
  const isRead = (s) => /^(select|with)\b/i.test(s.replace(/^(\s*--[^\n]*\n)+/, '').trim());

  function run() {
    if (!ready) return;
    const parts = splitSql($('sq-sql').value);
    if (!parts.length) { msg('Write a query first.'); return; }
    try {
      parts.slice(0, -1).forEach((p) => db.exec(p));
      const last = parts[parts.length - 1];
      const read = isRead(last);
      const { out, ms } = timeIt(() => db.exec(last), read ? 400 : 1);
      renderOut(out);
      renderPlan(read ? db.exec(`EXPLAIN QUERY PLAN ${last}`) : []);
      const res = out[out.length - 1];
      showClock(ms, `${parts.length} ${parts.length === 1 ? 'query' : 'statements'}`);
      check(parts, res, ms);
    } catch (e) {
      msg(`SQL error: ${e.message}`, 'bad');
    }
    renderScore();
  }

  function check(parts, res, ms) {
    const rows = res ? res.values : [];
    if (stage === 0) {
      const hasCompany = res && res.columns.some((_, ci) => rows.length && rows.every((r) => companyNames.has(r[ci])));
      if (parts.length === 1 && rows.length === 20 && hasCompany) { score[0].mine = { q: 1, ms }; showClock(ms + RTT_MS, '1 trip to the database'); win(0, `One trip instead of 21, company names included.${score[0].old ? ` About ${fmt(ms + RTT_MS)} instead of ${fmt(score[0].old.ms + 21 * RTT_MS)}, and the gap grows with every row on the page.` : ' Now run the old way to compare.'}`); }
      else if (rows.length === 20 && !hasCompany) msg('20 jobs, but no company names yet. JOIN the companies table.');
      else msg('Close. The goal: the same 20 Köln jobs with their company names, in one query.');
    } else if (stage === 1) {
      const plan = db.exec('EXPLAIN QUERY PLAN SELECT COUNT(*) FROM applications WHERE job_id = 4711')[0].values.map((v) => v[3]).join(' ');
      if (/INDEX/i.test(plan)) {
        const t = timeIt(() => db.exec('SELECT COUNT(*) FROM applications WHERE job_id = 4711'));
        score[1].mine = { ms: t.ms };
        showClock(t.ms, 'the count, with the index');
        win(1, `The count now uses an index: ${fmt(t.ms)} instead of ${fmt(baseline.count.ms)}, about ${Math.max(1, Math.round(baseline.count.ms / Math.max(t.ms, 0.001)))}× faster.`);
      } else msg('Still a SCAN. Create an index on the column the WHERE uses, then count again.');
    } else if (stage === 2) {
      const monthly = res && rows.length >= 1 && rows.length <= 12 && rows.every((r) => r.some((v) => /^2025-(0[1-9]|1[0-2])$/.test(String(v))));
      if (monthly && res.columns.length >= 2) { score[2].mine = { rows: rows.length, ms }; win(2, `${rows.length} rows came back instead of 80,000, in ${fmt(ms)}. The database did the counting.`); }
      else msg('Aim for one row per month of 2025: a month column, then the counts.');
    } else {
      msg(`${rows.length} row${rows.length === 1 ? '' : 's'} in ${fmt(ms)}.`);
    }
  }

  function win(i, text) {
    const first = !won[i];
    won[i] = true;
    document.querySelector(`#m-sql .sq-j[data-j="${i}"]`).classList.add('won');
    const all = won.every(Boolean);
    msg(`${first ? 'Stage won! ' : ''}${text}${all ? ' All three jerseys: that is the job, in miniature.' : ''}`, 'good');
  }

  // ----- rendering -----
  function showClock(ms, label) { $('sq-clock').innerHTML = `<b>${fmt(ms)}</b><small>${label}</small>`; }
  function renderOut(out) {
    const res = out[out.length - 1];
    if (!res) { $('sq-out').innerHTML = '<p class="sq-done">Done. No rows to show.</p>'; return; }
    const shown = res.values.slice(0, 8);
    $('sq-out').innerHTML = `<p class="sq-count">${res.values.length.toLocaleString('en')} row${res.values.length === 1 ? '' : 's'}${res.values.length > 8 ? ', first 8 shown' : ''}</p>
      <div class="sq-table"><table><thead><tr>${res.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${shown.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function renderPlan(plan) {
    const lines = plan.length ? plan[0].values.map((v) => v[3]) : [];
    $('sq-plan').innerHTML = lines.length ? `<b>Query plan</b>${lines.map((l) => `<span class="${/SCAN/.test(l) ? 'scan' : /INDEX|USING/.test(l) ? 'idx' : ''}">${esc(l)}</span>`).join('')}` : '';
  }
  function renderScore() {
    const s = score[stage];
    if (stage > 2) { $('sq-score').innerHTML = ''; return; }
    const cell = (x) => (!x ? '<i>–</i>' : stage === 0 ? `${x.q} trip${x.q === 1 ? '' : 's'} · ~${fmt(x.ms + x.q * RTT_MS)}` : stage === 1 ? fmt(x.ms) : `${x.rows.toLocaleString('en')} rows · ${fmt(x.ms)}`);
    $('sq-score').innerHTML = `<p><span>Old way</span>${cell(s.old)}</p><p><span>Yours</span>${cell(s.mine)}</p>${stage === 0 ? `<small>Measured here, plus about ${RTT_MS} ms per trip, as between an app and its database server.</small>` : ''}`;
  }
  function setStage(i) {
    stage = i;
    const st = STAGES[i];
    document.querySelectorAll('#m-sql [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.stage) === i)));
    $('sq-stage-h').textContent = st.name;
    $('sq-stage-p').innerHTML = `${st.brief}${st.task ? `<b>${st.task}</b>` : ''}`;
    $('sq-legacy').hidden = !st.legacy; $('sq-legacy').textContent = st.legacy;
    $('sq-old').hidden = i > 2; $('sq-line').hidden = !st.line;
    $('sq-sql').value = st.start;
    $('sq-out').innerHTML = ''; $('sq-plan').innerHTML = ''; $('sq-clock').textContent = '–';
    if (ready) msg(i === 3 ? 'Free ride: anything goes.' : 'Run the old way first, then beat it.');
    renderScore();
  }

  // ----- wiring -----
  $('m-sql').addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"][data-stage]');
    if (tab) setStage(Number(tab.dataset.stage));
  });
  $('sq-run').addEventListener('click', run);
  $('sq-old').addEventListener('click', oldWay);
  $('sq-line').addEventListener('click', () => { $('sq-sql').value = STAGES[stage].line; $('sq-sql').focus(); msg("Here's how I fixed it. Hit Run and watch the clock."); });
  $('sq-reset').addEventListener('click', () => { if (!ready) return; fresh(); setStage(stage); msg('Fresh database: 92,400 rows, no extra indexes.'); });
  $('sq-sql').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
  });
  $('sq-schema-p').textContent = SCHEMA;

  return {
    start() {
      setStage(stage);
      if (ready) return;
      $('sq-run').disabled = true;
      msg('Warming up the database: building 92,400 rows in your browser…');
      within(30000, loadEngine()).then(() => {
        const t = performance.now();
        fresh();
        ready = true;
        $('sq-run').disabled = false;
        msg(`Ready: 92,400 rows built in ${fmt(performance.now() - t)}. Run the old way first, then beat it.`);
      }).catch(() => {
        msg("The SQL engine couldn't load in this view. On anar.to it runs right in your browser.", 'bad');
      });
    },
    stop() {},
    focus: () => $('sq-h').focus({ preventScroll: true }),
  };
}
