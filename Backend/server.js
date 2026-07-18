import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import crypto from "crypto";

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
    email: { type: String, default: "" },
    service: { type: String, required: true },
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

const MIRCHI_HAWAN_SERVICE = "Mirchi Hawan";
const MIRCHI_HAWAN_RATE = 500;
const MIRCHI_HAWAN_START = "2026-07-15";
const MIRCHI_HAWAN_END = "2026-07-29";
const MIRCHI_HAWAN_TIME = "8 PM – 9 PM";
const TRAVEL_CHARGES = {
  "At the Temple": 0,
  "At My Home": 700,
  "Other Location": 1000
};
const SERVICE_PRICES = {
  "श्री बंगलामुखी हवन": 3100,
  "Mirchi Hawan": 500,
  "नज़र बाधा निवारण": 3100,
  "तन्त्र बाधा निवारण": 5100,
  "शत्रु बाधा": 5100,
  "मुकदमा / कोर्ट केस": 3100,
  "बिजनेस कार्य सिद्धि": 2100,
  "लक्ष्मी प्राप्ति-हवन तीन दिवसीय तीन ब्राह्मणों द्वारा": 21000,
  "चण्डी हवन विधानम्": 5100,
  "प्रेत बाधा निवारण": 2100,
  "सत्यनारायण व्रत कथा": 5100,
  "गृहप्रवेश पूजा": 5100,
  "नामकरण संस्कार": 5100,
  "गृह शांति हवन": 3100,
  "जन्मदिवस पूजा हवन": 5100,
  "सुन्दरकाण्ड पाठ संगीतमय": 8100,
  "नवग्रह शान्ति हवन": 5100,
  "नवग्रह जाप नव ब्राह्मणों द्वारा तीन दिवसीय": 31000,
  "महामृत्युंजय जप सात ब्राह्मणों द्वारा पाँच दिवसीय": 80000,
  "सुन्दरकाण्ड पाठ": 5100,
  "बंगलामुखी जप सात ब्राह्मणों द्वारा सात दिवसीय": 115000,
  "गौ दान गौशाला": 1100,
  "दुर्गा सप्त शती पाठ — 9 पाठ": 21000,
  "रुद्राभिषेक": 5100,
  "गरुण पुराण सात दिवसीय": 11000,
  "तेरहवीं संस्कार": 11000
};
const SERVICE_LOCATION_RULES = {
  "श्री बंगलामुखी हवन": ["At the Temple"],
  "Mirchi Hawan": ["At the Temple"],
  "नज़र बाधा निवारण": ["At the Temple"],
  "तन्त्र बाधा निवारण": ["At the Temple"],
  "शत्रु बाधा": ["At the Temple"],
  "मुकदमा / कोर्ट केस": ["At the Temple"],
  "बिजनेस कार्य सिद्धि": ["At the Temple"],
  "लक्ष्मी प्राप्ति-हवन तीन दिवसीय तीन ब्राह्मणों द्वारा": ["At the Temple"],
  "प्रेत बाधा निवारण": ["At the Temple"],
  "सत्यनारायण व्रत कथा": ["At My Home", "Other Location"],
  "गृहप्रवेश पूजा": ["At My Home", "Other Location"],
  "नामकरण संस्कार": ["At My Home", "Other Location"],
  "गृह शांति हवन": ["At My Home", "Other Location"],
  "जन्मदिवस पूजा हवन": ["At My Home", "Other Location"],
  "सुन्दरकाण्ड पाठ संगीतमय": ["At My Home", "Other Location"],
  "नवग्रह शान्ति हवन": ["At My Home", "Other Location"],
  "नवग्रह जाप नव ब्राह्मणों द्वारा तीन दिवसीय": ["At the Temple"],
  "चण्डी हवन विधानम्": ["At the Temple", "At My Home", "Other Location"],
  "महामृत्युंजय जप सात ब्राह्मणों द्वारा पाँच दिवसीय": ["At the Temple"],
  "सुन्दरकाण्ड पाठ": ["At My Home", "Other Location"],
  "बंगलामुखी जप सात ब्राह्मणों द्वारा सात दिवसीय": ["At the Temple"],
  "गौ दान गौशाला": ["At the Temple"],
  "दुर्गा सप्त शती पाठ — 9 पाठ": ["At the Temple", "At My Home", "Other Location"],
  "रुद्राभिषेक": ["At the Temple", "At My Home", "Other Location"],
  "गरुण पुराण सात दिवसीय": ["At My Home", "Other Location"],
  "तेरहवीं संस्कार": ["At My Home", "Other Location"]
};

function isMirchiHawanService(service) {
  return service === MIRCHI_HAWAN_SERVICE;
}

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
  const participantCount = isMirchiHawanService(normalizedService) ? getParticipantCount(participants) : 1;
  const baseCost = isMirchiHawanService(normalizedService)
    ? participantCount * MIRCHI_HAWAN_RATE
    : Number(SERVICE_PRICES[normalizedService] || 0);
  const travelCost = isMirchiHawanService(normalizedService)
    ? 0
    : Number(TRAVEL_CHARGES[safeLocation] || 0);

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
      email = "",
      service = "",
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

    const cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: "Valid phone number is required." });
    }

    const pricing = resolveBookingPricing({ service, location, participants });
    if (pricing.error) {
      return res.status(400).json({ error: pricing.error });
    }

    const safeDate = safeText(date);
    const safePandit = isMirchiHawanService(pricing.service) ? "" : safeText(pandit);
    const safeTime = isMirchiHawanService(pricing.service) ? MIRCHI_HAWAN_TIME : safeText(time);
    const safeAddress =
      pricing.location === "At My Home" || pricing.location === "Other Location" ? safeText(address) : "";

    if (
      isMirchiHawanService(pricing.service) &&
      (!safeDate || safeDate < MIRCHI_HAWAN_START || safeDate > MIRCHI_HAWAN_END)
    ) {
      return res.status(400).json({ error: "Mirchi Hawan is available only during the event dates." });
    }

    if ((pricing.location === "At My Home" || pricing.location === "Other Location") && !safeAddress) {
      return res.status(400).json({ error: "Address is required for home or outside bookings." });
    }

    const resolvedPaymentStatus = paymentMode === "razorpay" ? "razorpay pending" : "cash pending";

    const booking = await Booking.create({
      bookingId: generateBookingId(),
      purpose: "booking",
      name: safeText(name),
      phone: cleanPhone.slice(-10),
      email: safeText(email),
      service: pricing.service,
      pandit: safePandit,
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
        email: booking.email,
        service: booking.service,
        pandit: booking.pandit,
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
        email: booking.email,
        service: booking.service,
        pandit: booking.pandit,
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
    const items = await Booking.find({ purpose: "booking" })
      .sort({ createdAtUnix: -1 })
      .lean();

    return res.json({
      items: items.map((item) => ({
        id: item.bookingId,
        bookingId: item.bookingId,
        name: item.name || "—",
        phone: item.phone || "—",
        email: item.email || "—",
        service: item.service || "—",
        pandit: item.pandit || "—",
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
        email: booking.email,
        service: booking.service,
        pandit: booking.pandit,
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
    const bookings = await Booking.find({ purpose: "booking" }).lean();

    const cashPendingBookings = bookings.filter((item) => item.paymentStatus === "cash pending").length;
    const cashReceivedBookings = bookings.filter((item) => item.paymentStatus === "cash received").length;
    const completedBookings = bookings.filter((item) => item.bookingStatus === "completed").length;

    return res.json({
      totalBookings: bookings.length,
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
