import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

app.use(express.json());
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const PORT = process.env.PORT || 5000;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "bookings.json");

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
  if (!Array.isArray(parsed.items)) return { items: [] };
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

async function createBookingRecord(payload) {
  const store = await readStore();
  const booking = {
    bookingId: generateBookingId(),
    purpose: "booking",
    name: safeText(payload.name),
    phone: safeText(payload.phone),
    email: safeText(payload.email),
    service: safeText(payload.service),
    pandit: safeText(payload.pandit),
    date: safeText(payload.date),
    time: safeText(payload.time),
    location: safeText(payload.location),
    address: safeText(payload.address),
    note: safeText(payload.note),
    amount: Number(payload.amount || 0),
    paymentStatus: "cash pending",
    bookingStatus: "submitted",
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  };
  store.items.push(booking);
  await writeStore(store);
  return booking;
}

async function updateBooking(bookingId, updates) {
  const store = await readStore();
  const index = store.items.findIndex((item) => item.bookingId === bookingId);
  if (index === -1) return null;
  store.items[index] = {
    ...store.items[index],
    ...updates,
    updatedAt: Math.floor(Date.now() / 1000),
  };
  await writeStore(store);
  return store.items[index];
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "Booking backend is running",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
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
      amount = 0,
    } = req.body;

    if (!name || !phone || !service || !location) {
      return res.status(400).json({ error: "Name, phone, service, and location are required." });
    }

    const cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: "Valid phone number is required." });
    }

    const booking = await createBookingRecord({
      name,
      phone: cleanPhone.slice(-10),
      email,
      service,
      pandit,
      date,
      time,
      location,
      address,
      note,
      amount,
    });

    return res.json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("Create booking error:", err);
    return res.status(500).json({ error: "Failed to create booking." });
  }
});

app.get("/booking/:bookingId", async (req, res) => {
  try {
    const store = await readStore();
    const booking = store.items.find((item) => item.bookingId === req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found." });
    }
    return res.json({ booking });
  } catch (err) {
    console.error("Fetch booking error:", err);
    return res.status(500).json({ error: "Failed to fetch booking." });
  }
});

app.get("/admin/bookings", adminAuth, async (_req, res) => {
  try {
    const store = await readStore();
    const items = store.items
      .filter((item) => item.purpose === "booking")
      .map((item) => ({
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
        amount: Math.round(Number(item.amount || 0) * 100),
        paymentStatus: item.paymentStatus || "cash pending",
        bookingStatus: item.bookingStatus || "submitted",
        createdAt: item.createdAt || 0,
      }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.json({ items });
  } catch (err) {
    console.error("Admin bookings error:", err);
    return res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

app.post("/admin/bookings/:bookingId/update", adminAuth, async (req, res) => {
  try {
    const { bookingStatus, paymentStatus } = req.body || {};
    const updated = await updateBooking(req.params.bookingId, {
      ...(bookingStatus ? { bookingStatus } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
    });

    if (!updated) {
      return res.status(404).json({ error: "Booking not found." });
    }

    return res.json({ success: true, booking: updated });
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
    const store = await readStore();
    const bookings = store.items.filter((item) => item.purpose === "booking");
    const cashPendingBookings = bookings.filter((item) => item.paymentStatus === "cash pending").length;
    const cashReceivedBookings = bookings.filter((item) => item.paymentStatus === "cash received").length;
    const completedBookings = bookings.filter((item) => item.bookingStatus === "completed").length;

    return res.json({
      totalBookings: bookings.length,
      cashPendingBookings,
      cashReceivedBookings,
      completedBookings,
      totalDonations: 0,
      totalDonationAmount: 0,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    return res.status(500).json({ error: "Failed to fetch dashboard summary." });
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
