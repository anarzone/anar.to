/* ---------- Machine: Expadu's rules engine, ported faithfully in miniature.
   Same model as app/Profile/Applicability.php: a rule is OR-ed groups of AND-ed conditions; a null fact makes a
   group Unknown, never false; every rule is evaluated on its own (no chaining). Unknown rules become questions,
   and a rule that misses on exactly one non-branch fact shows as "Not open to you yet". ---------- */
function mountRules() {
  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FACTS = [
    { key: 'citizenship_group', q: 'Are you an EU / EEA / Swiss citizen?', opts: [['eu', 'Yes'], ['non_eu', 'No']] },
    { key: 'purpose', q: 'What brings you to Cologne?', opts: [['employment', 'I have a job here'], ['study', "I'm studying"], ['family', "I'm joining family"]] },
    { key: 'permit_track', q: 'Which permit are you going for?', opts: [['blue_card', 'EU Blue Card'], ['standard', 'Standard work permit']] },
    { key: 'entry_mode', q: 'How did you enter Germany?', opts: [['d_visa', 'A national D visa'], ['visa_free', 'Nothing yet: I entered visa-free']] },
    { key: 'sponsor', q: 'Who are you joining?', opts: [['german', 'A German citizen'], ['blue_card', 'A Blue Card holder']] },
    { key: 'german_level', q: 'Your German, with a certificate?', opts: [['none', 'None yet'], ['a1', 'A1'], ['b1', 'B1 or higher']] },
  ];
  const BRANCH = ['citizenship_group', 'purpose', 'permit_track'];
  const WORDS = {
    citizenship_group: { eu: 'EU citizen', non_eu: 'non-EU citizen' },
    purpose: { employment: 'employee', study: 'student', family: 'joining family' },
    permit_track: { blue_card: 'Blue Card path', standard: 'standard work permit' },
    entry_mode: { d_visa: 'D visa', visa_free: 'entered visa-free' },
    sponsor: { german: 'joining a German citizen', blue_card: 'joining a Blue Card holder' },
    german_level: { none: 'no German certificate yet', a1: 'A1 German', b1: 'B1 German' },
  };
  const NONEU_JOB = { citizenship_group: 'non_eu', purpose: 'employment' };
  const PRESENT = { present: true };
  const permitWindow = (f) => (f.entry_mode === 'visa_free' ? 'Within 90 days of arrival' : 'Before your D visa expires');
  const RULES = [
    { key: 'core.anmeldung', title: 'Register your address (Anmeldung)', phase: 'now', when: () => 'Within 14 days of moving in · free', groups: [{}] },
    { key: 'core.health_insurance', title: 'Get health insurance', phase: 'now', when: () => 'Within 30 days · students before enrolling', groups: [{}] },
    { key: 'core.steuer_id', type: 'wait', title: 'Your tax ID arrives by post', phase: 'wait', after: ['core.anmeldung'], when: () => 'Sent to your registered address', groups: [{}] },
    { key: 'core.bank_account', title: 'Open a bank account', phase: 'next', when: () => 'Within 30 days', groups: [{}] },
    { key: 'core.rundfunkbeitrag', title: 'Register for the broadcasting fee', phase: 'later', when: () => '€18.36 a month · within 60 days', groups: [{}] },
    { key: 'eue.no_permit', title: 'No residence permit needed', phase: 'info', when: () => 'Your Anmeldung is enough', groups: [{ citizenship_group: 'eu' }] },
    { key: 'bc.submit_application', title: 'Submit your Blue Card application, today', phase: 'now', when: permitWindow,
      note: () => 'Salary from €50,700 a year (€45,934.20 for shortage jobs, recent graduates and IT). Contract of 6 months or more.',
      groups: [{ ...NONEU_JOB, permit_track: 'blue_card', entry_mode: PRESENT }] },
    { key: 'bc.blue_card', title: 'Attend your Blue Card appointment with the originals', phase: 'wait', after: ['bc.submit_application', 'core.health_insurance'], when: () => 'First issue €100',
      groups: [{ ...NONEU_JOB, permit_track: 'blue_card' }] },
    { key: 'bc.settlement.track_21_months', title: 'Track your 21 months to permanent residence', phase: 'later', when: () => 'With B1 German · not yet eligible',
      groups: [{ ...NONEU_JOB, permit_track: 'blue_card', german_level: 'b1' }] },
    { key: 'bc.settlement.track_27_months', title: 'Track your 27 months to permanent residence', phase: 'later', when: () => 'With A1 German · not yet eligible',
      groups: [{ ...NONEU_JOB, permit_track: 'blue_card', german_level: { in: ['a1', 'b1'] } }] },
    { key: 'nee.submit_application', title: 'Submit your residence-permit application', phase: 'now', when: permitWindow,
      note: (f) => (f.entry_mode === 'visa_free' ? "Entered visa-free? Don't start working yet." : 'Your employer fills in the job description form.'),
      groups: [{ ...NONEU_JOB, permit_track: 'standard', entry_mode: PRESENT }] },
    { key: 'nee.residence_permit', title: 'Attend your residence-permit appointment', phase: 'wait', after: ['nee.submit_application', 'core.health_insurance'], when: () => 'The card arrives in 4–8 weeks',
      groups: [{ ...NONEU_JOB, permit_track: 'standard' }] },
    { key: 'stu.enrolment', title: 'Enrol at your university', phase: 'now', when: () => 'Within 30 days · semester fee about €300', groups: [{ purpose: 'study' }] },
    { key: 'stu.submit_application', title: 'Submit your student residence application', phase: 'now', when: permitWindow,
      note: () => 'Blocked account (Sperrkonto): €11,904 for 2025/26.', groups: [{ citizenship_group: 'non_eu', purpose: 'study', entry_mode: PRESENT }] },
    { key: 'stu.residence_permit', title: 'Attend your student-permit appointment', phase: 'wait', after: ['stu.submit_application', 'stu.enrolment'], when: () => 'Up to 140 full working days a year',
      groups: [{ citizenship_group: 'non_eu', purpose: 'study' }] },
    { key: 'fam.a1_certificate', title: 'Get an A1 German certificate', phase: 'now', when: () => 'Goethe, TestDaF or telc only · spouses of Blue Card holders are exempt',
      groups: [{ citizenship_group: 'non_eu', purpose: 'family', sponsor: 'german', german_level: 'none' }] },
    { key: 'fam.submit_application', title: 'Submit your family-reunification application', phase: 'now', when: permitWindow, note: () => '€100 per adult, €50 under 18.',
      groups: [{ citizenship_group: 'non_eu', purpose: 'family', sponsor: PRESENT, entry_mode: PRESENT }] },
    { key: 'fam.residence_permit', title: 'Attend the family-permit appointment for each of you', phase: 'wait', after: ['fam.submit_application'], when: () => 'Renewals €93',
      groups: [{ citizenship_group: 'non_eu', purpose: 'family' }] },
  ];
  const CASES = {
    blank: {},
    eu: { citizenship_group: 'eu', purpose: 'employment' },
    bc: { citizenship_group: 'non_eu', purpose: 'employment', permit_track: 'blue_card', entry_mode: 'd_visa' },
    stu: { citizenship_group: 'non_eu', purpose: 'study', entry_mode: 'visa_free' },
    fam: { citizenship_group: 'non_eu', purpose: 'family', sponsor: 'german', entry_mode: 'd_visa', german_level: 'none' },
  };
  const SHORT = { 'core.anmeldung': 'Anmeldung', 'core.health_insurance': 'health insurance', 'stu.enrolment': 'enrolment' };
  const shortOf = (k) => SHORT[k] || 'your application';

  // ----- the evaluator (Applicability::evaluate) -----
  const test = (cond, v) => (cond && typeof cond === 'object' ? (cond.present ? v != null : cond.in.includes(v)) : v === cond);
  const condState = (k, cond, f) => (f[k] == null ? '?' : test(cond, f[k]) ? 'yes' : 'no');
  function evalGroup(g, f) {
    let unknown = false;
    for (const [k, c] of Object.entries(g)) {
      const s = condState(k, c, f);
      if (s === 'no') return 'no';
      if (s === '?') unknown = true;
    }
    return unknown ? '?' : 'yes';
  }
  function evaluate(rule, f) {
    let unknown = false;
    for (const g of rule.groups) {
      const v = evalGroup(g, f);
      if (v === 'yes') return 'yes';
      if (v === '?') unknown = true;
    }
    return unknown ? '?' : 'no';
  }
  // exactly one answered, non-branch condition fails and every branch condition holds
  function nearMiss(rule, f) {
    if (rule.phase !== 'later' && rule.phase !== 'info') return null;
    for (const g of rule.groups) {
      const fails = Object.entries(g).filter(([k, c]) => condState(k, c, f) === 'no');
      const unknown = Object.entries(g).some(([k, c]) => condState(k, c, f) === '?');
      if (!unknown && fails.length === 1 && !BRANCH.includes(fails[0][0])) return fails[0];
    }
    return null;
  }
  const why = (rule, f) => {
    const g = rule.groups.find((x) => evalGroup(x, f) === 'yes') || {};
    const words = Object.keys(g).map((k) => WORDS[k]?.[f[k]]).filter(Boolean);
    return words.length ? words.join(' · ') : 'everyone who moves to Cologne';
  };

  let facts = {}, selected = 'bc.submit_application', sweep = [];

  function render(animate) {
    const verdicts = Object.fromEntries(RULES.map((r) => [r.key, evaluate(r, facts)]));
    const counts = { yes: 0, no: 0, '?': 0 };
    Object.values(verdicts).forEach((v) => { counts[v]++; });
    $('mx-yes').textContent = counts.yes; $('mx-no').textContent = counts.no; $('mx-unk').textContent = counts['?'];
    $('mx-tally-l').textContent = `of ${RULES.length} rules, each checked on its own`;

    // facts the engine still needs, in priority order
    const needed = new Map();
    RULES.forEach((r) => {
      if (verdicts[r.key] !== '?') return;
      r.groups.forEach((g) => { if (evalGroup(g, facts) === '?') Object.keys(g).forEach((k) => { if (facts[k] == null) needed.set(k, (needed.get(k) || 0) + 1); }); });
    });
    $('mx-facts').innerHTML = FACTS.filter((fd) => facts[fd.key] != null || needed.has(fd.key)).map((fd) => `
      <div class="fact${facts[fd.key] == null ? ' needed' : ''}">
        <p class="fq">${fd.q}${facts[fd.key] == null ? `<span class="need">needed by ${needed.get(fd.key)} rule${needed.get(fd.key) > 1 ? 's' : ''}</span>` : ''}</p>
        <div class="chips">${fd.opts.map(([v, label]) => `<button type="button" class="chip" data-fact="${fd.key}" data-val="${v}" aria-pressed="${facts[fd.key] === v}">${label}</button>`).join('')}${facts[fd.key] != null ? `<button type="button" class="chip unsure" data-fact="${fd.key}" data-val="" aria-label="Forget this answer">?</button>` : ''}</div>
      </div>`).join('') || '<p class="stage-empty">The engine has everything it needs.</p>';

    // the plan, in Expadu's sections
    const SECTIONS = [['now', 'Do now'], ['wait', 'Waiting for something'], ['next', 'Next'], ['later', 'Coming up'], ['info', 'Good to know']];
    const yes = RULES.filter((r) => verdicts[r.key] === 'yes');
    let html = SECTIONS.map(([phase, label]) => {
      const items = yes.filter((r) => r.phase === phase);
      if (!items.length) return '';
      return `<div class="sec"><h4>${label}</h4><ul>${items.map((r) => `<li><b>${r.title}</b><span class="when">${r.when(facts)}${r.after ? ` · after ${r.after.map(shortOf).join(' and ')}` : ''}</span>${r.note ? `<span class="note">${r.note(facts)}</span>` : ''}<span class="why">Why you see this: ${why(r, facts)}</span></li>`).join('')}</ul></div>`;
    }).join('');
    if (needed.size) html += `<div class="sec ask"><h4>Information we still need</h4><ul>${[...needed.keys()].map((k) => `<li><b>${FACTS.find((x) => x.key === k).q}</b><span class="when">Answer it under Your facts</span></li>`).join('')}</ul></div>`;
    const misses = RULES.filter((r) => verdicts[r.key] === 'no').map((r) => [r, nearMiss(r, facts)]).filter(([, m]) => m);
    if (misses.length) html += `<div class="sec miss"><h4>Not open to you yet</h4><ul>${misses.map(([r, [k, c]]) => `<li><b>${r.title}</b><span class="when">Opens when your German is ${String(typeof c === 'object' ? c.in[0] : c).toUpperCase()}. Not a decision about your case.</span></li>`).join('')}</ul></div>`;
    $('mx-plan').innerHTML = html;

    // the rules, each with its verdict and condition marks
    $('mx-rules').innerHTML = RULES.map((r, i) => {
      const v = verdicts[r.key];
      const conds = Object.entries(r.groups[0]);
      return `<li class="rl v-${v === '?' ? 'q' : v}${r.key === selected ? ' sel' : ''}" style="--i:${i}"><button type="button" data-rule="${r.key}" aria-pressed="${r.key === selected}">
        <span class="verdict">${v === '?' ? '?' : v.toUpperCase()}</span><code>${r.key}</code>
        <span class="conds">${conds.length ? conds.map(([k, c]) => `<i class="c-${condState(k, c, facts) === '?' ? 'q' : condState(k, c, facts)}">${k.replace('_group', '')}</i>`).join('') : '<i class="c-yes">everyone</i>'}</span></button></li>`;
    }).join('');
    if (animate && !reduced) {
      sweep.forEach(clearTimeout); sweep = [];
      $('mx-rules').classList.add('sweeping');
      sweep.push(setTimeout(() => $('mx-rules').classList.remove('sweeping'), RULES.length * 35 + 400));
    }
    renderYaml(verdicts);
  }

  function renderYaml(verdicts) {
    const r = RULES.find((x) => x.key === selected);
    const mark = { yes: '✓', no: '✗', '?': '?  not asked yet' };
    const val = (c) => (typeof c !== 'object' ? c : c.present ? '{present: true}' : `{in: [${c.in.join(', ')}]}`);
    const lines = [`- key: ${r.key}`, `  type: ${r.type || (r.phase === 'info' || r.phase === 'later' ? 'info' : 'task')}`,
      `  phase: ${{ now: 'first_30_days', wait: 'settling', next: 'settling', later: 'ongoing', info: 'options' }[r.phase]}`];
    const g = r.groups[0];
    if (!Object.keys(g).length) lines.push('  applies_if: {}            # everyone');
    else { lines.push('  applies_if:'); Object.entries(g).forEach(([k, c]) => lines.push(`    ${`${k}: ${val(c)}`.padEnd(34)}# ${mark[condState(k, c, facts)]}`)); }
    if (r.after) lines.push(`  depends_on: [${r.after.join(', ')}]`);
    lines.push('', `→ ${verdicts[r.key] === 'yes' ? 'YES: on your plan' : verdicts[r.key] === 'no' ? 'NO: not for you' : 'UNKNOWN: becomes a question'}`);
    $('mx-yaml').textContent = lines.join('\n');
  }

  $('m-rules').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-fact]');
    if (chip) {
      const k = chip.dataset.fact, v = chip.dataset.val;
      if (!v || facts[k] === v) delete facts[k]; else facts[k] = v;
      render(true);
      return;
    }
    const c = e.target.closest('[data-case]');
    if (c) { facts = { ...CASES[c.dataset.case] }; render(true); return; }
    const rl = e.target.closest('[data-rule]');
    if (rl) { selected = rl.dataset.rule; render(false); }
  });

  return {
    start() { facts = {}; selected = 'bc.submit_application'; render(false); },
    stop() { sweep.forEach(clearTimeout); sweep = []; },
    focus: () => $('mx-h').focus({ preventScroll: true }),
  };
}
