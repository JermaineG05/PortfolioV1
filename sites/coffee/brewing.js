document.addEventListener("DOMContentLoaded", function () {
    const items = document.querySelectorAll(".accordion-item");

    function close(item) {
        item.classList.remove("open");
        item.querySelector(".accordion-content").style.maxHeight = null;
        item.querySelector(".accordion-header").setAttribute("aria-expanded", "false");
    }

    function open(item) {
        const content = item.querySelector(".accordion-content");
        item.classList.add("open");
        content.style.maxHeight = content.scrollHeight + "px";
        item.querySelector(".accordion-header").setAttribute("aria-expanded", "true");
    }

    items.forEach(item => {
        item.querySelector(".accordion-header").addEventListener("click", function () {
            const wasOpen = item.classList.contains("open");
            items.forEach(close);
            if (!wasOpen) open(item);
        });
    });

    // Keep open panel sized correctly if the window is resized
    window.addEventListener("resize", () => {
        const o = document.querySelector(".accordion-item.open .accordion-content");
        if (o) o.style.maxHeight = o.scrollHeight + "px";
    });
});
