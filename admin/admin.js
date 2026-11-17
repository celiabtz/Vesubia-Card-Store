// ==========================================
// VESUBIA CARD STORE — ADMINISTRATION
// Version stable sans Remove.bg
// ==========================================

(() => {
    "use strict";

    const loginSection = document.getElementById("login-section");
    const productSection = document.getElementById("product-section");
    const loginForm = document.getElementById("login-form");
    const productForm = document.getElementById("product-form");
    const loginMessage = document.getElementById("login-message");
    const formMessage = document.getElementById("form-message");
    const logoutButton = document.getElementById("logout-button");
    const publishButton = document.getElementById("publish-button");
    const imageInput = document.getElementById("product-image");
    const originalPreview = document.getElementById("original-preview");
    const imagePreview = document.getElementById("image-preview");
    const scanCardButton = document.getElementById("scan-card-button");

    let currentUser = null;
    let processedImageFile = null;
    let originalPreviewUrl = null;
    let previewUrl = null;
    let isProcessingImage = false;
    let isPublishing = false;

    function setMessage(element, message, isError = false) {
        if (!element) return;
        element.textContent = message;
        element.style.color = isError ? "#ff7777" : "";
    }

    function clearImagePreview() {
        if (originalPreviewUrl) {
            URL.revokeObjectURL(originalPreviewUrl);
            originalPreviewUrl = null;
        }

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        if (originalPreview) originalPreview.replaceChildren();
        if (imagePreview) imagePreview.replaceChildren();

        processedImageFile = null;
    }

    function showLogin(message = "") {
        if (loginSection) loginSection.hidden = false;
        if (productSection) productSection.hidden = true;
        if (logoutButton) logoutButton.hidden = true;
        setMessage(loginMessage, message);
    }

    function showProductForm(user) {
        currentUser = user;
        if (loginSection) loginSection.hidden = true;
        if (productSection) productSection.hidden = false;
        if (logoutButton) logoutButton.hidden = false;
    }

    function checkDependencies() {
        if (
            typeof window.supabase === "undefined" ||
            typeof supabaseClient === "undefined"
        ) {
            setMessage(
                loginMessage,
                "Erreur : connexion Supabase indisponible.",
                true
            );
            return false;
        }

        if (!loginForm || !productForm || !imageInput || !publishButton) {
            console.error("Éléments HTML de l'administration introuvables.");
            setMessage(
                loginMessage,
                "Erreur de chargement de l'administration.",
                true
            );
            return false;
        }

        return true;
    }

    async function checkAdmin(user) {
        const { data, error } = await supabaseClient
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Erreur de vérification administrateur :", error);
            return false;
        }

        return Boolean(data);
    }

    async function initializeAdmin() {
        showLogin();

        if (!checkDependencies()) return;

        try {
            const { data, error } =
                await supabaseClient.auth.getSession();

            if (error) throw error;
            if (!data.session) return;

            const user = data.session.user;
            const isAdmin = await checkAdmin(user);

            if (!isAdmin) {
                await supabaseClient.auth.signOut();
                showLogin("Ce compte n'a pas les droits administrateur.");
                return;
            }

            showProductForm(user);

        } catch (error) {
            console.error("Initialisation admin :", error);
            showLogin("Impossible de vérifier la connexion.");
        }
    }    // ==========================================
    // CONNEXION
    // ==========================================

    loginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("login-email")?.value.trim();
        const password = document.getElementById("login-password")?.value;

        setMessage(loginMessage, "Connexion en cours...");

        try {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) throw error;

            const isAdmin = await checkAdmin(data.user);

            if (!isAdmin) {
                await supabaseClient.auth.signOut();
                showLogin("Ce compte n'a pas les droits administrateur.");
                return;
            }

            showProductForm(data.user);

        } catch (error) {
            console.error("Erreur de connexion :", error);
            setMessage(
                loginMessage,
                "E-mail ou mot de passe incorrect.",
                true
            );
        }
    });

    // ==========================================
    // DÉCONNEXION
    // ==========================================

    logoutButton?.addEventListener("click", async () => {
        await supabaseClient.auth.signOut();

        currentUser = null;
        productForm.reset();
        clearImagePreview();

        showLogin("Tu es déconnecté.");
    });

    // ==========================================
    // CHARGEMENT DE LA PHOTO
    // Aucun appel Remove.bg
    // ==========================================

    imageInput?.addEventListener("change", () => {

        clearImagePreview();
        setMessage(formMessage, "");

        const file = imageInput.files?.[0];

        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            setMessage(
                formMessage,
                "Choisis une image JPG, PNG ou WEBP.",
                true
            );
            imageInput.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setMessage(
                formMessage,
                "L'image ne doit pas dépasser 5 Mo.",
                true
            );
            imageInput.value = "";
            return;
        }

        // La photo originale est conservée.
        processedImageFile = file;

        originalPreviewUrl = URL.createObjectURL(file);

        if (originalPreview) {
            const originalImg = document.createElement("img");
            originalImg.src = originalPreviewUrl;
            originalImg.alt = "Photo originale";

            originalPreview.replaceChildren(originalImg);
        }

        previewUrl = URL.createObjectURL(file);

        if (imagePreview) {
            const previewImg = document.createElement("img");
            previewImg.src = previewUrl;
            previewImg.alt = "Aperçu du produit";

            imagePreview.replaceChildren(previewImg);
        }

        setMessage(
            formMessage,
            "Photo chargée. Tu peux lancer le scan ou publier l'originale."
        );
    });    // ==========================================
    // SCANNER DE CARTE POKÉMON
    // ==========================================

    scanCardButton?.addEventListener("click", async () => {

        if (isProcessingImage || isPublishing) return;

        const originalFile = imageInput.files?.[0];

        if (!originalFile) {
            setMessage(formMessage, "Choisis d'abord une photo.", true);
            return;
        }

        if (typeof window.scanPokemonCard !== "function") {
            setMessage(
                formMessage,
                "Le scanner n'est pas chargé. Vérifie card-scanner.js.",
                true
            );
            console.error("window.scanPokemonCard est introuvable.");
            return;
        }

        isProcessingImage = true;
        scanCardButton.disabled = true;
        scanCardButton.textContent = "Scan en cours...";

        if (publishButton) publishButton.disabled = true;

        try {

            const scannedFile =
                await window.scanPokemonCard(originalFile);

            if (
                !(scannedFile instanceof File) ||
                !scannedFile.type.startsWith("image/")
            ) {
                throw new Error("Le scanner n'a pas retourné une image valide.");
            }

            processedImageFile = scannedFile;

            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }

            previewUrl = URL.createObjectURL(scannedFile);

            if (imagePreview) {
                const scannedImg = document.createElement("img");
                scannedImg.src = previewUrl;
                scannedImg.alt = "Carte Pokémon scannée";

                imagePreview.replaceChildren(scannedImg);
            }

            setMessage(
                formMessage,
                "Scan terminé ! Vérifie le résultat avant publication."
            );

        } catch (error) {

            console.error("Erreur du scanner :", error);

            // On conserve la photo originale si le scan échoue.
            processedImageFile = originalFile;

            setMessage(
                formMessage,
                "Le scan a échoué : " + error.message +
                " La photo originale reste disponible.",
                true
            );

        } finally {

            isProcessingImage = false;
            scanCardButton.disabled = false;
            scanCardButton.textContent =
                "✨ Redresser et améliorer ma carte";

            if (publishButton) publishButton.disabled = false;
        }
    });    // ==========================================
    // PUBLICATION DU PRODUIT
    // ==========================================

    productForm?.addEventListener("submit", async (event) => {

        event.preventDefault();

        if (isPublishing || isProcessingImage) return;

        if (!currentUser) {
            showLogin("Connecte-toi pour publier un produit.");
            return;
        }

        if (!productForm.reportValidity()) return;

        if (!processedImageFile) {
            setMessage(formMessage, "Ajoute d'abord une photo.", true);
            return;
        }

        isPublishing = true;
        publishButton.disabled = true;
        publishButton.textContent = "Publication en cours...";

        let uploadedImagePath = null;

        try {

            const isAdmin = await checkAdmin(currentUser);

            if (!isAdmin) {
                throw new Error("Accès administrateur non autorisé.");
            }

            const imageFile = processedImageFile;

            const extension =
                imageFile.type === "image/png" ? "png" :
                imageFile.type === "image/webp" ? "webp" : "jpg";

            uploadedImagePath =
                currentUser.id + "/" +
                crypto.randomUUID() + "." + extension;

            // Envoi de la photo dans Supabase Storage
            const { error: uploadError } = await supabaseClient.storage
                .from("product-images")
                .upload(uploadedImagePath, imageFile, {
                    contentType: imageFile.type,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: imageData } = supabaseClient.storage
                .from("product-images")
                .getPublicUrl(uploadedImagePath);

            if (!imageData?.publicUrl) {
                throw new Error("Impossible de récupérer l'adresse de l'image.");
            }

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

            setMessage(formMessage, "Produit publié avec succès !");

            productForm.reset();
            clearImagePreview();

        } catch (error) {

            console.error("Erreur de publication :", error);

            // Nettoyage de l'image si la publication échoue
            if (uploadedImagePath) {
                const { error: removeError } = await supabaseClient.storage
                    .from("product-images")
                    .remove([uploadedImagePath]);

                if (removeError) {
                    console.warn("Nettoyage impossible :", removeError);
                }
            }

            setMessage(
                formMessage,
                "Erreur de publication : " + error.message,
                true
            );

        } finally {

            isPublishing = false;
            publishButton.disabled = false;
            publishButton.textContent = "Publier le produit";
        }
    });

    // ==========================================
    // DÉMARRAGE DE L'ADMINISTRATION
    // ==========================================

    initializeAdmin();

})();