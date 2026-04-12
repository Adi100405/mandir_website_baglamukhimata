import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());

const KEY_ID = process.env.KEY_ID;
const KEY_SECRET = process.env.KEY_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PORT = process.env.PORT || 5000;

if (!KEY_ID || !KEY_SECRET || !ADMIN_PASSWORD) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET,
});

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
    });

    res.json(order);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

app.post("/verify-payment", (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({ success: false, error: "Missing payment verification fields" });
    }

    const body = `${order_id}|${payment_id}`;

    const expected = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected === signature) {
      return res.json({ success: true });
    }

    return res.status(400).json({ success: false });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

app.get("/admin/orders", adminAuth, async (req, res) => {
  try {
    const count = Number(req.query.count) || 50;
    const skip = Number(req.query.skip) || 0;

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
    console.error("Admin orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.get("/admin/payments", adminAuth, async (req, res) => {
  try {
    const count = Number(req.query.count) || 50;
    const skip = Number(req.query.skip) || 0;

    const payments = await razorpay.payments.all({ count, skip });
    res.json(payments);
  } catch (err) {
    console.error("Admin payments error:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

app.get("/admin/stats", adminAuth, async (req, res) => {
  try {
    const [orders, payments] = await Promise.all([
      razorpay.orders.all({ count: 100 }),
      razorpay.payments.all({ count: 100 }),
    ]);

    const capturedPayments = payments.items.filter((p) => p.status === "captured");
    const failedPayments = payments.items.filter((p) => p.status === "failed");

    const totalRevenue = capturedPayments.reduce((sum, p) => sum + p.amount, 0) / 100;

    res.json({
      totalOrders: orders.count,
      totalPayments: payments.count,
      capturedPayments: capturedPayments.length,
      failedPayments: failedPayments.length,
      totalRevenue,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

let bookings = [];

app.post("/book", (req, res) => {
  try {
    const { name, phone, service, pandit, date, location, address, price } = req.body;

    if (!name || !phone || !service || !date) {
      return res.status(400).json({ error: "Missing required booking fields" });
    }

    const booking = {
      id: Date.now(),
      name,
      phone,
      service,
      pandit: pandit || "",
      date,
      location: location || "",
      address: address || "",
      price: price || "",
      createdAt: new Date().toISOString(),
    };

    bookings.push(booking);

    res.json({ success: true, booking });
  } catch (err) {
    console.error("Book error:", err);
    res.status(500).json({ error: "Booking failed" });
  }
});

app.get("/admin/bookings", adminAuth, (req, res) => {
  res.json({ items: bookings });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
