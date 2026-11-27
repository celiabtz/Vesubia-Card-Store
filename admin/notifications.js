/* ==========================================
   VESUBIA - NOTIFICATIONS RESERVATIONS
   REALTIME + VERIFICATION AUTOMATIQUE
========================================== */

document.addEventListener("DOMContentLoaded", async () => {

    const bell = document.getElementById("notification-bell");
    const badge = document.getElementById("notification-count");
    const panel = document.getElementById("notification-panel");
    const list = document.getElementById("notification-list");
    const panelCount = document.getElementById("notification-panel-count");

    if (!bell || !badge || !panel || !list) return;

    if (typeof supabaseClient === "undefined") {
        console.error("Supabase client introuvable.");
        return;
    }

    let pendingReservations = [];
    let knownReservationIds = new Set();
    let initialized = false;
    let realtimeConnected = false;


    // ==========================================
    // SON
    // ==========================================

    function playNotificationSound() {

        try {

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1174, audioContext.currentTime + 0.12);

            gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.4);

            oscillator.connect(gain);
            gain.connect(audioContext.destination);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.4);

            oscillator.onended = () => {
                audioContext.close().catch(() => {});
            };

        } catch (error) {

            console.warn("Son notification impossible :", error);

        }

    }


    // ==========================================
    // ANIMATION CLOCHE
    // ==========================================

    function animateBell() {

        bell.classList.remove("notification-shake");

        void bell.offsetWidth;

        bell.classList.add("notification-shake");

        setTimeout(() => {
            bell.classList.remove("notification-shake");
        }, 1000);

    }


    // ==========================================
    // BADGE
    // ==========================================

    function updateBadge() {

        const count = pendingReservations.length;

        badge.textContent = count;
        badge.hidden = count === 0;

        if (panelCount) {
            panelCount.textContent =
                `${count} réservation${count > 1 ? "s" : ""} en attente`;
        }

    }


    // ==========================================
    // AFFICHAGE
    // ==========================================

    function renderNotifications() {

        list.innerHTML = "";

        if (pendingReservations.length === 0) {

            list.innerHTML = `
                <p class="notification-empty">
                    Aucune nouvelle réservation.
                </p>
            `;

            updateBadge();

            return;
        }


        pendingReservations.forEach(reservation => {

            const item = document.createElement("div");

            item.className = "notification-item";

            const date = reservation.reservation_date
                ? new Date(
                    reservation.reservation_date + "T00:00:00"
                ).toLocaleDateString("fr-FR")
                : "Date inconnue";

            const time = reservation.reservation_time
                ? reservation.reservation_time.slice(0, 5)
                : "";


            item.innerHTML = `
                <div class="notification-item-dot"></div>

                <div class="notification-item-content">
                    <strong>Nouvelle réservation</strong>
                    <p>${date} à ${time}</p>
                    <small>Réservation en attente de validation</small>
                </div>
            `;


            item.addEventListener("click", () => {

                window.location.href = "calendrier.html";

            });


            list.appendChild(item);

        });


        updateBadge();

    }


    // ==========================================
    // DETECTION NOUVELLE RESERVATION
    // ==========================================

    function handleNewReservation(reservation) {

        if (!reservation || reservation.status !== "pending") return;

        if (knownReservationIds.has(reservation.id)) return;

        knownReservationIds.add(reservation.id);

        pendingReservations.unshift(reservation);

        renderNotifications();

        playNotificationSound();

        animateBell();

    }


    // ==========================================
    // CHARGEMENT / VERIFICATION
    // ==========================================

    async function loadNotifications(isCheck = false) {

        const { data, error } = await supabaseClient
            .from("reservations")
            .select("id, status, reservation_date, reservation_time, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: false });


        if (error) {

            console.error("Erreur notifications :", error);

            return;

        }


        const currentReservations = data || [];


        // Première initialisation : pas de son
        if (!initialized) {

            pendingReservations = currentReservations;

            currentReservations.forEach(reservation => {
                knownReservationIds.add(reservation.id);
            });

            initialized = true;

            renderNotifications();

            return;

        }


        // Détection des nouvelles réservations
        if (isCheck) {

            currentReservations.forEach(reservation => {

                if (!knownReservationIds.has(reservation.id)) {

                    handleNewReservation(reservation);

                }

            });

        }


        // Mise à jour de la liste des réservations en attente
        pendingReservations = currentReservations;

        currentReservations.forEach(reservation => {
            knownReservationIds.add(reservation.id);
        });


        // Nettoyage des anciennes réservations qui ne sont plus en attente
        const currentIds = new Set(
            currentReservations.map(reservation => reservation.id)
        );

        knownReservationIds.forEach(id => {

            if (!currentIds.has(id)) {

                knownReservationIds.delete(id);

            }

        });


        renderNotifications();

    }


    // ==========================================
    // OUVERTURE / FERMETURE
    // ==========================================

    bell.addEventListener("click", () => {

        panel.hidden = !panel.hidden;

    });


    document.addEventListener("click", event => {

        if (!event.target.closest(".notification-wrapper")) {

            panel.hidden = true;

        }

    });


    // ==========================================
    // INITIALISATION
    // ==========================================

    await loadNotifications(false);


    // ==========================================
    // TEMPS REEL SUPABASE
    // ==========================================

    const notificationChannel = supabaseClient
        .channel("reservations-notifications-" + Date.now())


        // NOUVELLE RESERVATION

        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "reservations"
            },
            payload => {

                console.log("Nouvelle réservation reçue :", payload.new);

                handleNewReservation(payload.new);

            }
        )


        // MODIFICATION RESERVATION

        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "reservations"
            },
            payload => {

                console.log("Réservation modifiée :", payload.new);

                const reservation = payload.new;


                if (reservation.status !== "pending") {

                    pendingReservations = pendingReservations.filter(
                        item => item.id !== reservation.id
                    );

                    knownReservationIds.delete(reservation.id);

                    renderNotifications();

                }

            }
        )


        // CONNEXION

        .subscribe((status, error) => {

            console.log("Statut Realtime notifications :", status);

            if (status === "SUBSCRIBED") {

                realtimeConnected = true;

                console.log("Notifications Realtime connectées.");

            }

            if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT" ||
                status === "CLOSED"
            ) {

                realtimeConnected = false;

                console.warn(
                    "Realtime notifications déconnecté :",
                    status,
                    error
                );

            }

        });


    // ==========================================
    // VERIFICATION AUTOMATIQUE TOUTES LES 30 SEC
    // ==========================================

    setInterval(() => {

        loadNotifications(true);

    }, 30000);


    // ==========================================
    // VERIFICATION QUAND ON REVIENT SUR LA PAGE
    // ==========================================

    document.addEventListener("visibilitychange", () => {

        if (!document.hidden) {

            loadNotifications(true);

        }

    });


    console.log("Système de notifications Vesubia initialisé.");

});