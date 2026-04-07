// api/ping.js
// Kun for å verifisere passord ved innlogging – kaller ikke Gemini

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ feil: "Kun POST er tillatt" });

  const { passord } = req.body;

  const riktigPassord = process.env.APP_PASSORD;
  if (!riktigPassord) {
    return res.status(500).json({ feil: "APP_PASSORD er ikke konfigurert på serveren." });
  }
  if (passord !== riktigPassord) {
    return res.status(401).json({ feil: "Feil passord. Prøv igjen." });
  }

  return res.status(200).json({ ok: true });
};
