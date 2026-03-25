const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const fs = require('fs');
const crypto = require('crypto');

const usersFile = path.join(__dirname, '..', 'data', 'users.json');
const ADMIN_EMAIL = 'bitch@gmail.com';

// Session storage (simple in-memory, replace with database in production)
const sessions = {};

function readUsers() {
  try {
    var txt = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(txt || '{}');
  } catch (e) {
    return {};
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  var hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt: salt, hash: hash };
}

// Middleware to check if user is logged in as admin
function requireAdmin(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
  const userEmail = sessions[sessionId];
  
  if (!userEmail || userEmail !== ADMIN_EMAIL) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "html", "index.html"));
});

app.get("/message", (req, res) => {
  res.send("Ahoy!");
});

app.post('/newuser', (req, res) => {
  var { name, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  var users = readUsers();
  if (users[email]) {
    return res.status(400).json({ message: 'Email already registered' });
  }
  var h = hashPassword(password);
  users[email] = { name: name || '', hash: h.hash, salt: h.salt };
  writeUsers(users);
  return res.json({ redirect: '/html/login.html' });
});

app.post('/login', (req, res) => {
  var { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  var users = readUsers();
  var u = users[email];
  if (!u) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  var h = hashPassword(password, u.salt);
  if (h.hash !== u.hash) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  // Create session
  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions[sessionId] = email;
  
  return res.json({ 
    redirect: email === ADMIN_EMAIL ? '/html/admin.html' : '/html/user.html',
    sessionId: sessionId
  });
});

app.get('/html/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'login.html'));
});

app.get('/html/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'signup.html'));
});

app.get('/html/admin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'admin.html'));
});

app.get('/html/user.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'user.html'));
});

const packagesPath = path.join(__dirname, '../data/packages.json');
const ordersPath = path.join(__dirname, '../data/orders.json');

app.get('/packages', async (req, res) => {
  try {
    const data = await fs.readFile(packagesPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load packages' });
  }
});

app.post('/orders', async (req, res) => {
  try {
    const { userId, duration } = req.body;

    if (!userId || typeof duration !== 'number') {
      return res.status(400).json({ error: 'Invalid order data' });
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
      userId,
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
    const raw = await fs.readFile(ordersPath, 'utf-8');
    const db = JSON.parse(raw);
    res.json(db.orders || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

app.get('/rates', async (req, res) => {
  try {
    const raw = await fs.readFile(ratesPath, 'utf-8');
    const db = JSON.parse(raw);
    res.json(db.rates || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load rates' });
  }
});

app.post('/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (sessionId && sessions[sessionId]) {
    delete sessions[sessionId];
  }
  res.json({ message: 'Logged out successfully' });
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);