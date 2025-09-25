import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function Admin() {
  const { token, role } = useAuth();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [message, setMessage] = useState("");

  if (role !== "admin") return <p className="p-4 text-red-500">Accès refusé : admin uniquement</p>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:4000/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ title, type, date, latitude: parseFloat(latitude), longitude: parseFloat(longitude) }),
      });
      const data = await res.json();
      setMessage("Événement ajouté !");
      setTitle(""); setType(""); setDate(""); setLatitude(""); setLongitude("");
    } catch (err) {
      setMessage("Erreur ajout événement");
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Admin - Ajouter un événement</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input type="text" placeholder="Titre" value={title} onChange={e => setTitle(e.target.value)} className="p-2 border rounded" required />
        <input type="text" placeholder="Type" value={type} onChange={e => setType(e.target.value)} className="p-2 border rounded" required />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="p-2 border rounded" required />
        <input type="number" step="0.000001" placeholder="Latitude" value={latitude} onChange={e => setLatitude(e.target.value)} className="p-2 border rounded" required />
        <input type="number" step="0.000001" placeholder="Longitude" value={longitude} onChange={e => setLongitude(e.target.value)} className="p-2 border rounded" required />
        <button type="submit" className="bg-green-500 text-white p-2 rounded">Ajouter</button>
      </form>
      {message && <p className="mt-2">{message}</p>}
    </div>
  );
}
