require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const pool = require("./db");
const cors = require("cors");
const fetch = require("node-fetch");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

app.use(bodyParser.json());

// --- CORS ---
const allowedOrigins = [
  "http://localhost:3000",
  "http://192.168.1.190:3000",
  "https://timserck.duckdns.org"
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  optionsSuccessStatus: 200
}));

// --- Auth Middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// --- Helpers ---
async function geocodeAddress(address) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
    const data = await res.json();
    if (data.length) return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
  } catch (err) { console.error("Geocoding error:", err); }
  return null;
}

// =========================
//        AUTH
// =========================
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    if (!result.rows.length) return res.status(401).json({ error: "Invalid credentials" });

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

// =========================
//     COLLECTIONS API
// =========================
// GET all collections
app.get("/collections", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`SELECT name FROM collections ORDER BY name ASC`);
    res.json(result.rows.map(r => r.name));
  } catch (err) {
    console.error("Fetch collections error:", err);
    res.status(500).json({ error: "DB fetch error" });
  }
});

// POST create a new collection
app.post("/collections", authMiddleware, adminMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const result = await pool.query(
      `INSERT INTO collections (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING name`,
      [name]
    );
    if (!result.rows.length) return res.status(400).json({ error: "Collection already exists" });
    res.json({ success: true, name: result.rows[0].name });
  } catch (err) {
    console.error("Create collection error:", err);
    res.status(500).json({ error: "DB insert error" });
  }
});

// DELETE a collection
app.delete("/collections/:name", authMiddleware, adminMiddleware, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  try {
    const result = await pool.query(`DELETE FROM collections WHERE name=$1 RETURNING name`, [name]);
    if (!result.rows.length) return res.status(404).json({ error: "Collection not found" });
    res.json({ success: true, name: result.rows[0].name });
  } catch (err) {
    console.error("Delete collection error:", err);
    res.status(500).json({ error: "DB delete error" });
  }
});

// =========================
//        EVENTS API
// =========================
// GET events (optionally by collection name)
app.get("/events", async (req, res) => {
  try {
    const collectionName = req.query.collection || "Default";

    // Get collection_id
    const collRes = await pool.query(`SELECT id FROM collections WHERE name=$1`, [collectionName]);
    if (!collRes.rows.length) return res.status(404).json({ error: "Collection not found" });
    const collection_id = collRes.rows[0].id;

    const result = await pool.query(`
      SELECT id, title, type, date, description, address, position,
             ST_Y(location::geometry) AS latitude,
             ST_X(location::geometry) AS longitude
      FROM events
      WHERE collection_id=$1
      ORDER BY position ASC
    `, [collection_id]);

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).json({ error: "DB fetch error" });
  }
});

// POST new event
app.post("/events", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    let { title, type, date, address, latitude, longitude, description, position, collection } = req.body;
    if (!collection) collection = "Default";
    if (!title || !type || !date || !address) return res.status(400).json({ error: "title,type,date,address required" });

    // Get collection_id
    const collRes = await pool.query(`SELECT id FROM collections WHERE name=$1`, [collection]);
    if (!collRes.rows.length) return res.status(404).json({ error: "Collection not found" });
    const collection_id = collRes.rows[0].id;

    if (date.includes("T")) date = date.split("T")[0];
    if (!latitude || !longitude) {
      const geo = await geocodeAddress(address);
      if (!geo) return res.status(400).json({ error: "Cannot geocode address" });
      latitude = geo.latitude;
      longitude = geo.longitude;
    }

    if (!position) {
      const posRes = await pool.query("SELECT COALESCE(MAX(position),0)+1 AS next FROM events WHERE collection_id=$1", [collection_id]);
      position = posRes.rows[0].next;
    }

    const result = await pool.query(`
      INSERT INTO events (title, type, date, description, address, location, position, collection_id)
      VALUES ($1,$2,$3,$4,$5,ST_GeogFromText($6),$7,$8)
      RETURNING id, title, type, date, description, address, position,
                ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude
    `, [title, type, date, description, address, `SRID=4326;POINT(${longitude} ${latitude})`, position, collection_id]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Insert event error:", err);
    res.status(500).json({ error: "DB insert error" });
  }
});


// PUT update event
app.put("/events/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let { title, type, date, description, address, latitude, longitude, collection } = req.body;
    if (!collection) collection = "Default";

    // Get collection_id
    const collRes = await pool.query(`SELECT id FROM collections WHERE name=$1`, [collection]);
    if (!collRes.rows.length) return res.status(404).json({ error: "Collection not found" });
    const collection_id = collRes.rows[0].id;

    if (!title || !type || !date || !address) return res.status(400).json({ error: "title,type,date,address required" });
    if (date.includes("T")) date = date.split("T")[0];
    if (!latitude || !longitude) {
      const geo = await geocodeAddress(address);
      if (!geo) return res.status(400).json({ error: "Cannot geocode address" });
      latitude = geo.latitude;
      longitude = geo.longitude;
    }

    const result = await pool.query(`
      UPDATE events
      SET title=$1, type=$2, date=$3, description=$4, address=$5,
          location=ST_GeogFromText($6), collection_id=$7
      WHERE id=$8
      RETURNING id, title, type, date, description, address, position,
                ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude
    `, [title, type, date, description, address, `SRID=4326;POINT(${longitude} ${latitude})`, collection_id, id]);

    if (!result.rows.length) return res.status(404).json({ error: "Event not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).json({ error: "DB update error" });
  }
});


app.delete("/events/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try { await pool.query("DELETE FROM events WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: "DB delete error" }); }
});

app.post("/events/bulk", authMiddleware, adminMiddleware, async (req, res) => {
  const { events, collection } = req.body;
  if (!Array.isArray(events) || !events.length) return res.status(400).json({ error: "Events array required" });

  const collectionName = collection || "Default";

  try {
    // Get collection_id
    const collRes = await pool.query(`SELECT id FROM collections WHERE name=$1`, [collectionName]);
    if (!collRes.rows.length) return res.status(404).json({ error: "Collection not found" });
    const collection_id = collRes.rows[0].id;

    const inserted = [];

    for (let ev of events) {
      let { title, type, date, address, description, latitude, longitude } = ev;
      if (!title || !type || !date || !address) continue; // skip invalid events

      if (date.includes("T")) date = date.split("T")[0];

      if (!latitude || !longitude) {
        const geo = await geocodeAddress(address);
        if (!geo) { console.error("Cannot geocode:", address); continue; }
        latitude = geo.latitude;
        longitude = geo.longitude;
      }

      const result = await pool.query(
        `INSERT INTO events (title, type, date, description, address, location, collection_id)
         VALUES ($1,$2,$3,$4,$5,ST_GeogFromText($6),$7)
         RETURNING id, title, type, date, description, address,
                   ST_Y(location::geometry) AS latitude,
                   ST_X(location::geometry) AS longitude`,
        [title, type, date, description, address, `SRID=4326;POINT(${longitude} ${latitude})`, collection_id]
      );

      inserted.push(result.rows[0]);
    }

    res.json(inserted);
  } catch (err) {
    console.error("Bulk insert error:", err);
    res.status(500).json({ error: "DB bulk insert error" });
  }
});


app.patch("/events/reorder", authMiddleware, adminMiddleware, async (req,res)=>{
  const { orderedIds } = req.body;
  if(!Array.isArray(orderedIds)||!orderedIds.length) return res.status(400).json({error:"orderedIds array required"});
  try {
    await pool.query("BEGIN");
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const position = i + 1;
      await pool.query("UPDATE events SET position=$1 WHERE id=$2", [position, id]);
    }
    await pool.query("COMMIT");
    res.json({ success: true, message: "Events reordered successfully" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Reorder error:", err);
    res.status(500).json({ error: "DB reorder error" });
  }
});

// --- Start Server ---
app.listen(4000, "0.0.0.0", ()=>console.log("🚀 Server running on port 4000 with collections"));
