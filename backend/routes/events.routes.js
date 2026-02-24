const express = require("express");
const router = express.Router();
const pool = require("../db");
const prisma = require("../prismaClient");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const { 
  getActiveCollection,
  validateEventFields,
  ensureLatLng
} = require("../utils/helpers");

/* =========================================================
   GPT EVENTS
========================================================= */
router.post("/gpt-events", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { prompt, collection } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

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
`;

    const response = await fetch("http://localhost:5000/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: userPrompt, max_tokens: 300 })
    });

    const data = await response.json();
    const content = data.completion?.trim();
    if (!content) return res.status(500).json({ error: "No content returned" });

    res.json(JSON.parse(content));
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   GET EVENTS
========================================================= */
router.get("/", async (req, res, next) => {
  try {
    const collection = req.query.collection || await getActiveCollection();

    // Use Prisma for main data fetch, raw SQL only where PostGIS is needed
    const events = await prisma.$queryRaw`
      SELECT
        e.id,
        e.title,
        e.type,
        e.date,
        e.description,
        e.address,
        e.position,
        e.favorite,
        ST_Y(e.location::geometry) AS latitude,
        ST_X(e.location::geometry) AS longitude,
        c.name AS collection
      FROM events e
      JOIN collections c ON e.collection_id = c.id
      WHERE c.name = ${collection}
      ORDER BY e.position ASC
    `;

    res.json(events);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   CREATE EVENT
========================================================= */
router.post("/", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    let {
      title,
      type,
      date,
      latitude,
      longitude,
      description,
      address,
      position,
      collection,
      favorite = false
    } = req.body;

    collection ||= "Default";
    date = validateEventFields({ title, type, date, address });
    ({ latitude, longitude } = await ensureLatLng({ address, latitude, longitude }));

    if (!position) {
      const maxPos = await prisma.event.aggregate({
        _max: { position: true },
        where: {
          collection: {
            name: collection
          }
        }
      });
      position = (maxPos._max.position || 0) + 1;
    }

    const existsRes = await prisma.$queryRaw`
      SELECT 1
      FROM events
      WHERE collection_id = (SELECT id FROM collections WHERE name=${collection})
        AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}),4326),
          0
        )
      LIMIT 1
    `;

    if (Array.isArray(existsRes) && existsRes.length > 0) {
      return res.status(409).json({ error: "Event already exists at this location" });
    }

    const inserted = await prisma.$queryRaw`
      INSERT INTO events
        (title,type,date,description,address,location,position,collection_id,favorite)
      VALUES
        (${title},${type},${date},${description},${address},
         ST_GeogFromText(${`SRID=4326;POINT(${longitude} ${latitude})`}),
         ${position},
         (SELECT id FROM collections WHERE name=${collection}),
         ${favorite})
      RETURNING
        id,title,type,date,description,address,position,favorite,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
    `;

    res.json({ ...inserted[0], collection });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   UPDATE EVENT
========================================================= */
router.put("/:id", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    let {
      title,
      type,
      date,
      description,
      address,
      latitude,
      longitude,
      collection,
      position,
      favorite
    } = req.body;

    collection ||= "Default";
    date = validateEventFields({ title, type, date, address });
    ({ latitude, longitude } = await ensureLatLng({ address, latitude, longitude }));

    const updated = await prisma.$queryRaw`
      UPDATE events
      SET
        title=${title},
        type=${type},
        date=${date},
        description=${description},
        address=${address},
        location=ST_GeogFromText(${`SRID=4326;POINT(${longitude} ${latitude})`}),
        collection_id=(SELECT id FROM collections WHERE name=${collection}),
        position=${position},
        favorite=COALESCE(${favorite},favorite)
      WHERE id=${id}
      RETURNING
        id,title,type,date,description,address,position,favorite,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
    `;

    if (!Array.isArray(updated) || !updated.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ ...updated[0], collection });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   DELETE EVENT
========================================================= */
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    await prisma.event.delete({
      where: { id: Number(req.params.id) }
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   BULK CREATE
========================================================= */
router.post("/bulk", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { events, collection } = req.body;
    const collectionName = collection || "Default";

    if (!Array.isArray(events) || !events.length) {
      return res.status(400).json({ error: "Events array required" });
    }

    const inserted = [];

    for (const ev of events) {
      const date = validateEventFields(ev);
      const { latitude, longitude } = await ensureLatLng(ev);

      const rows = await prisma.$queryRaw`
        INSERT INTO events
          (title,type,date,description,address,location,collection_id,favorite)
        VALUES
          (${ev.title},${ev.type},${date},${ev.description},${ev.address},
           ST_GeogFromText(${`SRID=4326;POINT(${longitude} ${latitude})`}),
           (SELECT id FROM collections WHERE name=${collectionName}),
           FALSE)
        RETURNING
          id,title,type,date,description,address,position,favorite,
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude
      `;

      inserted.push({ ...rows[0], collection: collectionName });
    }

    res.json(inserted);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   REORDER EVENTS
========================================================= */
router.patch("/reorder", authMiddleware, adminMiddleware, async (req, res, next) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return res.status(400).json({ error: "orderedIds array required" });
  }

  try {
    await prisma.$executeRawUnsafe("BEGIN");
    for (let i = 0; i < orderedIds.length; i++) {
      await prisma.event.update({
        where: { id: Number(orderedIds[i]) },
        data: { position: i + 1 }
      });
    }
    await prisma.$executeRawUnsafe("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await prisma.$executeRawUnsafe("ROLLBACK");
    next(err);
  }
});

/* =========================================================
   ROUTE ITINERAIRE
========================================================= */
router.get("/route", async (req, res, next) => {
  try {
    const collection = req.query.collection || await getActiveCollection();
    const mode = req.query.mode || "driving";

    const rows = await prisma.$queryRaw`
      SELECT
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
      FROM events
      WHERE collection_id = (SELECT id FROM collections WHERE name=${collection})
        AND favorite = true
      ORDER BY position ASC
    `;

    if (rows.length < 2) {
      return res.status(400).json({ error: "At least 2 points required" });
    }

    const coords = rows.map(p => `${p.longitude},${p.latitude}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/${mode}/${coords}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    const data = await response.json();

    res.json({
      collection,
      mode,
      distance: data.routes[0].distance,
      duration: data.routes[0].duration,
      geometry: data.routes[0].geometry
    });
  } catch (err) {
    next(err);
  }
});


/* =========================================================
   TOGGLE FAVORITE
========================================================= */
router.patch("/:id/favorite", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    const rows = await prisma.$queryRaw`
      UPDATE events
      SET favorite = NOT favorite
      WHERE id=${id}
      RETURNING id,favorite
    `;

    if (!Array.isArray(rows) || !rows.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
