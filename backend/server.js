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
const allowedOrigins = [
  "http://localhost:3000",
  "http://192.168.1.190:3000",
  "https://timserck.duckdns.org"   // ajoute aussi ton domaine en prod

];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser clients
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
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

// POST /events - Créer un événement
app.post("/events", authMiddleware, adminMiddleware, async (req, res) => {
  let { title, type, date, latitude, longitude, description, address, position } = req.body;

  try {
    // Validation des champs obligatoires
    if (!title || !type || !date || !address) {
      return res.status(400).json({ error: "title, type, date et address sont requis" });
    }

    // Formater la date pour PostgreSQL (YYYY-MM-DD)
    if (date.includes("T")) date = date.split("T")[0];

    // Géocodage automatique si lat/lon manquants
    if (!latitude || !longitude) {
      const geo = await geocodeAddress(address);
      if (!geo) return res.status(400).json({ error: "Impossible de géocoder l'adresse" });
      latitude = geo.latitude;
      longitude = geo.longitude;
    }

    // Calcul de la position
    if (!position) {
      const posRes = await pool.query("SELECT COALESCE(MAX(position),0)+1 AS next FROM events");
      position = posRes.rows[0].next;
    }

    const result = await pool.query(
      `INSERT INTO events (title, type, date, description, address, location, position)
       VALUES ($1,$2,$3,$4,$5, ST_GeogFromText($6), $7)
       RETURNING id, title, type, date, description, address, position,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [title, type, date, description, address, `SRID=4326;POINT(${longitude} ${latitude})`, position]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Insert event error:", err);
    res.status(500).json({ error: "DB insert error" });
  }
});

// PUT /events/:id - Mettre à jour un événement
app.put("/events/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  let { title, type, date, description, address, latitude, longitude } = req.body;

  try {
    // Validation
    if (!title || !type || !date || !address) {
      return res.status(400).json({ error: "title, type, date et address sont requis" });
    }

    // Formater la date
    if (date.includes("T")) date = date.split("T")[0];

    // Géocodage si lat/lon manquants ou adresse modifiée
    if (!latitude || !longitude) {
      const geo = await geocodeAddress(address);
      if (!geo) return res.status(400).json({ error: "Impossible de géocoder l'adresse" });
      latitude = geo.latitude;
      longitude = geo.longitude;
    }

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

    if (result.rows.length === 0) return res.status(404).json({ error: "Événement non trouvé" });

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
      SELECT
        id,
        title,
        type,
        date,
        description,
        address,
        position,
        CASE WHEN location IS NOT NULL THEN ST_Y(location::geometry) ELSE NULL END AS latitude,
        CASE WHEN location IS NOT NULL THEN ST_X(location::geometry) ELSE NULL END AS longitude
      FROM events
      ORDER BY position ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).json({ error: "DB fetch error" });
  }
});


// Delete all events (admin only)
app.delete("/events", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM events");
    res.json({ success: true, message: "All events deleted" });
  } catch (err) {
    console.error("Delete all events error:", err);
    res.status(500).json({ error: "DB delete all error" });
  }
});


// Bulk insert events (admin only)
app.post("/events/bulk", authMiddleware, adminMiddleware, async (req, res) => {
  const { events } = req.body; // tableau [{title, type, date, address, description, latitude, longitude}]
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: "Events array required" });
  }

  try {
    const insertedEvents = [];

    for (let ev of events) {
      let { title, type, date, address, description, latitude, longitude } = ev;

      // Si seulement l'adresse est fournie → géocoder
      if (address && (!latitude || !longitude)) {
        const geo = await geocodeAddress(address);
        if (geo) {
          latitude = geo.latitude;
          longitude = geo.longitude;
        }
      }

      const result = await pool.query(
        `INSERT INTO events (title, type, date, description, address, location)
         VALUES ($1,$2,$3,$4,$5, ST_GeogFromText($6))
         RETURNING id, title, type, date, description, address,
                   ST_Y(location::geometry) AS latitude,
                   ST_X(location::geometry) AS longitude`,
        [title, type, date, description, address, `SRID=4326;POINT(${longitude} ${latitude})`]
      );

      insertedEvents.push(result.rows[0]);
    }

    res.json(insertedEvents);
  } catch (err) {
    console.error("Bulk insert error:", err);
    res.status(500).json({ error: "DB bulk insert error" });
  }
});




app.patch("/events/reorder", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { orderedIds } = req.body; // tableau d'IDs dans le nouvel ordre
    const queries = orderedIds.map((id, idx) =>
      pool.query("UPDATE events SET order_index = $1 WHERE id = $2", [idx, id])
    );
    await Promise.all(queries);

    const result = await pool.query("SELECT * FROM events ORDER BY order_index ASC");
    res.json({ success: true, events: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors du réordonnancement" });
  }
});




app.listen(4000, () => console.log("🚀 Server running on port 4000"));
