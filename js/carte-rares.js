
const rareClient = window.supabase.createClient(
    "https://tljpepeuytgsyhbqiswq.supabase.co",
    "sb_publishable_UU80Kg9wvEJ1_9jx7vesOg_v42-tmsZ"
);

const grid = document.getElementById("rare-cards-grid");
const empty = document.getElementById("rare-empty");

async function loadRareCards() {
    const { data: cards, error } = await rareClient
        .from("rare_cards")
        .select("*")
        .eq("available", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erreur chargement cartes :", error);
        empty.querySelector("h3").textContent = "Impossible de charger la collection";
        return;
    }

    grid.innerHTML = "";

    if (!cards || cards.length === 0) {
        grid.appendChild(empty);
        return;
    }

    cards.forEach(card => {
        const article = document.createElement("article");
        article.className = "rare-card";

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

                <a href="contact.html" class="rare-button">
                    Nous contacter
                </a>
            </div>
        `;

        grid.appendChild(article);
    });
}

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

loadRareCards();
