import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";

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

  useEffect(() => {
    fetch("http://localhost:4000/events")
      .then((res) => res.json())
      .then(setEvents);
  }, [refreshEvents]);

  // Autocomplete for address
  const handleAddressChange = async (e) => {
    const value = e.target.value;
    setAddress(value);
    if (value.length > 3) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5`
      );
      const data = await res.json();
      setSuggestions(data);
    } else setSuggestions([]);
  };

  const handleSelectSuggestion = (sugg) => {
    setAddress(sugg.display_name);
    setSuggestions([]);
  };

  // Prepare form for editing
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
    refreshEvents();
  };

  const handleDelete = async (id) => {
    await fetch(`http://localhost:4000/events/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
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

        {/* Address autocomplete */}
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

      {/* Events Table */}
      <h3 className="text-lg font-semibold mt-6">📋 Liste des événements</h3>
      <table className="w-full border mt-2 text-sm">
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
          {events.map((e) => (
            <tr key={e.id}>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
