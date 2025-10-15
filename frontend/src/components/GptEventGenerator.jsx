import React, { useState } from "react";

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
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      const parsed = JSON.parse(content);

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
