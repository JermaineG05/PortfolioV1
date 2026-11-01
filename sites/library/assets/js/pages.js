/* ==========================================================================
   Page controllers. Each <main data-page="…" data-config='{…}'> picks one.
   ========================================================================== */
(function () {
    'use strict';

    const { el, api, toast, badge, formatDate, formatDateTime, plural } = window.App;

    const main = document.querySelector('main[data-page]');
    if (!main) return;
    const cfg = JSON.parse(main.dataset.config || '{}');
    // Which catalogue (books / journals) comes from ?type= in the address, as it did in the PHP version.
    cfg.kind = new URLSearchParams(window.location.search).get('type') === 'journal' ? 'journal' : 'book';
    cfg.label = cfg.kind === 'book' ? 'Book' : 'Journal';
    cfg.genres = window.Store.GENRES;
    for (const a of document.querySelectorAll('.tabs a[data-k-tab]')) if (a.dataset.kTab === cfg.kind) a.setAttribute('aria-current', 'page');
    for (const a of document.querySelectorAll('[data-keep-type]')) a.setAttribute('href', a.getAttribute('href') + '?type=' + cfg.kind);
    const $ = (sel) => main.querySelector(sel);

    const date = (r, k) => (r[k] ? formatDate(r[k]) : '');
    const statusBadge = (s) => badge(s, s === 'Available' ? 'ok' : 'off');

    /* Column sets, shared by the admin and student catalogue views. */
    const catalogColumns = {
        book: [
            { key: 'bookname', label: 'Title', sortable: true, className: 'title-cell' },
            { key: 'ISBN', label: 'ISBN' },
            { key: 'quantity', label: 'Copies', type: 'number', sortable: true, className: 'num' },
            { key: 'genre', label: 'Genre', sortable: true },
            { key: 'author', label: 'Author', sortable: true },
            { key: 'publisher', label: 'Publisher' },
            { key: 'status', label: 'Status', sortable: true, cell: (r) => statusBadge(r.status) },
        ],
        journal: [
            { key: 'bookname', label: 'Title', sortable: true, className: 'title-cell' },
            { key: 'quantity', label: 'Copies', type: 'number', sortable: true, className: 'num' },
            { key: 'date_published', label: 'Published', sortable: true, cell: (r) => date(r, 'date_published'), searchText: (r) => r.date_published + ' ' + date(r, 'date_published') },
        ],
    };

    /** Creates a table, loads it from an API endpoint, and wires retry-on-error. */
    function loadTable(table, endpoint, params, pick) {
        const run = async () => {
            table.showLoading();
            try {
                const data = await api(endpoint, { params });
                table.setRows(pick(data));
            } catch (err) {
                table.showError(err.message, run);
            }
        };
        run();
        return run;
    }

    const newTable = (columns, extra = {}) =>
        new window.App.DataTable({ mount: $('#table'), columns, searchInput: $('#search'), countEl: $('#count'), ...extra });

    /* ================================================================
       Student: catalogue (read-only)
       ================================================================ */
    function catalog() {
        const table = newTable(catalogColumns[cfg.kind], {
            defaultSort: { key: 'bookname', dir: 1 },
            emptyTitle: 'The catalogue is empty',
            emptyText: 'Nothing has been added yet.',
        });
        loadTable(table, 'items.php', { kind: cfg.kind }, (d) => d.items);
    }

    /* ================================================================
       Admin: catalogue maintenance (add / edit / archive)
       ================================================================ */
    function adminItems() {
        const fields = cfg.kind === 'book'
            ? [
                { name: 'bookname', label: 'Title', type: 'text', full: true, max: 255 },
                { name: 'ISBN', label: 'ISBN', type: 'text', inputmode: 'numeric', hint: '9–13 digits' },
                { name: 'quantity', label: 'Copies on shelf', type: 'number', min: 0 },
                { name: 'author', label: 'Author', type: 'text', max: 255 },
                { name: 'publisher', label: 'Publisher', type: 'text', max: 255 },
                { name: 'genre', label: 'Genre', type: 'select', options: cfg.genres },
                { name: 'status', label: 'Status', type: 'select', options: ['Available', 'Unavailable'] },
            ]
            : [
                { name: 'bookname', label: 'Title', type: 'text', full: true, max: 255 },
                { name: 'quantity', label: 'Copies', type: 'number', min: 0 },
                { name: 'date_published', label: 'Date published', type: 'date', max: new Date().toISOString().slice(0, 10) },
            ];

        const table = newTable([
            ...catalogColumns[cfg.kind],
            {
                key: '_actions', label: 'Actions', className: 'actions',
                cell: (r) => [
                    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => openForm(r), 'aria-label': `Edit ${r.bookname}` }, 'Edit'),
                    el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => archive(r), 'aria-label': `Archive ${r.bookname}` }, 'Archive'),
                ],
            },
        ], {
            defaultSort: { key: 'bookname', dir: 1 },
            emptyTitle: 'No ' + cfg.label.toLowerCase() + 's yet',
            emptyText: `Use “Add ${cfg.label.toLowerCase()}” to create the first one.`,
        });
        const reload = loadTable(table, 'items.php', { kind: cfg.kind }, (d) => d.items);

        function buildField(f, item) {
            const id = 'f-' + f.name;
            let input;
            if (f.type === 'select') {
                const options = [...f.options];
                // A legacy value that's no longer in the list stays selectable so editing doesn't wipe it.
                if (item && item[f.name] && !options.includes(item[f.name])) options.unshift(item[f.name]);
                input = el('select', { id, name: f.name, required: true }, options.map((o) => el('option', { value: o }, o)));
                input.value = item && item[f.name] ? item[f.name] : options[0];
            } else {
                input = el('input', {
                    id, name: f.name, type: f.type, required: true, autocomplete: 'off',
                    maxlength: f.type === 'text' ? f.max : false, min: f.min, max: f.type === 'date' ? f.max : false,
                    inputmode: f.inputmode, step: f.type === 'number' ? 1 : false,
                });
                input.value = item ? (item[f.name] ?? '') : (f.type === 'number' ? '1' : '');
            }
            return el('div', { class: 'field' + (f.full ? ' field--full' : '') },
                el('label', { for: id }, f.label, f.hint ? el('span', { class: 'muted' }, ' (' + f.hint + ')') : null), input);
        }

        function openForm(item) {
            const isEdit = !!item;
            const error = el('div', { class: 'alert alert--error', role: 'alert', hidden: true });
            const form = el('form', { novalidate: true }, error, el('div', { class: 'form-grid' }, fields.map((f) => buildField(f, item))));
            const save = el('button', { class: 'btn btn-primary', type: 'submit', form: 'item-form' }, isEdit ? 'Save changes' : 'Add ' + cfg.label.toLowerCase());
            const cancel = el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close() }, 'Cancel');
            form.id = 'item-form';

            const dlg = window.App.dialog({
                title: isEdit ? 'Edit ' + cfg.label.toLowerCase() : 'Add ' + cfg.label.toLowerCase(),
                body: form, actions: [cancel, save],
            });

            form.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                error.hidden = true;
                const body = { kind: cfg.kind, id: item ? item.id : null };
                for (const f of fields) body[f.name] = form.elements[f.name].value;

                save.disabled = true;
                try {
                    await api('item_save.php', { body });
                    dlg.close();
                    toast(isEdit ? 'Changes saved.' : cfg.label + ' added.', 'ok');
                    reload();
                } catch (err) {
                    error.textContent = err.message;
                    error.hidden = false;
                    save.disabled = false;
                }
            });
            form.elements[0].focus();
        }

        async function archive(item) {
            const ok = await window.App.confirm({
                title: 'Archive this ' + cfg.label.toLowerCase() + '?',
                message: `“${item.bookname}” will be removed from the catalogue and moved to the archives. Its borrowing history is kept.`,
                confirmText: 'Archive', danger: true,
            });
            if (!ok) return;
            try {
                await api('item_archive.php', { body: { kind: cfg.kind, id: item.id } });
                toast('Archived.', 'ok');
                reload();
            } catch (err) {
                toast(err.message, 'error', 6000);
            }
        }

        $('#add-btn').addEventListener('click', () => openForm(null));
    }

    /* ================================================================
       Admin: logs & archives
       ================================================================ */
    function adminLogs() {
        const table = newTable([
            { key: 'transactionID', label: 'Loan #', type: 'number', sortable: true, className: 'num' },
            { key: 'bookname', label: 'Title', sortable: true, className: 'title-cell' },
            { key: 'quantity', label: 'Copies', type: 'number', className: 'num' },
            { key: 'fullname', label: 'Borrower', sortable: true },
            { key: 'STN', label: 'Student no.' },
            { key: 'date_to_be_borrowed', label: 'Borrowed', sortable: true, cell: (r) => date(r, 'date_to_be_borrowed'), searchText: (r) => r.date_to_be_borrowed + ' ' + date(r, 'date_to_be_borrowed') },
            { key: 'return_date', label: 'Returned', sortable: true, cell: (r) => (r.return_date ? date(r, 'return_date') : badge('Not returned yet', 'warn')), searchText: (r) => (r.return_date ? r.return_date + ' ' + date(r, 'return_date') : 'not returned') },
        ], { defaultSort: { key: 'date_to_be_borrowed', dir: -1 }, emptyTitle: 'No borrowing yet', emptyText: 'Loans will appear here as students borrow.' });
        loadTable(table, 'logs.php', { kind: cfg.kind }, (d) => d.rows);
    }

    function adminArchives() {
        const base = catalogColumns[cfg.kind].filter((c) => c.key !== 'status');
        const table = newTable([
            { key: 'id', label: 'ID', type: 'number', sortable: true, className: 'num' },
            ...base,
            { key: 'archived_at', label: 'Archived', sortable: true, cell: (r) => formatDateTime(r.archived_at), searchText: (r) => r.archived_at },
        ], { defaultSort: { key: 'archived_at', dir: -1 }, emptyTitle: 'Nothing archived', emptyText: 'Archived items will show up here.' });
        loadTable(table, 'archives.php', { kind: cfg.kind }, (d) => d.rows);
    }

    /* ================================================================
       Student: borrow
       ================================================================ */
    function borrow() {
        const form = $('#borrow-form');
        const select = $('#item');
        const submit = $('#borrow-submit');
        const alertBox = $('#borrow-alert');

        const showAlert = (kind, ...content) => alertBox.replaceChildren(el('div', { class: 'alert alert--' + kind, role: kind === 'error' ? 'alert' : 'status' }, ...content));

        async function loadItems() {
            try {
                const { items } = await api('items.php', { params: { kind: cfg.kind, available: 1 } });
                select.replaceChildren(el('option', { value: '' }, items.length ? 'Choose a title…' : 'Nothing is available right now'),
                    ...items.map((i) => el('option', { value: i.id }, `${i.bookname}${i.author ? ' — ' + i.author : ''} (${plural(i.quantity, 'copy', 'copies')} left)`)));
                select.disabled = items.length === 0;
                submit.disabled = items.length === 0;
            } catch (err) {
                select.replaceChildren(el('option', { value: '' }, 'Couldn’t load titles'));
                showAlert('error', err.message);
            }
        }

        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            alertBox.replaceChildren();
            if (!form.elements.item_id.value) return showAlert('error', 'Please choose a title.');

            submit.disabled = true;
            try {
                const res = await api('borrow.php', {
                    body: {
                        kind: cfg.kind,
                        stn: form.elements.stn.value.trim(),
                        fullname: form.elements.fullname.value,
                        item_id: Number(form.elements.item_id.value),
                        quantity: Number(form.elements.quantity.value),
                    },
                });
                showAlert('ok', `You borrowed “${res.title}” (${plural(res.quantity, 'copy', 'copies')}). Loan #${res.transactionID}. `,
                    el('a', { href: 'return.html?type=' + cfg.kind }, 'Return it here when you’re done.'));
                form.elements.item_id.value = '';
                form.elements.quantity.value = '1';
                await loadItems();
            } catch (err) {
                showAlert('error', err.message);
                // Stock may have changed under us — refresh the list.
                if (err.status === 409 || err.status === 404) await loadItems();
            } finally {
                submit.disabled = select.disabled;
            }
        });

        loadItems();
    }

    /* ================================================================
       Student: return
       ================================================================ */
    function returns() {
        const form = $('#lookup-form');
        const list = $('#loans');
        let creds = null;

        async function lookup() {
            list.hidden = false;
            list.replaceChildren(el('div', { class: 'state' }, 'Looking…'));
            try {
                const { loans } = await api('loans.php', { body: { kind: cfg.kind, ...creds } });
                if (!loans.length) {
                    list.replaceChildren(el('div', { class: 'alert alert--info' }, 'No active loans found for that student number and name. Check the spelling matches what you used when borrowing.'));
                    return;
                }
                list.replaceChildren(
                    el('h2', {}, `Your loans (${loans.length})`),
                    ...loans.map(renderLoan)
                );
            } catch (err) {
                list.replaceChildren(el('div', { class: 'alert alert--error', role: 'alert' }, err.message));
            }
        }

        function renderLoan(loan) {
            const qty = el('select', { 'aria-label': 'Copies to return' }, Array.from({ length: loan.quantity }, (_, i) => loan.quantity - i).map((n) => el('option', { value: n }, n === loan.quantity ? `All (${n})` : String(n))));
            const btn = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Return');
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                try {
                    const res = await api('return.php', { body: { kind: cfg.kind, transactionID: loan.transactionID, quantity: Number(qty.value), ...creds } });
                    toast(`Returned “${res.title}”. Thank you!`, 'ok');
                    await lookup();
                } catch (err) {
                    toast(err.message, 'error', 6000);
                    btn.disabled = false;
                }
            });
            return el('div', { class: 'loan' },
                el('div', {},
                    el('div', { class: 'loan__title' }, loan.bookname),
                    el('div', { class: 'loan__meta' }, `${plural(loan.quantity, 'copy', 'copies')} · borrowed ${formatDate(loan.date_to_be_borrowed)} · Loan #${loan.transactionID}`)),
                el('div', { class: 'loan__actions' }, loan.quantity > 1 ? qty : null, btn));
        }

        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            creds = { stn: form.elements.stn.value.trim(), fullname: form.elements.fullname.value };
            const submit = $('#lookup-submit');
            submit.disabled = true;
            await lookup();
            submit.disabled = false;
        });
    }

    const pages = { catalog, 'admin-items': adminItems, 'admin-logs': adminLogs, 'admin-archives': adminArchives, borrow, return: returns };
    (pages[main.dataset.page] || (() => {}))();
})();
