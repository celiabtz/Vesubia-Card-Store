
// ==========================================
// VESUBIA CARD STORE - ADMINISTRATION
// AVEC DÉTOURAGE AUTOMATIQUE REMOVE.BG
// ==========================================

const loginSection = document.getElementById("login-section");
const productSection = document.getElementById("product-section");

const loginForm = document.getElementById("login-form");
const productForm = document.getElementById("product-form");

const loginMessage = document.getElementById("login-message");
const formMessage = document.getElementById("form-message");

const logoutButton = document.getElementById("logout-button");
const publishButton = document.getElementById("publish-button");

const imageInput = document.getElementById("product-image");
const imagePreview = document.getElementById("image-preview");

let currentUser = null;
let processedImageFile = null;
let previewUrl = null;
let isProcessingImage = false;

// ==========================================
// GESTION APERÇU
// ==========================================

function clearImagePreview() {
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    imagePreview.innerHTML = "";
    processedImageFile = null;
}

// ==========================================
// AFFICHAGE
// ==========================================

function showLogin(message = "") {
    loginSection.hidden = false;
    productSection.hidden = true;
    logoutButton.hidden = true;
    loginMessage.textContent = message;
}

function showProductForm(user) {
    currentUser = user;
    loginSection.hidden = true;
    productSection.hidden = false;
    logoutButton.hidden = false;
}

// ==========================================
// VÉRIFICATION ADMINISTRATEUR
// ==========================================

async function checkAdmin(user) {
    const { data, error } = await supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error("Erreur de vérification :", error);
        return false;
    }

    return !!data;
}

async function showAdmin(user) {
    const isAdmin = await checkAdmin(user);

    if (!isAdmin) {
        await supabaseClient.auth.signOut();
        currentUser = null;
        showLogin("Ce compte n'a pas les droits administrateur.");
        return;
    }

   window.location.replace("dashboard.html");
}

// ==========================================
// INITIALISATION
// ==========================================

async function initializeAdmin() {
    showLogin();

    if (!window.supabase || typeof supabaseClient === "undefined") {
        loginMessage.textContent = "Erreur de connexion à Supabase.";
        return;
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error(error);
        showLogin("Impossible de vérifier la connexion.");
        return;
    }

    if (data.session) {
    const isAdmin = await checkAdmin(data.session.user);

    if (!isAdmin) {
        await supabaseClient.auth.signOut();
        showLogin("Ce compte n'a pas les droits administrateur.");
        return;
    }

    showProductForm(data.session.user);
}
}

// ==========================================
// CONNEXION
// ==========================================

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    loginMessage.textContent = "Connexion en cours...";

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error(error);
        loginMessage.textContent = "E-mail ou mot de passe incorrect.";
        return;
    }

    await showAdmin(data.user);
});

// ==========================================
// DÉCONNEXION
// ==========================================

logoutButton.addEventListener("click", async function() {
    await supabaseClient.auth.signOut();

    currentUser = null;
    productForm.reset();
    clearImagePreview();

    showLogin("Tu es déconnecté.");
});

// ==========================================
// DÉTOURAGE AUTOMATIQUE DES PHOTOS
// ==========================================

imageInput.addEventListener("change", async function() {

    clearImagePreview();
    formMessage.textContent = "";

    const file = this.files[0];

    if (!file) return;

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        alert("Choisis une image JPG, PNG ou WEBP.");
        this.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("L'image ne doit pas dépasser 5 Mo.");
        this.value = "";
        return;
    }

    isProcessingImage = true;
    publishButton.disabled = true;
    imageInput.disabled = true;

    formMessage.textContent =
        "Détourage de ton produit en cours...";

    try {

        // Récupération de la session
        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error || !data.session) {
            throw new Error("Session administrateur expirée.");
        }

        // Préparation de la photo
        const formData = new FormData();
        formData.append("image", file, file.name);

        // Appel de la fonction Supabase
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/remove-background`,
            {
                method: "POST",
                headers: {
                    "Authorization":
                        `Bearer ${data.session.access_token}`,
                    "apikey": SUPABASE_ANON_KEY
                },
                body: formData
            }
        );

        if (!response.ok) {
            let message = "Impossible de détourer la photo.";

            try {
                const errorData = await response.json();
                message = errorData.error || message;
            } catch (_) {}

            throw new Error(message);
        }

        // Récupération du PNG transparent
        const blob = await response.blob();

        if (blob.type !== "image/png" || blob.size === 0) {
            throw new Error("Le PNG reçu est invalide.");
        }

        // Création du fichier détouré
        processedImageFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, "") + ".png",
            { type: "image/png" }
        );

        // Affichage de l'aperçu
        previewUrl = URL.createObjectURL(processedImageFile);

        const image = document.createElement("img");
        image.src = previewUrl;
        image.alt = "Produit détouré - fond transparent";

        imagePreview.appendChild(image);

        formMessage.textContent =
            "Photo détourée avec succès ! Tu peux publier ton produit.";

    } catch (error) {

        console.error("Erreur de détourage :", error);

        processedImageFile = null;

        formMessage.textContent =
            "Erreur de détourage : " + error.message;

    } finally {

        isProcessingImage = false;
        imageInput.disabled = false;
        publishButton.disabled = false;

    }
});

// ==========================================
// PUBLICATION PRODUIT
// ==========================================

productForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    if (!currentUser) {
        showLogin("Connecte-toi pour publier un produit.");
        return;
    }

    if (!productForm.reportValidity()) return;

    if (isProcessingImage) {
        formMessage.textContent =
            "Attends la fin du détourage.";
        return;
    }

    if (!processedImageFile) {
        formMessage.textContent =
            "Ajoute une photo et attends son détourage.";
        return;
    }

    publishButton.disabled = true;
    publishButton.textContent = "Publication en cours...";
    formMessage.textContent = "";

    let imagePath = null;

    try {

        const isAdmin = await checkAdmin(currentUser);

        if (!isAdmin) {
            throw new Error("Accès administrateur non autorisé.");
        }

        // Le fichier est désormais un PNG transparent
        const imageFile = processedImageFile;

        imagePath = currentUser.id + "/" +
            crypto.randomUUID() + ".png";

        // Envoi du PNG détouré dans Supabase Storage
        const { error: uploadError } = await supabaseClient.storage
            .from("product-images")
            .upload(imagePath, imageFile, {
                contentType: "image/png",
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data: imageData } = supabaseClient.storage
            .from("product-images")
            .getPublicUrl(imagePath);

        // Informations du produit
        const product = {
            name: document.getElementById("product-name").value.trim(),
            description: document.getElementById("product-description").value.trim(),
            price: Number(document.getElementById("product-price").value),
            stock: Number(document.getElementById("product-stock").value),
            category: document.getElementById("product-category").value,
            image_url: imageData.publicUrl,
            featured: document.getElementById("product-featured").checked
        };

        // Enregistrement dans la base
        const { error: insertError } = await supabaseClient
            .from("products")
            .insert(product);

        if (insertError) throw insertError;

        formMessage.textContent =
            "Produit publié avec succès !";

        productForm.reset();
        clearImagePreview();

    } catch (error) {

        console.error("Erreur de publication :", error);

        formMessage.textContent =
            "Erreur : " + error.message;

    } finally {

        publishButton.disabled = false;
        publishButton.textContent = "Publier le produit";

    }
});

// ==========================================
// DÉMARRAGE
// ==========================================

initializeAdmin();
