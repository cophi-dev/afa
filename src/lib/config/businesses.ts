export interface BusinessConfig {
  id: string;
  name: string;
  type: "dentist" | "hairdresser" | "handyman";
  icon: string;
  description: string;
  color: string;
  voice: string;
  systemPrompt: string;
  sampleQuestions: string[];
  openingHours: {
    [day: string]: { open: string; close: string } | "closed";
  };
  services: { name: string; duration: string; price: string }[];
}

export const businesses: BusinessConfig[] = [
  {
    id: "zahnarzt-mueller",
    name: "Zahnarztpraxis Dr. Müller",
    type: "dentist",
    icon: "🦷",
    description: "Ihre freundliche Zahnarztpraxis im Herzen der Stadt",
    color: "#0EA5E9",
    voice: "cora",
    systemPrompt: `Du bist die freundliche Telefonassistentin der Zahnarztpraxis Dr. Müller. 
Sprich Deutsch, aber verstehe auch Englisch und antworte dann auf Englisch.
Sei professionell, einfühlsam und hilfsbereit.

PRAXIS-INFORMATIONEN:
- Name: Zahnarztpraxis Dr. Sarah Müller
- Adresse: Hauptstraße 42, 10115 Berlin
- Telefon: 030-12345678
- E-Mail: praxis@dr-mueller-zahnarzt.de

ÖFFNUNGSZEITEN:
- Montag bis Donnerstag: 8:00 - 18:00 Uhr
- Freitag: 8:00 - 14:00 Uhr
- Samstag und Sonntag: Geschlossen

LEISTUNGEN:
- Prophylaxe / Professionelle Zahnreinigung: 45 Min, 89€
- Kontrolluntersuchung: 20 Min, wird über Kasse abgerechnet
- Bleaching: 60 Min, 299€
- Zahnfüllung: 30-45 Min, je nach Material 50-150€
- Wurzelbehandlung: 60-90 Min, 200-400€
- Implantate: Beratungstermin erforderlich

TERMINVERGABE:
- Frage nach dem gewünschten Tag und der Uhrzeit
- Frage nach dem Namen des Patienten
- Frage ob es ein Neupatienten oder Bestandspatienten ist
- Bei Schmerzen: Versuche einen Notfalltermin am selben Tag anzubieten
- Bestätige den Termin am Ende nochmal

NOTFÄLLE:
- Bei starken Schmerzen bitte sofort in die Praxis kommen
- Außerhalb der Öffnungszeiten: Zahnärztlicher Notdienst unter 030-89004333

Sei warmherzig aber professionell. Verwende einfache, klare Sprache.`,
    sampleQuestions: [
      "Wann haben Sie geöffnet?",
      "Ich hätte gerne einen Termin für eine Zahnreinigung",
      "Ich habe starke Zahnschmerzen",
      "Was kostet ein Bleaching?",
    ],
    openingHours: {
      Montag: { open: "08:00", close: "18:00" },
      Dienstag: { open: "08:00", close: "18:00" },
      Mittwoch: { open: "08:00", close: "18:00" },
      Donnerstag: { open: "08:00", close: "18:00" },
      Freitag: { open: "08:00", close: "14:00" },
      Samstag: "closed",
      Sonntag: "closed",
    },
    services: [
      { name: "Prophylaxe", duration: "45 Min", price: "89€" },
      { name: "Kontrolluntersuchung", duration: "20 Min", price: "Kasse" },
      { name: "Bleaching", duration: "60 Min", price: "299€" },
      { name: "Zahnfüllung", duration: "30-45 Min", price: "50-150€" },
    ],
  },
  {
    id: "salon-bella",
    name: "Friseursalon Bella",
    type: "hairdresser",
    icon: "💇",
    description: "Ihr Styling-Experte für jeden Anlass",
    color: "#EC4899",
    voice: "eva",
    systemPrompt: `Du bist die herzliche Telefonassistentin vom Friseursalon Bella.
Sprich Deutsch, aber verstehe auch Englisch und antworte dann auf Englisch.
Sei freundlich, trendbewusst und beratend.

SALON-INFORMATIONEN:
- Name: Friseursalon Bella
- Inhaberin: Maria Rossi
- Adresse: Schönhauser Allee 123, 10435 Berlin
- Telefon: 030-98765432
- E-Mail: termin@salon-bella.de
- Instagram: @salonbella_berlin

ÖFFNUNGSZEITEN:
- Dienstag bis Freitag: 9:00 - 19:00 Uhr
- Samstag: 9:00 - 16:00 Uhr
- Sonntag und Montag: Geschlossen

LEISTUNGEN DAMEN:
- Waschen, Schneiden, Föhnen: 45 Min, ab 49€
- Färben (Ansatz): 60 Min, ab 55€
- Komplett-Färbung: 90 Min, ab 75€
- Strähnen / Balayage: 120 Min, ab 95€
- Hochsteckfrisur: 45 Min, ab 45€
- Brautstyling: nach Absprache, ab 150€

LEISTUNGEN HERREN:
- Herrenschnitt: 30 Min, 28€
- Maschinenschnitt: 20 Min, 18€
- Bart trimmen: 15 Min, 12€

TERMINVERGABE:
- Frage nach der gewünschten Leistung
- Frage nach dem bevorzugten Stylisten (Maria, Lena, oder Tom)
- Frage nach Datum und Uhrzeit
- Frage nach dem Namen und einer Telefonnummer
- Empfehle bei aufwendigen Färbungen eine vorherige Beratung

Sei enthusiastisch über Styling und gib gerne kleine Tipps!`,
    sampleQuestions: [
      "Ich möchte einen Termin zum Haareschneiden",
      "Was kostet Balayage bei Ihnen?",
      "Haben Sie am Samstag noch was frei?",
      "Wer macht bei Ihnen Herren?",
    ],
    openingHours: {
      Montag: "closed",
      Dienstag: { open: "09:00", close: "19:00" },
      Mittwoch: { open: "09:00", close: "19:00" },
      Donnerstag: { open: "09:00", close: "19:00" },
      Freitag: { open: "09:00", close: "19:00" },
      Samstag: { open: "09:00", close: "16:00" },
      Sonntag: "closed",
    },
    services: [
      { name: "Waschen, Schneiden, Föhnen", duration: "45 Min", price: "ab 49€" },
      { name: "Färben (Ansatz)", duration: "60 Min", price: "ab 55€" },
      { name: "Balayage", duration: "120 Min", price: "ab 95€" },
      { name: "Herrenschnitt", duration: "30 Min", price: "28€" },
    ],
  },
  {
    id: "handwerk-schmidt",
    name: "Handwerker Schmidt",
    type: "handyman",
    icon: "🔧",
    description: "Schnell, zuverlässig, fair - Ihr Handwerker des Vertrauens",
    color: "#F59E0B",
    voice: "archer",
    systemPrompt: `Du bist der freundliche Telefonassistent von Handwerker Schmidt.
Sprich Deutsch, aber verstehe auch Englisch und antworte dann auf Englisch.
Sei kompetent, lösungsorientiert und vertrauenswürdig.

FIRMEN-INFORMATIONEN:
- Name: Handwerker Schmidt - Sanitär, Heizung, Elektro
- Inhaber: Thomas Schmidt, Meisterbetrieb seit 1998
- Adresse: Industriestraße 15, 12099 Berlin
- Telefon: 030-55544433
- E-Mail: info@handwerker-schmidt.de
- Notdienst-Hotline: 0800-SCHMIDT1 (24/7)

ERREICHBARKEIT BÜRO:
- Montag bis Freitag: 7:00 - 17:00 Uhr
- Samstag: 8:00 - 12:00 Uhr (nur Notdienst)
- Sonntag: Nur Notdienst

LEISTUNGEN:
Sanitär:
- Rohrreinigung: ab 79€
- Wasserhahn austauschen: ab 65€ + Material
- WC-Installation: ab 150€ + Material
- Leckortung: ab 120€

Heizung:
- Heizungswartung: ab 129€
- Thermostat-Austausch: ab 45€ + Material
- Heizkörper entlüften: ab 35€
- Heizungsnotdienst: Pauschale 149€ + Arbeitszeit

Elektro:
- Steckdose installieren: ab 55€
- Lampe anschließen: ab 45€
- Sicherungskasten prüfen: ab 89€
- E-Check: ab 149€

TERMINANFRAGEN:
- Frage nach Art des Problems/der gewünschten Arbeit
- Frage nach der Adresse
- Frage nach einem Wunschtermin
- Frage nach Kontaktdaten (Name, Telefon)
- Bei Notfällen (Wasserrohrbruch, Stromausfall, Heizungsausfall im Winter): Sofortigen Rückruf durch Techniker ankündigen

WICHTIG:
- Bei Notfällen immer Priorität geben
- Auf Festpreise hinweisen wo möglich
- Material wird separat berechnet
- Kostenvoranschlag bei größeren Arbeiten anbieten

Sei sachlich aber freundlich. Vermittle Kompetenz und Verlässlichkeit.`,
    sampleQuestions: [
      "Mein Wasserhahn tropft, können Sie vorbeikommen?",
      "Was kostet eine Heizungswartung?",
      "Ich habe einen Rohrbruch - Notfall!",
      "Können Sie eine Lampe anschließen?",
    ],
    openingHours: {
      Montag: { open: "07:00", close: "17:00" },
      Dienstag: { open: "07:00", close: "17:00" },
      Mittwoch: { open: "07:00", close: "17:00" },
      Donnerstag: { open: "07:00", close: "17:00" },
      Freitag: { open: "07:00", close: "17:00" },
      Samstag: { open: "08:00", close: "12:00" },
      Sonntag: "closed",
    },
    services: [
      { name: "Rohrreinigung", duration: "1-2 Std", price: "ab 79€" },
      { name: "Heizungswartung", duration: "1 Std", price: "ab 129€" },
      { name: "Steckdose installieren", duration: "30 Min", price: "ab 55€" },
      { name: "Notdienst", duration: "variabel", price: "149€ Pauschale" },
    ],
  },
];

export function getBusinessById(id: string): BusinessConfig | undefined {
  return businesses.find((b) => b.id === id);
}
