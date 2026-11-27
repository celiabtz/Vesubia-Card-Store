document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("calendar-grid");
    const title = document.getElementById("calendar-title");
    const modal = document.getElementById("appointment-modal");
    const form = document.getElementById("appointment-form");

    if (!grid || !form || !modal) return;

    let currentDate = new Date();
    let currentView = "month";
    let appointments = [];
    let reservations = [];
    let selectedDate = null;

    const fields = {
        id: document.getElementById("appointment-id"),
        name: document.getElementById("client-name"),
        email: document.getElementById("client-email"),
        phone: document.getElementById("client-phone"),
        type: document.getElementById("appointment-type"),
        date: document.getElementById("appointment-date"),
        start: document.getElementById("appointment-start"),
        end: document.getElementById("appointment-end"),
        status: document.getElementById("appointment-status"),
        notes: document.getElementById("appointment-notes")
    };

    const message = document.getElementById("appointment-message");
    const details = document.getElementById("calendar-day-details");

    function formatDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function formatTime(time) {
        return time ? time.slice(0, 5) : "";
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char]));
    }

    function getMonthName(date) {
        return date.toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric"
        });
    }

    async function loadAppointments() {
        const { data, error } = await supabaseClient
            .from("appointments")
            .select("*")
            .order("appointment_date")
            .order("start_time");

        if (error) {
            console.error("Erreur rendez-vous :", error);
        } else {
            appointments = data || [];
        }

        await loadReservations();
    }

    async function loadReservations() {
        const { data, error } = await supabaseClient
            .from("reservations")
            .select(`
                id,
                user_id,
                status,
                pickup_code,
                created_at,
                expires_at,
                reservation_date,
                reservation_time,
                total,
                notes,
                reservation_items (
                    card_name,
                    quantity,
                    unit_price
                )
            `)
            .order("reservation_date")
            .order("reservation_time");

        if (error) {
            console.error("Erreur chargement réservations :", error);
            reservations = [];
        } else {
            reservations = data || [];
        }

        renderCalendar();
        updateStats();
    }

    function updateStats() {
        const total = appointments.length + reservations.length;

        const confirmed =
            appointments.filter(a => a.status === "confirmed").length +
            reservations.filter(r => r.status === "confirmed").length;

        const pending =
            appointments.filter(a => a.status === "pending").length +
            reservations.filter(r => r.status === "pending").length;

        const totalElement = document.getElementById("calendar-stat-total");
        const confirmedElement = document.getElementById("calendar-stat-confirmed");
        const pendingElement = document.getElementById("calendar-stat-pending");

        if (totalElement) totalElement.textContent = total;
        if (confirmedElement) confirmedElement.textContent = confirmed;
        if (pendingElement) pendingElement.textContent = pending;
    }

    function renderCalendar() {
        grid.innerHTML = "";

        if (currentView === "month") {
            renderMonth();
        } else {
            renderWeek();
        }
    }

    function renderMonth() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        title.textContent = getMonthName(currentDate);

        const firstDay = new Date(year, month, 1);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const startDate = new Date(year, month, 1 - startOffset);

        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            createDayCell(date, month);
        }
    }

    function renderWeek() {
        const date = new Date(currentDate);
        const dayOffset = (date.getDay() + 6) % 7;
        date.setDate(date.getDate() - dayOffset);

        const endDate = new Date(date);
        endDate.setDate(date.getDate() + 6);

        title.textContent = `${date.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short"
        })} – ${endDate.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric"
        })}`;

        for (let i = 0; i < 7; i++) {
            const day = new Date(date);
            day.setDate(date.getDate() + i);
            createDayCell(day, currentDate.getMonth());
        }
    }

    function getDayAppointments(dateString) {
        return appointments.filter(a => a.appointment_date === dateString);
    }

    function getDayReservations(dateString) {
        return reservations.filter(r =>
            r.reservation_date === dateString &&
            ["pending", "confirmed"].includes(r.status)
        );
    }

    function createDayCell(date, currentMonth) {
        const dateString = formatDate(date);

        const cell = document.createElement("div");
        cell.className = "calendar-day";

        if (currentView === "month" && date.getMonth() !== currentMonth) {
            cell.classList.add("other-month");
        }

        if (dateString === formatDate(new Date())) {
            cell.classList.add("today");
        }

        cell.dataset.date = dateString;

        const dayAppointments = getDayAppointments(dateString);
        const dayReservations = getDayReservations(dateString);

        cell.innerHTML = `
            <div class="calendar-day-number">${date.getDate()}</div>
            <div class="calendar-day-events">
                ${dayAppointments.map(appointment => `
                    <div class="calendar-event ${escapeHTML(appointment.status)}"
                         data-type="appointment"
                         data-id="${escapeHTML(appointment.id)}">
                        <span class="calendar-event-time">
                            ${escapeHTML(formatTime(appointment.start_time))}
                        </span>
                        <span class="calendar-event-name">
                            ${escapeHTML(appointment.client_name)}
                        </span>
                    </div>
                `).join("")}

                ${dayReservations.map(reservation => `
                    <div class="calendar-event ${reservation.status === "confirmed" ? "confirmed" : "pending"}"
                         data-type="reservation"
                         data-id="${escapeHTML(reservation.id)}">
                        <span class="calendar-event-time">
                            ${escapeHTML(formatTime(reservation.reservation_time))}
                        </span>
                        <span class="calendar-event-name">
                            ${reservation.status === "confirmed" ? "✓ " : "🛒 "}
                            Réservation
                        </span>
                    </div>
                `).join("")}
            </div>
        `;

        cell.addEventListener("click", event => {
            const eventElement = event.target.closest(".calendar-event");

            if (eventElement) {
                const id = eventElement.dataset.id;

                if (eventElement.dataset.type === "reservation") {
                    const reservation = reservations.find(r => r.id === id);
                    if (reservation) showReservationDetails(reservation);
                } else {
                    const appointment = appointments.find(a => a.id === id);
                    if (appointment) openEditModal(appointment);
                }

                return;
            }

            showDayDetails(dateString);
        });

        grid.appendChild(cell);
    }

    function showDayDetails(dateString) {
        selectedDate = dateString;

        const dayAppointments = getDayAppointments(dateString);
        const dayReservations = getDayReservations(dateString);

        const date = new Date(dateString + "T12:00:00");

        if (!details) return;

        details.innerHTML = `
            <div class="calendar-details-heading">
                <h3>
                    ${date.toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                    })}
                </h3>
                <button type="button" id="calendar-add-day">
                    Ajouter un rendez-vous
                </button>
            </div>

            ${dayAppointments.map(appointment => `
                <div class="calendar-detail-item">
                    <div>
                        <strong>${escapeHTML(appointment.client_name)}</strong>
                        <p>${escapeHTML(formatTime(appointment.start_time))}
                        – ${escapeHTML(formatTime(appointment.end_time))}</p>
                        <p>${escapeHTML(appointment.appointment_type || "Autre")}</p>
                    </div>

                    <span class="calendar-status ${escapeHTML(appointment.status)}">
                        ${escapeHTML(appointment.status)}
                    </span>

                    <button type="button"
                            class="calendar-edit-button"
                            data-id="${escapeHTML(appointment.id)}">
                        Modifier
                    </button>
                </div>
            `).join("")}

            ${dayReservations.map(reservation => `
                <div class="calendar-detail-item">
                    <div>
                        <strong>🛒 Demande de réservation</strong>
                        <p>${escapeHTML(formatTime(reservation.reservation_time))}</p>
                        <p>${reservation.status === "pending" ? "En attente" : "Acceptée"}</p>
                    </div>

                    <button type="button"
                            class="calendar-reservation-button"
                            data-id="${escapeHTML(reservation.id)}">
                        Voir la demande
                    </button>
                </div>
            `).join("")}

            ${dayAppointments.length === 0 && dayReservations.length === 0
                ? `<p>Aucun rendez-vous pour cette journée.</p>`
                : ""}
        `;

        document.getElementById("calendar-add-day")?.addEventListener("click", () => {
            openNewModal(dateString);
        });

        details.querySelectorAll(".calendar-edit-button").forEach(button => {
            button.addEventListener("click", () => {
                const appointment = appointments.find(a => a.id === button.dataset.id);
                if (appointment) openEditModal(appointment);
            });
        });

        details.querySelectorAll(".calendar-reservation-button").forEach(button => {
            button.addEventListener("click", () => {
                const reservation = reservations.find(r => r.id === button.dataset.id);
                if (reservation) showReservationDetails(reservation);
            });
        });
    }

    function showReservationDetails(reservation) {
        if (!details) return;

        const items = reservation.reservation_items || [];

        details.innerHTML = `
            <div class="calendar-details-heading">
                <h3>Demande de réservation</h3>
            </div>

            <div class="calendar-detail-item">
                <div>
                    <strong>Date :</strong>
                    ${escapeHTML(reservation.reservation_date || "")}
                    <br>

                    <strong>Heure :</strong>
                    ${escapeHTML(formatTime(reservation.reservation_time))}
                    <br>

                    <strong>Statut :</strong>
                    ${escapeHTML(reservation.status)}
                    <br>

                    ${reservation.status === "confirmed" && reservation.pickup_code ? `
                        <div style="margin-top:15px;padding:15px;border:1px solid #d6b45b;border-radius:10px;background:#151515;">
                            <strong style="color:#d6b45b;">Code de retrait</strong>

                            <div style="font-size:28px;font-weight:bold;letter-spacing:5px;color:#d6b45b;margin:10px 0;">
                                ${escapeHTML(reservation.pickup_code)}
                            </div>

                            <button type="button" id="copy-pickup-code"
                                style="padding:8px 14px;border:0;border-radius:8px;cursor:pointer;">
                                Copier le code
                            </button>
                        </div>
                    ` : ""}

                    <br>
                    <strong>Client ID :</strong>
                    <small>${escapeHTML(reservation.user_id || "")}</small>
                </div>
            </div>

            <h4>Cartes demandées</h4>

            ${items.map(item => `
                <div class="calendar-detail-item">
                    <div>
                        <strong>${escapeHTML(item.card_name)}</strong>
                        <p>Quantité : ${escapeHTML(item.quantity)}</p>
                        <p>${Number(item.unit_price || 0).toFixed(2)} € / unité</p>
                    </div>
                </div>
            `).join("")}

            <p><strong>Total :</strong> ${Number(reservation.total || 0).toFixed(2)} €</p>

            ${reservation.status === "pending" ? `
                <div class="reservation-admin-actions" style="display:flex;gap:10px;margin-top:15px;">
                    <button type="button" id="reservation-accept"
                        style="background:#238636;color:white;padding:10px 15px;border:0;border-radius:8px;cursor:pointer;">
                        Accepter
                    </button>

                    <button type="button" id="reservation-reject"
                        style="background:#b42323;color:white;padding:10px 15px;border:0;border-radius:8px;cursor:pointer;">
                        Refuser
                    </button>
                </div>
            ` : ""}
        `;

        document.getElementById("copy-pickup-code")?.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(String(reservation.pickup_code));
                alert("Code de retrait copié !");
            } catch (error) {
                prompt("Copie le code de retrait :", reservation.pickup_code);
            }
        });

        document.getElementById("reservation-accept")?.addEventListener("click", () => {
            manageReservation(reservation.id, "confirmed");
        });

        document.getElementById("reservation-reject")?.addEventListener("click", () => {
            if (confirm("Refuser cette réservation ? Le stock sera restitué.")) {
                manageReservation(reservation.id, "rejected");
            }
        });
    }

    async function manageReservation(id, action) {
        const buttons = details.querySelectorAll("button");
        buttons.forEach(button => button.disabled = true);

        const { error } = await supabaseClient.rpc("manage_reservation", {
            p_reservation_id: id,
            p_action: action
        });

        if (error) {
            console.error("Erreur gestion réservation :", error);
            alert("Erreur lors de la modification de la réservation. Vérifie que la fonction SQL manage_reservation existe.");
            buttons.forEach(button => button.disabled = false);
            return;
        }

        alert(action === "confirmed"
            ? "Réservation acceptée !"
            : "Réservation refusée. Le stock a été restitué.");

        await loadAppointments();

        const reservation = reservations.find(r => r.id === id);

        if (reservation) {
            showReservationDetails(reservation);
        }
    }

    function openNewModal(dateString = formatDate(new Date())) {
        form.reset();

        fields.id.value = "";
        fields.date.value = dateString;
        fields.status.value = "confirmed";

        if (message) message.textContent = "";

        modal.hidden = false;
        modal.classList.add("active");
    }

    function openEditModal(appointment) {
        form.reset();

        fields.id.value = appointment.id;
        fields.name.value = appointment.client_name || "";
        fields.email.value = appointment.client_email || "";
        fields.phone.value = appointment.client_phone || "";
        fields.type.value = appointment.appointment_type || "Autre";
        fields.date.value = appointment.appointment_date;
        fields.start.value = formatTime(appointment.start_time);
        fields.end.value = formatTime(appointment.end_time);
        fields.status.value = appointment.status;
        fields.notes.value = appointment.notes || "";

        if (message) message.textContent = "";

        modal.hidden = false;
        modal.classList.add("active");
    }

    function closeModal() {
        modal.hidden = true;
        modal.classList.remove("active");
    }

    async function saveAppointment(event) {
        event.preventDefault();

        if (message) message.textContent = "";

        const appointmentData = {
            client_name: fields.name.value.trim(),
            client_email: fields.email.value.trim() || null,
            client_phone: fields.phone.value.trim() || null,
            appointment_type: fields.type.value,
            appointment_date: fields.date.value,
            start_time: fields.start.value,
            end_time: fields.end.value,
            status: fields.status.value,
            notes: fields.notes.value.trim() || null,
            updated_at: new Date().toISOString()
        };

        if (
            !appointmentData.client_name ||
            !appointmentData.appointment_date ||
            !appointmentData.start_time ||
            !appointmentData.end_time
        ) {
            if (message) message.textContent = "Veuillez remplir les champs obligatoires.";
            return;
        }

        if (appointmentData.end_time <= appointmentData.start_time) {
            if (message) message.textContent = "L'heure de fin doit être après l'heure de début.";
            return;
        }

        let result;

        if (fields.id.value) {
            result = await supabaseClient
                .from("appointments")
                .update(appointmentData)
                .eq("id", fields.id.value);
        } else {
            result = await supabaseClient
                .from("appointments")
                .insert([appointmentData]);
        }

        if (result.error) {
            console.error(result.error);

            if (message) message.textContent = "Erreur lors de l'enregistrement.";
            return;
        }

        closeModal();
        await loadAppointments();
        showDayDetails(appointmentData.appointment_date);
    }

    document.getElementById("calendar-prev")?.addEventListener("click", () => {
        if (currentView === "month") {
            currentDate.setMonth(currentDate.getMonth() - 1);
        } else {
            currentDate.setDate(currentDate.getDate() - 7);
        }

        renderCalendar();
    });

    document.getElementById("calendar-next")?.addEventListener("click", () => {
        if (currentView === "month") {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
            currentDate.setDate(currentDate.getDate() + 7);
        }

        renderCalendar();
    });

    document.getElementById("calendar-today")?.addEventListener("click", () => {
        currentDate = new Date();
        renderCalendar();
    });

    document.querySelectorAll("[data-view]").forEach(button => {
        button.addEventListener("click", () => {
            currentView = button.dataset.view;

            document.querySelectorAll("[data-view]").forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");
            renderCalendar();
        });
    });

    document.getElementById("add-appointment")?.addEventListener("click", () => {
        openNewModal(selectedDate || formatDate(new Date()));
    });

    document.getElementById("appointment-cancel")?.addEventListener("click", closeModal);

    document.getElementById("appointment-form")?.addEventListener("submit", saveAppointment);

    modal.querySelector(".modal-overlay")?.addEventListener("click", closeModal);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) {
            closeModal();
        }
    });

    // ==========================================
    // STATISTIQUES CLIQUABLES
    // RENDEZ-VOUS + RESERVATIONS
    // ==========================================

    document.querySelectorAll(".stat-clickable[data-filter]").forEach(button => {

        button.addEventListener("click", () => {

            const filter = button.dataset.filter;

            // Combine les rendez-vous classiques et les réservations
            let combined = [
                ...appointments.map(a => ({
                    ...a,
                    itemType: "appointment",
                    date: a.appointment_date
                })),

                ...reservations.map(r => ({
                    ...r,
                    itemType: "reservation",
                    date: r.reservation_date
                }))
            ];

            // Filtrage
            if (filter === "confirmed") {
                combined = combined.filter(item => item.status === "confirmed");
            }

            if (filter === "pending") {
                combined = combined.filter(item => item.status === "pending");
            }

            // Tous les éléments
            if (filter === "all") {
                combined = combined.filter(item =>
                    ["pending", "confirmed", "cancelled"].includes(item.status)
                );
            }

            // Tri par date puis heure
            combined.sort((a, b) => {

                const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));

                if (dateCompare !== 0) return dateCompare;

                const timeA = a.itemType === "reservation"
                    ? a.reservation_time
                    : a.start_time;

                const timeB = b.itemType === "reservation"
                    ? b.reservation_time
                    : b.start_time;

                return String(timeA || "").localeCompare(String(timeB || ""));
            });


            // Aucun résultat
            if (!combined.length) {

                if (details) {
                    details.innerHTML = `
                        <div class="calendar-details-heading">
                            <h3>
                                ${
                                    filter === "pending"
                                        ? "Rendez-vous en attente"
                                        : filter === "confirmed"
                                        ? "Rendez-vous confirmés"
                                        : "Tous les rendez-vous"
                                }
                            </h3>
                        </div>

                        <p>Aucun élément correspondant.</p>
                    `;
                }

                document.querySelector(".calendar-main-layout")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                return;
            }


            // On se positionne sur le premier élément
            const first = combined[0];

            currentDate = new Date(first.date + "T12:00:00");
            currentView = "month";

            document.querySelectorAll("[data-view]").forEach(btn => {
                btn.classList.remove("active");
            });

            document.querySelector('[data-view="month"]')?.classList.add("active");

            renderCalendar();


            // Affichage du jour correspondant
            if (first.itemType === "reservation") {
                showReservationDetails(first);
            } else {
                showDayDetails(first.date);
            }


            // Scroll vers le calendrier
            document.querySelector(".calendar-main-layout")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        });

    });
 
    loadAppointments();
});