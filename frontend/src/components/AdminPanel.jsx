import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { API_URL } from "../config";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { getTypeColor } from "../leaflet";

export default function AdminPanel({ refreshEvents, goToEvent }) {
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

  const [bulkJson, setBulkJson] = useState("");
  const [message, setMessage] = useState("");

  const handleBulkImport = async () => {
    try {
      const eventsArray = JSON.parse(bulkJson);
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_URL}/events/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ events: eventsArray })
      });

      if (!res.ok) {
        const err = await res.json();
        setMessage(`❌ Erreur: ${err.error}`);
        return;
      }

      setMessage("✅ Import réussi !");
      setBulkJson("");
      refreshEvents(); // 🔁 Rafraîchir les événements après import
    } catch (err) {
      console.error("Erreur import JSON:", err);
      setMessage("❌ Format JSON invalide");
    }
  };

  // Fetch events
  const fetchAllEvents = async () => {
    const res = await fetch(`${API_URL}/events`);
    const data = await res.json();
    data.sort((a,b)=>(a.position||0)-(b.position||0));
    setEvents(data);
  };

  useEffect(() => { fetchAllEvents(); }, [refreshEvents]);

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
    setTitle(""); setType(""); setDate(""); setDescription(""); setAddress(""); setLatitude(null); setLongitude(null);
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    let finalLat = latitude;
    let finalLon = longitude;

    if ((!finalLat || !finalLon) || (editingEvent && editingEvent.address !== address)) {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          finalLat = data.features[0].geometry.coordinates[1];
          finalLon = data.features[0].geometry.coordinates[0];
        }
      } catch (err) { console.error("Géocodage:", err); }
    }

    const url = editingEvent ? `${API_URL}/events/${editingEvent.id}` : `${API_URL}/events`;
    const method = editingEvent ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify({ title, type, date, description, address, latitude: finalLat, longitude: finalLon })
    });

    resetForm();
    fetchAllEvents();
    refreshEvents();
  };

  // Delete
  const handleDelete = async (id) => {
    await fetch(`${API_URL}/events/${id}`, { method:"DELETE", headers:{Authorization:`Bearer ${token}`} });
    fetchAllEvents();
    refreshEvents();
  };

  const deleteAllEvents = async () => {
    if (!confirm("⚠️ Supprimer tous les événements ?")) return;
    await fetch(`${API_URL}/events`, { method:"DELETE", headers:{Authorization:`Bearer ${token}`} });
    fetchAllEvents();
    refreshEvents();
  };

  // Drag & drop reorder
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(events);
    const [moved] = items.splice(result.source.index,1);
    items.splice(result.destination.index,0,moved);
    setEvents(items);
    await fetch(`${API_URL}/events/reorder`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
      body: JSON.stringify({ orderedIds:items.map(e=>e.id) })
    });
    refreshEvents();
  };

  return (
    <div className="w-full h-full bg-gray-50 p-4 shadow flex flex-col overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">📌 Gestion des événements</h2>

      {/* Formulaire d'édition / création */}
      <form onSubmit={handleSubmit} className="mb-4 p-2 border rounded bg-white">
        <h3 className="font-semibold mb-2">{editingEvent ? "Éditer l'événement" : "Ajouter un événement"}</h3>
        <div className="flex flex-col md:flex-row gap-2">
          <input type="text" placeholder="Titre" value={title} onChange={e=>setTitle(e.target.value)} className="border p-2 flex-1"/>
          <input type="text" placeholder="Type" value={type} onChange={e=>setType(e.target.value)} className="border p-2 flex-1"/>
          <input type="date" placeholder="Date" value={date} onChange={e=>setDate(e.target.value)} className="border p-2 flex-1"/>
        </div>
        <input type="text" placeholder="Adresse" value={address} onChange={e=>setAddress(e.target.value)} className="border p-2 mt-2 w-full"/>
        <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} className="border p-2 mt-2 w-full"/>
        <div className="flex gap-2 mt-2">
          <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">{editingEvent ? "Mettre à jour" : "Ajouter"}</button>
          {editingEvent && <button type="button" onClick={resetForm} className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Annuler</button>}
        </div>
      </form>

      <div className="border p-3 rounded shadow bg-white">
        <h3 className="font-semibold mb-2">📥 Importer des événements en JSON</h3>
        <textarea
          value={bulkJson}
          onChange={e => setBulkJson(e.target.value)}
          placeholder='Exemple: [{"title":"Event 1","type":"concert","date":"2025-10-01","address":"Paris"},{"title":"Event 2","type":"expo","date":"2025-10-02","address":"Lyon"}]'
          className="w-full h-40 p-2 border rounded font-mono text-sm"
        />
        <button
          onClick={handleBulkImport}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Importer
        </button>
        {message && <p className="mt-2 text-sm">{message}</p>}
      </div>

      {/* Events Table */}
      <h3 className="text-lg font-semibold mt-6">📋 Liste des événements</h3>
      <div className="overflow-x-auto min-h-[400px]">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="events">
            {(provided)=>(
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
                  {events.map((e,index)=>(
                    <Draggable key={e.id} draggableId={e.id.toString()} index={index}>
                      {(provided)=>(
                        <tr ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                          <td className="border p-2">{index+1}</td>
                          <td className="border p-2">{e.title}</td>
                          <td className="border p-2">{e.type}</td>
                          <td className="border p-2 text-center">
                            <div style={{backgroundColor:getTypeColor(e.type),width:"22px",height:"22px",borderRadius:"50%",margin:"auto",border:"1px solid #999"}}/>
                          </td>
                          <td className="border p-2">{new Date(e.date).toLocaleDateString("fr-FR")}</td>
                          <td className="border p-2">{e.address}</td>
                          <td className="border p-2 flex gap-2">
                            <button onClick={()=>goToEvent(e)} className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Go To</button>
                            <button onClick={()=>startEditing(e)} className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600">Éditer</button>
                            <button onClick={()=>handleDelete(e.id)} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Supprimer</button>
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

      <div className="w-full p-4">
        <button onClick={deleteAllEvents} className="bg-red-600 text-white px-4 py-2 mt-2 rounded hover:bg-red-700 w-full transition">
          Supprimer tous les événements
        </button>
      </div>
    </div>
  );
}
