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

## Stand Version 0.6.4 (Brücke bleibt 1.2.1)
- **GX-Test:** «Testen» auf einer GX-Pro-Karte (1, 2, 23, 24) öffnet den Anschluss mit 115200 Baud, fragt die Firmware (`:n00=$`), schaltet die Ausgänge aus (`:w11=0,0,`) und schickt die Kartennummer als Frequenz auf Out1 und Out2 (`:w24=…,` / `:w25=…,`, GX-Zahlenform). Alles mit Antwort im Protokoll. Darunter ein Feld für eigene Zeilen (Vorgaben aus dem Chat). «Test beenden» schaltet aus und gibt den Anschluss wieder frei. Spooky2 muss dafür aus sein
- «Alle testen» lässt die GX weiterhin in Ruhe; Programme starten auf GX noch nicht
- Enthält 0.6.3

## Stand Version 0.6.3 (Brücke bleibt 1.2.1)
- **Fehler behoben (am Gerät, 2. Anlauf):** Der XM übernimmt einen neuen Frequenzbereich (tief unter 600 Hz / normal) erst, wenn sich der Frequenzwert ändert. 0.6.2 schickte bei `10000=…, 10=…` denselben Wert nochmals – das Display blieb auf 10'000 Hz. Jetzt kommt nach dem Bereichswechsel kurz ein Nachbarwert (0,01 Hz bzw. 0,00001 Hz daneben), dann der richtige Wert. Im Protokoll als «anstossen (Bereich übernehmen)»

## Stand Version 0.6.2 (Brücke bleibt 1.2.1)
- **Fehler behoben (gefunden am Gerät):** Nach einem Wechsel zwischen tiefem (unter 600 Hz) und normalem Frequenzbereich wird die Frequenz jetzt immer neu geschickt. Vorher blieb z. B. bei `10000=…, 10=…` das Display auf 10'000 Hz stehen, weil 10 Hz × 100'000 und 10'000 Hz × 100 denselben Wert ergeben (betrifft alle Paare 1:1000, z. B. 1/1000, 7.83/7830)
- Kopf: neues Logo (Mensch im Kreis), Untertitel «zurück zum Ursprung» entfernt
- Leiste mit Brücke: sofort alle Nummern 1–24, noch nicht gemeldete Generatoren blass gestrichelt (nicht anklickbar)
- Leere Programmliste: keine rote Meldung mehr, nur «Liste leer»; das graue Beispiel im leeren Feld heisst jetzt «Beispiel (Liste ist leer)»
- GX-Pro-Karten: kein Haken «Doppelklick im Kontrollblatt» (läuft vorerst mit Spooky2); Tooltip zeigt den Steckplatz
- Protokoll: grösser (bis 420 px, ziehbar) und Knopf «Kopieren» (ganzes Protokoll in die Zwischenablage)

## Stand Version 0.6.1 – Brücke 1.2: Nummer am USB-Steckplatz
- Windows vergibt die COM-Nummern der CH340 (ohne Seriennummer) bei Markus bei jedem Start neu. Darum merkt sich RADIX die Nummer jetzt **pro USB-Steckplatz** (Brücke liest DEVPKEY_Device_LocationPaths). Neu erkannter Steckplatz: COM-Nummer als Vorschlag, einmal «Zuordnen» (oder ◀ ▶), danach stimmt es nach jedem Neustart von selbst
- Karte zeigt den aktuellen COM-Namen, Tooltip den Steckplatz; wechselt Windows die COM-Nummer, bleibt die Generator-Nummer
- «Zuordnen» und ◀ ▶ auch mit Brücke (gespeichert pro Steckplatz in `speicher.orte`)
- Brücke 1.2: Fehler beim Start bleiben im Fenster stehen (und `bruecke-fehler.txt`)

## Stand Version 0.6.0 – mit RADIX-Brücke
- **RADIX-Brücke 1.1** (Hilfsprogramm auf dem Spooky-PC, `RADIX-Bruecke.exe`): RADIX verbindet sich beim Start mit ws://127.0.0.1:8642. Ist sie da, kommen alle Generatoren von ihr: **Nummer = COM-Nummer** (COM7 = Generator 7), fest – kein Zuordnen, kein Verrutschen nach Neustart, Aus-/Einstecken oder Strom aus/ein. Karte zeigt den COM-Namen; Nummer, ◀ ▶, «Zuordnen» und «Generator hinzufügen» entfallen
- Kopf: «RADIX-Brücke 1.1.0 ✓» (grün), «getrennt – verbinde neu …» (rot, versucht alle 3 s), «besetzt» (zweites Fenster) oder «ohne RADIX-Brücke» (dann wie bisher über Chrome). Startet die Brücke später: «RADIX-Brücke gefunden – hier klicken zum Neuladen»
- Ausgesteckt/ohne Strom: Karte «getrennt», wieder da → verbindet von selbst. Brücke neu gestartet: Anschlüsse werden vor dem nächsten Befehl selbst wieder geöffnet
- GX Pro über die Brücke: erkannt (pid 55d2), Anschluss bleibt zu
- Wird RADIX geschlossen, gibt die Brücke alle Anschlüsse frei (Spooky2 als Rückfallebene)
- Enthält 0.4.7–0.4.11. (Eine 0.5.0 aus einem parallelen Chat wurde nie veröffentlicht.)

## Stand Version 0.4.11
- **Spooky2 GeneratorX Pro** (CH342, USB 1a86:55d2 – bei Markus Anschlüsse 1+2 und 23+24, je ein GX Pro mit zwei Platinen) wird erkannt: RADIX öffnet den Anschluss nie (keine Prüfung, kein Test, kein Start, kein Code beim Zuordnen), damit Spooky2 ihn gleichzeitig betreiben kann. Karte: Chip «GX Pro · Spooky2», Leiste grau gestrichelt
- Protokoll GX Pro (für später): 115200 Baud, Befehle `:w24=<f>,` / `:w25=<f>,` (Frequenz, Kodierung m·10+e in 10⁻⁸ Hz), `:w11=a,b,` (Ausgänge), Antwort `:ok`; Quelle github.com/pahor167/opengx-pro docs/spec/protocols.md. Gerät meldet r01=G2

## Stand Version 0.4.10
- Generator aus- und wieder eingesteckt (oder Strom aus/ein): Chrome meldet ihn als neuen Anschluss. Er übernimmt jetzt die getrennte Karte (gleiche Nummer, gleiche Programmliste) statt einer zusätzlichen Karte 25. Waren mehrere getrennt: kleinste Nummer, Hinweis «mit Zuordnen prüfen»

## Stand Version 0.4.9
- Zuordnen: Generatoren ohne Code (ohne Verbindung) füllen die freien Nummern ab 1 (vorher konnte z. B. eine 25 stehen bleiben und die 1 fehlen)
- ▶ bei der Nummer geht nicht mehr über 24 (bzw. die Anzahl angeschlossener Generatoren) hinaus

## Stand Version 0.4.8
- **Zuordnen** (Knopf oben): jeder verbundene Generator zeigt einen Code ab 101 auf dem Display (Ausgänge aus). Pro Gerät am Regal den Code eintragen (Enter springt weiter), «Übernehmen» – alle Nummern stimmen auf einmal, Programmlisten und Kunden bleiben bei ihrer Nummer. Danach zeigt jedes Gerät zur Kontrolle seine eigene Nummer. Geräte ohne Code (keine Verbindung) leer lassen
- **Fehler behoben:** beim Neuladen wurde die gespeicherte Zuordnung nach dem ersten Generator abgeschnitten – die Nummern verrutschten bei jedem Start
- «Alle zeigen»: Karten nach Nummer sortiert

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
