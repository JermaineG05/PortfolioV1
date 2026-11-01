/* ==========================================================================
   Sign-in pieces that used to be PHP: login.php, register.php, logout.php,
   plus the landing page's Admin link. Session = sessionStorage (see store.js).
   ========================================================================== */
(function () {
    'use strict';

    const { el } = window.App;
    const page = document.body.dataset.auth;
    const $ = (sel) => document.querySelector(sel);

    /* ---- landing page: Admin card goes straight to the dashboard when signed in ---- */
    if (page === 'landing') {
        if (window.Store.currentUser()) {
            const link = $('#admin-choice');
            link.href = 'admin/index.html';
            link.querySelector('[data-sub]').textContent = 'Open the dashboard';
        }
        return;
    }

    /* ---- log out ---- */
    if (page === 'logout') {
        window.Store.logout();
        window.location.replace('login.html');
        return;
    }

    const showError = (box, message) => {
        box.replaceChildren(el('div', { class: 'alert alert--error', role: 'alert' }, message));
    };

    /* ---- login ---- */
    if (page === 'login') {
        if (window.Store.currentUser()) { window.location.replace('admin/index.html'); return; }

        const form = $('#login-form');
        const box = $('#login-alert');
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            box.replaceChildren();
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            try {
                await window.Store.login(form.elements.username.value, form.elements.password.value);
                window.location.href = 'admin/index.html';
            } catch (err) {
                showError(box, err.message);
                btn.disabled = false;
            }
        });

        const fill = $('#fill-demo');
        if (fill) {
            fill.addEventListener('click', () => {
                form.elements.username.value = 'admin';
                form.elements.password.value = 'admin1234';
                form.elements.password.focus();
            });
        }
        return;
    }

    /* ---- add an admin (signed-in admins only, as in the PHP version) ---- */
    if (page === 'register') {
        const form = $('#register-form');
        const box = $('#register-alert');
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            box.replaceChildren();
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            try {
                await window.Store.addAdmin({
                    fullname: form.elements.fullname.value,
                    username: form.elements.username.value,
                    password: form.elements.password.value,
                    password2: form.elements.password2.value,
                });
                form.reset();
                box.replaceChildren(el('div', { class: 'alert alert--ok', role: 'status' }, 'Account created. You can add another below.'));
            } catch (err) {
                box.replaceChildren(...(err.all || [err.message]).map((m) => el('div', { class: 'alert alert--error', role: 'alert' }, m)));
            } finally {
                btn.disabled = false;
            }
        });
    }
})();
