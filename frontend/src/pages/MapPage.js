import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import "../leafletIconFix";
import AdminPanel from "../components/AdminPanel";
import { API_URL } from "../config";

// Marqueur numéroté pour événements
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

// Icône pour la position de l’utilisateur
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

  // Fonction pour récupérer une image Wikimedia par titre de lieu
  const fetchWikimediaImage = async (placeName) => {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
          placeName
        )}&prop=pageimages&format=json&origin=*`
      );
      const data = await res.json();
      const pages = Object.values(data.query.pages);
      if (pages[0] && pages[0].thumbnail) return pages[0].thumbnail.source;
    } catch (err) {
      console.error("Erreur Wikimedia image:", err);
    }
    return null;
  };

  // Charger les images après récupération des événements
  useEffect(() => {
    const loadImages = async () => {
      const images = {};
      for (const e of events) {
        const img = await fetchWikimediaImage(e.title);
        if (img) images[e.id] = img;
      }
      setEventImages(images);
    };
    if (events.length) loadImages();
  }, [events]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const goToCurrentPosition = async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserPosition([latitude, longitude]);
          if (mapRef.current) mapRef.current.setView([latitude, longitude], 14);
        },
        async (err) => {
          console.error("Erreur géolocalisation, fallback API:", err);
          await fallbackGeoAPI();
        },
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
      console.error("Impossible d'obtenir la position via l'API DuckDNS:", e);
    }
  };

  const filteredEvents = events.filter(
    (e) =>
      (filterType === "all" || e.type === filterType) &&
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
        <div className="p-2 bg-gray-100 md:hidden">
          <details>
            <summary className="cursor-pointer select-none">Filtres</summary>
            <div className="mt-2 flex flex-col gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border rounded p-2"
              >
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border rounded p-2"
              >
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <button
                onClick={goToCurrentPosition}
                className="bg-blue-500 text-white px-3 py-2 rounded"
              >
                Ma position
              </button>
            </div>
          </details>
        </div>

        <div className="hidden md:flex p-2 gap-2 bg-gray-100">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded p-2"
          >
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border rounded p-2"
          >
            {uniqueDates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <button
            onClick={goToCurrentPosition}
            className="bg-blue-500 text-white px-3 py-2 rounded"
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
          whenCreated={(map) => (mapRef.current = map)}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MarkerClusterGroup>
            {filteredEvents.map((e, index) => (
              <Marker
                key={e.id}
                position={[e.latitude, e.longitude]}
                icon={createNumberedIcon(index + 1)}
              >
                <Popup>
                  <strong>{index + 1}. {e.title}</strong>
                  <p>{e.type} - {formatDate(e.date)}</p>
                  <p>{e.address}</p>
                  <div dangerouslySetInnerHTML={{ __html: e.description }} />

                  {/* Image dynamique Wikimedia */}
                  {eventImages[e.id] && (
                    <div className="my-2">
                      <img
                        src={eventImages[e.id]}
                        alt={e.title}
                        style={{ maxWidth: "200px", maxHeight: "150px", objectFit: "cover" }}
                      />
                    </div>
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
