# KI-Telefonassistent Demo

Interaktive Demo eines KI-Telefonassistenten für Kleinunternehmen. Nutzer können im Browser Testanrufe mit verschiedenen Demo-Unternehmen tätigen.

**Live Demo:** [Deployment URL hier einfügen]

## Features

- **3 Demo-Unternehmen:** Zahnarztpraxis, Friseursalon, Handwerkerbetrieb
- **Browser-basierte Telefonate:** Direkt im Browser mit Mikrofon sprechen
- **Echtzeit-Transkription:** Sehen Sie das Gespräch live als Text
- **Mehrsprachig:** Versteht Deutsch und Englisch
- **Powered by Grok Voice:** Nutzt die xAI Speech-to-Speech API

## Tech Stack

- **Frontend:** Next.js 16, React 18, TypeScript
- **Styling:** Tailwind CSS 4
- **Voice API:** xAI Grok Voice (WebSocket, Speech-to-Speech)
- **Validation:** Zod

## Benötigte API Keys

### xAI API Key

1. Besuche https://console.x.ai/
2. Erstelle einen Account oder logge dich ein
3. Gehe zu "API Keys" und erstelle einen neuen Key
4. Kopiere den Key in deine `.env.local` Datei

```bash
XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Kosten:** Die Grok Voice API kostet $0.05 pro Minute.

## Installation

```bash
# Repository klonen
git clone [repo-url]
cd [repo-name]

# Dependencies installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env.local
# Dann XAI_API_KEY in .env.local eintragen

# Development Server starten
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) im Browser.

## Projektstruktur

```
src/
├── app/
│   ├── api/
│   │   └── session/
│   │       └── route.ts      # Ephemeral Token Endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx              # Hauptseite
├── components/
│   ├── BusinessCard.tsx      # Unternehmens-Karte
│   └── VoiceCall.tsx         # Anruf-Interface
└── lib/
    ├── config/
    │   └── businesses.ts     # Demo-Unternehmen Konfiguration
    └── voice/
        └── grok-voice-client.ts  # WebSocket Voice Client
```

## Wie es funktioniert

1. **Session Token:** Der Server generiert einen kurzlebigen Ephemeral Token über die xAI API
2. **WebSocket-Verbindung:** Der Client verbindet sich mit `wss://api.x.ai/v1/realtime`
3. **Audio-Streaming:** Mikrofon-Audio wird als PCM-Daten gestreamt
4. **Speech-to-Speech:** Grok versteht gesprochene Sprache und antwortet mit Sprache
5. **Transkription:** Optional werden Gespräche live transkribiert

## Demo-Unternehmen

### 🦷 Zahnarztpraxis Dr. Müller
- Terminvereinbarung für Prophylaxe, Kontrolle, Bleaching
- Notfall-Handling bei Zahnschmerzen
- Preisauskunft

### 💇 Friseursalon Bella
- Terminbuchung für verschiedene Services
- Stylist-Auswahl
- Preisberatung

### 🔧 Handwerker Schmidt
- Sanitär, Heizung, Elektro
- Notdienst-Vermittlung
- Kostenvoranschläge

## Anpassung

Die Demo-Unternehmen können in `src/lib/config/businesses.ts` angepasst werden:

- `systemPrompt`: Die Persönlichkeit und das Wissen des Assistenten
- `voice`: Die Stimme (`eve`, `cora`, `ara`, `archer`, etc.)
- `openingHours`: Öffnungszeiten
- `services`: Angebotene Leistungen

## Deployment

### Vercel (empfohlen)

```bash
npm install -g vercel
vercel
```

Setze die Umgebungsvariable `XAI_API_KEY` im Vercel Dashboard unter Settings > Environment Variables.

## Lizenz

MIT

## Credits

- [xAI Grok Voice API](https://x.ai/api/voice)
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
