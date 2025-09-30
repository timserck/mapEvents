import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./leafletIconFix"; // <-- ensures default markers work
import "./index.css";             // <-- Tailwind import
import "leaflet/dist/leaflet.css"; // Leaflet map CSS



const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

