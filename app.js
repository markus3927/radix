/* Generator-Steuerung – Oberfläche, Verbindung, Ablauf
 * Idee, Konzept & Architektur Markus Rufer · Technische Umsetzung. Claude by Anthropic
 */
'use strict';
const VERSION = '0.1.0';
const $ = (s, el = document) => el.querySelector(s);
const K = window.Kern;
const SPEICHER = 'gs-generatoren-v1';

// ------------------------------------------------------------------ Hilfen
const fmtZeit = (sek) => {
  sek = Math.max(0, Math.round(sek));
  const h = Math.floor(sek / 3600), m = Math.floor(sek % 3600 / 60), s = sek % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s).padStart(2, '0')} s`;
};
const fmtHz = (hz) => hz == null ? '–' : (hz >= 1000 ? `${(+hz.toFixed(3)).toLocaleString('de-CH')} Hz` : `${+hz.toFixed(4)} Hz`);
const jetzt = () => new Date().toLocaleTimeString('de-CH');
function lade(key, std) { try { return JSON.parse(localStorage.getItem(key)) ?? std; } catch (e) { return std; } }
function speichere(key, wert) { try { localStorage.setItem(key, JSON.stringify(wert)); } catch (e) { /* voll oder gesperrt */ } }

// ------------------------------------------------------------------ Ordner C:\Spooky2 (Handle in IndexedDB)
const db = {
  async offen() {
    return new Promise((ok, nein) => {
      const r = indexedDB.open('generator-steuerung', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result); r.onerror = () => nein(r.error);
    });
  },
  async get(k) { const d = await this.offen(); return new Promise(ok => { const r = d.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); },
  async set(k, v) { try { const d = await this.offen(); return await new Promise(ok => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = ok; t.onerror = ok; }); } catch (e) { /* nicht speicherbar: beim nächsten Start neu wählen */ } },
};

const daten = { katalog: new Map(), presets: [], wellen: new Map(), geladen: false };

async function* dateienIn(ordner, pfad = '') {
  for await (const [name, h] of ordner.entries()) {
    if (h.kind === 'directory') yield* dateienIn(h, pfad ? `${pfad}\\${name}` : name);
    else yield { pfad: pfad ? `${pfad}\\${name}` : name, handle: h };
  }
}

async function ladeSpooky2(wurzel) {
  const status = $('#ordner-status');
  let presetOrdner = null, wellenOrdner = null;
  for await (const [name, h] of wurzel.entries()) {
    if (h.kind !== 'directory') continue;
    if (name.toLowerCase() === 'preset collections') presetOrdner = h;
    if (name.toLowerCase() === 'waveforms') wellenOrdner = h;
  }
  if (!presetOrdner || !wellenOrdner) throw new Error('Im gewählten Ordner fehlen «Preset Collections» oder «Waveforms». Bitte C:\\Spooky2 wählen.');
  const dec = new TextDecoder('windows-1252');
  const dateien = [];
  let n = 0;
  for await (const d of dateienIn(presetOrdner)) {
    if (!/\.txt$/i.test(d.pfad)) continue;
    dateien.push({ pfad: d.pfad, text: dec.decode(await (await d.handle.getFile()).arrayBuffer()) });
    if (++n % 200 === 0) status.textContent = `Lese Presets … ${n}`;
  }
  const wellen = new Map();
  for await (const d of dateienIn(wellenOrdner)) {
    if (!/\.csv$/i.test(d.pfad)) continue;
    const werte = K.leseWellenCsv(dec.decode(await (await d.handle.getFile()).arrayBuffer()));
    if (werte.length === 1024) wellen.set(d.pfad.split('\\').pop().replace(/\.csv$/i, ''), werte);
  }
  daten.katalog = K.baueKatalog(dateien);
  const liste = [];
  for (const d of dateien) {
    const ordner = d.pfad.split('\\').slice(0, -1).join(' › ');
    for (const p of K.lesePresets(d.text)) if (p.PresetName && /\(r\)|\\remote\\|shells\\remote/i.test(p.PresetName + '\\' + d.pfad + '\\')) liste.push({ name: p.PresetName, ordner, preset: p });
  }
  liste.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  daten.presets = liste;
  daten.wellen = wellen;
  daten.geladen = true;
  const dl = $('#preset-liste');
  dl.innerHTML = '';
  const gesehen = new Set();
  for (const p of liste) {
    if (gesehen.has(p.name)) continue;
    gesehen.add(p.name);
    const o = document.createElement('option'); o.value = p.name; o.label = p.ordner; dl.appendChild(o);
  }
  status.textContent = `${gesehen.size} Remote-Presets, ${wellen.size} Wellenformen geladen`;
  status.className = 'ok';
  for (const g of generatoren) g.pruefePreset();
}

async function waehleOrdner() {
  try {
    const h = await window.showDirectoryPicker({ id: 'spooky2', mode: 'read' });
    await db.set('spooky2', h);
    await ladeSpooky2(h);
  } catch (e) { if (e.name !== 'AbortError') zeigeFehler(e); }
}

async function ordnerBeimStart() {
  const h = await db.get('spooky2').catch(() => null);
  if (!h) return;
  const recht = await h.queryPermission({ mode: 'read' });
  if (recht === 'granted') { await ladeSpooky2(h).catch(zeigeFehler); return; }
  const b = $('#btn-ordner');
  b.textContent = 'Zugriff auf C:\\Spooky2 erlauben';
  b.onclick = async () => {
    if (await h.requestPermission({ mode: 'read' }) === 'granted') { b.textContent = 'Spooky2-Ordner wählen'; b.onclick = waehleOrdner; await ladeSpooky2(h).catch(zeigeFehler); }
  };
}

function zeigeFehler(e) {
  const s = $('#ordner-status'); s.textContent = e.message || String(e); s.className = 'fehler';
}

// ------------------------------------------------------------------ Serielle Verbindung
class Leitung {
  constructor(port) { this.port = port; this.rx = ''; this.kette = Promise.resolve(); this.offen = false; }
  async oeffne() {
    if (this.offen) return;
    await this.port.open({ baudRate: 57600, dataBits: 8, stopBits: 1, parity: 'none' });
    this.writer = this.port.writable.getWriter();
    this.offen = true;
    this.lese();
  }
  async lese() {
    const dec = new TextDecoder();
    this.reader = this.port.readable.getReader();
    try { for (;;) { const { value, done } = await this.reader.read(); if (done) break; this.rx += dec.decode(value, { stream: true }); } }
    catch (e) { /* Gerät getrennt */ }
    finally { try { this.reader.releaseLock(); } catch (e) {} this.offen = false; }
  }
  /** Befehl senden und auf «ok» warten; Befehle laufen streng nacheinander. */
  sende(befehl, timeout = 1500) {
    const auftrag = this.kette.then(async () => {
      if (!this.offen) throw new Error('Generator nicht verbunden');
      this.rx = '';
      await this.writer.write(new TextEncoder().encode(befehl));
      const start = Date.now();
      for (;;) {
        const i = this.rx.indexOf('\n');
        if (i >= 0) { const z = this.rx.slice(0, i).trim(); this.rx = this.rx.slice(i + 1); if (!/^ok/i.test(z)) throw new Error(`Antwort «${z}»`); return z; }
        if (Date.now() - start > timeout) throw new Error('keine Antwort');
        await new Promise(r => setTimeout(r, 5));
      }
    });
    this.kette = auftrag.catch(() => {});
    return auftrag;
  }
  async schliesse() {
    try { await this.reader?.cancel(); } catch (e) {}
    try { this.writer?.releaseLock(); } catch (e) {}
    try { await this.port.close(); } catch (e) {}
    this.offen = false;
  }
}

// ------------------------------------------------------------------ Generator
const generatoren = [];
let gespeichert = lade(SPEICHER, []);
const speichereAlle = () => { gespeichert = generatoren.map(g => g.daten()); speichere(SPEICHER, gespeichert); };

class Generator {
  constructor(port, index) {
    this.leitung = new Leitung(port);
    this.index = index;
    const g = gespeichert[index] || {};
    this.einst = { nr: g.nr ?? index + 1, preset: g.preset || '', zeile: g.zeile || '', durchlaeufe: g.durchlaeufe ?? 1, startUm: g.startUm || '' };
    this.lauf = null;                    // laufender Ablauf
    this.fortsetzen = g.lauf || null;    // gespeicherter Stand nach Neuladen
    this.protokoll = [];
    this.baueKarte();
  }
  daten() {
    const l = this.lauf;
    return { ...this.einst, lauf: l && l.status !== 'fertig' ? { schritt: l.schritt, tImSchritt: l.tImSchritt, durchlauf: l.durchlauf, status: l.status, startUm: l.startUmMs } : null };
  }
  log(text, art = '') {
    this.protokoll.push(`${jetzt()}  ${text}`);
    if (this.protokoll.length > 200) this.protokoll.shift();
    const el = $('.protokoll', this.karte);
    if (el.open) { el.querySelector('pre').textContent = this.protokoll.join('\n'); }
    if (art === 'fehler') this.setzeStatus(text, 'fehler');
  }
  baueKarte() {
    const k = document.getElementById('vorlage-generator').content.firstElementChild.cloneNode(true);
    this.karte = k;
    const info = this.leitung.port.getInfo();
    $('.chip', k).textContent = info.usbVendorId === 0x1a86 ? 'CH340' : info.usbVendorId === 0x10c4 ? 'CP210x' : 'USB';
    const nr = $('.nr', k); nr.value = this.einst.nr;
    nr.onchange = () => { this.einst.nr = nr.value; speichereAlle(); };
    const pr = $('.preset', k); pr.value = this.einst.preset;
    pr.onchange = () => { this.einst.preset = pr.value.trim(); speichereAlle(); this.pruefePreset(); };
    const ze = $('.zeile', k); ze.value = this.einst.zeile;
    ze.onchange = () => { this.einst.zeile = ze.value.trim(); speichereAlle(); this.pruefePreset(); };
    const du = $('.durchlaeufe', k); du.value = this.einst.durchlaeufe;
    du.onchange = () => { this.einst.durchlaeufe = Math.max(0, parseInt(du.value, 10) || 0); du.value = this.einst.durchlaeufe; speichereAlle(); this.pruefePreset(); };
    const st = $('.start-um', k); st.value = this.einst.startUm;
    st.onchange = () => { this.einst.startUm = st.value; speichereAlle(); };
    $('.btn-start', k).onclick = () => this.starte();
    $('.btn-stop', k).onclick = () => this.stoppe('gestoppt');
    $('.btn-erkennen', k).onclick = () => this.erkennen();
    $('.btn-weiter', k).onclick = () => this.starte(this.fortsetzen);
    $('.protokoll', k).ontoggle = () => { $('.protokoll pre', k).textContent = this.protokoll.join('\n'); };
    $('#generatoren').appendChild(k);
    this.pruefePreset();
    if (this.fortsetzen) {
      $('.btn-weiter', k).hidden = false;
      this.setzeStatus(`Unterbrochen bei Schritt ${this.fortsetzen.schritt + 1}, Durchlauf ${this.fortsetzen.durchlauf}`, 'warnung');
    } else this.setzeStatus('bereit');
  }
  setzeStatus(text, art = '') { const s = $('.status', this.karte); s.textContent = text; s.className = 'status ' + art; }

  /** Preset + Zeile -> Einstellungen und Plan, Warnungen anzeigen. */
  pruefePreset() {
    const w = $('.warnungen', this.karte), z = $('.zusammenfassung', this.karte);
    w.textContent = ''; z.textContent = '';
    this.vorbereitet = null;
    $('.btn-start', this.karte).disabled = true;
    $('.btn-weiter', this.karte).disabled = true;
    if (!daten.geladen) { z.textContent = 'Zuerst den Spooky2-Ordner wählen.'; return null; }
    if (!this.einst.preset) { z.textContent = 'Preset wählen.'; return null; }
    const roh = daten.katalog.get(this.einst.preset.toLowerCase());
    if (!roh) { w.textContent = `Preset «${this.einst.preset}» nicht gefunden.`; return null; }
    const { preset, fehlt } = K.loeseBasis(roh, daten.katalog);
    const e = K.einstellungen(preset);
    const programme = this.einst.zeile ? [{ name: 'Frequenzzeile', eintraege: K.leseFrequenzzeile(this.einst.zeile) }] : K.programmeAusPreset(preset);
    const plan = K.erstellePlan(e, programme);
    const warn = [...plan.warnungen];
    if (fehlt) warn.unshift(`Basis-Preset fehlt: ${fehlt}`);
    for (const welle of [e.out1.welle, e.out2.welle]) if (welle && !K.findeWelle(daten.wellen, welle.datei)) warn.push(`Wellenform «${welle.datei}» fehlt im Ordner Waveforms`);
    if (!programme.length) warn.push('Keine Frequenzen: Frequenzzeile eingeben');
    else if (!plan.schritte.some(x => !x.pause)) warn.push('Keine abspielbaren Frequenzen');
    w.textContent = warn.join(' · ');
    const d = this.einst.durchlaeufe;
    z.textContent = `${e.out1.welle ? e.out1.welle.datei : '?'}${e.out2.welle?.invertiert ? ' · Out2 gespiegelt' : ''} · ${e.out1.amp} V · Out2: ${({ gleich: 'gleiche Frequenz', dual: 'Dual', programm: 'Programmfrequenz', faktor: `× ${e.out2Modus.faktor} + ${e.out2Modus.konstante} Hz` })[e.out2Modus.art]}` +
      ` · ${plan.schritte.length} Schritte · ${fmtZeit(plan.gesamtSek)} pro Durchlauf` + (d ? ` · ${d} × = ${fmtZeit(plan.gesamtSek * d)}` : ' · endlos');
    const blockiert = warn.some(x => /fehlt|Keine|nicht unterstützt|nicht gefunden|Unbekannter/.test(x)) || e.warnungen.length > 0;
    this.vorbereitet = blockiert ? null : { e, plan };
    $('.btn-start', this.karte).disabled = !this.vorbereitet || !!this.lauf;
    $('.btn-weiter', this.karte).disabled = !this.vorbereitet || !!this.lauf;
    return this.vorbereitet;
  }

  sperre(laufend) {
    for (const s of ['.preset', '.zeile', '.durchlaeufe', '.start-um', '.btn-erkennen']) $(s, this.karte).disabled = laufend;
    $('.btn-start', this.karte).disabled = laufend || !this.vorbereitet;
    $('.btn-stop', this.karte).disabled = !laufend;
    this.karte.classList.toggle('laeuft', laufend);
  }

  async sende(liste) {
    for (const [text, befehl, timeout] of liste) {
      try { await this.leitung.sende(befehl, timeout); this.log(`${text} ✓`); }
      catch (e) { this.log(`${text}: ${e.message}`, 'fehler'); throw e; }
    }
  }

  async erkennen() {
    try {
      await this.leitung.oeffne();
      const nr = parseFloat(this.einst.nr) || this.index + 1;
      const z = K.neuerZustand();
      await this.sende([['Ausgang 1 aus', K.Befehl.ausgang(0, false)], ['Ausgang 2 aus', K.Befehl.ausgang(1, false)], ...K.frequenzBefehle(nr, nr, z)]);
      this.setzeStatus(`Display zeigt jetzt ${nr} Hz (Ausgänge aus)`, 'ok');
    } catch (e) { this.setzeStatus('Erkennen fehlgeschlagen: ' + e.message, 'fehler'); }
  }

  async starte(stand = null) {
    if (this.lauf) return;
    const v = this.pruefePreset();
    if (!v) return;
    this.fortsetzen = null;
    $('.btn-weiter', this.karte).hidden = true;
    let startUmMs = null;
    if (stand?.startUm && stand.status === 'wartet') startUmMs = stand.startUm;
    else if (!stand && this.einst.startUm) {
      const [h, m] = this.einst.startUm.split(':').map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      startUmMs = d.getTime();
    }
    this.lauf = {
      ...v, schritt: stand?.schritt ?? 0, tImSchritt: stand?.tImSchritt ?? 0, durchlauf: stand?.durchlauf ?? 1,
      durchlaeufe: this.einst.durchlaeufe, zustand: K.neuerZustand(), status: startUmMs ? 'wartet' : 'einrichten',
      startUmMs, letzterTick: null, letzteSweepSek: -1, beschaeftigt: false,
    };
    this.sperre(true);
    speichereAlle();
    if (startUmMs) this.setzeStatus(`Wartet bis ${new Date(startUmMs).toLocaleString('de-CH', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`, 'warnung');
  }

  async einrichten() {
    const l = this.lauf;
    l.beschaeftigt = true;
    try {
      this.setzeStatus('Generator wird eingerichtet …');
      await this.leitung.oeffne();
      await this.sende(K.einrichtung(l.e, daten.wellen));
      l.status = 'laeuft';
      speichereAlle();
      l.letzterTick = performance.now();
      l.zustand = K.neuerZustand();
      await this.spieleSchritt(true);
    } catch (e) {
      this.stoppe('Fehler beim Einrichten: ' + e.message, true);
    } finally { if (this.lauf) this.lauf.beschaeftigt = false; }
  }

  /** Aktuellen Schritt an den Generator geben (bei Wechsel oder Sweep-Fortschritt). */
  async spieleSchritt(neu) {
    const l = this.lauf;
    const s = l.plan.schritte[l.schritt];
    const b = [];
    if (s.pause) b.push(...K.ausgangBefehle(false, l.zustand));
    else {
      const { f1, f2 } = K.frequenzenBei(s, Math.floor(l.tImSchritt), l.e);   // Sweeps auf ganzen Sekunden
      b.push(...K.frequenzBefehle(f1, f2, l.zustand));
      b.push(...K.ausgangBefehle(true, l.zustand));
      l.f1 = f1; l.f2 = f2;
    }
    if (b.length) await this.sende(b);
    if (neu) this.log(`Schritt ${l.schritt + 1}/${l.plan.schritte.length}: ${s.pause ? 'Pause' : `${fmtHz(l.f1)} / ${fmtHz(l.f2)}`} für ${s.sek} s`);
  }

  /** Wird regelmässig vom Taktgeber aufgerufen. */
  async tick() {
    const l = this.lauf;
    if (!l || l.beschaeftigt) return;
    if (l.status === 'wartet') {
      if (Date.now() >= l.startUmMs) { l.status = 'einrichten'; } else return;
    }
    if (l.status === 'einrichten') { await this.einrichten(); return; }
    if (l.status !== 'laeuft') return;
    const t = performance.now();
    l.tImSchritt += (t - l.letzterTick) / 1000;
    l.letzterTick = t;
    l.beschaeftigt = true;
    try {
      let gewechselt = false;
      while (l.tImSchritt >= l.plan.schritte[l.schritt].sek) {
        l.tImSchritt -= l.plan.schritte[l.schritt].sek;
        l.schritt++;
        gewechselt = true;
        if (l.schritt >= l.plan.schritte.length) {
          l.schritt = 0;
          if (l.durchlaeufe && l.durchlauf >= l.durchlaeufe) { await this.stoppe('fertig'); return; }
          l.durchlauf++;
          this.log(`Durchlauf ${l.durchlauf} beginnt`);
        }
      }
      const s = l.plan.schritte[l.schritt];
      const sweepSek = Math.floor(l.tImSchritt);
      if (gewechselt) { l.letzteSweepSek = sweepSek; await this.spieleSchritt(true); }
      else if (s.sweep && sweepSek !== l.letzteSweepSek) { l.letzteSweepSek = sweepSek; await this.spieleSchritt(false); }
      this.zeigeFortschritt();
    } catch (e) {
      this.stoppe('Verbindung verloren: ' + e.message, true);
    } finally { if (this.lauf) this.lauf.beschaeftigt = false; }
  }

  zeigeFortschritt() {
    const l = this.lauf; if (!l) return;
    const s = l.plan.schritte[l.schritt];
    const vorher = l.plan.schritte.slice(0, l.schritt).reduce((a, x) => a + x.sek, 0) + l.tImSchritt;
    const rest = l.plan.gesamtSek - vorher + (l.durchlaeufe ? (l.durchlaeufe - l.durchlauf) * l.plan.gesamtSek : 0);
    this.setzeStatus(`${s.pause ? 'Pause' : `Out1 ${fmtHz(l.f1)} · Out2 ${fmtHz(l.f2)}`} · Schritt ${l.schritt + 1}/${l.plan.schritte.length} · Durchlauf ${l.durchlauf}${l.durchlaeufe ? '/' + l.durchlaeufe : ''} · ${l.durchlaeufe ? 'noch ' + fmtZeit(rest) : 'endlos'}`, 'ok');
    $('.balken > div', this.karte).style.width = `${Math.min(100, vorher / l.plan.gesamtSek * 100)}%`;
  }

  async stoppe(grund, fehler = false) {
    const l = this.lauf;
    this.lauf = null;
    if (l && l.status !== 'wartet') {
      try { await this.sende([['Ausgang 1 aus', K.Befehl.ausgang(0, false)], ['Ausgang 2 aus', K.Befehl.ausgang(1, false)]]); } catch (e) { /* Gerät weg */ }
    }
    this.sperre(false);
    $('.balken > div', this.karte).style.width = '0';
    this.setzeStatus(grund === 'fertig' ? `Fertig um ${jetzt()}` : grund, fehler ? 'fehler' : grund === 'fertig' ? 'ok' : '');
    this.log(grund);
    speichereAlle();
    this.pruefePreset();
  }
}

// ------------------------------------------------------------------ Taktgeber (Web Worker, läuft auch im Hintergrund)
function starteTakt() {
  const code = 'setInterval(() => postMessage(0), 100);';
  const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
  let letztesSpeichern = 0;
  w.onmessage = () => {
    for (const g of generatoren) g.tick();
    if (Date.now() - letztesSpeichern > 5000) { letztesSpeichern = Date.now(); if (generatoren.some(g => g.lauf)) speichereAlle(); }
  };
}

// ------------------------------------------------------------------ Start
async function fuegeHinzu(port) {
  if (generatoren.some(g => g.leitung.port === port)) return;
  $('#generatoren .leer')?.remove();
  const g = new Generator(port, generatoren.length);
  generatoren.push(g);
  try { await g.leitung.oeffne(); } catch (e) { g.setzeStatus('Anschluss belegt oder getrennt (Spooky2 geschlossen?)', 'fehler'); }
  $('#anzahl').textContent = `${generatoren.length} Generator${generatoren.length === 1 ? '' : 'en'}`;
  speichereAlle();
}

async function init() {
  $('#version').textContent = VERSION;
  if (!('serial' in navigator) || !('showDirectoryPicker' in window)) { $('#kein-chrome').hidden = false; return; }
  $('#btn-ordner').onclick = waehleOrdner;
  $('#btn-hinzu').onclick = async () => { try { await fuegeHinzu(await navigator.serial.requestPort()); } catch (e) { /* abgebrochen */ } };
  $('#btn-alle-stopp').onclick = () => { for (const g of generatoren) if (g.lauf) g.stoppe('gestoppt'); };
  navigator.serial.addEventListener('connect', (ev) => fuegeHinzu(ev.target));
  window.addEventListener('beforeunload', (ev) => { speichereAlle(); if (generatoren.some(g => g.lauf)) { ev.preventDefault(); ev.returnValue = ''; } });
  await ordnerBeimStart();
  for (const p of await navigator.serial.getPorts()) await fuegeHinzu(p);
  starteTakt();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
