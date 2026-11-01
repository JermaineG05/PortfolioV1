/* Login, registration and buddy finder. */
(function () {
  'use strict';
  var SB = window.StudyBuddy;
  var user = SB.init();

  var views = {
    login: document.getElementById('view-login'),
    register: document.getElementById('view-register'),
    buddies: document.getElementById('view-buddies')
  };

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    var titles = { login: 'Sign In', register: 'Register', buddies: 'Find a Buddy' };
    document.title = 'Study Buddy – ' + titles[name];
  }
  function say(id, text, kind) {
    var el = document.getElementById(id);
    el.textContent = text || '';
    el.className = 'form-msg' + (kind ? ' ' + kind : '');
  }

  // links between login <-> register
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); show(a.dataset.view); history.replaceState(null, '', '#' + a.dataset.view); });
  });

  /* ------------------------------ photo ------------------------------ */
  // Shrinks the chosen picture to 256px so it fits in localStorage.
  function shrinkPhoto(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve(null);
      if (!/^image\//.test(file.type)) return reject(new Error('Please choose an image file.'));
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var size = 256, side = Math.min(img.width, img.height);
        var canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')); };
      img.src = url;
    });
  }

  /* ------------------------------ register --------------------------- */
  document.getElementById('register-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target, btn = form.querySelector('button[type=submit]');
    var val = function (id) { return document.getElementById(id).value.trim(); };

    var data = {
      name: val('reg-name'), age: parseInt(val('reg-age'), 10), year: val('reg-year'),
      major: val('reg-major'), subject: val('reg-subject'),
      help: val('reg-help'), canhelp: val('reg-canhelp'),
      languages: Array.prototype.map.call(form.querySelectorAll('input[name=languages]:checked'), function (c) { return c.value; }),
      email: val('reg-email').toLowerCase()
    };
    var password = document.getElementById('reg-password').value;
    var confirm = document.getElementById('reg-confirm').value;

    var problem = null;
    if (!data.name || !data.major || !data.subject || !data.help || !data.canhelp || !data.year) problem = 'Please fill in every field.';
    else if (!(data.age >= 13 && data.age <= 100)) problem = 'Age must be between 13 and 100.';
    else if (!data.languages.length) problem = 'Pick at least one programming language.';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) problem = 'Enter a valid email address.';
    else if (password.length < 6) problem = 'Password must be at least 6 characters.';
    else if (password !== confirm) problem = 'Passwords do not match.';
    else if (SB.findUser(data.email)) problem = 'That email is already registered.';
    if (problem) return say('register-msg', problem, 'error');

    btn.disabled = true; say('register-msg', 'Creating your account…');
    var photoFile = document.getElementById('reg-photo').files[0];
    var salt = SB.randomSalt();

    Promise.all([shrinkPhoto(photoFile), SB.hashPassword(password, salt)]).then(function (r) {
      data.photo = r[0];          // null -> default avatar is used everywhere
      data.salt = salt;
      data.hash = r[1];
      var all = SB.getUsers();
      all.push(data);
      if (!SB.saveUsers(all)) throw new Error('Could not save your account (browser storage is full or blocked).');
      form.reset();
      say('register-msg', '');
      document.getElementById('login-email').value = data.email;
      say('login-msg', 'Registration successful! Please log in.', 'ok');
      show('login');
      document.getElementById('login-password').focus();
    }).catch(function (err) {
      say('register-msg', err.message || 'Something went wrong. Please try again.', 'error');
    }).then(function () { btn.disabled = false; });
  });

  /* ------------------------------ login ------------------------------ */
  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    if (!email || !password) return say('login-msg', 'Enter your email and password.', 'error');

    SB.verifyLogin(email, password).then(function (u) {
      if (!u) return say('login-msg', 'Invalid email or password.', 'error');
      SB.login(u);
      window.location.reload();   // reload so the header and buddy list reflect the signed-in state
    });
  });

  /* ------------------------------ buddy finder ----------------------- */
  function initBuddies() {
    var users = SB.getUsers();
    var sel = {
      year: document.getElementById('filter-year'),
      subject: document.getElementById('filter-subject'),
      language: document.getElementById('filter-language'),
      search: document.getElementById('filter-search')
    };
    function fill(select, values, suffix) {
      values.forEach(function (v) { select.appendChild(SB.h('option', { value: v, text: v + (suffix || '') })); });
    }
    fill(sel.year, SB.YEARS, ' Year');
    // subjects come from the data, de-duplicated ignoring case ("math" == "Math")
    var seen = {}, subjects = [];
    users.forEach(function (u) {
      var k = (u.subject || '').trim().toLowerCase();
      if (k && !seen[k]) { seen[k] = true; subjects.push(u.subject.trim()); }
    });
    fill(sel.subject, subjects.sort(function (a, b) { return a.localeCompare(b); }));
    fill(sel.language, SB.LANGUAGES);

    var list = document.getElementById('buddy-list'), count = document.getElementById('result-count');

    function render() {
      var q = sel.search.value.trim().toLowerCase();
      var subj = sel.subject.value.toLowerCase();
      var others = SB.getUsers().filter(function (b) { return b.email !== user.email; });
      var shown = others.filter(function (b) {
        return (!sel.year.value || b.year === sel.year.value) &&
          (!subj || (b.subject || '').trim().toLowerCase() === subj) &&
          (!sel.language.value || b.languages.indexOf(sel.language.value) !== -1) &&
          (!q || [b.name, b.subject, b.major, b.help, b.canhelp].join(' ').toLowerCase().indexOf(q) !== -1);
      });
      list.textContent = '';
      if (!shown.length) {
        list.appendChild(SB.h('div', { class: 'empty', text: others.length ? 'No buddies match those filters.' : 'No other buddies have registered yet. Check back soon!' }));
      } else {
        shown.forEach(function (b) { list.appendChild(SB.buddyCard(b, user)); });
      }
      count.textContent = others.length ? 'Showing ' + shown.length + ' of ' + others.length + ' buddies' : '';
    }
    ['year', 'subject', 'language'].forEach(function (k) { sel[k].addEventListener('change', render); });
    sel.search.addEventListener('input', render);
    document.getElementById('filters').addEventListener('reset', function () { setTimeout(render, 0); });
    render();
  }

  /* ------------------------------ start ------------------------------ */
  if (user) { show('buddies'); initBuddies(); }
  else show(location.hash === '#register' ? 'register' : 'login');
})();
