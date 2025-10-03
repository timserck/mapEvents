const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const pool = require("./db");
const cors = require("cors");
const fetch = require("node-fetch");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ✅ CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://192.168.1.190:3000",
  "https://timserck.duckdns.org"   // ajoute aussi ton domaine en prod
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // autorise Postman/curl/etc.
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

// ✅ Répondre correctement aux préflight requests (OPTIONS)
app.options("*", cors());
