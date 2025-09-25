import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("user"); // 'user' ou 'admin'
  const [error, setError] = useState(null);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:4000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role }),
      });
      const data = await res.json();
      if (data.token) {
        login(data.token, role);
      } else {
        setError("Erreur login");
      }
    } catch (err) {
      setError("Erreur réseau");
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Connexion</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input type="text" placeholder="Nom d'utilisateur" value={username} onChange={(e) => setUsername(e.target.value)} className="p-2 border rounded" required />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="p-2 border rounded">
          <option value="user">Utilisateur</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">Se connecter</button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </div>
  );
}
