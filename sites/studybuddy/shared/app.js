/* ==========================================================================
   Study Buddy — shared logic (storage, auth, header/footer, buddy cards)
   Loaded by every page. Pages declare their needs on <body>:
     data-active = home | profile | buddies | about   (highlights the nav item)
     data-auth   = required | guest | any             (access rule)
     data-member = relative URL of the logged-in twin of a guest-only page
   ========================================================================== */
(function () {
  'use strict';

  var KEY_USERS = 'studyBuddies';   // same key as the original app, so existing data keeps working
  var KEY_SESSION = 'sbSession';    // email of the signed-in user
  var KEY_REQUESTS = 'sbRequests';  // buddy requests: [{from, to}]
  var LEGACY_KEYS = ['loggedInUser', 'isLoggedIn', 'currentUser'];
  var ROOT = '../';                 // every page lives exactly one folder deep

  var LANGUAGES = ['HTML', 'CSS', 'JavaScript', 'Python', 'Java', 'C++', 'PHP'];
  var YEARS = ['1st', '2nd', '3rd', '4th'];

  /* ------------------------------ storage ------------------------------ */
  function read(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }   // storage full or blocked
  }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  function getUsers() {
    var list = read(KEY_USERS, []);
    if (!Array.isArray(list)) return [];
    return list.filter(function (u) { return u && typeof u.email === 'string'; }).map(function (u) {
      u.languages = Array.isArray(u.languages) ? u.languages : [];
      return u;
    });
  }
  function saveUsers(list) { return write(KEY_USERS, list); }

  function findUser(email) {
    email = String(email || '').trim().toLowerCase();
    return getUsers().find(function (u) { return u.email.toLowerCase() === email; }) || null;
  }

  /* ------------------------------ session ------------------------------ */
  function currentUser() {
    var email = read(KEY_SESSION, null);
    if (!email) return null;
    var u = findUser(email);
    if (!u) remove(KEY_SESSION);
    return u;
  }
  function login(user) { write(KEY_SESSION, user.email); }
  function logout() {
    remove(KEY_SESSION);
    LEGACY_KEYS.forEach(remove);
    window.location.href = ROOT + 'LOGGED%20OUT/home.html';
  }

  /* ------------------------------ passwords ---------------------------- */
  // NOTE: this is a front-end-only demo. Hashing keeps passwords from sitting in
  // localStorage as plain text, but real authentication needs a server.
  function randomSalt() {
    var a = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function hashPassword(password, salt) {
    var text = salt + ':' + password;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        return 'sha256:' + Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    }
    var h1 = 5381, h2 = 52711;   // weak fallback for very old browsers
    for (var i = 0; i < text.length; i++) {
      h1 = ((h1 * 33) ^ text.charCodeAt(i)) >>> 0;
      h2 = ((h2 * 31) + text.charCodeAt(i)) >>> 0;
    }
    return Promise.resolve('weak:' + h1.toString(16) + h2.toString(16));
  }
  // Resolves with the user if the credentials are valid, otherwise null.
  function verifyLogin(email, password) {
    var user = findUser(email);
    if (!user) return Promise.resolve(null);
    if (user.hash && user.salt) {
      return hashPassword(password, user.salt).then(function (h) { return h === user.hash ? user : null; });
    }
    if (typeof user.password === 'string' && user.password === password) {
      // account created by the old version: upgrade to a hashed password now
      var salt = randomSalt();
      return hashPassword(password, salt).then(function (h) {
        var all = getUsers();
        var rec = all.find(function (u) { return u.email === user.email; });
        if (rec) { rec.salt = salt; rec.hash = h; delete rec.password; saveUsers(all); }
        return rec || user;
      });
    }
    return Promise.resolve(null);
  }

  /* ------------------------------ DOM helpers -------------------------- */
  // Builds elements with textContent only, so user-supplied text can never inject HTML.
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    [].concat(children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  var toastTimer;
  function toast(message) {
    var el = document.getElementById('toast');
    if (!el) {
      el = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function photoSrc(user) {
    var p = user && user.photo;
    if (typeof p === 'string' && p.indexOf('data:image/') === 0) return p;
    return ROOT + 'IMGS/nopfp.png';
  }

  /* ------------------------------ requests ----------------------------- */
  function hasRequested(fromEmail, toEmail) {
    return read(KEY_REQUESTS, []).some(function (r) { return r.from === fromEmail && r.to === toEmail; });
  }
  function addRequest(fromEmail, toEmail) {
    var list = read(KEY_REQUESTS, []);
    if (!list.some(function (r) { return r.from === fromEmail && r.to === toEmail; })) {
      list.push({ from: fromEmail, to: toEmail, at: Date.now() });
      write(KEY_REQUESTS, list);
    }
  }

  /* ------------------------------ buddy card --------------------------- */
  function chips(list) {
    if (!list.length) return h('span', { text: '—' });
    return h('span', { class: 'chips' }, list.map(function (l) { return h('span', { class: 'chip', text: l }); }));
  }
  function field(label, value) {
    return [h('dt', { text: label }), h('dd', {}, typeof value === 'string' ? (value || '—') : value)];
  }

  function buddyCard(user, viewer, buttonLabel) {
    var isMe = viewer && viewer.email === user.email;
    var actions = h('div', { class: 'actions' });

    if (isMe) {
      actions.appendChild(h('span', { class: 'badge-you', text: 'This is you' }));
      actions.style.textAlign = 'center';
    } else if (!viewer) {
      actions.appendChild(h('a', { class: 'btn btn-block btn-outline', href: ROOT + 'LOGIN/aws.html', text: 'Sign in to contact' }));
    } else {
      var btn = h('button', { class: 'btn btn-block', type: 'button', text: buttonLabel || 'Request Buddy' });
      var markDone = function () { btn.disabled = true; btn.textContent = 'Request sent ✓'; };
      if (hasRequested(viewer.email, user.email)) markDone();
      btn.addEventListener('click', function () {
        addRequest(viewer.email, user.email);
        markDone();
        toast('Request sent to ' + user.name + '!');
      });
      actions.appendChild(btn);
    }

    return h('article', { class: 'buddy-card' }, [
      h('img', { class: 'avatar', src: photoSrc(user), alt: 'Photo of ' + user.name, loading: 'lazy', width: 96, height: 96 }),
      h('h3', { text: user.name }),
      h('p', { class: 'meta', text: [user.year ? user.year + ' year' : '', user.major].filter(Boolean).join(' · ') }),
      h('dl', {}, [].concat(
        field('Main subject', user.subject || ''),
        field('Needs help with', user.help || ''),
        field('Can help with', user.canhelp || ''),
        field('Languages', chips(user.languages))
      )),
      actions
    ]);
  }

  /* ------------------------------ header / footer ---------------------- */
  var ICONS = {
    home: '<svg viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M213.38 109.62l-80-72.74a8 8 0 0 0-10.76 0l-80 72.74A8 8 0 0 0 40 115.54V208a8 8 0 0 0 8 8h160a8 8 0 0 0 8-8v-92.46a8 8 0 0 0-2.62-5.92z"/></svg>',
    profile: '<svg viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="128" cy="96" r="64"/><path d="M31 216a112 112 0 0 1 194 0"/></svg>',
    buddies: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" aria-hidden="true"><circle cx="22.83" cy="22.57" r="7.51"/><path d="M38 49.94a15.2 15.2 0 0 0-15.21-15.2h0a15.2 15.2 0 0 0-15.2 15.2z"/><circle cx="44.13" cy="27.22" r="6.05"/><path d="M42.4 49.94h14A12.24 12.24 0 0 0 44.13 37.7h0a12.21 12.21 0 0 0-5.75 1.43"/></svg>',
    about: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 6.63c.14-.06.31-.12.5-.18A9.77 9.77 0 0 1 7.5 6c1.1 0 2.1.2 3 .45.2.06.36.12.5.18v10.88A11.8 11.8 0 0 0 7.5 17c-1.46 0-2.65.25-3.5.51V6.63zM12 4.89a9.3 9.3 0 0 0-.89-.34A11.77 11.77 0 0 0 7.5 4c-1.53 0-2.76.27-3.61.55-.43.14-.77.28-1 .39-.12.06-.26.12-.36.18L2.5 5.14A1 1 0 0 0 2 6v13a1 1 0 0 0 1.51.86c.04-.02.1-.05.18-.09.17-.08.43-.19.78-.3A9.77 9.77 0 0 1 7.5 19c1.1 0 2.1.2 3 .45.34.11.6.22.78.3a4 4 0 0 1 .22.11c.31.19.7.19 1.02 0l.22-.11c.17-.08.44-.19.78-.3A9.77 9.77 0 0 1 16.5 19c1.1 0 2.1.2 3 .45.34.11.6.22.78.3l.22.11A1 1 0 0 0 22 19V6a1 1 0 0 0-.49-.86l-.01-.01-.38-.19c-.23-.11-.57-.25-1-.39A11.77 11.77 0 0 0 16.5 4c-1.53 0-2.76.27-3.61.55-.31.1-.6.22-.89.34zm8 1.74v10.88A11.8 11.8 0 0 0 16.5 17c-1.46 0-2.65.25-3.5.51V6.63c.14-.06.31-.12.5-.18A9.77 9.77 0 0 1 16.5 6c1.1 0 2.1.2 3 .45.2.06.36.12.5.18z" clip-rule="evenodd"/></svg>',
    signin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.9 7.56C9.21 3.96 11.06 2.49 15.11 2.49h.13c4.47 0 6.26 1.79 6.26 6.26v6.52c0 4.47-1.79 6.26-6.26 6.26h-.13c-4.02 0-5.87-1.45-6.2-4.99"/><path d="M15 12H3.62"/><path d="M5.85 8.65L2.5 12l3.35 3.35"/></svg>'
  };

  function buildHeader(user, active) {
    var base = ROOT;
    var home = base + (user ? 'LOGGED%20IN/home.html' : 'LOGGED%20OUT/home.html');
    var about = base + (user ? 'LOGGED%20IN/about.html' : 'LOGGED%20OUT/about.html');
    var buddies = base + 'LOGIN/aws.html';
    var profile = user ? base + 'LOGIN/profile.html' : base + 'LOGIN/aws.html';

    var links = [
      ['home', 'Home', home],
      ['profile', 'Profile', profile],
      ['buddies', 'Buddies', buddies],
      ['about', 'About Us', about]
    ].map(function (l) {
      var a = h('a', { href: l[2], 'aria-label': l[1], 'aria-current': l[0] === active ? 'page' : false });
      a.innerHTML = ICONS[l[0]];
      a.appendChild(h('span', { text: l[1] }));
      return a;
    });

    var action;
    if (user) {
      action = h('button', { type: 'button', class: 'btn btn-light', onclick: logout });
      action.innerHTML = ICONS.signin;
      action.appendChild(document.createTextNode('Sign Out'));
    } else {
      action = h('a', { class: 'btn btn-light', href: base + 'LOGIN/aws.html' });
      action.innerHTML = ICONS.signin;
      action.appendChild(document.createTextNode('Sign In'));
    }

    return [
      h('a', { class: 'brand', href: home, 'aria-label': 'Study Buddy home' }, [
        h('img', { src: base + 'IMGS/icon.jpg', alt: '', width: 64, height: 64 }),
        h('span', { text: 'Study Buddy' })
      ]),
      h('nav', { class: 'nav', 'aria-label': 'Main' }, links),
      h('div', { class: 'header-actions' }, [action])
    ];
  }

  function guard(user) {
    var rule = document.body.dataset.auth || 'any';
    if (rule === 'required' && !user) {
      window.location.replace(ROOT + 'LOGIN/aws.html');
      return false;
    }
    if (rule === 'guest' && user && document.body.dataset.member) {
      window.location.replace(document.body.dataset.member);
      return false;
    }
    return true;
  }

  function renderHeader(user) {
    var header = document.getElementById('site-header');
    if (header && !header.firstChild) buildHeader(user, document.body.dataset.active).forEach(function (n) { header.appendChild(n); });
  }
  function renderFooter() {
    var footer = document.getElementById('site-footer');
    if (footer && !footer.firstChild) footer.appendChild(h('p', { text: '\u00a9 ' + new Date().getFullYear() + ' Study Buddy. All rights reserved.' }));
  }

  function init() {
    var user = currentUser();
    if (!guard(user)) return null;
    renderHeader(user);
    renderFooter();
    return user;
  }

  window.StudyBuddy = {
    LANGUAGES: LANGUAGES, YEARS: YEARS, ROOT: ROOT,
    h: h, toast: toast, init: init, header: function () { renderHeader(currentUser()); }, footer: renderFooter,
    getUsers: getUsers, saveUsers: saveUsers, findUser: findUser,
    currentUser: currentUser, login: login, logout: logout,
    randomSalt: randomSalt, hashPassword: hashPassword, verifyLogin: verifyLogin,
    photoSrc: photoSrc, buddyCard: buddyCard, chips: chips
  };
})();
