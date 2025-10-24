import React, { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import MapPage from "./pages/MapPage";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

function MainApp() {
  const { token, role } = useAuth();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const togglePanel = () => setIsPanelOpen((prev) => !prev);
  const closePanel = () => setIsPanelOpen(false);

  return (
    <div className="flex flex-col min-h-screen-mobile">
      {/* Navbar handles the toggle */}
      <Navbar togglePanel={togglePanel} />
      {/* MapPage receives only role, token, and panel state */}
      <MapPage
        role={role}
        token={token}
        isPanelOpen={isPanelOpen}
        onCloseAdminPanel={closePanel}
      />
    </div>
  );
}
