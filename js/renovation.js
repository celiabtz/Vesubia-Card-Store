
const visitorId = (() => {
    let id = localStorage.getItem("vesubia_visitor_id");

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("vesubia_visitor_id", id);
    }

    return id;
})();

const feed = document.getElementById("renovation-feed");

async function loadRenovations() {
    const { data: posts, error } = await supabaseClient
        .from("renovation_posts")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        feed.innerHTML = '<div class="feed-empty">Impossible de charger les restaurations.</div>';
        return;
    }

    if (!posts || posts.length === 0) {
        feed.innerHTML = '<div class="feed-empty">Les premières restaurations arrivent bientôt !</div>';
        return;
    }

    feed.innerHTML = "";

    for (const post of posts) {
        const { data: likes, error: likesError } = await supabaseClient
            .from("renovation_likes")
            .select("visitor_id")
            .eq("post_id", post.id);

        if (likesError) console.error(likesError);

        const count = likes?.length || 0;
        const liked = likes?.some(like => like.visitor_id === visitorId);

        const article = document.createElement("article");
        article.className = "renovation-post";

        const date = new Date(post.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });

        article.innerHTML = `
            <div class="renovation-post-header">
                <div class="renovation-avatar" style="display:grid;place-items:center;background:#202024;color:#FFD928;font-weight:bold;">V</div>
                <div>
                    <div class="renovation-author">Vesubia Card Store</div>
                    <div class="renovation-date">${date}</div>
                </div>
            </div>

            <div class="renovation-post-text"></div>

            <div class="renovation-images">
                <div class="renovation-image-box">
                    <img alt="Carte avant restauration" loading="lazy">
                    <span class="renovation-image-label">AVANT</span>
                </div>
                <div class="renovation-image-box">
                    <img alt="Carte après restauration" loading="lazy">
                    <span class="renovation-image-label">APRÈS</span>
                </div>
            </div>

            <div class="renovation-post-footer">
                <button class="renovation-like-button ${liked ? "liked" : ""}">
                    ${liked ? "♥ J'aime" : "♡ J'aime"}
                </button>
                <span class="renovation-like-count">${count} j'aime</span>
            </div>
        `;

        article.querySelector(".renovation-post-text").textContent =
            post.description || "";

        const images = article.querySelectorAll(".renovation-image-box img");
        images[0].src = post.before_image;
        images[1].src = post.after_image;

        const button = article.querySelector(".renovation-like-button");

        button.addEventListener("click", async () => {
            button.disabled = true;

            if (button.classList.contains("liked")) {
                const { error } = await supabaseClient
                    .from("renovation_likes")
                    .delete()
                    .eq("post_id", post.id)
                    .eq("visitor_id", visitorId);

                if (error) {
                    console.error(error);
                    button.disabled = false;
                    return;
                }
            } else {
                const { error } = await supabaseClient
                    .from("renovation_likes")
                    .insert({
                        post_id: post.id,
                        visitor_id: visitorId
                    });

                if (error && error.code !== "23505") {
                    console.error(error);
                    button.disabled = false;
                    return;
                }
            }

    const likedNow = !button.classList.contains("liked");

button.classList.toggle("liked", likedNow);
button.innerHTML = likedNow ? "♥ J'aime" : "♡ J'aime";

const countElement = article.querySelector(".renovation-like-count");
const currentCount = Number(countElement.textContent.match(/\d+/)?.[0] || 0);

countElement.textContent = `${Math.max(0, currentCount + (likedNow ? 1 : -1))} j'aime`;
button.disabled = false;
        });

        feed.appendChild(article);
    }
}

loadRenovations();
