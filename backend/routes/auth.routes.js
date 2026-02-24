const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const prisma = require("../prismaClient");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { username }
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "5h" }
    );
    res.json({ token, role: user.role });
  } catch (err) { next(err); }
});

module.exports = router;
