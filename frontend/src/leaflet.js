// leafletSetup.js
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 🧠 Dictionnaire interne pour stocker les couleurs aléatoires générées
const typeColorMap = {};

// 🎨 Fonction pour générer une couleur aléatoire vive
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 80%, 55%)`;
}

// 🎨 Fonction qui renvoie la couleur d’un type (génère si pas encore connue)
function getTypeColor(type = "default") {
  const key = type?.toLowerCase() || "default";
  if (!typeColorMap[key]) {
    typeColorMap[key] = getRandomColor();
  }
  return typeColorMap[key];
}

// 🧩 Fonction pour créer un marker numéroté et coloré selon le type
export function createNumberedIcon(number, type = "default") {
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

// 📍 Icône pour la position de l’utilisateur
export const myPositionIcon = L.icon({
  iconUrl: "/icons/mylocation.svg",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// 💡 Optionnel : exporter le mapping pour le réutiliser ailleurs (ex: AdminPanel)
export function getAllTypeColors() {
  return { ...typeColorMap };
}
