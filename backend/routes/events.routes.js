const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const { 
  getActiveCollection,
  validateEventFields,
  ensureLatLng
} = require("../utils/helpers");


// =========================
//        GPT EVENTS
// =========================
router.post("/gpt-events", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { prompt, collection } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const system = "You are a helpful assistant that generates structured event data for travel apps. Output only valid JSON — no text or markdown.";

    const userPrompt = `
Generate a JSON object in this exact format:
{
  "title": "...",
  "type": "...",
  "date": "${new Date().toISOString()}",
  "description": "...",
  "address": "...",
  "latitude": 0,
  "longitude": 0,
  "collection": "${collection || "Default"}"
}

The event is based on this description: "${prompt}".
Fill title, type, description, address and realistic coordinates.
`;

    const models = ["gpt-4.1", "gpt-3.5-turbo"]; // fallback list
    let data = null;
    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.7
          })
        });

        data = await response.json();
        console.log(`[GPT] Model: ${model} | Status: ${response.status}`);
        console.log("Raw OpenAI response:", JSON.stringify(data, null, 2));

        if (!response.ok) {
          lastError = data;
          continue; // try next model
        }

        if (!data.choices || !data.choices.length) {
          lastError = { error: "No choices returned" };
          continue; // try next model
        }

        // Success, stop loop
        break;

      } catch (err) {
        lastError = err;
      }
    }

    if (!data || !data.choices || !data.choices.length) {
      return res.status(500).json({ error: "OpenAI did not return any response", details: lastError });
    }

    const content = data.choices[0].message.content.trim();
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return res.status(500).json({ error: "Invalid JSON from GPT", raw: content });
    }

    res.json(parsed);

  } catch (err) {
    console.error("GPT proxy error:", err);
    next(err);
  }
});

// =========================
//        GET EVENTS
// =========================
router.get("/", async (req, res, next) => {
  try {
    const collection = req.query.collection || await getActiveCollection();
    const { rows } = await pool.query(`
      SELECT e.id, e.title, e.type, e.date, e.description, e.address, e.position, 
             ST_Y(e.location::geometry) AS latitude,
             ST_X(e.location::geometry) AS longitude,
             c.name AS collection
      FROM events e
      JOIN collections c ON e.collection_id = c.id
      WHERE c.name = $1
      ORDER BY e.position ASC
    `, [collection]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// =========================
//        CREATE EVENT
// =========================
router.post("/", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    let { title, type, date, latitude, longitude, description, address, position, collection } = req.body;
    collection ||= "Default";
    date = validateEventFields({ title, type, date, address });
    ({ latitude, longitude } = await ensureLatLng({ address, latitude, longitude }));

    if (!position) {
      const posRes = await pool.query(
        "SELECT COALESCE(MAX(position),0)+1 AS next FROM events WHERE collection_id=(SELECT id FROM collections WHERE name=$1)",
        [collection]
      );
      position = posRes.rows[0].next;
    }

    const result = await pool.query(
      `INSERT INTO events (title,type,date,description,address,location,position,collection_id)
       VALUES ($1,$2,$3,$4,$5,ST_GeogFromText($6),$7,(SELECT id FROM collections WHERE name=$8))
       RETURNING id,title,type,date,description,address,position,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [title, type, date, description, address, `SRID=4326;POINT(${longitude} ${latitude})`, position, collection]
    );
    res.json({ ...result.rows[0], collection });
  } catch (err) {
    next(err);
  }
});

// =========================
//        UPDATE EVENT
// =========================
router.put("/:id", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    let { title, type, date, description, address, latitude, longitude, collection } = req.body;
    collection ||= "Default";
    date = validateEventFields({ title, type, date, address });
    ({ latitude, longitude } = await ensureLatLng({ address, latitude, longitude }));

    const result = await pool.query(
      `UPDATE events
       SET title=$1,type=$2,date=$3,description=$4,address=$5,
           location=ST_GeogFromText($6),
           collection_id=(SELECT id FROM collections WHERE name=$7)
       WHERE id=$8
       RETURNING id,title,type,date,description,address,position,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [title, type, date, description, address, `SRID=4326;POINT(${longitude} ${latitude})`, collection, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Event not found" });
    res.json({ ...result.rows[0], collection });
  } catch (err) {
    next(err);
  }
});

// =========================
//        DELETE EVENT
// =========================
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    await pool.query("DELETE FROM events WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// =========================
//        BULK CREATE
// =========================
router.post("/bulk", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { events, collection } = req.body;
    const collectionName = collection || "Default";
    if (!Array.isArray(events) || !events.length) return res.status(400).json({ error: "Events array required" });

    const inserted = [];
    for (const ev of events) {
      const date = validateEventFields(ev);
      const { latitude, longitude } = await ensureLatLng(ev);
      const result = await pool.query(
        `INSERT INTO events (title,type,date,description,address,location,collection_id)
         VALUES ($1,$2,$3,$4,$5,ST_GeogFromText($6),(SELECT id FROM collections WHERE name=$7))
         RETURNING id,title,type,date,description,address,position,
                   ST_Y(location::geometry) AS latitude,
                   ST_X(location::geometry) AS longitude`,
        [ev.title, ev.type, date, ev.description, ev.address, `SRID=4326;POINT(${longitude} ${latitude})`, collectionName]
      );
      inserted.push({ ...result.rows[0], collection: collectionName });
    }
    res.json(inserted);
  } catch (err) {
    next(err);
  }
});

// =========================
//        REORDER EVENTS
// =========================
router.patch("/reorder", authMiddleware, adminMiddleware, async (req, res, next) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return res.status(400).json({ error: "orderedIds array required" });
  }
  try {
    await pool.query("BEGIN");
    for (let i = 0; i < orderedIds.length; i++) {
      await pool.query("UPDATE events SET position=$1 WHERE id=$2", [i + 1, orderedIds[i]]);
    }
    await pool.query("COMMIT");
    res.json({ success: true, message: "Events reordered successfully" });
  } catch (err) {
    await pool.query("ROLLBACK");
    next(err);
  }
});

// =========================
//     DELETE ALL EVENTS FROM COLLECTION
// =========================
router.delete("/", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { collection } = req.query;
    if (!collection) return res.status(400).json({ error: "collection query required" });
    await pool.query("DELETE FROM events WHERE collection_id=(SELECT id FROM collections WHERE name=$1)", [collection]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
