/* Navigation: layered links (regular + bold), click animation, and the first-visit letter intro. */
(function () {
  'use strict';
  var nav = document.querySelector('.nav');
  if (!nav) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
  var doc = document.documentElement;

  // Which tab were we on before this page? (set when a nav link is clicked)
  var from = -1;
  try {
    var f = sessionStorage.getItem('navFrom');
    if (f !== null) { from = parseInt(f, 10); sessionStorage.removeItem('navFrom'); }
  } catch (e) {}
  var current = links.findIndex(function (a) { return a.getAttribute('aria-current') === 'page'; });
  var animate = from >= 0 && from < links.length && from !== current && current >= 0;

  var intro = doc.classList.contains('nav-intro') && !animate;
  if (animate) doc.classList.remove('nav-intro');
  var n = 0;

  function fill(layer, text, split, startIndex) {
    if (!split) { layer.textContent = text; return; }
    for (var i = 0; i < text.length; i++) {
      var sp = document.createElement('span');
      sp.className = 'ch';
      sp.textContent = text[i];
      sp.style.animationDelay = (0.15 + (startIndex + i) * 0.06) + 's';
      layer.appendChild(sp);
    }
  }

  // The nav markup is already in the HTML (so it never changes size after loading).
  // When arriving from another tab, start with that previous tab shown as active.
  doc.removeAttribute('data-from');
  links.forEach(function (a, idx) {
    var active = animate ? idx === from : a.getAttribute('aria-current') === 'page';
    a.classList.toggle('is-active', active);
    if (intro) {
      var text = a.getAttribute('aria-label');
      var base = a.querySelector('.base'), bold = a.querySelector('.bold');
      base.textContent = ''; bold.textContent = '';
      fill(base, text, true, n);
      fill(bold, text, true, n);
      n += text.length;
    }
  });
  doc.classList.add('nav-split');

  // After the letter-by-letter intro, put the plain text back so the nav is pixel-identical to every other page.
  if (intro) {
    setTimeout(function () {
      links.forEach(function (a) {
        var t = a.getAttribute('aria-label');
        a.querySelector('.base').textContent = t;
        a.querySelector('.bold').textContent = t;
      });
    }, (0.15 + n * 0.06 + 0.5) * 1000 + 150);
  }

  if (intro) { try { sessionStorage.setItem('navIntroDone', '1'); } catch (e) {} }

  // Remember the current tab, then navigate straight away; the animation plays on the next page.
  nav.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a || e.button !== 0) return;
    var idx = links.indexOf(a);
    var cur = links.findIndex(function (x) { return x.getAttribute('aria-current') === 'page'; });
    if (idx < 0 || idx === cur) return;
    try { sessionStorage.setItem('navFrom', String(cur)); } catch (err) {}
  });

  if (animate) {
    var run = function () {
      var prev = links[from], target = links[current];
      var W = target.getBoundingClientRect().width;
      var tb = target.querySelector('.base'), tbold = target.querySelector('.bold'), q = target.querySelector('.sq');
      var pb = prev.querySelector('.bold'), pt = prev.querySelector('.base');
      var DUR = 650;
      var anims = [];

      // The old tab's bold slowly fades back to regular
      prev.classList.remove('is-active');
      anims.push(pt.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: DUR, fill: 'forwards' }));
      anims.push(pb.animate([{ clipPath: 'inset(0 0 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 0 }], { duration: DUR, easing: 'ease', fill: 'forwards' }));

      // The black block covers the whole text box, then wipes away to reveal it in bold
      q.style.visibility = 'visible';
      anims.push(q.animate([
        { clipPath: 'inset(0 100% 0 0)', offset: 0 },
        { clipPath: 'inset(0 0% 0 0)', offset: 0.5 },
        { clipPath: 'inset(0 0 0 100%)', offset: 1 }
      ], { duration: DUR, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }));

      // While the box is fully covered, the new tab becomes bold
      setTimeout(function () { target.classList.add('is-active'); }, DUR * 0.5);

      Promise.all(anims.map(function (x) { return x.finished; })).then(function () {
        anims.forEach(function (x) { x.cancel(); });
        q.style.visibility = 'hidden';
        target.classList.add('is-active');
        prev.classList.remove('is-active');
      }).catch(function () {
        target.classList.add('is-active'); prev.classList.remove('is-active');
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { requestAnimationFrame(run); });
    else requestAnimationFrame(run);
  }

  // Coming back with the browser's back button: start fresh
  window.addEventListener('pageshow', function (e) { if (e.persisted) window.location.reload(); });
})();
