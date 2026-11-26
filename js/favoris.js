
document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("favorite-products");
    const totalElement = document.getElementById("favorites-total");

    const selectedProducts = new Map();
    let currentUser = null;

    const formatPrice = price =>
        Number(price || 0).toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR"
        });

    // Bouton de réservation
    const reservationButton = document.createElement("button");
    reservationButton.id = "reservation-request-button";
    reservationButton.className = "product-button";
    reservationButton.textContent = "Réserver mes cartes";
    reservationButton.style.display = "none";

    container.parentElement.insertBefore(
        reservationButton,
        container.nextSibling
    );

    function updateReservationButton() {
        reservationButton.style.display =
            selectedProducts.size > 0 ? "inline-flex" : "none";

        reservationButton.textContent =
            `Réserver ma sélection (${selectedProducts.size})`;
    }

    async function removeFavorite(productId, button) {
        button.disabled = true;

        const { error } = await supabaseClient
            .from("wishlist")
            .delete()
            .eq("user_id", currentUser.id)
            .eq("product_id", productId);

        if (error) {
            alert("Impossible de retirer ce favori.");
            button.disabled = false;
            return;
        }

        selectedProducts.delete(productId);
        await loadFavorites();
    }

    async function loadFavorites() {
        try {
            const { data: { user }, error: authError } =
                await supabaseClient.auth.getUser();

            if (authError) throw authError;

            if (!user) {
                container.textContent =
                    "Connectez-vous pour consulter vos favoris.";
                totalElement.textContent = formatPrice(0);
                return;
            }

            currentUser = user;

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
                container.textContent =
                    "Vous n'avez pas encore de favoris.";

                totalElement.textContent = formatPrice(0);
                selectedProducts.clear();
                updateReservationButton();
                return;
            }

            // Nettoyer les produits sélectionnés qui ne sont plus favoris
            const favoriteIds = new Set(products.map(p => p.id));

            for (const id of selectedProducts.keys()) {
                if (!favoriteIds.has(id)) {
                    selectedProducts.delete(id);
                }
            }

            let total = 0;

            products.forEach(product => {
                total += Number(product.price) || 0;

                const card = document.createElement("article");
                card.className = "product-card";
                card.style.position = "relative";

                card.addEventListener("click", event => {
                    if (event.target.closest(".wishlist-button") ||
                        event.target.closest(".reservation-selection")) {
                        return;
                    }

                    window.location.href =
                        `produit.html?id=${encodeURIComponent(product.id)}`;
                });

                // Image
                const imageWrapper = document.createElement("div");
                imageWrapper.className = "product-image";

                const image = document.createElement("img");
                image.src = product.image_url || "";
                image.alt = product.name || "Carte Pokémon";

                // Bouton supprimer
                const remove = document.createElement("button");
                remove.className = "wishlist-button is-favorite";
                remove.type = "button";
                remove.innerHTML = '<i class="fa-solid fa-heart"></i>';
                remove.title = "Retirer des favoris";
                remove.setAttribute("aria-label", "Retirer des favoris");

                remove.addEventListener("click", event => {
                    event.stopPropagation();
                    removeFavorite(product.id, remove);
                });

                // Sélection réservation
                const selectionWrapper = document.createElement("label");
                selectionWrapper.className = "reservation-selection";
                selectionWrapper.title = "Sélectionner pour réserver";

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = selectedProducts.has(product.id);
                checkbox.setAttribute(
                    "aria-label",
                    `Sélectionner ${product.name} pour réserver`
                );

                selectionWrapper.appendChild(checkbox);

                checkbox.addEventListener("click", event => {
                    event.stopPropagation();
                });

                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        selectedProducts.set(product.id, product);
                    } else {
                        selectedProducts.delete(product.id);
                    }

                    updateReservationButton();
                });

                imageWrapper.append(image, remove, selectionWrapper);

                // Informations produit
                const info = document.createElement("div");
                info.className = "product-info";

                const title = document.createElement("h2");
                title.textContent = product.name || "Produit";

                const price = document.createElement("span");
                price.className = "product-price";
                price.textContent = formatPrice(product.price);

                info.append(title, price);

                card.append(imageWrapper, info);
                container.appendChild(card);
            });

            totalElement.textContent = formatPrice(total);
            updateReservationButton();

        } catch (error) {
            console.error("Erreur favoris :", error);
            container.textContent =
                "Impossible de charger vos favoris.";
        }
    }

    // Réservation
    reservationButton.addEventListener("click", () => {
        if (!currentUser) {
            alert("Connectez-vous pour effectuer une réservation.");
            return;
        }

        const products = Array.from(selectedProducts.values());

        if (!products.length) return;

        const recap = products
            .map(product =>
                `• ${product.name} — ${formatPrice(product.price)}`
            )
            .join("\n");

        const total = products.reduce(
            (sum, product) => sum + (Number(product.price) || 0),
            0
        );

        const confirmed = confirm(
            `RÉCAPITULATIF DE VOTRE DEMANDE\n\n` +
            `${recap}\n\n` +
            `Total : ${formatPrice(total)}\n\n` +
            `Votre demande sera soumise à validation de la boutique.\n` +
            `Confirmer cette demande ?`
        );

        if (confirmed) {
            alert(
                "La demande de réservation sera prochainement " +
                "connectée à votre espace client."
            );
        }
    });

    await loadFavorites();
});
