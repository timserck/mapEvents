// components/Navbar.jsx
import React, { useState } from "react";
import { useAuth } from "../AuthContext";

export default function Navbar({ togglePanel }) {
  const { token, role, login, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Call the login function from AuthContext
      await login(username, password);
      setUsername("");
      setPassword("");
      setError("");
    } catch (err) {
      setError(err.message); // display backend error
    }
  };

  return (
    <nav className="bg-gray-800 text-white flex flex-col md:flex-row items-center justify-between px-6 py-3 shadow-md gap-2">
      <div className="text-xl font-bold">Carte des événements</div>

      <div className="flex items-center gap-4">
        {/* Admin panel toggle button */}
        {token && role === "admin" && (
          <button
            onClick={togglePanel}
            className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Panel Admin
          </button>
        )}

        {/* Login form */}
        {!token ? (
          <form
            onSubmit={handleLogin}
            className="flex flex-col md:flex-row gap-2 items-center"
          >
            <input
              type="text"
              placeholder="Nom d'utilisateur"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="p-2 rounded border w-full md:w-auto text-black"
              required
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-2 rounded border w-full md:w-auto text-black"
              required
            />
            <button
              type="submit"
              className="bg-green-500 px-4 py-2 rounded hover:bg-green-600 transition"
            >
              Se connecter
            </button>
            {error && <span className="text-red-500">{error}</span>}
          </form>
        ) : (
          <>
            <span>Rôle : {role}</span>
            <button
              onClick={logout}
              className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 transition"
            >
              Déconnexion
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
