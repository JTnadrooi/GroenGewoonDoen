const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});