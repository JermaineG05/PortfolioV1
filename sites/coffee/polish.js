/* Shared behaviour: navbar state, hero effects, scroll reveal, page-leave fade, ripple, back-to-top */
document.addEventListener("DOMContentLoaded", function () {
    const navbar = document.querySelector(".navbar");
    const hero = document.querySelector(".title");

    // ----- Scroll progress bar + back-to-top -----
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    document.body.appendChild(bar);

    const toTop = document.createElement("button");
    toTop.className = "to-top";
    toTop.type = "button";
    toTop.setAttribute("aria-label", "Back to top");
    toTop.textContent = "\u2191";
    toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    document.body.appendChild(toTop);

    // ----- Hero: background image (slow zoom + parallax), word-by-word title, scroll hint -----
    let heroBg = null, hint = null;
    if (hero) {
        const img = getComputedStyle(hero).backgroundImage;
        if (img && img !== "none") {
            heroBg = document.createElement("div");
            heroBg.className = "hero-bg";
            const inner = document.createElement("i");
            inner.style.backgroundImage = img;
            heroBg.appendChild(inner);
            hero.insertBefore(heroBg, hero.firstChild);
            hero.style.backgroundImage = "none";
        }
        const h1 = hero.querySelector("h1");
        if (h1) {
            const words = h1.textContent.trim().split(/\s+/);
            h1.textContent = "";
            words.forEach((word, i) => {
                const outer = document.createElement("span");
                outer.className = "w";
                const inner = document.createElement("span");
                inner.textContent = word;
                inner.style.setProperty("--i", i);
                outer.appendChild(inner);
                h1.appendChild(outer);
                if (i < words.length - 1) h1.appendChild(document.createTextNode(" "));
            });
            h1.classList.add("split");
        }
        hint = document.createElement("div");
        hint.className = "scroll-hint";
        hint.setAttribute("aria-hidden", "true");
        hero.appendChild(hint);
    }

    let ticking = false;
    function onScroll() {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
        if (navbar) navbar.classList.toggle("scrolled", y > 30);
        toTop.classList.toggle("show", y > 500);
        if (hint) hint.classList.toggle("hide", y > 60);
        if (heroBg && hero) heroBg.style.transform = "translate3d(0," + Math.min(y * 0.12, hero.offsetHeight * 0.14) + "px,0)";
        ticking = false;
    }
    window.addEventListener("scroll", () => {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    // ----- Highlight the current page in the nav -----
    const here = location.pathname.split("/").pop() || "homepage.html";
    document.querySelectorAll(".navbar-menu a").forEach(a => {
        if (a.getAttribute("href") === here) {
            a.classList.add("active");
            a.setAttribute("aria-current", "page");
        }
    });

    // ----- Fade the page content out before moving to another page (navbar stays put) -----
    document.querySelectorAll(".navbar-menu a").forEach(a => {
        a.addEventListener("click", function (e) {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            if (a.classList.contains("active")) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
            document.body.classList.add("leaving");
            setTimeout(() => { window.location.href = a.href; }, 230);
        });
    });
    window.addEventListener("pageshow", () => document.body.classList.remove("leaving"));

    // ----- Scroll reveal: text, cards, accordion items drop in one after another -----
    const targets = document.querySelectorAll(
        ".text-section > *, .info-section .info-card, .info-cards .card, .text-block, .accordion-item"
    );
    targets.forEach(el => {
        const sibs = Array.from(el.parentElement.children).filter(c => c.matches(".text-section > *, .info-card, .card, .text-block, .accordion-item"));
        el.style.setProperty("--d", Math.min(sibs.indexOf(el) * 0.12, 0.6) + "s");
    });
    if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
        targets.forEach(el => io.observe(el));
    } else {
        targets.forEach(el => el.classList.add("in-view"));
    }

    // ----- Click ripple on buttons and cards -----
    document.querySelectorAll(".accordion-header, .info-card, .btn, .card").forEach(el => {
        el.classList.add("ripple-host");
        el.addEventListener("pointerdown", function (e) {
            const r = el.getBoundingClientRect();
            const dot = document.createElement("span");
            dot.className = "ripple-dot";
            dot.style.left = (e.clientX - r.left) + "px";
            dot.style.top = (e.clientY - r.top) + "px";
            el.appendChild(dot);
            dot.addEventListener("animationend", () => dot.remove());
        });
    });
});
