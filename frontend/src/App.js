import { AuthProvider, useAuth } from "./AuthContext";
import LoginPage from "./pages/LoginPage";
import MapPage from "./pages/MapPage";

function AppContent() {
  const { token, role, logout } = useAuth();
  return <MapPage role={role} logout={logout} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
