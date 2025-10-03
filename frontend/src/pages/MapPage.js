import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import "../leafletIconFix";
import AdminPanel from "../components/AdminPanel";
import { API_URL } from "../config";
import LazyImage from "../components/LazyImage";

const DEFAULT_IMAGE = "https://via.placeholder.com/400x300?text=Image+indisponible";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours

// Cache localStorage avec expiration
const setCache = (key, value, ttlMs) => {
  const record = { value, expiry: Date.now() + ttlMs };
  localStorage.setItem(key, JSON.stringify(record));
};

const getCache = (key) => {
  const record = localStorage.getItem(key);
  if (!record) return null;
  try {
    const parsed = JSON.parse(record);
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
};

// Icône numérotée
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

// Icône position utilisateur
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

export default function MapPage({ role, isPanelOpen, onCloseAdminPanel }) {
  const [events, setEvents] = useState([]);
  const [eventImages, setEventImages] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [userPosition, setUserPosition] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const mapRef = useRef();
  const isAdmin = role === "admin";

  // Fetch events
  const fetchEvents = async (newEvent) => {
    if (newEvent) {
      setEvents((prev) => [newEvent, ...prev]);
      if (mapRef.current) mapRef.current.setView([newEvent.latitude, newEvent.longitude], 14);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/events`);
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Expected JSON, got: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("Fetch events error:", err);
    }
  };

  // Fetch images avec cache
  const fetchImagesForEvents = async (eventsList) => {
    const updatedImages = {};
    for (let ev of eventsList) {
      const cacheKey = `event_image_${ev.id}`;
      let imageUrl = getCache(cacheKey);

      if (!imageUrl) {
        imageUrl = DEFAULT_IMAGE;

        // Unsplash
        try {
          const query = encodeURIComponent(ev.title);
          const res = await fetch(`https://source.unsplash.com/400x300/?${query}`);
          if (res.ok && res.url) imageUrl = res.url;
        } catch (e) {
          console.warn("Unsplash fail:", e);
        }

        // Wikidata fallback
        if (imageUrl === DEFAULT_IMAGE) {
          try {
            const sparqlQuery = `
              SELECT ?image WHERE {
                ?place rdfs:label ?label.
                FILTER(CONTAINS(LCASE(?label), "${ev.title.toLowerCase()}")).
                ?place wdt:P18 ?image.
              } LIMIT 1
            `;
            const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparqlQuery);
            const wdRes = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
            if (wdRes.ok) {
              const json = await wdRes.json();
              const bindings = json?.results?.bindings || [];
              if (bindings.length > 0 && bindings[0].image?.value) imageUrl = bindings[0].image.value;
            }
          } catch (err) {
            console.warn("Wikidata fail:", err);
          }
        }

        setCache(cacheKey, imageUrl, CACHE_TTL);
      }

      updatedImages[ev.id] = imageUrl;
    }
    setEventImages((prev) => ({ ...prev, ...updatedImages }));
  };

  useEffect(() => fetchEvents(), []);
  useEffect(() => { if (events.length > 0) fetchImagesForEvents(events); }, [events]);

  // Géolocalisation utilisateur
  const goToCurrentPosition = async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserPosition([latitude, longitude]);
          if (mapRef.current) mapRef.current.setView([latitude, longitude], 14);
        },
        async () => await fallbackGeoAPI(),
        { enableHighAccuracy: true }
      );
    } else {
      await fallbackGeoAPI();
    }
  };

  const fallbackGeoAPI = async () => {
    try {
      const res = await fetch("https://timserck.duckdns.org/geoapi/");
      const data = await res.json();
      const { latitude, longitude, address } = data;
      setUserPosition([parseFloat(latitude), parseFloat(longitude)]);
      setUserAddress(address);
      if (mapRef.current) mapRef.current.setView([parseFloat(latitude), parseFloat(longitude)], 14);
    } catch (e) {
      console.error("Fallback geo fail:", e);
    }
  };

  const filteredEvents = events.filter(
    (e) => (filterType === "all" || e.type === filterType) &&
           (filterDate === "all" || e.date === filterDate)
  );

  const uniqueTypes = ["all", ...new Set(events.map((e) => e.type))];
  const uniqueDates = ["all", ...new Set(events.map((e) => e.date))];

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Filtres */}
        <div className="hidden md:flex p-2 gap-2 bg-gray-100">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border rounded p-2">
            {uniqueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="border rounded p-2">
            {uniqueDates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={goToCurrentPosition} className="bg-blue-500 text-white px-3 py-2 rounded">
            Ma position
          </button>
        </div>

        {/* Carte */}
        <MapContainer ref={mapRef} center={[48.8566, 2.3522]} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MarkerClusterGroup>
            {filteredEvents.map((e, index) => (
              <Marker key={e.id} position={[e.latitude, e.longitude]} icon={createNumberedIcon(index + 1)}>
                <Popup minWidth={250}>
                  <strong>{index + 1}. {e.title}</strong>
                  <p>{e.type} - {formatDate(e.date)}</p>
                  <p>{e.address}</p>
                  <div dangerouslySetInnerHTML={{ __html: e.description }} />
                  <LazyImage src={eventImages[e.id] || DEFAULT_IMAGE} alt={e.title} style={{ width: "100%", height: "auto", marginTop: "6px", borderRadius: "6px" }} />
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.address)}`} target="_blank" rel="noreferrer" className="text-blue-500 underline block mt-2">
                    🚗 Itinéraire Google Maps
                  </a>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {userPosition && (
            <Marker position={userPosition} icon={myPositionIcon}>
              <Popup>📍 Vous êtes ici {userAddress && <div>{userAddress}</div>}</Popup>
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
