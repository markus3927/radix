# Generator-Steuerung

Eigene Steuerung für die Spooky2-Generatoren (XM) im Remote-Betrieb.
Läuft in Google Chrome oder Microsoft Edge, lässt sich als App installieren und arbeitet danach offline.

## Benutzung
1. Spooky2 schliessen (sonst sind die Anschlüsse belegt).
2. App öffnen, «Spooky2-Ordner wählen» → `C:\Spooky2`.
3. «Generator hinzufügen» → COM-Anschluss wählen. Bereits erlaubte Generatoren verbinden sich beim Start selbst.
4. Pro Generator: Preset, Frequenzzeile (`437=240, 727=420, 120-128=600`), Durchläufe, optional Startzeit → Start.
5. «Erkennen» zeigt die Generator-Nummer als Frequenz auf dem Display.

## Stand Version 0.1.0
- Bereit: Healing, Killing, Healing/Killing Dual, Killing Low Freq, DNA, Golden Ratio, Aubrey Scoon u. a.
- Noch gesperrt: Spektrum/WCM-Sweeps, H-Bomb, F2-Modulation, Wobble, Gate, MW-Umrechnung (MW Emulate, Protein, Peptide)

## Dateien
- `kern.js` – Presets lesen, Einstellungen, Ablauf, Generator-Befehle (ohne Gerät testbar)
- `app.js` – Oberfläche, Verbindung, Taktgeber
- `sw.js`, `manifest.webmanifest`, `icon-*.png` – Installation und Offline-Betrieb
- `test/kern.test.js` – Tests mit echten Spooky2-Dateien

Kundendaten bleiben auf dem Spooky-PC. Auf dem Server liegt nur der Programmcode.

---
Idee, Konzept & Architektur Markus Rufer · Technische Umsetzung. Claude by Anthropic
