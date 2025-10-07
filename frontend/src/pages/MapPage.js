import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "../leafletFix.js";
import { createNumberedIcon, myPositionIcon, hotelIcon } from "../leaflet.js";
import AdminPanel from "../components/AdminPanel";
import { API_URL } from "../config";
import LazyImage from "../components/LazyImage";
import { formatDate } from "../utils.js";
import { DEFAULT_IMAGE, CACHE_TTL, setCache, getCache } from "../cache.js";

// Recenter map when center changes
function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center)) map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function MapPage({ role, isPanelOpen, onCloseAdminPanel }) {
  const [events, setEvents] = useState([]);
  const [eventImages, setEventImages] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [userPosition, setUserPosition] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [userHasMovedMap, setUserHasMovedMap] = useState(false);
  const [center, setCenter] = useState([48.8566, 2.3522]);

  const mapRef = useRef();
  const isAdmin = role === "admin";

  // Fetch events
  const fetchEvents = async (newEvent) => {
    if (newEvent) {
      setEvents(prev => [newEvent, ...prev]);
      if (!userHasMovedMap) setCenter([newEvent.latitude, newEvent.longitude]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/events`);
      const data = await res.json();
      setEvents(data);
      if (!userHasMovedMap && data.length > 0) setCenter([data[0].latitude, data[0].longitude]);
    } catch (err) {
      console.error("Fetch events error:", err);
    }
  };

  // Fetch images
  const fetchImagesForEvents = async (eventsList) => {
    const updatedImages = {};
    for (let ev of eventsList) {
      const cacheKey = `event_image_${ev.id}`;
      let imageUrl = getCache(cacheKey) || DEFAULT_IMAGE;
      if (imageUrl === DEFAULT_IMAGE) {
        try {
          const query = encodeURIComponent(ev.title);
          const res = await fetch(`https://source.unsplash.com/400x300/?${query}`);
          if (res.ok && res.url) imageUrl = res.url;
        } catch {}
      }
      setCache(cacheKey, imageUrl, CACHE_TTL);
      updatedImages[ev.id] = imageUrl;
    }
    setEventImages(prev => ({ ...prev, ...updatedImages }));
  };

  useEffect(() => { fetchEvents(); }, []);
  useEffect(() => { if (events.length > 0) fetchImagesForEvents(events); }, [events]);

  // Track map movements
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const onMove = () => setUserHasMovedMap(true);
    map.on("movestart", onMove);
    return () => map.off("movestart", onMove);
  }, [mapRef.current]);

  // Filters
  const filteredEvents = events.filter(
    e => (filterType === "all" || e.type === filterType) &&
         (filterDate === "all" || e.date === filterDate)
  );
  const uniqueTypes = ["all", ...new Set(events.map(e => e.type))];
  const uniqueDates = ["all", ...new Set(events.map(e => e.date))];

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Filters */}
        <div className="p-2 bg-gray-100 md:hidden">
          <details>
            <summary className="cursor-pointer select-none">Filtres</summary>
            <div className="mt-2 flex flex-col gap-2">
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded p-2">
                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border rounded p-2">
                {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </details>
        </div>

        <div className="hidden md:flex p-2 gap-2 bg-gray-100">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded p-2">
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border rounded p-2">
            {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* MAP */}
        <MapContainer ref={mapRef} center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
          <MapCenterUpdater center={center} />
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <MarkerClusterGroup>
            {filteredEvents.map((e, index) => (
              <Marker
                key={e.id}
                position={[e.latitude, e.longitude]}
                icon={e.type.toLowerCase() === "hotel" ? hotelIcon : createNumberedIcon(index + 1, e.type)}
              >
                <Popup minWidth={250}>
                  <strong>{index + 1}. {e.title}</strong>
                  <p>{e.type} - {formatDate(e.date)}</p>
                  <p>{e.address}</p>
                  <div className="mt-2" dangerouslySetInnerHTML={{ __html: e.description }} />
                  <LazyImage src={eventImages[e.id] || DEFAULT_IMAGE} alt={e.title} style={{ width: "100%", height: "auto", marginTop: "6px", borderRadius: "6px" }} />
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.address)}`} target="_blank" rel="noreferrer" className="text-blue-500 underline block mt-2">🚶 Itinéraire</a>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {userPosition && <Marker position={userPosition} icon={myPositionIcon}><Popup>📍 Vous êtes ici {userAddress && <div>{userAddress}</div>}</Popup></Marker>}
        </MapContainer>
      </div>

      {/* Admin panel */}
      {isAdmin && isPanelOpen && (
        <div className="fixed inset-0 md:static z-[3000] md:z-auto">
          <div className="absolute inset-0 bg-black/40 md:hidden" onClick={onCloseAdminPanel} />
          <div className="absolute inset-y-0 right-0 w-full bg-white md:bg-transparent md:relative md:h-full flex flex-col">
            <div className="md:hidden flex items-center justify-between p-3 border-b bg-white">
              <h3 className="font-semibold">Panel Admin</h3>
              <button onClick={onCloseAdminPanel} className="text-gray-600">Fermer</button>
            </div>
            <div className="flex-1 overflow-y-auto"><AdminPanel refreshEvents={fetchEvents} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
