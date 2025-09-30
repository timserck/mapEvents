const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const pool = require("./db");
const cors = require("cors"); // ✅ ajouter cors

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// Autoriser CORS depuis ton frontend
app.use(cors({
  origin: "http://localhost:3000", // adresse de ton frontend
  credentials: true
}));

app.use(bodyParser.json());

// Middleware auth
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

// Middleware admin uniquement
function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// Route login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, role: user.role });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Ajouter un événement (admin only)
app.post("/events", authMiddleware, adminMiddleware, async (req, res) => {
  const { title, type, date, latitude, longitude, description } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO events (title, type, date, description, location) VALUES ($1,$2,$3,$4,ST_GeogFromText($5)) RETURNING *",
      [title, type, date, description, `SRID=4326;POINT(${longitude} ${latitude})`]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Insert event error:", err);
    res.status(500).json({ error: "DB insert error" });
  }
});

// Lire les événements (accessible à tous)
app.get("/events", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, title, type, date, description, ST_X(location::geometry) AS longitude, ST_Y(location::geometry) AS latitude FROM events");
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).json({ error: "DB fetch error" });
  }
});

app.listen(4000, () => console.log("Server running on port 4000"));
