# Kantinemedarbeider – Ukesoppgaveportal
**Molde voksenopplæringssenter · MBO · NAV Molde**

Portal for å generere differensierte ukesoppgaver i faget kantinemedarbeider.
Genererer Word-dokumenter (.docx) via Google Gemini API.

---

## Filstruktur

```
kantineportal/
├── public/
│   └── index.html       ← Frontend (passord-innlogging + portal)
├── api/
│   └── generer.js       ← Vercel serverless function (Gemini API)
├── package.json
├── vercel.json
└── README.md
```

---

## Deploy til Vercel

### Steg 1 – GitHub
1. Gå til github.com → **New repository** → navn: `kantineportal`
2. Last opp alle filene (behold mappestrukturen)

### Steg 2 – Vercel
1. Gå til vercel.com → **New Project** → velg `kantineportal`
2. Klikk **Deploy**

### Steg 3 – Miljøvariabler
Gå til Vercel → ditt prosjekt → **Settings → Environment Variables**:

| Name            | Value                     |
|-----------------|---------------------------|
| `GOOGLE_API_KEY`| Din `AIza...`-nøkkel      |
| `APP_PASSORD`   | Velg et passord, f.eks. `kantine2026` |

Klikk **Save** → **Redeploy**

---

## Bruk

1. Åpne URL-en på Vercel
2. Skriv inn passordet
3. Velg tema (20 kantinefag-temaer)
4. Velg CEFR-nivå (A1/A2/B1/B2)
5. Klikk «Generer ukesark»
6. Last ned Word-dokumentet

---

## Innhold per ukesark

- **Mandag–fredag**: 2 nye lesetekster per dag (10 totalt)
- 15 oppgaver (a–e) med leseforståelse, grammatikk og ordforråd
- Muntlig øvelse hver dag
- Fasit på siste side
- Tilpasset CEFR-nivå (A1/A2/B1/B2)

---

## Teknologi

- **Frontend**: HTML/CSS/JavaScript
- **Backend**: Vercel Serverless Functions (Node.js)
- **AI**: Google Gemini 2.5 Flash
- **Word**: OOXML generert i nettleseren
