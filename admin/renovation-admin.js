
const renovationAdmin = {
    login: document.getElementById("renovation-login"),
    manager: document.getElementById("renovation-manager"),
    message: document.getElementById("renovation-admin-message"),
    posts: document.getElementById("renovation-admin-posts")
};

const bucketName = "renovation-images";

async function checkRenovationAdmin() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        renovationAdmin.login.hidden = false;
        renovationAdmin.manager.hidden = true;
        return;
    }

    const { data: admin, error } = await supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (error || !admin) {
        await supabaseClient.auth.signOut();
        renovationAdmin.login.hidden = false;
        renovationAdmin.manager.hidden = true;
        renovationAdmin.message.textContent = "Accès réservé à l'administration.";
        return;
    }

    renovationAdmin.login.hidden = true;
    renovationAdmin.manager.hidden = false;
    loadAdminRenovations();
}

document.getElementById("renovation-login-button").addEventListener("click", async () => {
    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert("Connexion impossible : " + error.message);
        return;
    }

    checkRenovationAdmin();
});

document.getElementById("renovation-logout-button").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

async function uploadRenovationImage(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    const path = `${crypto.randomUUID()}.${extension}`;

    const { error } = await supabaseClient.storage
        .from(bucketName)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) throw error;

    const { data } = supabaseClient.storage
        .from(bucketName)
        .getPublicUrl(path);

    return data.publicUrl;
}

document.getElementById("renovation-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = document.getElementById("renovation-publish-button");
    const beforeFile = document.getElementById("renovation-before").files[0];
    const afterFile = document.getElementById("renovation-after").files[0];
    const description = document.getElementById("renovation-description").value.trim();

    if (!beforeFile || !afterFile) {
        renovationAdmin.message.textContent = "Ajoute les deux photos avant et après.";
        return;
    }

    button.disabled = true;
    button.textContent = "Publication en cours...";
    renovationAdmin.message.textContent = "";

    let beforeUrl;
    let afterUrl;

    try {
        beforeUrl = await uploadRenovationImage(beforeFile);
        afterUrl = await uploadRenovationImage(afterFile);

        const { error } = await supabaseClient
            .from("renovation_posts")
            .insert({
                description,
                before_image: beforeUrl,
                after_image: afterUrl
            });

        if (error) throw error;

        renovationAdmin.message.textContent = "Publication mise en ligne !";
        event.target.reset();
        loadAdminRenovations();

    } catch (error) {
        console.error(error);
        renovationAdmin.message.textContent = "Erreur : " + error.message;
    } finally {
        button.disabled = false;
        button.textContent = "Publier sur le fil d'actualité";
    }
});

async function loadAdminRenovations() {
    const { data: posts, error } = await supabaseClient
        .from("renovation_posts")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        renovationAdmin.posts.textContent = "Erreur de chargement.";
        console.error(error);
        return;
    }

    renovationAdmin.posts.innerHTML = "";

    if (!posts.length) {
        renovationAdmin.posts.textContent = "Aucune publication pour le moment.";
        return;
    }

    posts.forEach(post => {
        const item = document.createElement("div");
        item.className = "admin-post";

        const description = document.createElement("p");
        description.textContent = post.description || "Sans description";

        const before = document.createElement("img");
        before.src = post.before_image;
        before.alt = "Avant";

        const after = document.createElement("img");
        after.src = post.after_image;
        after.alt = "Après";

        const remove = document.createElement("button");
        remove.className = "delete-post";
        remove.textContent = "Supprimer";
        remove.addEventListener("click", () => deleteRenovation(post.id));

        item.append(description, before, after, document.createElement("br"), remove);
        renovationAdmin.posts.appendChild(item);
    });
}

async function deleteRenovation(id) {
    if (!confirm("Supprimer définitivement cette publication ?")) return;

    const { error } = await supabaseClient
        .from("renovation_posts")
        .delete()
        .eq("id", id);

    if (error) {
        alert("Erreur : " + error.message);
        return;
    }

    loadAdminRenovations();
}

checkRenovationAdmin();
