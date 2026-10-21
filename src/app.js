(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  /* ---------- Toast ---------- */
  const toastEl = $('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  }

  /* ---------- Products ---------- */
  const cp = mountCuriplay();
  const fg = mountFocusGuard();
  const ex = typeof mountExpadu === 'function' ? mountExpadu() : null;
  const products = { cp, fg, ex };
  // Playable climbs on the route
  [['m-release', 'mountRelease'], ['m-rules', 'mountRules'], ['m-cp', 'mountCuriplayDesign'], ['m-ddd', 'mountDdd'], ['m-sql', 'mountSql']].forEach(([id, fn]) => {
    if (typeof window[fn] === 'function' && document.getElementById(id)) products[id] = window[fn]();
  });

  /* ---------- Dialogs ---------- */
  function openDialog(id, opener) {
    const d = $(id);
    if (!d) return;
    document.querySelectorAll('dialog[open]').forEach((o) => { if (o !== d) o.close(); });
    if (d.open) return;
    d._opener = opener && document.contains(opener) && !opener.closest('dialog') ? opener : d._opener || null;
    products[id]?.start?.();
    d.showModal();
    document.documentElement.classList.add('locked');
    d.scrollTop = 0;
    products[id]?.focus?.();
  }
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('close', () => {
      products[d.id]?.stop?.();
      if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('locked');
      if (d._opener && document.contains(d._opener) && !document.querySelector('dialog[open]')) d._opener.focus({ preventScroll: true });
    });
    d.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) d.close(); });
  });

  function showIssue(key, opener) {
    const z = ZINE[key];
    if (!z) return;
    $('zine-bar-no').textContent = z.no;
    $('zine-no').textContent = z.no;
    $('zine-h').textContent = z.title;
    $('zine-dek').textContent = z.dek;
    $('zine-byline').textContent = z.byline;
    $('zine-prose').innerHTML = z.html;
    $('zine-sources').innerHTML = `<b>Written from</b><ul>${z.sources.map((s) => `<li>${s}</li>`).join('')}</ul>`;
    const plug = $('zine-plug');
    plug.className = `plug ${z.plug.tone}`;
    plug.innerHTML = `<p class="kicker">${z.plug.kicker}</p><h3>${z.plug.title}</h3><p>${z.plug.text}</p>${z.plug.action === 'route'
      ? `<button type="button" class="arcade" data-goto="route">${z.plug.label}</button>`
      : `<button type="button" class="arcade${z.plug.action === 'cp' ? '' : ' pinkb'}" data-open="${z.plug.action}">${z.plug.label}</button>`}`;
    openDialog('reader', opener);
  }

  function gotoSection(id) {
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
    $(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      e.preventDefault();
      const tab = opener.closest('.tab');
      if (tab) { tab.classList.add('torn'); setTimeout(() => tab.classList.remove('torn'), 2400); }
      if (opener.dataset.topic) $('pc-topic').value = opener.dataset.topic;
      openDialog(opener.dataset.open, opener);
      if (opener.dataset.legal) {
        const anchor = $('legal').querySelector(`[data-legal-anchor="${opener.dataset.legal}"]`);
        requestAnimationFrame(() => anchor?.scrollIntoView({ block: 'start' }));
      }
      return;
    }
    const issue = e.target.closest('[data-issue], [data-open-issue]');
    if (issue) { showIssue(issue.dataset.issue || issue.dataset.openIssue, issue); return; }
    const go = e.target.closest('[data-goto]');
    if (go) { gotoSection(go.dataset.goto); return; }
    const copy = e.target.closest('[data-copy]');
    if (copy) { copyText($(copy.dataset.copy)?.textContent ?? '', copy); return; }
    const tab = e.target.closest('a.tab');
    if (tab) { tab.classList.add('torn'); setTimeout(() => tab.classList.remove('torn'), 2400); }
  });

  async function copyText(text, btn, done = 'Copied') {
    const label = btn.textContent;
    try { await navigator.clipboard.writeText(text); btn.textContent = done; }
    catch (err) { toast('Copying is blocked here. Select the text and copy it by hand.'); }
    setTimeout(() => { btn.textContent = label; }, 1600);
  }
  $('copy-json').addEventListener('click', (e) => copyText(cvJSON(), e.currentTarget));
  $('copy-json-2').addEventListener('click', (e) => copyText(cvJSON(), e.currentTarget));
  $('copy-cv-text').addEventListener('click', (e) => copyText(cvText(), e.currentTarget));

  /* ---------- Postcard: written here, sent from the visitor's own mail app (nothing is stored on the server) ---------- */
  $('postcard').addEventListener('submit', (e) => {
    e.preventDefault();
    const status = $('pc-status');
    const text = $('pc-msg').value.trim();
    if (!text) { status.textContent = 'Write a few words first.'; $('pc-msg').focus(); return; }
    const subject = `Postcard: ${$('pc-topic').value}`;
    location.href = `mailto:hi@anar.to?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    status.textContent = 'Your mail app should open with the postcard. Nothing opened? Write to hi@anar.to.';
  });

  /* ---------- Cover: stickers and the big button ---------- */
  // A sticker only starts dragging after a few pixels, so the bib still works as a link when tapped.
  document.querySelectorAll('.sticker').forEach((el) => {
    let pid = null, sx = 0, sy = 0, ox = 0, oy = 0, minX = 0, maxX = 0, moved = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      pid = e.pointerId; moved = false;
      sx = e.clientX; sy = e.clientY;
      ox = parseFloat(el.style.getPropertyValue('--dx')) || 0;
      oy = parseFloat(el.style.getPropertyValue('--dy')) || 0;
      const r = el.getBoundingClientRect();
      minX = ox - r.left + 8; maxX = ox + (document.documentElement.clientWidth - r.right) - 8;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      if (!moved) {
        if (Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
        moved = true;
        el.setPointerCapture(pid);
        el.classList.add('dragging');
      }
      el.style.setProperty('--dx', Math.min(maxX, Math.max(minX, ox + e.clientX - sx)) + 'px');
      el.style.setProperty('--dy', (oy + e.clientY - sy) + 'px');
    });
    const end = (e) => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('dragging'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // a drag must not count as a click on the sticker's link or button
    el.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  });
  $('press').addEventListener('click', () => {
    document.querySelectorAll('.poster').forEach((p) => {
      p.classList.remove('wiggle'); void p.offsetWidth; p.classList.add('wiggle');
      p.addEventListener('animationend', () => p.classList.remove('wiggle'), { once: true });
    });
    $('products').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });

  /* ---------- Masthead: leaves with the page as you scroll down; comes back only after a deliberate scroll up,
     at half your scroll speed, and settles with a soft ease ---------- */
  const head = document.querySelector('.masthead-z');
  const UP_FIRST = 140;   // px of upward scrolling before it starts to come back
  const UP_RATE = 0.45;   // it comes back at this fraction of your scroll speed
  let lastY = Math.max(0, scrollY), shift = 0, upRun = 0, settleTimer = 0;
  const setShift = (v, animate) => {
    shift = v;
    head.style.transition = animate && !reduced ? 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    head.style.transform = shift ? `translateY(${shift}px)` : '';
    head.classList.toggle('floating', lastY > head.offsetHeight && shift > -head.offsetHeight);
  };
  addEventListener('scroll', () => {
    const y = Math.max(0, scrollY), h = head.offsetHeight;
    const d = y - lastY;
    lastY = y;
    let next = shift;
    if (d > 0) { upRun = 0; next = shift - d; }                       // down: move away with the page
    else if (d < 0) {
      upRun -= d;
      if (upRun > UP_FIRST) next = shift - d * UP_RATE;               // up: only after a real scroll, and slower
    }
    next = Math.max(next, -y);                                        // near the top it is simply part of the page
    setShift(Math.min(0, Math.max(-h, next)), false);
    // when the scroll stops halfway, ease to the nearer end
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      const hh = head.offsetHeight;
      if (shift !== 0 && shift !== -hh && lastY >= hh) setShift(shift > -hh * 0.4 ? 0 : -hh, true);
    }, 180);
  }, { passive: true });
  // focusing a menu link with the keyboard always brings the masthead back
  head.addEventListener('focusin', () => setShift(0, true));

  /* ---------- Sections ---------- */
  mountRoute();
  mountLife();
  $('cv-sheet').innerHTML = cvPlainHTML();

  /* ---------- Deep links: #curiplay, #expadu, #focusguard, #cv, #issue-rules ---------- */
  const deep = { curiplay: 'cp', expadu: 'ex', focusguard: 'fg', cv: 'cvd', postcard: 'note' };
  const h = location.hash.slice(1);
  if (deep[h]) openDialog(deep[h]);
  else if (h.startsWith('issue-')) showIssue(h.slice(6));
})();
