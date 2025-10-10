const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    if (!result.rows.length) return res.status(401).json({ error: "Invalid credentials" });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "5h" });
    res.json({ token, role: user.role });
  } catch (err) { next(err); }
});

module.exports = router;
