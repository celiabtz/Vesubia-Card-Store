
/* ==========================================
   VESUBIA CARD STORE
   SYSTEME MODE SOMBRE / MODE CLAIR
========================================== */

const themeButton = document.getElementById("theme-toggle");
const body = document.body;

// Recuperer le theme sauvegarde
const savedTheme = localStorage.getItem("vesubia-theme");

// Initialiser le theme
if (savedTheme === "light") {
    body.classList.add("light-theme");
} else {
    body.classList.remove("light-theme");
}

// Mettre a jour le bouton
function updateThemeButton() {

    if (body.classList.contains("light-theme")) {

        themeButton.textContent = "☾";
        themeButton.setAttribute(
            "aria-label",
            "Activer le mode sombre"
        );

        themeButton.setAttribute(
            "title",
            "Activer le mode sombre"
        );

    } else {

        themeButton.textContent = "☼";
        themeButton.setAttribute(
            "aria-label",
            "Activer le mode clair"
        );

        themeButton.setAttribute(
            "title",
            "Activer le mode clair"
        );

    }
}

// Initialisation du bouton
if (themeButton) {

    updateThemeButton();

    themeButton.addEventListener("click", function () {

        // Changer de theme
        body.classList.toggle("light-theme");

        // Determiner le theme actif
        const currentTheme =
            body.classList.contains("light-theme")
                ? "light"
                : "dark";

        // Sauvegarder le choix
        localStorage.setItem(
            "vesubia-theme",
            currentTheme
        );

        // Actualiser le bouton
        updateThemeButton();

    });

}
