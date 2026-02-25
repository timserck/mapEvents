import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "../leafletFix.js";
import { createNumberedIcon, myPositionIcon, hotelIcon } from "../leaflet.js";
import AdminPanel from "../components/AdminPanel";
import MultiSelectDropdown from "../components/MultiSelectDropdown";
import RouteToggleButton from "../components/RouteToggleButton";

import { formatDate } from "../utils.js";
import LazyImage from "../components/LazyImage";
import { DEFAULT_IMAGE, CACHE_TTL, setCache, getCache } from "../cache.js";
import L from "leaflet";
import { apiFetch } from "../apiFetch.js";
import { toast } from "react-toastify";

interface MapPageProps {
  logout: () => void;
  role: string | null;
  token?: string | null;
  isPanelOpen: boolean;
  onCloseAdminPanel: () => void;
}

function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center)) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

function GeolocateButton({
  setUserPosition,
  setUserAddress,
}: {
  setUserPosition: (pos: [number, number]) => void;
  setUserAddress: (addr: string | null) => void;
}) {
  const map = useMap();

  const locateUser = () => {
    if (!navigator.geolocation) {
      toast.error("Votre navigateur ne supporte pas la géolocalisation");
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
        } catch {
          // ignore
        }
      },
      (err) => {
        toast.error("Impossible de récupérer votre position : " + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    const controlDiv = L.DomUtil.create(
      "div",
      "leaflet-bar leaflet-control leaflet-control-custom"
    );
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
    icon.src =
      "https://cdn.jsdelivr.net/npm/@tabler/icons@2.47.0/icons/location.svg";
    icon.style.width = "20px";
    icon.style.height = "20px";
    controlDiv.appendChild(icon);

    controlDiv.onclick = locateUser;

    const customControl = L.Control.extend({
      options: { position: "topright" as L.ControlPosition },
      onAdd: () => controlDiv,
    });
    const instance = new customControl();
    map.addControl(instance);

    return () => {
      map.removeControl(instance);
    };
  }, [map]);

  return null;
}

export default function MapPage({
  logout,
  role,
  isPanelOpen,
  onCloseAdminPanel,
}: MapPageProps) {
  const [activeCollection, setActiveCollection] = useState<string>(
    () => localStorage.getItem("activeCollection") || ""
  );
  const [publicCollection, setPublicCollection] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [eventImages, setEventImages] = useState<Record<number, string>>({});
  const [filterType, setFilterType] = useState<string[]>(["all"]);
  const [filterDate, setFilterDate] = useState<string[]>(["all"]);
  const [searchName, setSearchName] = useState("");
  const [userPosition, setUserPosition] = useState<[number, number] | null>(
    null
  );
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [userHasMovedMap, setUserHasMovedMap] = useState(false);
  const [center, setCenter] = useState<[number, number]>([48.8566, 2.3522]);
  const [collections, setCollections] = useState<string[]>([]);
  const mapRef = useRef<L.Map | null>(null);
  const isAdmin = role === "admin";

  const [showRoute, setShowRoute] = useState(false);
  const [routeData, setRouteData] = useState<any | null>(null);
  const [routeMode, setRouteMode] = useState<"foot" | "driving">("foot");
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const buildRoute = async () => {
    if (!mapRef.current) return;

    try {
      const filteredEvents = events.filter(
        (e) =>
          (filterType.includes("all") || filterType.includes(e.type)) &&
          (filterDate.includes("all") ||
            filterDate.includes(formatDate(e.date))) &&
          e.title.toLowerCase().includes(searchName.toLowerCase())
      );

      const favoriteEvents = filteredEvents
        .filter((e: any) => e.favorite)
        .sort((a: any, b: any) => a.position - b.position);

      if (favoriteEvents.length < 2) {
        toast.warning("Sélectionne au moins 2 événements favoris");
        return;
      }

      const coords = favoriteEvents
        .map((e: any) => `${e.longitude},${e.latitude}`)
        .join(";");

      const osrmUrl = `https://router.project-osrm.org/route/v1/${routeMode}/${coords}?overview=full&geometries=geojson`;

      const response = await fetch(osrmUrl);
      const data = await response.json();

      if (!data.routes?.length) return;

      const latlngs = data.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
      );

      if (routeLayerRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
      }

      routeLayerRef.current = L.polyline(latlngs, {
        color: routeMode === "foot" ? "green" : "blue",
        weight: 5,
        opacity: 0.8,
      }).addTo(mapRef.current);

      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), {
        padding: [40, 40],
      });

      setRouteData({
        mode: routeMode,
        distance: data.routes[0].distance,
        duration: data.routes[0].duration,
      });

      setShowRoute(true);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de recalculer l’itinéraire");
    }
  };

  const toggleRoute = async () => {
    if (!mapRef.current) return;

    if (showRoute) {
      if (routeLayerRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      setShowRoute(false);
      setRouteData(null);
      return;
    }

    await buildRoute();
  };

  const fetchImagesForEvents = async (eventsList: any[]) => {
    const updatedImages: Record<number, string> = {};
    for (const ev of eventsList) {
      const cacheKey = `event_image_${ev.id}`;
      let imageUrl = getCache(cacheKey) || DEFAULT_IMAGE;
      if (imageUrl === DEFAULT_IMAGE) {
        try {
          const query = encodeURIComponent(ev.title);
          const res = await fetch(
            `https://source.unsplash.com/400x300/?${query}`
          );
          if (res.ok && res.url) imageUrl = res.url;
        } catch {
          // ignore
        }
      }
      setCache(cacheKey, imageUrl, CACHE_TTL);
      updatedImages[ev.id] = imageUrl;
    }
    setEventImages((prev) => ({ ...prev, ...updatedImages }));
  };

  const fetchEvents = async () => {
    try {
      const res = await apiFetch(
        `/events?collection=${encodeURIComponent(activeCollection)}`,
        {},
        logout
      );
      const data = ((await res?.json()) || []) as any[];
      data.sort((a, b) => (a.position || 0) - (b.position || 0));
      setEvents(data);
      if (!userHasMovedMap && data.length > 0) {
        setCenter([data[0].latitude, data[0].longitude]);
      }
      fetchImagesForEvents(data);
    } catch (err) {
      console.error("Fetch events error:", err);
    }
  };

  useEffect(() => {
    if (activeCollection)
      localStorage.setItem("activeCollection", activeCollection);
    else localStorage.removeItem("activeCollection");
  }, [activeCollection]);

  useEffect(() => {
    const fetchPublicCollection = async () => {
      try {
        const res = await apiFetch("/collections/active", {}, logout);
        const data = await res?.json();
        if (data?.collection) {
          setPublicCollection(data.collection);
          if (!isAdmin && !activeCollection)
            setActiveCollection(data.collection);
        }
      } catch (err) {
        console.error("Erreur fetch public collection:", err);
      }
    };
    fetchPublicCollection();
  }, [isAdmin, activeCollection, logout]);

  useEffect(() => {
    if (!activeCollection) {
      setEvents([]);
      return;
    }
    fetchEvents();
  }, [activeCollection]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchCollections = async () => {
      try {
        const res = await apiFetch("/collections", {}, logout);
        const data = ((await res?.json()) || []) as string[];
        setCollections(data);
      } catch (err) {
        console.error("Fetch collections error:", err);
      }
    };
    fetchCollections();
  }, [isAdmin, logout]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const onMove = () => setUserHasMovedMap(true);
    map.on("movestart", onMove);
    return () => {
      map.off("movestart", onMove);
    };
  }, [mapRef.current]);

  const goToEvent = (ev: any) => {
    if (!mapRef.current) return;
    mapRef.current.setView([ev.latitude, ev.longitude], 15, { animate: true });
  };

  const uniqueTypes = ["all", ...new Set(events.map((e) => e.type))];
  const uniqueDates = [
    "all",
    ...Array.from(
      new Set(events.map((e) => formatDate(e.date)))
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()),
  ];

  const filteredEvents = events.filter(
    (e) =>
      (filterType.includes("all") || filterType.includes(e.type)) &&
      (filterDate.includes("all") || filterDate.includes(formatDate(e.date))) &&
      e.title.toLowerCase().includes(searchName.toLowerCase())
  );

  const filteredEventsRef = useRef<any[]>(filteredEvents);

  useEffect(() => {
    if (!showRoute) {
      filteredEventsRef.current = filteredEvents;
      return;
    }

    const prevIds = filteredEventsRef.current.map((e) => e.id).join(",");
    const newIds = filteredEvents.map((e) => e.id).join(",");

    if (
      prevIds !== newIds &&
      routeLayerRef.current &&
      mapRef.current
    ) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
      setShowRoute(false);
      setRouteData(null);
    }

    filteredEventsRef.current = filteredEvents;
  }, [filteredEvents, activeCollection, routeMode, showRoute, events]);

  useEffect(() => {
    if (!showRoute) return;
    buildRoute();
  }, [events, routeMode]);

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Filters */}
        <div className="p-2 bg-gray-100 md:hidden flex flex-col gap-2">
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="border rounded p-2 w-full"
          />
          <details>
            <summary className="cursor-pointer select-none">Filtres</summary>
            <div className="mt-2 flex flex-col gap-2">
              <MultiSelectDropdown
                options={uniqueTypes as string[]}
                selected={filterType}
                setSelected={setFilterType}
                label="Type"
              />
              <MultiSelectDropdown
                options={uniqueDates as string[]}
                selected={filterDate}
                setSelected={setFilterDate}
                label="Date"
              />
            </div>
          </details>
        </div>

        <div className="hidden md:flex p-2 gap-2 bg-gray-100 items-center">
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="border rounded p-2 flex-1"
          />
          <MultiSelectDropdown
            options={uniqueTypes as string[]}
            selected={filterType}
            setSelected={setFilterType}
            label="Type"
          />
          <MultiSelectDropdown
            options={uniqueDates as string[]}
            selected={filterDate}
            setSelected={setFilterDate}
            label="Date"
          />
        </div>

        {/* Map */}
        <MapContainer
          whenCreated={(mapInstance) => (mapRef.current = mapInstance)}
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <MapCenterUpdater center={center} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            {...({ attribution: "&copy; OpenStreetMap" } as any)}
          />
          <GeolocateButton
            setUserPosition={setUserPosition}
            setUserAddress={setUserAddress}
          />
          <RouteToggleButton
            toggleRoute={toggleRoute}
            showRoute={showRoute}
            routeMode={routeMode}
            setRouteMode={setRouteMode}
          />

          <MarkerClusterGroup>
            {filteredEvents.map((e, index) => (
              <Marker
                key={e.id}
                position={[e.latitude, e.longitude]}
                icon={
                  e.type.toLowerCase() === "hotel"
                    ? hotelIcon
                    : createNumberedIcon(
                        e.position || index + 1,
                        e.type,
                        e.favorite
                      )
                }
              >
                <Popup minWidth={250}>
                  <strong>
                    {(e.position || index + 1) + ". " + e.title}
                  </strong>
                  <p>
                    {e.type} - {formatDate(e.date)}
                  </p>
                  <p>{e.address}</p>
                  <p dangerouslySetInnerHTML={{ __html: e.description }} />
                  <LazyImage
                    src={eventImages[e.id] || DEFAULT_IMAGE}
                    alt={e.title}
                    className=""
                  />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      e.address
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 underline block mt-2"
                  >
                    🚶 Itinéraire
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      e.address
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 underline block mt-2"
                  >
                    🚶 place
                  </a>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {userPosition && (
            <Marker position={userPosition} icon={myPositionIcon}>
              <Popup>
                📍 Vous êtes ici{" "}
                {userAddress && <div>{userAddress}</div>}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Admin Panel */}
      {isAdmin && isPanelOpen && (
        <div className="fixed inset-0 md:static z-[3000] md:z-auto">
          <div
            className="absolute inset-0 bg-black/40 md:hidden"
            onClick={onCloseAdminPanel}
          />
          <div className="absolute inset-y-0 right-0 w-full bg-white md:bg-transparent md:relative md:h-full flex flex-col">
            <div className="md:hidden flex items-center justify-between p-3 border-b bg-white">
              <h3 className="font-semibold">Panel Admin</h3>
              <button
                onClick={onCloseAdminPanel}
                className="text-gray-600"
              >
                Fermer
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminPanel
                refreshEvents={fetchEvents}
                goToEvent={goToEvent}
                activeCollection={activeCollection}
                setActiveCollectionOnMap={setActiveCollection}
                publicCollection={publicCollection || undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

