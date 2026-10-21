/* GitHub contribution snapshot, filled in by build.py from the GitHub API */
const GH = {{GH_CAL}};
/* ---------- The Route: the CV as a stage race (facts from Anar's CV, August 2026; no phone number) ---------- */
/* The facts live in src/cv-data.json: build.py fills them in here and prints the plain CV from them into the page */
const CV = {{CV}};

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nowYear = () => { const d = new Date(); return d.getFullYear() + d.getMonth() / 12 + d.getDate() / 365; };

function mountRoute() {
  const svg = document.getElementById('route-svg');
  const W = 1000, H = 360, padTop = 116, padBottom = 40, base = H - padBottom;
  const start = CV.stages[0].start;
  const finish = Math.max(nowYear(), 2026.65);
  const climbs = CV.stages.flatMap((s) => s.climbs).map((c) => ({ ...c, at: c.at === 'now' ? finish : c.at, summit: c.at === 'now' }));
  const tK = 2025.92; // start of stage 4, drawn wider
  const SHAPE = { HC: [560, 0.3], 1: [400, 0.22], 2: [280, 0.19], 3: [190, 0.16], 4: [120, 0.13] };
  const elev = (t) => {
    let e = 140 + ((t - start) / (finish - start)) * 620;
    climbs.forEach((c) => { const [h, w0] = SHAPE[c.cat]; const w = c.at >= tK ? w0 * 0.45 : w0; e += h * Math.exp(-((t - c.at) ** 2) / (2 * w * w)); });
    return e + 16 * Math.sin(t * 13.1 + 1.3) + 9 * Math.sin(t * 29.7 + 0.4) + 5 * Math.sin(t * 61.3 + 2.1);
  };
  // Newest first: stage 5 (not raced yet) on the left, today's summit, then back in time to the prologue on the right.
  const xT = 140, xK = 420, xS = 880; // x of today, of the start of stage 4, and of the start of stage 1
  const xOf = (t) => (t >= tK ? xT + ((finish - t) / (finish - tK)) * (xK - xT) : xK + ((tK - t) / (tK - start)) * (xS - xK));
  const samples = [];
  for (let i = 0; i < 200; i++) { const t = start + (i / 200) * (tK - start); samples.push({ t, e: elev(t) }); }
  for (let i = 0; i <= 120; i++) { const t = tK + (i / 120) * (finish - tK); samples.push({ t, e: elev(t) }); }
  const maxE = Math.max(...samples.map((p) => p.e)) * 1.04;
  const yOf = (e) => base - (e / maxE) * (base - padTop);
  const pts = samples.map((p) => [xOf(p.t), yOf(p.e), p.t]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${xT} ${base} L${xS} ${base} Z`;
  const hx = xT, hy = yOf(elev(finish));

  let out = '';
  // stage bands
  CV.stages.forEach((s) => {
    const a = xOf(s.end ?? finish), b = xOf(s.start);
    out += `<rect class="band" data-stage="${s.id}" x="${a.toFixed(1)}" y="0" width="${(b - a).toFixed(1)}" height="${base}"></rect>`;
  });
  out += `<defs><pattern id="hatch-next" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#FF48B0" stroke-width="2.4"></line></pattern></defs>`;
  out += `<rect class="band" data-stage="next" x="0" y="0" width="${xT}" height="${base}"></rect>`;
  out += `<path class="area" d="${area}"></path>`;
  // break + prologue, now at the far end
  const py = yOf(150), px = 925;
  const pro = `M${px} ${py} C${px + 25} ${py + 8} ${px + 50} ${py - 4} ${W} ${py + 6}`;
  out += `<path class="area" d="${pro} L${W} ${base} L${px} ${base} Z"></path><path class="pro" d="${pro}"></path>`;
  out += `<path class="pro" d="M${xS + 16} ${base - 2} L${xS + 22} ${base - 16} M${xS + 24} ${base - 2} L${xS + 30} ${base - 16}" stroke-width="2"></path>`;
  out += `<line class="base" x1="0" x2="${W}" y1="${base}" y2="${base}"></line>`;
  // dividers and labels at each stage's newer edge, moved down a row when they would collide
  const rowEnds = [];
  [{ label: 'Stage 5', team: 'Your team?', edge: 0 }, ...[...CV.stages].reverse().map((s) => ({ ...s, edge: xOf(s.end ?? finish) }))].forEach((s) => {
    const a = s.edge;
    const team = s.team.split(' → ').join(' · ');
    const width = Math.max(70, team.length * 9.5) + 16;
    let row = 0;
    while (row < rowEnds.length && a < rowEnds[row]) row++;
    rowEnds[row] = a + width;
    const y = 22 + row * 44;
    if (a > 0) out += `<line class="div" x1="${a.toFixed(1)}" x2="${a.toFixed(1)}" y1="${y - 12}" y2="${base}"></line>`;
    out += `<text class="l1" x="${(a + 8).toFixed(1)}" y="${y}">${esc(s.label.toUpperCase())}</text><text class="l2" x="${(a + 8).toFixed(1)}" y="${y + 19}">${esc(team)}</text>`;
  });
  out += `<path class="road" d="${line}"></path>`;
  // stage 5: a dashed road down from today's summit and up a climb nobody has categorised yet
  const fd = `M${hx} ${hy} C${hx - 28} ${hy + 8} ${hx - 40} ${hy + 72} ${hx - 66} ${hy + 78} S${hx - 104} ${hy + 18} ${hx - 118} ${hy + 8} S${hx - 134} ${hy + 40} 0 ${hy + 52}`;
  out += `<path class="area-next" d="${fd} L0 ${base} L${hx} ${base} Z"></path><path class="road-next" d="${fd}"></path>`;
  out += `<g class="badge q"><title>Stage 5: the next climb, yours to name</title><line x1="${hx - 118}" x2="${hx - 118}" y1="${hy - 6}" y2="${hy + 4}" stroke="#18171C" stroke-width="1.5"></line><rect x="${hx - 128}" y="${hy - 23}" width="20" height="18"></rect><text x="${hx - 118}" y="${hy - 9.5}" text-anchor="middle">?</text></g>`;
  // climbs
  climbs.filter((c) => !c.summit).forEach((c) => {
    const x = xOf(c.at), y = yOf(elev(c.at)) - 22, w = c.play ? 38 : c.cat === 'HC' ? 30 : 20;
    const title = `${c.cat === 'HC' ? 'Hors catégorie' : 'Category ' + c.cat} climb: ${c.name}${c.play ? '. Playable: ride it.' : ''}`;
    const attrs = c.play ? ` data-open="${c.play}" role="button" tabindex="0" aria-label="${esc(title)}"` : '';
    out += `<g class="badge${c.cat === 'HC' ? ' hc' : ''}${c.play ? ' play' : ''}"${attrs}><title>${esc(title)}</title><line x1="${x}" x2="${x}" y1="${y + 8}" y2="${y + 18}" stroke="#18171C" stroke-width="1.5"></line>${c.play ? `<rect class="halo" x="${x - w / 2 - 4}" y="${y - 13}" width="${w + 8}" height="26" rx="4"></rect>` : ''}<rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="18"></rect><text x="${x}" y="${y + 4.5}" text-anchor="middle">${c.cat}${c.play ? ' ▸' : ''}</text></g>`;
  });
  // sprints
  let flags = 0;
  CV.sprints.forEach((sp) => {
    const x = xOf(sp.at), y = yOf(elev(sp.at));
    const attrs = sp.open ? ` data-open="${sp.open}" role="button" tabindex="0" aria-label="${esc(`Side project ${sp.name}: ${sp.label.toLowerCase()}`)}"` : '';
    // playable side projects get a labelled flag below the road, so they can't be missed
    let flag = '';
    if (sp.open) {
      const lx = x + 24, ly = y + 48 + flags * 30, w = sp.name.length * 7.6 + 34;
      flag = `<line class="flag-l" x1="${x}" y1="${y + 8}" x2="${lx + 4}" y2="${ly - 8}"></line><rect class="flag-r" x="${lx}" y="${ly - 15}" width="${w.toFixed(1)}" height="22" rx="11"></rect><text class="flag-t" x="${lx + 12}" y="${ly + 0.5}">${esc(sp.name)} ▸</text>`;
      flags++;
    }
    out += `<g class="sprint-g${sp.open ? ' play' : ''}"${attrs}><title>${esc(`Side project: ${sp.name}`)}</title>${flag}<rect class="sprint" x="${x - 6.5}" y="${y - 6.5}" width="13" height="13" transform="rotate(45 ${x} ${y})"></rect></g>`;
  });
  // today
  out += `<circle class="here" cx="${hx}" cy="${hy}" r="8"></circle><text class="here-l" x="${hx - 10}" y="${hy - 22}" text-anchor="end">Summit · today</text>`;
  // years, newest on the left
  out += `<text class="tick" x="${hx / 2}" y="${base + 26}" text-anchor="middle">next</text>`;
  for (let y = Math.floor(finish); y >= Math.ceil(start); y--) out += `<text class="tick" x="${xOf(y).toFixed(1)}" y="${base + 26}" text-anchor="middle">${y}</text>`;
  out += `<text class="tick" x="${(px + W) / 2}" y="${base + 26}" text-anchor="middle">2011–16</text>`;
  // scrubber
  out += `<g class="scrub" id="route-scrub"><line x1="0" x2="0" y1="0" y2="${base}"></line><circle r="6" cx="0" cy="0"></circle><rect x="-74" y="0" width="148" height="40"></rect><text x="0" y="0" text-anchor="middle"></text><text x="0" y="0" text-anchor="middle"></text></g>`;
  svg.innerHTML = out;

  // start sheet
  const allClimbs = CV.stages.flatMap((s) => s.climbs);
  document.getElementById('start-sheet').innerHTML = [
    ['Next stage', 'Open', 'transfer window, see stage 5'], ['Today', 'Köln', 'Expadu and Curiplay, summit finish'], ['Climbs', `${allClimbs.length} · ${allClimbs.filter((c) => c.cat === 'HC').length} HC`, 'the hardest problems, categorised'],
    ['Own products', '3', 'Expadu, Curiplay, FocusGuard'], ['Racing', 'Since 2019', 'professional PHP'], ['Start', 'Baku', 'Khazar University, 2011'],
  ].map(([k, v, n]) => `<div><dt>${k}</dt><dd>${v}</dd><dd class="n">${n}</dd></div>`).join('');

  // tickets
  const months = (a, b) => { const m = Math.max(1, Math.round(((b ?? nowYear()) - a) * 12)); const y = Math.floor(m / 12), r = m % 12; return [y ? `${y} yr${y > 1 ? 's' : ''}` : '', r ? `${r} mo` : ''].filter(Boolean).join(' '); };
  const rot = ['0.6deg', '-0.4deg', '0.9deg', '-0.5deg', '-0.8deg', '0.5deg'];
  const nextCard = `
    <article class="tk tk-next" id="tk-next" data-stage-card="next" style="--rot:0.7deg">
      <span class="stub" aria-hidden="true">Stage 5</span>
      <div class="tb">
        <h3>Your team?</h3>
        <p class="role">Transfer window open</p>
        <p class="when">Not raced yet · the start depends on you</p>
        <p class="sum">Four stages in, I'm looking for the team I ride the next one with.</p>
        <ul>
          <li>Rider type: backend climber. PHP, Symfony, Laravel, Domain-Driven Design.</li>
          <li>Best on the hard climbs: legacy platforms, slow releases, code without tests.</li>
          <li>Three products built alone, so I'm used to owning it all, from the data model to production.</li>
        </ul>
        <div class="tk-actions"><button type="button" class="arcade" data-open="note" data-topic="A role">Sign me ▸</button></div>
      </div>
    </article>`;
  document.getElementById('tickets').innerHTML = nextCard + [...CV.stages].reverse().concat(CV.prologue).map((s, i) => `
    <article class="tk" id="tk-${s.id}" data-stage-card="${s.id}" style="--c:${s.color};--rot:${rot[i]}">
      <span class="stub" aria-hidden="true">${esc(s.label)}</span>
      <div class="tb">
        <h3>${esc(s.team)}</h3>
        <p class="role">${esc(s.role)}${s.note ? ` · ${esc(s.note)}` : ''}</p>
        <p class="when">${esc(s.dates)} · ${months(s.start, s.end)} · ${esc(s.place)}</p>
        <p class="sum">${esc(s.summary)}</p>
        ${s.climbs.length ? `<ul class="climbs-z">${[...s.climbs].reverse().map((c) => `<li class="cb${c.play ? ' play' : ''}"><i class="${c.cat === 'HC' ? 'hc' : ''}">${c.cat === 'HC' ? 'HC' : 'Cat ' + c.cat}</i><span>${esc(c.name)}</span>${c.play ? `<button type="button" class="ride" data-open="${c.play}">Ride it ▸</button>` : ''}</li>`).join('')}</ul>` : ''}
        ${s.highlights.length ? `<details class="notes"><summary>Race notes</summary><ul>${s.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></details>` : ''}
      </div>
    </article>`).join('');
  const offset = new Date(`${GH.from}T00:00:00Z`).getUTCDay();
  const level = (n) => (n === 0 ? 0 : n < 4 ? 1 : n < 10 ? 2 : n < 20 ? 3 : 4);
  const cells = GH.counts.map((n, i) => `<rect class="l${level(n)}" x="${Math.floor((i + offset) / 7) * 11}" y="${((i + offset) % 7) * 11}" width="9" height="9"><title>${n} on ${new Date(Date.parse(`${GH.from}T00:00:00Z`) + i * 864e5).toISOString().slice(0, 10)}</title></rect>`).join('');
  const weeks = Math.ceil((GH.counts.length + offset) / 7);
  const github = `
    <article class="sp gh">
      <div class="gh-top"><h4>GitHub</h4><a class="ride ghost" href="https://github.com/anarzone" target="_blank" rel="noopener">github.com/anarzone ↗</a></div>
      <p class="gh-n"><b>${GH.total.toLocaleString('en')}</b> contributions in the last year · <b>${GH.counts.filter(Boolean).length}</b> active days</p>
      <svg class="gh-cal" viewBox="0 0 ${weeks * 11 - 2} 75" role="img" aria-label="GitHub contribution calendar for the last year">${cells}</svg>
      <p class="gh-note">Snapshot from ${GH.date}, refreshed with every deploy.</p>
    </article>`;
  document.getElementById('sprints').innerHTML = `<h3 class="sprints-h">Side sprints <small>and the last year on GitHub</small></h3>` + CV.sprints.map((sp) => `
    <article class="sp${sp.open ? ' has-ride' : ''}">
      <i class="sp-dot" aria-hidden="true"></i>
      <div><h4>${esc(sp.name)}</h4><p>${esc(sp.what)}</p></div>
      ${sp.open ? `<button type="button" class="ride" data-open="${sp.open}">${esc(sp.label)} ▸</button>` : `<a class="ride ghost" href="${sp.href}" target="_blank" rel="noopener">${esc(sp.label)} ↗</a>`}
    </article>`).join('') + github;

  // jerseys
  const jersey = (kind) => {
    const fill = { yellow: '#FFE800', green: '#3AA45F', white: '#FFFFFF', polka: 'url(#polka-j)' }[kind];
    return `<svg viewBox="0 0 100 96" aria-hidden="true">${kind === 'polka' ? '<defs><pattern id="polka-j" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fff"></rect><circle cx="4" cy="4" r="3.2" fill="#E2233A"></circle><circle cx="12" cy="12" r="3.2" fill="#E2233A"></circle></pattern></defs>' : ''}<path d="M34 6 Q50 16 66 6 L84 13 L98 36 L84 45 L78 37 L78 92 Q50 96 22 92 L22 37 L16 45 L2 36 L16 13 Z" fill="${fill}" stroke="#18171C" stroke-width="3" stroke-linejoin="round"></path><path d="M34 6 Q50 18 66 6" fill="none" stroke="#18171C" stroke-width="3"></path></svg>`;
  };
  document.getElementById('jerseys').innerHTML = CV.jerseys.map((j) => `<article class="jz">${jersey(j.kind)}<h4>${j.name}</h4><p>${j.meaning}</p><ul>${j.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></article>`).join('');

  // interaction: scrub along the road, highlight the stage and its ticket
  const scrub = document.getElementById('route-scrub');
  const [sl, sc, sr, st1, st2] = scrub.children;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const nextRoad = svg.querySelector('.road-next');
  const nextLen = nextRoad.getTotalLength();
  const nextPts = Array.from({ length: 41 }, (_, i) => nextRoad.getPointAtLength((nextLen * i) / 40));
  const place = (x, y, a, b) => {
    sl.setAttribute('x1', x); sl.setAttribute('x2', x);
    sc.setAttribute('cx', x); sc.setAttribute('cy', y);
    const bx = Math.min(W - 78, Math.max(78, x)), by = Math.max(4, y - 60);
    sr.setAttribute('x', bx - 74); sr.setAttribute('y', by);
    st1.setAttribute('x', bx); st1.setAttribute('y', by + 17); st1.textContent = a;
    st2.setAttribute('x', bx); st2.setAttribute('y', by + 32); st2.textContent = b;
    scrub.classList.add('on');
  };
  let active = [];
  const setActive = (ids) => {
    if (ids.join() === active.join()) return;
    active = ids;
    svg.querySelectorAll('.band').forEach((b) => b.classList.toggle('on', ids.includes(b.dataset.stage)));
    document.querySelectorAll('[data-stage-card]').forEach((c) => c.classList.toggle('on', ids.includes(c.dataset.stageCard)));
  };
  svg.addEventListener('pointermove', (e) => {
    const ctm = svg.getScreenCTM(); if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    if (p.x > xS + 4) { scrub.classList.remove('on'); setActive([]); return; }
    if (p.x < xT - 2) {
      let near = nextPts[0];
      for (const q of nextPts) if (Math.abs(q.x - p.x) < Math.abs(near.x - p.x)) near = q;
      place(near.x, near.y, 'Next stage', 'Stage 5 · your team?');
      setActive(['next']);
      return;
    }
    let best = pts[0];
    for (const q of pts) if (Math.abs(q[0] - p.x) < Math.abs(best[0] - p.x)) best = q;
    const [x, y, t] = best;
    const on = CV.stages.filter((s) => t >= s.start && t <= (s.end ?? finish + 1));
    const label = on.length > 1 ? `Stage 4a + 4b · ${on.map((s) => s.team).join(' + ')}` : on.length ? `${on[0].label} · ${on[0].team.split(' → ').pop()}` : '';
    place(x, y, `${MON[Math.min(11, Math.floor((t % 1) * 12))]} ${Math.floor(t)}`, label);
    setActive(on.map((s) => s.id));
  });
  svg.addEventListener('pointerleave', () => { scrub.classList.remove('on'); setActive([]); });
  svg.addEventListener('click', (e) => {
    if (e.target.closest('[data-open]')) return;
    if (active.length) document.getElementById(`tk-${active[0]}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  svg.addEventListener('keydown', (e) => {
    const g = e.target.closest('[data-open]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });
  document.querySelectorAll('[data-stage-card]').forEach((c) => {
    c.addEventListener('pointerenter', () => setActive([c.dataset.stageCard]));
    c.addEventListener('pointerleave', () => setActive([]));
  });
}

function cvJSON() {
  const iso = { talents: ['2021-12', '2022-10'], plusforta: ['2022-10', '2025-12'], expadu: ['2025-12', undefined], curiplay: ['2026-03', undefined] };
  const work = [...CV.stages].filter((s) => s.id !== 'baku').reverse().map((s) => ({ name: s.note ? `${s.team} (${s.note})` : s.team, position: s.role, location: s.place, startDate: iso[s.id][0], endDate: iso[s.id][1], summary: s.summary, highlights: s.highlights }))
    .concat(CV.earlier.map((r) => { const [a, b] = r.dates.split(' – '); return { name: r.team, position: r.role, location: r.place, startDate: a, endDate: b }; }));
  return JSON.stringify({
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: { name: 'Anar Hagverdiyev', label: 'Senior Backend Engineer', email: 'hi@anar.to', url: 'https://anar.to', summary: CV.profile, location: { city: 'Köln', countryCode: 'DE' },
      profiles: [{ network: 'GitHub', url: 'https://github.com/anarzone' }, { network: 'LinkedIn', url: 'https://www.linkedin.com/in/haqverdiyev' }] },
    work, education: [{ institution: 'Khazar University', area: 'Computer Science', studyType: 'BSc', startDate: '2011', endDate: '2016' }],
    skills: CV.skills.map(([name, k]) => ({ name, keywords: k.split(/,\s*(?![^()]*\))/) })), languages: CV.languages.map(([language, fluency]) => ({ language, fluency })),
  }, null, 2);
}

function cvText() {
  const roles = [...CV.stages].filter((s) => s.id !== 'baku').reverse();
  return ['Anar Hagverdiyev', 'Senior Backend Engineer · PHP | Symfony | Laravel | Domain-Driven Design', 'Köln, Germany · hi@anar.to · anar.to · github.com/anarzone · linkedin.com/in/haqverdiyev', '',
    'PROFILE', CV.profile, '', 'EXPERIENCE',
    ...roles.flatMap((r) => [`${r.team}${r.note ? ` (${r.note})` : ''} · ${r.role} · ${r.dates} · ${r.place}`, ...r.highlights.map((h) => `- ${h}`), '']),
    'EARLIER EXPERIENCE', ...CV.earlier.map((r) => `${r.team} · ${r.role} · ${r.dates} · ${r.place}`), ...CV.stages[0].highlights.map((h) => `- ${h}`), '',
    'TECHNICAL SKILLS', ...CV.skills.map(([k, v]) => `${k}: ${v}`), '', 'LANGUAGES', CV.languages.map(([l, v]) => `${l} (${v})`).join(' · '), '',
    'EDUCATION', 'Khazar University · BSc Computer Science · 2011 – 2016 · Baku'].join('\n');
}

/* ---------- Life: example rides (clearly marked; real rides replace them at publish time) ---------- */
const RIDES = [
  { name: 'Rhine loop', where: 'Köln → Bonn → Köln', km: 62, up: 180, shape: [[0.5, 0.18, 0.12]] },
  { name: 'Bergisches Land', where: 'Hills east of Köln', km: 74, up: 980, shape: [[0.18, 0.08, 0.6], [0.42, 0.07, 0.85], [0.66, 0.09, 0.7], [0.86, 0.06, 0.5]] },
  { name: 'After-work spin', where: 'Ring roads and the Rhine', km: 24, up: 60, shape: [[0.3, 0.1, 0.08], [0.7, 0.12, 0.1]] },
];
function mountLife() {
  const chart = document.getElementById('ride-chart');
  if (!chart) return; // the ride log is switched off until real rides are in
  const list = document.getElementById('ride-list');
  const stats = document.getElementById('ride-stats');
  let sel = 1;
  const draw = () => {
    const r = RIDES[sel];
    const W = 600, H = 170, b = 140, n = 120;
    const ys = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      let e = 0.08 + 0.02 * Math.sin(u * 31 + sel) + 0.015 * Math.sin(u * 73 + 2 * sel);
      r.shape.forEach(([c, w, h]) => { e += h * Math.exp(-((u - c) ** 2) / (2 * w * w)); });
      ys.push(e);
    }
    const max = Math.max(...ys, 1);
    const pts = ys.map((e, i) => [(i / n) * W, b - (e / max) * (b - 18)]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    let ticks = '';
    for (let k = 0; k <= 4; k++) ticks += `<text class="rtick" x="${Math.min(W - 18, Math.max(12, (k / 4) * W))}" y="${H - 6}" text-anchor="middle">${Math.round((k / 4) * r.km)} km</text>`;
    chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Elevation profile of the example ride ${esc(r.name)}"><path class="rarea" d="${line} L${W} ${b} L0 ${b} Z"></path><path class="rline" d="${line}"></path>${ticks}</svg>`;
    stats.innerHTML = `<div><dt>Distance</dt><dd>${r.km} km</dd></div><div><dt>Climbed</dt><dd>${r.up.toLocaleString('en')} m</dd></div><div><dt>Where</dt><dd style="font-size:1.05rem;line-height:1.05">${esc(r.where)}</dd></div>`;
    list.querySelectorAll('.ride-btn').forEach((btn, i) => btn.setAttribute('aria-pressed', String(i === sel)));
  };
  list.innerHTML = RIDES.map((r, i) => `<li><button type="button" class="ride-btn" data-ride="${i}" aria-pressed="false"><b>${esc(r.name)}</b><span>${r.km} km · ↑ ${r.up} m</span><span style="grid-column:1/-1">Example ride · ${esc(r.where)}</span></button></li>`).join('');
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-ride]'); if (b) { sel = Number(b.dataset.ride); draw(); } });
  draw();
}
