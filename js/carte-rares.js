const rareClient = window.supabase.createClient(
    "https://tljpepeuytgsyhbqiswq.supabase.co",
    "sb_publishable_UU80Kg9wvEJ1_9jx7vesOg_v42-tmsZ"
);

const grid = document.getElementById("rare-cards-grid");
const empty = document.getElementById("rare-empty");
const searchInput = document.getElementById("rare-card-search");

let allRareCards = [];
let activeFilter = "all";
let searchTerm = "";

async function loadRareCards() {
    const { data: cards, error } = await rareClient
        .from("rare_cards")
        .select("*")
        .eq("available", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erreur chargement cartes :", error);

        if (empty) {
            empty.style.display = "block";
            empty.querySelector("h3").textContent =
                "Impossible de charger la collection";
        }

        return;
    }

    allRareCards = cards || [];
    setupFilters();
    applyFilters();
}

// =========================
// FILTRES PSA / PCA / CGC
// =========================

function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function setupFilters() {
    const buttons = document.querySelectorAll("button");

    buttons.forEach(button => {
        const text = normalizeText(button.textContent);

        if (text.includes("toutes les cartes")) {
            button.addEventListener("click", () => setFilter("all"));
        }

        else if (text === "psa") {
            button.addEventListener("click", () => setFilter("psa"));
        }

        else if (text === "pca") {
            button.addEventListener("click", () => setFilter("pca"));
        }

        else if (text === "cgc") {
            button.addEventListener("click", () => setFilter("cgc"));
        }

        else if (text.includes("non gradees")) {
            button.addEventListener("click", () => setFilter("raw"));
        }
    });

    if (searchInput) {
        searchInput.addEventListener("input", event => {
            searchTerm = normalizeText(event.target.value);
            applyFilters();
        });
    }
}

function setFilter(filter) {
    activeFilter = filter;
    applyFilters();
}

function applyFilters() {
    let filteredCards = allRareCards;

    // Filtre par organisme de grading
    if (activeFilter !== "all") {
        filteredCards = filteredCards.filter(card => {
            const grader = normalizeText(card.grader || "");

            if (activeFilter === "raw") {
                return (
                    !grader ||
                    grader === "non gradee" ||
                    grader === "non gradée" ||
                    grader === "raw" ||
                    grader === "ungraded"
                );
            }

            return grader.includes(activeFilter);
        });
    }

    // Recherche textuelle
    if (searchTerm) {
        filteredCards = filteredCards.filter(card => {
            const searchableText = normalizeText([
                card.name,
                card.grader,
                card.rarity,
                card.card_set,
                card.card_number,
                card.language,
                card.condition
            ].join(" "));

            return searchableText.includes(searchTerm);
        });
    }

    renderCards(filteredCards);
}

// =========================
// AFFICHAGE DES CARTES
// =========================

function renderCards(cards) {
    grid.innerHTML = "";

    if (empty) {
        empty.style.display = cards.length === 0 ? "block" : "none";
    }

    if (!cards || cards.length === 0) {
        return;
    }

    cards.forEach(card => {
        const article = document.createElement("article");

        const tier = ["bronze", "gold", "diamond"].includes(card.tier)
            ? card.tier
            : "";

        article.className = "rare-card" + (tier ? " tier-" + tier : "");

        const grader = card.grader || "Non gradée";

        article.innerHTML = `
            <div class="rare-card-visual">
                <img src="${escapeAttribute(card.image_url)}"
                     alt="${escapeAttribute(card.name)}">

                <span class="rare-grade">
                    ${escapeHTML(grader)}
                    ${card.grade ? " " + escapeHTML(card.grade) : ""}
                </span>
            </div>

            <div class="rare-card-info">
                <span class="rare-card-category">
                    ${escapeHTML(card.rarity || "Carte de collection")}
                </span>

                <h3>${escapeHTML(card.name)}</h3>

                <div class="rare-details">
                    <div class="rare-detail">
                        <small>Extension</small>
                        <strong>${escapeHTML(card.card_set || "—")}</strong>
                    </div>

                    <div class="rare-detail">
                        <small>Numéro</small>
                        <strong>${escapeHTML(card.card_number || "—")}</strong>
                    </div>

                    <div class="rare-detail">
                        <small>Langue</small>
                        <strong>${escapeHTML(card.language || "—")}</strong>
                    </div>

                    <div class="rare-detail">
                        <small>État</small>
                        <strong>${escapeHTML(card.condition || "—")}</strong>
                    </div>
                </div>

                <div class="rare-price">
                    ${Number(card.price).toFixed(2).replace(".", ",")} €
                </div>

                <button class="rare-button rare-favorite-button" data-card-id="${escapeAttribute(card.id)}" type="button">
    ♡ Ajouter aux favoris
</button>
            </div>
        `;

        grid.appendChild(article);
    });
}

// =========================
// PROTECTION HTML
// =========================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function escapeAttribute(value) {
    return escapeHTML(value || "");
}
// =========================
// FAVORIS CARTES RARES
// =========================

grid.addEventListener("click", async (event) => {
    const button = event.target.closest(".rare-favorite-button");

    if (!button) return;

    const cardId = button.dataset.cardId;
    button.disabled = true;

    try {
        const { data: { user }, error: authError } =
            await rareClient.auth.getUser();

        if (authError) throw authError;

        if (!user) {
            window.location.href = "connexion.html";
            return;
        }

        const { data: existing, error: checkError } = await rareClient
            .from("rare_wishlist")
            .select("id")
            .eq("user_id", user.id)
            .eq("rare_card_id", cardId)
            .maybeSingle();

        if (checkError) throw checkError;

        // SI DÉJÀ EN FAVORIS : ON RETIRE
        if (existing) {
            const { error: deleteError } = await rareClient
                .from("rare_wishlist")
                .delete()
                .eq("id", existing.id);

            if (deleteError) throw deleteError;

            button.innerHTML = "♡ Ajouter aux favoris";
            button.classList.remove("is-favorite");

            return;
        }

        // SINON : ON AJOUTE
        const { error: insertError } = await rareClient
            .from("rare_wishlist")
            .insert({
                user_id: user.id,
                rare_card_id: cardId
            });

        if (insertError) throw insertError;

        button.innerHTML = "♥ Ajouté aux favoris";
        button.classList.add("is-favorite");

    } catch (error) {
        console.error("Erreur favoris carte rare :", error);
        alert("Erreur : " + (error.message || error));
    } finally {
        button.disabled = false;
    }
});

loadRareCards();