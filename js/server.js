const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const fs = require('fs');
const crypto = require('crypto');

// path to user data file
const usersFile = path.join(__dirname, '..', 'data', 'users.json');

// helpers for user storage
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

app.use(cors());
app.use(express.json());

// Serve static folders (so /css, /js, /media, /html work)
app.use(express.static(path.join(__dirname, "..")));

// Homepage -> your html/index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "html", "index.html"));
});

// Existing test route
app.get("/message", (req, res) => {
  res.send("Ahoy!");
});

// login and signup pages (convenience endpoints)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'login.html'));
});
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'signup.html'));
});
// admin interface (after login)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'html', 'admin.html'));
});

// handle signup submissions
app.post('/signup', (req, res) => {
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
  return res.json({ redirect: '/login' });
});

// handle login submissions
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
  // on successful login, redirect to admin interface
  return res.json({ redirect: '/admin' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});