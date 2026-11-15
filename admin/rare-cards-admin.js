
const form = document.getElementById("rare-card-form");
const message = document.getElementById("rare-card-message");
const button = document.getElementById("save-card-button");
const imageInput = document.getElementById("card-image");
const preview = document.getElementById("card-image-preview");

let currentUser = null;

// VÉRIFICATION ADMIN
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
    }
}

// APERÇU PHOTO
imageInput.addEventListener("change", () => {
    preview.innerHTML = "";

    const file = imageInput.files[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        message.textContent = "Format d'image non accepté.";
        imageInput.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        message.textContent = "Image trop volumineuse (5 Mo maximum).";
        imageInput.value = "";
        return;
    }

    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = "Aperçu de la carte";

    preview.appendChild(image);
    message.textContent = "";
});

// ENREGISTRER LA CARTE
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) return;

    const file = imageInput.files[0];

    if (!file) {
        message.textContent = "Ajoute une photo de la carte.";
        return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024) {
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

        const extension = file.name.split(".").pop().toLowerCase();

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
        preview.innerHTML = "";

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

initializeRareCards();
