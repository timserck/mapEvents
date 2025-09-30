import React from "react";
import ReactDOM from "react-dom/client";
import './index.css'; // import Tailwind styles
import App from "./App";
import "leaflet/dist/leaflet.css";
import 'react-quill/dist/quill.snow.css';
import 'react-leaflet-markercluster/dist/styles.min.css';

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
