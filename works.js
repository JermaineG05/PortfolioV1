/* Works page: graphic design lightbox (click to enlarge, arrow keys to browse, Esc to close). */
(function () {
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.design__open'));
  var box = document.getElementById('lightbox');
  if (!tiles.length || !box) return;
  var img = document.getElementById('lb-img'), cap = document.getElementById('lb-cap');
  var current = 0, lastFocus = null;

  function show(i) {
    current = (i + tiles.length) % tiles.length;
    var t = tiles[current], src = t.querySelector('img');
    box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap');
    img.src = src.src; img.alt = src.alt;
    cap.textContent = t.querySelector('.design__title').textContent + ' \u00b7 ' + t.querySelector('.design__tag').textContent;
  }
  function open(i) {
    lastFocus = document.activeElement;
    box.hidden = false;
    document.documentElement.classList.add('lb-open');
    show(i);
    requestAnimationFrame(function () { box.classList.add('open'); box.querySelector('.lb__close').focus(); });
  }
  function close() {
    box.classList.remove('open');
    setTimeout(function () {
      box.hidden = true;
      document.documentElement.classList.remove('lb-open');
      if (lastFocus) lastFocus.focus();
    }, 320);
  }

  tiles.forEach(function (t, i) { t.addEventListener('click', function () { open(i); }); });
  box.querySelector('.lb__close').addEventListener('click', close);
  box.querySelector('.lb__prev').addEventListener('click', function () { show(current - 1); });
  box.querySelector('.lb__next').addEventListener('click', function () { show(current + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(current - 1);
    else if (e.key === 'ArrowRight') show(current + 1);
  });
})();

/* Before / after sliders (Excel + Calendar sections) */
(function () {
  Array.prototype.forEach.call(document.querySelectorAll('.compare'), function (box) {
    var range = box.querySelector('.compare__range');
    var touched = false, played = false;

    function set(v) { box.style.setProperty('--pos', v + '%'); }
    function interact() { touched = true; box.classList.remove('hint'); }
    range.addEventListener('input', function () { interact(); set(range.value); });
    range.addEventListener('pointerdown', interact);
    range.addEventListener('keydown', interact);

    // when it scrolls into view, sweep once from "before" to the middle so people see what it does
    function sweep() {
      if (played) return; played = true;
      var from = 100, to = 50, dur = 1700, t0 = null;
      function step(t) {
        if (touched) return;
        if (t0 === null) t0 = t;
        var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        var v = from + (to - from) * e;
        set(v); range.value = v;
        if (p < 1) requestAnimationFrame(step);
      }
      setTimeout(function () { requestAnimationFrame(step); }, 500);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { sweep(); io.disconnect(); }
      }, { threshold: 0.45 });
      io.observe(box);
    } else { set(50); range.value = 50; }
  });
})();

/* App artwork: tilts toward the pointer */
(function () {
  var art = document.getElementById('appart');
  if (!art || !window.matchMedia('(hover:hover)').matches) return;
  var bg = art.querySelector('.appart__bg'), icon = art.querySelector('.appart__icon');
  art.addEventListener('pointermove', function (e) {
    var r = art.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    art.style.transform = 'perspective(900px) rotateY(' + (x * 14) + 'deg) rotateX(' + (-y * 14) + 'deg)';
    icon.style.translate = (x * 18) + 'px ' + (y * 18) + 'px';
    bg.style.translate = (x * -12) + 'px ' + (y * -12) + 'px';
  });
  art.addEventListener('pointerleave', function () {
    art.style.transform = ''; icon.style.translate = ''; bg.style.translate = '';
  });
})();

/* Video player: poster + play button, then normal controls */
(function () {
  var video = document.getElementById('player-video'), btn = document.getElementById('player-play');
  if (!video || !btn) return;
  var frame = video.parentElement;
  function start() {
    frame.classList.remove('idle');
    frame.classList.add('playing');
    video.controls = true;
    var p = video.play(); if (p && p.catch) p.catch(function () {});
  }
  btn.addEventListener('click', start);
  video.addEventListener('ended', function () {
    video.controls = false; frame.classList.remove('playing');
    btn.querySelector('.player__label').textContent = 'Watch again \u00b7 2:28';
    video.currentTime = 0;
  });
  // pause when scrolled far out of view so it doesn't play unseen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { if (!en[0].isIntersecting && !video.paused) video.pause(); }, { threshold: 0.05 }).observe(frame);
  }
})();
