
const cartContainer = document.getElementById("cart-items");
const totalElement = document.getElementById("cart-total");

function getCart() {
    try {
        return JSON.parse(localStorage.getItem("vesubia_cart") || "[]");
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem("vesubia_cart", JSON.stringify(cart));
    renderCart();
}

function renderCart() {
    const cart = getCart();
    cartContainer.replaceChildren();

    if (cart.length === 0) {
        cartContainer.innerHTML = "<p>Votre panier est actuellement vide.</p>";
        totalElement.textContent = "0,00 €";
        return;
    }

    let total = 0;

    cart.forEach((product, index) => {
        total += Number(product.price) || 0;

        const item = document.createElement("div");
        item.className = "cart-item";

        const image = document.createElement("img");
        image.src = product.image_url || "";
        image.alt = product.name;

        const info = document.createElement("div");
        info.className = "cart-item-info";

        const name = document.createElement("h3");
        name.textContent = product.name;

        const price = document.createElement("p");
        price.textContent = (Number(product.price) || 0).toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR"
        });

        const remove = document.createElement("button");
        remove.textContent = "Retirer";
        remove.addEventListener("click", () => {
            const updated = getCart();
            updated.splice(index, 1);
            saveCart(updated);
        });

        info.append(name, price, remove);
        item.append(image, info);
        cartContainer.appendChild(item);
    });

    totalElement.textContent = total.toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR"
    });
}

document.getElementById("clear-cart").addEventListener("click", () => {
    saveCart([]);
});

renderCart();
