import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();

// --- Middlewares ---
app.use(bodyParser.json());
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = [
        "http://localhost:3000",
        "http://192.168.1.190:3000",
        "https://timserck.duckdns.org",
      ];
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// --- Routes ---
// Keep existing CommonJS route modules
// eslint-disable-next-line @typescript-eslint/no-var-requires
const authRoutes = require("./routes/auth.routes");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const collectionsRoutes = require("./routes/collections.routes");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eventsRoutes = require("./routes/events.routes");

app.use("/auth", authRoutes);
app.use("/collections", collectionsRoutes);
app.use("/events", eventsRoutes);

// --- Error handler ---
// Use 'any' for err to keep it simple for now
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: any, req: Request, res: Response, next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error("Server error:", err);
    res.status(500).json({ error: err?.message || "Server error" });
  }
);

// --- Server ---
// Keep container/internal port at 4000 (matches Dockerfile)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✅ Server listening on port ${PORT}`);
});

