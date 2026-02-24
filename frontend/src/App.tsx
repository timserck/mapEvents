import React, { useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider, useAuth } from "./AuthContext";
import MapPage from "./pages/MapPage";
import Navbar from "./components/Navbar";

function MainApp() {
  const { token, role, logout } = useAuth();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const togglePanel = () => setIsPanelOpen((prev) => !prev);
  const closePanel = () => setIsPanelOpen(false);

  return (
    <div className="flex flex-col min-h-screen-mobile">
      <Navbar togglePanel={togglePanel} />
      <MapPage
        logout={logout}
        role={role}
        token={token}
        isPanelOpen={isPanelOpen}
        onCloseAdminPanel={closePanel}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
      <ToastContainer position="top-right" autoClose={3000} />
    </AuthProvider>
  );
}

