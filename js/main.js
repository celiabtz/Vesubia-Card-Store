
document.addEventListener("DOMContentLoaded", async () => {

    if (typeof supabaseClient === "undefined") {
        console.error("Connexion Supabase introuvable.");
        return;
    }

    const PRODUCT_PAGE = "produit.html";

let currentUser = null;
let wishlistIds = new Set();

async function loadWishlist() {
    const { data: { user }, error: authError } =
        await supabaseClient.auth.getUser();

    if (authError) throw authError;

    currentUser = user;

    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from("wishlist")
        .select("product_id")
        .eq("user_id", currentUser.id);

    if (error) throw error;

    wishlistIds = new Set((data || []).map(item => String(item.product_id)));
}

async function toggleWishlist(product, button) {
    if (!currentUser) {
        window.location.href = "connexion.html";
        return;
    }

    const productId = String(product.id);
    const isFavorite = wishlistIds.has(productId);

    button.disabled = true;

    try {
        if (isFavorite) {
            const { error } = await supabaseClient
                .from("wishlist")
                .delete()
                .eq("user_id", currentUser.id)
                .eq("product_id", productId);

            if (error) throw error;

            wishlistIds.delete(productId);
        } else {
            const { error } = await supabaseClient
                .from("wishlist")
                .insert({
                    user_id: currentUser.id,
                    product_id: productId
                });

            if (error) throw error;

            wishlistIds.add(productId);
        }

        button.classList.toggle("is-favorite", wishlistIds.has(productId));
        button.innerHTML = wishlistIds.has(productId)
            ? '<i class="fa-solid fa-heart"></i>'
            : '<i class="fa-regular fa-heart"></i>';

    } catch (error) {
        console.error("Erreur favoris :", error);
        alert("Impossible de modifier votre liste d'envies.");
    } finally {
        button.disabled = false;
    }
}

    function formatPrice(price) {
        const value = Number(price);

        if (!Number.isFinite(value)) return "Prix sur demande";

        return value.toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR"
        });
    }

    function productUrl(product) {
        return `${PRODUCT_PAGE}?id=${encodeURIComponent(product.id)}`;
    }

    // ==========================================
    // CRÉATION DES CARTES PRODUITS
    // ==========================================

    function createProductCard(product, featured = false) {

        const article = document.createElement("article");
        article.className = "product-card";
        article.tabIndex = 0;
        article.setAttribute("role", "link");
        article.setAttribute(
            "aria-label",
            `Découvrir ${product.name || "ce produit"}`
        );

        const destination = productUrl(product);

        // Toute la carte est cliquable
        article.addEventListener("click", event => {
            if (event.target.closest("a, button")) return;
            window.location.href = destination;
        });

        article.addEventListener("keydown", event => {
            if (event.target !== article) return;

            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                window.location.href = destination;
            }
        });

        // IMAGE
        const imageWrapper = document.createElement("div");
        imageWrapper.className = "product-image";

        const image = document.createElement("img");
        image.src = product.image_url || "";
        image.alt = product.name || "Produit Vesubia Card Store";
        image.loading = "lazy";

        imageWrapper.appendChild(image);


const favoriteButton = document.createElement("button");
favoriteButton.type = "button";
favoriteButton.className = "wishlist-button";

const isFavorite = wishlistIds.has(String(product.id));

favoriteButton.classList.toggle("is-favorite", isFavorite);
favoriteButton.innerHTML = isFavorite
    ? '<i class="fa-solid fa-heart"></i>'
    : '<i class="fa-regular fa-heart"></i>';

favoriteButton.setAttribute(
    "aria-label",
    isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
);

favoriteButton.addEventListener("click", event => {
    event.stopPropagation();
    toggleWishlist(product, favoriteButton);
});

imageWrapper.appendChild(favoriteButton);


        // BADGE À LA UNE
        if (featured && product.featured) {
            const badge = document.createElement("span");
            badge.className = "product-badge";
            badge.textContent = "À la une";
            imageWrapper.appendChild(badge);
        }

        // INFORMATIONS
        const info = document.createElement("div");
        info.className = "product-info";

        const title = document.createElement("h2");
        title.textContent = product.name || "Produit";

        const bottom = document.createElement("div");
        bottom.className = "product-bottom";

        const price = document.createElement("span");
        price.className = "product-price";
        price.textContent = formatPrice(product.price);

        const link = document.createElement("a");
        link.href = destination;
        link.className = "product-button";
        link.textContent = "Découvrir";

        bottom.append(price, link);
        info.append(title, bottom);
        article.append(imageWrapper, info);

        return article;
    }

    // ==========================================
    // RÉCUPÉRATION DES PRODUITS
    // ==========================================

    async function fetchProducts() {

        const { data, error } = await supabaseClient
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        return data || [];
    }

    // ==========================================
    // ACCUEIL : PRODUITS À LA UNE
    // ==========================================

    async function loadFeaturedProducts() {

        const container = document.getElementById("featured-products");

        if (!container) return;

        const { data, error } = await supabaseClient
            .from("products")
            .select("*")
            .eq("featured", true)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Erreur accueil :", error);
            container.textContent = "Impossible de charger les produits.";
            return;
        }

        container.replaceChildren();

        if (!data || data.length === 0) {
            container.textContent = "Nos nouveautés arrivent bientôt.";
            return;
        }

        data.forEach(product => {
            container.appendChild(createProductCard(product, true));
        });
    }

    // ==========================================
    // BOUTIQUE : CATALOGUE COMPLET
    // ==========================================

    async function loadShopProducts() {

        const container = document.getElementById("shop-products");

        if (!container) return;

        const searchInput = document.getElementById("shop-search");
        const categoryFilter = document.getElementById("category-filter");
        const count = document.getElementById("shop-count");

        let products;

        try {
            products = await fetchProducts();
        } catch (error) {
            console.error("Erreur catalogue :", error);
            container.textContent = "Impossible de charger les produits.";

            if (count) count.textContent = "";

            return;
        }

        function displayProducts() {

            const search = searchInput
                ? searchInput.value.trim().toLowerCase()
                : "";

            const category = categoryFilter
                ? categoryFilter.value
                : "";

            const filtered = products.filter(product => {

                const name = (product.name || "").toLowerCase();
                const description = (product.description || "").toLowerCase();

                const matchesSearch =
                    name.includes(search) ||
                    description.includes(search);

                const matchesCategory =
                    !category || product.category === category;

                return matchesSearch && matchesCategory;
            });

            if (count) {
                count.textContent =
                    `${filtered.length} produit${filtered.length > 1 ? "s" : ""} trouvé${filtered.length > 1 ? "s" : ""}`;
            }

            container.replaceChildren();

            if (filtered.length === 0) {

                const empty = document.createElement("p");
                empty.className = "products-empty";
                empty.textContent =
                    "Aucun produit ne correspond à votre recherche.";

                container.appendChild(empty);
                return;
            }

            filtered.forEach(product => {
                container.appendChild(createProductCard(product, false));
            });
        }

        if (searchInput) {
            searchInput.addEventListener("input", displayProducts);
        }

        if (categoryFilter) {
            categoryFilter.addEventListener("change", displayProducts);
        }

        displayProducts();
    }

    // ==========================================
    // FICHE PRODUIT INDIVIDUELLE
    // ==========================================

    async function loadProductDetail() {

        const container = document.getElementById("product-detail");

        if (!container) return;

        const params = new URLSearchParams(window.location.search);
        const productId = params.get("id");

        if (!productId) {
            container.textContent = "Aucun produit n’a été sélectionné.";
            return;
        }

        container.textContent = "Chargement du produit…";

        try {

            const { data: product, error } = await supabaseClient
                .from("products")
                .select("*")
                .eq("id", productId)
                .maybeSingle();

            if (error) throw error;

            if (!product) {
                container.textContent =
                    "Ce produit est introuvable ou n’est plus disponible.";
                return;
            }

            container.replaceChildren();

            // IMAGE
            const image = document.createElement("img");
            image.className = "product-detail-image";
            image.src = product.image_url || "";
            image.alt = product.name || "Produit Vesubia Card Store";

            // CONTENU
            const content = document.createElement("div");
            content.className = "product-detail-content";

            const eyebrow = document.createElement("span");
            eyebrow.className = "section-eyebrow";
            eyebrow.textContent = product.category || "VESUBIA CARD STORE";

            const title = document.createElement("h1");
            title.textContent = product.name || "Produit";

            const price = document.createElement("p");
            price.className = "product-detail-price";
            price.textContent = formatPrice(product.price);

            const stock = document.createElement("p");
            stock.className = "product-detail-stock";

            stock.textContent = Number(product.stock) > 0
                ? "Disponible en boutique"
                : "Actuellement indisponible";

            const description = document.createElement("p");
            description.className = "product-detail-description";
            description.textContent = product.description ||
                "Aucune description n’a été renseignée pour ce produit.";

            const contact = document.createElement("a");
            contact.className = "product-detail-buy";
            contact.href = "contact.html";

            contact.textContent = Number(product.stock) > 0
                ? "Contacter la boutique pour acheter"
                : "Contacter la boutique";

            content.append(
                eyebrow,
                title,
                price,
                stock,
                description,
                contact
            );

            container.append(image, content);

            await loadRelatedProducts(product);

        } catch (error) {
            console.error("Erreur fiche produit :", error);

            container.textContent =
                "Impossible de charger cette fiche produit pour le moment.";
        }
    }

    // ==========================================
    // PRODUITS SIMILAIRES
    // ==========================================

    async function loadRelatedProducts(currentProduct) {

        const section = document.getElementById("related-products-section");
        const container = document.getElementById("related-products");

        if (!section || !container) return;

        try {

            const products = await fetchProducts();

            let related = products.filter(product =>
                String(product.id) !== String(currentProduct.id)
            );

            // Produits de la même catégorie en premier
            if (currentProduct.category) {

                const sameCategory = related.filter(product =>
                    product.category === currentProduct.category
                );

                const others = related.filter(product =>
                    product.category !== currentProduct.category
                );

                related = [...sameCategory, ...others];
            }

            related = related.slice(0, 4);

            container.replaceChildren();

            if (related.length === 0) {
                section.hidden = true;
                return;
            }

            section.hidden = false;

            related.forEach(product => {
                container.appendChild(createProductCard(product, false));
            });

        } catch (error) {
            console.error("Erreur produits similaires :", error);
            section.hidden = true;
        }
    }

    // ==========================================
    // DÉMARRAGE
    // ==========================================

    try {
    await loadWishlist();
} catch (error) {
    console.error("Erreur chargement favoris :", error);
}

await Promise.all([
    loadFeaturedProducts(),
    loadShopProducts(),
    loadProductDetail()
]);

});
