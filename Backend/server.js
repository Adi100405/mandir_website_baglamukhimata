// backend/server.js

import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// 🔐 Use environment variables (IMPORTANT for Render)
const KEY_ID = process.env.KEY_ID;
const KEY_SECRET = process.env.KEY_SECRET;

if (!KEY_ID || !KEY_SECRET) {
  console.error("Missing Razorpay keys ❌");
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET,
});

// ─── Basic Route ─────────────────────────────

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// ─── Create Order ───────────────────────────

app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount required" });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
    });

    res.json(order);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// ─── Verify Payment ─────────────────────────

app.post("/verify-payment", (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;

    const body = order_id + "|" + payment_id;

    const expected = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected === signature) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false });
    }
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// ─── Admin Auth ─────────────────────────────

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Admin Routes ───────────────────────────

app.get("/admin/orders", adminAuth, async (req, res) => {
  try {
    const { count = 50, skip = 0 } = req.query;

    const orders = await razorpay.orders.all({ count, skip });

    const ordersWithPayments = await Promise.all(
      orders.items.map(async (order) => {
        try {
          const payments = await razorpay.orders.fetchPayments(order.id);
          return { ...order, payments: payments.items };
        } catch {
          return { ...order, payments: [] };
        }
      })
    );

    res.json({ ...orders, items: ordersWithPayments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/admin/payments", adminAuth, async (req, res) => {
  try {
    const { count = 50, skip = 0 } = req.query;
    const payments = await razorpay.payments.all({ count, skip });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/admin/stats", adminAuth, async (req, res) => {
  try {
    const [orders, payments] = await Promise.all([
      razorpay.orders.all({ count: 100 }),
      razorpay.payments.all({ count: 100 }),
    ]);

    const totalRevenue = payments.items
      .filter((p) => p.status === "captured")
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      totalOrders: orders.count,
      totalPayments: payments.count,
      capturedPayments: payments.items.filter((p) => p.status === "captured").length,
      failedPayments: payments.items.filter((p) => p.status === "failed").length,
      totalRevenue: totalRevenue / 100,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PORT FIX (CRITICAL FOR RENDER) ─────────

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
