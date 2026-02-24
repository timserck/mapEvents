import React, { useState } from "react";
import { apiFetch } from "../apiFetch";
import { useAuth } from "../AuthContext";

interface GptEventGeneratorProps {
  activeCollection: string;
  setBulkJson: (json: string) => void;
  setMessage: (msg: string) => void;
}

export default function GptEventGenerator({
  activeCollection,
  setBulkJson,
  setMessage,
}: GptEventGeneratorProps) {
  const [gptPrompt, setGptPrompt] = useState("");
  const [loadingGPT, setLoadingGPT] = useState(false);
  const { logout } = useAuth() as any;

  const generateFromGPT = async () => {
    if (!gptPrompt) {
      setMessage("⚠️ Veuillez saisir une description.");
      return;
    }
    if (!activeCollection) {
      setMessage("⚠️ Sélectionnez ou créez une collection d'abord.");
      return;
    }

    setLoadingGPT(true);
    setMessage("");

    try {
      const res = await apiFetch(
        "/events/gpt-events",
        {
          method: "POST",
          body: JSON.stringify({ prompt: gptPrompt, collection: activeCollection }),
        },
        logout
      );

      if (!res?.ok) {
        const errData = await res?.json();
        console.error("GPT backend error:", errData);
        setMessage(`❌ Erreur backend: ${errData?.error || "Unknown"}`);
        setLoadingGPT(false);
        return;
      }

      const data = await res.json();

      let parsed: any;
      try {
        parsed = typeof data === "string" ? JSON.parse(data) : data;
      } catch (err) {
        console.error("Erreur parsing GPT JSON:", data);
        setMessage("❌ Le backend a renvoyé un JSON invalide");
        setLoadingGPT(false);
        return;
      }

      setBulkJson(JSON.stringify([parsed], null, 2));
      setMessage("✅ JSON généré depuis GPT !");
    } catch (err) {
      console.error("Erreur GPT fetch:", err);
      setMessage("❌ Erreur lors de la génération GPT");
    } finally {
      setLoadingGPT(false);
    }
  };

  return (
    <div className="flex gap-2 mb-2">
      <input
        type="text"
        placeholder="Décrivez le lieu ou l'événement (ex: restaurant romantique Danube)"
        value={gptPrompt}
        onChange={(e) => setGptPrompt(e.target.value)}
        className="flex-1 border p-2 rounded"
      />
      <button
        type="button"
        onClick={generateFromGPT}
        disabled={loadingGPT}
        className={`px-3 py-2 rounded text-white ${
          loadingGPT ? "bg-gray-400" : "bg-purple-600 hover:bg-purple-700"
        }`}
      >
        {loadingGPT ? "⏳..." : "✨ GPT"}
      </button>
    </div>
  );
}

