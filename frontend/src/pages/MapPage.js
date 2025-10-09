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
import L from "leaflet";

// Map center updater
function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center)) map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

// Geolocation button
function GeolocateButton({ setUserPosition, setUserAddress }) {
  const map = useMap();

  const locateUser = () => {
    if (!navigator.geolocation) {
      alert("Votre navigateur ne supporte pas la géolocalisation");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserPosition([latitude, longitude]);
        map.setView([latitude, longitude], 15, { animate: true });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          setUserAddress(data.display_name || null);
        } catch { }
      },
      (err) => {
        alert("Impossible de récupérer votre position : " + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    const controlDiv = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
    controlDiv.style.backgroundColor = "white";
    controlDiv.style.width = "38px";
    controlDiv.style.height = "38px";
    controlDiv.style.display = "flex";
    controlDiv.style.alignItems = "center";
    controlDiv.style.justifyContent = "center";
    controlDiv.style.cursor = "pointer";
    controlDiv.style.borderRadius = "4px";
    controlDiv.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
    controlDiv.title = "Aller à ma position";

    const icon = L.DomUtil.create("img");
    icon.src = "https://cdn.jsdelivr.net/npm/@tabler/icons@2.47.0/icons/location.svg";
    icon.style.width = "20px";
    icon.style.height = "20px";
    controlDiv.appendChild(icon);

    controlDiv.onclick = locateUser;

    const customControl = L.Control.extend({ options: { position: "topright" }, onAdd: () => controlDiv });
    map.addControl(new customControl());
  }, [map]);

  return null;
}

export default function MapPage({ role, isPanelOpen, onCloseAdminPanel }) {
  const [activeCollection, setActiveCollection] = useState(() => {
    return localStorage.getItem("activeCollection") || "";
  });
  const [publicCollection, setPublicCollection] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventImages, setEventImages] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [searchName, setSearchName] = useState("");
  const [userPosition, setUserPosition] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [userHasMovedMap, setUserHasMovedMap] = useState(false);
  const [center, setCenter] = useState([48.8566, 2.3522]);

  const mapRef = useRef();
  const isAdmin = role === "admin";

  // 🧠 Save active collection in localStorage
  useEffect(() => {
    if (activeCollection) {
      localStorage.setItem("activeCollection", activeCollection);
    } else {
      localStorage.removeItem("activeCollection");
    }
  }, [activeCollection]);

  // 🧠 Load public collection from backend
  useEffect(() => {
    const fetchPublicCollection = async () => {
      try {
        const res = await fetch(`${API_URL}/public-collection`);
        const data = await res.json();
        if (data?.name) {
          setPublicCollection(data.name);
          // If user is not admin and has no local selection → use public
          if (!isAdmin && !activeCollection) {
            setActiveCollection(data.name);
          }
        }
      } catch (err) {
        console.error("Erreur lors du chargement de la collection publique :", err);
      }
    };
    fetchPublicCollection();
  }, [isAdmin, activeCollection]);

  // 🧠 Fetch events when activeCollection changes
  useEffect(() => {
    if (!activeCollection) { setEvents([]); return; }
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${API_URL}/events?collection=${encodeURIComponent(activeCollection)}`);
        const data = await res.json();
        data.sort((a, b) => (a.position || 0) - (b.position || 0));
        setEvents(data);
        if (!userHasMovedMap && data.length > 0) setCenter([data[0].latitude, data[0].longitude]);
        fetchImagesForEvents(data);
      } catch (err) {
        console.error("Fetch events error:", err);
      }
    };
    fetchEvents();
  }, [activeCollection]);

  // 🧠 Fetch images for events
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
        } catch { }
      }
      setCache(cacheKey, imageUrl, CACHE_TTL);
      updatedImages[ev.id] = imageUrl;
    }
    setEventImages(prev => ({ ...prev, ...updatedImages }));
  };

  // Track map movement
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const onMove = () => setUserHasMovedMap(true);
    map.on("movestart", onMove);
    return () => map.off("movestart", onMove);
  }, [mapRef.current]);

  // Go to event marker
  const goToEvent = (ev) => {
    if (!mapRef.current) return;
    mapRef.current.setView([ev.latitude, ev.longitude], 15, { animate: true });
  };

  // Filters
  const uniqueTypes = ["all", ...new Set(events.map(e => e.type))];
  const uniqueDates = [
    "all",
    ...Array.from(new Set(events.map(e => formatDate(e.date)))).sort(
      (a, b) => new Date(b) - new Date(a)
    )
  ];

  const filteredEvents = events.filter(
    e =>
      (filterType === "all" || e.type === filterType) &&
      (filterDate === "all" || formatDate(e.date) === filterDate) &&
      e.title.toLowerCase().includes(searchName.toLowerCase())
  );

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Filters */}
        <div className="p-2 bg-gray-100 md:hidden flex flex-col gap-2">
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            className="border rounded p-2 w-full"
          />
          <details>
            <summary className="cursor-pointer select-none">Filtres</summary>
            <div className="mt-2 flex flex-col gap-2">
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="border rounded p-2"
              >
                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="border rounded p-2"
              >
                {uniqueDates.map(d => (
                  <option key={d} value={d}>
                    {d === "all" ? "Toutes les dates" : d}
                  </option>
                ))}
              </select>
            </div>
          </details>
        </div>

        {/* Desktop filters */}
        <div className="hidden md:flex p-2 gap-2 bg-gray-100 items-center">
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            className="border rounded p-2 flex-1"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border rounded p-2"
          >
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="border rounded p-2"
          >
            {uniqueDates.map(d => (
              <option key={d} value={d}>
                {d === "all" ? "Toutes les dates" : d}
              </option>
            ))}
          </select>
        </div>

        {/* Map */}
        <MapContainer
          whenCreated={mapInstance => (mapRef.current = mapInstance)}
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <MapCenterUpdater center={center} />
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <GeolocateButton setUserPosition={setUserPosition} setUserAddress={setUserAddress} />

          <MarkerClusterGroup>
            {filteredEvents.map((e, index) => (
              <Marker
                key={e.id}
                position={[e.latitude, e.longitude]}
                icon={e.type.toLowerCase() === "hotel" ? hotelIcon : createNumberedIcon(e.position || index + 1, e.type)}
              >
                <Popup minWidth={250}>
                  <strong>{(e.position || index + 1)}. {e.title}</strong>
                  <p>{e.type} - {formatDate(e.date)}</p>
                  <p>{e.address}</p>
                  <div className="mt-2" dangerouslySetInnerHTML={{ __html: e.description }} />
                  <LazyImage
                    src={eventImages[e.id] || DEFAULT_IMAGE}
                    alt={e.title}
                    style={{ width: "100%", height: "auto", marginTop: "6px", borderRadius: "6px" }}
                  />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 underline block mt-2"
                  >
                    🚶 Itinéraire
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

      {/* Admin Panel */}
      {isAdmin && isPanelOpen && (
        <div className="fixed inset-0 md:static z-[3000] md:z-auto">
          <div className="absolute inset-0 bg-black/40 md:hidden" onClick={onCloseAdminPanel} />
          <div className="absolute inset-y-0 right-0 w-full bg-white md:bg-transparent md:relative md:h-full flex flex-col">
            <div className="md:hidden flex items-center justify-between p-3 border-b bg-white">
              <h3 className="font-semibold">Panel Admin</h3>
              <button onClick={onCloseAdminPanel} className="text-gray-600">Fermer</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminPanel
                refreshEvents={() => {}}
                goToEvent={goToEvent}
                activeCollection={activeCollection}
                setActiveCollectionOnMap={setActiveCollection}
                publicCollection={publicCollection}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
