import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "react-leaflet-markercluster/dist/styles.min.css";
import { useState, useEffect } from "react";
import Modal from "react-modal";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

Modal.setAppElement("#root");

function AddMarkerOnClick({ role, setNewEvent, setModalIsOpen }) {
  useMapEvents({
    click(e) {
      if (role === "admin") {
        setNewEvent(prev => ({ ...prev, latitude: e.latlng.lat, longitude: e.latlng.lng }));
        setModalIsOpen(true);
      }
    }
  });
  return null;
}

export default function MapPage({ role, logout }) {
  const [events, setEvents] = useState([]);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    type: "",
    date: "",
    latitude: 48.8566,
    longitude: 2.3522,
    description: ""
  });

  useEffect(() => {
    fetch("http://localhost:4000/events")
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(err => console.error("Fetch error:", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (role !== "admin") return;

    await fetch("http://localhost:4000/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEvent)
    });

    setModalIsOpen(false);
    setNewEvent({ title: "", type: "", date: "", latitude: 48.8566, longitude: 2.3522, description: "" });

    const res = await fetch("http://localhost:4000/events");
    const data = await res.json();
    setEvents(data);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex justify-between items-center bg-gray-100 p-4 shadow">
        <h1 className="text-xl font-bold">Carte des événements</h1>
        <div className="flex items-center gap-4">
          {role === "admin" && (
            <span className="text-sm text-gray-600">Cliquez sur la carte pour ajouter un événement</span>
          )}
          <button
            onClick={logout}
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
          >
            Se déconnecter
          </button>
        </div>
      </header>

      {/* Map */}
      <MapContainer center={[48.8566, 2.3522]} zoom={12} style={{ flex: 1 }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {role === "admin" && (
          <AddMarkerOnClick role={role} setNewEvent={setNewEvent} setModalIsOpen={setModalIsOpen} />
        )}
        <MarkerClusterGroup>
          {events.map((event, i) => (
            <Marker key={i} position={[event.latitude, event.longitude]}>
              <Popup>
                <h3 className="font-bold">{event.title}</h3>
                <p>{event.type} - {event.date}</p>
                <p>{event.description}</p>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Modal */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
        contentLabel="Ajouter un événement"
        className="bg-white p-6 rounded shadow max-w-md mx-auto mt-20"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start"
      >
        <h2 className="text-xl mb-4">Ajouter un événement</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Titre"
            value={newEvent.title}
            onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
            className="p-2 border rounded"
            required
          />
          <input
            type="text"
            placeholder="Type"
            value={newEvent.type}
            onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            type="date"
            value={newEvent.date}
            onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
            className="p-2 border rounded"
            required
          />
          <textarea
            placeholder="Description"
            value={newEvent.description}
            onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
            className="p-2 border rounded"
          />
          <p>Latitude: {newEvent.latitude.toFixed(5)}, Longitude: {newEvent.longitude.toFixed(5)}</p>
          <button type="submit" className="bg-green-500 text-white px-2 py-1 rounded mt-2">Ajouter</button>
        </form>
      </Modal>
    </div>
  );
}
