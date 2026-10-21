/* Expadu: the "Follow the day" story from expadu.com. Scroll position picks the step; the CSS does the rest. */
function mountExpadu() {
  const d = document.getElementById('ex');
  const q = (s) => d.querySelector(s);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const story = q('.x-story'), pin = q('.x-pin'), street = q('.x-street'), join = q('.x-join');
  const caps = [...d.querySelectorAll('.x-cap')];
  const rail = [...d.querySelectorAll('.x-rail [data-ex-step]')];
  const fill = q('.x-track i'), fly = q('.tram-fly'), clock = q('.x-clock'), next = q('[data-ex-next] span');
  const tram = q('#x-tram-go');
  const STEPS = [
    { t: '13:10', l: 'Today', c: '#ffe363' },
    { t: '13:14', l: 'Travel', c: '#e0408f' },
    { t: '14:00', l: 'Paperwork', c: '#dccbff' },
    { t: '18:30', l: 'Events', c: '#ff7a3d' },
  ];
  const STREET = { t: '18:30', l: 'On the street', c: '#ff7a3d' };
  const FILL = ['6%', '37%', '68%', '100%'];
  let step = -1, clockKey = '', raf = 0, tripTimer = 0, tramTimer = 0;

  function setStep(n) {
    if (n === step) return;
    const prev = step;
    step = n;
    pin.dataset.step = n;
    caps.forEach((c, i) => { c.classList.toggle('on', i === n); c.classList.toggle('gone', i < n); });
    rail.forEach((b, i) => { if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    fill.style.width = FILL[n];
    next.textContent = n < 3 ? `Next: ${STEPS[n + 1].t} ${STEPS[n + 1].l}` : 'Step outside';
    clearTimeout(tripTimer);
    pin.classList.remove('scrolled');
    if (n === 1) {
      // Tram 4 flies from Today's "Leave now" row into the trip, then the trip scrolls to the platform.
      if (prev === 0 && !reduced) { fly.classList.remove('go'); void fly.offsetWidth; fly.classList.add('go'); }
      tripTimer = setTimeout(() => pin.classList.add('scrolled'), reduced ? 0 : 900);
    }
  }

  function setClock(s) {
    const key = s ? s.t + s.l : '';
    if (key === clockKey) return;
    clockKey = key;
    clock.dataset.show = s ? '1' : '0';
    if (!s) return;
    clock.querySelector('.t').textContent = s.t;
    clock.querySelector('.l').textContent = s.l;
    clock.querySelector('.dot').style.background = s.c;
  }

  function update() {
    if (!d.open) return;
    const vh = d.clientHeight, top = d.scrollTop, sTop = story.offsetTop;
    const p = Math.min(1, Math.max(0, (top - sTop) / Math.max(1, story.offsetHeight - vh)));
    setStep(p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : 3);
    if (top + vh * 0.8 >= join.offsetTop) setClock(null);
    else if (top + vh * 0.5 >= street.offsetTop) setClock(STREET);
    else if (top + vh * 0.5 >= sTop) setClock(STEPS[step]);
    else setClock(null);
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
  d.addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);

  const behavior = reduced ? 'auto' : 'smooth';
  function goStep(n) {
    const range = story.offsetHeight - d.clientHeight;
    d.scrollTo({ top: story.offsetTop + ((n + 0.5) / 4) * range, behavior });
  }
  d.addEventListener('click', (e) => {
    const s = e.target.closest('[data-ex-step]');
    if (s) { goStep(Number(s.dataset.exStep)); return; }
    if (e.target.closest('[data-ex-next]')) {
      if (step < 3) goStep(step + 1);
      else d.scrollTo({ top: street.offsetTop, behavior });
    }
  });

  function start() {
    step = -1;
    clockKey = '';
    setStep(0);
    setClock(null);
    clearTimeout(tramTimer);
    // The tram sets off along the route once the phone has landed.
    if (!reduced && tram && typeof tram.beginElement === 'function') {
      tramTimer = setTimeout(() => { try { tram.beginElement(); } catch (err) { /* SMIL unsupported: the tram stays parked */ } }, 1800);
    }
    requestAnimationFrame(update);
  }
  function stop() {
    clearTimeout(tramTimer);
    clearTimeout(tripTimer);
  }
  return { start, stop, focus: () => d.focus({ preventScroll: true }) };
}
