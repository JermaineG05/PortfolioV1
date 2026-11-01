# Study Buddy – what was fixed and polished

## Bugs that broke the site
1. **Login/Register page crashed on load** (`aws.js`): leftover code outside any function read `#filter-year` before it existed, and `userPagesContainer` pointed to an element that was never in the HTML. Logging in was impossible.
2. **Stray/duplicated code** after `createBuddyListPage()` (duplicate `renderBuddies`, calls to undefined functions) removed.
3. **`LOGGED OUT/about.html` loaded a non-existent `about.js`** (404).
4. **`C:\CASE STUDY\...` paths** in `LOGGED IN/about.html` and `home.html` only worked on the author's PC. All links/images/CSS are now relative.
5. **Root-absolute paths** (`/IMGS/...`, `/LOGGED OUT/...`) broke when opened from a folder or `file://`. Now relative.
6. **Wrong navigation**: logged-in "About Us" went to the logged-out page; "Profile" went to the login screen; Sign Out sent users to About; `/PAGES/home.html` didn't exist; Profile page "Profile" link was `#`.
7. **Profile page crashed** for signed-out visitors (redirected, then kept running on `null`).
8. **Default avatar broken** on most pages (`"nopfp.png"` only resolved inside `LOGIN/`).
9. **Broken HTML**: duplicate `</header>`, stray `</a>`, `</strong>`, `<a>` wrapping a `<div>`, `<br>` abuse, inverted logo/title order, missing `alt`s, wrong page title ("About Us" on Profile).
10. **Invalid CSS**: `rgba(#000, .075)` (Sass syntax), `font-style: bold`, `max-width:30%` + `min-width:50%`, undefined `--tooltip-color`, undefined `.blue-btn`, `height:100%` without `html`.

## Security / data
- **XSS**: user text was injected with `innerHTML` and inline `onclick="alert('${name}')"`. Everything is now built with `textContent`.
- **Passwords were stored in plain text** (and the whole user record, password included, was copied into `loggedInUser`). Now salted SHA-256; the session stores only the email. Old accounts still log in and are upgraded automatically.
- Large photos could overflow `localStorage` silently; photos are now cropped/resized to 256px and storage errors are reported.
- Emails are normalised (case-insensitive duplicates blocked), corrupt storage no longer crashes pages.
- Age is no longer shown on public buddy cards (privacy); it remains on the owner's profile.

## Features that didn't work
- Subject filter was a hard-coded list (Math/English/…) vs. free-text input, and the Language filter offered English/Tagalog while users store programming languages → both never matched. Filters are now built from real data, case-insensitive. Added name/topic search and a Clear button.
- "Request Buddy"/"Contact Now" only popped an `alert`. Now records the request and shows a toast; button turns into "Request sent ✓".
- Registration: multi-select needing Ctrl-click replaced by checkboxes; added confirm-password, validation messages (no `alert()`), real labels.

## Polish
- Five duplicated stylesheets (~1,500 lines) → one `shared/style.css`; duplicated header/footer/SVGs → `shared/app.js`. Logged-in/out pages differ only by a few attributes.
- Responsive header and layouts (original had fixed 800px/500px/830px widths and an absolutely positioned Sign-In button overlapping content). Works on phones.
- Accessible contrast (white-on-light-blue buttons fixed), visible labels and focus rings, skip link, `aria-current`, reduced-motion support.
- Images: 5.9 MB → 140 KB (logo 2048px→320px, hero 4320px PNG→1920px JPG). Unused images (`bg.jpg`, `bg1.jpg`, `bgg.jpg`, `bg3.jpg`) and Visual Studio `.vs/` cache dropped.
- Fonts: 5 requests → 1; unused Poppins/Montserrat removed. Footer year is automatic.
- About page: Lorem ipsum replaced with real copy and a "How it works" list. **Please review the wording.**

## Still to do on your side
- Social-link `href="#"` placeholders in the About page need real URLs.
- This is a front-end-only demo (data lives in each browser's localStorage). Real authentication needs a backend.
