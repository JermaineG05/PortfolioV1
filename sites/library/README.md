# Library Management System: browser-only demo

Converted from a PHP 8 + MariaDB/MySQL project (Systems Plus Computer College) into plain HTML, CSS and JavaScript
so it can run on any static host, with no server and no database.

- `assets/js/store.js`: replaces the database and the old `api/*.php` files. Data is kept in `localStorage`;
  the signed-in admin is kept in `sessionStorage`. The rules (3-copy limit, no negative stock, can't archive while on loan,
  validation messages) were ported from `includes/library.php`.
- `assets/js/app.js`, `pages.js`: the original front-end scripts; `app.api()` now calls the Store instead of `fetch()`.
- `assets/js/auth.js`: login / add admin / logout (were PHP pages).
- HTML pages: static versions of the old `.php` pages. The notice shown before the site loads is in each page (`#demo-notice`).
- Demo admin: `admin` / `admin1234`. "Reset demo data" in the footer restores the sample data.
