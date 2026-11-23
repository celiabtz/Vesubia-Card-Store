
const form = document.getElementById("rare-card-form");
const message = document.getElementById("rare-card-message");
const button = document.getElementById("save-card-button");

const imageInput = document.getElementById("card-image");
const scanButton = document.getElementById("rare-scan-card-button");
const qualitySelect = document.getElementById("rare-scan-quality");

const originalPreview = document.getElementById("rare-original-preview");
const resultPreview = document.getElementById("rare-image-preview");

let currentUser = null;
let originalFile = null;
let selectedFile = null;

let originalURL = null;
let resultURL = null;

// =========================
// VÉRIFICATION ADMIN
// =========================

async function initializeRareCards() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.href = "admin.html";
        return;
    }

    currentUser = data.session.user;

    const { data: admin, error: adminError } = await supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (adminError || !admin) {
        await supabaseClient.auth.signOut();
        window.location.href = "admin.html";
        return;
    }
}

// =========================
// GESTION DES APERÇUS
// =========================

function clearPreviewURLs() {
    if (originalURL) {
        URL.revokeObjectURL(originalURL);
        originalURL = null;
    }

    if (resultURL) {
        URL.revokeObjectURL(resultURL);
        resultURL = null;
    }
}

function displayImage(container, file, label) {
    container.innerHTML = "";

    if (!file) return;

    const url = URL.createObjectURL(file);

    const image = document.createElement("img");
    image.src = url;
    image.alt = label;
    image.style.maxWidth = "100%";
    image.style.display = "block";
    image.style.borderRadius = "12px";

    container.appendChild(image);

    const text = document.createElement("p");
    text.textContent = label;
    container.appendChild(text);

    return url;
}

function handleImageSelection(file) {
    clearPreviewURLs();

    originalPreview.innerHTML = "";
    resultPreview.innerHTML = "";
    message.textContent = "";

    originalFile = null;
    selectedFile = null;

    scanButton.disabled = true;

    if (!file) return;

    const acceptedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!acceptedTypes.includes(file.type)) {
        message.textContent = "Format accepté : JPG, PNG ou WEBP.";
        imageInput.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        message.textContent = "Image trop volumineuse (5 Mo maximum).";
        imageInput.value = "";
        return;
    }

    originalFile = file;
    selectedFile = file;

    originalURL = displayImage(
        originalPreview,
        file,
        "Photo originale"
    );

    resultURL = displayImage(
        resultPreview,
        file,
        "Image prête à être scannée"
    );

    scanButton.disabled = false;
}

// =========================
// IMPORT PHOTO
// =========================

imageInput.addEventListener("change", () => {
    handleImageSelection(imageInput.files[0]);
});

// =========================
// AMÉLIORATION VISUELLE
// =========================

async function applyQuality(file, quality) {
    const image = new Image();
    const temporaryURL = URL.createObjectURL(file);

    try {
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = temporaryURL;
        });

        const canvas = document.createElement("canvas");

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext("2d");

        if (quality === "natural") {
            context.filter = "none";
        }

        if (quality === "balanced") {
            context.filter = "brightness(1.03) contrast(1.04) saturate(1.02)";
        }

        if (quality === "premium") {
            context.filter = "brightness(1.05) contrast(1.07) saturate(1.03)";
        }

        context.drawImage(image, 0, 0);

        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, "image/jpeg", 0.95);
        });

        if (!blob) {
            throw new Error("Impossible de générer l'image.");
        }

        return new File(
            [blob],
            "rare-card-scanned.jpg",
            { type: "image/jpeg" }
        );

    } finally {
        URL.revokeObjectURL(temporaryURL);
    }
}

// =========================
// SCANNER VESUBIA
// =========================

scanButton.addEventListener("click", async () => {
    if (!originalFile) {
        message.textContent = "Choisis d'abord une photographie.";
        return;
    }

    scanButton.disabled = true;
    scanButton.textContent = "Scanner en cours...";
    message.textContent = "";

    try {
        let scannedFile = originalFile;

        // Correction de perspective via le scanner OpenCV
        if (typeof window.scanPokemonCard === "function") {
            scannedFile = await window.scanPokemonCard(originalFile);
        } else {
            throw new Error("Le scanner OpenCV n'est pas chargé.");
        }

        // Application du niveau de qualité
        const quality = qualitySelect.value || "balanced";

        selectedFile = await applyQuality(
            scannedFile,
            quality
        );

        // Mise à jour de l'aperçu du résultat
        if (resultURL) {
            URL.revokeObjectURL(resultURL);
        }

        resultPreview.innerHTML = "";

        resultURL = displayImage(
            resultPreview,
            selectedFile,
            "Résultat du VESUBIA DIGITAL SCAN"
        );

        message.textContent = "Scan terminé ! Image prête à être enregistrée.";

    } catch (error) {
        console.error("Erreur scanner :", error);

        selectedFile = originalFile;

        if (resultURL) {
            URL.revokeObjectURL(resultURL);
        }

        resultPreview.innerHTML = "";

        resultURL = displayImage(
            resultPreview,
            originalFile,
            "Photo originale conservée"
        );

        message.textContent =
            "Le scan a échoué. La photo originale est conservée.";
    } finally {
        scanButton.disabled = false;
        scanButton.textContent = "✨ Scanner et améliorer";
    }
});

// =========================
// ENREGISTRER LA CARTE
// =========================

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
        message.textContent = "Session administrateur introuvable.";
        return;
    }

    const file = selectedFile;

    if (!file) {
        message.textContent = "Photographie ou importe la carte.";
        return;
    }

    const acceptedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (
        !acceptedTypes.includes(file.type) ||
        file.size > 5 * 1024 * 1024
    ) {
        message.textContent = "Photo invalide ou supérieure à 5 Mo.";
        return;
    }

    button.disabled = true;
    button.textContent = "Enregistrement...";
    message.textContent = "";

    let uploadedPath = null;

    try {
        const { data: admin, error: adminError } = await supabaseClient
            .from("admin_users")
            .select("user_id")
            .eq("user_id", currentUser.id)
            .maybeSingle();

        if (adminError || !admin) {
            throw new Error("Accès administrateur refusé.");
        }

        const extension = file.type === "image/jpeg"
            ? "jpg"
            : file.type === "image/png"
                ? "png"
                : "webp";

        uploadedPath = currentUser.id + "/" +
            crypto.randomUUID() + "." + extension;

        const { error: uploadError } = await supabaseClient.storage
            .from("rare-card-images")
            .upload(uploadedPath, file, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data: imageData } = supabaseClient.storage
            .from("rare-card-images")
            .getPublicUrl(uploadedPath);

        const card = {
            name: document.getElementById("card-name").value.trim(),
            card_set: document.getElementById("card-set").value.trim(),
            card_number: document.getElementById("card-number").value.trim(),
            language: document.getElementById("card-language").value,
            rarity: document.getElementById("card-rarity").value.trim(),
            tier: document.getElementById("card-tier").value || null,
            grader: document.getElementById("card-grader").value,
            grade: document.getElementById("card-grade").value.trim(),
            certification: document.getElementById("card-certification").value.trim(),
            condition: document.getElementById("card-condition").value,
            price: Number(document.getElementById("card-price").value),
            stock: Number(document.getElementById("card-stock").value),
            available: document.getElementById("card-available").checked,
            image_url: imageData.publicUrl,
            description: document.getElementById("card-description").value.trim()
        };

        const { error: insertError } = await supabaseClient
            .from("rare_cards")
            .insert(card);

        if (insertError) throw insertError;

        message.textContent = "Carte ajoutée avec succès !";

        form.reset();

        originalPreview.innerHTML = "";
        resultPreview.innerHTML = "";

        imageInput.value = "";

        originalFile = null;
        selectedFile = null;

        clearPreviewURLs();

        scanButton.disabled = true;

    } catch (error) {
        console.error(error);

        message.textContent = "Erreur : " + error.message;

        if (uploadedPath) {
            await supabaseClient.storage
                .from("rare-card-images")
                .remove([uploadedPath]);
        }

    } finally {
        button.disabled = false;
        button.textContent = "Enregistrer la carte";
    }
});

// =========================
// DÉMARRAGE
// =========================

scanButton.disabled = true;

initializeRareCards();
