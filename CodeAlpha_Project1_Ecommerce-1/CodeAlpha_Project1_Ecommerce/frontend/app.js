const API = "/api";

function getToken() {
  return localStorage.getItem("shop_token");
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem("shop_cart") || "[]");
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("shop_cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("#cartCount").forEach(el => el.textContent = count);
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

async function api(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(API + url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data;
}

function setupNav() {
  const token = getToken();
  document.querySelectorAll("#loginLink").forEach(el => el.classList.toggle("hidden", Boolean(token)));
  document.querySelectorAll("#logoutLink").forEach(el => {
    el.classList.toggle("hidden", !token);
    el.onclick = (event) => {
      event.preventDefault();
      localStorage.removeItem("shop_token");
      localStorage.removeItem("shop_user");
      window.location.href = "index.html";
    };
  });
  updateCartCount();
}

async function loadProducts() {
  const grid = document.querySelector("#productGrid");
  if (!grid) return;

  const search = document.querySelector("#searchInput");
  const category = document.querySelector("#categorySelect");
  const message = document.querySelector("#productMessage");

  async function render() {
    grid.innerHTML = "<p>Loading products...</p>";
    try {
      const query = new URLSearchParams({
        search: search.value.trim(),
        category: category.value
      });
      const products = await api(`/products?${query.toString()}`);

      if (!products.length) {
        grid.innerHTML = "";
        message.textContent = "No products found.";
        return;
      }

      message.textContent = "";
      grid.innerHTML = products.map(product => `
        <article class="product-card">
          <a href="product.html?id=${product.id}">
            <img src="${product.image_url}" alt="${escapeHtml(product.name)}" loading="lazy">
          </a>
          <div class="product-content">
            <small>${escapeHtml(product.category)}</small>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description)}</p>
            <div class="price">${money(product.price)}</div>
            <div class="stock">${product.stock > 0 ? `${product.stock} available` : "Out of stock"}</div>
            <br>
            <button class="btn primary" ${product.stock === 0 ? "disabled" : ""} onclick="addToCart(${product.id}, event)">
              Add to cart
            </button>
          </div>
        </article>
      `).join("");
    } catch (error) {
      grid.innerHTML = "";
      message.textContent = error.message;
      message.className = "message error";
    }
  }

  search.addEventListener("input", render);
  category.addEventListener("change", render);
  render();
}

async function loadProductDetail() {
  const root = document.querySelector("#productDetail");
  if (!root) return;

  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    root.innerHTML = "<p class='message error'>Product ID is missing.</p>";
    return;
  }

  try {
    const product = await api(`/products/${encodeURIComponent(id)}`);
    root.innerHTML = `
      <div class="product-detail">
        <img src="${product.image_url}" alt="${escapeHtml(product.name)}">
        <div>
          <p class="eyebrow">${escapeHtml(product.category)}</p>
          <h1>${escapeHtml(product.name)}</h1>
          <p>${escapeHtml(product.description)}</p>
          <div class="price">${money(product.price)}</div>
          <p class="stock">${product.stock} item(s) available</p>
          <button class="btn primary" ${product.stock === 0 ? "disabled" : ""} onclick="addToCart(${product.id})">
            Add to cart
          </button>
        </div>
      </div>
    `;
  } catch (error) {
    root.innerHTML = `<p class="message error">${escapeHtml(error.message)}</p>`;
  }
}

async function addToCart(productId, event) {
  if (event) event.preventDefault();

  try {
    const product = await api(`/products/${productId}`);
    if (product.stock < 1) throw new Error("This product is out of stock.");

    const cart = getCart();
    const existing = cart.find(item => item.productId === product.id);

    if (existing) {
      if (existing.quantity >= product.stock) {
        throw new Error("You cannot add more than the available stock.");
      }
      existing.quantity += 1;
    } else {
      cart.push({ productId: product.id, quantity: 1, product });
    }

    saveCart(cart);
    alert("Product added to cart.");
  } catch (error) {
    alert(error.message);
  }
}

function renderCart() {
  const root = document.querySelector("#cartPage");
  if (!root) return;

  const cart = getCart();
  if (!cart.length) {
    root.innerHTML = `<div class="order-card"><p>Your cart is empty.</p><a class="btn primary" href="index.html">Continue shopping</a></div>`;
    document.querySelector("#checkoutSection")?.classList.add("hidden");
    return;
  }

  let total = 0;
  root.innerHTML = `<div class="cart-list">${cart.map(item => {
    const line = item.product.price * item.quantity;
    total += line;
    return `
      <div class="cart-item">
        <img src="${item.product.image_url}" alt="${escapeHtml(item.product.name)}">
        <div>
          <strong>${escapeHtml(item.product.name)}</strong>
          <div class="price">${money(item.product.price)}</div>
        </div>
        <div class="qty">
          <button onclick="changeQuantity(${item.productId}, -1)">−</button>
          <strong>${item.quantity}</strong>
          <button onclick="changeQuantity(${item.productId}, 1)">+</button>
        </div>
        <button class="btn danger" onclick="removeFromCart(${item.productId})">Remove</button>
      </div>
    `;
  }).join("")}</div>
  <div class="cart-total">Total: ${money(total)}</div>
  <div style="text-align:right"><button class="btn secondary" onclick="clearCart()">Clear cart</button></div>`;

  document.querySelector("#checkoutSection")?.classList.remove("hidden");
}

async function changeQuantity(productId, delta) {
  const cart = getCart();
  const item = cart.find(x => x.productId === productId);
  if (!item) return;

  try {
    const product = await api(`/products/${productId}`);
    const next = item.quantity + delta;
    if (next < 1) {
      removeFromCart(productId);
      return;
    }
    if (next > product.stock) {
      alert(`Only ${product.stock} item(s) are currently available.`);
      return;
    }
    item.quantity = next;
    item.product = product;
    saveCart(cart);
    renderCart();
  } catch (error) {
    alert(error.message);
  }
}

function removeFromCart(productId) {
  saveCart(getCart().filter(item => item.productId !== productId));
  renderCart();
}

function clearCart() {
  saveCart([]);
  renderCart();
}

async function checkout(event) {
  event.preventDefault();

  if (!getToken()) {
    window.location.href = "login.html?next=cart.html";
    return;
  }

  const form = event.currentTarget;
  const message = document.querySelector("#checkoutMessage");
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const result = await api("/orders", {
      method: "POST",
      body: JSON.stringify({
        items: getCart().map(item => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        shipping: data
      })
    });

    saveCart([]);
    message.textContent = `Order #${result.orderId} placed successfully. Total: ${money(result.total)}`;
    message.className = "message success";
    form.reset();

    setTimeout(() => {
      window.location.href = "orders.html";
    }, 1000);
  } catch (error) {
    message.textContent = error.message;
    message.className = "message error";
  }
}

async function loadOrders() {
  const root = document.querySelector("#ordersPage");
  if (!root) return;

  if (!getToken()) {
    root.innerHTML = `<div class="order-card"><p>Please log in to view your orders.</p><a class="btn primary" href="login.html">Login</a></div>`;
    return;
  }

  try {
    const orders = await api("/orders");

    if (!orders.length) {
      root.innerHTML = `<div class="order-card"><p>No orders yet. Start shopping to create your first order.</p><a class="btn primary" href="index.html">Shop now</a></div>`;
      return;
    }

    root.innerHTML = orders.map(order => `
      <article class="order-card">
        <div class="order-header">
          <div>
            <strong>Order #${order.id}</strong>
            <div class="message">${new Date(order.created_at + "Z").toLocaleString()}</div>
          </div>
          <div>
            <strong>${money(order.total)}</strong>
            <div>${escapeHtml(order.status)}</div>
          </div>
        </div>
        <div class="order-items">
          ${order.items.map(item => `
            <div class="order-item">
              <span>${escapeHtml(item.name)} × ${item.quantity}</span>
              <span>${money(item.price * item.quantity)}</span>
            </div>
          `).join("")}
        </div>
        <p class="message">Deliver to: ${escapeHtml(order.shipping_name)}, ${escapeHtml(order.shipping_address)}, ${escapeHtml(order.shipping_city)}, ${escapeHtml(order.shipping_state)} - ${escapeHtml(order.shipping_pincode)}</p>
      </article>
    `).join("");
  } catch (error) {
    root.innerHTML = `<p class="message error">${escapeHtml(error.message)}</p>`;
  }
}

async function handleAuth(form, mode) {
  const message = form.querySelector("#authMessage");
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
    const result = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(data)
    });

    localStorage.setItem("shop_token", result.token);
    localStorage.setItem("shop_user", JSON.stringify(result.user));
    window.location.href = "index.html";
  } catch (error) {
    message.textContent = error.message;
    message.className = "message error";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  loadProducts();
  loadProductDetail();
  renderCart();
  loadOrders();

  const checkoutForm = document.querySelector("#checkoutForm");
  if (checkoutForm) checkoutForm.addEventListener("submit", checkout);

  const loginForm = document.querySelector("#loginForm");
  if (loginForm) loginForm.addEventListener("submit", event => {
    event.preventDefault();
    handleAuth(loginForm, "login");
  });

  const registerForm = document.querySelector("#registerForm");
  if (registerForm) registerForm.addEventListener("submit", event => {
    event.preventDefault();
    handleAuth(registerForm, "register");
  });
});
