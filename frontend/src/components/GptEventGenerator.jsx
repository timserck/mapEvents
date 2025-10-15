import React, { useState } from "react";
import { API_URL } from "../config";

export default function GptEventGenerator({ activeCollection, setBulkJson, setMessage }) {
  const [gptPrompt, setGptPrompt] = useState("");
  const [loadingGPT, setLoadingGPT] = useState(false);

  const generateFromGPT = async () => {
    if (!gptPrompt) return;
    setLoadingGPT(true);

    const system = "You are a helpful assistant that generates structured event data for travel apps. Output only valid JSON — no text or markdown.";

    const prompt = `
Generate a JSON object in this exact format:
{
  "title": "...",
  "type": "...",
  "date": "${new Date().toISOString()}",
  "description": "...",
  "address": "...",
  "latitude": 0,
  "longitude": 0,
  "collection": "${activeCollection || "Default"}"
}

The event is based on this description: "${gptPrompt}".
Fill title, type, description, address and realistic coordinates.
`;

    try {
      const response = await fetch(`${API_URL}/events/gpt-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: gptPrompt, collection: activeCollection })
      });
      
      const parsed = await response.json();
      setBulkJson(JSON.stringify([parsed], null, 2));

      setMessage("✅ JSON généré depuis GPT !");
    } catch (err) {
      console.error("Erreur GPT:", err);
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
