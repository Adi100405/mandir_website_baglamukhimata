import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const PORT = process.env.PORT || 5000;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

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
  const stamp = now
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const rand = Math.floor(100000 + Math.random() * 900000);

  return `BKM-${stamp}-${rand}`;
}

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    purpose: {
      type: String,
      default: "booking"
    },

    name: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      required: true
    },

    email: {
      type: String,
      default: ""
    },

    service: {
      type: String,
      required: true
    },

    pandit: {
      type: String,
      default: ""
    },

    date: {
      type: String,
      default: ""
    },

    time: {
      type: String,
      default: ""
    },

    location: {
      type: String,
      required: true
    },

    address: {
      type: String,
      default: ""
    },

    note: {
      type: String,
      default: ""
    },

    amount: {
      type: Number,
      default: 0
    },

    razorpayOrderId: {
      type: String,
      default: ""
    },

    razorpayPaymentId: {
      type: String,
      default: ""
    },

    paymentStatus: {
      type: String,
      default: "cash pending"
    },

    bookingStatus: {
      type: String,
      default: "submitted"
    },

    createdAtUnix: {
      type: Number,
      default: () => Math.floor(Date.now() / 1000)
    },

    updatedAtUnix: {
      type: Number,
      default: () => Math.floor(Date.now() / 1000)
    }
  },
  { timestamps: true }
);

const Booking =
  mongoose.models.Booking ||
  mongoose.model("Booking", bookingSchema);

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

/*
|--------------------------------------------------------------------------
| CREATE RAZORPAY ORDER
|--------------------------------------------------------------------------
*/

app.post("/api/create-order", async (req, res) => {
  try {
    const { amount, receipt } = req.body;

    if (!amount || Number(amount) < 100) {
      return res.status(400).json({
        error: "Minimum amount is 100 paise"
      });
    }

    const order = await razorpay.orders.create({
      amount: Number(amount),
      currency: "INR",
      receipt: receipt || `receipt_${Date.now()}`
    });

    return res.json({
      success: true,
      key: RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (err) {
    console.error("Create order error:", err);

    return res.status(500).json({
      error: "Failed to create Razorpay order"
    });
  }
});

/*
|--------------------------------------------------------------------------
| VERIFY PAYMENT
|--------------------------------------------------------------------------
*/

app.post("/api/verify-payment", async (req, res) => {
  try {
    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        error: "Missing payment fields"
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Signature mismatch"
      });
    }

    if (bookingId) {
      await Booking.findOneAndUpdate(
        { bookingId },
        {
          $set: {
            paymentStatus: "paid",
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            updatedAtUnix: Math.floor(Date.now() / 1000)
          }
        }
      );
    }

    return res.json({
      success: true,
      paymentId: razorpay_payment_id
    });
  } catch (err) {
    console.error("Verify payment error:", err);

    return res.status(500).json({
      error: "Verification failed"
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE BOOKING
|--------------------------------------------------------------------------
*/

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
      amount = 0
    } = req.body;

    if (!name || !phone || !service || !location) {
      return res.status(400).json({
        error:
          "Name, phone, service, and location are required."
      });
    }

    const cleanPhone = String(phone).replace(/\D/g, "");

    if (cleanPhone.length < 10) {
      return res.status(400).json({
        error: "Valid phone number is required."
      });
    }

    const booking = await Booking.create({
      bookingId: generateBookingId(),
      purpose: "booking",
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
      amount: Number(amount || 0),
      paymentStatus: "cash pending",
      bookingStatus: "submitted",
      createdAtUnix: Math.floor(Date.now() / 1000),
      updatedAtUnix: Math.floor(Date.now() / 1000)
    });

    let razorpayOrder = null;

    if (Number(amount) > 0) {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(Number(amount) * 100),
        currency: "INR",
        receipt: booking.bookingId
      });

      await Booking.findByIdAndUpdate(
        booking._id,
        {
          razorpayOrderId: razorpayOrder.id
        }
      );
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
        note: booking.note,
        amount: booking.amount,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.bookingStatus,
        createdAt: booking.createdAtUnix,
        updatedAt: booking.updatedAtUnix
      },

      razorpayOrder: razorpayOrder
        ? {
            key: RAZORPAY_KEY_ID,
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency
          }
        : null
    });
  } catch (err) {
    console.error("Create booking error:", err);

    return res.status(500).json({
      error: "Failed to create booking."
    });
  }
});

app.get("/booking/:bookingId", async (req, res) => {
  try {
    const booking = await Booking.findOne({
      bookingId: req.params.bookingId
    }).lean();

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found."
      });
    }

    return res.json({ booking });
  } catch (err) {
    console.error("Fetch booking error:", err);

    return res.status(500).json({
      error: "Failed to fetch booking."
    });
  }
});

app.get("/admin/bookings", adminAuth, async (_req, res) => {
  try {
    const items = await Booking.find({
      purpose: "booking"
    })
      .sort({ createdAtUnix: -1 })
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error("Admin bookings error:", err);

    return res.status(500).json({
      error: "Failed to fetch bookings."
    });
  }
});

app.post(
  "/admin/bookings/:bookingId/update",
  adminAuth,
  async (req, res) => {
    try {
      const { bookingStatus, paymentStatus } =
        req.body || {};

      const update = {
        updatedAtUnix: Math.floor(Date.now() / 1000)
      };

      if (bookingStatus)
        update.bookingStatus = bookingStatus;

      if (paymentStatus)
        update.paymentStatus = paymentStatus;

      const booking =
        await Booking.findOneAndUpdate(
          {
            bookingId: req.params.bookingId
          },
          {
            $set: update
          },
          {
            new: true
          }
        ).lean();

      if (!booking) {
        return res.status(404).json({
          error: "Booking not found."
        });
      }

      return res.json({
        success: true,
        booking
      });
    } catch (err) {
      console.error("Update booking error:", err);

      return res.status(500).json({
        error: "Failed to update booking."
      });
    }
  }
);

app.get("/admin/donations", adminAuth, async (_req, res) => {
  return res.json({ items: [] });
});

app.get(
  "/admin/dashboard-summary",
  adminAuth,
  async (_req, res) => {
    try {
      const bookings = await Booking.find({
        purpose: "booking"
      }).lean();

      const cashPendingBookings =
        bookings.filter(
          (item) =>
            item.paymentStatus === "cash pending"
        ).length;

      const cashReceivedBookings =
        bookings.filter(
          (item) =>
            item.paymentStatus === "cash received"
        ).length;

      const completedBookings =
        bookings.filter(
          (item) =>
            item.bookingStatus === "completed"
        ).length;

      return res.json({
        totalBookings: bookings.length,
        cashPendingBookings,
        cashReceivedBookings,
        completedBookings,
        totalDonations: 0,
        totalDonationAmount: 0
      });
    } catch (err) {
      console.error(
        "Dashboard summary error:",
        err
      );

      return res.status(500).json({
        error: "Failed to fetch dashboard summary."
      });
    }
  }
);

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
    console.error(
      "MongoDB connection failed:",
      err
    );
    process.exit(1);
  });
