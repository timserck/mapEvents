const express = require("express");
const router = express.Router();
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const { getActiveCollection } = require("../utils/helpers");
const prisma = require("../prismaClient");

// --- GET all collections ---
router.get("/", async (req, res, next) => {
  try {
    const collections = await prisma.collection.findMany({
      orderBy: { name: "asc" }
    });

    res.json(collections.map(c => c.name));
  } catch (err) {
    next(err);
  }
});

// --- POST new collection ---
router.post("/", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { name } = req.body;
    const collection = await prisma.collection.create({
      data: { name }
    });
    res.json(collection);
  } catch (err) {
    // Unique constraint violation
    if (err.code === "P2002" || err?.meta?.target?.includes("name")) {
      return res.status(400).json({ error: "Collection already exists" });
    }
    next(err);
  }
});

// --- DELETE collection ---
router.delete("/:name", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const name = decodeURIComponent(req.params.name);
    await prisma.collection.delete({
      where: { name }
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// --- ACTIVATE collection ---
router.post("/activate", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const collection = req.body.collection || req.body.name;
    if (!collection) return res.status(400).json({ error: "collection required" });
    await prisma.activeCollection.upsert({
      where: { id: 1 },
      update: { collectionName: collection },
      create: { id: 1, collectionName: collection }
    });
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
