import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import "../leafletIconFix";
import AdminPanel from "../components/AdminPanel";

// 🔵 Icône personnalisée pour la position de l'utilisateur
const userIcon = new L.Icon({
  iconUrl: "https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

export default function MapPage({ role, isPanelOpen }) {
  const [events, setEvents] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [userPosition, setUserPosition] = useState(null);
  const mapRef = useRef();
  const [mapInstance, setMapInstance] = useState(null);
  const isAdmin = role === "admin";

  // Charger les événements
  const fetchEvents = async (newEvent) => {
    if (newEvent) {
      setEvents((prev) => [newEvent, ...prev]);
      if (mapInstance) {
        mapInstance.setView([newEvent.latitude, newEvent.longitude], 14);
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

  // Récupérer et centrer sur la position de l'utilisateur
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPosition([latitude, longitude]);
        if (mapInstance) {
          mapInstance.setView([latitude, longitude], 14);
        }
      },
      (err) => console.error("Geolocation error:", err)
    );
  }, [mapInstance]);

  const filteredEvents = events.filter(
    (e) =>
      (filterType === "all" || e.type === filterType) &&
      (filterDate === "all" || e.date === filterDate)
  );

  const uniqueTypes = ["all", ...new Set(events.map((e) => e.type))];
  const uniqueDates = ["all", ...new Set(events.map((e) => e.date))];

  const goToCurrentPosition = () => {
    if (mapInstance && userPosition) {
      mapInstance.setView(userPosition, 14);
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Filtres + Bouton Ma position */}
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
                {formatDate(d)}
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
          whenCreated={setMapInstance}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Position de l'utilisateur */}
          {userPosition && (
            <Marker position={userPosition} icon={userIcon}>
              <Popup>📍 Vous êtes ici</Popup>
            </Marker>
          )}

          {/* Marqueurs d'événements */}
          <MarkerClusterGroup>
            {filteredEvents.map((e) => (
              <Marker key={e.id} position={[e.latitude, e.longitude]}>
                <Popup>
                  <h3>{e.title}</h3>
                  <p>
                    {e.type} - {formatDate(e.date)}
                  </p>
                  <p>{e.address}</p>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${e.latitude},${e.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    🚗 Itinéraire Google Maps
                  </a>
                  <div dangerouslySetInnerHTML={{ __html: e.description }} />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {/* Panel Admin si admin et ouvert */}
      {isAdmin && isPanelOpen && <AdminPanel refreshEvents={fetchEvents} />}
    </div>
  );
}
