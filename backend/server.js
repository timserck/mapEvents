import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// GET /events
app.get("/events", async (req, res) => {
  try {
    const { type, date, lat_min, lat_max, lon_min, lon_max } = req.query;
    let query = "SELECT * FROM events WHERE 1=1";
    const params = [];

    if (type) { params.push(type); query += ` AND type = $${params.length}`; }
    if (date) { params.push(date); query += ` AND date = $${params.length}`; }
    if (lat_min && lat_max && lon_min && lon_max) {
      params.push(lat_min, lat_max, lon_min, lon_max);
      query += ` AND latitude BETWEEN $${params.length-3} AND $${params.length-2}`;
      query += ` AND longitude BETWEEN $${params.length-1} AND $${params.length}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

// POST /events
app.post("/events", async (req, res) => {
  try {
    const { title, type, date, latitude, longitude } = req.body;
    const result = await pool.query(
      "INSERT INTO events (title, type, date, latitude, longitude) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [title, type, date, latitude, longitude]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur serveur");
  }
});

app.listen(4000, () => console.log("Backend lancé sur http://localhost:4000"));
