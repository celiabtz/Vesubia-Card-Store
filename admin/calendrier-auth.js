document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("calendar-grid");
    const title = document.getElementById("calendar-title");
    const modal = document.getElementById("appointment-modal");
    const form = document.getElementById("appointment-form");

    if (!grid || !form || !modal) return;

    let currentDate = new Date();
    let currentView = "month";
    let appointments = [];
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
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
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
            console.error("Erreur chargement rendez-vous :", error);
            return;
        }

        appointments = data || [];
        renderCalendar();
        updateStats();
    }

    function updateStats() {
        const total = appointments.length;
        const confirmed = appointments.filter(a => a.status === "confirmed").length;
        const pending = appointments.filter(a => a.status === "pending").length;

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

        const dayAppointments = appointments.filter(
            appointment => appointment.appointment_date === dateString
        );

        cell.innerHTML = `
            <div class="calendar-day-number">${date.getDate()}</div>
            <div class="calendar-day-events">
                ${dayAppointments.map(appointment => `
                    <div class="calendar-event ${escapeHTML(appointment.status)}"
                         data-id="${escapeHTML(appointment.id)}">
                        <span class="calendar-event-time">
                            ${escapeHTML(formatTime(appointment.start_time))}
                        </span>
                        <span class="calendar-event-name">
                            ${escapeHTML(appointment.client_name)}
                        </span>
                    </div>
                `).join("")}
            </div>
        `;

        cell.addEventListener("click", event => {
            const appointmentElement = event.target.closest(".calendar-event");

            if (appointmentElement) {
                const appointment = appointments.find(
                    a => a.id === appointmentElement.dataset.id
                );

                if (appointment) {
                    openEditModal(appointment);
                }

                return;
            }

            showDayDetails(dateString);
        });

        grid.appendChild(cell);
    }

    function showDayDetails(dateString) {
        selectedDate = dateString;

        const dayAppointments = appointments.filter(
            a => a.appointment_date === dateString
        );

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

            ${
                dayAppointments.length
                    ? dayAppointments.map(appointment => `
                        <div class="calendar-detail-item">
                            <div>
                                <strong>
                                    ${escapeHTML(appointment.client_name)}
                                </strong>
                                <p>
                                    ${escapeHTML(formatTime(appointment.start_time))}
                                    – ${escapeHTML(formatTime(appointment.end_time))}
                                </p>
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
                    `).join("")
                    : `<p>Aucun rendez-vous pour cette journée.</p>`
            }
        `;

        const addButton = document.getElementById("calendar-add-day");

        if (addButton) {
            addButton.addEventListener("click", () => {
                openNewModal(dateString);
            });
        }

        details.querySelectorAll(".calendar-edit-button").forEach(button => {
            button.addEventListener("click", () => {
                const appointment = appointments.find(
                    a => a.id === button.dataset.id
                );

                if (appointment) openEditModal(appointment);
            });
        });
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

            if (message) {
                message.textContent = "Erreur lors de l'enregistrement.";
            }

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

    loadAppointments();
});