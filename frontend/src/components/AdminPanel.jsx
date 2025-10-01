import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

export default function AdminPanel({ refreshEvents }) {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
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
    const res = await fetch("http://localhost:4000/events");
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
    const url = editingEvent
      ? `http://localhost:4000/events/${editingEvent.id}`
      : "http://localhost:4000/events";
    const method = editingEvent ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, type, date, description, address }),
    });

    resetForm();
    fetchAllEvents();
    refreshEvents();
  };

  const startEditing = (event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setType(event.type);
    setDate(event.date);
    setDescription(event.description);
    setAddress(event.address);
  };

  const resetForm = () => {
    setEditingEvent(null);
    setTitle("");
    setType("");
    setDate("");
    setDescription("");
    setAddress("");
  };

  // Delete single event
  const handleDelete = async (id) => {
    await fetch(`http://localhost:4000/events/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchAllEvents();
    refreshEvents();
  };

  // Delete all events
  const deleteAllEvents = async () => {
    if (!window.confirm("⚠️ Êtes-vous sûr de vouloir supprimer TOUS les événements ?")) return;
    await fetch("http://localhost:4000/events", {
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
      const res = await fetch("http://localhost:4000/events/bulk", {
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
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5`);
        const data = await res.json();
        const formattedSuggestions = data.features.map(f => ({
          display_name: f.properties.name
            ? f.properties.name + (f.properties.city ? `, ${f.properties.city}` : "")
            : f.properties.street || "",
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0]
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
    setSuggestions([]);
  };

  // Drag & Drop reorder
  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(events);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);

    setEvents(items);

    await fetch("http://localhost:4000/events/reorder", {
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
    <div className="w-1/3 h-full bg-gray-50 p-4 shadow flex flex-col overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">📌 Gestion des événements</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3 bg-white p-4 rounded shadow">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          className="w-full border p-2 rounded"
          required
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full border p-2 rounded"
          required
        >
          <option value="">-- Type --</option>
          <option value="Concert">Concert</option>
          <option value="Festival">Festival</option>
          <option value="Conference">Conférence</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="w-full border p-2 rounded"
        />
        <div className="relative">
          <input
            value={address}
            onChange={handleAddressChange}
            placeholder="Adresse"
            className="w-full border p-2 rounded"
            required
          />
          {suggestions.length > 0 && (
            <ul className="absolute bg-white border rounded w-full max-h-40 overflow-y-auto shadow">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onClick={() => handleSelectSuggestion(s)}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                >
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600"
          >
            {editingEvent ? "💾 Enregistrer" : "➕ Ajouter"}
          </button>
          {editingEvent && (
            <button
              type="button"
              onClick={resetForm}
              className="w-full bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
            >
              ✖ Annuler
            </button>
          )}
        </div>
      </form>

      {/* Bulk Upload */}
      <div className="w-full bg-white p-4 rounded shadow mt-4">
        <h2 className="text-lg font-bold mb-2">Ajouter plusieurs événements</h2>
        <textarea
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
          placeholder='[{"title":"Concert","type":"Music","date":"2025-10-01","address":"Paris","description":"..."}]'
          className="w-full h-40 border rounded p-2"
        />
        <button
          onClick={handleBulkUpload}
          className="bg-green-500 text-white px-4 py-2 mt-2 rounded hover:bg-green-600 transition"
        >
          Importer
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>

      {/* Events Table with Drag & Drop */}
      <h3 className="text-lg font-semibold mt-6">📋 Liste des événements</h3>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="events">
          {(provided) => (
            <table
              className="w-full border mt-2 text-sm"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2">Titre</th>
                  <th className="border p-2">Type</th>
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
                        <td className="border p-2">{e.title}</td>
                        <td className="border p-2">{e.type}</td>
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
