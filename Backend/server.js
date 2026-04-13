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

app.get("/", (_req, res) => {
  res.send("Backend is running 🚀");
});

app.post("/create-order", async (req, res) => {
  try {
    const {
      amount,
      purpose = "booking",
      name = "",
      phone = "",
      service = "",
      pandit = "",
      date = "",
      location = "",
      address = "",
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    if (!["booking", "donation"].includes(purpose)) {
      return res.status(400).json({ error: "Invalid purpose" });
    }

    if (purpose === "booking" && (!name || !phone || !service || !location)) {
      return res.status(400).json({ error: "Missing booking details" });
    }

    if (purpose === "donation" && (!name || !phone)) {
      return res.status(400).json({ error: "Missing donor details" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      notes: {
        purpose,
        name,
        phone,
        service,
        pandit,
        date,
        location,
        address,
      },
    });

    res.json({
      ...order,
      key: KEY_ID,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

app.post("/verify-payment", (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;

    if (!order_id || !payment_id || !signature) {
      return res
        .status(400)
        .json({ success: false, error: "Missing payment verification fields" });
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

function latestPayment(payments) {
  if (!payments?.length) return null;
  return [...payments].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
}

function bookingPaymentStatus(payment) {
  if (!payment) return "failed";
  if (payment.status === "captured") return "paid";
  return "failed";
}

async function fetchOrderWithPayments(order) {
  try {
    const payments = await razorpay.orders.fetchPayments(order.id);
    return { ...order, payments: payments.items || [] };
  } catch {
    return { ...order, payments: [] };
  }
}

async function fetchAllRelevantOrders(limit = 100) {
  const orders = await razorpay.orders.all({ count: limit });
  return Promise.all((orders.items || []).map(fetchOrderWithPayments));
}

app.get("/admin/bookings", adminAuth, async (_req, res) => {
  try {
    const orders = await fetchAllRelevantOrders(100);

    const items = orders
      .filter((order) => order.notes?.purpose === "booking")
      .map((order) => {
        const payment = latestPayment(order.payments);
        return {
          id: order.id,
          name: order.notes?.name || "—",
          phone: order.notes?.phone || "—",
          service: order.notes?.service || "—",
          pandit: order.notes?.pandit || "—",
          location: order.notes?.location || "—",
          amount: order.amount,
          paymentStatus: bookingPaymentStatus(payment),
          createdAt: order.created_at,
        };
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    res.json({ items });
  } catch (err) {
    console.error("Admin bookings error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

app.get("/admin/donations", adminAuth, async (_req, res) => {
  try {
    const orders = await fetchAllRelevantOrders(100);

    const items = orders
      .filter((order) => order.notes?.purpose === "donation")
      .map((order) => {
        const payment = latestPayment(order.payments);
        return {
          id: order.id,
          name: order.notes?.name || "—",
          phone: order.notes?.phone || payment?.contact || "—",
          amount: order.amount,
          paymentStatus: payment?.status || "failed",
          createdAt: order.created_at,
        };
      })
      .filter((item) => item.paymentStatus === "captured")
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    res.json({ items });
  } catch (err) {
    console.error("Admin donations error:", err);
    res.status(500).json({ error: "Failed to fetch donations" });
  }
});

app.get("/admin/dashboard-summary", adminAuth, async (_req, res) => {
  try {
    const orders = await fetchAllRelevantOrders(100);

    const bookings = orders
      .filter((order) => order.notes?.purpose === "booking")
      .map((order) => {
        const payment = latestPayment(order.payments);
        return bookingPaymentStatus(payment);
      });

    const donations = orders
      .filter((order) => order.notes?.purpose === "donation")
      .map((order) => {
        const payment = latestPayment(order.payments);
        return {
          amount: order.amount,
          successful: payment?.status === "captured",
        };
      });

    const paidBookings = bookings.filter((s) => s === "paid").length;
    const failedBookings = bookings.filter((s) => s === "failed").length;
    const successfulDonations = donations.filter((d) => d.successful);
    const totalDonationAmount =
      successfulDonations.reduce((sum, d) => sum + d.amount, 0) / 100;

    res.json({
      totalBookings: bookings.length,
      paidBookings,
      failedBookings,
      totalDonations: successfulDonations.length,
      totalDonationAmount,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
