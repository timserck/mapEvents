import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "../leafletFix.js";
import { createNumberedIcon, myPositionIcon } from "../leaflet.js";
import AdminPanel from "../components/AdminPanel";
import { API_URL } from "../config";
import LazyImage from "../components/LazyImage";
import { formatDate } from "../utils.js";
import { DEFAULT_IMAGE, CACHE_TTL, setCache, getCache } from "../cache.js";
import L from "leaflet";

function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center)) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function MapPage({ role, isPanelOpen, onCloseAdminPanel }) {
  const [events, setEvents] = useState([]);
  const [eventImages, setEventImages] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [userPosition, setUserPosition] = useState(null);
  const [center, setCenter] = useState([48.8566, 2.3522]);
  const [userHasMovedMap, setUserHasMovedMap] = useState(false);
  const mapRef = useRef();
  const isAdmin = role === "admin";

  // === Fetch events ===
  const fetchEvents = async (newEvent) => {
    if (newEvent) {
      setEvents((prev) => [newEvent, ...prev]);
      if (!userHasMovedMap) setCenter([newEvent.latitude, newEvent.longitude]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/events`);
      const data = await res.json();
      setEvents(data);
      if (!userHasMovedMap && data.length > 0)
        setCenter([data[0].latitude, data[0].longitude]);
    } catch (err) {
      console.error("Erreur fetch events:", err);
    }
  };

  // === Fetch images ===
  const fetchImagesForEvents = async (eventsList) => {
    const updated = {};
    for (let e of eventsList) {
      const cacheKey = `event_image_${e.id}`;
      let img = getCache(cacheKey) || DEFAULT_IMAGE;
      if (img === DEFAULT_IMAGE) {
        try {
          const res = await fetch(`https://source.unsplash.com/400x300/?${encodeURIComponent(e.title)}`);
          if (res.ok && res.url) img = res.url;
        } catch {}
      }
      setCache(cacheKey, img, CACHE_TTL);
      updated[e.id] = img;
    }
    setEventImages((p) => ({ ...p, ...updated }));
  };

  useEffect(() => { fetchEvents(); }, []);
  useEffect(() => { if (events.length > 0) fetchImagesForEvents(events); }, [events]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const moveHandler = () => setUserHasMovedMap(true);
    map.on("movestart", moveHandler);
    return () => map.off("movestart", moveHandler);
  }, [mapRef.current]);

  const uniqueTypes = ["all", ...new Set(events.map((e) => e.type))];
  const uniqueDates = ["all", ...new Set(events.map((e) => e.date))];

  const filteredEvents = events.filter(
    (e) =>
      (filterType === "all" || e.type === filterType) &&
      (filterDate === "all" || e.date === filterDate)
  );

  // === Go To Event ===
  const goToEvent = (lat, lon, title) => {
    if (!mapRef.current || !lat || !lon) return;
    mapRef.current.setView([lat, lon], 15, { animate: true });
    const popup = L.popup()
      .setLatLng([lat, lon])
      .setContent(`<b>${title}</b>`)
      .openOn(mapRef.current);
    setTimeout(() => mapRef.current.closePopup(popup), 3000);
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Filtres */}
        <div className="p-2 bg-gray-100 flex gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded p-2"
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
            className="border rounded p-2"
          >
            {uniqueDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* MAP */}
        <MapContainer
          ref={mapRef}
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => (mapRef.current = map)}
        >
          <MapCenterUpdater center={center} />
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MarkerClusterGroup>
            {filteredEvents.map((e, i) => (
              <Marker
                key={e.id}
                position={[e.latitude, e.longitude]}
                icon={createNumberedIcon(i + 1, e.type)}
              >
                <Popup minWidth={250}>
                  <strong>{i + 1}. {e.title}</strong>
                  <p>{e.type} - {formatDate(e.date)}</p>
                  <p>{e.address}</p>
                  <div dangerouslySetInnerHTML={{ __html: e.description }} />
                  <LazyImage
                    src={eventImages[e.id] || DEFAULT_IMAGE}
                    alt={e.title}
                    style={{ width: "100%", borderRadius: "6px", marginTop: "4px" }}
                  />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {userPosition && (
            <Marker position={userPosition} icon={myPositionIcon}>
              <Popup>📍 Vous êtes ici</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {isAdmin && isPanelOpen && (
        <div className="fixed inset-0 md:static z-[3000] md:z-auto">
          <div className="absolute inset-0 bg-black/40 md:hidden" onClick={onCloseAdminPanel} />
          <div className="absolute inset-y-0 right-0 w-full md:w-[420px] bg-white flex flex-col">
            <div className="md:hidden flex items-center justify-between p-3 border-b">
              <h3 className="font-semibold">Panel Admin</h3>
              <button onClick={onCloseAdminPanel}>Fermer</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminPanel refreshEvents={fetchEvents} goToEvent={goToEvent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
