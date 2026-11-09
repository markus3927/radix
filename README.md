# RADIX Frequenzsteuerung

Eigene Steuerung für die Spooky2-Generatoren (XM) im Remote-Betrieb.
Läuft in Google Chrome oder Microsoft Edge, lässt sich als App installieren und arbeitet danach offline.

## Benutzung
1. Spooky2 schliessen (sonst sind die Anschlüsse belegt).
2. Oben die Quellen wählen (vier gleiche Felder, Klick aufs ganze Feld, wird gemerkt):
   - **Spooky2** → Ordner `C:\Spooky2`
   - **Frequenz-Finder** → `Frequenz-Finder.html`
   - **Kontrollblatt** → die Datei, in die das Kontrollblatt automatisch speichert (`Frequenz_Kontrolle.json`)
   - **Laufbuch** (ab 0.7.9, nur für Endlosschleife) → `RADIX_Laufbuch.json` neu anlegen; dieselbe Datei in der Kontrollapp wählen
3. «Generator hinzufügen» → COM-Anschluss wählen. Bereits erlaubte Generatoren verbinden sich beim Start selbst.
   **Nach einem PC-Neustart:** «Alle testen» → jedes Display zeigt die Kartennummer als Frequenz (Ausgänge bleiben aus).
   Stimmt eine Nummer nicht, auf der Karte die Nummer des Generators eintragen: die beiden Karten tauschen,
   Programmliste, Kunde und gespeicherter Stand wandern mit der Nummer.
4. Pro Generator: Nummer = Nummer am Gerät = Nummer des Kontrollblatts. Programmliste, eine Zeile pro Programm:
   - `pr0245 NF`, `pr0409 HF`, `pr0001` – Programm aus dem Finder, Preset kommt aus der Kachel
   - `pa15`–`pa60` (Pause), `sm15`–`sm60` (Schumann) – übernehmen das Preset davor
   - eigene Frequenzzeile `437=240, 727=420, 120-128=600` – läuft mit «Preset für eigene Zeilen»
   - `loop-10` auf eigener Zeile – das Programm direkt darunter läuft 10-mal hintereinander
   - «Heute aus Kontrollblatt» übernimmt die heutige Zeile; «Programme des Kunden» zum Antippen
5. Durchläufe, optional Startzeit → Start. Zwischen Programmen mit anderem Preset stellt RADIX den Generator selbst um.
6. **«→ RADIX» in der Tageszeile des Kontrollblatts** (Blatt 1, ab 0.8.5) geht nach wenigen Sekunden auf Generator 1: Das Neue der Zeile
   wird hinten angehängt, gestartet wird von Hand. Fehlt im Kontrollblatt NF/HF, sucht RADIX es im selben Blatt, sonst Knopf NF/HF.
   Das laufende Preset steht gross auf der Karte (rot Killing, grün Healing). Schalter «→ RADIX im Kontrollblatt kommt hierher»
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

## Stand Version 0.9.17 (Brücke bleibt 1.2.1) – verpasste Zeitmarke nach Neustart nachholen

- Markus 09.11.2026: PC in der Nacht hängen geblieben, Neustart 9.50 – die Morgenlisten «um 06:00» rutschten beim «Alle fortsetzen»
  auf morgen (wie am 08.11. Linda «um 22:00» nach Neuladen um 22.10). Neu speichert RADIX die Uhrzeiten der Zeitmarken mit (`marken`).
  Beim Fortsetzen: Ist eine Zeitmarke inzwischen vorbei und höchstens **6 Stunden** her, geht es **sofort** mit dem Block nach der zuletzt
  verpassten Zeitmarke weiter (was davor stand, ist vorbei – wie im normalen Ablauf). Spätere Zeitmarken bleiben pünktlich, z. B. die
  Nacht um 21:00. Länger her oder Stand noch von 0.9.16: wie bisher (nächste Uhrzeit ab jetzt). Protokoll: «⏰ … verpasst – wird jetzt nachgeholt».
- Handy-Auftrag an einen Generator im Test («Alle testen» nach Neustart): beendet den Test wie «Start» und läuft, statt abgelehnt zu werden.
- Nach jedem neuen Durchlauf wird der Stand gleich gesichert (neue Zeiten der Zeitmarken).
- Sonst wie 0.9.16.

## Stand Version 0.9.16 (Brücke bleibt 1.2.1) – Vorschau fürs Kontrollblatt, Mehrtages-Listen

- Laufbuch neu mit `vorschau` ({ Generator: [{ code, name, von, bis }] }, 36 h voraus) und `vorschauStand`: kommende Programme,
  die später ins Laufbuch kommen (Handy-Aufträge, Endlosschleife). Die Kontrollapp (ab R413) zeigt sie halb transparent unter der
  Tageszeile, bis sie starten. Neu geschrieben, sobald sich die Vorschau ändert (Prüfung jede Minute), sonst alle 20 Min.
- Fehler behoben: Listen über mehrere Tage (Wochenzyklus «um 21:00 … um 06:00 … um 21:00 … um 06:00») – ab dem 2. Durchlauf lag die
  erste Zeitmarke einen Tag zu früh, der Durchlauf sprang sofort zur fälligen 06:00 und die Nacht fiel aus. Neu rückt der nächste
  Durchlauf so viele ganze Tage weiter, wie die Zeitmarken überspannen (naechsterAb). 1-Tages-Listen unverändert (getestet alt/neu).
- Sonst wie 0.9.15.

## Stand Version 0.9.15 (Brücke bleibt 1.2.1) – «fertig um» bei wartender Liste, Handy-Pläne nicht doppelt

- Wartet eine Liste auf ihre Zeitmarke («um 23:00» zuoberst) oder auf «Start um», rechnet RADIX das «fertig um»
  (Quittung `ende` im Laufbuch, «alles fertig» in der Anzeige) jetzt ab dieser Startzeit statt ab jetzt.
  Beispiel: 2× sm60 «um 23:00», Auftrag um 19.58 → bisher 21.58, neu 01.00.
- Handy-Pläne (Nacht usw., Kontrollapp ab R411 trägt sie in die Tageszeile): diese Einträge zählen in RADIX als schon gesehen.
  Drückt Markus später «→ RADIX» in derselben Zeile, kommt nur, was er von Hand dazu getippt hat – die Nacht nicht ein zweites Mal.
  Quittung neu mit `planTag` (Datum der Tageszeile). Gegenstück in der Kontrollapp R412: der Knopf zeigt dort «✓ RADIX».
- Sonst unverändert wie 0.9.14.

## Stand Version 0.9.14 (Brücke bleibt 1.2.1) – Plan fürs Kontrollblatt (Fixprogramm und Tageszeile)
- Markus 08.11.2026: neue Nachtprogramme für die Kunden per Handy – «du trägst das gleich ein inkl. startzeit und allem» · «die grossen
  fix kacheln entsprechend geändert».
- Handy-Auftrag neu mit Feld `plan: { fix: 1–8 (8 = Nacht), name?, det?, z: ['um 21.00', 'pr0036\tName', …], tag?: false }`.
  RADIX führt die `zeilen` aus wie immer und gibt den Plan in der Quittung weiter – nur wenn ausgeführt. Die Kontrollapp (ab R411)
  setzt damit die grosse Fixprogramm-Kachel dieses Kunden neu und trägt den Ablauf in die Tageszeile seines Starttags ein.
- Getestet (22 Fälle, simulierter XM): Plan in der Quittung, abgelehnter Auftrag ohne Plan; ein Auftrag, der mit «um 21:00» beginnt,
  startet auf einem freien Generator und wartet an der Zeitmarke. Alle bisherigen Fälle weiter grün.

## Stand Version 0.9.13 (Brücke bleibt 1.2.1) – Handy-Zeilen mit Namen und ↻
- Markus 08.11.2026: «was mir im radix bei den handy programmen fehlt ist, es steht nur die nummer und handy. da sehe ich nicht gleich was
  es ist» · «z.b mit gleichem symbölchen wie in der kontroll app?»
- Steht in einer Zeile eines Handy-Auftrags nur die Nummer (`pr0532 NF`, `pp0555`, `pa15`), setzt RADIX den Namen dazu – aus der
  Finder-Kachel bzw. der Peptid-Liste (`handyMitName`). Zeilen mit eigenem Text, Zeitmarken und loop bleiben, wie sie sind.
- Markierung neu «↻» wie in der Kontrollapp statt «[Handy]»: `pr0532 NF  Happy / Fit & Vital / Gute Stimmung - Nerven & Sinne - NF (Hz)  ↻`.
  «[Handy]» in älteren Listen gilt weiter (Laufbuch wie bisher). Der NF/HF-Knopf behält ↻.
- Getestet (21 Fälle, simulierter XM): Namen für pr NF/HF, pp und pa, eigener Text bleibt, alle Zeilen weiter markiert (Laufbuch),
  alte «[Handy]»-Zeilen, NF/HF-Wechsel; alle bisherigen Fälle weiter grün.

## Stand Version 0.9.12 (Brücke bleibt 1.2.1) – Durchläufe zurück auf 1, Programme für die Kontrollapp
- Markus 08.11.2026 (Olga: 2 Durchläufe vom letzten Mal stehen geblieben): «wenn ich mehrere durchläufe habe, diese fertig sind,
  sollten die durchläufe wieder auf 1 zurück gehen». Nach «fertig» war das seit 0.9.1 so. Neu auch nach **«Leeren»** (immer, auch
  0 = endlos) und nach **«Stopp»** (mehr als 1 → 1; 0 = endlos bleibt, damit ein angehaltener Dauerlauf mit Start endlos weiterläuft).
  Im Protokoll: «Durchläufe von 3 zurück auf 1» (`durchlaeufeZurueck`).
- Markus 08.11.2026: «wenn ich für einen kunden ein passendes programm möchte, das aber noch nicht in der kontrollapp bei dem kunden ist,
  … schreibe es gleich in die kontrollapp zum passenden kunden, danach starte das programm». Handy-Auftrag neu mit Feld
  `kontrolle: [{ tok, zeile, thema? }]` (oder kurz `["pr0532 Name …"]`, nur pr/pp, höchstens 20). RADIX gibt es in der Quittung als
  `programme` weiter – nur wenn ausgeführt (gestartet / angehaengt / laeuft / fertig). Die Kontrollapp (ab R410) liest das Laufbuch
  ohnehin und setzt fehlende Programme beim Kunden unter ihren Balken (wie ein Klick im Finder). RADIX selbst ändert nichts am Kontrollblatt.
- Getestet (19 Fälle, simulierter XM): Leeren 3 → 1 und 0 → 1, Stopp 3 → 1 und 0 bleibt 0, Quittung mit `programme` (auch nach der
  Nachkontrolle), abgelehnter Auftrag ohne `programme`; alle Fälle von 0.9.10/0.9.11 weiter grün.

## Stand Version 0.9.11 (Brücke bleibt 1.2.1) – wartende Liste mit mehreren Durchläufen
- Markus 08.11.2026, Olga (Generator 5): vorbereitete Liste «um 21:00 …» mit **2 Durchläufen** – 0.9.10 lehnte den Handy-Auftrag ab
  («das Programm käme jedes Mal wieder»).
- Neu: Das Neue läuft einmal, das Vorbereitete so oft wie eingestellt. RADIX schreibt dazu die Durchläufe aus (vorbereitete Liste n-mal
  hintereinander, Feld Durchläufe danach 1). Jede Zeitmarke gilt wie bei den Durchläufen selbst als nächste Uhrzeit nach der vorherigen
  (heute 21:00, morgen 21:00); «Start um» gilt nur vor dem ersten Durchlauf, ohne Zeitmarke geht es sofort weiter. Höchstens 14 Durchläufe.
- Quittung: «… (läuft 1-mal, das Vorbereitete 2-mal)». Im Protokoll: «2 Durchläufe des Vorbereiteten ausgeschrieben, Durchläufe jetzt 1».
- Endlosschleife bleibt abgelehnt (das Neue käme jeden Tag wieder).
- Getestet (16 Fälle, simulierter XM): zusätzlich 2 Durchläufe mit Zeitmarke durchgespielt (Happy jetzt, 19:40 Vorbereitetes, warten,
  morgen 19:40 nochmals, Happy nie mehr), «Start um» mit 2 Durchläufen (nicht gestartet und gestartet/wartend). Alle Fälle von 0.9.10 weiter grün.

## Stand Version 0.9.10 (Brücke bleibt 1.2.1) – Handy-Auftrag vor die wartende Liste
Markus 08.11.2026 (Olga, Generator 5, Liste wartet auf «um 21:00»): «wenn wartende Programme sind, das ich trotzdem noch eines oben drauf
packen kann und jetzt starten. Wenn das jetzt gestartete zu lange dauern sollte, stellt es ab und das vorprogrammierte kommt zum zug.»
0.9.9 lehnte das ab («in der Liste steht schon etwas, das nicht läuft») bzw. hängte es hinter das Nachtprogramm.
- **Vorbereitet, nicht gestartet**, Liste beginnt mit einer Zeitmarke (`um 21:00`) oder «Start um» ist gesetzt: die Handy-Zeilen kommen
  oben drauf, «Start um» wird zur Zeitmarke darunter, RADIX startet sofort (`handyVorWartend`). Quittung «gestartet».
- **Gestartet mit «Start um», wartet noch:** gleich, die Startzeit wird zur Zeitmarke mit Datum (`um 21:00 am 08.11.26`).
- **Läuft oder wartet an einer Zeitmarke:** das Neue kommt vor die nächste Zeitmarke ab der laufenden Stelle (wie «→ RADIX» seit 0.9.0,
  `naechsteMarke`). Wartet er dort, startet es sofort («gestartet»), sonst nach dem laufenden Teil («angehaengt»). Ohne Zeitmarke voraus wie bisher hinten dran.
- Dauert das Neue länger als bis zur Zeitmarke, wird es dort abgebrochen und das Vorbereitete läuft pünktlich (gewohnte Zeitmarke).
  Die Quittung sagt es: `abbruch: true`, Text «Achtung: um 21:00 wird es abgebrochen».
- Quittung neu mit `teilEnde` (fertig bzw. Abbruch des Neuen) und `marke` (Uhrzeit der Zeitmarke danach) – `ende` ist weiter das Ende der ganzen Liste.
- Weiterhin abgelehnt, nichts geändert: vorbereitete Liste ohne Startzeit, vorbereitet oder wartend mit mehr als 1 Durchlauf oder Endlosschleife
  (das Neue käme jedes Mal wieder), Lauf in Endlosschleife, Lauf wartet auf «Weiter». Fehler in den neuen Zeilen = Vorbereitetes bleibt wie es war.
- Getestet im Browser mit simuliertem XM (13 Fälle): oben drauf und Start, Abbruch an der Zeitmarke nach 61 min mit Weiterlauf des
  Vorbereiteten, «Start um» (gestartet und nicht gestartet), vor die Marke im Lauf und beim Warten, ganzer Weg über die Auftragsdatei mit
  Nachkontrolle, dazu leere Liste, ohne Zeitmarke, Endlosschleife, falsche Nummer, falscher Kunde (wie 0.9.9). 0.9.9 scheitert an 8 der Fälle.

## Stand Version 0.9.9 (Brücke bleibt 1.2.1) – Handy-Aufträge
Markus 07.11.2026: «Ich bin hier in der pampa am handy. Ich sage dir: opus mach für johanna ein mens Programm … und es läuft.»
- Neues fünftes Feld **Handy-Aufträge**: einmal `RADIX_Auftraege.json` im Ordner «Frequenz Kontrolle» wählen. Nur Claude schreibt
  dort (Desktop-App auf dem Spooky-PC), RADIX liest alle 5 s und führt jeden Auftrag genau einmal aus.
- Auftrag: `{ id, erstellt, gen, kunde?, art: anhaengen|ersetzen|stoppen, zeilen: [...], durchlaeufe?, text? }`.
  - **anhaengen** (Standard): läuft der Generator, kommt es hinten dran; steht er mit leerer Liste, wird gesetzt und gestartet.
    Nie in eine Endlosschleife, nie in eine Liste, die von Hand vorbereitet ist oder auf «Weiter» wartet – dann «abgelehnt», nichts geändert.
  - **ersetzen**: stoppen, Liste ersetzen, starten (nur wenn Markus es so sagt). **stoppen**: nur stoppen, Liste bleibt.
  - `kunde` muss zum Namen im Kontrollblatt passen, sonst «abgelehnt». Älter als 3 Stunden: «verfallen». Generator fehlt: «wartet».
  - Vor dem Start wird die Liste geprüft; Fehler (z. B. Nummer nicht im Finder) = nichts angerührt.
- Programmzeilen eines Auftrags tragen `[Handy]`: ihr Start kommt ins Laufbuch (auch ohne Endlosschleife), die Kontrollapp trägt
  ihn in die Tageszeile ein – mit jedem Loop-Durchgang. `[Handy]` bleibt beim NF/HF-Wechsel erhalten.
- Quittung im Laufbuch, Feld `auftraege`: gestartet / angehaengt / abgelehnt / fehler / verfallen / wartet / gestoppt, nach 30 s
  nochmals: laeuft (mit `ende`) / fertig / gestoppt / fehler. Im Protokoll der Karte steht «📱 Handy-Auftrag».
- Alles andere bleibt wie es war: von Hand bedienen geht genau wie vorher.

## Stand Version 0.9.8 (Brücke bleibt 1.2.1) – Zeitmarken gelten in jedem Durchlauf
- Markus 07.11.2026, Generator 11, 3 Durchläufe mit «um 21:00 … um 06:00»: «das läuft weiter, als ob keine anfangszeit programmiert wäre».
- Ursache: Ab Durchlauf 2 behielt die erste Zeitmarke die Zeit vom Vortag (Fr 21:00, vorbei). Der Durchlauf lief sofort los, die 06:00 war auch
  vorbei, also sprang RADIX gleich ins Morgenprogramm – Nachtprogramme übersprungen, keine Wartezeit. Durchlauf 1 war richtig.
- Neu bekommt jeder Durchlauf frische Zeiten (`durchlaufAb`): erste Zeitmarke = nächste Uhrzeit nach der vom Durchlauf davor (Fr 21:00 → Sa 21:00),
  die übrigen wie immer der Reihe nach (06:00 → So). Ist der Durchlauf davor zu spät fertig, geht es sofort weiter und der Rhythmus bleibt.
- Anzeige: mit Zeitmarken steht schon ab Durchlauf 1 «alles fertig Mo 16.14 Uhr» (Wartezeit eingerechnet) statt «noch 33 h …» ohne Wartezeit.
- Simuliert: Start Fr 18:00, 3 Durchläufe → Fr 21:00, Sa 06:00, Sa 21:00, So 06:00, So 21:00, Mo 06:00, fertig Mo 16:14.

## Stand Version 0.9.7 (Brücke bleibt 1.2.1) – Pausen-Dauer korrigiert
- Markus 06.11.2026: pa60 nach dem Peptid pp0916 zeigte 10 h statt 1 h, Gesamtdauer entsprechend falsch. Ursache: Pause und Schumann übernehmen das Preset des Programms davor; das Peptid-Preset «Mitochondrial Biogenesis (R)» hat Dwell-Multiplikator 10 → 3600 s × 10 = 10 h.
- `erstellePlan(…, { zeitfest: true })`: pa- und sm-Programme laufen genau so lange, wie sie heissen – ohne Dwell-Multiplikator, Force Dwell und Wiederholungen des Presets. Übrige Programme unverändert.

## Stand Version 0.9.6 (Brücke bleibt 1.2.1) – MW violett
- Markus 06.11.2026: «wäre schön wenn das im radix auch violet wäre». MW-Programme aus dem Frequenz-Finder (Apotheke (MW), pr2278–pr3073, Preset MW Emulate (R) - JW) sind jetzt violett wie in Finder und Kontrollapp: Knopf in der Leiste, Preset im Kartenkopf, Laufschrift und Vorschau. Peptide (pp-Nummern) und andere Preset-Programme bleiben grün.
- `farbArt`: neue Art `v` für MW (Schritt mit MW oder Preset mit MW-Faktor, ausser Preset-Programme). Legende «grün Peptid/Preset · violett MW».

## Stand Version 0.9.5 (Brücke bleibt 1.2.1) – «Uhr» hinter der Zeit
- Markus: «hinter zeit bitte Uhr schreiben. sieht auch aus wie ein datum.»
- Status in drei kurzen Zeilen, damit nichts umbricht:
  `pr0076 HF · noch 25 min 00 s · fertig 18.30 Uhr` / `Programm 1/5 · Durchlauf 1/1 · alles fertig Fr 08.29 Uhr` / `Out1 … · Out2 …`
- «Uhr» und Wochentag mit festem Leerschlag (`fmtUhr`). Ablauf unverändert.

## Stand Version 0.9.4 (Brücke bleibt 1.2.1) – Restzeit des laufenden Programms
- Markus: «die anzeige so macht mich nicht ganz glücklich. ich möchte auch wissen wie lange das laufende programm noch dauert.»
- Status im Lauf, oben gross: `pr0076 HF · Programm 1/5 · noch 25 min 00 s · fertig 18.30`. Kommt vorher eine Zeitmarke, endet es dort: «fertig 05.00 (Zeitmarke)».
- Darunter klein: Frequenzen · Durchlauf · «alles fertig Fr 08.29» (im letzten Durchlauf, mit Wartezeit der Zeitmarken). Bei mehreren Durchläufen davor «noch …» wie bisher, bei 0 «endlos».
- Uhrzeit wie in der Kontrollapp («05.08»), an einem anderen Tag mit Wochentag davor.
- Beim Warten an einer Zeitmarke steht darunter «Start in 11 h 07 min».
- Neu `laufZeiten(l)`, `fmtUhr`; `setzeStatus` mit zweiter Zeile. Ablauf selbst unverändert.

## Stand Version 0.9.3 (Brücke bleibt 1.2.1) – Datum bei jeder Zeitmarke, egal woher sie kommt
- Markus: Fixprogramm für morgen, «da fehlt das ganze datum» · «es sollte bei allen gleich gehen»
- Die Vorschau rechnet das Datum neu mit derselben Regel wie der Start (`markenZeiten`), auch `rechneMarken` nutzt sie. Darum gleich für Fixprogramm, Zeile von morgen, «Morgen aus Kontrollblatt», von Hand getippt, mit und ohne Datum in der Zeile, und auf allen Generatoren.
- «Start um» wird mitgerechnet. Ein altes Datum in der Zeile zeigt nicht mehr den vergangenen Tag.
- Schon vorbeigegangene Zeitmarken behalten ihr Datum, auch wenn während dem Lauf etwas dazukommt oder nach dem Neuladen.
- Ist die Uhrzeit vorbei und der Generator nicht gestartet, geht die Vorschau von selbst einen Tag weiter.
- Ablauf und Startzeiten bleiben gleich, geändert hat nur die Anzeige.

## Stand Version 0.9.2 (Brücke bleibt 1.2.1) – Zeitmarke mit ausgeschriebenem Datum
- Markus: «was noch perfekter wäre ist, wenn stehen würde: Start um 6.00 Uhr am Freitag 06.11.26»
- Die Zeitmarke in der Vorschau zeigt jetzt «Start um 06:00 Uhr am Freitag 06.11.26» statt «Start um 06:00 (Fr., 06:00)» (`fmtStart`).
- Gleich auch im gelben Status und im Protokoll: «Wartet bis 06:00 Uhr am Freitag 06.11.26».
- Während dem Lauf kommt das Datum aus dem Zeitplan, sonst aus «um 06:00 am 06.11.26» in der Zeile; ohne beides nur «Start um 06:00 Uhr».
- Sonst nichts geändert.

## Stand Version 0.9.1 (Brücke bleibt 1.2.1) – Durchläufe gehen nach dem Lauf zurück auf 1
- Markus: «wenn ich die durchläufe auf mehr als 1 stelle, ich vergesse das immer zurück zu stellen.»
- Sind alle Durchläufe gemacht («fertig»), steht das Feld «Durchläufe» wieder auf 1 (`leereNachLauf`), zusammen mit der geleerten Liste und dem leeren «Start um». Im Protokoll steht es.
- Unverändert: 0 = endlos bleibt 0, weil dieser Lauf nie fertig wird. Stopp von Hand lässt Zahl und Liste stehen, der Lauf ist ja nicht fertig; «Start» beginnt ihn neu.

## Stand Version 0.9.0 (Brücke bleibt 1.2.1) – Programm am Nachmittag vor das Nachtprogramm
- Markus: «programme sind gelaufen bis mittag, programmiert ist die nacht bereits. wenn ich am nachmittag noch ein programm machen möchte, hängt das am nachtprogramm an.»
- Die Stelle in der Tageszeile gilt jetzt auch in der Programmliste: Steht ein neues Programm über einer schon gesendeten Zeitmarke, kommt es in RADIX vor die nächste solche Marke (`kontrolleGruppen`, `markeZeile`). Steht es darunter, wie bisher ans Ende.
- Wartet der Generator an dieser Zeitmarke, startet das Programm ohne Stop sofort; danach wartet er weiter bis zur Zeitmarke (`uebernimmImLauf`). Läuft gerade ein Programm, kommt das Neue direkt danach.
- Reicht die Zeit bis zur Zeitmarke nicht, kommt eine rote Meldung: um diese Uhrzeit wird das Programm abgebrochen (`zuLang`).
- Bei Endlosschleife bleibt das Programm wie bisher in der Liste und läuft jeden Durchgang mit.
- Zur Kontrollapp ab R404 (sie setzt Einzelprogramme über die nächste kommende Zeitmarke).

## Stand Version 0.8.9 (Brücke bleibt 1.2.1) – blauer Balken folgt wieder dem laufenden Programm
- Fehler aus 0.8.7: Beim Umbau der Protokollzeile «Programm x/y» war `this.markiereAktiv()` in den Kommentar gerutscht. Der blaue Balken blieb darum beim ersten Programm stehen. Jetzt springt er wieder bei jedem Programmwechsel mit.
- Neu: Knopf **«Alle fortsetzen»** oben neben «Alle stoppen». Er erscheint nach dem Neuladen (z. B. neue Version), solange Generatoren «Unterbrochen bei Schritt …» zeigen, und lässt alle mit einem Klick dort weiterlaufen, wo sie standen – gleich wie «Weiter» auf jeder Karte, nacheinander mit 0,25 s Abstand. Die Zeit während dem Neuladen wird nicht mitgezählt.

## Stand Version 0.8.8 (Brücke bleibt 1.2.1) – Fensterleiste grau
- Der blaue Balken zuoberst (Fensterleiste der installierten App) ist jetzt hellgrau `#dee2f0` wie beim Kontrollblatt und beim Frequenz-Finder. app.js setzt dafür `<meta name="theme-color">`, das geht dem `theme_color` im Manifest vor. index.html und manifest.webmanifest bleiben unverändert.
- Sonst nichts geändert.

## Stand Version 0.8.7 (Brücke bleibt 1.2.1) – Programm-Zähler ohne Zeitmarke
- Status und Protokoll zählten die Zeitmarke («um 6.00») als Programm mit: Kopf «5 Programme», unten «Programm 6/6». Jetzt zählen beide nur Programme (`progNr`, `progAnz`), also «Programm 5/5». «loop-3» zählt weiter als 3 Programme, wie in der Liste.
- Nur Anzeige – Laufzeiten, «pro Durchlauf», Restzeit und Ablauf bleiben gleich (die waren richtig).
- kern.js unverändert.

## Stand Version 0.8.6 (Brücke bleibt 1.2.1) – Zeitmarke geht nicht mehr verloren
- **Zeit fehlte (Gen. 10, 13):** RADIX merkt sich pro Tag jede schon erhaltene Zeitmarke. Wurde ein Block mit gleicher Zeit nochmals gesendet oder nach «Leeren» wieder gebraucht, kamen nur die Programme an und liefen beim Start sofort los. Neue Programme nehmen jetzt ihre Zeitmarke aus der Tageszeile mit (`kontrolleMitMarke`), auch wenn sie schon gesehen wurde. Sie kommt nicht dazu, wenn sie in der Programmliste schon die letzte ist (sonst läge der Block auf dem Tag danach) oder wenn die Zeit vorbei ist.
- **Zeile von morgen lief heute:** Eine Zeitmarke, deren Uhrzeit heute noch kommt, galt für heute. Die erste Zeitmarke der Zeile von morgen bekommt dann das Datum: `um 21:00 am 04.11.26` (`morgenDatumSetzen`). Ist das Datum vorbei, gilt wieder die nächste Uhrzeit (Endlosschleife).
- Hinweis «Anhängen» (Haken aus): verschiedene Zeitmarken werden nicht mehr als dieselbe gezählt.
- Aus einer Tageszeile kopierter Text lässt sich in die Programmliste einfügen: Zeilen langer Namen werden zusammengesetzt, kein «Nicht erkannt» mehr, NF/HF bleibt.
- Passt zur Kontrollapp ab R397. R398 setzt die Zeit auch bei einer Ergänzung in die Zwischenablage.

## Stand Version 0.8.5 (Brücke bleibt 1.2.1) – nur noch «→ RADIX» schickt Programme her
- Der Sendeautomat ist weg. Ein Doppelklick im Kontrollblatt schreibt nur noch in die Tageszeile, dort kann man in Ruhe korrigieren. Erst der Knopf **«→ RADIX»** der Zeile (Kontrollapp ab R397) schickt sie los.
- Technik: Der Knopf setzt `days[n].rxT = Date.now()` und speichert sofort. RADIX merkt sich den Stempel (`uebernommen.rxT`, `uebernommenMorgen.rxT`) und nimmt nur bei geändertem Stempel das noch nicht Gesehene dieser Zeile. `K.kontrolleSendeStempel(blatt, datum)` liest ihn.
- Bleibt gleich: Nachträge kommen als Neues hinten dran (erkannt an Nummer + Uhrmarke), «Heute/Morgen aus Kontrollblatt» und der Haken pro Generator wirken wie bisher, gestartet wird von Hand.
- Morgen braucht weiterhin zuoberst «um 6.00». Die Kontrollapp sperrt den Knopf sonst; RADIX meldet es zur Sicherheit trotzdem.
- **Kontrollapp ab R397 nötig.** Mit einer älteren Kontrollapp kommt nichts mehr automatisch an.

## Stand Version 0.8.4 (Brücke bleibt 1.2.1) – vier gleiche Quellen-Felder
- Spooky2, Frequenz-Finder, Kontrollblatt und Laufbuch sind vier gleich breite klickbare Zweizeiler: oben Name und was der Klick macht («Datei wählen», «Zugriff erlauben»), unten der Stand. Das ganze Feld ist der Knopf.
- Laufbuch hat ein eigenes Feld (vorher in das Kontrollblatt-Feld geklemmt, darum stand dessen Knopf halb draussen).
- Fenster bis 1000 px breit: zwei Reihen à zwei Felder, bis 520 px untereinander. Zu langer Stand wird mit «…» gekürzt, ganzer Text beim Drüberfahren.
- Nur Darstellung, am Ablauf ändert sich nichts.

## Stand Version 0.8.3 (Brücke bleibt 1.2.1) – Peptid-Liste nach dem Ordner Remote
- `peptide.js` neu aus dem Ordner `JW_Peptides\Remote` des RADIX-PC: 2012 Programme, alle lesbar, dazu 20 ältere Nummern, die auf ihr Nachfolge-Programm zeigen (z. B. pp0004 → Acid Reflux (Gastroesophageal Reflux Disease)). 10 alte Nummern ohne Datei und die Nummern ab pp1514 ohne Datei sind entfernt.
- Preset-Namen genau wie in den Dateien (auch «–»).
- `kern.js`: ein leeres «M» in einer Preset-Datei wird übersprungen (Cochlear Hair Cells, pp0299, lief sonst nicht).

## Stand Version 0.8.2 (Brücke bleibt 1.2.1) – Peptid-Nummern bis pp2294, verschlüsselte Presets
- `peptide.js`: alle Nummern pp0001–pp2294 mit den deutschen Namen aus dem Peptide-Finder v10. Bei pp0001–pp1513 bleibt der Preset-Name wie in den Dateien auf dem Spooky-PC.
- Die JW-Presets ab Version 20261028 sind verschlüsselt (Einträge wie `~4472M089.234`). RADIX spielt sie nicht ab: Sonst liefen nur die Pausen. Neu: Fehler «ppxxxx: Preset-Datei ist verschlüsselt, RADIX kann sie nicht abspielen», Start gesperrt.
- Die neuen Presets deshalb NICHT auf dem RADIX-PC installieren: Sie überschreiben die lesbaren Dateien.

## Stand Version 0.8.1 (Brücke bleibt 1.2.1) – loop: ein Programm mehrmals hintereinander
- Markus 02.11.2026: «um 21.00, prxxx, loop-10, prxxx, prxxx»: Zeile `loop-10` (auch `loop 10`, `loop10`, `loop-10x`, 1–999) gilt nur für das Programm direkt darunter. In der Liste und in der Tageszeile der Kontrollapp
- Umsetzung: `bereiteListeVor` macht aus dem Programm 10 Einträge mit gleicher Zeile (`lauf`, `laeufe`), Name «… · Lauf 3/10». Preset-Wechsel, Zeitmarken, Weiter-Knopf, Protokoll und Laufbuch laufen darum wie bei 10 einzelnen Zeilen
- Ist der Loop vor der nächsten Zeitmarke fertig: Ausgänge aus, warten. Läuft er noch: Abbruch an der Zeitmarke, weiter nach Zeitplan
- Kopplung: `loop-10` zuunterst in der Tageszeile wartet, bis ein Programm darunter steht. Danach übernommen wie jeder andere Eintrag
- `loop-10` ohne Programm darunter (Listenende oder Zeitmarke): Warnung, Start gesperrt

## Stand Version 0.8.0 (Brücke bleibt 1.2.1) – Kontrollblatt-Einträge erkannt statt gezählt
- Markus 02.11.2026, Manuela Gen 15: sm30 14-mal in der Liste. Zwei Kontrollapp-Fenster schrieben abwechselnd die Sicherung, einmal mit und einmal ohne sm30; die Kopplung zählte nur die Einträge der Zeile, also galt jedes Wiederauftauchen als neu
- `kontrolleNeu` / `kontrolleGesehen` (kern.js): Eintrag = Nummer + unsichtbare Uhrzeit (Zeitmarken: «um 05:30»), mit Anzahl, falls derselbe Eintrag zweimal in derselben Minute steht. Was einmal übernommen wurde, bleibt gesehen, auch wenn es kurz aus der Datei verschwindet. `uebernommen`, `uebernommenMorgen` und `geleert` tragen dazu `gesehen`; alte Stände ohne `gesehen` werden beim ersten Blick aus `anzahl` ergänzt
- Eintrag ohne Uhrzeit (von Hand getippt), der sie später bekommt, zählt als derselbe Eintrag
- Weiterhin zweimal: eine ganze Zeile, die von Hand in den Tag davor oder danach verschoben wird (andere Zeile = neue Einträge)

## Stand Version 0.7.9 (Brücke bleibt 1.2.1) – Endlosschleife trägt ins Kontrollblatt ein
- Markus 01.11.2026: Kunden auf Endlosschleife (täglich gleiche Programme mit Zeitmarken) – RADIX soll die gelaufenen Programme selbst in die Tageszeile der Kontrollapp bringen, **beim Start** des Programms
- **Neue Quelle «Laufbuch»** im Kopf, gleich nach dem Kontrollblatt (einmal «Laufbuch wählen» → `RADIX_Laufbuch.json` neben `Frequenz_Kontrolle.json` anlegen; wird gemerkt, nach Neustart evtl. «Zugriff erlauben»)
- Bei **Durchläufe 0 (endlos)** schreibt RADIX jeden Programmstart (pr/pp/pa/sm, mit NF/HF, Startzeit, Dauer, Generator-Nummer) ins Laufbuch – einmal pro Programm und Durchlauf, nicht beim Fortsetzen mitten im Programm (`lauf.geloggt` im Stand). Zeitmarken und eigene Frequenzzeilen ohne Nummer nicht. Mit festen Durchläufen (1, 2, 4 …) kommt nichts ins Laufbuch
- RADIX schreibt **nicht** in die Sicherungsdatei des Kontrollblatts (zwei Schreiber würden sich überschreiben). Die Kontrollapp (ab R381) liest das Laufbuch und trägt ein
- Ohne gewähltes Laufbuch warten die Starts im Browser (`radix-laufbuch-offen`) und kommen nach dem Wählen in die Datei. Zusammenfassung der Karte: «endlos · Starts gehen ins Kontrollblatt» bzw. «⚠ oben «Laufbuch» wählen …». Protokoll: «→ Kontrollblatt (Endlosschleife): pr2262 NF»
- Laufbuch behält 4 Tage (`laufbuchMischen`), Datei: `{radix, stand, eintraege:[{id, t, gen, code, var, name, sek, dl}]}`
- **Kopplung:** Zeilen, die die Kontrollapp aus dem Laufbuch eingetragen hat, tragen hinter der Uhrzeit das unsichtbare Zeichen U+E0052 (`K.LAUF_MARKE`). `kontrolleHeute` lässt sie aus → Doppelklick-Kopplung, «Heute/Morgen aus Kontrollblatt» und Leeren zählen nur Geplantes; nichts wird ein zweites Mal angehängt
- Getestet: Kern in Node (Markierung, Filter, Mischen), Browser mit simuliertem XM: 2 Programme endlos → je Durchlauf genau ein Eintrag in Reihenfolge, ohne Laufbuch wartend und nachgeschrieben, Durchläufe 2 → nichts, Kopplung mit eingetragener Zeile → nur das geplante Programm kommt, Fortsetzen → kein zweiter Eintrag

## Stand Version 0.7.8 (Brücke bleibt 1.2.1) – Dual genau wie Spooky2 (Mitschnitt 31.10.)
- Mitschnitt Spooky2 mit pr0245 und Killing (Dual) (R) - JW (54 min, `claude/dual/mitschnitt_dual.md`): Out2 spielt den nächsten Eintrag (auch Sweeps) – wie 0.7.7. **Dauer eines Paars = Zeit des Out1-Eintrags**; ein Sweep auf Out2 läuft in dieser Zeit ganz durch (112 mit 180 s + `120-128=600` → Sweep in 180 s)
- RADIX macht es jetzt genau so (0.7.7 nahm den längeren Eintrag). pr0245 Dual: 40 min wie Spooky2 (0.7.7: 1h 22min)
- Getestet: `dual078.test.js` 5 ✓ (alle 11 Paare von pr0245 mit Frequenzen und Dauer wie im Mitschnitt), `v078_test.py` 10 ✓ (Lauf im Browser, Dual und Normal nebeneinander)

## Stand Version 0.7.7 (Brücke bleibt 1.2.1) – Dual wie Spooky2 (auch Sweeps)
- **Dual-Presets** (Killing (Dual), Healing (Dual), DNA (Dual) …, Knopf «Dual» in der Vorschau) laufen jetzt wie das Original: Out1 spielt einen Eintrag, Out2 **gleichzeitig den nächsten** – Einzelfrequenz **oder Sweep**. Bisher liefen Sweeps im Dual auf beiden Ausgängen gleich (Entscheid 29.10. aufgehoben, Markus 31.10.: «original Dual-Modus besser»)
- Programme mit vielen Sweeps sind im Dual jetzt etwa halb so lang (vorher nur wenig kürzer)
- Ein Paar dauert so lange wie der **längere** der beiden Einträge (**in 0.7.8 ersetzt**: Zeit von Out1 wie Spooky2)
- Ungerade Anzahl oder Pause danach: letzter Eintrag auf beiden Ausgängen (wie bisher)
- Hinweis «Sweep in Dual-Preset: Out2 läuft gleich wie Out1» entfällt
- Ohne Dual: unverändert
- Getestet: `dual077.test.js` 7 ✓ (echte Spooky2-Presets), `v077_test.py` 9 ✓ (App im Browser, Lauf mit Dual- und Normal-Preset nebeneinander, Befehle an die Generatoren geprüft). GX: Out1/Out2 getrennt (`:w24`/`:w25`) geprüft, am Gerät noch nicht

## Stand Version 0.7.6 (Brücke bleibt 1.2.1) – Farbe je Programm
- Rot = Killing, blau = Healing, **grün = Preset-Programm oder MW** (z. B. Peptide «Dry Mouth (R)», MW-Presets). Gilt überall gleich: Knopf in der Leiste (pastell, kräftiger Rand), Preset-Anzeige, Laufschrift unter den Einstellungen und Preset-Name in der Vorschau. Wechselt das Programm, wechselt die Farbe mit.
- «Start» pastellgrün mit kräftigem grünem Rand. Legende «… grün Preset/MW …».
- Nur Aussehen, Ablauf unverändert. Test v076_test.py (23 Prüfungen) grün.

## Stand Version 0.7.5 (Brücke bleibt 1.2.1) – Farben Leiste und Knöpfe
- Leiste: Killing pastellrot mit kräftig rotem Rand, Healing pastell-royalblau mit kräftig blauem Rand – heben sich vom blauen Kopf und vom Stopp-Knopf ab.
- Störung (GX gesperrt, belegt, Lauf abgebrochen) jetzt **orange** umrandet statt rot, damit sie nicht wie Killing aussieht. Legende angepasst.
- «Alle stoppen» oben und «Stopp» in der Karte weiss wie die übrigen Knöpfe, rote Schrift. «Start» pastell-royalblau mit blauem Rand.
- Nur Aussehen, Ablauf unverändert. Test v075_test.py (15 Prüfungen) grün.

## Stand Version 0.7.4 (Brücke bleibt 1.2.1) – ausgeschaltete Generatoren einheitlich blass
- Leiste: Ein ausgeschalteter Generator ist blass gestrichelt («aus»), egal ob Windows seinen USB-Anschluss noch sieht (XM ohne Strom, Chip am USB) oder gar nicht. Bisher war der erste Fall rot umrandet.
- Rot umrandet heisst jetzt nur noch Störung: GX gesperrt, Anschluss belegt, Lauf mit Fehler abgebrochen (Verbindung verloren). Bleibt rot, bis er wieder verbunden ist.
- Einschalten genügt: wird von selbst bzw. mit «Testen» wieder weiss. Test v074_test.py (15 Prüfungen) und alle bisherigen Tests grün.

## Stand Version 0.7.3 (Brücke bleibt 1.2.1) – Pausen wie Spooky2, ruhige Anzeige
- **Pausen** (`0=4` in Peptiden, pa15–pa60, `0=…` in eigenen Zeilen): Ausgänge bleiben an, nur die Spannung ist 0 V – wie Spooky2 (Mitschnitt: Spooky2 schaltet die Ausgänge nur bei Start und Stopp). Beim Warten auf eine Startzeit («um 6.00») bleiben die Ausgänge aus
- **Anzeige hüpft nicht mehr:** Statuszeile im Lauf fest zwei Zeilen hoch, in der MW-Lücke bleibt die Frequenzanzeige stehen

## Stand Version 0.7.2 (Brücke bleibt 1.2.1) – MW-Lücke wie Spooky2
- **Fehler behoben (am Gerät 29.10., 11:10, pp1334):** Bei Peptiden/MW schaltete RADIX zwischen den Aminosäuren jede Sekunde die Ausgänge aus und ein. Jetzt wie Spooky2: Ausgänge bleiben an, nur die Spannung geht für 0,28 s auf 0 V und dann zurück
- Protokoll wird bei MW-Programmen nicht mehr mit jeder Aminosäure gefüllt (nur Programmstart)

## Stand Version 0.7.1 (Brücke bleibt 1.2.1) – Peptid-Nummern pp0001–pp1513
- **pp-Nummern** aus dem Peptide-Finder v7 / Kontrollblatt R361 laufen wie pr-Nummern: eintippen (`pp0004`, `pp4`), Doppelklick im Kontrollblatt, «Heute/Morgen aus Kontrollblatt», «Programme des Kunden»
- RADIX ordnet die Nummer dem Spooky2-Preset zu (pp0004 → «Acid Reflux (R)» aus `C:\Spooky2\Preset Collections\JW_Peptides`) und spielt dessen Programme mit der MW-Umrechnung aus 0.7.0. Preset kommt automatisch mit
- Neue Datei **`peptide.js`** (Liste der 1513 Nummern, fest). Neue Peptide bekommen im Finder die nächste Nummer – dann `peptide.js` ergänzen
- Meldungen: «pp9999 nicht in der Peptid-Liste», «Peptid-Preset «…(R)» nicht im Spooky2-Ordner»

## Stand Version 0.7.0 (Brücke bleibt 1.2.1) – MW-Programme (Peptide, MW Emulate)
- **MW-Frequenzen (`M113.084` …) laufen jetzt**, mit jedem Preset, das einen MW-Faktor hat (Peptid-Presets, MW Emulate, Protein, MW Remove, DNA, Killing Low Freq). Regel aus dem Spooky2-Mitschnitt vom 29.10.2026, alle 165 gemessenen Schritte stimmen auf 0,01 Hz:
  - Hz = Dalton × 2,2523430883 × 10²³
  - Out1 («Odd»): durch 3, 9, 27 … bis unter 5 MHz · Out2 («Octave»): durch 2, 4, 8 … bis unter 5 MHz
  - jede Aminosäure 1 s, vor jedem Schritt 0,28 s 0 V (wie Spooky2), `0=4` = 4 s Pause
  - Wellenform bei MW-Presets wie Spooky2: Out1 umgedreht, Out2 die Inverse davon
- **Preset-Name als Zeile:** `Adenoiditis (R)` in die Programmliste schreiben → RADIX spielt die Programme dieses Spooky2-Presets mit dessen Einstellungen (wie Spooky2)
- MW-Zeile mit einem Preset ohne MW-Faktor (z. B. Healing): Start gesperrt, Hinweis «MW-Preset wählen»
- **Wellentabellen jetzt genau wie Spooky2** (511,5 + 511,5 × Wert, «Inverse» = 1023 − Wert): die GX-Tabellen aus dem Mitschnitt vom 28.10. stimmen Wert für Wert (vorher ±1)
- «Odd» bedeutet bei Spooky2 «durch 3 teilen» (nicht 3, 5, 7 …). Betrifft nur Frequenzen über 5 MHz, also praktisch nur MW
- Am Gerät noch nicht geprüft: MW auf den GX (1, 2, 23, 24)

## Stand Version 0.6.9 (Brücke bleibt 1.2.1) – Dual pro Programm, frischer Tag, Kopfleiste
- **Knopf «Dual»** in der Vorschau bei jedem Programm, zu dessen Preset es eine Dual-Variante gibt (Killing (R) - JW → Killing (Dual) (R) - JW, Healing → Healing (Dual)). In der Liste steht dann `[Dual]` am Zeilenende; «Dual aus» stellt zurück. Auch während dem Lauf für Programme, die noch nicht dran waren. Dual: Out2 spielt jeweils die nächste Frequenz, Laufzeit etwa halb so lang
- **Nach «Fertig»** (alle Durchläufe gelaufen) leert RADIX die Programmliste und «Start um». Was lief, steht im Protokoll; die Einträge von heute im Kontrollblatt gelten als erledigt. Die Zeile von morgen bleibt offen. Stopp von Hand leert nicht
- **Kopfleiste:** Nummern in 2 Reihen à 12 mit mehr Abstand, der weisse Rahmen des gewählten Generators berührt die Nachbarn nicht mehr
- Enthält 0.6.8 (Zeile von morgen aus dem Kontrollblatt)

## Stand Version 0.6.8 (Brücke bleibt 1.2.1) – Zeile von morgen aus dem Kontrollblatt
- **Doppelklicks in die Zeile von morgen** kommen jetzt auch an, sobald dort zuoberst eine Startzeit steht (`um 6.00`). Ohne Startzeit zuoberst: Hinweis, nichts angehängt
- Neues von heute kommt in der Programmliste **vor** den Block von morgen (läuft also noch heute)
- **«Heute aus Kontrollblatt»** bringt die Zeile von heute und die Zeile von morgen (wenn sie mit einer Startzeit beginnt)
- **«Morgen aus Kontrollblatt»** braucht kein «Start um» mehr, wenn die Zeile von morgen mit einer Startzeit beginnt
- Tageswechsel: Was gestern schon als «morgen» übernommen wurde, wird heute nicht nochmals angehängt
- Steht am Listenende eine Startzeit ohne Programm danach, wird sie durch die neue ersetzt (keine doppelte «um 06:00»). Zwei gleiche Startzeiten direkt hintereinander gelten als derselbe Zeitpunkt

## Stand Version 0.6.7 (Brücke bleibt 1.2.1) – Zeitmarke aus dem Kontrollblatt, Sprung beim Doppelklick
- **Zeitmarke im Kontrollblatt:** Eine Zeile `um 6.00` (auch `um 06:00`, `ab 6:00`, `um 6.00 Uhr`) in der Tageszeile kommt mit «Heute aus Kontrollblatt», «Morgen aus Kontrollblatt» und dem Doppelklick in die Programmliste. Programme davor laufen sofort, danach wartet der Generator mit Ausgängen aus bis zu dieser Uhrzeit. `6.00` allein ist keine Zeitmarke (wird übergangen)
- **Doppelklick im Kontrollblatt** springt in RADIX gleich zum Generator dieses Blatts. Andere Änderungen im Kontrollblatt (Notiz usw.) lösen keinen Sprung aus
- Sprung schon beim Anwählen eines Blatts im Kontrollblatt: geht, sobald das Kontrollblatt `"aktiv"`/`"aktivZeit"` in die Datei schreibt (dort noch zu bauen)

## Stand Version 0.6.6 (Brücke bleibt 1.2.1) – GX Pro: Takt wie Spooky2
- **Fehler behoben (am Gerät 28.10., 17:41):** Erster GX-Lauf brach beim Einrichten ab («Out1 auf Tabelle 14: keine Antwort»). Der GX bestätigt eine Wellentabelle sofort, ist danach aber kurz taub – der nächste Befehl ging verloren. RADIX wartet jetzt wie Spooky2: 100 ms nach jedem GX-Befehl, 300 ms nach jeder Wellentabelle
- Kommt trotzdem keine Antwort, schickt RADIX den Befehl einmal nochmals (steht im Protokoll: «keine Antwort … nochmals gesendet»). Erst wenn auch das ausbleibt, Abbruch mit Meldung
- **Stopp mitten in einem Schritt** (XM und GX): Befehle des gestoppten Laufs werden nicht mehr nachgeschickt. Vorher konnte z. B. «Ausgang ein» nach den Stopp-Befehlen ankommen
- XM sonst unverändert

## Stand Version 0.6.5 (Brücke bleibt 1.2.1) – GX Pro läuft mit RADIX
- GeneratorX Pro (1+2, 23+24) startet jetzt Programme wie die XM. Befehle aus zwei USB-Mitschnitten von Spooky2 (28.10.2026): Wellentabelle Out1 (:a11–:a21 nach Wellenform, z. B. Inverted Sawtooth = 14), Out2 Tabelle 25 (gespiegelt), Sync :w14, Gate aus :w12, Amplitude :w28/:w29 (V × 100), Offset :w32/:w33 (120 + %), vor jeder neuen Frequenz :w13=0, Frequenz :w24/:w25 (gleiche Zahlen wie Spooky2), Ausgänge :w11 je Kanal
- Amplitude wird wie bei Spooky2 begrenzt, damit Amplitude + Offset höchstens 20 V ergibt (Offset ±100 % → höchstens 10 V)
- **Freischaltung:** Nach Strom aus/ein am GX muss Spooky2 ihn einmal freischalten (starten, warten bis der GX da ist, schliessen). Sonst antwortet der GX mit «:err» – RADIX meldet das («GX Pro gesperrt») und startet nicht
- RADIX öffnet den GX-Anschluss erst bei Start oder Testen und gibt ihn nach dem Stopp wieder frei. Doppelklick im Kontrollblatt geht jetzt auch für GX-Nummern. «Alle testen» testet auch die GX (Display zeigt die Nummer)
- Noch nicht auf dem GX: Phase, Out2 mit Faktor/Konstante (Start gesperrt mit Meldung); WCM, Spektrum, F2, Gate wie beim XM

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
