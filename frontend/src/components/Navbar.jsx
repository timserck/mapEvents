// components/Navbar.jsx
import React, { useState } from "react";
import { useAuth } from "../AuthContext";

export default function Navbar({ togglePanel }) {
  const { token, role, login, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    <nav className="bg-gray-800 text-white relative z-[3000] flex items-center justify-between px-4 md:px-6 py-3 shadow-md gap-2">
      <div className="text-xl font-bold mr-2 md:mr-4 truncate max-w-[50%] md:max-w-[40%] min-w-0">Map of events</div>

      {/* Desktop/Tablet controls */}
      <div className="hidden md:flex items-center gap-2 md:gap-3 flex-nowrap min-w-0 flex-1 justify-end">
        {/* Admin panel toggle button */}
        {token && role === "admin" && (
          <button
            onClick={togglePanel}
            className="bg-blue-500 px-2 md:px-3 py-2 rounded hover:bg-blue-600 transition"
          >
            Panel Admin
          </button>
        )}

        {/* Login form */}
        {!token ? (
          <form
            onSubmit={handleLogin}
            className="flex flex-row gap-2 items-center flex-nowrap min-w-0"
          >
            <input
              type="text"
              placeholder="Nom d'utilisateur"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="p-2 rounded border w-24 md:w-40 text-black min-w-0"
              required
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-2 rounded border w-24 md:w-40 text-black min-w-0"
              required
            />
            <button
              type="submit"
              className="bg-green-500 px-2 md:px-3 py-2 rounded hover:bg-green-600 transition"
            >
              Se connecter
            </button>
            {error && <span className="text-red-500 hidden md:inline">{error}</span>}
          </form>
        ) : (
          <div className="flex items-center gap-2 md:gap-3 flex-nowrap min-w-0">
            <span className="truncate max-w-[120px] md:max-w-none">Rôle : {role}</span>
            <button
              onClick={logout}
              className="bg-red-500 px-2 md:px-3 py-2 rounded hover:bg-red-600 transition"
            >
              Déconnexion
            </button>
          </div>
        )}
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((v) => !v)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile dropdown menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-gray-800 border-t border-gray-700 z-[3000]">
          <div className="px-4 py-3 flex flex-col gap-3">
            {token && role === "admin" && (
              <button
                onClick={() => { setIsMenuOpen(false); togglePanel(); }}
                className="bg-blue-500 px-3 py-2 rounded hover:bg-blue-600 transition text-left"
              >
                Panel Admin
              </button>
            )}

            {!token ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Nom d'utilisateur"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="p-2 rounded border text-black"
                  required
                />
                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="p-2 rounded border text-black"
                  required
                />
                <button
                  type="submit"
                  className="bg-green-500 px-3 py-2 rounded hover:bg-green-600 transition"
                >
                  Se connecter
                </button>
                {error && <span className="text-red-400">{error}</span>}
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span>Rôle : {role}</span>
                <button
                  onClick={() => { setIsMenuOpen(false); logout(); }}
                  className="bg-red-500 px-3 py-2 rounded hover:bg-red-600 transition"
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
