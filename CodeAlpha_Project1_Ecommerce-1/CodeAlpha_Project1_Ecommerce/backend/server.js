require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const db = require("./db");
const { requireAuth } = require("./middleware/auth");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_only_change_this_secret";

app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateString(value, field, maxLength = 200) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required.`);
  if (text.length > maxLength) throw new Error(`${field} is too long.`);
  return text;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "CodeAlpha E-commerce API" });
});

app.get("/api/products", (req, res) => {
  const search = String(req.query.search || "").trim();
  const category = String(req.query.category || "").trim();

  let sql = "SELECT * FROM products WHERE 1=1";
  const params = {};

  if (search) {
    sql += " AND (name LIKE @search OR description LIKE @search)";
    params.search = `%${search}%`;
  }

  if (category && category !== "All") {
    sql += " AND category = @category";
    params.category = category;
  }

  sql += " ORDER BY id DESC";

  const products = db.prepare(sql).all(params);
  res.json(products);
});

app.get("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid product ID." });
  }

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);

  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  res.json(product);
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = validateString(req.body.name, "Name", 80);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must contain at least 6 characters." });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db
      .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
      .run(name, email, passwordHash);

    const user = { id: result.lastInsertRowid, name, email };
    const token = createToken(user);

    res.status(201).json({ message: "Registration successful.", token, user });
  } catch (error) {
    res.status(400).json({ message: error.message || "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const safeUser = { id: user.id, name: user.name, email: user.email };
    const token = createToken(safeUser);

    res.json({ message: "Login successful.", token, user: safeUser });
  } catch {
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, name, email, created_at FROM users WHERE id = ?")
    .get(req.user.id);

  if (!user) return res.status(404).json({ message: "User not found." });
  res.json(user);
});

app.post("/api/orders", requireAuth, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const shipping = req.body.shipping || {};

  if (items.length === 0) {
    return res.status(400).json({ message: "Your cart is empty." });
  }

  try {
    const shippingName = validateString(shipping.name, "Full name", 80);
    const address = validateString(shipping.address, "Address", 200);
    const city = validateString(shipping.city, "City", 80);
    const state = validateString(shipping.state, "State", 80);
    const pincode = validateString(shipping.pincode, "Pincode", 10);

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ message: "Pincode must be exactly 6 digits." });
    }

    const getProduct = db.prepare("SELECT * FROM products WHERE id = ?");
    const checkedItems = [];
    let total = 0;

    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return res.status(400).json({ message: "Invalid cart item." });
      }

      const product = getProduct.get(productId);
      if (!product) {
        return res.status(400).json({ message: `Product ${productId} no longer exists.` });
      }
      if (quantity > product.stock) {
        return res.status(400).json({ message: `Only ${product.stock} unit(s) of ${product.name} are available.` });
      }

      const lineTotal = product.price * quantity;
      total += lineTotal;
      checkedItems.push({ product, quantity });
    }

    const createOrder = db.transaction(() => {
      const orderResult = db.prepare(`
        INSERT INTO orders
        (user_id, total, status, shipping_name, shipping_address, shipping_city, shipping_state, shipping_pincode)
        VALUES (?, ?, 'Processing', ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        total,
        shippingName,
        address,
        city,
        state,
        pincode
      );

      const orderId = Number(orderResult.lastInsertRowid);
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
      `);
      const reduceStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");

      for (const item of checkedItems) {
        insertItem.run(orderId, item.product.id, item.quantity, item.product.price);
        reduceStock.run(item.quantity, item.product.id);
      }

      return orderId;
    });

    const orderId = createOrder();
    res.status(201).json({
      message: "Order placed successfully.",
      orderId,
      total: Number(total.toFixed(2))
    });
  } catch (error) {
    res.status(400).json({ message: error.message || "Could not place order." });
  }
});

app.get("/api/orders", requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT
      id,
      total,
      status,
      shipping_name,
      shipping_address,
      shipping_city,
      shipping_state,
      shipping_pincode,
      created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY id DESC
  `).all(req.user.id);

  const getItems = db.prepare(`
    SELECT oi.quantity, oi.price, p.name, p.image_url
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `);

  res.json(
    orders.map(order => ({
      ...order,
      items: getItems.all(order.id)
    }))
  );
});

app.get("/api/orders/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid order ID." });
  }

  const order = db.prepare(`
    SELECT * FROM orders WHERE id = ? AND user_id = ?
  `).get(id, req.user.id);

  if (!order) return res.status(404).json({ message: "Order not found." });

  const items = db.prepare(`
    SELECT oi.quantity, oi.price, p.name, p.image_url
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(id);

  res.json({ ...order, items });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error." });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log(`CodeAlpha E-commerce Store running at http://localhost:${PORT}`);
});
