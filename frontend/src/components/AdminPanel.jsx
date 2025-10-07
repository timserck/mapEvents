import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { API_URL } from "../config";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { getTypeColor } from "../leaflet";

export default function AdminPanel({ refreshEvents, goToEvent }) {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);

  const fetchAllEvents = async () => {
    const res = await fetch(`${API_URL}/events`);
    const data = await res.json();
    data.sort((a,b)=>(a.position||0)-(b.position||0));
    setEvents(data);
  };

  useEffect(() => { fetchAllEvents(); }, [refreshEvents]);

  const startEditing = (event) => { setEditingEvent(event); /* fill form if needed */ };
  const handleDelete = async (id) => { await fetch(`${API_URL}/events/${id}`, { method:"DELETE", headers:{Authorization:`Bearer ${token}`} }); fetchAllEvents(); refreshEvents(); };
  const deleteAllEvents = async () => { if(!confirm("⚠️ Supprimer tous les événements ?")) return; await fetch(`${API_URL}/events`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}}); fetchAllEvents(); refreshEvents(); };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(events);
    const [moved] = items.splice(result.source.index,1);
    items.splice(result.destination.index,0,moved);
    setEvents(items);
    await fetch(`${API_URL}/events/reorder`,{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({orderedIds:items.map(e=>e.id)})});
    refreshEvents();
  };

  return (
    <div className="w-full h-full bg-gray-50 p-4 shadow flex flex-col overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">📌 Gestion des événements</h2>

      <h3 className="text-lg font-semibold mt-6">📋 Liste des événements</h3>
      <div className="overflow-x-auto min-h-[600px]">
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
