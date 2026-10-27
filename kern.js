/* Generator-Steuerung – Kern
 * Liest Spooky2-Presets, berechnet die Generator-Einstellungen und den Ablauf.
 * Reine Funktionen ohne Gerät, im Browser und in Node testbar.
 * Idee, Konzept & Architektur Markus Rufer · Technische Umsetzung. Claude by Anthropic
 */
(function (root) {
  'use strict';

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
    if ((p.Harmonic_Wobble || 'None') !== 'None' || zahl(p.Settings_Frequency_Wobble_Percentage)) warnungen.push('Wobble aktiv (noch nicht unterstützt)');

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
      wdhFrequenz: Math.max(1, zahl(p.Repeat_Each_Frequency, 1)),
      wdhProgramm: Math.max(1, zahl(p.Repeat_Each_Program, 1)),
      freqMultiplikator: zahl(p.Frequency_Multiplier, 1),
      freqKonstante: zahl(p.Frequency_Constant, 0),
      mwFaktor: zahl(p.Force_MW_to_Hz_Factor, 0),
      warnungen: [...new Set(warnungen)],
    };
  }

  // ------------------------------------------------------------------ Frequenzen
  /** Eine Frequenzzeile ('437=240, 727=420, 10-100=360', 'M57.021=1,M71.037,0=4') -> Einträge. */
  function leseFrequenzzeile(zeile, standardSek = 180) {
    const eintraege = [];
    let sek = null;
    for (let teil of String(zeile).split(',')) {
      teil = teil.trim();
      if (!teil) continue;
      let wert = teil;
      const i = teil.lastIndexOf('=');
      if (i > 0) { wert = teil.slice(0, i).trim(); const s = parseFloat(teil.slice(i + 1)); if (Number.isFinite(s)) sek = s; }
      const dauer = sek ?? standardSek;
      if (/^m/i.test(wert)) {
        const da = parseFloat(wert.slice(1));
        eintraege.push(Number.isFinite(da) ? { art: 'mw', da, sek: dauer } : { art: 'unbekannt', text: wert, sek: dauer });
        continue;
      }
      const m = wert.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
      if (m) { eintraege.push({ art: 'sweep', von: +m[1], bis: +m[2], sek: dauer }); continue; }
      const hz = Number(wert);
      if (!Number.isFinite(hz)) { eintraege.push({ art: 'unbekannt', text: wert, sek: dauer }); continue; }
      eintraege.push(hz === 0 ? { art: 'pause', sek: dauer } : { art: 'hz', hz, sek: dauer });
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
   * Plan: Liste von Schritten {sek, f1, f2, sweep?, pause?, text}.
   * optionen: { generatorMaxHz (Standard 5 MHz) }
   */
  function erstellePlan(e, programme, optionen = {}) {
    const genMax = optionen.generatorMaxHz || 5e6;
    const warnungen = [...e.warnungen];
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
        for (let r = 0; r < e.wdhFrequenz; r++) liste.push({ ...x, sek: x.sek * e.dwellFaktor });
      }
      for (let rp = 0; rp < e.wdhProgramm; rp++) {
        for (let i = 0; i < liste.length; i++) {
          const x = liste[i];
          const text = `${prog.name}`;
          if (x.art === 'pause') { schritte.push({ sek: x.sek, pause: true, text }); continue; }
          if (x.art === 'sweep') {
            if (e.out2Modus.art === 'dual') ungenutzt.add('Sweep in Dual-Preset: Out2 läuft gleich wie Out1');
            schritte.push({ sek: x.sek, sweep: { von: x.von, bis: x.bis }, f1: f1Von(x.von), f2: f2Von(x.von, f1Von(x.von)), text });
            continue;
          }
          const f1 = f1Von(x.hz);
          if (e.out2Modus.art === 'dual') {
            const n = liste[i + 1];
            const f2 = n && n.art === 'hz' ? inBereich(ziel(n.hz), max2, e.out2.teilung) : f1;
            schritte.push({ sek: x.sek, f1, f2, text });
            if (n && n.art === 'hz') i++;
            continue;
          }
          schritte.push({ sek: x.sek, f1, f2: f2Von(x.hz, f1), text });
        }
      }
    }
    warnungen.push(...ungenutzt);
    return { schritte, gesamtSek: schritte.reduce((s, x) => s + x.sek, 0), warnungen };
  }

  /** Momentane Frequenzen eines Schritts nach t Sekunden (Sweeps linear). */
  function frequenzenBei(schritt, t, e, optionen = {}) {
    if (!schritt.sweep) return { f1: schritt.f1, f2: schritt.f2 };
    const genMax = optionen.generatorMaxHz || 5e6;
    const anteil = schritt.sek > 0 ? Math.min(1, Math.max(0, t / schritt.sek)) : 0;
    const roh = schritt.sweep.von + (schritt.sweep.bis - schritt.sweep.von) * anteil;
    const ziel = roh * e.freqMultiplikator + e.freqKonstante;
    const f1 = inBereich(ziel, e.out1.maxHz || genMax, e.out1.teilung);
    let f2 = f1;
    if (e.out2Modus.art === 'faktor') f2 = inBereich(f1 * e.out2Modus.faktor + e.out2Modus.konstante, e.out2.maxHz || genMax, e.out2.teilung);
    else if (e.out2Modus.art === 'programm') f2 = inBereich(ziel, e.out2.maxHz || genMax, e.out2.teilung);
    return { f1, f2 };
  }

  // ------------------------------------------------------------------ Generator-Befehle (XM)
  const Befehl = {
    w: (nr, wert) => `:w${String(nr).padStart(2, '0')}${wert}\r\n`,
    bereich: (kanal, tief) => Befehl.w(63 + kanal, tief ? 1 : 0),
    frequenzWert: (kanal, hz) => Befehl.w(23 + kanal, Math.round(hz * (hz < 600 ? 100000 : 100))),
    amplitude: (kanal, volt) => Befehl.w(25 + kanal, Math.round(volt * 100)),
    offset: (kanal, prozent) => Befehl.w(27 + kanal, 100 + Math.round(prozent)),   // Kodierung aus s2, ungeprüft
    duty: (kanal, prozent) => Befehl.w(29 + kanal, Math.round(prozent * 10)),
    phase: (kanal, grad) => Befehl.w(31 + kanal, Math.round(grad)),
    wellenform: (kanal, code) => Befehl.w(21 + kanal, code),
    ausgang: (kanal, ein) => Befehl.w(61 + kanal, ein ? 1 : 0),
    sync: (ein) => Befehl.w(68, ein ? 1 : 0),
    eigeneWelle: (kanal, werte) => `:a0${kanal + 1}${werte.join(',')}\n`,
  };

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
      if (zustand.bereich[kanal] !== tief) { b.push([`Bereich Out${kanal + 1} ${tief ? 'tief' : 'normal'}`, Befehl.bereich(kanal, tief)]); zustand.bereich[kanal] = tief; }
      const wert = Befehl.frequenzWert(kanal, hz);
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
    lesePresets, baueKatalog, loeseBasis, einstellungen, leseFrequenzzeile, programmeAusPreset,
    inBereich, erstellePlan, frequenzenBei, Befehl, welleZuWerten, leseWellenCsv, findeWelle, einrichtung,
    frequenzBefehle, ausgangBefehle, neuerZustand,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Kern;
  else root.Kern = Kern;
})(typeof self !== 'undefined' ? self : this);
