const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = path.join(__dirname, "..");
const HTML_DIR = path.join(ROOT_DIR, "html");
const DATA_DIR = path.join(ROOT_DIR, "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const PACKAGES_FILE = path.join(DATA_DIR, "packages.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const RATES_FILE = path.join(DATA_DIR, "rates.json");

const ADMIN_EMAIL = "admin@gmail.com";
const SESSION_COOKIE_NAME = "sid";

const sessions = new Map();

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

app.disable("x-powered-by");

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

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

/*
  Only expose public assets.
  Do NOT expose the whole project root.
*/
app.use("/css", express.static(path.join(ROOT_DIR, "css")));
app.use("/js", express.static(path.join(ROOT_DIR, "js")));
app.use("/img", express.static(path.join(ROOT_DIR, "img")));
app.use("/assets", express.static(path.join(ROOT_DIR, "assets")));

/* -------------------- helpers -------------------- */

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

function getSessionId(req) {
  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function getCurrentEmail(req) {
  const sessionId = getSessionId(req);
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  return session ? session.email : null;
}

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

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
}

function hashPassword(password, salt) {
  const realSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, realSalt, 100000, 64, "sha512")
    .toString("hex");

  return { salt: realSalt, hash };
}

function safeHashCompare(a, b) {
  try {
    const aBuf = Buffer.from(a, "hex");
    const bBuf = Buffer.from(b, "hex");

    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function wantsJson(req) {
  const accept = req.get("accept") || "";
  const contentType = req.get("content-type") || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function sendError(req, res, status, message) {
  if (wantsJson(req)) {
    return res.status(status).json({ message });
  }
  return res.status(status).send(message);
}

function sendRedirectOrJson(req, res, redirectTo) {
  if (wantsJson(req)) {
    return res.json({ redirect: redirectTo });
  }
  return res.redirect(303, redirectTo);
}

/* -------------------- auth middleware -------------------- */

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

/* -------------------- health -------------------- */

app.get("/health", (req, res) => {
  res.json({ ok: true, port: PORT });
});

app.get("/message", (req, res) => {
  res.send("Ahoy!");
});

app.get("/favicon.png", (req, res) => {
  res.sendFile(path.join(ROOT_DIR, "favicon.png"));
});

/* -------------------- page routes -------------------- */

app.get("/", (req, res) => {
  res.sendFile(path.join(HTML_DIR, "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(HTML_DIR, "login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(HTML_DIR, "signup.html"));
});

app.get("/user", requireAuthPage, (req, res) => {
  res.sendFile(path.join(HTML_DIR, "user.html"));
});

app.get("/admin", requireAdminPage, (req, res) => {
  res.sendFile(path.join(HTML_DIR, "admin.html"));
});

/* old URLs still work */
app.get("/html/login.html", (req, res) => res.redirect(303, "/login"));
app.get("/html/signup.html", (req, res) => res.redirect(303, "/signup"));
app.get("/html/user.html", (req, res) => res.redirect(303, "/user"));
app.get("/html/admin.html", (req, res) => res.redirect(303, "/admin"));

/* -------------------- auth routes -------------------- */

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

app.get("/me", requireAuthApi, async (req, res) => {
  try {
    const data = await fs.readFile(packagesPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load packages' });
  }
});

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

app.post('/orders', async (req, res) => {
  try {
    const duration = Number(req.body?.duration);

    if (!Number.isFinite(duration)) {
      return res.status(400).json({ error: "Invalid order data" });
    }

    let db;
    try {
      const raw = await fs.readFile(ordersPath, 'utf-8');
      db = JSON.parse(raw);
    } catch {
      db = { orders: [] };
    }

    const newOrder = {
      id: Date.now(),
      userId: req.user.email,
      duration,
      date: new Date().toISOString()
    };

    db.orders.push(newOrder);

    await fs.writeFile(ordersPath, JSON.stringify(db, null, 2));

    res.status(201).json(newOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const db = await readJson(ORDERS_FILE, { orders: [] });
    const allOrders = Array.isArray(db.orders) ? db.orders : [];

    if (req.user.isAdmin) {
      return res.json(allOrders);
    }

    return res.json(allOrders.filter(order => order.userId === req.user.email));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

app.get("/rates", async (req, res) => {
  try {
    const db = await readJson(RATES_FILE, { rates: [] });
    if (Array.isArray(db)) {
      return res.json(db);
    }
    return res.json(db.rates || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load rates" });
  }
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);