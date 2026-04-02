import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const KEY_ID = "rzp_test_SYDCdIP7c7u4Vt";
const KEY_SECRET = "ZSPDWTDCJtwRlPn9uBvFJVQr";

const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET,
});

// ─── Existing Routes ───────────────────────────────────────────────

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
    });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/verify-payment", (req, res) => {
  const { order_id, payment_id, signature } = req.body;

  const body = order_id + "|" + payment_id;

  // ✅ Fixed: was using string "key_secret" instead of actual secret
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expected === signature) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

// ─── Admin Routes ──────────────────────────────────────────────────

// Simple admin auth middleware (change this password!)
const ADMIN_PASSWORD = "admin123";

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// GET /admin/orders — fetch all orders with their payments
app.get("/admin/orders", adminAuth, async (req, res) => {
  try {
    const { count = 50, skip = 0 } = req.query;
    const orders = await razorpay.orders.all({ count, skip });

    // Fetch payment details for each order
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

// GET /admin/payments — fetch all payments
app.get("/admin/payments", adminAuth, async (req, res) => {
  try {
    const { count = 50, skip = 0 } = req.query;
    const payments = await razorpay.payments.all({ count, skip });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/stats — summary stats
app.get("/admin/stats", adminAuth, async (req, res) => {
  try {
    const [orders, payments] = await Promise.all([
      razorpay.orders.all({ count: 100 }),
      razorpay.payments.all({ count: 100 }),
    ]);

    const totalRevenue = payments.items
      .filter((p) => p.status === "captured")
      .reduce((sum, p) => sum + p.amount, 0);

    const stats = {
      totalOrders: orders.count,
      totalPayments: payments.count,
      capturedPayments: payments.items.filter((p) => p.status === "captured").length,
      failedPayments: payments.items.filter((p) => p.status === "failed").length,
      totalRevenue: totalRevenue / 100, // Convert from paise to INR
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));
