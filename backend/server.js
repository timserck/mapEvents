require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const pool = require("./db"); // your PostgreSQL pool
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

// --- Auth Routes ---
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

// --- Event Routes ---
app.get("/events", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id,title,type,date,description,address,position,
             CASE WHEN location IS NOT NULL THEN ST_Y(location::geometry) ELSE NULL END AS latitude,
             CASE WHEN location IS NOT NULL THEN ST_X(location::geometry) ELSE NULL END AS longitude
      FROM events ORDER BY position ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).json({ error: "DB fetch error" });
  }
});

app.post("/events", authMiddleware, adminMiddleware, async (req, res) => {
  let { title,type,date,latitude,longitude,description,address,position } = req.body;
  try {
    if (!title||!type||!date||!address) return res.status(400).json({ error: "title,type,date,address required" });
    if (date.includes("T")) date = date.split("T")[0];
    if (!latitude||!longitude) {
      const geo = await geocodeAddress(address);
      if (!geo) return res.status(400).json({ error: "Cannot geocode address" });
      latitude=geo.latitude; longitude=geo.longitude;
    }
    if (!position) {
      const posRes = await pool.query("SELECT COALESCE(MAX(position),0)+1 AS next FROM events");
      position = posRes.rows[0].next;
    }
    const result = await pool.query(
      `INSERT INTO events (title,type,date,description,address,location,position)
       VALUES ($1,$2,$3,$4,$5,ST_GeogFromText($6),$7)
       RETURNING id,title,type,date,description,address,position,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [title,type,date,description,address,`SRID=4326;POINT(${longitude} ${latitude})`,position]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: "DB insert error" }); }
});

app.put("/events/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  let { title,type,date,description,address,latitude,longitude } = req.body;
  try {
    if (!title||!type||!date||!address) return res.status(400).json({ error: "title,type,date,address required" });
    if (date.includes("T")) date = date.split("T")[0];
    if (!latitude||!longitude) {
      const geo = await geocodeAddress(address);
      if (!geo) return res.status(400).json({ error: "Cannot geocode address" });
      latitude=geo.latitude; longitude=geo.longitude;
    }
    const result = await pool.query(
      `UPDATE events SET title=$1,type=$2,date=$3,description=$4,address=$5,location=ST_GeogFromText($6)
       WHERE id=$7
       RETURNING id,title,type,date,description,address,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [title,type,date,description,address,`SRID=4326;POINT(${longitude} ${latitude})`,id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Event not found" });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: "DB update error" }); }
});

app.delete("/events/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try { await pool.query("DELETE FROM events WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: "DB delete error" }); }
});

app.post("/events/bulk", authMiddleware, adminMiddleware, async (req,res)=>{
  const { events } = req.body;
  if(!Array.isArray(events)||!events.length) return res.status(400).json({error:"Events array required"});
  try {
    const inserted=[];
    for(let ev of events){
      let { title,type,date,address,description,latitude,longitude }=ev;
      if(address&&(!latitude||!longitude)){
        const geo=await geocodeAddress(address);
        if(geo){latitude=geo.latitude;longitude=geo.longitude;}
      }
      const result=await pool.query(
        `INSERT INTO events (title,type,date,description,address,location)
         VALUES ($1,$2,$3,$4,$5,ST_GeogFromText($6))
         RETURNING id,title,type,date,description,address,
                   ST_Y(location::geometry) AS latitude,
                   ST_X(location::geometry) AS longitude`,
        [title,type,date,description,address,`SRID=4326;POINT(${longitude} ${latitude})`]
      );
      inserted.push(result.rows[0]);
    }
    res.json(inserted);
  } catch(err){ console.error(err); res.status(500).json({error:"DB bulk insert error"});}
});

// --- Start Server ---
app.listen(4000, "0.0.0.0", ()=>console.log("🚀 Server running on port 4000"));
