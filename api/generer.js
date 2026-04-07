// api/generer.js
// Vercel serverless function – Google Gemini API med passord-autentisering
// Kantinemedarbeider – Molde voksenopplæringssenter MBO

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ feil: "Kun POST er tillatt" });

  const { passord, prompt, maxTokens } = req.body;

  // Sjekk passord mot miljøvariabel
  const riktigPassord = process.env.APP_PASSORD;
  if (!riktigPassord) {
    return res.status(500).json({ feil: "APP_PASSORD er ikke konfigurert på serveren." });
  }
  if (passord !== riktigPassord) {
    return res.status(401).json({ feil: "Feil passord. Prøv igjen." });
  }

  // Hent API-nøkkel fra Vercel miljøvariabel
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ feil: "GOOGLE_API_KEY er ikke konfigurert på serveren." });
  }

  if (!prompt) {
    return res.status(400).json({ feil: "Mangler prompt i forespørselen." });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const svar = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens || 8192,
          temperature: 0.7,
        }
      })
    });

    if (!svar.ok) {
      const feilData = await svar.json();
      return res.status(svar.status).json({
        feil: feilData.error?.message || `Feil fra Google Gemini API (HTTP ${svar.status})`
      });
    }

    const data = await svar.json();
    const tekst = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!tekst) {
      return res.status(500).json({ feil: "Tom respons fra Gemini API." });
    }

    return res.status(200).json({ tekst });

  } catch (err) {
    console.error("Feil i generer.js:", err);
    return res.status(500).json({ feil: "Serverfeil: " + err.message });
  }
};
