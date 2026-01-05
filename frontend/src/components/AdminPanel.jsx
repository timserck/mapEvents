import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { getTypeColor } from "../leaflet";
// import GptEventGenerator from "../components/GptEventGenerator";
import { apiFetch } from "../apiFetch";
import { toast } from "react-toastify";
import { API_URL } from "../config";
import { Modal } from "./Modal";



export default function AdminPanel({ refreshEvents, goToEvent, setActiveCollectionOnMap }) {
  const { token, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [collections, setCollections] = useState([]);
  const [activeCollection, setActiveCollection] = useState("");

  const [editingEvent, setEditingEvent] = useState(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);

  const [bulkJson, setBulkJson] = useState("");
  const [message, setMessage] = useState("");

  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  // Load saved collection from localStorage or backend
  useEffect(() => {
    const saved = localStorage.getItem("activeCollection");
    if (saved) {
      setActiveCollection(saved);
      setActiveCollectionOnMap(saved);
    } else {
      apiFetch("/collections/active", {}, logout)
        .then(res => res?.json())
        .then(data => {
          if (data?.collection) {
            setActiveCollection(data.collection);
            setActiveCollectionOnMap(data.collection);
          }
        })
        .catch(err => console.error("Erreur fetch active collection:", err));
    }
  }, []);

  useEffect(() => {
    if (activeCollection) {
      localStorage.setItem("activeCollection", activeCollection);
    } else {
      localStorage.removeItem("activeCollection");
    }
      window.location.href = "/mapEvents/";
  }, [activeCollection]);

  // Fetch collections
  const fetchCollections = async () => {
    try {
      const res = await apiFetch("/collections", {}, logout);
      const data = await res?.json();
      setCollections(data || []);
      return data || [];
    } catch (err) {
      console.error("Erreur fetch collections:", err);
      return [];
    }
  };

  useEffect(() => { fetchCollections(); }, []);

  // Fetch events
  const fetchAllEvents = async () => {
    if (!activeCollection) {
      setEvents([]);
      return;
    }
    try {
      const res = await apiFetch(`/events?collection=${encodeURIComponent(activeCollection)}`, {}, logout);
      const data = await res?.json() || [];
      data.sort((a, b) => (a.position || 0) - (b.position || 0));
      setEvents(data);
    } catch (err) {
      console.error("Erreur fetch events:", err);
    }
  };

  useEffect(() => { fetchAllEvents(); }, [activeCollection, refreshEvents]);

  // Create collection
  const createCollection = async (name) => {
    if (!name) return;
    try {
      const res = await apiFetch("/collections", {
        method: "POST",
        body: JSON.stringify({ name })
      }, logout);
      const newCollection = await res?.json();
      setCollections(prev => [...prev, newCollection.name]);
      setActiveCollection(newCollection.name);
      setActiveCollectionOnMap(newCollection.name);
      setEvents([]);
    } catch (err) {
      console.error("Erreur création collection:", err);
    }
  };

  // Delete collection
  const deleteCollection = async (name) => {
    if (!confirm(`Supprimer la collection "${name}" ?`)) return;
    await apiFetch(`/collections/${encodeURIComponent(name)}`, { method: "DELETE" }, logout);
    await fetchCollections();
    setActiveCollection("");
    setActiveCollectionOnMap("");
    localStorage.removeItem("activeCollection");
    setEvents([]);
  };

  // Start editing
  const startEditing = (e) => {
    setEditingEvent(e);
    setTitle(e.title);
    setType(e.type);
    setDate(e.date ? e.date.split("T")[0] : "");
    setDescription(e.description);
    setAddress(e.address);
    setLatitude(e.latitude);
    setLongitude(e.longitude);
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

  // Submit create/edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeCollection) {
      toast.error("Sélectionnez ou créez une collection d'abord.");
      return;
    }

    let finalLat = latitude;
    let finalLon = longitude;

    if ((!finalLat || !finalLon) || (editingEvent && editingEvent.address !== address)) {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`);
        const data = await res.json();
        if (data.features?.length) {
          finalLat = data.features[0].geometry.coordinates[1];
          finalLon = data.features[0].geometry.coordinates[0];
        }
      } catch (err) { console.error("Géocodage:", err); }
    }

    const url = editingEvent ? `/events/${editingEvent.id}` : "/events";
    const method = editingEvent ? "PUT" : "POST";

    await apiFetch(url, {
      method,
      body: JSON.stringify({
        title, type, date, description, address,
        latitude: finalLat, longitude: finalLon,
        position: editingEvent?.position || events.length + 1,
        collection: activeCollection
      }, logout)
    });

    resetForm();
    fetchAllEvents();
    refreshEvents();
  };

  // Delete event
  const handleDelete = async (id) => {
    await apiFetch(`/events/${id}`, { method: "DELETE" }, logout);
    fetchAllEvents();
    refreshEvents();
  };

  // Delete all events
  const deleteAllEvents = async () => {
    if (!confirm(`⚠️ Supprimer tous les événements de la collection "${activeCollection}" ?`)) return;
    await apiFetch(`/events?collection=${encodeURIComponent(activeCollection)}`, { method: "DELETE" }, logout);
    fetchAllEvents();
    refreshEvents();
  };

  // Bulk import
  const handleBulkImport = async () => {
    try {
      const eventsArray = JSON.parse(bulkJson);
      const res = await apiFetch("/events/bulk", {
        method: "POST",
        body: JSON.stringify({ events: eventsArray, collection: activeCollection }, logout)
      });

      if (!res?.ok) {
        const err = await res?.json();
        setMessage(`❌ Erreur: ${err?.error}`);
        return;
      }

      setMessage("✅ Import réussi !");
      setBulkJson("");
      fetchAllEvents();
      refreshEvents();
    } catch (err) {
      console.error("Erreur import JSON:", err);
      setMessage("❌ Format JSON invalide");
    }
  };

  // Drag & drop reorder
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(events);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setEvents(items);

    await apiFetch("/events/reorder", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: items.map(e => e.id), collection: activeCollection },
        logout)
    });

    refreshEvents();
  };

  // --- JSX remains mostly the same ---
  // You just remove repeated `Authorization` headers and replace `fetch` with `apiFetch`
  // I can also refactor the JSX fully if needed
  return (
    <div className="w-full h-full bg-gray-50 p-4 shadow flex flex-col overflow-y-auto">
      {/* ...rest of JSX stays unchanged... */}


      <h2 className="text-xl font-bold mb-4">📌 Gestion des événements</h2>

      {/* Collections */}
      <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
        <select
          value={activeCollection}
          onChange={(e) => {
            setActiveCollection(e.target.value);
            setActiveCollectionOnMap(e.target.value);
          }}
          className="border p-2 rounded flex-1"
        >
          <option value="">-- Sélectionner une collection --</option>
          {collections.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <button
          onClick={() => setIsCreateCollectionOpen(true)}
          className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 w-full sm:w-auto"
        >
          ➕ Nouvelle
        </button>

        <Modal
  isOpen={isCreateCollectionOpen}
  onClose={() => setIsCreateCollectionOpen(false)}
  title="Nouvelle collection"
>
  <input
    type="text"
    value={newCollectionName}
    onChange={(e) => setNewCollectionName(e.target.value)}
    placeholder="Nom de la collection"
    className="w-full border rounded px-3 py-2 mb-4 focus:outline-none focus:ring focus:ring-blue-300"
    autoFocus
  />

  <div className="flex justify-end gap-2">
    <button
      onClick={() => {
        setIsCreateCollectionOpen(false);
        setNewCollectionName("");
      }}
      className="px-4 py-2 rounded border hover:bg-gray-100"
    >
      Annuler
    </button>

    <button
      onClick={() => {
        if (!newCollectionName.trim()) return;
        createCollection(newCollectionName.trim());
        setNewCollectionName("");
        setIsCreateCollectionOpen(false);
      }}
      className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
    >
      Créer
    </button>
  </div>
</Modal>


        {activeCollection && (
          <button
            onClick={() => deleteCollection(activeCollection)}
            className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 w-full sm:w-auto"
          >
            🗑 Supprimer
          </button>
        )}
      </div>


      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-4 p-2 border rounded bg-white">
        <h3 className="font-semibold mb-2">{editingEvent ? "Éditer l'événement" : "Ajouter un événement"}</h3>
        <div className="flex flex-col md:flex-row gap-2">
          <input type="text" placeholder="Titre" value={title} onChange={e => setTitle(e.target.value)} className="border p-2 flex-1" />
          <input type="text" placeholder="Type" value={type} onChange={e => setType(e.target.value)} className="border p-2 flex-1" />
          <input type="date" placeholder="Date" value={date} onChange={e => setDate(e.target.value)} className="border p-2 flex-1" />
        </div>
        <input type="text" placeholder="Adresse" value={address} onChange={e => setAddress(e.target.value)} className="border p-2 mt-2 w-full" />
        <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="border p-2 mt-2 w-full" />
        <div className="flex gap-2 mt-2">
          <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">{editingEvent ? "Mettre à jour" : "Ajouter"}</button>
          {editingEvent && <button type="button" onClick={resetForm} className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Annuler</button>}
        </div>
      </form>

      {/* Bulk import */}
      <div className="border p-3 rounded shadow bg-white">

        <h3 className="font-semibold mb-2">📥 Importer ou générer des événements</h3>

        {/* 🧠 GPT Component */}
        {/* <GptEventGenerator
          activeCollection={activeCollection}
          setBulkJson={setBulkJson}
          setMessage={setMessage}
        /> */}

        <textarea value={bulkJson} onChange={e => setBulkJson(e.target.value)}
          placeholder='[{"title":"Concert de Jazz","type":"Concert","date":"2025-10-16","description":"...","address":"Paris, France"}]'
          className="w-full h-40 p-2 border rounded font-mono text-sm" />
        <button onClick={handleBulkImport} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Importer</button>
        {message && <p className="mt-2 text-sm">{message}</p>}
      </div>

      {/* Events Table */}
      <h3 className="text-lg font-semibold mt-6">📋 Liste des événements</h3>
      <div className="overflow-x-auto min-h-[400px]">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="events">
            {(provided) => (
              <table className="min-w-[600px] w-full border mt-2 text-sm" {...provided.droppableProps} ref={provided.innerRef}>
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2">#</th>
                    <th className="border p-2">Titre</th>
                    <th className="border p-2">Type</th>
                    <th className="border p-2">Couleur</th>
                    <th className="border p-2">Date</th>
                    <th className="border p-2">Adresse</th>
                    <th className="border p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, index) => (
                    <Draggable key={e.id} draggableId={e.id.toString()} index={index}>
                      {(provided) => (
                        <tr ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                          <td className="border p-2">{e.position || index + 1}</td>
                          <td className="border p-2">{e.title}</td>
                          <td className="border p-2">{e.type}</td>
                          <td className="border p-2 text-center">
                            <div style={{ backgroundColor: getTypeColor(e.type), width: "22px", height: "22px", borderRadius: "50%", margin: "auto", border: "1px solid #999" }} />
                          </td>
                          <td className="border p-2">{new Date(e.date).toLocaleDateString("fr-FR")}</td>
                          <td className="border p-2">{e.address}</td>
                          <td className="border p-2 flex gap-2">
                            <button onClick={() => goToEvent(e)} className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Go To</button>
                            <button onClick={() => startEditing(e)} className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600">Éditer</button>
                            <button onClick={() => handleDelete(e.id)} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Supprimer</button>
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

      {/* Set collection active for all users */}
      {activeCollection && token && (
        <button
          onClick={async () => {
            try {
              await fetch(`${API_URL}/collections/activate`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: activeCollection }),
              });
              toast.success(`La collection "${activeCollection}" est maintenant active pour tous les utilisateurs`);
            } catch (err) {
              console.error("Erreur pour définir la collection publique :", err);
            }
          }}
          className="bg-blue-600 text-white px-3 py-1 rounded mt-2 w-full"
        >
          Activer cette collection pour tous
        </button>
      )}

      {/* Delete all events */}
      {activeCollection && (
        <div className="w-full p-4">
          <button onClick={deleteAllEvents} className="bg-red-600 text-white px-4 py-2 mt-2 rounded hover:bg-red-700 w-full transition">
            Supprimer tous les événements de cette collection
          </button>
        </div>
      )}
    </div>
  );
}
