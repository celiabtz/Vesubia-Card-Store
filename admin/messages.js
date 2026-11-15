
document.addEventListener("DOMContentLoaded", async () => {
    const list = document.getElementById("messages-list");
    const statusText = document.getElementById("messages-status");
    const filter = document.getElementById("message-filter");
    const search = document.getElementById("message-search");

    let allMessages = [];

    function setStatus(text) {
        statusText.textContent = text;
    }

    function formatDate(date) {
        return new Date(date).toLocaleString("fr-FR", {
            dateStyle: "long",
            timeStyle: "short"
        });
    }

    function updateCounters(messages) {
        document.getElementById("total-count").textContent = messages.length;
        document.getElementById("new-count").textContent =
            messages.filter(m => m.status === "nouveau").length;
        document.getElementById("progress-count").textContent =
            messages.filter(m => m.status === "en cours").length;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function renderMessages() {
        list.replaceChildren();

        const selectedStatus = filter.value;
        const searchText = search.value.trim().toLocaleLowerCase("fr");

        const visibleMessages = allMessages.filter(message => {
            const matchesStatus =
                selectedStatus === "all" || message.status === selectedStatus;

            const searchableText = [
                message.customer_name,
                message.customer_email,
                message.category,
                message.message
            ].join(" ").toLocaleLowerCase("fr");

            return matchesStatus && searchableText.includes(searchText);
        });

        if (!visibleMessages.length) {
            list.appendChild(createElement(
                "p",
                "admin-empty",
                "Aucune demande ne correspond à votre recherche."
            ));
            return;
        }

        visibleMessages.forEach(message => {
            const card = createElement("article", "form-section");
            const heading = createElement("div", "admin-section-heading");
            const identity = document.createElement("div");

            identity.appendChild(createElement("h3", "", message.customer_name));
            identity.appendChild(createElement("p", "", message.customer_email));
            identity.appendChild(createElement("small", "", formatDate(message.created_at)));

            const badge = createElement(
                "span",
                "message-status-badge",
                message.status || "nouveau"
            );

            heading.append(identity, badge);

            const category = createElement(
                "p",
                "",
                "Sujet : " + message.category
            );

            const content = createElement("p", "message-content", message.message);

            const actions = createElement("div", "form-buttons");
            const statusLabel = createElement("label", "", "Statut de la demande");

            const select = document.createElement("select");
            [
                ["nouveau", "Nouveau"],
                ["en cours", "En cours"],
                ["traité", "Traité"]
            ].forEach(([value, label]) => {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = label;
                select.appendChild(option);
            });

            select.value = message.status || "nouveau";

            const saveButton = createElement(
                "button",
                "publish-button",
                "Enregistrer le statut"
            );
            saveButton.type = "button";

            saveButton.addEventListener("click", async () => {
                saveButton.disabled = true;
                saveButton.textContent = "Enregistrement...";

                try {
                    const { error } = await supabaseClient
                        .from("support_messages")
                        .update({ status: select.value })
                        .eq("id", message.id);

                    if (error) throw error;

                    message.status = select.value;
                    updateCounters(allMessages);
                    renderMessages();
                    setStatus("Statut mis à jour.");

                } catch (error) {
                    console.error(error);
                    setStatus("Impossible de modifier le statut : " + error.message);
                    saveButton.disabled = false;
                    saveButton.textContent = "Enregistrer le statut";
                }
            });

            statusLabel.htmlFor = "status-" + message.id;
            select.id = "status-" + message.id;

            actions.append(statusLabel, select, saveButton);
            card.append(heading, category, content, actions);
            list.appendChild(card);
        });
    }

    async function loadMessages() {
        setStatus("Chargement des demandes...");
        list.replaceChildren();

        try {
            const { data, error } = await supabaseClient
                .from("support_messages")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            allMessages = data || [];
            updateCounters(allMessages);
            renderMessages();

            setStatus(allMessages.length + " demande(s) chargée(s).");

        } catch (error) {
            console.error("Erreur de chargement des messages :", error);
            setStatus(
                "Impossible de charger les messages. Vérifiez votre connexion administrateur et les règles RLS. " +
                error.message
            );
        }
    }

    try {
        if (typeof supabaseClient === "undefined" || !supabaseClient) {
            throw new Error("Client Supabase introuvable.");
        }

        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        if (!data.session) {
            window.location.href = "admin.html";
            return;
        }

        await loadMessages();

    } catch (error) {
        console.error(error);
        setStatus("Connexion impossible : " + error.message);
    }

    filter.addEventListener("change", renderMessages);
    search.addEventListener("input", renderMessages);

    document.getElementById("refresh-messages")
        .addEventListener("click", loadMessages);

    document.getElementById("logout-button")
        .addEventListener("click", async () => {
            const { error } = await supabaseClient.auth.signOut();

            if (error) {
                setStatus("Erreur de déconnexion : " + error.message);
                return;
            }

            window.location.href = "admin.html";
        });
});
