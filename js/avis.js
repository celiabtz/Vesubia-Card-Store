
document.addEventListener("DOMContentLoaded", () => {

    const button = document.getElementById("menu-toggle");
    const menu = document.getElementById("main-nav");

    if (!button || !menu) return;

    button.addEventListener("click", () => {
        const opened = menu.classList.toggle("is-open");

        button.classList.toggle("active", opened);
        button.setAttribute("aria-expanded", opened);
        button.setAttribute(
            "aria-label",
            opened ? "Fermer le menu" : "Ouvrir le menu"
        );
    });

    menu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            menu.classList.remove("is-open");
            button.classList.remove("active");
            button.setAttribute("aria-expanded", "false");
        });
    });

});
