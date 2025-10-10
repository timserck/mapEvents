// leafletSetup.js
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 🧠 Dictionnaire interne pour stocker les couleurs aléatoires générées
const typeColorMap = {};

// 🎨 Générer une couleur aléatoire vive
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 80%, 55%)`;
}

// 🎨 Obtenir la couleur pour un type (ou générer si inconnue)
export function getTypeColor(type = "default") {
  const key = type?.toLowerCase() || "default";
  if (!typeColorMap[key]) {
    typeColorMap[key] = getRandomColor();
  }
  return typeColorMap[key];
}

// 🧩 Créer un marker numéroté coloré selon le type
export function createNumberedIcon(number, type = "default") {
  // Si type est "hotel", utiliser l'icône CDN
  if (type.toLowerCase() === "hotel") return hotelIcon;

  const color = getTypeColor(type);

  return L.divIcon({
    html: `
      <div style="
        background-color:${color};
        border-radius:50%;
        width:32px;
        height:32px;
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-weight:bold;
        border:2px solid white;
        box-shadow:0 0 4px rgba(0,0,0,0.4);
      ">
        ${number}
      </div>
    `,
    className: "numbered-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  });
}

export const myPositionIcon = L.icon({
  iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});


// 🏨 Icône hotel depuis CDN
export const hotelIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/139/139899.png",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

// 💡 Exporter le mapping pour réutilisation
export function getAllTypeColors() {
  return { ...typeColorMap };
}
