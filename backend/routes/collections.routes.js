const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const { getActiveCollection } = require("../utils/helpers");

// --- GET all collections ---
router.get("/", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT c.name AS collection
      FROM events e
      JOIN collections c ON e.collection_id = c.id
      ORDER BY c.name ASC
    `);
    res.json(rows.map(r => r.collection));
  } catch (err) { next(err); }
});

// --- POST new collection ---
router.post("/", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      `INSERT INTO collections (name) VALUES ($1) RETURNING *`,
      [name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Collection already exists" });
    next(err);
  }
});

// --- DELETE collection ---
router.delete("/:name", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const name = decodeURIComponent(req.params.name);
    await pool.query("DELETE FROM events WHERE collection_id = (SELECT id FROM collections WHERE name=$1)", [name]);
    await pool.query("DELETE FROM collections WHERE name=$1", [name]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- ACTIVATE collection ---
router.post("/activate", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const collection = req.body.collection || req.body.name;
    if (!collection) return res.status(400).json({ error: "collection required" });
    await pool.query(`
      INSERT INTO active_collection (id, collection_name)
      VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET collection_name = EXCLUDED.collection_name
    `, [collection]);
    res.json({ success: true, activeCollection: collection });
  } catch (err) { next(err); }
});

// --- GET active collection ---
router.get("/active", async (req, res, next) => {
  try {
    res.json({ activeCollection: await getActiveCollection() });
  } catch (err) { next(err); }
});

module.exports = router;
