# RADIX Frequenzsteuerung

Eigene Steuerung für die Spooky2-Generatoren (XM) im Remote-Betrieb.
Läuft in Google Chrome oder Microsoft Edge, lässt sich als App installieren und arbeitet danach offline.

## Benutzung
1. Spooky2 schliessen (sonst sind die Anschlüsse belegt).
2. Oben drei Quellen wählen (werden gemerkt):
   - **Spooky2** → Ordner `C:\Spooky2`
   - **Frequenz-Finder** → `Frequenz-Finder.html`
   - **Kontrollblatt** → die Datei, in die das Kontrollblatt automatisch speichert (`Frequenz_Kontrolle.json`)
3. «Generator hinzufügen» → COM-Anschluss wählen. Bereits erlaubte Generatoren verbinden sich beim Start selbst.
   **Nach einem PC-Neustart:** «Alle testen» → jedes Display zeigt die Kartennummer als Frequenz (Ausgänge bleiben aus).
   Stimmt eine Nummer nicht, auf der Karte die Nummer des Generators eintragen: die beiden Karten tauschen,
   Programmliste, Kunde und gespeicherter Stand wandern mit der Nummer.
4. Pro Generator: Nummer = Nummer am Gerät = Nummer des Kontrollblatts. Programmliste, eine Zeile pro Programm:
   - `pr0245 NF`, `pr0409 HF`, `pr0001` – Programm aus dem Finder, Preset kommt aus der Kachel
   - `pa15`–`pa60` (Pause), `sm15`–`sm60` (Schumann) – übernehmen das Preset davor
   - eigene Frequenzzeile `437=240, 727=420, 120-128=600` – läuft mit «Preset für eigene Zeilen»
   - «Heute aus Kontrollblatt» übernimmt die heutige Zeile; «Programme des Kunden» zum Antippen
5. Durchläufe, optional Startzeit → Start. Zwischen Programmen mit anderem Preset stellt RADIX den Generator selbst um.
6. **Doppelklick im Kontrollblatt** (Blatt 1) geht nach wenigen Sekunden auf Generator 1: steht er, startet er sofort mit dem
   richtigen Preset; läuft er, wird hinten angehängt. Fehlt im Kontrollblatt NF/HF, sucht RADIX es im selben Blatt, sonst Knopf NF/HF.
   Das laufende Preset steht gross auf der Karte (rot Killing, grün Healing). Schalter «Doppelklick im Kontrollblatt startet hier»
   pro Generator; aus = nur Hinweis mit «Anhängen».

## Stand Version 0.4.0
- Bereit: Healing, Killing, Healing/Killing Dual, Killing Low Freq, DNA, Golden Ratio, Aubrey Scoon u. a.; alle 4538 Programme des Frequenz-Finders v352
- Frequency Wobble (Dreieck) **vorläufig**: ±halbe Prozentzahl, 16 Stufen, 4 Stufen/s – am Gerät gegen Spooky2 zu prüfen
- Noch gesperrt: Spektrum/WCM-Sweeps, H-Bomb, F2-Modulation, Harmonic Wobble, Gate, MW-Umrechnung (MW Emulate, Protein, Peptide)

## Dateien
- `kern.js` – Presets, Finder, Kontrollblatt lesen; Einstellungen, Ablauf, Generator-Befehle (ohne Gerät testbar)
- `app.js` – Oberfläche, Verbindung, Taktgeber
- `sw.js`, `manifest.webmanifest`, `icon-*.png`, `logo-kopf.png` – Installation und Offline-Betrieb
- `test/` – Kern-Tests mit echten Spooky2-Dateien, End-to-End-Test mit simulierten Generatoren

Kundendaten bleiben auf dem Spooky-PC: RADIX liest Finder und Kontrollblatt nur als Datei vom PC. Auf dem Server liegt nur der Programmcode.

---
Idee, Konzept & Architektur Markus Rufer · Technische Umsetzung. Claude by Anthropic
