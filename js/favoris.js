
document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("favorite-products");
    const totalElement = document.getElementById("favorites-total");
    const reservationButton = document.getElementById("reservation-request-button");

    const selectedProducts = new Map();
    let currentUser = null;
    let isReserving = false;

    const formatPrice = price =>
        Number(price || 0).toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR"
        });

    function updateReservationButton() {
        reservationButton.textContent =
            selectedProducts.size > 0
                ? `Réserver ma sélection (${selectedProducts.size})`
                : "Réserver ma sélection";

        reservationButton.disabled = isReserving;
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
                currentUser = null;
                container.textContent =
                    "Connectez-vous pour consulter vos favoris.";
                totalElement.textContent = formatPrice(0);
                return;
            }

            currentUser = user;

            // RÉCUPÉRATION DES FAVORIS
            const { data: wishlistData, error: wishlistError } =
                await supabaseClient
                    .from("wishlist")
                    .select("product_id, products(*)")
                    .eq("user_id", user.id);

            if (wishlistError) throw wishlistError;

            // RÉCUPÉRATION DES RÉSERVATIONS CONFIRMÉES
            const { data: reservations, error: reservationError } =
                await supabaseClient
                    .from("reservations")
                    .select(`
                        id,
                        status,
                        reservation_items (
                            product_id
                        )
                    `)
                    .eq("user_id", user.id)
                    .in("status", ["pending", "confirmed"]);
            if (reservationError) throw reservationError;

            // CARTES DÉJÀ RÉSERVÉES
            const reservedProductIds = new Set();

            (reservations || []).forEach(reservation => {
                (reservation.reservation_items || []).forEach(item => {
                    if (item.product_id) {
                        reservedProductIds.add(item.product_id);
                    }
                });
            });

            // FILTRAGE DES FAVORIS
            const products = (wishlistData || [])
                .filter(item =>
                    item.products &&
                    !reservedProductIds.has(item.product_id)
                )
                .map(item => item.products);

            container.replaceChildren();

            // MESSAGE DE RÉSERVATION
            if (reservedProductIds.size > 0) {
                const reservationMessage = document.createElement("div");

                reservationMessage.className =
                    "favorites-reservation-message";

                reservationMessage.textContent =
                    "Pour voir vos réservations, rendez-vous dans la rubrique Mon compte.";

                reservationMessage.style.cssText = `
                    width: 100%;
                    box-sizing: border-box;
                    padding: 16px 20px;
                    margin-bottom: 20px;
                    border-radius: 12px;
                    background: rgba(180, 30, 30, 0.12);
                    border: 1px solid rgba(180, 30, 30, 0.35);
                    color: inherit;
                    text-align: center;
                    font-weight: 500;
                `;

                container.appendChild(reservationMessage);
            }

            // AUCUN FAVORI
            if (!products.length) {
                const emptyMessage = document.createElement("p");

                emptyMessage.textContent =
                    reservedProductIds.size > 0
                        ? "Vous n'avez plus de cartes dans vos favoris."
                        : "Vous n'avez pas encore de favoris.";

                emptyMessage.style.cssText = `
                    width: 100%;
                    text-align: center;
                    padding: 30px 15px;
                `;

                container.appendChild(emptyMessage);

                totalElement.textContent = formatPrice(0);
                selectedProducts.clear();
                updateReservationButton();
                return;
            }

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
                    if (
                        event.target.closest(".wishlist-button") ||
                        event.target.closest(".reservation-selection")
                    ) {
                        return;
                    }

                    window.location.href =
                        `produit.html?id=${encodeURIComponent(product.id)}`;
                });

                // IMAGE
                const imageWrapper = document.createElement("div");
                imageWrapper.className = "product-image";

                const image = document.createElement("img");
                image.src = product.image_url || "";
                image.alt = product.name || "Carte Pokémon";

                // RETIRER DES FAVORIS
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

                // SÉLECTION POUR RÉSERVATION
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

                // INFORMATIONS
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

    // CRÉATION DE LA FENÊTRE DE RÉSERVATION
    function createReservationModal() {
        const existing = document.getElementById("reservation-slot-modal");
        if (existing) existing.remove();

        const modal = document.createElement("div");
        modal.id = "reservation-slot-modal";

        modal.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(0,0,0,0.82);
            backdrop-filter: blur(6px);
        `;

        modal.innerHTML = `
            <div id="reservation-slot-box" style="
                width: 100%;
                max-width: 520px;
                max-height: 90vh;
                overflow-y: auto;
                background: #151515;
                color: white;
                border: 1px solid rgba(210,40,40,0.55);
                border-radius: 18px;
                padding: 28px;
                box-sizing: border-box;
                box-shadow: 0 0 35px rgba(180,30,30,0.15);
            ">

                <button type="button" id="reservation-slot-close" style="
                    float: right;
                    border: none;
                    background: transparent;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                " aria-label="Fermer">&times;</button>

                <p style="
                    color: #c93636;
                    letter-spacing: 3px;
                    font-size: 11px;
                    margin-top: 0;
                ">VESUBIA CARD STORE</p>

                <h2 style="margin-top: 0;">
                    Choisir votre créneau
                </h2>

                <p style="
                    color: #aaa;
                    line-height: 1.6;
                ">
                    Sélectionnez la date et l'heure souhaitées
                    pour votre réservation.
                </p>

                <label for="reservation-date-input" style="
                    display:block;
                    margin-top:25px;
                    margin-bottom:8px;
                    font-weight:600;
                ">Date</label>

                <input type="date" id="reservation-date-input" style="
                    width:100%;
                    padding:14px;
                    box-sizing:border-box;
                    border-radius:8px;
                    border:1px solid #444;
                    background:#222;
                    color:white;
                    color-scheme:dark;
                ">

                <label for="reservation-time-input" style="
                    display:block;
                    margin-top:20px;
                    margin-bottom:8px;
                    font-weight:600;
                ">Heure</label>

                <select id="reservation-time-input" style="
                    width:100%;
                    padding:14px;
                    box-sizing:border-box;
                    border-radius:8px;
                    border:1px solid #444;
                    background:#222;
                    color:white;
                ">
                    <option value="">Choisissez une heure</option>
                </select>

                <p id="reservation-slot-error" style="
                    color:#e45b5b;
                    font-size:13px;
                    margin-top:12px;
                "></p>

                <div style="
                    margin-top:25px;
                    padding:15px;
                    background:rgba(255,255,255,0.04);
                    border-radius:10px;
                ">
                    <h3 style="margin-top:0;">Votre sélection</h3>
                    <div id="reservation-slot-recap"></div>
                </div>

                <button type="button" id="reservation-slot-confirm" style="
                    width:100%;
                    margin-top:25px;
                    padding:15px;
                    border:0;
                    border-radius:10px;
                    background:#b62929;
                    color:white;
                    font-weight:700;
                    cursor:pointer;
                ">
                    Confirmer ma demande
                </button>

                <button type="button" id="reservation-slot-cancel" style="
                    width:100%;
                    margin-top:10px;
                    padding:12px;
                    border:1px solid #444;
                    border-radius:10px;
                    background:transparent;
                    color:#aaa;
                    cursor:pointer;
                ">
                    Annuler
                </button>

            </div>
        `;

        document.body.appendChild(modal);

        const dateInput = modal.querySelector("#reservation-date-input");
        const timeInput = modal.querySelector("#reservation-time-input");
        const errorElement = modal.querySelector("#reservation-slot-error");
        const recapElement = modal.querySelector("#reservation-slot-recap");

        // DATE MINIMUM : AUJOURD'HUI
        const today = new Date();
        const localToday = new Date(
            today.getTime() - today.getTimezoneOffset() * 60000
        ).toISOString().split("T")[0];

        dateInput.min = localToday;

        // RÉCAPITULATIF
        const products = Array.from(selectedProducts.values());

        const recap = products.map(product => `
            <div style="
                display:flex;
                justify-content:space-between;
                gap:10px;
                margin:8px 0;
                font-size:14px;
            ">
                <span>${escapeHTML(product.name || "Carte")}</span>
                <span>${formatPrice(product.price)}</span>
            </div>
        `).join("");

        const total = products.reduce(
            (sum, product) => sum + (Number(product.price) || 0),
            0
        );

        recapElement.innerHTML = `
            ${recap}
            <hr style="border-color:#333;margin:15px 0;">
            <div style="
                display:flex;
                justify-content:space-between;
                font-weight:bold;
            ">
                <span>Total</span>
                <span>${formatPrice(total)}</span>
            </div>
        `;

        // CRÉATION DES CRÉNEAUX
        function populateTimeSlots() {
            timeInput.innerHTML = `
                <option value="">Choisissez une heure</option>
            `;

            if (!dateInput.value) return;

            const date = new Date(dateInput.value + "T12:00:00");
            const day = date.getDay();

            // DIMANCHE = 0, LUNDI = 1
            if (day === 0 || day === 1) {
                errorElement.textContent =
                    "La boutique est fermée le dimanche et le lundi.";

                return;
            }

            errorElement.textContent = "";

            // CRÉNEAUX HORAIRES : 9H À 17H
            for (let hour = 9; hour <= 17; hour++) {
                const value = `${String(hour).padStart(2, "0")}:00`;

                const option = document.createElement("option");
                option.value = value;
                option.textContent = value;

                timeInput.appendChild(option);
            }
        }

        dateInput.addEventListener("change", populateTimeSlots);

        // FERMETURE
        function closeModal() {
            modal.remove();
        }

        modal.querySelector("#reservation-slot-close")
            .addEventListener("click", closeModal);

        modal.querySelector("#reservation-slot-cancel")
            .addEventListener("click", closeModal);

        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeModal();
            }
        });

        // CONFIRMATION
        modal.querySelector("#reservation-slot-confirm")
            .addEventListener("click", async () => {

                const reservationDate = dateInput.value;
                const reservationTime = timeInput.value;

                errorElement.textContent = "";

                if (!reservationDate) {
                    errorElement.textContent =
                        "Veuillez sélectionner une date.";
                    return;
                }

                if (!reservationTime) {
                    errorElement.textContent =
                        "Veuillez sélectionner un créneau horaire.";
                    return;
                }

                const selectedDate = new Date(
                    reservationDate + "T12:00:00"
                );

                const selectedDay = selectedDate.getDay();

                if (selectedDay === 0 || selectedDay === 1) {
                    errorElement.textContent =
                        "La boutique est fermée le dimanche et le lundi.";
                    return;
                }

                if (reservationDate < localToday) {
                    errorElement.textContent =
                        "Vous ne pouvez pas choisir une date passée.";
                    return;
                }

                closeModal();

                await submitReservation(
                    reservationDate,
                    reservationTime
                );
            });

        return modal;
    }

    // PROTECTION DES TEXTES
    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ENVOI DE LA RÉSERVATION
    async function submitReservation(reservationDate, reservationTime) {
        if (!currentUser || isReserving) return;

        isReserving = true;
        updateReservationButton();

        try {
            const productIds = Array.from(selectedProducts.keys());

            const { data, error } = await supabaseClient.rpc(
                "create_reservation",
                {
                    p_product_ids: productIds,
                    p_reservation_date: reservationDate,
                    p_reservation_time: reservationTime
                }
            );

            if (error) throw error;

            selectedProducts.clear();

            alert(
                "Votre demande de réservation a bien été enregistrée !\n\n" +
                "Date : " + reservationDate + "\n" +
                "Heure : " + reservationTime + "\n\n" +
                "Elle est en attente de validation par la boutique."
            );

            console.log("Réservation créée :", data);

            await loadFavorites();

        } catch (error) {
            console.error("Erreur réservation :", error);

            alert(
                "Impossible de créer votre réservation.\n\n" +
                (error.message || "Une erreur est survenue.")
            );

        } finally {
            isReserving = false;
            updateReservationButton();
        }
    }

       // BOUTON RESERVATION
    reservationButton.addEventListener("click", async () => {
        if (!currentUser) {
            alert("Connectez-vous pour effectuer une réservation.");
            return;
        }

        if (isReserving) return;

        const products = Array.from(selectedProducts.values());

        if (!products.length) {
            alert("Veuillez sélectionner les cartes que vous souhaitez réserver.");
            return;
        }

        // CRÉNEAUX DISPONIBLES
        const availableTimes = [
            "09:00",
            "10:00",
            "11:00",
            "13:30",
            "14:30",
            "15:30",
            "16:30"
        ];

        // MODAL
        const modal = document.createElement("div");

        modal.style.cssText = `
            position:fixed;
            inset:0;
            z-index:99999;
            background:rgba(0,0,0,0.85);
            display:flex;
            justify-content:center;
            align-items:center;
            padding:20px;
        `;

        modal.innerHTML = `
            <div style="
                background:#151515;
                border:1px solid rgba(212,160,23,0.4);
                border-radius:16px;
                padding:25px;
                width:100%;
                max-width:450px;
                color:white;
            ">

                <h2 style="margin-bottom:20px;color:#d4a017;">
                    Choisir mon créneau
                </h2>

                <label style="display:block;margin-bottom:8px;">
                    Date de retrait
                </label>

                <input
                    type="date"
                    id="reservation-date-picker"
                    min="${new Date().toISOString().split("T")[0]}"
                    style="
                        width:100%;
                        padding:12px;
                        margin-bottom:20px;
                        box-sizing:border-box;
                    "
                >

                <label style="display:block;margin-bottom:8px;">
                    Heure de retrait
                </label>

                <select
                    id="reservation-time-picker"
                    style="
                        width:100%;
                        padding:12px;
                        margin-bottom:20px;
                        box-sizing:border-box;
                    "
                >
                    <option value="">Choisir une heure</option>
                    ${availableTimes.map(time => `
                        <option value="${time}">${time}</option>
                    `).join("")}
                </select>

                <div style="
                    font-size:0.85rem;
                    opacity:0.7;
                    margin-bottom:20px;
                ">
                    La boutique est fermée de 12h à 13h30.
                </div>

                <div style="display:flex;gap:10px;">
                    <button
                        id="reservation-cancel"
                        type="button"
                        style="
                            flex:1;
                            padding:12px;
                            background:#333;
                            color:white;
                            border:0;
                            border-radius:8px;
                            cursor:pointer;
                        "
                    >
                        Annuler
                    </button>

                    <button
                        id="reservation-confirm"
                        type="button"
                        style="
                            flex:1;
                            padding:12px;
                            background:#d4a017;
                            color:black;
                            border:0;
                            border-radius:8px;
                            cursor:pointer;
                            font-weight:bold;
                        "
                    >
                        Continuer
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const dateInput = modal.querySelector("#reservation-date-picker");
        const timeInput = modal.querySelector("#reservation-time-picker");
        const confirmButton = modal.querySelector("#reservation-confirm");

        modal.querySelector("#reservation-cancel").addEventListener("click", () => {
            modal.remove();
        });

        confirmButton.addEventListener("click", async () => {
            const reservationDate = dateInput.value;
            const reservationTime = timeInput.value;

            if (!reservationDate || !reservationTime) {
                alert("Veuillez choisir une date et une heure.");
                return;
            }

            // INTERDICTION DIMANCHE ET LUNDI
            const selectedDay = new Date(reservationDate + "T12:00:00").getDay();

            if (selectedDay === 0 || selectedDay === 1) {
                alert("La boutique est fermée le dimanche et le lundi.");
                return;
            }

            const recap = products
                .map(product =>
                    `• ${product.name} — ${formatPrice(product.price)}`
                )
                .join("\n");

            const total = products.reduce(
                (sum, product) =>
                    sum + (Number(product.price) || 0),
                0
            );

            const confirmed = window.confirm(
                `RÉCAPITULATIF DE VOTRE RÉSERVATION\n\n` +
                `${recap}\n\n` +
                `Total : ${formatPrice(total)}\n\n` +
                `Date : ${reservationDate}\n` +
                `Heure : ${reservationTime}\n\n` +
                `Votre demande sera soumise à validation de la boutique.\n\n` +
                `Confirmer votre réservation ?`
            );

            if (!confirmed) return;

            modal.remove();

            isReserving = true;
            updateReservationButton();

            try {
                const productIds = products.map(product => product.id);

                const { data, error } = await supabaseClient.rpc(
                    "create_reservation",
                    {
                        p_product_ids: productIds,
                        p_reservation_date: reservationDate,
                        p_reservation_time: reservationTime
                    }
                );

                if (error) throw error;

                selectedProducts.clear();

                alert(
                    "Votre demande de réservation a bien été enregistrée !\n\n" +
                    "Elle est en attente de validation par la boutique."
                );

                console.log("Réservation créée :", data);

                await loadFavorites();

            } catch (error) {
                console.error("Erreur réservation :", error);

                alert(
                    "Impossible de créer votre réservation.\n\n" +
                    (error.message || "Une erreur est survenue.")
                );

            } finally {
                isReserving = false;
                updateReservationButton();
            }
        });
    });

    await loadFavorites();
});