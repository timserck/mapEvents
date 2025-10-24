import React, { useState } from "react";
import { API_URL } from "../config";
import { useAuth } from "../AuthContext";

export default function GptEventGenerator({ activeCollection, setBulkJson, setMessage }) {
  const { token } = useAuth();
  const [gptPrompt, setGptPrompt] = useState("");
  const [loadingGPT, setLoadingGPT] = useState(false);

  const generateFromGPT = async () => {
    if (!gptPrompt) {
      setMessage("⚠️ Veuillez saisir une description.");
      return;
    }
    if (!token) {
      setMessage("⚠️ Vous devez être connecté pour générer des événements GPT.");
      return;
    }

    setLoadingGPT(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/events/gpt-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: gptPrompt, collection: activeCollection })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("GPT backend error:", data);
        setMessage(`❌ Erreur backend: ${data.error || "Unknown"}`);
        setLoadingGPT(false);
        return;
      }

      // Vérifie que la réponse contient bien un objet JSON valide
      let parsed;
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
        className={`px-3 py-2 rounded text-white ${loadingGPT ? "bg-gray-400" : "bg-purple-600 hover:bg-purple-700"}`}
      >
        {loadingGPT ? "⏳..." : "✨ GPT"}
      </button>
    </div>
  );
}
