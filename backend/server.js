const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const pool = require("./db");
const cors = require("cors");
const fetch = require("node-fetch");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// Enable CORS
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(bodyParser.json());

// Auth middleware
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

// Admin-only middleware
function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin only" });
  next();
}

// Geocode address
async function geocodeAddress(address) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}&limit=1`
    );
    const data = await res.json();
    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
  } catch (err) {
    console.error("Geocoding error:", err);
  }
  return null;
}

// Login route
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username=$1", [
      username,
    ]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: "Invalid credentials" });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ token, role: user.role });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create event
app.post("/events", authMiddleware, adminMiddleware, async (req, res) => {
  let { title, type, date, description, address, latitude, longitude } = req.body;

  // Geocode if address provided but no coordinates
  if (address && (!latitude || !longitude)) {
    const geo = await geocodeAddress(address);
    if (geo) {
      latitude = geo.latitude;
      longitude = geo.longitude;
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (title, type, date, description, address, location)
       VALUES ($1,$2,$3,$4,$5, ST_GeogFromText($6))
       RETURNING id, title, type, date, description, address,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [title, type, date, description, address, `SRID=4326;POINT(${longitude} ${latitude})`]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Insert event error:", err);
    res.status(500).json({ error: "DB insert error" });
  }
});

// Update event
app.put("/events/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  let { title, type, date, description, address, latitude, longitude } = req.body;

  if (address && (!latitude || !longitude)) {
    const geo = await geocodeAddress(address);
    if (geo) {
      latitude = geo.latitude;
      longitude = geo.longitude;
    }
  }

  try {
    const result = await pool.query(
      `UPDATE events
       SET title=$1, type=$2, date=$3, description=$4, address=$5,
           location=ST_GeogFromText($6)
       WHERE id=$7
       RETURNING id, title, type, date, description, address,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [title, type, date, description, address, `SRID=4326;POINT(${longitude} ${latitude})`, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).json({ error: "DB update error" });
  }
});

// Delete event
app.delete("/events/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM events WHERE id=$1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete event error:", err);
    res.status(500).json({ error: "DB delete error" });
  }
});

// Get events
app.get("/events", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, type, date, description, address,
             CASE WHEN location IS NOT NULL THEN ST_Y(location::geometry) ELSE NULL END AS latitude,
             CASE WHEN location IS NOT NULL THEN ST_X(location::geometry) ELSE NULL END AS longitude
      FROM events
      ORDER BY date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).json({ error: "DB fetch error" });
  }
});

app.listen(4000, () => console.log("🚀 Server running on port 4000"));
