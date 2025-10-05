import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "../leafletFix.js";
import { createNumberedIcon, myPositionIcon } from "../leaflet.js";
import AdminPanel from "../components/AdminPanel";
import { API_URL } from "../config";
import LazyImage from "../components/LazyImage";
import { formatDate } from "../utils.js";
import { DEFAULT_IMAGE, CACHE_TTL, setCache, getCache } from "../cache.js";

export default function MapPage({ role, isPanelOpen, onCloseAdminPanel }) {
  const [events, setEvents] = useState([]);
  const [eventImages, setEventImages] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [userPosition, setUserPosition] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [userHasMovedMap, setUserHasMovedMap] = useState(false);

  const mapRef = useRef();
  const isAdmin = role === "admin";

  // ---- Wikidata image fetch with retry ----
  const getWikidataImage = async (title, retries = 3, delay = 2000) => {
    const sparqlQuery = `
      SELECT ?image WHERE {
        ?place rdfs:label ?label.
        FILTER(CONTAINS(LCASE(?label), "${title.toLowerCase()}")).
        ?place wdt:P18 ?image.
      } LIMIT 1
    `;
    const url =
      "https://query.wikidata.org/sparql?format=json&query=" +
      encodeURIComponent(sparqlQuery);

    try {
      const wdRes = await fetch(url, {
        headers: { Accept: "application/sparql-results+json" },
      });

      if (wdRes.status === 429 && retries > 0) {
        console.warn(
          `⚠️ Wikidata rate limit reached, retry in ${delay / 1000}s...`
        );
        await new Promise((res) => setTimeout(res, delay));
        return getWikidataImage(title, retries - 1, delay * 2);
      }

      if (wdRes.ok) {
        const json = await wdRes.json();
        const bindings = json?.results?.bindings || [];
        if (bindings.length > 0 && bindings[0].image?.value) {
          return bindings[0].image.value;
        }
      }
    } catch (e) {
      console.error("Wikidata error:", e);
    }

    return null;
  };

  // ---- Fetch events ----
  const fetchEvents = async (newEvent) => {
    if (newEvent) {
      setEvents((prev) => [newEvent, ...prev]);
      if (mapRef.current && !userHasMovedMap) {
        mapRef.current.setView([newEvent.latitude, newEvent.longitude], 14);
      }
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

      if (!userHasMovedMap && data.length > 0 && mapRef.current) {
        mapRef.current.setView([data[0].latitude, data[0].longitude], 14);
      }
    } catch (err) {
      console.error("Fetch events error:", err);
    }
  };

  // ---- Fetch images for events ----
  const fetchImagesForEvents = async (eventsList) => {
    const updatedImages = {};
    for (let ev of eventsList) {
      const cacheKey = `event_image_${ev.id}`;
      let imageUrl = getCache(cacheKey) || DEFAULT_IMAGE;

      // Unsplash fallback
      if (imageUrl === DEFAULT_IMAGE) {
        try {
          const query = encodeURIComponent(ev.title);
          const res = await fetch(
            `https://source.unsplash.com/400x300/?${query}`
          );
          if (res.ok && res.url) imageUrl = res.url;
        } catch {}
      }

      // Wikidata fallback
      if (imageUrl === DEFAULT_IMAGE) {
        const wikidataImg = await getWikidataImage(ev.title);
        if (wikidataImg) imageUrl = wikidataImg;
      }

      setCache(cacheKey, imageUrl, CACHE_TTL);
      updatedImages[ev.id] = imageUrl;
    }
    setEventImages((prev) => ({ ...prev, ...updatedImages }));
  };

  // ---- useEffect: fetch events on mount ----
  useEffect(() => {
    fetchEvents();
  }, []);

  // ---- useEffect: fetch images when events change ----
  useEffect(() => {
    if (events.length > 0) fetchImagesForEvents(events);
  }, [events]);

  // ---- Geolocation ----
  const goToCurrentPosition = async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserPosition([latitude, longitude]);
          if (mapRef.current) mapRef.current.setView([latitude, longitude], 14);
          setUserHasMovedMap(true);
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
      if (mapRef.current)
        mapRef.current.setView([parseFloat(latitude), parseFloat(longitude)], 14);
      setUserHasMovedMap(true);
    } catch (e) {
      console.error("Fallback geo fail:", e);
    }
  };

  // ---- Track map movements to detect user navigation ----
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const onMove = () => setUserHasMovedMap(true);
    map.on("movestart", onMove);
    return () => map.off("movestart", onMove);
  }, [mapRef.current]);

  // ---- Filters ----
  const filteredEvents = events.filter(
    (e) =>
      (filterType === "all" || e.type === filterType) &&
      (filterDate === "all" || e.date === filterDate)
  );

  const uniqueTypes = ["all", ...new Set(events.map((e) => e.type))];
  const uniqueDates = ["all", ...new Set(events.map((e) => e.date))];

  // ---- Map initial center ----
  const initialCenter =
    events.length > 0
      ? [events[0].latitude, events[0].longitude]
      : [48.8566, 2.3522]; // fallback Paris

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Filters */}
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
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={filterDate !== 'null' ? formatDate(filterDate): filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border rounded p-2"
              >
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>
                    {d !== 'null' ? formatDate(d): d}
                  </option>
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
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={formatDate(filterDate)}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border rounded p-2"
          >
            {uniqueDates.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </select>
          <button
            onClick={goToCurrentPosition}
            className="bg-blue-500 text-white px-3 py-2 rounded"
          >
            Ma position
          </button>
        </div>

        {/* Map */}
        <MapContainer
          ref={mapRef}
          center={initialCenter}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
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
                <Popup minWidth={250}>
                  <strong>
                    {index + 1}. {e.title}
                  </strong>
                  <p>
                    {e.type} - {formatDate(e.date)}
                  </p>
                  <p>{e.address}</p>
                  <div
                    className="mt-2"
                    dangerouslySetInnerHTML={{ __html: e.description }}
                  />
                  <LazyImage
                    src={eventImages[e.id] || DEFAULT_IMAGE}
                    alt={e.title}
                    style={{
                      width: "100%",
                      height: "auto",
                      marginTop: "6px",
                      borderRadius: "6px",
                    }}
                  />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      e.address
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 underline block mt-2"
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
                📍 Vous êtes ici {userAddress && <div>{userAddress}</div>}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {isAdmin && isPanelOpen && (
        <div className="fixed inset-0 md:static z-[3000] md:z-auto">
          <div
            className="absolute inset-0 bg-black/40 md:hidden"
            onClick={onCloseAdminPanel}
          />
          <div className="absolute inset-y-0 right-0 w-full bg-white md:bg-transparent md:relative md:h-full flex flex-col">
            <div className="md:hidden flex items-center justify-between p-3 border-b bg-white">
              <h3 className="font-semibold">Panel Admin</h3>
              <button onClick={onCloseAdminPanel} className="text-gray-600">
                Fermer
              </button>
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
