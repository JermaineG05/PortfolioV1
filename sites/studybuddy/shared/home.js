/* Home page (logged in and logged out versions). */
(function () {
  'use strict';
  var SB = window.StudyBuddy;
  var viewer = SB.init();
  var box = document.getElementById('buddies-container');
  if (!box) return;

  var users = SB.getUsers();
  if (!users.length) {
    box.appendChild(SB.h('div', { class: 'empty' }, [
      SB.h('p', { text: 'No buddies yet.' }),
      SB.h('a', { class: 'btn', href: SB.ROOT + 'LOGIN/aws.html', text: 'Be the first to register' })
    ]));
    return;
  }
  users.forEach(function (u) {
    box.appendChild(SB.buddyCard(u, viewer, 'Contact Now'));
  });
})();
