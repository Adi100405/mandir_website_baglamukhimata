import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMB_USER_TOKEN = process.env.IMB_USER_TOKEN;
const IMB_API_URL = (process.env.IMB_API_URL || "https://secure-stage.imb.org.in/api").replace(/\/+$/, "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const FRONTEND_URL = (process.env.FRONTEND_URL || "https://your-frontend-domain.com").replace(/\/+$/, "");
const PORT = process.env.PORT || 5000;

if (!IMB_USER_TOKEN || !ADMIN_PASSWORD) {
  console.error("Missing required environment variables: IMB_USER_TOKEN or ADMIN_PASSWORD");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "payments.json");

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ items: [] }, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStorage();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw || '{"items":[]}');
  if (!parsed.items || !Array.isArray(parsed.items)) {
    return { items: [] };
  }
  return parsed;
}

async function writeStore(data) {
  await ensureStorage();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function generateOrderId(prefix = "ORD") {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${stamp}${rand}`;
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}

function isPaidStatus(value) {
  const v = String(value || "").toLowerCase().trim();
  return ["success", "successful", "completed", "complete", "paid", "captured", "approved"].includes(v);
}

function isFailedStatus(value) {
  const v = String(value || "").toLowerCase().trim();
  return ["failed", "failure", "error", "cancelled", "canceled", "expired", "declined"].includes(v);
}

function extractStatus(payload) {
  return (
    payload?.status ||
    payload?.payment_status ||
    payload?.txn_status ||
    payload?.result?.status ||
    payload?.data?.status ||
    ""
  );
}

function extractPaymentId(payload) {
  return (
    payload?.utr ||
    payload?.txn_id ||
    payload?.transaction_id ||
    payload?.payment_id ||
    payload?.result?.utr ||
    payload?.result?.txn_id ||
    payload?.result?.transaction_id ||
    payload?.data?.utr ||
    payload?.data?.txn_id ||
    payload?.data?.transaction_id ||
    ""
  );
}

function extractPaymentUrl(payload) {
  return (
    payload?.result?.payment_url ||
    payload?.result?.payment_link ||
    payload?.payment_url ||
    payload?.payment_link ||
    payload?.url ||
    ""
  );
}

function extractMessage(payload) {
  return payload?.message || payload?.msg || payload?.error || "Request failed";
}

async function updateOrder(orderId, updater) {
  const store = await readStore();
  const idx = store.items.findIndex((item) => item.orderId === orderId);
  if (idx === -1) return null;

  const current = store.items[idx];
  const updated = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  store.items[idx] = { ...updated, updatedAt: Math.floor(Date.now() / 1000) };
  await writeStore(store);
  return store.items[idx];
}

async function createOrderInStore(data) {
  const store = await readStore();
  store.items.push(data);
  await writeStore(store);
  return data;
}

async function imbCreateOrder(payload) {
  const body = new URLSearchParams(payload).toString();

  console.log("IMB create-order request payload:", payload);
  console.log("IMB create-order request URL:", `${IMB_API_URL}/create-order`);

  const response = await fetch(`${IMB_API_URL}/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body,
  });

  const text = await response.text();
  console.log("IMB raw response status:", response.status);
  console.log("IMB raw response text:", text);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`IMB HTTP ${response.status}: ${text}`);
  }

  return data;
}

async function imbCheckStatus(orderId) {
  const body = new URLSearchParams({
    user_token: IMB_USER_TOKEN,
    order_id: orderId,
  }).toString();

  const response = await fetch(`${IMB_API_URL}/check-order-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(extractMessage(data));
  }

  return data;
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    gateway: "IMB",
    message: "Backend is running",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/create-order", async (req, res) => {
  try {
    const {
      amount,
      purpose = "booking",
      name = "",
      phone = "",
      email = "",
      service = "",
      pandit = "",
      date = "",
      time = "",
      location = "",
      address = "",
      note = "",
      redirect_url = "",
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    if (!["booking", "donation"].includes(purpose)) {
      return res.status(400).json({ error: "Invalid purpose" });
    }

    const cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: "Valid phone number is required" });
    }

    if (purpose === "booking" && (!name || !service || !location)) {
      return res.status(400).json({ error: "Missing booking details" });
    }

    if (purpose === "donation" && !name) {
      return res.status(400).json({ error: "Missing donor details" });
    }

    const orderId = generateOrderId(purpose === "booking" ? "BKM" : "DON");
    const finalRedirectUrl =
      safeText(redirect_url) || `${FRONTEND_URL}/booking-success.html?order_id=${encodeURIComponent(orderId)}&purpose=${encodeURIComponent(purpose)}`;

    const localOrder = {
      orderId,
      purpose,
      name: safeText(name),
      phone: cleanPhone.slice(-10),
      email: safeText(email),
      service: safeText(service),
      pandit: safeText(pandit),
      date: safeText(date),
      time: safeText(time),
      location: safeText(location),
      address: safeText(address),
      note: safeText(note),
      amount: Number(amount),
      paymentStatus: "pending",
      paymentId: "",
      gatewayOrderResponse: null,
      gatewayStatusResponse: null,
      paymentUrl: "",
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };

    await createOrderInStore(localOrder);

    const imbResponse = await imbCreateOrder({
      customer_mobile: localOrder.phone,
      user_token: IMB_USER_TOKEN,
      amount: String(localOrder.amount),
      order_id: orderId,
      redirect_url: finalRedirectUrl,
      remark1: localOrder.email || localOrder.name || purpose,
      remark2: `${purpose}|${localOrder.service}|${localOrder.pandit}|${localOrder.date}|${localOrder.time}`,
    });

    const paymentUrl = extractPaymentUrl(imbResponse);

    if (!paymentUrl) {
      console.error("IMB create-order response missing payment URL:", imbResponse);
      return res.status(500).json({ error: "Payment URL not received from gateway" });
    }

    await updateOrder(orderId, (order) => ({
      ...order,
      gatewayOrderResponse: imbResponse,
      paymentUrl,
    }));

    return res.json({
      success: true,
      orderId,
      paymentUrl,
      paytmLink: imbResponse?.result?.paytm_link || "",
      bhimLink: imbResponse?.result?.bhim_link || "",
    });
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ error: err.message || "Order creation failed" });
  }
});

app.post("/verify-payment", async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, error: "order_id is required" });
    }

    const imbResponse = await imbCheckStatus(order_id);
    const status = extractStatus(imbResponse);
    const paymentId = extractPaymentId(imbResponse);

    let paymentStatus = "pending";
    if (isPaidStatus(status)) paymentStatus = "paid";
    else if (isFailedStatus(status)) paymentStatus = "failed";

    await updateOrder(order_id, (order) => ({
      ...order,
      paymentStatus,
      paymentId: paymentId || order.paymentId,
      gatewayStatusResponse: imbResponse,
    }));

    return res.json({
      success: paymentStatus === "paid",
      paymentStatus,
      paymentId,
      raw: imbResponse,
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    return res.status(500).json({ success: false, error: err.message || "Verification failed" });
  }
});

app.post("/payment-webhook", async (req, res) => {
  try {
    const payload = req.body || {};
    const orderId =
      payload?.order_id ||
      payload?.orderId ||
      payload?.result?.order_id ||
      payload?.result?.orderId ||
      payload?.data?.order_id ||
      payload?.data?.orderId;

    const status = extractStatus(payload);
    const paymentId = extractPaymentId(payload);

    console.log("IMB webhook received:", payload);

    if (orderId) {
      let paymentStatus = "pending";
      if (isPaidStatus(status)) paymentStatus = "paid";
      else if (isFailedStatus(status)) paymentStatus = "failed";

      await updateOrder(orderId, (order) => ({
        ...order,
        paymentStatus,
        paymentId: paymentId || order.paymentId,
        webhookPayload: payload,
      }));
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).json({ success: true });
  }
});

app.get("/check-payment-status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const imbResponse = await imbCheckStatus(orderId);
    const status = extractStatus(imbResponse);
    const paymentId = extractPaymentId(imbResponse);

    let paymentStatus = "pending";
    if (isPaidStatus(status)) paymentStatus = "paid";
    else if (isFailedStatus(status)) paymentStatus = "failed";

    await updateOrder(orderId, (order) => ({
      ...order,
      paymentStatus,
      paymentId: paymentId || order.paymentId,
      gatewayStatusResponse: imbResponse,
    }));

    return res.json({
      orderId,
      paymentStatus,
      paymentId,
      raw: imbResponse,
    });
  } catch (err) {
    console.error("Check status error:", err);
    return res.status(500).json({ error: err.message || "Status check failed" });
  }
});

app.get("/admin/bookings", adminAuth, async (_req, res) => {
  try {
    const store = await readStore();
    const items = store.items
      .filter((o) => o.purpose === "booking")
      .map((o) => ({
        id: o.orderId,
        name: o.name || "—",
        phone: o.phone || "—",
        service: o.service || "—",
        pandit: o.pandit || "—",
        location: o.location || "—",
        amount: Math.round(Number(o.amount || 0) * 100),
        paymentStatus: o.paymentStatus || "pending",
        createdAt: o.createdAt || 0,
      }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.json({ items });
  } catch (err) {
    console.error("Admin bookings error:", err);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

app.get("/admin/donations", adminAuth, async (_req, res) => {
  try {
    const store = await readStore();
    const items = store.items
      .filter((o) => o.purpose === "donation" && o.paymentStatus === "paid")
      .map((o) => ({
        id: o.orderId,
        name: o.name || "—",
        phone: o.phone || "—",
        amount: Math.round(Number(o.amount || 0) * 100),
        paymentStatus: "captured",
        createdAt: o.createdAt || 0,
      }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.json({ items });
  } catch (err) {
    console.error("Admin donations error:", err);
    return res.status(500).json({ error: "Failed to fetch donations" });
  }
});

app.get("/admin/dashboard-summary", adminAuth, async (_req, res) => {
  try {
    const store = await readStore();
    const all = store.items || [];

    const bookings = all.filter((o) => o.purpose === "booking");
    const donations = all.filter((o) => o.purpose === "donation");

    const paidBookings = bookings.filter((o) => o.paymentStatus === "paid").length;
    const failedBookings = bookings.filter((o) => o.paymentStatus === "failed").length;
    const successfulDonations = donations.filter((o) => o.paymentStatus === "paid");
    const totalDonationAmount = successfulDonations.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    return res.json({
      totalBookings: bookings.length,
      paidBookings,
      failedBookings,
      totalDonations: successfulDonations.length,
      totalDonationAmount,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    return res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

ensureStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize storage:", err);
    process.exit(1);
  });
