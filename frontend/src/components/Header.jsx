import { useAuth } from "../AuthContext";

export default function Header() {
  const { token, logout } = useAuth();

  return (
    <header className="flex justify-between items-center p-4 bg-gray-100 shadow-md">
      <h1 className="text-xl font-bold">Carte des événements</h1>
      
      <div>
        {token ? (
          <button
            onClick={logout}
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
          >
            Se déconnecter
          </button>
        ) : (
          <span className="text-sm text-gray-600">Veuillez vous connecter pour ajouter des événements</span>
        )}
      </div>
    </header>
  );
}
