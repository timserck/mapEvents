import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import "../leafletIconFix";
import AdminPanel from "../components/AdminPanel";

// Marqueur numéroté
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

// Icône spéciale pour la position actuelle
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

export default function MapPage({ role, isPanelOpen }) {
  const [events, setEvents] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [userPosition, setUserPosition] = useState(null);
  const mapRef = useRef();
  const isAdmin = role === "admin";

  const fetchEvents = async (newEvent) => {
    if (newEvent) {
      setEvents((prev) => [newEvent, ...prev]);
      if (mapRef.current) {
        mapRef.current.setView([newEvent.latitude, newEvent.longitude], 14);
      }
      return;
    }
    try {
      const res = await fetch("http://localhost:4000/events");
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("Fetch events error:", err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Récupérer la position de l’utilisateur
  const goToCurrentPosition = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPosition([latitude, longitude]);
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 14); // fonctionne maintenant ✅
        }
      },
      (err) => console.error("Erreur géolocalisation:", err),
      { enableHighAccuracy: true }
    );
  };


  const filteredEvents = events.filter(
    (e) =>
      (filterType === "all" || e.type === filterType) &&
      (filterDate === "all" || e.date === filterDate)
  );

  const uniqueTypes = ["all", ...new Set(events.map((e) => e.type))];
  const uniqueDates = ["all", ...new Set(events.map((e) => e.date))];

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Filtres */}
        <div className="p-2 flex gap-2 bg-gray-100">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded p-1"
          >
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border rounded p-1"
          >
            {uniqueDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <button
            onClick={goToCurrentPosition}
            className="bg-blue-500 text-white px-3 py-1 rounded"
          >
            Ma position
          </button>
        </div>

        {/* Carte */}
        <MapContainer
          ref={mapRef}
          center={[48.8566, 2.3522]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => (mapRef.current = map)} // on stocke la vraie instance Leaflet

        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Marqueurs des événements */}
          <MarkerClusterGroup>
            {filteredEvents.map((e, index) => (
              <Marker
                key={e.id}
                position={[e.latitude, e.longitude]}
                icon={createNumberedIcon(index + 1)}
              >
                <Popup>
                  <h3>{e.title}</h3>
                  <p>
                    {e.type} - {formatDate(e.date)}
                  </p>
                  <p>{e.address}</p>
                  <div dangerouslySetInnerHTML={{ __html: e.description }} />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${e.latitude},${e.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Itinéraire Google Maps
                  </a>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {/* Marqueur de la position de l’utilisateur */}
          {userPosition && (
            <Marker position={userPosition} icon={myPositionIcon}>
              <Popup>📍 Vous êtes ici</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {isAdmin && isPanelOpen && <AdminPanel refreshEvents={fetchEvents} />}
    </div>
  );
}
