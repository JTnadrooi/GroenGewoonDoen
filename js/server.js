const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// Base folders used throughout the app.
const ROOT_DIR = path.join(__dirname, "..");
const HTML_DIR = path.join(ROOT_DIR, "html");
const DATA_DIR = path.join(ROOT_DIR, "data");

// JSON files used as a simple local data store.
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PACKAGES_FILE = path.join(DATA_DIR, "packages.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const RATES_FILE = path.join(DATA_DIR, "rates.json");

// Change this if you want a different admin account.
const ADMIN_EMAIL = "admin@gmail.com";

// Name of the cookie that stores the session ID.
const SESSION_COOKIE_NAME = "sid";

// In-memory session store.
// This is fine for local development, but sessions disappear when the server restarts.
const sessions = new Map();

// Origins allowed to call the backend during local development.
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

app.disable("x-powered-by");

// Allow requests from the local frontend origins above.
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Small security-related response headers.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Only expose the folders the browser should actually be able to access.
app.use("/css", express.static(path.join(ROOT_DIR, "css")));
app.use("/js", express.static(path.join(ROOT_DIR, "js")));
app.use("/img", express.static(path.join(ROOT_DIR, "img")));
app.use("/assets", express.static(path.join(ROOT_DIR, "assets")));

/* -------------------- helper functions -------------------- */

// Parses the Cookie header into an object like { sid: "..." }.
function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const cookies = {};

  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;

    const key = decodeURIComponent(part.slice(0, idx).trim());
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    cookies[key] = value;
  }

  return cookies;
}

// Reads the current session ID from the request cookie.
function getSessionId(req) {
  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE_NAME] || null;
}

// Looks up the logged-in email for the current request.
function getCurrentEmail(req) {
  const sessionId = getSessionId(req);

  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);
  return session ? session.email : null;
}

// Writes the session cookie after a successful login.
function setSessionCookie(res, sessionId) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax"
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

// Clears the session cookie during logout.
function clearSessionCookie(res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

// Reads a JSON file and returns a fallback value if the file does not exist yet.
async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw || JSON.stringify(fallbackValue));
  } catch (err) {
    if (err.code === "ENOENT") {
      await writeJson(filePath, fallbackValue);
      return fallbackValue;
    }

    throw err;
  }
}

// Writes a value to a JSON file, creating folders if needed.
async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

// Hashes a password using PBKDF2.
// If no salt is provided, a new one is generated.
function hashPassword(password, salt) {
  const realSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, realSalt, 100000, 64, "sha512")
    .toString("hex");

  return { salt: realSalt, hash };
}

// Compares two password hashes safely.
function safeHashCompare(a, b) {
  try {
    const aBuf = Buffer.from(a, "hex");
    const bBuf = Buffer.from(b, "hex");

    if (aBuf.length !== bBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// Checks whether the current request expects JSON.
function wantsJson(req) {
  const accept = req.get("accept") || "";
  const contentType = req.get("content-type") || "";

  return accept.includes("application/json") || contentType.includes("application/json");
}

// Sends an error as JSON for API requests, or plain text otherwise.
function sendError(req, res, status, message) {
  if (wantsJson(req)) {
    return res.status(status).json({ message });
  }

  return res.status(status).send(message);
}

// Returns either JSON with a redirect target or a real redirect response.
function sendRedirectOrJson(req, res, redirectTo) {
  if (wantsJson(req)) {
    return res.json({ redirect: redirectTo });
  }

  return res.redirect(303, redirectTo);
}

/* -------------------- auth middleware -------------------- */

// Blocks page access unless the user is logged in.
function requireAuthPage(req, res, next) {
  const email = getCurrentEmail(req);

  if (!email) {
    return res.redirect(303, "/login");
  }

  req.user = {
    email,
    isAdmin: email === ADMIN_EMAIL
  };

  next();
}

// Blocks page access unless the user is logged in as admin.
function requireAdminPage(req, res, next) {
  const email = getCurrentEmail(req);

  if (!email) {
    return res.redirect(303, "/login");
  }

  if (email !== ADMIN_EMAIL) {
    return res.status(403).send("Admin access required");
  }

  req.user = {
    email,
    isAdmin: true
  };

  next();
}

// Blocks API access unless the user is logged in.
function requireAuthApi(req, res, next) {
  const email = getCurrentEmail(req);

  if (!email) {
    return res.status(401).json({ message: "Login required" });
  }

  req.user = {
    email,
    isAdmin: email === ADMIN_EMAIL
  };

  next();
}

/* -------------------- simple routes -------------------- */

// Basic health route used by the frontend to detect a working backend.
app.get("/health", (req, res) => {
  res.json({ ok: true, port: PORT });
});

// Small test route.
app.get("/message", (req, res) => {
  res.send("Ahoy!");
});

// Serves favicon.png from the project root.
app.get("/favicon.png", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "favicon.png"));
});

/* -------------------- page routes -------------------- */

// Public pages.
app.get("/", (req, res) => {
  res.sendFile(path.join(HTML_DIR, "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(HTML_DIR, "login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(HTML_DIR, "signup.html"));
});

// Protected pages.
app.get("/user", requireAuthPage, (req, res) => {
  res.sendFile(path.join(HTML_DIR, "user.html"));
});

app.get("/admin", requireAdminPage, (req, res) => {
  res.sendFile(path.join(HTML_DIR, "admin.html"));
});

// Older file-style URLs still work by redirecting to the cleaner route names.
app.get("/html/login.html", (req, res) => res.redirect(303, "/login"));
app.get("/html/signup.html", (req, res) => res.redirect(303, "/signup"));
app.get("/html/user.html", (req, res) => res.redirect(303, "/user"));
app.get("/html/admin.html", (req, res) => res.redirect(303, "/admin"));

/* -------------------- auth routes -------------------- */

// Creates a new user account and saves it in users.json.
app.post("/newuser", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!email || !password) {
      return sendError(req, res, 400, "Email and password required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await readJson(USERS_FILE, {});

    if (users[normalizedEmail]) {
      return sendError(req, res, 400, "Email already registered");
    }

    const hashed = hashPassword(String(password));

    users[normalizedEmail] = {
      name: name ? String(name).trim() : "",
      hash: hashed.hash,
      salt: hashed.salt
    };

    await writeJson(USERS_FILE, users);

    return sendRedirectOrJson(req, res, "/login");
  } catch (err) {
    console.error(err);
    return sendError(req, res, 500, "Failed to create user");
  }
});

// Logs a user in, creates a session, and sets the session cookie.
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return sendError(req, res, 400, "Email and password required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await readJson(USERS_FILE, {});
    const user = users[normalizedEmail];

    if (!user) {
      return sendError(req, res, 401, "Invalid credentials");
    }

    const hashed = hashPassword(String(password), user.salt);

    if (!safeHashCompare(hashed.hash, user.hash)) {
      return sendError(req, res, 401, "Invalid credentials");
    }

    const sessionId = crypto.randomBytes(32).toString("hex");

    sessions.set(sessionId, {
      email: normalizedEmail,
      createdAt: Date.now()
    });

    setSessionCookie(res, sessionId);

    const redirectTo = normalizedEmail === ADMIN_EMAIL ? "/admin" : "/user";
    return sendRedirectOrJson(req, res, redirectTo);
  } catch (err) {
    console.error(err);
    return sendError(req, res, 500, "Login failed");
  }
});

// Logs the user out by removing the server-side session and clearing the cookie.
app.post("/logout", (req, res) => {
  const sessionId = getSessionId(req);

  if (sessionId) {
    sessions.delete(sessionId);
  }

  clearSessionCookie(res);

  if (wantsJson(req)) {
    return res.json({ message: "Logged out successfully", redirect: "/login" });
  }

  return res.redirect(303, "/login");
});

/* -------------------- data routes -------------------- */

// Returns the current logged-in user's basic profile.
app.get("/me", requireAuthApi, async (req, res) => {
  try {
    const users = await readJson(USERS_FILE, {});
    const current = users[req.user.email] || {};

    res.json({
      email: req.user.email,
      name: current.name || "",
      isAdmin: req.user.isAdmin
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load profile" });
  }
});

// Returns the list of available packages.
app.get("/packages", async (req, res) => {
  try {
    const data = await readJson(PACKAGES_FILE, []);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load packages" });
  }
});

// Returns the list of rates.
app.get("/rates", async (req, res) => {
  try {
    const data = await readJson(RATES_FILE, { rates: [] });

    if (Array.isArray(data)) {
      return res.json(data);
    }

    return res.json(data.rates || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load rates" });
  }
});

// Creates a new order for the currently logged-in user.
app.post("/orders", requireAuthApi, async (req, res) => {
  try {
    const duration = Number(req.body?.duration);
    const requestedDate = req.body?.date;
    const packageId = req.body?.packageId || null;
    const packageName = req.body?.packageName || null;
    const gardenSize = req.body?.gardenSize ?? null;

    if (!Number.isFinite(duration) || duration <= 0) {
      return res.status(400).json({ error: "Invalid order data" });
    }

    const db = await readJson(ORDERS_FILE, { orders: [] });

    const newOrder = {
      id: Date.now(),
      userId: req.user.email,
      duration,
      date: requestedDate ? new Date(requestedDate).toISOString() : new Date().toISOString(),
      packageId,
      packageName,
      gardenSize,
      status: "pending"
    };

    db.orders.push(newOrder);
    await writeJson(ORDERS_FILE, db);

    res.status(201).json(newOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

// Returns orders for the current user.
// If the current user is the admin, return all orders instead.
app.get("/orders", requireAuthApi, async (req, res) => {
  try {
    const db = await readJson(ORDERS_FILE, { orders: [] });
    const allOrders = Array.isArray(db.orders) ? db.orders : [];

    if (req.user.isAdmin) {
      return res.json(allOrders);
    }

    return res.json(allOrders.filter(order => order.userId === req.user.email));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load orders" });
  }
});

// Deletes one order by ID.
// This is currently left open so the existing admin calendar flow keeps working.
// Later you may want to protect this with admin-only auth.
app.delete("/api/orders/:id", async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const db = await readJson(ORDERS_FILE, { orders: [] });

    const initialLength = db.orders.length;
    db.orders = db.orders.filter(order => order.id !== orderId);

    if (db.orders.length === initialLength) {
      return res.status(404).json({ error: "Order not found" });
    }

    await writeJson(ORDERS_FILE, db);

    res.status(200).json({ message: "Order successfully deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error while deleting the order" });
  }
});

// Start the server.
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});