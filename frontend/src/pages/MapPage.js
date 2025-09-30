// MapPage.jsx
import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import ReactQuill from "react-quill";
import "../leafletIconFix";

// Helper to format date
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR"); // French formatting
};

export default function MapPage({ role, token, isPanelOpen, togglePanel }) {
  const [events, setEvents] = useState([]);
  const [editedEvent, setEditedEvent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");

  const isAdmin = role === "admin";

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch("http://localhost:4000/events");
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("Fetch events error:", err);
    }
  };

  const saveEvent = async (event) => {
    if (!token || !isAdmin) return;
    const method = event.id ? "PUT" : "POST";
    const url = event.id
      ? `http://localhost:4000/events/${event.id}`
      : `http://localhost:4000/events`;

    await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(event),
    });

    setEditedEvent(null);
    fetchEvents();
  };

  const deleteEvent = async (id) => {
    if (!token || !isAdmin) return;
    await fetch(`http://localhost:4000/events/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchEvents();
  };

  const startEditing = (event = null) => {
    if (!isAdmin) return;
    if (event) setEditedEvent({ ...event });
    else
      setEditedEvent({
        title: "",
        type: "",
        date: "",
        latitude: 48.8566,
        longitude: 2.3522,
        description: "",
      });
  };

  // Filter events
  const filteredEvents = events.filter((e) => {
    const typeMatch = filterType === "all" || e.type === filterType;
    const dateMatch = filterDate === "all" || e.date === filterDate;
    return typeMatch && dateMatch;
  });

  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const uniqueTypes = ["all", ...new Set(events.map((e) => e.type))];
  const uniqueDates = ["all", ...new Set(events.map((e) => e.date))];

  return (
    <div className="flex h-screen">
      {/* Map and filters */}
      <div className="flex-1 flex flex-col">
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
                {d === "all" ? "Tous" : formatDate(d)}
              </option>
            ))}
          </select>
        </div>

        <MapContainer
          center={[48.8566, 2.3522]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterGroup>
            {filteredEvents.map((e) => (
              <Marker key={e.id} position={[e.latitude, e.longitude]}>
                <Popup>
                  <h3>{e.title}</h3>
                  <p>
                    {e.type} - {formatDate(e.date)}
                  </p>
                  <div dangerouslySetInnerHTML={{ __html: e.description }} />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {/* Admin Panel */}
      {isAdmin && isPanelOpen && (
        <div className="w-1/3 h-full bg-gray-50 p-4 shadow flex flex-col overflow-y-auto">
          <button
            onClick={() => startEditing()}
            className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
          >
            Ajouter un événement
          </button>

          {/* Table */}
          <table className="min-w-full border border-gray-300 mb-4">
            <thead className="bg-gray-200">
              <tr>
                <th className="border px-2 py-1">Titre</th>
                <th className="border px-2 py-1">Type</th>
                <th className="border px-2 py-1">Date</th>
                <th className="border px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.map((e) => (
                <tr key={e.id}>
                  <td className="border px-2 py-1">{e.title}</td>
                  <td className="border px-2 py-1">{e.type}</td>
                  <td className="border px-2 py-1">{formatDate(e.date)}</td>
                  <td className="border px-2 py-1 flex gap-2 justify-center">
                    <button
                      onClick={() => startEditing(e)}
                      className="bg-yellow-500 text-white px-2 py-1 rounded"
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => deleteEvent(e.id)}
                      className="bg-red-500 text-white px-2 py-1 rounded"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex justify-center gap-2 mb-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>

          {/* Event editor */}
          {editedEvent && (
            <div className="bg-white p-4 shadow rounded flex flex-col">
              <h3>{editedEvent.id ? "Éditer l'événement" : "Nouvel événement"}</h3>
              <input
                type="text"
                value={editedEvent.title}
                onChange={(e) =>
                  setEditedEvent({ ...editedEvent, title: e.target.value })
                }
                placeholder="Titre"
                className="p-2 border rounded mb-2"
              />
              <input
                type="text"
                value={editedEvent.type}
                onChange={(e) =>
                  setEditedEvent({ ...editedEvent, type: e.target.value })
                }
                placeholder="Type"
                className="p-2 border rounded mb-2"
              />
              <input
                type="date"
                value={editedEvent.date}
                onChange={(e) =>
                  setEditedEvent({ ...editedEvent, date: e.target.value })
                }
                className="p-2 border rounded mb-2"
              />
              <ReactQuill
                value={editedEvent.description}
                onChange={(value) =>
                  setEditedEvent({ ...editedEvent, description: value })
                }
                className="mb-2"
              />
              <input
                type="number"
                value={editedEvent.latitude}
                onChange={(e) =>
                  setEditedEvent({
                    ...editedEvent,
                    latitude: parseFloat(e.target.value),
                  })
                }
                placeholder="Latitude"
                className="p-2 border rounded mb-2"
              />
              <input
                type="number"
                value={editedEvent.longitude}
                onChange={(e) =>
                  setEditedEvent({
                    ...editedEvent,
                    longitude: parseFloat(e.target.value),
                  })
                }
                placeholder="Longitude"
                className="p-2 border rounded mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEvent(editedEvent)}
                  className="bg-green-500 text-white px-3 py-1 rounded"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => setEditedEvent(null)}
                  className="bg-gray-400 text-white px-3 py-1 rounded"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
