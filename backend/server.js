require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();

// --- Middlewares ---
app.use(bodyParser.json());
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      "http://localhost:3000",
      "http://192.168.1.190:3000",
      "https://timserck.duckdns.org"
    ];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

// --- Routes ---
app.use("/auth", require("./routes/auth.routes"));
app.use("/collections", require("./routes/collections.routes"));
app.use("/events", require("./routes/events.routes"));

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message || "Server error" });
});

// --- Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
