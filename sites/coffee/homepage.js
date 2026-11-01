document.addEventListener("DOMContentLoaded", function () {
    // Smooth scrolling for internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener("click", function (e) {
            e.preventDefault();
            const targetId = this.getAttribute("href").substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: "smooth"
                });
            }
        });
    });

    // Button click animation
    const buttons = document.querySelectorAll(".btn");
    buttons.forEach(button => {
        button.addEventListener("click", function () {
            this.classList.add("clicked");
            setTimeout(() => this.classList.remove("clicked"), 300);
        });
    });
});
