import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { API_URL } from "../config";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { getTypeColor } from "../leafletSetup"; // 🎨 Ajout : pour récupérer la couleur aléatoire du type

export default function AdminPanel({ refreshEvents }) {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [bulkInput, setBulkInput] = useState(`[
    {
      "title": "Concert Rock",
      "type": "Concert",
      "date": "2025-11-01",
      "address": "Lyon, France",
      "description": "Un super concert en plein air"
    },
    {
      "title": "Expo d'art",
      "type": "Exposition",
      "date": "2025-12-15",
      "address": "Marseille, France",
      "description": "Galerie d'art moderne"
    }
  ]`);
  const [error, setError] = useState("");

  // Fetch events
  const fetchAllEvents = async () => {
    const res = await fetch(`${API_URL}/events`);
    const data = await res.json();
    data.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    setEvents(data);
  };

  useEffect(() => {
    fetchAllEvents();
  }, [refreshEvents]);

  // Form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    let finalLat = latitude;
    let finalLon = longitude;

    // Si coords manquantes ou adresse modifiée → géocodage automatique
    if ((!finalLat || !finalLon) || (editingEvent && editingEvent.address !== address)) {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`
        );
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          finalLat = data.features[0].geometry.coordinates[1];
          finalLon = data.features[0].geometry.coordinates[0];
        }
      } catch (err) {
        console.error("Erreur géocodage automatique:", err);
      }
    }

    const url = editingEvent
      ? `${API_URL}/events/${editingEvent.id}`
      : `${API_URL}/events`;
    const method = editingEvent ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        type,
        date: new Date(date).toISOString(),
        description,
        address,
        latitude: finalLat,
        longitude: finalLon,
      }),
    });

    resetForm();
    fetchAllEvents();
    refreshEvents();
  };

  const startEditing = (event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setType(event.type);
    const onlyDate = event.date ? event.date.split("T")[0] : "";
    setDate(onlyDate);
    setDescription(event.description);
    setAddress(event.address);
    setLatitude(event.latitude);
    setLongitude(event.longitude);
  };

  const resetForm = () => {
    setEditingEvent(null);
    setTitle("");
    setType("");
    setDate("");
    setDescription("");
    setAddress("");
    setLatitude(null);
    setLongitude(null);
  };

  // Delete single event
  const handleDelete = async (id) => {
    await fetch(`${API_URL}/events/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchAllEvents();
    refreshEvents();
  };

  // Delete all events
  const deleteAllEvents = async () => {
    if (!window.confirm("⚠️ Êtes-vous sûr de vouloir supprimer TOUS les événements ?")) return;
    await fetch(`${API_URL}/events`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchAllEvents();
    refreshEvents();
  };

  // Bulk upload
  const handleBulkUpload = async () => {
    try {
      const eventsData = JSON.parse(bulkInput);
      const res = await fetch(`${API_URL}/events/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ events: eventsData }),
      });
      if (!res.ok) throw new Error("Bulk upload failed");
      setBulkInput("");
      fetchAllEvents();
      refreshEvents();
      alert(`${eventsData.length} événements ajoutés`);
    } catch (err) {
      setError("Format JSON invalide ou erreur serveur");
    }
  };

  // Photon autocomplete
  const handleAddressChange = async (e) => {
    const value = e.target.value;
    setAddress(value);

    if (value.length > 3) {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5`
        );
        const data = await res.json();
        const formattedSuggestions = data.features.map((f) => ({
          display_name: f.properties.name
            ? f.properties.name + (f.properties.city ? `, ${f.properties.city}` : "")
            : f.properties.street || "",
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
        }));
        setSuggestions(formattedSuggestions);
      } catch (err) {
        console.error("Autocomplete Photon error:", err);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (sugg) => {
    setAddress(sugg.display_name);
    setLatitude(sugg.lat);
    setLongitude(sugg.lon);
    setSuggestions([]);
  };

  // Drag & Drop reorder
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(events);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setEvents(items);
    await fetch(`${API_URL}/events/reorder`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderedIds: items.map((e) => e.id) }),
    });
    refreshEvents();
  };

  return (
    <div className="w-full h-full bg-gray-50 p-4 shadow flex flex-col overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">📌 Gestion des événements</h2>

      {/* Form */}
      {/* --- inchangé --- */}

      {/* Bulk Upload */}
      {/* --- inchangé --- */}

      {/* Events Table with Drag & Drop */}
      <h3 className="text-lg font-semibold mt-6">📋 Liste des événements</h3>
      <div className="overflow-x-auto min-h-[600px]">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="events">
            {(provided) => (
              <table
                className="min-w-[600px] w-full border mt-2 text-sm"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2">#</th>
                    <th className="border p-2">Titre</th>
                    <th className="border p-2">Type</th>
                    <th className="border p-2">Couleur</th> {/* 🎨 ajout */}
                    <th className="border p-2">Date</th>
                    <th className="border p-2">Adresse</th>
                    <th className="border p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, index) => (
                    <Draggable key={e.id} draggableId={e.id.toString()} index={index}>
                      {(provided) => (
                        <tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <td className="border p-2">{index}</td>
                          <td className="border p-2">{e.title}</td>
                          <td className="border p-2">{e.type}</td>

                          {/* 🎨 Cercle de couleur basé sur le type */}
                          <td className="border p-2 text-center">
                            <div
                              style={{
                                backgroundColor: getTypeColor(e.type),
                                width: "22px",
                                height: "22px",
                                borderRadius: "50%",
                                margin: "auto",
                                border: "1px solid #999",
                              }}
                            />
                          </td>

                          <td className="border p-2">
                            {new Date(e.date).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="border p-2">{e.address}</td>
                          <td className="border p-2 flex gap-2">
                            <button
                              onClick={() => startEditing(e)}
                              className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                            >
                              Éditer
                            </button>
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </tbody>
              </table>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Delete All */}
      <div className="w-full p-4">
        <button
          onClick={deleteAllEvents}
          className="bg-red-600 text-white px-4 py-2 mt-2 rounded hover:bg-red-700 w-full transition"
        >
          Supprimer tous les événements
        </button>
      </div>
    </div>
  );
}
