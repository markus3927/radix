/* RADIX Frequenzsteuerung – Kern
 * Liest Spooky2-Presets, Frequenz-Finder und Kontrollblatt, berechnet Einstellungen, Ablauf und Generator-Befehle.
 * Reine Funktionen ohne Gerät, im Browser und in Node testbar.
 * Idee, Konzept & Architektur Markus Rufer · Technische Umsetzung. Claude by Anthropic
 */
(function (root) {
  'use strict';

  const STANDARD_DWELL = 180;          // Sekunden je Frequenz ohne eigene Zeitangabe (Spooky2-Standard, Custom.csv Feld 8)

  // ------------------------------------------------------------------ Presets lesen
  const MEHRFACH = new Set(['Loaded_Programs', 'Loaded_Frequencies']);

  /** Text einer Preset-Datei -> Liste von Presets (Objekte Schlüssel -> Wert). */
  function lesePresets(text) {
    const presets = [];
    let aktuell = null, puffer = null;
    for (const zeile of text.split(/\r?\n/)) {
      if (puffer === null) {
        if (!zeile.startsWith('"')) continue;
        puffer = zeile.slice(1);
      } else {
        puffer += '\n' + zeile;
      }
      if (!puffer.endsWith('"')) continue;
      const inhalt = puffer.slice(0, -1);
      puffer = null;
      const i = inhalt.indexOf('=');
      if (i < 0) {
        const marke = inhalt.trim();
        if (marke === '[Preset]') aktuell = {};
        else if (marke === '[/Preset]' && aktuell) { presets.push(aktuell); aktuell = null; }
        continue;
      }
      if (!aktuell) continue;
      const k = inhalt.slice(0, i).trim(), v = inhalt.slice(i + 1);
      if (MEHRFACH.has(k) && k in aktuell) aktuell[k] += '\n' + v;   // ein Programm pro Zeile
      else aktuell[k] = v;
    }
    if (aktuell) presets.push(aktuell);
    return presets;
  }

  /** Katalog aus Dateien [{pfad: 'JW_Peptides\\Shells\\Remote.txt', text}] für Base_Preset-Suche. */
  function baueKatalog(dateien) {
    const katalog = new Map();
    const merke = (schluessel, p) => { const s = schluessel.toLowerCase(); if (!katalog.has(s)) katalog.set(s, p); };
    for (const { pfad, text } of dateien) {
      const rel = pfad.replace(/\//g, '\\').replace(/\.txt$/i, '');
      const teile = rel.split('\\').filter(Boolean);
      for (const p of lesePresets(text)) {
        if (p.PresetName) merke(p.PresetName, p);
        for (let i = 0; i < teile.length; i++) merke(teile.slice(i).join('\\'), p);
      }
    }
    return katalog;
  }

  /** Base_Preset auflösen: erst Basis, dann eigene Werte darüber. */
  function loeseBasis(preset, katalog, tiefe = 0) {
    const basis = preset.Base_Preset;
    if (!basis || tiefe > 5) return { preset: { ...preset }, basis: null, fehlt: null };
    const pfad = basis.replace(/\//g, '\\').replace(/^\\+/, '').toLowerCase();
    const teile = pfad.split('\\');
    let b = null;
    for (let i = 0; i < teile.length && !b; i++) b = katalog.get(teile.slice(i).join('\\')) || null;
    if (!b) return { preset: { ...preset }, basis: null, fehlt: basis };
    const voll = loeseBasis(b, katalog, tiefe + 1);
    return { preset: { ...voll.preset, ...preset }, basis, fehlt: voll.fehlt };
  }

  // ------------------------------------------------------------------ Einstellungen
  // Spooky2-Wellenform -> Datei in C:\Spooky2\Waveforms (ohne .csv)
  const WELLEN = [
    ['Sine', 'Sine'], ['Square', 'Square'], ['Sawtooth', 'Sawtooth'],
    ['Inverted_Sawtooth', 'Inverted Sawtooth'], ['Triangle', 'Triangle'],
    ['Sine_Damped', 'Sine Damped'], ['Square_Damped', 'Square Damped'],
    ['Sine_Hbomb', 'H-Bomb Sine'], ['Square_Hbomb', 'H-Bomb Square'],
    ['User_Defined_1', null], ['User_Defined_2', null],
  ];
  const zahl = (v, std = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : std; };
  const wahr = (v) => String(v).toLowerCase() === 'true' || v === '1';

  function aktiveWellen(p, out) {
    const liste = [];
    for (const [typ, datei] of WELLEN) {
      let k = `${out}_${typ}`;
      if (out === 'Out2' && typ === 'Triangle') k = 'Out_2_Triangle';    // Spooky2-Schreibweise
      if (!wahr(p[k])) continue;
      const name = datei || String(p[`${typ}_Waveform`] || '');
      const wcmKey = typ === 'Sine_Damped' ? 'Sine_Damped_WCM' : `${typ}_WCM`;
      liste.push({ typ, datei: name, wcm: zahl(p[wcmKey], 1), spektrum: zahl(p[`${typ}_Spectrum`], 0), invertiert: false });
    }
    return liste;
  }

  /**
   * Frequency Wobble (VORLÄUFIG, am Gerät noch nicht gegen Spooky2 geprüft):
   * Dreieck in «stufen» Schritten, ein Schritt pro Gate-Takt (Hz_Gate, Spooky2-Anleitung: «Speed is set by the Gate Hz rate»),
   * Ausschlag ± halbe Prozentzahl (Frequenz-Finder: «0,25 % … wobbelt ±0,125 % um jede Frequenz»).
   */
  const WOBBLE_HALBER_AUSSCHLAG = true;
  function wobbleAus(prozent, p = {}) {
    if (!(prozent > 0)) return null;
    return { prozent, stufen: Math.max(1, Math.round(zahl(p.Settings_Frequency_Wobble_Steps, 16))), hz: zahl(p.Hz_Gate, 4) > 0 ? zahl(p.Hz_Gate, 4) : 4, typ: 'Triangle' };
  }
  /** Faktor, mit dem die Frequenz nach t Sekunden multipliziert wird (1 = keine Änderung). */
  function wobbleFaktor(w, t) {
    if (!w) return 1;
    const s = w.stufen;
    const k = ((Math.floor(t * w.hz) % s) + s) % s;
    const dreieck = s === 1 ? 0 : (k < s / 2 ? -1 + 4 * k / s : 3 - 4 * k / s);   // -1 … +1 … -1
    return 1 + dreieck * (w.prozent / 100) * (WOBBLE_HALBER_AUSSCHLAG ? 0.5 : 1);
  }
  /** Index des Wobble-Takts nach t Sekunden (für «nur bei Änderung senden»). */
  const wobbleTakt = (w, t) => (w ? Math.floor(t * w.hz) : -1);

  /** Alle Einstellungen eines (aufgelösten) Presets, die für Remote zählen. */
  function einstellungen(p) {
    const warnungen = [];
    const w1 = aktiveWellen(p, 'Out1');
    let w2 = aktiveWellen(p, 'Out2');
    if (w1.length !== 1) warnungen.push(w1.length ? `Out1 hat ${w1.length} Wellenformen gleichzeitig (noch nicht unterstützt)` : 'Out1 hat keine Wellenform');
    let welle2 = null;
    if (w2.length === 1) {
      welle2 = w2[0];
      if (wahr(p.InverseWave)) welle2 = { ...welle2, invertiert: true };
    } else if (w2.length > 1) {
      warnungen.push(`Out2 hat ${w2.length} Wellenformen gleichzeitig (noch nicht unterstützt)`);
    } else if (w1[0]) {
      if (wahr(p.Out2_Follow_Out1_Wave) || wahr(p.Follow_Out1_Wave)) welle2 = { ...w1[0] };
      else if (wahr(p.InverseWave)) welle2 = { ...w1[0], invertiert: true };
      else { welle2 = { ...w1[0] }; warnungen.push('Out2 ohne eigene Wellenform, nehme Out1'); }
    }
    for (const w of [w1[0], welle2]) {
      if (w && w.wcm !== 1) warnungen.push(`Wellenform ${w.datei} mit WCM ${w.wcm} (noch nicht unterstützt)`);
      if (w && w.spektrum) warnungen.push(`Wellenform ${w.datei} mit Spektrum ${w.spektrum} % (noch nicht unterstützt)`);
    }

    let out2;
    if (wahr(p.Out2_Run_Every_Second_Frequency)) out2 = { art: 'dual' };
    else if (wahr(p.Out2_Follows_Program_Frequency)) out2 = { art: 'programm' };
    else if (wahr(p.Out2_Follow_Out1_Frequency)) {
      const faktor = zahl(p.Out2_Hz_Factor, 1), konstante = zahl(p.Out2_Hz_Constant, 0);
      out2 = (faktor === 1 && konstante === 0) ? { art: 'gleich' } : { art: 'faktor', faktor, konstante };
    } else out2 = { art: 'gleich' };

    if (wahr(p.Enable_Gate_Out1) || wahr(p.Enable_Gate_Out2)) warnungen.push('Gate aktiv (noch nicht unterstützt)');
    if (wahr(p.Enable_F2_Modulation)) warnungen.push('F2-Modulation aktiv (noch nicht unterstützt)');
    if ((p.Harmonic_Wobble || 'None') !== 'None') warnungen.push('Harmonic Wobble aktiv (noch nicht unterstützt)');
    if ((p.Amplitude_Wobble_Type || 'Disabled') !== 'Disabled' && zahl(p.Settings_Amplitude_Wobble_Percentage)) warnungen.push('Amplitude Wobble aktiv (noch nicht unterstützt)');
    const wTyp = p.Frequency_Wobble_Type || (zahl(p.Settings_Frequency_Wobble_Percentage) ? 'Triangle' : 'Disabled');
    let wobble = null;
    if (wTyp !== 'Disabled' && zahl(p.Settings_Frequency_Wobble_Percentage)) {
      if (wTyp === 'Triangle') wobble = wobbleAus(zahl(p.Settings_Frequency_Wobble_Percentage), p);
      else warnungen.push(`Frequency Wobble «${wTyp}» (noch nicht unterstützt)`);
    }

    const ampAlt = p.Amplitude;
    return {
      name: p.PresetName || '',
      out1: { welle: w1[0] || null, amp: zahl(p.Out1_Amplitude ?? ampAlt, 20), offset: zahl(p.Out1_Offset), phase: zahl(p.Out1_Phase_Angle),
              maxHz: zahl(p.Out1_Max_Freq), minHz: zahl(p.Out1_Min_Freq), teilung: p.Out1_Frequency_Limit_Harmonic_Type || p.Frequency_Limit_Harmonic_Type || 'Octave' },
      out2: { welle: welle2, amp: zahl(p.Out2_Amplitude ?? ampAlt, 20), offset: zahl(p.Out2_Offset), phase: zahl(p.Out2_Phase_Angle),
              maxHz: zahl(p.Out2_Max_Freq), minHz: zahl(p.Out2_Min_Freq), teilung: p.Out2_Frequency_Limit_Harmonic_Type || p.Frequency_Limit_Harmonic_Type || 'Octave' },
      out2Modus: out2,
      duty: zahl(p.Duty_Cycle, 50),
      dwellFaktor: zahl(p.Dwell_Multiplier, 1),
      forceDwell: zahl(p.Force_Dwell, 0),
      wdhFrequenz: Math.max(1, zahl(p.Repeat_Each_Frequency, 1)),
      wdhProgramm: Math.max(1, zahl(p.Repeat_Each_Program, 1)),
      freqMultiplikator: zahl(p.Frequency_Multiplier, 1),
      freqKonstante: zahl(p.Frequency_Constant, 0),
      mwFaktor: zahl(p.Force_MW_to_Hz_Factor, 0),
      wobble,
      gateHz: zahl(p.Hz_Gate, 4),
      wobbleStufen: Math.max(1, Math.round(zahl(p.Settings_Frequency_Wobble_Steps, 16))),
      warnungen: [...new Set(warnungen)],
    };
  }

  // ------------------------------------------------------------------ Frequenzen
  /**
   * Eine Frequenzzeile ('437=240, 727, 10-100=360', 'M57.021=1,M71.037,0=4') -> Einträge.
   * Ohne «=Sekunden» gilt der Standard-Dwell (nicht die Zeit der vorherigen Frequenz) – so rechnen auch Finder und Kontrollblatt.
   */
  function leseFrequenzzeile(zeile, standardSek = STANDARD_DWELL) {
    const eintraege = [];
    for (let teil of String(zeile).split(',')) {
      teil = teil.trim();
      if (!teil) continue;
      let wert = teil, sek = null;
      const i = teil.lastIndexOf('=');
      if (i > 0) { wert = teil.slice(0, i).trim(); const s = parseFloat(teil.slice(i + 1)); if (Number.isFinite(s)) sek = s; }
      const explizit = sek !== null;
      const dauer = explizit ? sek : standardSek;
      const mit = (x) => (explizit ? { ...x, sek: dauer } : { ...x, sek: dauer, standard: true });
      if (/^m/i.test(wert)) {
        const da = parseFloat(wert.slice(1));
        eintraege.push(mit(Number.isFinite(da) ? { art: 'mw', da } : { art: 'unbekannt', text: wert }));
        continue;
      }
      const m = wert.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
      if (m) { eintraege.push(mit({ art: 'sweep', von: +m[1], bis: +m[2] })); continue; }
      const hz = Number(wert);
      if (!wert || !Number.isFinite(hz)) { eintraege.push(mit({ art: 'unbekannt', text: wert })); continue; }
      eintraege.push(mit(hz === 0 ? { art: 'pause' } : { art: 'hz', hz }));
    }
    return eintraege;
  }

  /** Programme eines Presets (Loaded_Programs / Loaded_Frequencies). */
  function programmeAusPreset(p) {
    const namen = String(p.Loaded_Programs || '').split('\n');
    return String(p.Loaded_Frequencies || '').split('\n').filter(z => z.trim())
      .map((z, i) => ({ name: (namen[i] || `Programm ${i + 1}`).trim(), eintraege: leseFrequenzzeile(z) }));
  }

  /** Frequenz in den erlaubten Bereich bringen (Spooky2: durch Oktaven oder ungerade Zahlen teilen). */
  function inBereich(hz, maxHz, teilung) {
    if (!maxHz || hz <= maxHz) return hz;
    if (teilung === 'Odd') { let n = 3; while (hz / n > maxHz) n += 2; return hz / n; }
    let f = hz; while (f > maxHz) f /= 2; return f;
  }

  // ------------------------------------------------------------------ Ablauf
  /**
   * Plan: Liste von Schritten {sek, f1, f2, sweep?, pause?, text, wobble?}.
   * optionen: { generatorMaxHz (Standard 5 MHz), wobble (überschreibt das Preset, z. B. aus dem Finder) }
   */
  function erstellePlan(e, programme, optionen = {}) {
    const genMax = optionen.generatorMaxHz || 5e6;
    const warnungen = [...e.warnungen];
    const wobble = optionen.wobble !== undefined ? optionen.wobble : e.wobble;
    const max1 = e.out1.maxHz || genMax, max2 = e.out2.maxHz || genMax;
    const ziel = (hz) => hz * e.freqMultiplikator + e.freqKonstante;
    const f1Von = (hz) => inBereich(ziel(hz), max1, e.out1.teilung);
    const f2Von = (hz, f1) => {
      switch (e.out2Modus.art) {
        case 'faktor': return inBereich(f1 * e.out2Modus.faktor + e.out2Modus.konstante, max2, e.out2.teilung);
        case 'programm': return inBereich(ziel(hz), max2, e.out2.teilung);
        default: return f1;
      }
    };
    const schritte = [];
    const ungenutzt = new Set();
    for (const prog of programme) {
      // ein Programm, Wiederholungen ausgeschrieben
      const liste = [];
      for (const x of prog.eintraege) {
        if (x.art === 'mw' || x.art === 'unbekannt') { ungenutzt.add(x.art === 'mw' ? 'MW-Frequenzen (M…) noch nicht unterstützt' : `Unbekannter Eintrag «${x.text}»`); continue; }
        const sek = (x.standard && e.forceDwell > 0 ? e.forceDwell : x.sek) * e.dwellFaktor;
        for (let r = 0; r < e.wdhFrequenz; r++) liste.push({ ...x, sek });
      }
      for (let rp = 0; rp < e.wdhProgramm; rp++) {
        for (let i = 0; i < liste.length; i++) {
          const x = liste[i];
          const text = `${prog.name}`;
          if (x.art === 'pause') { schritte.push({ sek: x.sek, pause: true, text }); continue; }
          if (x.art === 'sweep') {
            if (e.out2Modus.art === 'dual') ungenutzt.add('Sweep in Dual-Preset: Out2 läuft gleich wie Out1');
            schritte.push({ sek: x.sek, sweep: { von: x.von, bis: x.bis }, f1: f1Von(x.von), f2: f2Von(x.von, f1Von(x.von)), text, wobble });
            continue;
          }
          const f1 = f1Von(x.hz);
          if (e.out2Modus.art === 'dual') {
            const n = liste[i + 1];
            const f2 = n && n.art === 'hz' ? inBereich(ziel(n.hz), max2, e.out2.teilung) : f1;
            schritte.push({ sek: x.sek, f1, f2, text, wobble });
            if (n && n.art === 'hz') i++;
            continue;
          }
          schritte.push({ sek: x.sek, f1, f2: f2Von(x.hz, f1), text, wobble });
        }
      }
    }
    for (const s of schritte) if (!s.wobble) delete s.wobble;
    warnungen.push(...ungenutzt);
    return { schritte, gesamtSek: schritte.reduce((s, x) => s + x.sek, 0), warnungen };
  }

  /** Momentane Frequenzen eines Schritts nach t Sekunden (Sweeps linear, Wobble als Faktor). */
  function frequenzenBei(schritt, t, e, optionen = {}) {
    const w = wobbleFaktor(schritt.wobble, t);
    if (!schritt.sweep) return { f1: schritt.f1 * w, f2: schritt.f2 * w };
    const genMax = optionen.generatorMaxHz || 5e6;
    const anteil = schritt.sek > 0 ? Math.min(1, Math.max(0, Math.floor(t) / schritt.sek)) : 0;   // Sweeps auf ganzen Sekunden
    const roh = schritt.sweep.von + (schritt.sweep.bis - schritt.sweep.von) * anteil;
    const ziel = roh * e.freqMultiplikator + e.freqKonstante;
    const f1 = inBereich(ziel, e.out1.maxHz || genMax, e.out1.teilung);
    let f2 = f1;
    if (e.out2Modus.art === 'faktor') f2 = inBereich(f1 * e.out2Modus.faktor + e.out2Modus.konstante, e.out2.maxHz || genMax, e.out2.teilung);
    else if (e.out2Modus.art === 'programm') f2 = inBereich(ziel, e.out2.maxHz || genMax, e.out2.teilung);
    return { f1: f1 * w, f2: f2 * w };
  }

  /** Kennzahl, die sich ändert, sobald neue Frequenzen gesendet werden müssen (Sweep: jede Sekunde, Wobble: jeder Gate-Takt). */
  function taktBei(schritt, t) {
    if (schritt.wobble) return wobbleTakt(schritt.wobble, t);
    if (schritt.sweep) return Math.floor(t);
    return 0;
  }

  // ------------------------------------------------------------------ Frequenz-Finder
  const UNSICHTBAR = /\uDB40[\uDC00-\uDC7F]|[\u200B-\u200F\u2060-\u206F\uFEFF]/g;   // Uhrzeit-Marken und Farbmarken des Kontrollblatts
  const sauber = (s) => String(s || '').replace(UNSICHTBAR, '');

  /** «Killing (R) - JW  ·  Mode Remote  ·  Frequency Wobble 0,25 %» -> { preset, wobble, einmal } */
  function lesePresetAngabe(text) {
    const t = String(text || '');
    const preset = t.split('·')[0].replace(/\s+/g, ' ').trim();
    const m = t.match(/Frequency\s+Wobble\s+([\d.,]+)\s*%/i);
    return { preset, wobbleProzent: m ? parseFloat(m[1].replace(',', '.')) : 0, einmal: /single\s*run/i.test(t) };
  }

  /** DATA-Liste aus dem Text von Frequenz-Finder.html. */
  function finderDaten(html) {
    const start = html.indexOf('const DATA = [');
    if (start < 0) throw new Error('Kein Frequenz-Finder: «const DATA» nicht gefunden');
    const a = html.indexOf('[', start);
    let ende = html.indexOf('];\nconst tiles', a);
    const versuche = [];
    if (ende > 0) versuche.push(ende + 1);
    for (let i = html.indexOf('];', a); i > 0 && versuche.length < 50; i = html.indexOf('];', i + 2)) versuche.push(i + 1);
    for (const e of versuche) { try { return JSON.parse(html.slice(a, e)); } catch (err) { /* nächstes Ende versuchen */ } }
    throw new Error('Frequenz-Finder: Daten nicht lesbar');
  }

  /**
   * Programm-Katalog aus dem Frequenz-Finder: Code -> Programm.
   * Codes: «pr0002 NF», «pr0002 HF», «pr0001» (nur ein Block), «pa15»…«pa60», «sm15»…«sm60».
   */
  function finderKatalog(html) {
    const daten = finderDaten(html);
    const programme = new Map(), konflikte = [];
    const vm = html.match(/middot; (v\d+)'/) || html.match(/Frequenz-Finder[^<]{0,40}(v\d{3})/);
    for (const kachel of daten) {
      const bloecke = [];
      // Hauptblock, Zusatzblöcke («extra») und Sonderblöcke der Kachel
      for (const quelle of [kachel, ...(Array.isArray(kachel.extra) ? kachel.extra : [])]) {
        for (const [feld, variante] of [['nf', 'NF'], ['hf', 'HF'], ['milieu', ''], ['kombi', ''], ['eigen', '']]) {
          const v = quelle && quelle[feld];
          for (const b of Array.isArray(v) ? v : v ? [v] : []) bloecke.push([b, variante]);
        }
      }
      for (const [b, variante] of bloecke) {
        if (!b || !b.nr || !b.line) continue;
        const prog = sauber(b.prog).trim();
        const kurz = prog.match(/^(pa|sm)(\d{2})\b/i);
        const code = kurz ? (kurz[1] + kurz[2]).toLowerCase() : `pr${b.nr}${variante ? ' ' + variante : ''}`;
        const angabe = lesePresetAngabe(b.preset);
        const dw = String(b.dauer || '').match(/Dwell[^0-9]{0,15}(\d+(?:\.\d+)?)\s*s\b/i);   // «Einzel-Dwell 180 s», «Dwell 300 s»
        const eintrag = { code, nr: b.nr, variante, name: prog, preset: angabe.preset, wobbleProzent: angabe.wobbleProzent, einmal: angabe.einmal,
          dwell: dw ? parseFloat(dw[1]) : STANDARD_DWELL,
          presetText: String(b.preset || '').replace(/\s+/g, ' ').trim(), zeile: String(b.line).trim(), kachel: kachel.name || kachel.id, art: kurz ? kurz[1].toLowerCase() : 'pr' };
        const alt = programme.get(code);
        if (alt) { if (alt.zeile !== eintrag.zeile || alt.preset !== eintrag.preset) konflikte.push(code); continue; }
        programme.set(code, eintrag);
      }
    }
    return { version: vm ? vm[1] : '', kacheln: daten.length, programme, konflikte };
  }

  /**
   * Eine Zeile der Programmliste deuten.
   * Ergebnis: { art: 'finder', code, programm } | { art: 'zeile', zeile } | { art: 'fehler', text } | null (leer)
   * Versteht auch Zeilen aus dem Kontrollblatt («pr0409<TAB>54min<TAB>Schaufensterkrankheit … - HF (kHz)»).
   */
  function deuteListenZeile(text, katalog) {
    const t = sauber(text).replace(/\s+/g, ' ').trim();
    if (!t || t.startsWith('#')) return null;
    const kurz = t.match(/^(pa|sm)\s?(\d{2})\b/i);
    if (kurz) {
      const code = (kurz[1] + kurz[2]).toLowerCase();
      const p = katalog && katalog.programme.get(code);
      return p ? { art: 'finder', code, programm: p } : { art: 'fehler', text: `«${code}» nicht im Frequenz-Finder` };
    }
    const pr = t.match(/^pr\s?(\d{1,4})\b(.*)$/i);
    if (pr) {
      if (!katalog) return { art: 'fehler', text: 'Frequenz-Finder nicht geladen' };
      const nr = pr[1].padStart(4, '0'), rest = pr[2];
      let v = '';
      const mv = rest.match(/(?<![\p{L}\d])(NF|HF)(?![\p{L}\d])(?!.*(?<![\p{L}\d])(?:NF|HF)(?![\p{L}\d]))/iu);   // letzte Angabe zählt («… - HF (kHz)»)
      if (mv) v = mv[1].toUpperCase();
      const kandidaten = v ? [`pr${nr} ${v}`] : [`pr${nr}`, `pr${nr} NF`, `pr${nr} HF`];
      const gefunden = kandidaten.filter(c => katalog.programme.has(c));
      if (!gefunden.length) return { art: 'fehler', text: `pr${nr}${v ? ' ' + v : ''} nicht im Frequenz-Finder` };
      if (!v && !katalog.programme.has(`pr${nr}`) && gefunden.length > 1) return { art: 'fehler', text: `pr${nr}: NF oder HF angeben` };
      return { art: 'finder', code: gefunden[0], programm: katalog.programme.get(gefunden[0]) };
    }
    if (/^[\dmM.\s,=\-]+$/.test(t) && /\d/.test(t)) return { art: 'zeile', zeile: t };
    return { art: 'fehler', text: `Nicht erkannt: «${t.slice(0, 40)}»` };
  }

  // ------------------------------------------------------------------ Zeitmarke
  /** Zeitmarke «um 06:00» (auch «ab 6:00», «06:00», «um 6.00 Uhr») -> «06:00», sonst null. «6.00» allein ist eine Frequenz. */
  function zeitmarke(zeile) {
    const t = sauber(zeile).trim();
    const m = t.match(/^(?:(?:um|ab)\s*(\d{1,2})[:.](\d{2})|(\d{1,2}):(\d{2}))\s*(?:uhr)?$/i);
    if (!m) return null;
    const h = +(m[1] ?? m[3]), min = +(m[2] ?? m[4]);
    return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
  }

  // ------------------------------------------------------------------ Kontrollblatt (Frequenz_Kontrolle.json)
  /** Mehrzeilige Programm-Einträge des Kontrollblatts zusammensetzen (Fortsetzungszeilen beginnen mit Tabulator). */
  function kontrolleEintraege(text) {
    const liste = [];
    let abschnitt = '';
    for (const roh of String(text || '').split('\n')) {
      const z = sauber(roh);
      if (!z.trim()) continue;
      const um = zeitmarke(z);                                          // 0.6.7: «um 6.00» in der Tageszeile -> Zeitmarke
      if (um) { liste.push({ code: 'um', um, text: `um ${um}`, abschnitt }); continue; }
      const code = z.match(/^\s*(pr\d{4}|pa\d{2}|sm\d{2})\b/i);
      if (code) { liste.push({ code: code[1].toLowerCase(), text: z.trim(), abschnitt }); continue; }
      if (/^\t\t\t/.test(roh)) { abschnitt = z.trim(); continue; }      // Spartenkopf im Feld «Programme»
      if (/^\t/.test(z) && liste.length) { liste[liste.length - 1].text += ' ' + z.trim(); continue; }
    }
    for (const e of liste) {
      if (e.code === 'um') { Object.assign(e, { dauer: '', name: `Start um ${e.um}`, tageszeit: '', variante: '', zeile: `um ${e.um}` }); continue; }
      const teile = e.text.split('\t').map(s => s.trim()).filter(Boolean);
      e.dauer = /^(\d+h)?\s*(\d+\s*(min|s))?$/.test(teile[1] || '') && /\d/.test(teile[1] || '') ? teile[1] : '';   // «1h 09min», «54min»
      e.name = teile.slice(e.dauer ? 2 : 1).filter(x => !/^(morgens|tagsüber|nachts|abends|mittags|vor Essen|nach Essen)$/i.test(x)).join(' ').replace(/\s+/g, ' ').trim();
      e.tageszeit = teile.find(x => /^(morgens|tagsüber|nachts|abends|mittags|vor Essen|nach Essen)$/i.test(x)) || '';
      const v = e.code.startsWith('pr') ? (e.text.match(/(?<![\p{L}\d])(NF|HF)(?![\p{L}\d])(?!.*(?<![\p{L}\d])(?:NF|HF)(?![\p{L}\d]))/u) || [])[1] : '';
      e.variante = v || '';
      e.zeile = `${e.code}${v ? ' ' + v : ''}  ${e.name}`.trim();   // so landet der Eintrag in der Programmliste
    }
    return liste;
  }

  /**
   * Programmlisten-Zeile für einen Kontrollblatt-Eintrag. Fehlt NF/HF im Eintrag, wird es im selben Blatt gesucht:
   * zuerst im Feld «Programme», dann im Verlauf (jüngster Eintrag mit Angabe zuerst). Kachel mit nur einem Block braucht keine Angabe.
   */
  function kontrolleZeile(eintrag, blatt, katalog) {
    if (!eintrag.code.startsWith('pr') || eintrag.variante) return eintrag.zeile;
    if (katalog && katalog.programme.has(eintrag.code)) return eintrag.zeile;
    const varianten = (liste) => [...new Set(liste.filter(y => y.code === eintrag.code && y.variante).map(y => y.variante))];
    let v = blatt ? varianten(kontrolleEintraege(blatt.programme)) : [];
    if (v.length !== 1 && blatt) {
      const tage = (blatt.days || []).filter(d => d.prog).sort((a, b) => datumWert(b.date) - datumWert(a.date));
      for (const d of tage) { const w = kontrolleEintraege(d.prog).filter(y => y.code === eintrag.code && y.variante); if (w.length) { v = [w[w.length - 1].variante]; break; } }
    }
    if (v.length !== 1) return eintrag.zeile;                       // bleibt offen: RADIX fragt nach NF oder HF
    return `${eintrag.code} ${v[0]}  ${eintrag.name}`.trim();
  }
  const datumWert = (t) => { const m = String(t || '').match(/^(\d\d)\.(\d\d)\.(\d\d)$/); return m ? +(m[3] + m[2] + m[1]) : 0; };

  const zwei = (n) => String(n).padStart(2, '0');
  const datumText = (d) => `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;

  /** Kontrollblatt-Sicherung lesen: { blaetter: { '1': {...}, … } } */
  function leseKontrolle(jsonText) {
    const d = JSON.parse(jsonText);
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Keine Kontrollblatt-Sicherung');
    const blaetter = {};
    for (const [k, v] of Object.entries(d)) if (/^\d+$/.test(k) && v && Array.isArray(v.days)) blaetter[k] = v;
    if (!Object.keys(blaetter).length) throw new Error('Keine Kontrollblätter in der Datei');
    // Gerade angeklicktes Blatt (schreibt das Kontrollblatt beim Blattwechsel): «aktiv»: 5, «aktivZeit»: Zeitstempel
    const a = parseInt(d.aktiv, 10);
    return { blaetter, aktiv: Number.isFinite(a) ? a : null, aktivZeit: d.aktivZeit ?? null };
  }

  /** Heutige Zeile eines Blatts (Zeile = Monatstag, wie im Kontrollblatt). */
  function kontrolleHeute(blatt, datum = new Date()) {
    const zeile = blatt && blatt.days && blatt.days[datum.getDate() - 1];
    if (!zeile) return { eintraege: [], hinweis: 'keine Zeile für heute' };
    const heute = datumText(datum);
    if (zeile.date && zeile.date !== heute && kontrolleEintraege(zeile.prog).length) return { eintraege: [], hinweis: `Zeile ${datum.getDate()} gehört zum ${zeile.date}` };
    return { eintraege: kontrolleEintraege(zeile.prog), hinweis: '' };
  }

  // ------------------------------------------------------------------ Generator-Befehle (XM)
  const Befehl = {
    w: (nr, wert) => `:w${String(nr).padStart(2, '0')}${wert}\r\n`,
    bereich: (kanal, tief) => Befehl.w(63 + kanal, tief ? 1 : 0),
    frequenzRoh: (hz) => Math.round(hz * (hz < 600 ? 100000 : 100)),
    frequenzWert: (kanal, hz) => Befehl.w(23 + kanal, Befehl.frequenzRoh(hz)),
    amplitude: (kanal, volt) => Befehl.w(25 + kanal, Math.round(volt * 100)),
    offset: (kanal, prozent) => Befehl.w(27 + kanal, 100 + Math.round(prozent)),   // Kodierung aus s2, ungeprüft
    duty: (kanal, prozent) => Befehl.w(29 + kanal, Math.round(prozent * 10)),
    phase: (kanal, grad) => Befehl.w(31 + kanal, Math.round(grad)),
    wellenform: (kanal, code) => Befehl.w(21 + kanal, code),
    ausgang: (kanal, ein) => Befehl.w(61 + kanal, ein ? 1 : 0),
    sync: (ein) => Befehl.w(68, ein ? 1 : 0),
    eigeneWelle: (kanal, werte) => `:a0${kanal + 1}${werte.join(',')}\n`,
  };

  // ------------------------------------------------------------------ GeneratorX Pro (0.6.5)
  // 115200 Baud, Zeilen «:wNN=<Wert>,<Wert>,» + CR LF, jeder Wert endet mit Komma, leerer Wert = Kanal unverändert. Antwort «:ok» / «:err».
  // Quelle: zwei USB-Mitschnitte von Spooky2 am Spooky-PC (28.10.2026, claude/gx_pro/mitschnitt_spooky2.md) und Versuche am Gerät.
  // Frequenz Out1 «:w24=v,», Out2 «:w25=v,»: v = m·10 + e, Frequenz = m·10^e · 10⁻⁸ Hz (4 Hz = 48, 10 000 Hz = 10009).
  // Freischaltung: Spooky2 schaltet den GX beim Verbinden frei (Challenge-Response :r90/:w92, nicht nachbaubar). Das hält bis zum
  // Stromunterbruch des GX. Ohne Freischaltung antwortet er auf alles ausser «:n00=$» mit «:err».
  const GX = {
    BAUD: 115200,
    MAX_VOLT: 20,
    /** Wellentabelle je Spooky2-Wellenform (Spooky2 lädt :a11…:a21 in dieser Reihenfolge), Out2 bekommt immer Tabelle 25. */
    TABELLE: { Sine: 11, Square: 12, Sawtooth: 13, Inverted_Sawtooth: 14, Triangle: 15, Sine_Damped: 16, Square_Damped: 17,
               Sine_Hbomb: 18, Square_Hbomb: 19, User_Defined_1: 20, User_Defined_2: 21 },
    TABELLE_OUT2: 25,
    /** Frequenz in Hz -> GX-Zahl, Nullen in den Exponenten (höchstens 9, wie Spooky2: 10 000 Hz = 10009, 2720 Hz = 2729). */
    zahl(hz) {
      let n = Math.round(hz * 1e8), e = 0;
      if (!(n > 0)) return 0;
      while (e < 9 && n % 10 === 0) { n /= 10; e++; }
      return n * 10 + e;
    },
    /** GX-Zahl -> Hz (zum Prüfen und für die Anzeige im Protokoll). */
    hz(v) { return Math.floor(v / 10) * Math.pow(10, v % 10) / 1e8; },
    frequenz: (kanal, hz) => `:w${24 + kanal}=${GX.zahl(hz)},\r\n`,
    ausgaenge: (a, b) => `:w11=${a ? 1 : 0},${b ? 1 : 0},\r\n`,
    ausgang: (kanal, ein) => (kanal ? `:w11=,${ein ? 1 : 0},\r\n` : `:w11=${ein ? 1 : 0},,\r\n`),
    amplitude: (kanal, volt) => `:w${28 + kanal}=${Math.round(volt * 100)},\r\n`,
    offset: (kanal, prozent) => `:w${32 + kanal}=${120 + Math.round(prozent)},\r\n`,
    welle: (kanal, tabelle) => `:w${20 + kanal}=${tabelle},\r\n`,
    tabelle: (nr, werte) => `:a${nr}=${werte.join(',')},\r\n`,
    sync: (ein) => `:w14=${ein ? 1 : 0},\r\n`,
    gateAus: (kanal) => (kanal ? ':w12=,0,\r\n' : ':w12=0,,\r\n'),
    neueFrequenz: ':w13=0,\r\n',
    /** Text im GX-Display (Spooky2: «Port 1 - Healing (R) - JW»). Nur ASCII, höchstens 57 Zeichen, nicht mit $ * # , ? beginnen. */
    name(text) {
      const t = String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/^[$*#,?\s]+/, '').slice(0, 57);
      return `:n00=${t || 'RADIX'}\r\n`;
    },
    version: ':n00=$\r\n',
    /** Grundstellung nach dem Öffnen, wie Spooky2 beim Verbinden (ohne Freischaltung). */
    grundstellung: () => [
      ['Kanal-Sync aus', ':w14=0,\r\n'], ['w17 (wie Spooky2)', ':w17=0,0,\r\n'],
      ['Frequenz Out1 0', ':w24=0,\r\n'], ['Frequenz Out2 0', ':w25=0,\r\n'], ['w15 (wie Spooky2)', ':w15=1,1,\r\n'],
      ['Offset Out1 0 %', ':w32=120,\r\n'], ['Offset Out2 0 %', ':w33=120,\r\n'],
    ],
    /** Ausgänge aus und Amplitude 0 (Stopp, Pause am Ende, Test beenden). */
    aus: () => [
      ['Ausgang 1 aus', GX.ausgang(0, false)], ['Ausgang 2 aus', GX.ausgang(1, false)],
      ['Amplitude Out1 0', GX.amplitude(0, 0)], ['Amplitude Out2 0', GX.amplitude(1, 0)],
    ],
    /**
     * Amplitude so begrenzen, dass Amplitude + Offset die 20 V nicht übersteigt. Spooky2 schickte bei Killing (R) - JK
     * (20 V, Offset +100 % / −100 %) nur 10 V an den GX – das entspricht 20 V / (1 + 100 %).
     */
    begrenzt(volt, offset) { return Math.min(volt, GX.MAX_VOLT / (1 + Math.abs(offset) / 100)); },
  };

  /** Wellenform eines Ausgangs als 1024 Werte 0…1023 (Square mit Duty, sonst aus der CSV, Out2 «invertiert» gespiegelt). */
  function gxWerte(welle, wellen, duty) {
    if (welle.typ === 'Square' && duty !== 50) {
      const hoch = Math.round(1024 * Math.max(0, Math.min(100, duty)) / 100);
      return Array.from({ length: 1024 }, (_, i) => ((i < hoch) !== welle.invertiert ? 1023 : 0));
    }
    return welleZuWerten(findeWelle(wellen, welle.datei), welle.invertiert);
  }

  /** Was der GX (noch) nicht kann – zusätzlich zu den allgemeinen Warnungen von einstellungen(). */
  function gxWarnungen(e) {
    const w = [];
    if (e.out1.phase || e.out2.phase) w.push('Phase auf dem GX Pro noch nicht unterstützt');
    if (e.out2Modus.art === 'faktor') w.push('Out2 mit Faktor/Konstante auf dem GX Pro noch nicht unterstützt');
    return w;
  }

  /** Befehle zum Einrichten des GX für ein Preset (Ablauf wie Spooky2 beim Programmstart). */
  function gxEinrichtung(e, wellen, anzeige = '') {
    const fehlt = [e.out1.welle, e.out2.welle].filter(w => w && !findeWelle(wellen, w.datei) && !(w.typ === 'Square' && e.duty !== 50)).map(w => w.datei);
    if (fehlt.length) throw new Error(`Wellenform fehlt: ${[...new Set(fehlt)].join(', ')}`);
    const t1 = GX.TABELLE[e.out1.welle.typ] || GX.TABELLE.User_Defined_1, t2 = GX.TABELLE_OUT2;
    const syncen = e.out2Modus.art === 'gleich';
    const amp = [e.out1, e.out2].map(o => GX.begrenzt(o.amp, o.offset));
    const ampText = (o, a) => `${+a.toFixed(2)} V${a < o.amp ? ` (Preset ${o.amp} V, wegen Offset ${o.offset} % begrenzt)` : ''}`;
    const welleText = (w) => `${w.datei}${w.invertiert ? ' gespiegelt' : ''}${w.typ === 'Square' && e.duty !== 50 ? ` Duty ${e.duty} %` : ''}`;
    return [
      ['Ausgänge aus', GX.ausgaenge(0, 0)],
      ['Frequenz vorbereiten (w13)', GX.neueFrequenz],
      ...(anzeige ? [[`Anzeige «${anzeige}»`, GX.name(anzeige)]] : []),
      [`Wellenform Out1 ${welleText(e.out1.welle)} → Tabelle ${t1}`, GX.tabelle(t1, gxWerte(e.out1.welle, wellen, e.duty)), 5000],
      [`Wellenform Out2 ${welleText(e.out2.welle)} → Tabelle ${t2}`, GX.tabelle(t2, gxWerte(e.out2.welle, wellen, e.duty)), 5000],
      [`Out1 auf Tabelle ${t1}`, GX.welle(0, t1)],
      [`Out2 auf Tabelle ${t2}`, GX.welle(1, t2)],
      [`Kanal-Sync ${syncen ? 'ein' : 'aus'}`, GX.sync(syncen)],
      ['Gate Out1 aus', GX.gateAus(0)], ['Gate Out2 aus', GX.gateAus(1)],
      [`Amplitude Out1 ${ampText(e.out1, amp[0])}`, GX.amplitude(0, amp[0])],
      [`Amplitude Out2 ${ampText(e.out2, amp[1])}`, GX.amplitude(1, amp[1])],
      [`Offset Out1 ${e.out1.offset} %`, GX.offset(0, e.out1.offset)],
      [`Offset Out2 ${e.out2.offset} %`, GX.offset(1, e.out2.offset)],
    ];
  }

  /**
   * Frequenzbefehle GX: neuer Schritt -> zuerst «:w13=0,» (macht Spooky2 vor jeder neuen Frequenz), Wobble/Sweep nur «:w24».
   * Mit Kanal-Sync folgt Out2 von selbst (Spooky2 schickt dann nur :w24). Nur Änderungen werden gesendet.
   */
  function gxFrequenzBefehle(f1, f2, zustand, neu, sync) {
    const b = [];
    const w1 = GX.frequenz(0, f1), w2 = sync ? null : GX.frequenz(1, f2);
    if (neu && (zustand.wert[0] !== w1 || (w2 && zustand.wert[1] !== w2))) b.push(['Frequenz vorbereiten (w13)', GX.neueFrequenz]);
    if (zustand.wert[0] !== w1) { b.push([`Frequenz Out1 ${+f1.toFixed(6)} Hz`, w1]); zustand.wert[0] = w1; }
    if (w2 && zustand.wert[1] !== w2) { b.push([`Frequenz Out2 ${+f2.toFixed(6)} Hz`, w2]); zustand.wert[1] = w2; }
    return b;
  }

  /** Ausgänge GX passend zum Schritt (Pause = aus), je Kanal einzeln wie Spooky2. */
  function gxAusgangBefehle(ein, zustand) {
    const b = [];
    for (const k of [0, 1]) if (zustand.aus[k] === ein) { b.push([`Ausgang ${k + 1} ${ein ? 'ein' : 'aus'}`, GX.ausgang(k, ein)]); zustand.aus[k] = !ein; }
    return b;
  }

  /** Wellenform-Namen vergleichen: Spooky2 schreibt mal «_», mal Leerzeichen (UDB_Square = «UDB Square.csv»). */
  const wellenSchluessel = (name) => String(name).toLowerCase().replace(/[_\s]+/g, ' ').trim();
  function findeWelle(wellen, name) {
    if (wellen.has(name)) return wellen.get(name);
    const s = wellenSchluessel(name);
    for (const [k, v] of wellen) if (wellenSchluessel(k) === s) return v;
    return null;
  }

  /** CSV-Werte (-1…+1) -> 0…1023, optional gespiegelt. */
  function welleZuWerten(csv, invertiert = false) {
    if (!csv || csv.length !== 1024) throw new Error(`Wellenform braucht 1024 Werte, hat ${csv ? csv.length : 0}`);
    return csv.map(x => { const v = Math.max(0, Math.min(1023, Math.round(512 + x * 512))); return invertiert ? 1023 - v : v; });
  }

  /** CSV-Text einer Wellenform-Datei -> Zahlen. */
  function leseWellenCsv(text) { return String(text).split(/[\s,;]+/).filter(Boolean).map(Number); }

  /** Befehle zum Einrichten eines Generators für ein Preset. wellen: Map Dateiname -> CSV-Zahlen */
  function einrichtung(e, wellen) {
    const fehlt = [e.out1.welle, e.out2.welle].filter(w => w && !findeWelle(wellen, w.datei)).map(w => w.datei);
    if (fehlt.length) throw new Error(`Wellenform fehlt: ${[...new Set(fehlt)].join(', ')}`);
    const syncen = e.out2Modus.art === 'gleich';
    const b = [
      ['Ausgang 1 aus', Befehl.ausgang(0, false)],
      ['Ausgang 2 aus', Befehl.ausgang(1, false)],
      [`Wellenform Out1 ${e.out1.welle.datei}${e.out1.welle.invertiert ? ' gespiegelt' : ''}`, Befehl.eigeneWelle(0, welleZuWerten(findeWelle(wellen, e.out1.welle.datei), e.out1.welle.invertiert)), 5000],
      [`Wellenform Out2 ${e.out2.welle.datei}${e.out2.welle.invertiert ? ' gespiegelt' : ''}`, Befehl.eigeneWelle(1, welleZuWerten(findeWelle(wellen, e.out2.welle.datei), e.out2.welle.invertiert)), 5000],
      ['Out1 auf eigene Wellenform', Befehl.wellenform(0, 101)],
      ['Out2 auf eigene Wellenform', Befehl.wellenform(1, 102)],
      [`Amplitude Out1 ${e.out1.amp} V`, Befehl.amplitude(0, e.out1.amp)],
      [`Amplitude Out2 ${e.out2.amp} V`, Befehl.amplitude(1, e.out2.amp)],
      [`Offset Out1 ${e.out1.offset} %`, Befehl.offset(0, e.out1.offset)],
      [`Offset Out2 ${e.out2.offset} %`, Befehl.offset(1, e.out2.offset)],
      [`Phase Out1 ${e.out1.phase}°`, Befehl.phase(0, e.out1.phase)],
      [`Phase Out2 ${e.out2.phase}°`, Befehl.phase(1, e.out2.phase)],
      [`Kanal-Sync ${syncen ? 'ein' : 'aus'}`, Befehl.sync(syncen)],
    ];
    return b;
  }

  /** Befehle für neue Frequenzen; zustand merkt sich Bereich und Werte pro Kanal, sendet nur Änderungen. */
  function frequenzBefehle(f1, f2, zustand) {
    const b = [];
    for (const [kanal, hz] of [[0, f1], [1, f2]]) {
      const tief = hz < 600;
      // Nach einem Bereichswechsel die Frequenz immer neu schicken: 10 Hz (tief, ×100'000) und 10'000 Hz (normal, ×100)
      // ergeben denselben Wert – ohne Neusenden zeigte der XM weiter 10'000 Hz (gefunden am Gerät 28.10.2026)
      // 0.6.3: auch das reichte nicht – der XM übernimmt den neuen Bereich erst, wenn sich der Frequenzwert ändert (am Gerät 28.10.2026:
      // 10000 → 10 blieb stehen, 10000 → 727 → 10 ging). Darum nach dem Bereichswechsel kurz einen Nachbarwert (+1 = 0,01 Hz bzw.
      // 0,00001 Hz daneben) schicken, wenn der alte Wert gleich oder unbekannt ist, dann den richtigen Wert
      const wert = Befehl.frequenzWert(kanal, hz);
      if (zustand.bereich[kanal] !== tief) {
        const vorher = zustand.wert[kanal];
        b.push([`Bereich Out${kanal + 1} ${tief ? 'tief' : 'normal'}`, Befehl.bereich(kanal, tief)]);
        if (vorher === null || vorher === wert) b.push([`Frequenz Out${kanal + 1} anstossen (Bereich übernehmen)`, Befehl.w(23 + kanal, Befehl.frequenzRoh(hz) + 1)]);
        zustand.bereich[kanal] = tief; zustand.wert[kanal] = null;
      }
      if (zustand.wert[kanal] !== wert) { b.push([`Frequenz Out${kanal + 1} ${+hz.toFixed(6)} Hz`, wert]); zustand.wert[kanal] = wert; }
    }
    return b;
  }
  const neuerZustand = () => ({ bereich: [null, null], wert: [null, null], aus: [true, true] });

  /** Ausgänge passend zum Schritt ein- oder ausschalten (Pause = aus). */
  function ausgangBefehle(ein, zustand) {
    const b = [];
    for (const k of [0, 1]) if (zustand.aus[k] === ein) { b.push([`Ausgang ${k + 1} ${ein ? 'ein' : 'aus'}`, Befehl.ausgang(k, ein)]); zustand.aus[k] = !ein; }
    return b;
  }

  const Kern = {
    STANDARD_DWELL, lesePresets, baueKatalog, loeseBasis, einstellungen, leseFrequenzzeile, programmeAusPreset,
    inBereich, erstellePlan, frequenzenBei, taktBei, wobbleAus, wobbleFaktor, Befehl, welleZuWerten, leseWellenCsv, findeWelle, einrichtung,
    frequenzBefehle, ausgangBefehle, neuerZustand, GX, gxEinrichtung, gxFrequenzBefehle, gxAusgangBefehle, gxWarnungen, gxWerte,
    lesePresetAngabe, finderDaten, finderKatalog, deuteListenZeile, sauber, zeitmarke,
    kontrolleEintraege, kontrolleZeile, leseKontrolle, kontrolleHeute, datumText,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Kern;
  else root.Kern = Kern;
})(typeof self !== 'undefined' ? self : this);
