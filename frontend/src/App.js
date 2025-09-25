import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./Login";
import Admin from "./Admin";
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";

// ChangeMapView pour déplacer la vue
function ChangeMapView({ coords }) {
  const map = useMap();
  if (coords) map.setView(coords, 12);
  return null;
}

// Composant Map avec filtres et markers
function MapWithEvents() {
  const [events, setEvents] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [coords, setCoords] = useState([48.8566, 2.3522]);
  const [bbox, setBbox] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.length > 2) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&addressdetails=1&limit=5`
      );
      const data = await res.json();
      setSuggestions(data);
    } else setSuggestions([]);
  };

  const handleSelectPlace = (place) => {
    const { lat, lon, boundingbox } = place;
    setCoords([parseFloat(lat), parseFloat(lon)]);
    setSearchQuery(place.display_name);
    setSuggestions([]);
    if (boundingbox) {
      setBbox({
        lat_min: parseFloat(boundingbox[0]),
        lat_max: parseFloat(boundingbox[1]),
        lon_min: parseFloat(boundingbox[2]),
        lon_max: parseFloat(boundingbox[3])
      });
    }
  };

  const fetchEvents = async () => {
    let url = "http://localhost:4000/events?";
    if (selectedType) url += `type=${selectedType}&`;
    if (selectedDate) url += `date=${selectedDate}&`;
    if (bbox) url += `lat_min=${bbox.lat_min}&lat_max=${bbox.lat_max}&lon_min=${bbox.lon_min}&lon_max=${bbox.lon_max}&`;
    const res = await fetch(url);
    const data = await res.json();
    setEvents(data);
  };

  useEffect(() => { fetchEvents(); }, [selectedType, selectedDate, bbox]);

  const openStreetView = (lat, lng) => {
    window.open(`https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=17&focus=map`, "_blank");
  };

  return (
    <div className="flex gap-4 p-4">
      {/* Sidebar filtres */}
      <div className="w-1/4 bg-white p-4 shadow rounded-2xl relative">
        <h2 className="text-lg font-bold mb-2">Filtres</h2>
        <label className="block mb-2">
          Type:
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-full p-2 border rounded">
            <option value="">Tous</option>
            <option value="Concert">Concert</option>
            <option value="Exposition">Exposition</option>
            <option value="Festival">Festival</option>
          </select>
        </label>
        <label className="block mb-2">
          Date:
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 border rounded" />
        </label>
        <label className="block mb-2 relative">
          Lieu:
          <input type="text" placeholder="Tapez une adresse ou une ville..." value={searchQuery} onChange={handleInputChange} className="w-full p-2 border rounded" />
          {suggestions.length > 0 && (
            <ul className="absolute bg-white border w-full mt-1 max-h-40 overflow-y-auto rounded shadow z-10">
              {suggestions.map((place, idx) => (
                <li key={idx} onClick={() => handleSelectPlace(place)} className="p-2 cursor-pointer hover:bg-gray-200">{place.display_name}</li>
              ))}
            </ul>
          )}
        </label>
      </div>

      {/* Map */}
      <div className="flex-1 h-[600px]">
        <MapContainer center={coords} zoom={12} style={{ width: "100%", height: "100%" }}>
          <ChangeMapView coords={coords} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {bbox && <Rectangle bounds={[[bbox.lat_min, bbox.lon_min],[bbox.lat_max, bbox.lon_max]]} pathOptions={{ color: "blue", weight: 2 }} />}
          <MarkerClusterGroup>
            {events.map(event => (
              <Marker key={event.id} position={[event.latitude, event.longitude]}>
                <Popup>
                  <h3 className="font-bold">{event.title}</h3>
                  <p>{event.type} - {event.date}</p>
                  <button onClick={() => openStreetView(event.latitude, event.longitude)} className="mt-2 px-2 py-1 bg-blue-500 text-white rounded">
                    Voir en Street View (Mapillary)
                  </button>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}

// Composant principal App
function AppContent() {
  const { token, role } = useAuth();
  if (!token) return <Login />;
  return (
    <div>
      {role === "admin" && <Admin />}
      <MapWithEvents />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
