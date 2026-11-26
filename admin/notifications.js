
/* =========================================
   VESUBIA - SYSTEME DE NOTIFICATIONS
========================================= */

(function () {
    if (window.notificationsInitialized) return;
    window.notificationsInitialized = true;

    function initNotifications() {
        if (typeof supabaseClient === "undefined") {
            console.error("Supabase client introuvable.");
            return;
        }

        const header = document.querySelector(".admin-header-actions");

        if (!header) {
            console.error("Header administration introuvable.");
            return;
        }

        if (document.getElementById("notification-bell")) return;

        const wrapper = document.createElement("div");
        wrapper.className = "notification-wrapper";

        wrapper.innerHTML = `
            <button class="notification-bell" id="notification-bell" aria-label="Notifications">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
                    <path d="M10 21h4"/>
                </svg>
                <span class="notification-count" id="notification-count"></span>
            </button>

            <div class="notification-panel" id="notification-panel">
                <div class="notification-panel-header">
                    <div>
                        <h3>Notifications</h3>
                        <span id="notification-subtitle">Chargement...</span>
                    </div>
                    <button id="notification-read-all">Tout lire</button>
                </div>

                <div class="notification-list" id="notification-list">
                    <div class="notification-loading">Chargement des notifications...</div>
                </div>
            </div>
        `;

        header.insertBefore(wrapper, header.firstChild);

        const bell = document.getElementById("notification-bell");
        const panel = document.getElementById("notification-panel");
        const count = document.getElementById("notification-count");
        const list = document.getElementById("notification-list");
        const subtitle = document.getElementById("notification-subtitle");

        let notifications = [];
        let previousNotificationIds = null;

        /* =========================================
           SON DE NOTIFICATION - PREMIUM
        ========================================= */

        let audioContext = null;
        let audioUnlocked = false;

        async function unlockAudio() {
            if (audioUnlocked) return;

            try {
                const AudioContextClass =
                    window.AudioContext || window.webkitAudioContext;

                if (!AudioContextClass) return;

                if (!audioContext) {
                    audioContext = new AudioContextClass();
                }

                if (audioContext.state === "suspended") {
                    await audioContext.resume();
                }

                if (audioContext.state === "running") {
                    audioUnlocked = true;

                    document.removeEventListener("click", unlockAudio);
                    document.removeEventListener("keydown", unlockAudio);
                }

            } catch (error) {
                console.error("Impossible d'activer le son :", error);
            }
        }

        document.addEventListener("click", unlockAudio);
        document.addEventListener("keydown", unlockAudio);

        function playNotificationSound() {
            if (!audioContext || audioContext.state !== "running") return;

            try {
                const now = audioContext.currentTime;

                function tone(frequency, start, duration, volume) {
                    const oscillator = audioContext.createOscillator();
                    const gain = audioContext.createGain();

                    oscillator.type = "sine";
                    oscillator.frequency.setValueAtTime(frequency, start);

                    gain.gain.setValueAtTime(0.0001, start);
                    gain.gain.exponentialRampToValueAtTime(
                        volume,
                        start + 0.025
                    );
                    gain.gain.exponentialRampToValueAtTime(
                        0.0001,
                        start + duration
                    );

                    oscillator.connect(gain);
                    gain.connect(audioContext.destination);

                    oscillator.start(start);
                    oscillator.stop(start + duration + 0.02);
                }

                tone(587, now, 0.30, 0.25);
                tone(880, now + 0.08, 0.40, 0.22);

            } catch (error) {
                console.error("Erreur du son de notification :", error);
            }
        }

        /* =========================================
           OUVERTURE DU PANNEAU
        ========================================= */

        bell.addEventListener("click", (event) => {
            event.stopPropagation();
            panel.classList.toggle("active");

            if (panel.classList.contains("active")) {
                loadNotifications();
            }
        });

        document.addEventListener("click", (event) => {
            if (!wrapper.contains(event.target)) {
                panel.classList.remove("active");
            }
        });

        /* =========================================
           CHARGEMENT DES NOTIFICATIONS
        ========================================= */

        async function loadNotifications() {
            const { data, error } = await supabaseClient
                .from("notifications")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                console.error("Erreur notifications :", error);

                list.innerHTML = `
                    <div class="notification-empty">
                        Impossible de charger les notifications.
                    </div>
                `;
                return;
            }

            const newNotifications = data || [];

            /* Détection des nouvelles notifications */

            if (previousNotificationIds !== null) {
                const previousIds = previousNotificationIds;

                const arrivals = newNotifications.filter(notification =>
                    !previousIds.has(notification.id)
                );

                if (arrivals.length > 0) {
                    playNotificationSound();
                }
            }

            previousNotificationIds = new Set(
                newNotifications.map(notification => notification.id)
            );

            notifications = newNotifications;
            renderNotifications();
        }

        /* =========================================
           AFFICHAGE
        ========================================= */

        function renderNotifications() {
            const unread = notifications.filter(n => !n.is_read);
            const unreadCount = unread.length;

            count.textContent = unreadCount > 99 ? "99+" : unreadCount;
            count.classList.toggle("visible", unreadCount > 0);

            subtitle.textContent = unreadCount === 0
                ? "Aucune notification non lue"
                : `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`;

            if (!notifications.length) {
                list.innerHTML = `
                    <div class="notification-empty">
                        Aucune notification pour le moment.
                    </div>
                `;
                return;
            }

            list.innerHTML = notifications.map(notification => `
                <div class="notification-item ${notification.is_read ? "read" : "unread"}"
                     data-id="${notification.id}"
                     data-url="${escapeHTML(notification.target_url || "")}">
                    <div class="notification-indicator"></div>
                    <div class="notification-content">
                        <strong>${escapeHTML(notification.title)}</strong>
                        <p>${escapeHTML(notification.message)}</p>
                        <span>${formatDate(notification.created_at)}</span>
                    </div>
                </div>
            `).join("");

            list.querySelectorAll(".notification-item").forEach(item => {
                item.addEventListener("click", async () => {
                    const id = item.dataset.id;
                    const url = item.dataset.url;

                    await markAsRead(id);

                    if (url) {
                        window.location.href = url;
                    }
                });
            });
        }

        /* =========================================
           MARQUER COMME LU
        ========================================= */

        async function markAsRead(id) {
            const { error } = await supabaseClient
                .from("notifications")
                .update({ is_read: true })
                .eq("id", id);

            if (error) {
                console.error("Erreur lecture notification :", error);
                return;
            }

            notifications = notifications.map(n =>
                n.id === id ? { ...n, is_read: true } : n
            );

            renderNotifications();
        }

        /* =========================================
           TOUT LIRE
        ========================================= */

        document.getElementById("notification-read-all")
            .addEventListener("click", async () => {

                const unreadIds = notifications
                    .filter(n => !n.is_read)
                    .map(n => n.id);

                if (!unreadIds.length) return;

                const { error } = await supabaseClient
                    .from("notifications")
                    .update({ is_read: true })
                    .in("id", unreadIds);

                if (error) {
                    console.error("Erreur :", error);
                    return;
                }

                notifications = notifications.map(n => ({
                    ...n,
                    is_read: true
                }));

                renderNotifications();
            });

        /* =========================================
           UTILITAIRES
        ========================================= */

        function escapeHTML(value) {
            return String(value ?? "").replace(/[&<>"']/g, char => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char]));
        }

        function formatDate(date) {
            const d = new Date(date);

            return d.toLocaleString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            });
        }

        /* =========================================
           INITIALISATION + ACTUALISATION
        ========================================= */

        loadNotifications();

        setInterval(loadNotifications, 30000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initNotifications);
    } else {
        initNotifications();
    }
})();
