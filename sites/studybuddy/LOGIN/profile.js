/* My Profile page. */
(function () {
  'use strict';
  var SB = window.StudyBuddy;
  var user = SB.init();
  var box = document.getElementById('user-profile-container');
  if (!user || !box) return;   // guard in app.js already redirects signed-out visitors

  function row(label, value) {
    return SB.h('div', {}, [SB.h('dt', { text: label }), SB.h('dd', {}, value)]);
  }

  box.appendChild(SB.h('section', { class: 'panel profile-card' }, [
    SB.h('img', { class: 'avatar', src: SB.photoSrc(user), alt: 'Your profile picture', width: 140, height: 140 }),
    SB.h('h1', { text: 'Welcome, ' + user.name + '!' }),
    SB.h('p', { class: 'sub', text: user.email }),
    SB.h('dl', { class: 'details' }, [
      row('Age', String(user.age || '—')),
      row('Year level', user.year ? user.year + ' year' : '—'),
      row('Major', user.major || '—'),
      row('Main subject', user.subject || '—'),
      row('Topics you need help with', user.help || '—'),
      row('Topics you can help with', user.canhelp || '—'),
      row('Programming languages', SB.chips(user.languages))
    ]),
    SB.h('div', { class: 'profile-actions' }, [
      SB.h('a', { class: 'btn', href: 'aws.html', text: 'Find Buddies' }),
      SB.h('button', { class: 'btn btn-outline', type: 'button', text: 'Sign Out', onclick: SB.logout })
    ])
  ]));
})();
