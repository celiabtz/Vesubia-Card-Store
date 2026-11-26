
/* =====================================================
   VESUBIA CARD STORE
   Chatbot intelligent OpenAI + formulaire Supabase
   ===================================================== */

// -----------------------------
// CONFIGURATION DU CHATBOT
// -----------------------------

const chatMessages = document.getElementById("sav-chat-messages");
const chatForm = document.getElementById("sav-chat-form");
const chatInput = document.getElementById("sav-chat-text");

const conversationHistory = [];

const quickQuestions = {
    location: "Où se trouve votre boutique ?",
    phone: "Quel est votre numéro de téléphone ?",
    social: "Quels sont vos réseaux sociaux ?"
};

// -----------------------------
// AFFICHAGE DES MESSAGES
// -----------------------------

function addChatMessage(text, type) {
    if (!chatMessages) return null;

    const message = document.createElement("div");

    message.className =
        type === "user" ? "sav-user-message" : "sav-bot-message";

    message.textContent = text;

    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return message;
}

// -----------------------------
// INDICATEUR DE CHARGEMENT
// -----------------------------

function showTyping() {
    return addChatMessage("Assistant en train d'écrire…", "bot");
}

// -----------------------------
// COMMUNICATION AVEC OPENAI
// -----------------------------

async function askVesubiaAI(question) {
    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        throw new Error("Connexion Supabase introuvable.");
    }

    conversationHistory.push({
        role: "user",
        content: question
    });

    // On conserve uniquement les 12 derniers messages.
    const messagesToSend = conversationHistory.slice(-12);

    const { data, error } = await supabaseClient.functions.invoke(
        "vesubia-chat",
        {
            body: {
                messages: messagesToSend
            }
        }
    );

    if (error) {
        console.error("Erreur Supabase Edge Function :", error);
        throw new Error("Impossible de contacter notre assistant.");
    }

    if (!data || !data.reply) {
        console.error("Réponse invalide :", data);
        throw new Error(
            data?.error || "L'assistant n'a pas pu générer de réponse."
        );
    }

    conversationHistory.push({
        role: "assistant",
        content: data.reply
    });

    // Limite l'historique conservé dans le navigateur.
    if (conversationHistory.length > 12) {
        conversationHistory.splice(
            0,
            conversationHistory.length - 12
        );
    }

    return data.reply;
}

// -----------------------------
// ENVOI D'UNE QUESTION
// -----------------------------

let chatBusy = false;

async function sendChatQuestion(question) {
    if (!question || chatBusy) return;

    chatBusy = true;

    const submitButton = chatForm?.querySelector(
        'button[type="submit"]'
    );

    if (chatInput) chatInput.disabled = true;
    if (submitButton) submitButton.disabled = true;

    addChatMessage(question, "user");

    const typingMessage = showTyping();

    try {
        const answer = await askVesubiaAI(question);

        if (typingMessage) typingMessage.remove();

        addChatMessage(answer, "bot");

    } catch (error) {
        console.error("Erreur chatbot Vesubia :", error);

        if (typingMessage) typingMessage.remove();

        addChatMessage(
            "Je rencontre actuellement un petit problème technique. " +
            "Vous pouvez nous envoyer votre demande grâce au formulaire " +
            "de contact, notre équipe pourra vous répondre.",
            "bot"
        );

    } finally {
        chatBusy = false;

        if (chatInput) {
            chatInput.disabled = false;
            chatInput.focus();
        }

        if (submitButton) submitButton.disabled = false;
    }
}

// -----------------------------
// FORMULAIRE DU CHATBOT
// -----------------------------

if (chatForm && chatInput) {
    chatForm.addEventListener("submit", event => {
        event.preventDefault();

        const question = chatInput.value.trim();

        if (!question || chatBusy) return;

        chatInput.value = "";

        sendChatQuestion(question);
    });
}

// -----------------------------
// QUESTIONS RAPIDES
// -----------------------------

document.querySelectorAll("[data-question]").forEach(button => {
    button.addEventListener("click", () => {
        const key = button.dataset.question;
        const question = quickQuestions[key];

        if (!question || chatBusy) return;

        sendChatQuestion(question);
    });
});

// =====================================================
// FORMULAIRE DE CONTACT SUPABASE
// =====================================================

// -----------------------------
// CRÉATION D'UN IDENTIFIANT
// -----------------------------

function createConversationId() {
    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {
        return window.crypto.randomUUID();
    }

    if (
        window.crypto &&
        typeof window.crypto.getRandomValues === "function"
    ) {
        const bytes = new Uint8Array(16);

        window.crypto.getRandomValues(bytes);

        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = Array.from(
            bytes,
            byte => byte.toString(16).padStart(2, "0")
        );

        return [
            hex.slice(0, 4).join(""),
            hex.slice(4, 6).join(""),
            hex.slice(6, 8).join(""),
            hex.slice(8, 10).join(""),
            hex.slice(10, 16).join("")
        ].join("-");
    }

    throw new Error(
        "Impossible de créer un identifiant sécurisé."
    );
}

// -----------------------------
// ENVOI DU FORMULAIRE
// -----------------------------

const requestForm = document.getElementById("sav-request-form");

if (requestForm) {
    requestForm.addEventListener("submit", async event => {
        event.preventDefault();

        const button = document.getElementById("sav-submit");
        const status = document.getElementById("sav-form-status");

        const nameInput = document.getElementById("sav-name");
        const emailInput = document.getElementById("sav-email");
        const messageInput = document.getElementById("sav-message");

        if (
            !button ||
            !status ||
            !nameInput ||
            !emailInput ||
            !messageInput
        ) {
            if (status) {
                status.textContent = "Le formulaire est incomplet.";
            }
            return;
        }

        const customerName = nameInput.value.trim();
        const customerEmail = emailInput.value.trim();
        const message = messageInput.value.trim();

        if (
            !customerName ||
            !customerEmail ||
            !message
        ) {
            status.textContent =
                "Merci de remplir tous les champs avant l'envoi.";
            return;
        }

        const originalButtonText = button.textContent;

        button.disabled = true;
        button.textContent = "Envoi en cours...";
        status.textContent = "";

        try {
            if (
                typeof supabaseClient === "undefined" ||
                !supabaseClient
            ) {
                throw new Error(
                    "Connexion Supabase introuvable."
                );
            }

            const { error } = await supabaseClient
                .from("support_messages")
                .insert({
                    conversation_id: createConversationId(),
                    sender_role: "customer",
                    customer_name: customerName,
                    customer_email: customerEmail,
                    message: message
                });

            if (error) {
                console.error("Erreur Supabase :", error);

                throw new Error(
                    error.message ||
                    "Supabase a refusé l'enregistrement."
                );
            }

            status.textContent =
                "Votre demande a bien été envoyée. Merci !";

            requestForm.reset();

        } catch (error) {
            console.error("Échec de l'envoi :", error);

            status.textContent =
                "Votre demande n'a pas pu être envoyée : " +
                error.message;

        } finally {
            button.disabled = false;

            button.textContent =
                originalButtonText || "Envoyer ma demande";
        }
    });
}
