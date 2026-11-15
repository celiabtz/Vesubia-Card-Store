alert("PRODUCTS.JS EST BIEN CHARGÉ !");
// ==========================================
// VESUBIA CARD STORE - GESTION PRODUITS
// ==========================================

const list = document.getElementById("products-list");
const count = document.getElementById("products-count");
const message = document.getElementById("products-message");

const modal = document.getElementById("edit-modal");
const editForm = document.getElementById("edit-form");
const closeModal = document.getElementById("close-modal");
const logoutButton = document.getElementById("logout-button");

let currentProducts = [];
let selectedProduct = null;
let currentUser = null;

// ==========================================
// OUTILS
// ==========================================

function storagePathFromUrl(url) {
    if (!url) return null;

    const marker = "/storage/v1/object/public/product-images/";
    const position = url.indexOf(marker);

    if (position === -1) return null;

    return decodeURIComponent(url.substring(position + marker.length));
}

async function checkAdmin(user) {
    const { data, error } = await supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) throw error;

    return !!data;
}

// ==========================================
// CHARGER LES PRODUITS
// ==========================================

async function loadProducts() {
    list.textContent = "Chargement des produits...";
    message.textContent = "";

    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        list.textContent = "Impossible de charger les produits.";
        return;
    }

    currentProducts = data || [];
    count.textContent = currentProducts.length +
        (currentProducts.length > 1 ? " produits enregistrés" : " produit enregistré");

    list.innerHTML = "";

    if (currentProducts.length === 0) {
        list.textContent = "Aucun produit pour le moment.";
        return;
    }

    currentProducts.forEach(product => {
        const card = document.createElement("article");
        card.className = "admin-product-card";

        const image = document.createElement("img");
        image.src = product.image_url || "";
        image.alt = product.name;
        image.loading = "lazy";

        const details = document.createElement("div");
        details.className = "admin-product-details";

        const title = document.createElement("h3");
        title.textContent = product.name;

        const description = document.createElement("p");
        description.textContent = product.description;

        const price = document.createElement("p");
        price.className = "admin-product-price";
        price.textContent = Number(product.price).toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR"
        });

        const stock = document.createElement("p");
        stock.textContent = "Stock : " + product.stock;

        const featured = document.createElement("p");
        featured.textContent = product.featured ? "★ À la une" : "Non mis en avant";

        const actions = document.createElement("div");
        actions.className = "admin-product-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "edit-product-button";
        editButton.textContent = "Modifier";
        editButton.addEventListener("click", () => openEdit(product.id));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-product-button";
        deleteButton.textContent = "Supprimer";
        deleteButton.addEventListener("click", () => deleteProduct(product.id));

        actions.append(editButton, deleteButton);
        details.append(title, description, price, stock, featured, actions);
        card.append(image, details);
        list.appendChild(card);
    });
}

// ==========================================
// OUVRIR LA MODIFICATION
// ==========================================

function openEdit(productId) {
    selectedProduct = currentProducts.find(p => p.id === productId);

    if (!selectedProduct) return;

    document.getElementById("edit-name").value = selectedProduct.name;
    document.getElementById("edit-description").value = selectedProduct.description;
    document.getElementById("edit-price").value = selectedProduct.price;
    document.getElementById("edit-stock").value = selectedProduct.stock;
    document.getElementById("edit-category").value = selectedProduct.category;
    document.getElementById("edit-featured").checked = selectedProduct.featured;
    document.getElementById("edit-image").value = "";
    document.getElementById("edit-message").textContent = "";

    modal.hidden = false;
}

function hideModal() {
    modal.hidden = true;
    selectedProduct = null;
}

closeModal.addEventListener("click", hideModal);

modal.addEventListener("click", event => {
    if (event.target === modal) hideModal();
});

// ==========================================
// ENREGISTRER LES MODIFICATIONS
// ==========================================

editForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedProduct || !currentUser) return;

    const button = document.getElementById("save-edit-button");
    const editMessage = document.getElementById("edit-message");
    const newImage = document.getElementById("edit-image").files[0];

    if (newImage) {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedTypes.includes(newImage.type)) {
            editMessage.textContent = "Format d'image non accepté.";
            return;
        }

        if (newImage.size > 5 * 1024 * 1024) {
            editMessage.textContent = "L'image dépasse 5 Mo.";
            return;
        }
    }

    button.disabled = true;
    button.textContent = "Enregistrement...";

    let uploadedPath = null;

    try {
        const isAdmin = await checkAdmin(currentUser);
        if (!isAdmin) throw new Error("Accès administrateur refusé.");

        const updatedProduct = {
            name: document.getElementById("edit-name").value.trim(),
            description: document.getElementById("edit-description").value.trim(),
            price: Number(document.getElementById("edit-price").value),
            stock: Number(document.getElementById("edit-stock").value),
            category: document.getElementById("edit-category").value,
            featured: document.getElementById("edit-featured").checked
        };

        if (newImage) {
            const extension = newImage.name.split(".").pop().toLowerCase();
            uploadedPath = currentUser.id + "/" +
                crypto.randomUUID() + "." + extension;

            const { error: uploadError } = await supabaseClient.storage
                .from("product-images")
                .upload(uploadedPath, newImage, {
                    contentType: newImage.type,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data: imageData } = supabaseClient.storage
                .from("product-images")
                .getPublicUrl(uploadedPath);

            updatedProduct.image_url = imageData.publicUrl;
        }

        const { error } = await supabaseClient
            .from("products")
            .update(updatedProduct)
            .eq("id", selectedProduct.id);

        if (error) throw error;

        // Supprimer l'ancienne photo seulement après la mise à jour
        if (newImage) {
            const oldPath = storagePathFromUrl(selectedProduct.image_url);

            if (oldPath) {
                const { error: removeError } = await supabaseClient.storage
                    .from("product-images")
                    .remove([oldPath]);

                if (removeError) {
                    console.warn("Ancienne photo non supprimée :", removeError);
                }
            }
        }

        hideModal();
        message.textContent = "Produit modifié avec succès !";
        await loadProducts();

    } catch (error) {
        console.error(error);
        editMessage.textContent = "Erreur : " + error.message;

        // Nettoyer la nouvelle photo si la mise à jour a échoué
        if (uploadedPath) {
            await supabaseClient.storage
                .from("product-images")
                .remove([uploadedPath]);
        }

    } finally {
        button.disabled = false;
        button.textContent = "Enregistrer les modifications";
    }
});

// ==========================================
// SUPPRIMER UN PRODUIT
// ==========================================

async function deleteProduct(productId) {
    const product = currentProducts.find(p => p.id === productId);
    if (!product) return;

    const confirmed = confirm(
        "Supprimer définitivement « " + product.name + " » ?"
    );

    if (!confirmed) return;

    try {
        const isAdmin = await checkAdmin(currentUser);
        if (!isAdmin) throw new Error("Accès administrateur refusé.");

        const { error } = await supabaseClient
            .from("products")
            .delete()
            .eq("id", productId);

        if (error) throw error;

        // Supprimer également la photo du stockage
        const imagePath = storagePathFromUrl(product.image_url);

        if (imagePath) {
            const { error: imageError } = await supabaseClient.storage
                .from("product-images")
                .remove([imagePath]);

            if (imageError) {
                console.warn("Photo non supprimée :", imageError);
                message.textContent =
                    "Produit supprimé, mais sa photo n'a pas pu être supprimée.";
            } else {
                message.textContent = "Produit et photo supprimés.";
            }
        } else {
            message.textContent = "Produit supprimé.";
        }

        await loadProducts();

    } catch (error) {
        console.error(error);
        message.textContent = "Erreur : " + error.message;
    }
}

// ==========================================
// DÉCONNEXION
// ==========================================

logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "admin.html";
});

// ==========================================
// DÉMARRAGE ET SÉCURITÉ
// ==========================================

async function initializeProducts() {
    if (!window.supabase || typeof supabaseClient === "undefined") {
        list.textContent = "Connexion Supabase indisponible.";
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error || !data.session) {
            window.location.href = "admin.html";
            return;
        }

        currentUser = data.session.user;

        const isAdmin = await checkAdmin(currentUser);

        if (!isAdmin) {
            await supabaseClient.auth.signOut();
            window.location.href = "admin.html";
            return;
        }

        await loadProducts();

    } catch (error) {
        console.error(error);
        list.textContent = "Impossible de vérifier les accès administrateur.";
    }
}

initializeProducts();
