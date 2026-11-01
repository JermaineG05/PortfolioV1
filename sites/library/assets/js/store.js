/* ==========================================================================
   Store: the browser-side replacement for the original PHP + MariaDB backend.

   - "Tables" live in one JSON object saved to localStorage (key below).
   - Store.call('borrow.php', {body}) mirrors the old api/*.php endpoints, with the
     same validation rules and the same error messages, so the page scripts did not
     have to change.
   - The signed-in admin is kept in sessionStorage (cleared when the tab closes),
     like the old PHP session.
   Nothing ever leaves the browser.
   ========================================================================== */
(function () {
    'use strict';

    const DB_KEY = 'lms-demo-db-v1';
    const USER_KEY = 'lms-demo-user';
    const MAX_COPIES = 3;                 // was config.php: max_copies_per_borrower

    const GENRES = [
        'Arts & New Media', 'Business Literature', 'Crime', 'Fantasy', 'History', 'Horror',
        'Mystery', 'Psychology', 'Romance', 'Technology & Computing', 'Other',
    ];

    class ApiError extends Error {
        constructor(message, status = 400) { super(message); this.status = status; }
    }

    /* ------------------------------------------------------------ storage */

    let memoryFallback = null;            // used only if the browser blocks localStorage
    function readRaw() {
        try { return window.localStorage.getItem(DB_KEY); } catch (e) { return memoryFallback; }
    }
    function writeRaw(text) {
        try { window.localStorage.setItem(DB_KEY, text); } catch (e) { memoryFallback = text; }
    }

    /* ----------------------------------------------------------------- dates */

    const pad = (n) => String(n).padStart(2, '0');
    function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function today() { return isoDate(new Date()); }
    function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d); }
    function nowStamp(offsetDays = 0) {
        const d = new Date(); d.setDate(d.getDate() - offsetDays);
        return isoDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    /* ------------------------------------------------------------ password */

    async function hash(text) {
        try {
            if (window.crypto && window.crypto.subtle) {
                const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode('lms-demo:' + text));
                return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) { /* fall through */ }
        let h = 5381;                                   // tiny fallback; this is only a demo
        for (const c of 'lms-demo:' + text) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
        return 'x' + (h >>> 0).toString(16);
    }

    /* ----------------------------------------------------------------- seed */

    function book(id, bookname, ISBN, quantity, genre, author, publisher) {
        return { id, bookname, ISBN, quantity, genre, author, publisher, status: quantity > 0 ? 'Available' : 'Unavailable' };
    }

    async function seed() {
        const db = {
            version: 1,
            users: [{ id: 1, full_name: 'Demo Admin', username: 'admin', password: await hash('admin1234') }],
            books: [
                book(1, 'Clean Code', '9780132350884', 4, 'Technology & Computing', 'Robert C. Martin', 'Prentice Hall'),
                book(2, 'The Pragmatic Programmer', '9780135957059', 4, 'Technology & Computing', 'Andrew Hunt, David Thomas', 'Addison-Wesley'),
                book(3, 'Introduction to Algorithms', '9780262046305', 3, 'Technology & Computing', 'Thomas H. Cormen et al.', 'MIT Press'),
                book(4, 'Don’t Make Me Think', '9780321965516', 3, 'Arts & New Media', 'Steve Krug', 'New Riders'),
                book(5, 'The Psychology of Money', '9780857197689', 4, 'Psychology', 'Morgan Housel', 'Harriman House'),
                book(6, 'Thinking, Fast and Slow', '9780374533557', 2, 'Psychology', 'Daniel Kahneman', 'Farrar, Straus and Giroux'),
                book(7, 'Zero to One', '9780804139298', 3, 'Business Literature', 'Peter Thiel', 'Crown Business'),
                book(8, 'The Lean Startup', '9780307887894', 0, 'Business Literature', 'Eric Ries', 'Crown Business'),
                book(9, 'Murder on the Orient Express', '9780062693662', 3, 'Mystery', 'Agatha Christie', 'Collins Crime Club'),
                book(10, 'The Girl with the Dragon Tattoo', '9780307454546', 0, 'Crime', 'Stieg Larsson', 'Knopf'),
                book(11, 'The Hobbit', '9780547928227', 4, 'Fantasy', 'J.R.R. Tolkien', 'Houghton Mifflin'),
                book(12, 'Dracula', '9780141439846', 1, 'Horror', 'Bram Stoker', 'Penguin Classics'),
                book(13, 'Pride and Prejudice', '9780141439518', 3, 'Romance', 'Jane Austen', 'Penguin Classics'),
                book(14, 'Sapiens: A Brief History of Humankind', '9780062316097', 2, 'History', 'Yuval Noah Harari', 'Harper'),
            ],
            journals: [
                { id: 1, bookname: 'Philippine Journal of Computing Research, Vol. 12', quantity: 2, date_published: '2023-06-15' },
                { id: 2, bookname: 'Library Use Among College Students in Metro Manila', quantity: 2, date_published: '2022-11-03' },
                { id: 3, bookname: 'Capstone: Inventory System with Barcode Scanning', quantity: 1, date_published: '2024-03-20' },
                { id: 4, bookname: 'Journal of Educational Technology, Vol. 8', quantity: 2, date_published: '2021-09-10' },
                { id: 5, bookname: 'Digital Literacy Among Senior High School Students', quantity: 2, date_published: '2023-01-25' },
            ],
            borrowed: {
                book: [
                    { transactionID: 3, bookID: 1, bookname: 'Clean Code', quantity: 1, fullname: 'Maria Santos', STN: '20230001', date_to_be_borrowed: daysAgo(5) },
                    { transactionID: 4, bookID: 14, bookname: 'Sapiens: A Brief History of Humankind', quantity: 1, fullname: 'Juan Dela Cruz', STN: '20230002', date_to_be_borrowed: daysAgo(3) },
                    { transactionID: 5, bookID: 10, bookname: 'The Girl with the Dragon Tattoo', quantity: 2, fullname: 'Juan Dela Cruz', STN: '20230002', date_to_be_borrowed: daysAgo(2) },
                    { transactionID: 6, bookID: 12, bookname: 'Dracula', quantity: 1, fullname: 'Ana Reyes', STN: '20230003', date_to_be_borrowed: daysAgo(1) },
                ],
                journal: [
                    { transactionID: 2, bookID: 1, bookname: 'Philippine Journal of Computing Research, Vol. 12', quantity: 1, fullname: 'Maria Santos', STN: '20230001', date_to_be_borrowed: daysAgo(4) },
                ],
            },
            logs: {
                book: [
                    { transactionID: 1, bookname: 'The Hobbit', quantity: 1, fullname: 'Juan Dela Cruz', STN: '20230002', date_to_be_borrowed: daysAgo(21), return_date: daysAgo(12) },
                    { transactionID: 2, bookname: 'The Pragmatic Programmer', quantity: 1, fullname: 'Maria Santos', STN: '20230001', date_to_be_borrowed: daysAgo(15), return_date: daysAgo(8) },
                    { transactionID: 3, bookname: 'Clean Code', quantity: 1, fullname: 'Maria Santos', STN: '20230001', date_to_be_borrowed: daysAgo(5), return_date: null },
                    { transactionID: 4, bookname: 'Sapiens: A Brief History of Humankind', quantity: 1, fullname: 'Juan Dela Cruz', STN: '20230002', date_to_be_borrowed: daysAgo(3), return_date: null },
                    { transactionID: 5, bookname: 'The Girl with the Dragon Tattoo', quantity: 2, fullname: 'Juan Dela Cruz', STN: '20230002', date_to_be_borrowed: daysAgo(2), return_date: null },
                    { transactionID: 6, bookname: 'Dracula', quantity: 1, fullname: 'Ana Reyes', STN: '20230003', date_to_be_borrowed: daysAgo(1), return_date: null },
                ],
                journal: [
                    { transactionID: 1, bookname: 'Journal of Educational Technology, Vol. 8', quantity: 1, fullname: 'Ana Reyes', STN: '20230003', date_to_be_borrowed: daysAgo(18), return_date: daysAgo(10) },
                    { transactionID: 2, bookname: 'Philippine Journal of Computing Research, Vol. 12', quantity: 1, fullname: 'Maria Santos', STN: '20230001', date_to_be_borrowed: daysAgo(4), return_date: null },
                ],
            },
            archives: {
                book: [{ id: 15, bookname: 'Introduction to Java Programming (old edition)', ISBN: '9780132662307', quantity: 2, genre: 'Technology & Computing', author: 'Y. Daniel Liang', publisher: 'Pearson', archived_at: nowStamp(20) }],
                journal: [{ id: 6, bookname: 'Campus Newsletter Compilation 2015', quantity: 1, date_published: '2015-12-01', archived_at: nowStamp(30) }],
            },
            seq: { book: 15, journal: 6, bookTx: 6, journalTx: 2 },
        };
        return db;
    }

    /* ------------------------------------------------------------- load/save */

    let cache = null;
    async function load() {
        if (cache) return cache;
        const raw = readRaw();
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.version === 1) { cache = parsed; return cache; }
            } catch (e) { /* corrupted: reseed below */ }
        }
        cache = await seed();
        save();
        return cache;
    }
    function save() { writeRaw(JSON.stringify(cache)); }

    async function reset() {
        cache = await seed();
        save();
        try { window.sessionStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ }
    }

    /* ----------------------------------------------------------- validation
       Ported 1:1 from includes/library.php so the messages stay the same.   */

    function cleanText(value, label, max = 255) {
        if (typeof value !== 'string' && typeof value !== 'number') throw new ApiError(`${label} is required.`);
        const text = String(value).replace(/\s+/g, ' ').trim();
        if (text === '') throw new ApiError(`${label} is required.`);
        if ([...text].length > max) throw new ApiError(`${label} must be ${max} characters or fewer.`);
        return text;
    }

    function cleanInt(value, label, min, max) {
        if (typeof value === 'string') value = value.trim();
        if (value === '' || value === null || value === undefined || !/^-?\d+$/.test(String(value))) {
            throw new ApiError(`${label} must be a whole number.`);
        }
        const n = Number(value);
        if (n < min || n > max) throw new ApiError(`${label} must be between ${min} and ${max}.`);
        return n;
    }

    function cleanDate(value, label) {
        const v = typeof value === 'string' ? value.trim() : '';
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
        const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
        if (!d || isoDate(d) !== v) throw new ApiError(`${label} must be a valid date.`);
        if (v > today()) throw new ApiError(`${label} cannot be in the future.`);
        return v;
    }

    function cleanIsbn(value) {
        const isbn = String(value ?? '').replace(/[\s-]+/g, '').toUpperCase();
        if (!/^(?:\d{9,13}|\d{9}X)$/.test(isbn)) {
            throw new ApiError('ISBN must be 9–13 digits (hyphens are fine; a final X is allowed for ISBN-10).');
        }
        return isbn;
    }

    function cleanStudentNumber(value) {
        const stn = String(value ?? '').trim();
        if (!/^\d{4,20}$/.test(stn)) throw new ApiError('Student / employee number must be 4–20 digits.');
        return stn;
    }

    const cleanPersonName = (value) => cleanText(value, 'Full name', 155);

    /* ------------------------------------------------------------------ kinds */

    function kindConfig(kind) {
        if (kind === 'book') return { key: 'book', table: 'books', borrowed: 'book', hasStatus: true };
        if (kind === 'journal') return { key: 'journal', table: 'journals', borrowed: 'journal', hasStatus: false };
        throw new ApiError('Unknown catalogue type.', 400);
    }

    const byName = (a, b) => a.bookname.localeCompare(b.bookname, undefined, { sensitivity: 'base', numeric: true });
    const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    const copy = (x) => JSON.parse(JSON.stringify(x));
    const plural = (n, one, many) => (n === 1 ? one : many);

    /* ------------------------------------------------------------- endpoints */

    const endpoints = {
        /* GET items.php?kind=&available= */
        async 'items.php'({ params }, db) {
            const k = kindConfig(params.kind);
            let rows = db[k.table];
            if (String(params.available) === '1') {
                rows = rows.filter((r) => (k.hasStatus ? r.quantity > 0 && r.status === 'Available' : r.quantity > 0));
            }
            return { items: copy([...rows].sort(byName)) };
        },

        /* POST item_save.php  (admin) */
        async 'item_save.php'({ body }, db) {
            requireAdmin();
            const k = kindConfig(body.kind);
            const hasId = body.id !== undefined && body.id !== null && body.id !== '';
            const id = hasId ? cleanInt(body.id, 'ID', 1, Number.MAX_SAFE_INTEGER) : null;
            const list = db[k.table];
            const existing = id !== null ? list.find((r) => r.id === id) : null;
            if (id !== null && !existing) throw new ApiError('That item no longer exists.', 404);

            const name = cleanText(body.bookname, 'Title');

            if (k.key === 'book') {
                const isbn = cleanIsbn(body.ISBN);
                const qty = cleanInt(body.quantity, 'Quantity', 0, 100000);
                const genre = cleanText(body.genre, 'Genre', 100);
                const author = cleanText(body.author, 'Author');
                const publisher = cleanText(body.publisher, 'Publisher');
                let status = body.status ?? 'Available';
                if (!['Available', 'Unavailable'].includes(status)) throw new ApiError('Status must be Available or Unavailable.');
                if (!GENRES.includes(genre) && (existing ? existing.genre : null) !== genre) throw new ApiError('Please choose a genre from the list.');
                if (qty === 0) status = 'Unavailable';
                if (list.some((r) => r.ISBN === isbn && r.id !== (id ?? 0))) throw new ApiError('Another book already uses that ISBN.', 409);

                if (id === null) {
                    const newId = ++db.seq.book;
                    list.push({ id: newId, bookname: name, ISBN: isbn, quantity: qty, genre, author, publisher, status });
                    save();
                    return { id: newId };
                }
                Object.assign(existing, { bookname: name, ISBN: isbn, quantity: qty, genre, author, publisher, status });
                save();
                return { id };
            }

            const qty = cleanInt(body.quantity, 'Quantity', 0, 100000);
            const date = cleanDate(body.date_published, 'Date published');
            if (id === null) {
                const newId = ++db.seq.journal;
                list.push({ id: newId, bookname: name, quantity: qty, date_published: date });
                save();
                return { id: newId };
            }
            Object.assign(existing, { bookname: name, quantity: qty, date_published: date });
            save();
            return { id };
        },

        /* POST item_archive.php  (admin) */
        async 'item_archive.php'({ body }, db) {
            requireAdmin();
            const k = kindConfig(body.kind);
            const id = cleanInt(body.id, 'ID', 1, Number.MAX_SAFE_INTEGER);
            const list = db[k.table];
            const idx = list.findIndex((r) => r.id === id);
            if (idx < 0) throw new ApiError('That item no longer exists.', 404);

            const out = db.borrowed[k.borrowed].filter((l) => l.bookID === id).reduce((s, l) => s + l.quantity, 0);
            if (out > 0) {
                throw new ApiError(`Can’t archive yet: ${out} ${out === 1 ? 'copy is' : 'copies are'} still borrowed.`, 409);
            }
            const row = list[idx];
            const archived = copy(row);
            delete archived.status;
            archived.archived_at = nowStamp();
            db.archives[k.key].unshift(archived);
            list.splice(idx, 1);
            save();
            return {};
        },

        /* GET logs.php  (admin) */
        async 'logs.php'({ params }, db) {
            requireAdmin();
            const k = kindConfig(params.kind);
            const rows = [...db.logs[k.key]].sort((a, b) =>
                (a.date_to_be_borrowed < b.date_to_be_borrowed ? 1 : a.date_to_be_borrowed > b.date_to_be_borrowed ? -1 : b.transactionID - a.transactionID));
            return { rows: copy(rows) };
        },

        /* GET archives.php  (admin) */
        async 'archives.php'({ params }, db) {
            requireAdmin();
            const k = kindConfig(params.kind);
            return { rows: copy(db.archives[k.key]) };
        },

        /* POST borrow.php */
        async 'borrow.php'({ body }, db) {
            const k = kindConfig(body.kind);
            const stn = cleanStudentNumber(body.stn);
            const name = cleanPersonName(body.fullname);
            const itemId = cleanInt(body.item_id, 'Title', 1, Number.MAX_SAFE_INTEGER);
            const qty = cleanInt(body.quantity, 'Quantity', 1, MAX_COPIES);

            const row = db[k.table].find((r) => r.id === itemId);
            if (!row) throw new ApiError('That title is no longer in the catalogue.', 404);
            if (k.hasStatus && row.status !== 'Available') throw new ApiError('Sorry, this title is currently unavailable.', 409);
            if (row.quantity < qty) {
                const n = row.quantity;
                throw new ApiError(n <= 0 ? 'Sorry, no copies are left.' : `Only ${n} ${n === 1 ? 'copy is' : 'copies are'} available.`, 409);
            }

            const loans = db.borrowed[k.borrowed];
            const holder = loans.find((l) => l.STN === stn);
            if (holder && !sameName(holder.fullname, name)) {
                throw new ApiError('That student number has active loans under a different name. Please check both fields.', 409);
            }
            if (loans.some((l) => l.STN === stn && l.bookID === itemId)) {
                throw new ApiError('You already have this title borrowed. Return it first to borrow it again.', 409);
            }
            const held = loans.filter((l) => l.STN === stn).reduce((s, l) => s + l.quantity, 0);
            if (held + qty > MAX_COPIES) {
                const left = Math.max(0, MAX_COPIES - held);
                throw new ApiError(`Borrow limit reached: you can hold at most ${MAX_COPIES} copies at a time` + (left > 0 ? ` (you can still borrow ${left}).` : '.'), 409);
            }

            const txKey = k.key + 'Tx';
            const tx = ++db.seq[txKey];
            const date = today();
            loans.push({ transactionID: tx, bookID: itemId, bookname: row.bookname, quantity: qty, fullname: name, STN: stn, date_to_be_borrowed: date });
            db.logs[k.key].push({ transactionID: tx, bookname: row.bookname, quantity: qty, fullname: name, STN: stn, date_to_be_borrowed: date, return_date: null });
            row.quantity -= qty;
            if (k.hasStatus && row.quantity <= 0) row.status = 'Unavailable';
            save();
            return { transactionID: tx, title: row.bookname, quantity: qty };
        },

        /* POST loans.php */
        async 'loans.php'({ body }, db) {
            const k = kindConfig(body.kind);
            const stn = cleanStudentNumber(body.stn);
            const name = cleanPersonName(body.fullname);
            const loans = db.borrowed[k.borrowed]
                .filter((l) => l.STN === stn && sameName(l.fullname, name))
                .sort((a, b) => (a.date_to_be_borrowed < b.date_to_be_borrowed ? -1 : a.date_to_be_borrowed > b.date_to_be_borrowed ? 1 : a.transactionID - b.transactionID))
                .map((l) => ({ transactionID: l.transactionID, bookname: l.bookname, quantity: l.quantity, date_to_be_borrowed: l.date_to_be_borrowed }));
            return { loans };
        },

        /* POST return.php */
        async 'return.php'({ body }, db) {
            const k = kindConfig(body.kind);
            const stn = cleanStudentNumber(body.stn);
            const name = cleanPersonName(body.fullname);
            const tx = cleanInt(body.transactionID, 'Loan', 1, Number.MAX_SAFE_INTEGER);
            const qty = cleanInt(body.quantity, 'Quantity', 1, 100000);

            const loans = db.borrowed[k.borrowed];
            const loan = loans.find((l) => l.transactionID === tx && l.STN === stn && sameName(l.fullname, name));
            if (!loan) throw new ApiError('We couldn’t find that loan for this student.', 404);
            if (qty > loan.quantity) throw new ApiError(`You only have ${loan.quantity} of this title on loan.`, 409);

            const remaining = loan.quantity - qty;
            if (remaining === 0) {
                loans.splice(loans.indexOf(loan), 1);
                const log = db.logs[k.key].find((l) => l.transactionID === tx && !l.return_date);
                if (log) log.return_date = today();
            } else {
                loan.quantity = remaining;
            }

            const item = db[k.table].find((r) => r.id === loan.bookID);
            if (item) {
                item.quantity += qty;
                if (k.hasStatus && item.quantity > 0) item.status = 'Available';
            }
            save();
            return { title: loan.bookname, returned: qty, remaining };
        },
    };

    /* ------------------------------------------------------------------ auth */

    function currentUser() {
        try { return JSON.parse(window.sessionStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
    }
    function requireAdmin() {
        if (!currentUser()) throw new ApiError('Your session has expired. Please log in again.', 401);
    }

    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MS = 60000;

    async function login(username, password) {
        const db = await load();
        let state = {};
        try { state = JSON.parse(window.sessionStorage.getItem('lms-demo-lock') || '{}'); } catch (e) { /* ignore */ }
        if ((state.until || 0) > Date.now()) throw new ApiError('Too many failed attempts. Please wait a minute and try again.', 429);

        const user = db.users.find((u) => u.username === String(username).trim());
        const ok = user && user.password === (await hash(String(password)));
        if (ok) {
            window.sessionStorage.removeItem('lms-demo-lock');
            window.sessionStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, name: user.full_name }));
            return { id: user.id, name: user.full_name };
        }
        state.fails = (state.fails || 0) + 1;
        if (state.fails >= MAX_ATTEMPTS) { state.until = Date.now() + LOCKOUT_MS; state.fails = 0; }
        window.sessionStorage.setItem('lms-demo-lock', JSON.stringify(state));
        throw new ApiError('Incorrect username or password.', 401);
    }

    function logout() {
        try { window.sessionStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ }
    }

    async function addAdmin({ fullname, username, password, password2 }) {
        requireAdmin();
        const db = await load();
        const errors = [];
        const name = String(fullname || '').replace(/\s+/g, ' ').trim();
        const uname = String(username || '').trim();
        if (name === '' || [...name].length > 255) errors.push('Please enter the full name (up to 255 characters).');
        if (!/^[A-Za-z0-9._@-]{3,50}$/.test(uname)) errors.push('Username must be 3–50 characters: letters, numbers, and . _ @ - only.');
        if (String(password).length < 8) errors.push('Password must be at least 8 characters long.');
        if (String(password).length > 72) errors.push('Password must be 72 characters or fewer.');
        if (password !== password2) errors.push('Passwords do not match.');
        if (!errors.length && db.users.some((u) => u.username === uname)) errors.push('That username is already taken.');
        if (errors.length) throw Object.assign(new ApiError(errors[0]), { all: errors });

        db.users.push({ id: db.users.length ? Math.max(...db.users.map((u) => u.id)) + 1 : 1, full_name: name, username: uname, password: await hash(password) });
        save();
    }

    /* --------------------------------------------------------------- public */

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    window.Store = {
        GENRES,
        ApiError,
        currentUser,
        login,
        logout,
        addAdmin,
        reset,
        /** Same shape as the old fetch('api/…'): resolves with the data, rejects with {message,status}. */
        async call(endpoint, { body, params } = {}) {
            const handler = endpoints[endpoint];
            if (!handler) throw new ApiError('Unknown endpoint.', 404);
            await sleep(90 + Math.random() * 110);             // feel like a real request
            const db = await load();
            return handler({ body: body || {}, params: params || {} }, db);
        },
        ready: load,
    };
})();
