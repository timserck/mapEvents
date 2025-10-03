import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import "../leafletIconFix";
import AdminPanel from "../components/AdminPanel";
import LazyImage from "../components/LazyImage";
import { API_URL } from "../config";

// --------------------
// Icônes
// --------------------
const createNumberedIcon = (number) =>
  L.divIcon({
    html: `<div style="
      background:#2563eb;
      color:white;
      border-radius:50%;
      width:28px;
      height:28px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:14px;
      font-weight:bold;
      border:2px solid white;
      box-shadow:0 0 4px rgba(0,0,0,0.3);
    ">${number}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });

const myPositionIcon = L.divIcon({
  html: `<div style="
    background:red;
    border-radius:50%;
    width:20px;
    height:20px;
    border:3px solid white;
    box-shadow:0 0 6px rgba(0,0,0,0.4);
  "></div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// --------------------
// Throttle & batch helpers
// --------------------
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --------------------
// Récupération d’images
// --------------------
const fetchWikimediaImage = async (search) => {
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        search
      )}&format=json&origin=*`
    );
    const searchData = await searchRes.json();
    if (!searchData.query.search.length) return null;

    const pageTitle = searchData.query.search[0].title;
    const pageRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
        pageTitle
      )}&prop=pageimages&format=json&pithumbsize=400&origin=*`
    );
    const pageData = await pageRes.json();
    const pages = Object.values(pageData.query.pages);
    if (pages[0] && pages[0].thumbnail) return pages[0].thumbnail.source;
  } catch (err) {
    console.error("Erreur Wikimedia image:", err);
  }
  return null;
};

const fetchWikidataImageAdvanced = async (title, type, city) => {
  const search = `${title} ${type} ${city}`.toLowerCase();
  const query = `
    SELECT ?image WHERE {
      ?place rdfs:label ?label.
      FILTER(CONTAINS(LCASE(?label), "${search}")).
      ?place wdt:P18 ?image.
    } LIMIT 1
  `;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
  try {
    await delay(500); // 🔹 éviter 429
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results.bindings.length > 0) return data.results.bindings[0].image.value;
  } catch (err) {
    console.error("Erreur Wikidata image avancée:", err);
  }
  return null;
};

const fetchOSMImage = async (search) => {
  const bbox = "36.7,-4.5,36.73,-4.41"; // exemple Málaga
  const query = `[out:json]; node["name"="${search}"](${bbox}); out tags;`;
  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.elements && data.elements[0]?.tags?.image) return data.elements[0].tags.image;
    if (data.elements && data.elements[0]?.tags?.wikimedia_commons)
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${data.elements[0].tags.wikimedia_commons}`;
  } catch (err) { console.error("Erreur OSM image:", err); }
  return null;
};

const unsplashFallbackByType = (type) => `https://source.unsplash.com/400x300/?${encodeURIComponent(type)}`;

const extractCityFromAddress = (address) => {
  if (!address) return "";
  const parts = address.split(",");
  return parts.length >= 2 ? parts[parts.length - 2].trim() : "";
};

const preloadEventImages = async (events, setEventImages, eventImages) => {
  const imageCache = { ...eventImages };
  for (const e of events) {
    if (imageCache[e.id]) continue;
    const city = extractCityFromAddress(e.address);
    const search = `${e.title} ${e.type} ${city}`;
    const img =
      (await fetchWikimediaImage(search)) ||
      (await fetchWikidataImageAdvanced(e.title, e.type, city)) ||
      (await fetchOSMImage(search)) ||
      unsplashFallbackByType(e.type);
    imageCache[e.id] = img;
  }
  setEventImages(imageCache);
  try { localStorage.setItem("eventImages", JSON.stringify(imageCache)); } catch {}
};

// --------------------
// Composant MapPage
// --------------------
export default function MapPage({ role, isPanelOpen, onCloseAdminPanel }) {
  const [events, setEvents] = useState([]);
  const [eventImages, setEventImages] = useState(() => {
    try {
      const stored = localStorage.getItem("eventImages");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [openPopups, setOpenPopups] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [userPosition, setUserPosition] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const mapRef = useRef();
  const isAdmin = role === "admin";

  // Récupérer événements
  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_URL}/events`);
      const data = await res.json();
      setEvents(data);
    } catch (err) { console.error("Fetch events error:", err); }
  };

  useEffect(() => { fetchEvents(); }, []);

  // Préchargement images
  useEffect(() => {
    if (events.length > 0) preloadEventImages(events, setEventImages, eventImages);
  }, [events]);

  // Filtres
  const filteredEvents = events.filter(
    (e) => (filterType === "all" || e.type === filterType) &&
           (filterDate === "all" || e.date === filterDate)
  );

  const uniqueTypes = ["all", ...new Set(events.map(e => e.type))];
  const uniqueDates = ["all", ...new Set(events.map(e => e.date))];

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Position utilisateur
  const goToCurrentPosition = async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserPosition([latitude, longitude]);
          if (mapRef.current) mapRef.current.setView([latitude, longitude], 14);
        },
        async () => console.error("Impossible de géolocaliser"),
        { enableHighAccuracy: true }
      );
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <div className="p-2 bg-gray-100 md:flex md:gap-2">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border rounded p-2">
            {uniqueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="border rounded p-2">
            {uniqueDates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={goToCurrentPosition} className="bg-blue-500 text-white px-3 py-2 rounded">Ma position</button>
        </div>

        <MapContainer ref={mapRef} center={[36.72, -4.42]} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MarkerClusterGroup>
            {filteredEvents.map((e, index) => (
              <Marker key={e.id} position={[e.latitude, e.longitude]} icon={createNumberedIcon(index + 1)}>
                <Popup
                  eventHandlers={{
                    add: () => setOpenPopups((prev) => ({ ...prev, [e.id]: true })),
                    remove: () => setOpenPopups((prev) => ({ ...prev, [e.id]: false })),
                  }}
                >
                  <strong>{index + 1}. {e.title}</strong>
                  <p>{e.type} - {formatDate(e.date)}</p>
                  <p>{e.address}</p>
                  <div dangerouslySetInnerHTML={{ __html: e.description }} />
                  {openPopups[e.id] && eventImages[e.id] && (
                    <LazyImage src={eventImages[e.id]} alt={e.title} className="w-full h-40 my-2" />
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 underline"
                  >
                    🚗 Itinéraire Google Maps
                  </a>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {userPosition && (
            <Marker position={userPosition} icon={myPositionIcon}>
              <Popup>
                📍 Vous êtes ici
                {userAddress && <div>{userAddress}</div>}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {isAdmin && isPanelOpen && (
        <div className="fixed inset-0 md:static z-[3000] md:z-auto">
          <div className="absolute inset-0 bg-black/40 md:hidden" onClick={onCloseAdminPanel} />
          <div className="absolute inset-y-0 right-0 w-full bg-white md:bg-transparent md:relative md:h-full flex flex-col">
            <div className="md:hidden flex items-center justify-between p-3 border-b bg-white">
              <h3 className="font-semibold">Panel Admin</h3>
              <button onClick={onCloseAdminPanel} className="text-gray-600">Fermer</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminPanel refreshEvents={fetchEvents} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
