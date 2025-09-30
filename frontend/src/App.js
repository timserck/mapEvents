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

  return (
    <div className="flex flex-col h-screen">
      <Navbar togglePanel={togglePanel} />
      <MapPage
        role={role}
        token={token}
        isPanelOpen={isPanelOpen}
        togglePanel={togglePanel}
      />
    </div>
  );
}
