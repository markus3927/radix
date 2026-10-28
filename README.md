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
7. **Während dem Lauf** bleibt die Programmliste offen: Programme nach dem laufenden dürfen dazukommen, sich ändern oder
   wegfallen; das laufende und die schon gelaufenen bleiben gesperrt (Meldung über der Vorschau). Offenes NF/HF wird
   übersprungen, bis es per Knopf geklärt ist.
8. **Leiste im Kopf:** ein Knopf pro Generator, Farbe = Zustand (rot Killing, blau Healing, gelb stellt um/wartet, weiss steht,
   roter Rand Fehler). Klick springt zur Karte. Klickt man im Kontrollblatt ein Blatt an, springt RADIX zur Karte dieses
   Generators – sobald das Kontrollblatt beim Blattwechsel `"aktiv": <Nummer>` und `"aktivZeit": <Zeitstempel>` in die
   Sicherungsdatei schreibt.

9. **Vorspulen** (nur während dem Lauf): «⏭ Nächste Frequenz» beendet die laufende Frequenz bzw. Pause, «⏭ Nächstes Programm»
   springt zum nächsten Programm der Liste (Preset wird bei Bedarf umgestellt; beim letzten Programm: nächster Durchlauf bzw. fertig).
   Jeder Sprung steht im Protokoll.

10. **Leeren** (neben «Heute aus Kontrollblatt»): leert die Programmliste; läuft der Generator, wird er nach Rückfrage gestoppt.
    Danach startet «Start» wieder von vorne.
11. **NF ↔ HF pro Zeile:** Hat eine Kachel beide Blöcke, steht in der Vorschau «→ HF» bzw. «→ NF». So kann dieselbe Nummer einmal
    als NF und einmal als HF laufen. Auch während dem Lauf, aber nur für Programme nach dem laufenden.

12. **Ablauf ab 0.4.4:** Tag im Kontrollblatt vorbereiten → «Heute aus Kontrollblatt» (oder Doppelklicks kommen von selbst in
    die Liste) → **Start** oder **Startzeit + Start** von Hand. RADIX startet nie mehr selbst.
    **Leeren** markiert alles, was heute schon im Kontrollblatt steht, als erledigt: «Heute aus Kontrollblatt» bringt danach
    nur noch, was nach dem Leeren eingetragen wurde (gilt auch nach dem Neuladen).
13. Karten stehen mittig (440–600 px breit, bei 1920 px drei nebeneinander); die Leiste mit den Generator-Nummern bleibt beim
    Scrollen immer oben.

14. **Zeitmarke** in der Programmliste: eine Zeile `um 06:00` (auch `ab 6:00`, `06:00`). Was darunter steht, startet erst zu dieser
    Uhrzeit (am Abend geplant = am nächsten Morgen). Ist die Liste vorher fertig, wartet RADIX mit ausgeschalteten Ausgängen
    (gelb). Läuft um diese Zeit noch ein Programm davor, wird es beendet und es geht pünktlich nach Zeitplan weiter.
    «⏭ Nächstes Programm» während dem Warten startet sofort. Mehrere Marken pro Liste möglich.
15. **Generator-Nummer** mit ◀ ▶ ändern (tauscht wie bisher mit der Karte dieser Nummer). Im Test zeigt das Display gleich die neue
    Nummer. **Test beenden** (oder Stopp) beendet den Test, die Ausgänge bleiben aus.

## Stand Version 0.4.7
- **Verbindung wird geprüft:** beim Start, bei «Testen»/«Alle testen» und vor jedem Start bekommt jeder Generator «Ausgänge aus» und muss mit «ok» antworten. Chip neben der Nummer: ✓ verbunden, ✗ keine Antwort / belegt / getrennt
- Antwortet er nicht: Anschluss schliessen, neu öffnen, dann andere Baudraten (115200, 38400, 19200, 9600) versuchen. Gefundene Baudrate steht im Chip. «ok» ohne Zeilenende wird angenommen
- Generatoren ohne Verbindung werden alle 15 s von selbst neu versucht (z. B. nachdem Spooky2 geschlossen oder der Generator eingeschaltet wurde); USB ab- und wieder angesteckt wird erkannt
- Klare Meldungen: «antwortet nicht – Netzteil? USB-Kabel/Hub?» bzw. «Anschluss belegt – Spooky2 ganz geschlossen?»; Leiste: rot umrandet = keine Verbindung
- **Einzelansicht** (Standard): nur der gewählte Generator, ganze Breite, zwei Spalten. Wahl über die Leiste oder Blattklick im Kontrollblatt; «Alle zeigen» schaltet um; Wahl wird gemerkt
- **Kopf bleibt stehen** beim Scrollen (Logo klein, Knöpfe und Leiste immer sichtbar)
- Enthält alles aus 0.4.6 (Morgen aus Kontrollblatt, PC bleibt wach, Rückfragen)

## Stand Version 0.4.6
- «Morgen aus Kontrollblatt» (braucht die Startzeit in «Start um»), PC bleibt wach solange ein Generator läuft oder wartet, Rückfragen beim Überspringen des letzten Programms und bei Startzeit in der Vergangenheit

## Stand Version 0.4.5
- Zeitmarken, Nummer mit ◀ ▶, Test beenden

## Stand Version 0.4.4
- Doppelklick im Kontrollblatt startet nicht mehr selbst (Start von Hand), Leeren = Vergangenes erledigt, Layout mittig, Leiste immer oben

## Stand Version 0.4.3
- Neu: Leeren, NF/HF pro Zeile umstellen

## Stand Version 0.4.2
- Neu: Vorspulen (nächste Frequenz, nächstes Programm)

## Stand Version 0.4.1
- Neu: Programmliste während dem Lauf änderbar, Leiste 1–24, Sprung vom Kontrollblatt, Kontrollblatt-Datei jede Sekunde geprüft
- Korrigiert: Meldungen beim Anhängen wurden sofort vom Fortschritt überschrieben; Programmnamen wie «Fünf» galten als NF
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
