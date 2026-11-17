
document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("favorite-products");
    const totalElement = document.getElementById("favorites-total");

    const formatPrice = price =>
        Number(price || 0).toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR"
        });

    async function loadFavorites() {
        try {
            const { data: { user }, error: authError } =
                await supabaseClient.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                container.textContent = "Connectez-vous pour consulter vos favoris.";
                return;
            }

            const { data, error } = await supabaseClient
                .from("wishlist")
                .select("product_id, products(*)")
                .eq("user_id", user.id);

            if (error) throw error;

            const products = (data || [])
                .map(item => item.products)
                .filter(Boolean);

            container.replaceChildren();

            if (!products.length) {
                container.textContent = "Vous n'avez pas encore de favoris.";
                totalElement.textContent = formatPrice(0);
                return;
            }

            let total = 0;

            products.forEach(product => {
                total += Number(product.price) || 0;

                const card = document.createElement("article");
                card.className = "product-card";
                card.style.cursor = "pointer";

card.addEventListener("click", () => {
    window.location.href = `produit.html?id=${encodeURIComponent(product.id)}`;
});

                const imageWrapper = document.createElement("div");
                imageWrapper.className = "product-image";

                const image = document.createElement("img");
                image.src = product.image_url || "";
                image.alt = product.name || "Carte Pokémon";

                const info = document.createElement("div");
                info.className = "product-info";

                const title = document.createElement("h2");
                title.textContent = product.name || "Produit";

                const price = document.createElement("span");
                price.className = "product-price";
                price.textContent = formatPrice(product.price);

                const remove = document.createElement("button");
                remove.className = "wishlist-button is-favorite";
                remove.innerHTML = '<i class="fa-solid fa-heart"></i>';
                remove.setAttribute("aria-label", "Retirer des favoris");

                remove.addEventListener("click", async (event) => {
                    event.stopPropagation();
                    remove.disabled = true;

                    const { error } = await supabaseClient
                        .from("wishlist")
                        .delete()
                        .eq("user_id", user.id)
                        .eq("product_id", product.id);

                    if (error) {
                        alert("Impossible de retirer ce favori.");
                        remove.disabled = false;
                        return;
                    }

                    loadFavorites();
                });

                imageWrapper.append(image, remove);
                info.append(title, price);
                card.append(imageWrapper, info);
                container.appendChild(card);
            });

            totalElement.textContent = formatPrice(total);

        } catch (error) {
            console.error("Erreur favoris :", error);
            container.textContent = "Impossible de charger vos favoris.";
        }
    }

    await loadFavorites();
});
