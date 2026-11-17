// ==========================================
// VESUBIA CARD STORE - DASHBOARD ADMIN
// Gestion des statistiques et du stock
// ==========================================

let dashboardProducts = [];
let currentProductFilter = "all";
let currentProductSearch = "";

// ==========================================
// STATISTIQUES
// ==========================================

async function loadDashboardStats() {
    const [total, featured, lowStock] = await Promise.all([
        supabaseClient
            .from("products")
            .select("id", { count: "exact", head: true }),

        supabaseClient
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("featured", true),

        supabaseClient
            .from("products")
            .select("id", { count: "exact", head: true })
            .gte("stock", 4)
            .lte("stock", 10)
    ]);

    if (total.error || featured.error || lowStock.error) {
        console.error("Erreur statistiques :", total.error, featured.error, lowStock.error);
        return;
    }

    document.getElementById("stat-products").textContent = total.count ?? 0;
    document.getElementById("stat-featured").textContent = featured.count ?? 0;
    document.getElementById("stat-low-stock").textContent = lowStock.count ?? 0;
}

// ==========================================
// CHARGEMENT DES PRODUITS
// ==========================================

async function loadDashboardProducts() {
    const { data, error } = await supabaseClient
        .from("products")
        .select("id, name, description, price, stock, category, image_url, featured")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erreur chargement produits :", error);
        alert("Impossible de charger les produits.");
        return false;
    }

    dashboardProducts = data || [];
    return true;
}

// ==========================================
// FILTRES
// ==========================================

function getFilteredProducts(filter) {
    switch (filter) {
        case "featured":
            return dashboardProducts.filter(product => product.featured === true);

        case "low-stock":
            return dashboardProducts.filter(product => {
                const stock = Number(product.stock ?? 0);
                return stock >= 4 && stock <= 10;
            });

        case "critical":
            return dashboardProducts.filter(product => {
                const stock = Number(product.stock ?? 0);
                return stock >= 1 && stock <= 3;
            });

        case "out-of-stock":
            return dashboardProducts.filter(product =>
                Number(product.stock ?? 0) === 0
            );

        default:
            return dashboardProducts;
    }
}

function getFilterTitle(filter) {
    const titles = {
        all: "Tous les produits",
        featured: "Produits à la une",
        "low-stock": "Stock faible (4 à 10)",
        critical: "Stock critique (1 à 3)",
        "out-of-stock": "Produits en rupture"
    };

    return titles[filter] || "Produits";
}

// ==========================================
// STYLE DES FILTRES
// ==========================================

function addDashboardStyles() {
    if (document.getElementById("dashboard-stock-styles")) return;

    const style = document.createElement("style");
    style.id = "dashboard-stock-styles";

    style.textContent = `
        .dashboard-stock-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 15px 0 25px;
        }

        .dashboard-filter-button {
            padding: 10px 16px;
            border: 1px solid rgba(255,217,40,.35);
            border-radius: 7px;
            background: #151518;
            color: #F5F2E9;
            cursor: pointer;
            font: inherit;
            transition: .2s;
        }

        .dashboard-filter-button:hover,
        .dashboard-filter-button.is-active {
            background: #FFD928;
            color: #101013;
            border-color: #FFD928;
        }

        .dashboard-product-stock {
            margin: 10px 0;
            color: #FFD928;
            font-weight: 700;
        }

        .dashboard-delete-button {
            margin-top: 12px;
            padding: 10px 15px;
            border: 1px solid #E53935;
            border-radius: 6px;
            background: rgba(229,57,53,.10);
            color: #FF7772;
            cursor: pointer;
            font: inherit;
        }

        .dashboard-delete-button:hover {
            background: #E53935;
            color: white;
        }

        .dashboard-empty {
            padding: 25px;
            text-align: center;
            color: #B9B9BE;
        }

        @media(max-width:600px) {
            .dashboard-stock-filters {
                display: grid;
                grid-template-columns: 1fr 1fr;
            }
        }
    `;

    document.head.appendChild(style);
}

// ==========================================
// AFFICHAGE DES FILTRES
// ==========================================

function createFilterButtons() {
    const content = document.getElementById("dashboard-products-content");
    if (!content) return;

    // Barre de recherche
    const search = document.createElement("input");
    search.type = "search";
    search.id = "dashboard-stock-search";
    search.placeholder = "Rechercher une carte, une catégorie...";
    search.className = "dashboard-stock-search";
    search.value = currentProductSearch;

    search.addEventListener("input", () => {
        currentProductSearch = search.value;
        renderDashboardProducts();
    });

    content.appendChild(search);

    const filters = [
        ["all", "Tous"],
        ["featured", "À la une"],
        ["low-stock", "Stock faible"],
        ["critical", "Stock critique"],
        ["out-of-stock", "En rupture"]
    ];

    const toolbar = document.createElement("div");
    toolbar.className = "dashboard-stock-filters";

    filters.forEach(([value, label]) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "dashboard-filter-button";
        button.textContent = label;
        button.dataset.filter = value;

        if (value === currentProductFilter) {
            button.classList.add("is-active");
        }

        button.addEventListener("click", () => {
            currentProductFilter = value;

            toolbar.querySelectorAll("button").forEach(item => {
                item.classList.toggle(
                    "is-active",
                    item.dataset.filter === value
                );
            });

            renderDashboardProducts();
        });

        toolbar.appendChild(button);
    });

    content.appendChild(toolbar);
}

// ==========================================
// AFFICHAGE DES CARTES
// ==========================================

function renderDashboardProducts() {
    const content = document.getElementById("dashboard-products-content");
    if (!content) return;

    const oldGrid = content.querySelector(".admin-products-grid");
    if (oldGrid) oldGrid.remove();

    const searchTerm = currentProductSearch.trim().toLowerCase();

const products = getFilteredProducts(currentProductFilter).filter(product => {
    return (
        (product.name || "").toLowerCase().includes(searchTerm) ||
        (product.category || "").toLowerCase().includes(searchTerm) ||
        (product.description || "").toLowerCase().includes(searchTerm)
    );
});

    const grid = document.createElement("div");
    grid.className = "admin-products-grid";

    if (products.length === 0) {
        const empty = document.createElement("p");
        empty.className = "dashboard-empty";
        empty.textContent = "Aucune carte dans cette catégorie.";
        grid.appendChild(empty);
        content.appendChild(grid);
        return;
    }

    products.forEach(product => {
        const card = document.createElement("article");
        card.className = "admin-product-card";

        if (product.image_url) {
            const image = document.createElement("img");
            image.src = product.image_url;
            image.alt = product.name || "Carte";
            image.loading = "lazy";
            card.appendChild(image);
        }

        const details = document.createElement("div");
        details.className = "admin-product-details";

        const name = document.createElement("h3");
        name.textContent = product.name || "Produit sans nom";
        details.appendChild(name);

        const category = document.createElement("p");
        category.textContent = "Catégorie : " + (product.category || "Non définie");
        details.appendChild(category);

        const price = document.createElement("p");
        price.className = "admin-product-price";
        price.textContent = Number(product.price || 0).toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR"
        });
        details.appendChild(price);

        const stock = Number(product.stock ?? 0);

        const stockText = document.createElement("p");
        stockText.className = "dashboard-product-stock";

        if (stock === 0) {
            stockText.textContent = "En rupture de stock";
        } else if (stock <= 3) {
            stockText.textContent = "Stock critique : " + stock;
        } else if (stock <= 10) {
            stockText.textContent = "Stock faible : " + stock;
        } else {
            stockText.textContent = "Disponible : " + stock;
        }

        details.appendChild(stockText);

        if (product.featured) {
            const featured = document.createElement("p");
            featured.textContent = "★ Produit à la une";
            details.appendChild(featured);
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "dashboard-delete-button";
        deleteButton.textContent = "Supprimer";

        deleteButton.addEventListener("click", () => {
            deleteDashboardProduct(product, deleteButton);
        });

        details.appendChild(deleteButton);
        card.appendChild(details);
        grid.appendChild(card);
    });

    content.appendChild(grid);
}// ==========================================
// OUVERTURE DE LA LISTE
// ==========================================

async function openProductList(filter) {
    const section = document.getElementById("dashboard-product-list");
    const content = document.getElementById("dashboard-products-content");
    const title = document.getElementById("dashboard-list-title");

    if (!section || !content || !title) {
        console.error("Section de gestion des produits introuvable.");
        return;
    }

    currentProductFilter = filter;

    section.hidden = false;
    title.textContent = getFilterTitle(filter);
    content.replaceChildren();

    const loading = document.createElement("p");
    loading.textContent = "Chargement des produits...";
    content.appendChild(loading);

    const success = await loadDashboardProducts();

    if (!success) return;

    content.replaceChildren();

    addDashboardStyles();
    createFilterButtons();
    renderDashboardProducts();

    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ==========================================
// SUPPRESSION D'UN PRODUIT
// ==========================================

async function deleteDashboardProduct(product, button) {
    const confirmation = confirm(
        "Supprimer définitivement « " + product.name + " » ?\n\nCette action est irréversible."
    );

    if (!confirmation) return;

    button.disabled = true;
    button.textContent = "Suppression...";

    const { error } = await supabaseClient
        .from("products")
        .delete()
        .eq("id", product.id);

    if (error) {
        console.error("Erreur suppression :", error);
        alert("Impossible de supprimer ce produit : " + error.message);

        button.disabled = false;
        button.textContent = "Supprimer";
        return;
    }

    dashboardProducts = dashboardProducts.filter(item => item.id !== product.id);

    renderDashboardProducts();
    await loadDashboardStats();

    alert("Produit supprimé avec succès.");
}

// ==========================================
// GESTION DES AVIS CLIENTS
// ==========================================

async function loadDashboardReviews() {
    const list = document.getElementById("dashboard-reviews-list");
    const message = document.getElementById("reviews-admin-message");

    if (!list) return;

    list.replaceChildren();

    if (message) {
        message.textContent = "Chargement des avis...";
    }

    const { data: reviews, error } = await supabaseClient
        .from("reviews")
        .select("id, display_name, rating, comment, photo_urls, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erreur chargement des avis :", error);

        if (message) {
            message.textContent = "Impossible de charger les avis : " + error.message;
        }

        return;
    }

    if (!reviews || reviews.length === 0) {
        if (message) {
            message.textContent = "Aucun avis pour le moment.";
        }

        return;
    }

    if (message) {
        message.textContent = reviews.length + " avis client(s).";
    }

    reviews.forEach(review => {
        const card = document.createElement("article");
        card.className = "dashboard-review-card";

        const top = document.createElement("div");
        top.className = "dashboard-review-top";

        const identity = document.createElement("div");

        const name = document.createElement("h3");
        name.textContent = review.display_name || "Client";
        identity.appendChild(name);

        const stars = document.createElement("div");
        stars.className = "dashboard-review-stars";

        const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));

        stars.textContent =
            "★".repeat(rating) +
            "☆".repeat(5 - rating);

        identity.appendChild(stars);

        const date = document.createElement("span");
        date.className = "dashboard-review-date";

        date.textContent = review.created_at
            ? new Date(review.created_at).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            })
            : "Date inconnue";

        top.append(identity, date);
        card.appendChild(top);

        const comment = document.createElement("p");
        comment.className = "dashboard-review-comment";
        comment.textContent = review.comment || "Aucun commentaire.";

        card.appendChild(comment);

        // Photos jointes à l'avis
        const photos = Array.isArray(review.photo_urls)
            ? review.photo_urls
            : [];

        if (photos.length) {
            const gallery = document.createElement("div");
            gallery.className = "dashboard-review-photos";

            photos.forEach(url => {
                if (typeof url !== "string" || !url.startsWith("http")) {
                    return;
                }

                const link = document.createElement("a");
                link.href = url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";

                const image = document.createElement("img");
                image.src = url;
                image.alt = "Photo jointe à l'avis";
                image.loading = "lazy";

                link.appendChild(image);
                gallery.appendChild(link);
            });

            if (gallery.childElementCount) {
                card.appendChild(gallery);
            }
        }

        // Bouton de suppression
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "dashboard-review-delete";
        deleteButton.textContent = "Supprimer cet avis";

        deleteButton.addEventListener("click", () => {
            deleteDashboardReview(review, deleteButton);
        });

        card.appendChild(deleteButton);
        list.appendChild(card);
    });
}

// ==========================================
// RÉCUPÉRATION DU CHEMIN DES PHOTOS
// ==========================================

function getReviewStoragePath(publicUrl) {
    if (typeof publicUrl !== "string") return null;

    const marker = "/storage/v1/object/public/review-photos/";
    const markerIndex = publicUrl.indexOf(marker);

    if (markerIndex === -1) return null;

    const encodedPath = publicUrl
        .slice(markerIndex + marker.length)
        .split("?")[0];

    try {
        return decodeURIComponent(encodedPath);
    } catch (error) {
        return encodedPath;
    }
}

// ==========================================
// SUPPRESSION D'UN AVIS ET DE SES PHOTOS
// ==========================================

async function deleteDashboardReview(review, button) {
    const confirmation = confirm(
        "Supprimer définitivement l'avis de « " +
        (review.display_name || "ce client") +
        " » ?\n\nSes photos seront également supprimées. Cette action est irréversible."
    );

    if (!confirmation) return;

    button.disabled = true;
    button.textContent = "Suppression...";

    const photoUrls = Array.isArray(review.photo_urls)
        ? review.photo_urls
        : [];

    const photoPaths = photoUrls
        .map(getReviewStoragePath)
        .filter(Boolean);

    // Suppression des photos dans Supabase Storage
    if (photoPaths.length) {
        const { error: storageError } = await supabaseClient
            .storage
            .from("review-photos")
            .remove(photoPaths);

        if (storageError) {
            console.error("Erreur suppression des photos :", storageError);

            alert(
                "Impossible de supprimer les photos : " +
                storageError.message +
                "\nL'avis n'a pas été supprimé."
            );

            button.disabled = false;
            button.textContent = "Supprimer cet avis";
            return;
        }
    }

    // Suppression de l'avis dans la base de données
    const { error } = await supabaseClient
        .from("reviews")
        .delete()
        .eq("id", review.id);

    if (error) {
        console.error("Erreur suppression avis :", error);

        alert("Impossible de supprimer cet avis : " + error.message);

        button.disabled = false;
        button.textContent = "Supprimer cet avis";
        return;
    }

    await loadDashboardReviews();
}// ==========================================
// INITIALISATION ET PROTECTION ADMIN
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    const dashboard = document.querySelector(".admin-container");

    if (!dashboard) return;

    dashboard.hidden = true;

    // Gestion des clics sur les statistiques
    document.querySelectorAll(".stat-clickable").forEach(button => {
        button.addEventListener("click", () => {
            openProductList(button.dataset.filter || "all");
        });
    });

    // Fermeture de la liste des produits
    const closeButton = document.getElementById("close-product-list");

    if (closeButton) {
        closeButton.addEventListener("click", () => {
            document.getElementById("dashboard-product-list").hidden = true;
        });
    }

    // Actualisation des avis
    const refreshReviewsButton = document.getElementById("refresh-reviews");

    if (refreshReviewsButton) {
        refreshReviewsButton.addEventListener("click", loadDashboardReviews);
    }

    // Déconnexion
    const logoutButton = document.getElementById("dashboard-logout");

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            logoutButton.disabled = true;
            logoutButton.textContent = "Déconnexion...";

            const { error } = await supabaseClient.auth.signOut();

            if (error) {
                console.error(error);

                logoutButton.disabled = false;
                logoutButton.textContent = "Déconnexion";

                alert("Impossible de te déconnecter.");
                return;
            }

            window.location.replace("admin.html");
        });
    }

    // Vérification de la session
    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error || !data.session) {
            window.location.replace("admin.html");
            return;
        }

        const user = data.session.user;

        const { data: admin, error: adminError } = await supabaseClient
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (adminError || !admin) {
            await supabaseClient.auth.signOut();
            window.location.replace("admin.html");
            return;
        }

        // Accès administrateur autorisé
        dashboard.hidden = false;

        await loadDashboardStats();
        await loadDashboardReviews();

    } catch (error) {
        console.error("Erreur de vérification :", error);
        window.location.replace("admin.html");
    }
});