/* ==========================================================================
   Core helpers shared by every page: DOM builder, API client (now backed by the
   browser-storage Store instead of PHP), toasts,
   confirm dialog, sortable + searchable table, nav toggle, splash.
   Nothing here ever puts server data into innerHTML — everything goes through
   textContent / el(), so a title like  <img onerror=…>  is just text.
   ========================================================================== */
(function () {
    'use strict';

    const App = (window.App = {});
    const base = document.body.dataset.base || '';

    /* ------------------------------------------------------------ DOM */

    /** el('button', {class:'btn', onclick: fn}, 'Label', childNode, …) */
    App.el = function (tag, attrs, ...children) {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(attrs || {})) {
            if (value === false || value == null) continue;
            if (key.startsWith('on') && typeof value === 'function') {
                node.addEventListener(key.slice(2), value);
            } else if (key === 'class') {
                node.className = value;
            } else if (key === 'dataset') {
                Object.assign(node.dataset, value);
            } else if (value === true) {
                node.setAttribute(key, '');
            } else {
                node.setAttribute(key, value);
            }
        }
        for (const child of children.flat()) {
            if (child == null || child === false) continue;
            node.append(child instanceof Node ? child : document.createTextNode(String(child)));
        }
        return node;
    };
    const el = App.el;

    App.formatDate = function (value) {
        if (!value) return '';
        const d = new Date(value + 'T00:00:00');
        return isNaN(d) ? String(value) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    App.formatDateTime = function (value) {
        if (!value) return '';
        const d = new Date(String(value).replace(' ', 'T'));
        return isNaN(d) ? String(value) : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    App.plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

    /* ------------------------------------------------------------ API */

    /** api('items.php', {params:{kind:'book'}})  or  api('borrow.php', {body:{…}})
     *  Same call shape as before, but it now talks to the browser-side Store (localStorage). */
    App.api = async function (endpoint, { body, params } = {}) {
        try {
            return { ok: true, ...(await window.Store.call(endpoint, { body, params })) };
        } catch (err) {
            if (err.status === 401 && document.body.querySelector('[data-page^="admin"]')) {
                window.location.href = base + 'login.html';
            }
            throw Object.assign(new Error(err.message || 'Something went wrong.'), { status: err.status || 500 });
        }
    };

    /* --------------------------------------------------------- toasts */

    App.toast = function (message, type = 'info', ms = 4000) {
        const host = document.getElementById('toasts');
        if (!host) return;
        const node = el('div', { class: 'toast' + (type === 'ok' ? ' toast--ok' : type === 'error' ? ' toast--error' : '') }, message);
        host.append(node);
        setTimeout(() => node.remove(), ms);
    };

    /* --------------------------------------------------------- dialogs */

    /** Opens a <dialog>; resolves when closed. */
    App.dialog = function ({ title, body, actions }) {
        const dlg = el('dialog', { 'aria-labelledby': 'dlg-title' },
            el('div', { class: 'dialog__head' }, el('h2', { id: 'dlg-title' }, title)),
            el('div', { class: 'dialog__body' }, body),
            el('div', { class: 'dialog__foot' }, actions)
        );
        document.body.append(dlg);
        dlg.addEventListener('close', () => dlg.remove());
        dlg.showModal();
        return dlg;
    };

    App.confirm = function ({ title, message, confirmText = 'Confirm', danger = false }) {
        return new Promise((resolve) => {
            let answer = false;
            const yes = el('button', { class: 'btn btn-danger' + (danger ? ' is-solid' : ' btn-primary'), type: 'button', onclick: () => { answer = true; dlg.close(); } }, confirmText);
            const no = el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close() }, 'Cancel');
            const dlg = App.dialog({ title, body: el('p', {}, message), actions: [no, yes] });
            dlg.addEventListener('close', () => resolve(answer));
            no.focus();
        });
    };

    /* ----------------------------------------------------- DataTable */

    /**
     * Sortable, searchable table.
     *   columns: [{ key, label, type?:'text'|'number'|'date', sortable?, searchable?, className?, cell?(row) }]
     */
    App.DataTable = class {
        constructor({ mount, columns, searchInput, countEl, emptyTitle = 'Nothing here yet', emptyText = '', defaultSort = null }) {
            this.mount = mount;
            this.columns = columns;
            this.searchInput = searchInput;
            this.countEl = countEl;
            this.emptyTitle = emptyTitle;
            this.emptyText = emptyText;
            this.rows = [];
            this.sort = defaultSort; // { key, dir: 1 | -1 }
            this.query = '';

            if (searchInput) {
                let timer;
                searchInput.addEventListener('input', () => {
                    clearTimeout(timer);
                    timer = setTimeout(() => { this.query = searchInput.value.trim().toLowerCase(); this.renderBody(); }, 120);
                });
            }
            this.showLoading();
        }

        showLoading() { this.mount.replaceChildren(el('div', { class: 'state' }, 'Loading…')); }

        showError(message, retry) {
            this.mount.replaceChildren(el('div', { class: 'state' },
                el('strong', {}, 'Couldn’t load this table'), message, ' ',
                retry ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: retry }, 'Try again') : null));
            if (this.countEl) this.countEl.textContent = '';
        }

        setRows(rows) {
            this.rows = rows;
            this.build();
        }

        build() {
            const head = el('tr', {});
            for (const col of this.columns) {
                const th = el('th', { scope: 'col', class: col.className || '' });
                if (col.sortable) {
                    th.append(el('button', { class: 'sort-btn', type: 'button', onclick: () => this.toggleSort(col.key) }, col.label));
                } else {
                    th.append(col.label);
                }
                th.dataset.key = col.key;
                head.append(th);
            }
            this.tbody = el('tbody', {});
            this.thead = el('thead', {}, head);
            this.empty = el('div', { class: 'state', hidden: true });
            this.mount.replaceChildren(
                el('div', { class: 'table-scroll' }, el('table', { class: 'data' }, this.thead, this.tbody)),
                this.empty
            );
            this.renderBody();
        }

        toggleSort(key) {
            this.sort = this.sort && this.sort.key === key ? { key, dir: -this.sort.dir } : { key, dir: 1 };
            this.renderBody();
        }

        sortedRows(rows) {
            if (!this.sort) return rows;
            const col = this.columns.find((c) => c.key === this.sort.key);
            const dir = this.sort.dir;
            const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
            const value = (r) => r[col.key];
            return [...rows].sort((a, b) => {
                const x = value(a), y = value(b);
                if (x == null && y == null) return 0;
                if (x == null) return 1;   // empty values always last
                if (y == null) return -1;
                if (col.type === 'number') return (Number(x) - Number(y)) * dir;
                return collator.compare(String(x), String(y)) * dir;
            });
        }

        renderBody() {
            if (!this.tbody) return;
            const q = this.query;
            let rows = this.rows;
            if (q) {
                rows = rows.filter((r) => this.columns.some((c) => c.searchable !== false && c.key !== '_actions' &&
                    String(c.searchText ? c.searchText(r) : (r[c.key] ?? '')).toLowerCase().includes(q)));
            }
            rows = this.sortedRows(rows);

            for (const th of this.thead.querySelectorAll('th')) {
                th.removeAttribute('aria-sort');
                if (this.sort && th.dataset.key === this.sort.key) th.setAttribute('aria-sort', this.sort.dir === 1 ? 'ascending' : 'descending');
            }

            this.tbody.replaceChildren(...rows.map((row) => {
                const tr = el('tr', {});
                for (const col of this.columns) {
                    const content = col.cell ? col.cell(row) : (row[col.key] ?? '');
                    tr.append(el('td', { class: col.className || '' }, content));
                }
                return tr;
            }));

            const none = rows.length === 0;
            this.empty.hidden = !none;
            this.thead.parentElement.hidden = none;
            if (none) {
                this.empty.replaceChildren(
                    el('strong', {}, q ? 'No matches' : this.emptyTitle),
                    q ? `Nothing matches “${this.searchInput.value.trim()}”.` : this.emptyText
                );
            }
            if (this.countEl) {
                this.countEl.textContent = this.rows.length === 0 ? '' :
                    q ? `${rows.length} of ${App.plural(this.rows.length, 'row', 'rows')}` : App.plural(this.rows.length, 'row', 'rows');
            }
        }
    };

    /** Small reusable cell renderers. */
    App.badge = (text, kind) => el('span', { class: 'badge badge--' + kind }, text);

    /* ------------------------------------------------- page chrome */

    function initNav() {
        const btn = document.querySelector('.nav-toggle');
        const nav = document.getElementById('site-nav');
        if (!btn || !nav) return;
        btn.addEventListener('click', () => {
            const open = nav.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', String(open));
        });
    }

    function initPasswordToggles() {
        for (const box of document.querySelectorAll('[data-toggle-password]')) {
            box.addEventListener('change', () => {
                for (const id of box.dataset.togglePassword.split(',')) {
                    const input = document.getElementById(id.trim());
                    if (input) input.type = box.checked ? 'text' : 'password';
                }
            });
        }
    }

    /** One-time welcome splash per browser session; click or wait to dismiss. */
    App.initSplash = function () {
        if (!document.body.dataset.splash) return;
        try {
            if (sessionStorage.getItem('lms-splash')) return;
            sessionStorage.setItem('lms-splash', '1');
        } catch (e) { return; }

        const splash = el('div', { class: 'splash', 'aria-hidden': 'true' },
            el('div', {}, el('img', { src: base + 'assets/img/spcc.png', alt: '' }), el('p', {}, 'SYSTEMS PLUS COMPUTER COLLEGE')));
        document.body.append(splash);
        const leave = () => {
            splash.classList.add('is-leaving');
            setTimeout(() => splash.remove(), 700);
        };
        splash.addEventListener('click', leave);
        setTimeout(leave, 1600);
    };

    /* ------------------------------------------------- demo notice */

    const ACK_KEY = 'lms-demo-ack';
    const notice = () => document.getElementById('demo-notice');

    function openNotice() {
        document.documentElement.classList.add('has-notice');
        const n = notice();
        if (n) { n.classList.remove('is-leaving'); const b = n.querySelector('[data-notice-continue]'); if (b) b.focus(); }
    }

    function closeNotice() {
        try { sessionStorage.setItem(ACK_KEY, '1'); } catch (e) { /* ignore */ }
        const n = notice();
        if (!n) return;
        n.classList.add('is-leaving');
        setTimeout(() => {
            document.documentElement.classList.remove('has-notice');
            n.classList.remove('is-leaving');
            App.initSplash();
        }, 380);
    }

    function initNotice() {
        const n = notice();
        if (!n) { App.initSplash(); return; }
        const cont = n.querySelector('[data-notice-continue]');
        if (cont) cont.addEventListener('click', closeNotice);
        const toggle = n.querySelector('[data-notice-tables]');
        const gallery = n.querySelector('.notice__tables');
        if (toggle && gallery) {
            toggle.addEventListener('click', () => {
                const open = gallery.hidden;
                gallery.hidden = !open;
                toggle.setAttribute('aria-expanded', String(open));
                toggle.textContent = open ? 'Hide the original database tables' : 'See the original database tables';
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.documentElement.classList.contains('has-notice')) closeNotice();
        });
        for (const btn of document.querySelectorAll('[data-open-notice]')) btn.addEventListener('click', openNotice);
        for (const btn of document.querySelectorAll('[data-reset-demo]')) {
            btn.addEventListener('click', async () => {
                const ok = await App.confirm({
                    title: 'Reset the demo data?',
                    message: 'This puts the sample books, journals and loans back to how they started and removes anything you added in this browser.',
                    confirmText: 'Reset', danger: true,
                });
                if (!ok) return;
                await window.Store.reset();
                window.location.reload();
            });
        }
        if (!document.documentElement.classList.contains('has-notice')) App.initSplash();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initNav();
        initPasswordToggles();
        initNotice();
    });
})();
