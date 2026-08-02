import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import crypto from "crypto";
import bookingConfig from "../booking-config.json" with { type: "json" };

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(cors());

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const PORT = process.env.PORT || 5000;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const razorpay =
  RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
    : null;

if (!MONGODB_URI) {
  console.error("Missing required environment variable: MONGODB_URI");
  process.exit(1);
}

function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}

function sanitizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function generateBookingId() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `BKM-${stamp}-${rand}`;
}

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    purpose: { type: String, default: "booking" },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    preferredWhatsapp: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true },
    service: { type: String, required: true },
    gotra: { type: String, default: "" },
    pandit: { type: String, default: "" },
    date: { type: String, default: "" },
    time: { type: String, default: "" },
    location: { type: String, required: true },
    address: { type: String, default: "" },
    participants: { type: Number, default: 1 },
    note: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    paymentStatus: { type: String, default: "cash pending" },
    razorpay: {
      orderId: { type: String, default: "" },
      paymentId: { type: String, default: "" },
      signature: { type: String, default: "" }
    },
    bookingStatus: { type: String, default: "submitted" },
    createdAtUnix: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    updatedAtUnix: { type: Number, default: () => Math.floor(Date.now() / 1000) }
  },
  { timestamps: true }
);

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

const { travelCharges = {}, servicePrices = {}, serviceLocationRules = {} } = bookingConfig;
const TRAVEL_CHARGES = travelCharges;
const SERVICE_PRICES = servicePrices;
const SERVICE_LOCATION_RULES = serviceLocationRules;
const BOOKING_FILTER = { purpose: "booking" };

function getAllowedLocationsForService(service) {
  return SERVICE_LOCATION_RULES[service] || ["At the Temple", "At My Home", "Other Location"];
}

function getParticipantCount(value) {
  const count = Math.floor(Number(value || 1));
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function resolveBookingPricing({ service = "", location = "", participants = 1 }) {
  const normalizedService = safeText(service);
  if (!normalizedService || !Object.prototype.hasOwnProperty.call(SERVICE_PRICES, normalizedService)) {
    return { error: "Please select a valid ritual service." };
  }

  const allowedLocations = getAllowedLocationsForService(normalizedService);
  const safeLocation = allowedLocations.includes(location) ? location : allowedLocations[0];
  const participantCount = getParticipantCount(participants);
  const baseCost = Number(SERVICE_PRICES[normalizedService] || 0);
  const travelCost = Number(TRAVEL_CHARGES[safeLocation] || 0);

  return {
    service: normalizedService,
    location: safeLocation,
    participants: participantCount,
    allowedLocations,
    baseCost,
    travelCost,
    totalCost: baseCost + travelCost
  };
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "Booking backend is running",
    storage: "mongodb"
  });
});

app.get("/health", async (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.json({ ok: ready });
});

app.post("/create-booking", async (req, res) => {
  try {
    const {
      name = "",
      phone = "",
      preferredWhatsapp = "",
      email = "",
      service = "",
      gotra = "",
      pandit = "",
      date = "",
      time = "",
      location = "",
      address = "",
      note = "",
      participants = 1,
      paymentMode = "cash"
    } = req.body;

    if (!name || !phone || !service || !location) {
      return res.status(400).json({
        error: "Name, phone, service, and location are required."
      });
    }

    const cleanPhone = sanitizePhoneNumber(phone);
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: "Valid phone number is required." });
    }

    const cleanPreferredWhatsapp = sanitizePhoneNumber(preferredWhatsapp || phone);
    if (cleanPreferredWhatsapp.length < 10) {
      return res.status(400).json({ error: "Valid preferred WhatsApp number is required." });
    }

    const cleanEmail = safeText(email).toLowerCase();
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: "Valid email address is required." });
    }

    const pricing = resolveBookingPricing({ service, location, participants });
    if (pricing.error) {
      return res.status(400).json({ error: pricing.error });
    }

    const safeDate = safeText(date);
    const safeGotra = safeText(gotra || pandit);
    const safeTime = safeText(time);
    const safeAddress =
      pricing.location === "At My Home" || pricing.location === "Other Location" ? safeText(address) : "";

    if ((pricing.location === "At My Home" || pricing.location === "Other Location") && !safeAddress) {
      return res.status(400).json({ error: "Address is required for home or outside bookings." });
    }

    const resolvedPaymentStatus = paymentMode === "razorpay" ? "razorpay pending" : "cash pending";

    const booking = await Booking.create({
      bookingId: generateBookingId(),
      purpose: "booking",
      name: safeText(name),
      phone: cleanPhone.slice(-10),
      preferredWhatsapp: cleanPreferredWhatsapp.slice(-10),
      email: cleanEmail,
      service: pricing.service,
      gotra: safeGotra,
      pandit: "",
      date: safeDate,
      time: safeTime,
      location: pricing.location,
      address: safeAddress,
      participants: pricing.participants,
      note: safeText(note),
      amount: Number(pricing.totalCost || 0),
      paymentStatus: resolvedPaymentStatus,
      bookingStatus: "submitted",
      createdAtUnix: Math.floor(Date.now() / 1000),
      updatedAtUnix: Math.floor(Date.now() / 1000)
    });

    return res.json({
      success: true,
      booking: {
        bookingId: booking.bookingId,
        purpose: booking.purpose,
        name: booking.name,
        phone: booking.phone,
        preferredWhatsapp: booking.preferredWhatsapp,
        email: booking.email,
        service: booking.service,
        gotra: booking.gotra || booking.pandit || "",
        date: booking.date,
        time: booking.time,
        location: booking.location,
        address: booking.address,
        participants: booking.participants || 1,
        note: booking.note,
        amount: booking.amount,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.bookingStatus,
        createdAt: booking.createdAtUnix,
        updatedAt: booking.updatedAtUnix
      }
    });
  } catch (err) {
    console.error("Create booking error:", err);
    return res.status(500).json({ error: "Failed to create booking." });
  }
});

app.get("/api/razorpay-key", (_req, res) => {
  if (!RAZORPAY_KEY_ID) {
    return res.status(500).json({ error: "Razorpay key is not configured." });
  }
  return res.json({ key_id: RAZORPAY_KEY_ID });
});

app.post("/api/create-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ error: "Razorpay is not configured." });
    }

    const { currency = "INR", receipt = "", bookingId = "" } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required." });
    }

    const booking = await Booking.findOne({ bookingId }).lean();
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const cleanAmount = Math.max(100, Math.round(Number(booking.amount || 0) * 100));

    const resolvedReceipt = safeText(receipt, safeText(bookingId, "rcpt_" + Date.now()));

    const order = await razorpay.orders.create({
      amount: cleanAmount,
      currency,
      receipt: resolvedReceipt,
      notes: bookingId ? { bookingId } : undefined
    });

    if (bookingId) {
      await Booking.findOneAndUpdate(
        { bookingId },
        {
          $set: {
            paymentStatus: "razorpay order created",
            "razorpay.orderId": order.id,
            updatedAtUnix: Math.floor(Date.now() / 1000)
          }
        },
        { new: false }
      );
    }

    return res.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    const status = Number(err?.statusCode || err?.status || 500);
    if (status === 401) {
      return res.status(401).json({ error: "Razorpay authentication failed." });
    }
    console.error("Create order error:", err);
    return res.status(500).json({ error: "Failed to create Razorpay order." });
  }
});

app.post("/api/verify-payment", async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, bookingId = "" } =
      req.body || {};

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing required payment fields." });
    }

    if (!RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: "Razorpay is not configured." });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex");

    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(String(razorpay_signature), "utf8");

    const match =
      expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

    if (!match) {
      return res.status(400).json({ error: "Signature mismatch." });
    }

    if (bookingId) {
      await Booking.findOneAndUpdate(
        { bookingId },
        {
          $set: {
            paymentStatus: "razorpay paid",
            "razorpay.orderId": razorpay_order_id,
            "razorpay.paymentId": razorpay_payment_id,
            "razorpay.signature": razorpay_signature,
            updatedAtUnix: Math.floor(Date.now() / 1000)
          }
        },
        { new: false }
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Verify payment error:", err);
    return res.status(500).json({ error: "Failed to verify payment." });
  }
});

app.post("/api/razorpay/webhook", async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!secret) {
      return res.status(500).json({ error: "Webhook secret is not configured." });
    }

    if (!signature || !req.rawBody) {
      return res.status(400).json({ error: "Missing webhook signature or body." });
    }

    const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");

    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(String(signature), "utf8");
    const match =
      expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

    if (!match) {
      return res.status(400).json({ error: "Invalid webhook signature." });
    }

    const event = req.body?.event || "";
    const payment = req.body?.payload?.payment?.entity || null;
    const orderId = payment?.order_id || "";
    const paymentId = payment?.id || "";

    if (event === "payment.captured" && orderId && paymentId) {
      await Booking.findOneAndUpdate(
        { "razorpay.orderId": orderId },
        {
          $set: {
            paymentStatus: "razorpay paid",
            "razorpay.paymentId": paymentId,
            updatedAtUnix: Math.floor(Date.now() / 1000)
          }
        },
        { new: false }
      );
    }

    if (event === "payment.failed" && orderId) {
      await Booking.findOneAndUpdate(
        { "razorpay.orderId": orderId },
        {
          $set: {
            paymentStatus: "razorpay failed",
            updatedAtUnix: Math.floor(Date.now() / 1000)
          }
        },
        { new: false }
      );
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Webhook handling failed." });
  }
});

app.get("/booking/:bookingId", async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId }).lean();
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    return res.json({
      booking: {
        bookingId: booking.bookingId,
        purpose: booking.purpose,
        name: booking.name,
        phone: booking.phone,
        preferredWhatsapp: booking.preferredWhatsapp,
        email: booking.email,
        service: booking.service,
        gotra: booking.gotra || booking.pandit || "",
        date: booking.date,
        time: booking.time,
        location: booking.location,
        address: booking.address,
        participants: booking.participants || 1,
        note: booking.note,
        amount: booking.amount,
        paymentStatus: booking.paymentStatus,
        razorpay: booking.razorpay || {},
        bookingStatus: booking.bookingStatus,
        createdAt: booking.createdAtUnix,
        updatedAt: booking.updatedAtUnix
      }
    });
  } catch (err) {
    console.error("Fetch booking error:", err);
    return res.status(500).json({ error: "Failed to fetch booking." });
  }
});

app.get("/admin/bookings", adminAuth, async (_req, res) => {
  try {
    const items = await Booking.find(BOOKING_FILTER)
      .select(
        "bookingId name phone preferredWhatsapp email service gotra pandit date time location address participants amount paymentStatus bookingStatus createdAtUnix"
      )
      .sort({ createdAtUnix: -1 })
      .lean();

    return res.json({
      items: items.map((item) => ({
        id: item.bookingId,
        bookingId: item.bookingId,
        name: item.name || "—",
        phone: item.phone || "—",
        preferredWhatsapp: item.preferredWhatsapp || item.phone || "—",
        email: item.email || "—",
        service: item.service || "—",
        gotra: item.gotra || item.pandit || "—",
        date: item.date || "—",
        time: item.time || "—",
        location: item.location || "—",
        address: item.address || "—",
        participants: item.participants || 1,
        amount: Math.round(Number(item.amount || 0) * 100),
        paymentStatus: item.paymentStatus || "cash pending",
        bookingStatus: item.bookingStatus || "submitted",
        createdAt: item.createdAtUnix || 0
      }))
    });
  } catch (err) {
    console.error("Admin bookings error:", err);
    return res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

app.post("/admin/bookings/:bookingId/update", adminAuth, async (req, res) => {
  try {
    const { bookingStatus, paymentStatus } = req.body || {};

    const update = {
      updatedAtUnix: Math.floor(Date.now() / 1000)
    };

    if (bookingStatus) update.bookingStatus = bookingStatus;
    if (paymentStatus) update.paymentStatus = paymentStatus;

    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.bookingId },
      { $set: update },
      { new: true }
    ).lean();

    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }

    return res.json({
      success: true,
      booking: {
        bookingId: booking.bookingId,
        purpose: booking.purpose,
        name: booking.name,
        phone: booking.phone,
        preferredWhatsapp: booking.preferredWhatsapp,
        email: booking.email,
        service: booking.service,
        gotra: booking.gotra || booking.pandit || "",
        date: booking.date,
        time: booking.time,
        location: booking.location,
        address: booking.address,
        participants: booking.participants || 1,
        note: booking.note,
        amount: booking.amount,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.bookingStatus,
        createdAt: booking.createdAtUnix,
        updatedAt: booking.updatedAtUnix
      }
    });
  } catch (err) {
    console.error("Update booking error:", err);
    return res.status(500).json({ error: "Failed to update booking." });
  }
});

app.get("/admin/donations", adminAuth, async (_req, res) => {
  return res.json({ items: [] });
});

app.get("/admin/dashboard-summary", adminAuth, async (_req, res) => {
  try {
    const [totalBookings, cashPendingBookings, cashReceivedBookings, completedBookings] =
      await Promise.all([
        Booking.countDocuments(BOOKING_FILTER),
        Booking.countDocuments({ ...BOOKING_FILTER, paymentStatus: "cash pending" }),
        Booking.countDocuments({ ...BOOKING_FILTER, paymentStatus: "cash received" }),
        Booking.countDocuments({ ...BOOKING_FILTER, bookingStatus: "completed" })
      ]);

    return res.json({
      totalBookings,
      cashPendingBookings,
      cashReceivedBookings,
      completedBookings,
      totalDonations: 0,
      totalDonationAmount: 0
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    return res.status(500).json({ error: "Failed to fetch dashboard summary." });
  }
});

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000
  })
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });
