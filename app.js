/* RADIX Frequenzsteuerung – Oberfläche, Verbindung, Ablauf
 * Idee, Konzept & Architektur Markus Rufer · Technische Umsetzung. Claude by Anthropic
 */
'use strict';
const VERSION = '0.6.7';
const $ = (s, el = document) => el.querySelector(s);
const K = window.Kern;
const SPEICHER = 'radix-generatoren-v2';   // { zuordnung: [Nummer je Anschluss], gen: { Nummer: Einstellungen } }
const STD_PRESET = 'Healing (R) - JW';

// ------------------------------------------------------------------ Hilfen
const fmtZeit = (sek) => {
  sek = Math.max(0, Math.round(sek));
  const h = Math.floor(sek / 3600), m = Math.floor(sek % 3600 / 60), s = sek % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s).padStart(2, '0')} s`;
};
const fmtHz = (hz) => hz == null ? '–' : (hz >= 1000 ? `${(+hz.toFixed(3)).toLocaleString('de-CH')} Hz` : `${+hz.toFixed(4)} Hz`);
const jetzt = () => new Date().toLocaleTimeString('de-CH');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function lade(key, std) { try { return JSON.parse(localStorage.getItem(key)) ?? std; } catch (e) { return std; } }
function speichere(key, wert) { try { localStorage.setItem(key, JSON.stringify(wert)); } catch (e) { /* voll oder gesperrt */ } }
function setzeQuelle(sel, text, art = '') { const s = $(sel); s.textContent = text; s.title = text; s.className = 'stand ' + art; }

// ------------------------------------------------------------------ Gemerkte Ordner und Dateien (Handles in IndexedDB)
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

const daten = { katalog: new Map(), presets: [], wellen: new Map(), geladen: false, finder: null, kontrolle: null };
const alleKarten = (fn) => { for (const g of generatoren) fn(g); };

// ------------------------------------------------------------------ Spooky2-Ordner
async function* dateienIn(ordner, pfad = '') {
  for await (const [name, h] of ordner.entries()) {
    if (h.kind === 'directory') yield* dateienIn(h, pfad ? `${pfad}\\${name}` : name);
    else yield { pfad: pfad ? `${pfad}\\${name}` : name, handle: h };
  }
}

async function ladeSpooky2(wurzel) {
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
    if (++n % 200 === 0) setzeQuelle('#ordner-status', `Lese Presets … ${n}`);
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
  setzeQuelle('#ordner-status', `${gesehen.size} Remote-Presets, ${wellen.size} Wellenformen`, 'ok');
  alleKarten(g => { g.pruefe(); g.aktualisiereKunde(); });
}

async function waehleOrdner() {
  try {
    const h = await window.showDirectoryPicker({ id: 'spooky2', mode: 'read' });
    await db.set('spooky2', h);
    await ladeSpooky2(h);
  } catch (e) { if (e.name !== 'AbortError') setzeQuelle('#ordner-status', e.message || String(e), 'fehler'); }
}

async function ordnerBeimStart() {
  const h = await db.get('spooky2').catch(() => null);
  if (!h) return;
  const fehler = (e) => setzeQuelle('#ordner-status', e.message || String(e), 'fehler');
  if (await h.queryPermission({ mode: 'read' }) === 'granted') { await ladeSpooky2(h).catch(fehler); return; }
  const b = $('#btn-ordner');
  b.textContent = 'Zugriff erlauben';
  setzeQuelle('#ordner-status', 'C:\\Spooky2 gemerkt – Zugriff bestätigen', 'fehler');
  b.onclick = async () => {
    if (await h.requestPermission({ mode: 'read' }) === 'granted') { b.textContent = 'Ordner wählen'; b.onclick = waehleOrdner; await ladeSpooky2(h).catch(fehler); }
  };
}

// ------------------------------------------------------------------ Frequenz-Finder und Kontrollblatt (Dateien, nur lesen)
const quellen = {
  finder: {
    titel: 'Frequenz-Finder', status: '#finder-status', knopf: '#btn-finder', alleMs: 60000,
    typen: [{ description: 'Frequenz-Finder (HTML)', accept: { 'text/html': ['.html', '.htm'] } }],
    verarbeite(text, datei) {
      const k = K.finderKatalog(text);
      daten.finder = k;
      setzeQuelle(this.status, `${k.version || 'Finder'} · ${k.programme.size} Programme · ${datei.name}`, 'ok');
      alleKarten(g => { g.pruefe(); g.aktualisiereKunde(); });
    },
  },
  kontrolle: {
    titel: 'Kontrollblatt', status: '#kontrolle-status', knopf: '#btn-kontrolle', alleMs: 1000,
    typen: [{ description: 'Kontrollblatt-Sicherung (JSON)', accept: { 'application/json': ['.json'] } }],
    verarbeite(text, datei) {
      const k = K.leseKontrolle(text);
      const vorher = daten.kontrolle;
      daten.kontrolle = { ...k, zeit: datei.lastModified, name: datei.name };
      const stand = new Date(datei.lastModified).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      setzeQuelle(this.status, `Stand ${stand} · ${Object.keys(k.blaetter).length} Blätter · ${datei.name}`, 'ok');
      alleKarten(g => g.aktualisiereKunde());
      // Blatt im Kontrollblatt angeklickt -> zur Karte dieses Generators springen (nicht beim ersten Lesen)
      if (vorher && k.aktiv != null && (k.aktiv !== vorher.aktiv || k.aktivZeit !== vorher.aktivZeit)) springeZu(k.aktiv);
    },
  },
};

async function ladeQuelle(name, nurWennNeu = false) {
  const q = quellen[name];
  if (!q.handle) return;
  const f = await q.handle.getFile();
  if (nurWennNeu && q.zuletzt === f.lastModified && q.groesse === f.size) return;
  const text = await f.text();
  try { q.verarbeite(text, f); q.zuletzt = f.lastModified; q.groesse = f.size; }
  catch (e) {
    // Datei wird evtl. gerade geschrieben: alten Stand behalten, nur melden
    if (!nurWennNeu) setzeQuelle(q.status, `${f.name}: ${e.message}`, 'fehler');
  }
}

async function waehleDatei(name) {
  const q = quellen[name];
  try {
    const [h] = await window.showOpenFilePicker({ id: name, types: q.typen, multiple: false });
    q.handle = h; q.zuletzt = null;
    await db.set(name, h);
    await ladeQuelle(name);
  } catch (e) { if (e.name !== 'AbortError') setzeQuelle(q.status, e.message || String(e), 'fehler'); }
}

async function quelleBeimStart(name) {
  const q = quellen[name];
  $(q.knopf).onclick = () => waehleDatei(name);
  const h = await db.get(name).catch(() => null);
  if (!h) return;
  q.handle = h;
  if (await h.queryPermission({ mode: 'read' }) === 'granted') { await ladeQuelle(name).catch(e => setzeQuelle(q.status, e.message, 'fehler')); }
  else {
    const b = $(q.knopf);
    b.textContent = 'Zugriff erlauben';
    setzeQuelle(q.status, `${h.name} gemerkt – Zugriff bestätigen`, 'fehler');
    b.onclick = async () => {
      if (await h.requestPermission({ mode: 'read' }) === 'granted') { b.textContent = 'Datei wählen'; b.onclick = () => waehleDatei(name); await ladeQuelle(name).catch(e => setzeQuelle(q.status, e.message, 'fehler')); }
    };
  }
}

/** Änderungen der Dateien laufend übernehmen (das Kontrollblatt speichert automatisch). */
function beobachteQuellen() {
  for (const [name, q] of Object.entries(quellen)) {
    setInterval(async () => {
      try { if (q.handle && await q.handle.queryPermission({ mode: 'read' }) === 'granted') await ladeQuelle(name, true); } catch (e) { /* Datei kurz nicht lesbar */ }
    }, q.alleMs);
  }
}

// ------------------------------------------------------------------ Serielle Verbindung
const BAUDRATEN = [57600, 115200, 38400, 19200, 9600];          // 57600 = Spooky2 XM (geprüft); übrige nur als Suche
const zeigeRoh = (t, max = 40) => String(t).slice(0, max).replace(/[\x00-\x1f\x7f-￿]/g, c => c === '\r' ? '\\r' : c === '\n' ? '\\n' : `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);

/** Spooky2 GeneratorX Pro: Doppel-Chip CH342 (USB 1a86:55d2), 115200 Baud, eigenes Protokoll («:w24=…,»).
 *  Von RADIX noch nicht gesteuert. Der Anschluss wird nur für den GX-Test geöffnet (Knopf «Testen» auf der GX-Karte)
 *  und danach wieder freigegeben, damit Spooky2 ihn betreiben kann. */
const GX_GESPERRT = 'GX Pro gesperrt (antwortet «:err»): Nach Strom aus/ein muss Spooky2 ihn einmal freischalten. Spooky2 starten, warten bis der GX dort erscheint, Spooky2 schliessen – dann hier nochmals Start oder Testen.';
const istGX = (port) => { const i = port.getInfo(); return i.usbVendorId === 0x1a86 && i.usbProductId === 0x55d2; };
// 0.6.6: Takt wie Spooky2 (Mitschnitt 28.10.2026). Der GX bestätigt eine Wellentabelle (:a…) sofort mit «:ok», ist danach aber
// kurz taub: am Gerät ging der Befehl direkt nach der Tabelle verloren (17:41, «Out1 auf Tabelle 14: keine Antwort»).
// Spooky2 wartet ~100 ms nach jedem Befehl und ~200 ms nach jeder Tabelle. Bleibt eine Antwort trotzdem aus, wird der Befehl
// einmal wiederholt (alle GX-Befehle setzen nur Werte, doppelt senden schadet nicht).
const GX_ABSTAND = 100, GX_ABSTAND_TABELLE = 300, GX_WIEDERHOLEN_NACH = 300;
const ABGEBROCHEN = 'abgebrochen (gestoppt)';

class Leitung {
  constructor(port) { this.port = port; this.rx = ''; this.kette = Promise.resolve(); this.offen = false; this.baud = BAUDRATEN[0]; this.gx = false; this.frei = 0; this.melde = null; }
  /** Anschluss öffnen (mit dieser Baudrate). Hängt ein alter Zustand fest, wird zuerst sauber geschlossen. */
  async oeffne(baud = this.baud) {
    if (this.offen && baud === this.baud) return;
    if (this.offen || this.port.readable || this.port.writable) await this.schliesse();
    await this.port.open({ baudRate: baud, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
    this.baud = baud;
    this.writer = this.port.writable.getWriter();
    this.rx = '';
    this.offen = true;
    this.lese();
  }
  schreibe(text) { return this.writer.write(new TextEncoder().encode(text)); }
  async lese() {
    const dec = new TextDecoder();
    const reader = this.reader = this.port.readable.getReader();
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; this.rx += dec.decode(value, { stream: true }); } }
    catch (e) { /* Gerät getrennt */ }
    finally { try { reader.releaseLock(); } catch (e) {} if (this.reader === reader) this.offen = false; }
  }
  /** Befehl senden und auf «ok» warten; Befehle laufen streng nacheinander. GX: Abstand wie Spooky2, einmal wiederholen. */
  sende(befehl, timeout = 1500) {
    const auftrag = this.kette.then(async () => {
      if (!this.offen && this.wiederOeffnen) { try { await this.wiederOeffnen(); } catch (e) { /* unten gemeldet */ } }
      if (!this.offen) throw new Error('Generator nicht verbunden');
      const versuche = this.gx ? 2 : 1;
      for (let v = 1; ; v++) {
        if (this.gx) { const w = this.frei - Date.now(); if (w > 0) await new Promise(r => setTimeout(r, w)); }
        try {
          const z = await this.einmal(befehl, timeout);
          if (this.gx) this.frei = Date.now() + (/^:a\d/.test(befehl) ? GX_ABSTAND_TABELLE : GX_ABSTAND);
          return z;
        } catch (e) {
          if (v >= versuche || e.message !== 'keine Antwort') throw e;
          if (this.melde) this.melde(`GX: keine Antwort auf «${zeigeRoh(befehl.trim(), 30)}» – nochmals gesendet`);
          this.frei = Date.now() + GX_WIEDERHOLEN_NACH;
        }
      }
    });
    this.kette = auftrag.catch(() => {});
    return auftrag;
  }
  /** Ein Versuch: schreiben, auf «ok» warten. */
  async einmal(befehl, timeout) {
    this.rx = '';
    await this.schreibe(befehl);
    const start = Date.now();
    let okSeit = null;
    for (;;) {
      const i = this.rx.indexOf('\n');
      if (i >= 0) { const z = this.rx.slice(0, i).trim(); this.rx = this.rx.slice(i + 1); if (!/^:?ok/i.test(z)) throw new Error(/^:err/i.test(z) ? 'GX antwortet «:err»' : `falsche Antwort «${zeigeRoh(z)}»`); return z; }
      if (/^\s*:?ok/i.test(this.rx)) {                       // «ok» ohne Zeilenende (andere Firmware): kurz warten, dann gelten lassen
        if (okSeit === null) okSeit = Date.now(); else if (Date.now() - okSeit > 60) { this.rx = ''; return 'ok'; }
      }
      if (Date.now() - start > timeout) throw new Error(this.rx ? `unverständliche Antwort «${zeigeRoh(this.rx)}»` : 'keine Antwort');
      await new Promise(r => setTimeout(r, 5));
    }
  }
  /** GX-Test: Zeile senden (wie getippt) und alles sammeln, was in «warte» ms zurückkommt. Keine Erwartung an die Antwort. */
  roh(text, warte = 700) {
    const auftrag = this.kette.then(async () => {
      if (!this.offen) throw new Error('Anschluss nicht offen');
      this.rx = '';
      await this.schreibe(text);
      await new Promise(r => setTimeout(r, warte));
      const a = this.rx; this.rx = '';
      return a;
    });
    this.kette = auftrag.catch(() => {});
    return auftrag;
  }
  async schliesse() {
    const r = this.reader; this.reader = null;
    try { await r?.cancel(); } catch (e) {}
    try { this.writer?.releaseLock(); } catch (e) {}
    this.writer = null;
    try { await this.port.close(); } catch (e) {}
    this.offen = false;
  }
}

// ------------------------------------------------------------------ RADIX-Brücke (Hilfsprogramm auf dem Spooky-PC)
// Chrome kennt weder COM-Namen noch USB-Steckplatz. Die Brücke schon. Windows vergibt die COM-Nummern der CH340 (ohne
// Seriennummer) bei Markus bei jedem Start neu – fest ist nur der Steckplatz («schluessel»). RADIX merkt sich darum pro
// Steckplatz die Generator-Nummer (speicher.orte). Neu erkannter Steckplatz: COM-Nummer als Vorschlag, dann einmal «Zuordnen».
const BRUECKE_URL = 'ws://127.0.0.1:8642';
const bruecke = { ws: null, verbunden: false, version: '', besetzt: false, leitungen: new Map(), wartend: new Map() };
let modus = 'chrome';                                                    // 'chrome' oder 'bruecke'

class BrueckenLeitung extends Leitung {
  constructor(p) {
    super({ getInfo: () => ({ usbVendorId: p.vid, usbProductId: p.pid }) });
    this.p = p; this.schluessel = p.schluessel || p.id;
  }
  get id() { return this.p.id; }                                         // aktueller COM-Name (kann nach Neustart anders sein)
  async oeffne(baud = this.baud) {
    if (this.offen && baud === this.baud) return;
    if (!bruecke.verbunden) throw new Error('RADIX-Brücke nicht verbunden');
    if (!bruecke.leitungen.has(this.schluessel) || this.weg) throw new Error(`${this.p.com} nicht da (Kabel?)`);
    await new Promise((ok, nein) => {
      const uhr = setTimeout(() => { bruecke.wartend.delete(this.id); nein(new Error('Brücke antwortet nicht')); }, 4000);
      bruecke.wartend.set(this.id, { ok: () => { clearTimeout(uhr); ok(); }, nein: (e) => { clearTimeout(uhr); nein(e); } });
      bruecke.ws.send(JSON.stringify({ t: 'oeffne', id: this.id, baud }));
    });
    this.baud = baud; this.rx = ''; this.offen = true;
  }
  schreibe(text) {
    if (!bruecke.verbunden) { this.offen = false; throw new Error('RADIX-Brücke nicht verbunden'); }
    bruecke.ws.send(JSON.stringify({ t: 'schreibe', id: this.id, daten: text }));
  }
  /** Nach einem Unterbruch (Brücke neu gestartet, Kabel kurz weg) vor dem nächsten Befehl selbst wieder öffnen. */
  async wiederOeffnen() { if (bruecke.verbunden && !this.weg) await this.oeffne(this.baud); }
  async schliesse() { if (bruecke.verbunden) bruecke.ws.send(JSON.stringify({ t: 'schliesse', id: this.id })); this.offen = false; }
}

/** Verbindung zur Brücke. Ergebnis true = Brücke da. */
function verbindeBruecke(wartezeit = 1500, nurPruefen = false) {
  return new Promise((fertig) => {
    let ws, erledigt = false;
    const ende = (x) => { if (!erledigt) { erledigt = true; fertig(x); } };
    try { ws = new WebSocket(BRUECKE_URL); } catch (e) { ende(false); return; }
    const uhr = setTimeout(() => { try { ws.close(); } catch (e) {} ende(false); }, wartezeit);
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (nurPruefen) { if (m.t === 'hallo') { clearTimeout(uhr); try { ws.close(); } catch (e) {} ende(true); } return; }
      if (m.t === 'hallo') { clearTimeout(uhr); bruecke.ws = ws; bruecke.verbunden = true; bruecke.version = m.version; zeigeBruecke(); ende(true); }
      else if (m.t === 'liste') brueckenListe(m.ports);
      else if (m.t === 'offen') { const w = bruecke.wartend.get(m.id); bruecke.wartend.delete(m.id); if (w) w.ok(); }
      else if (m.t === 'fehler') {
        const w = m.id && bruecke.wartend.get(m.id);
        if (w) { bruecke.wartend.delete(m.id); w.nein(new Error(m.text)); }
        else if (!m.id) { bruecke.besetzt = true; clearTimeout(uhr); zeigeBruecke(m.text); alert(m.text); ende(false); }
      }
      else if (m.t === 'daten') { const l = leitungMitId(m.id); if (l) l.rx += m.daten; }
      else if (m.t === 'zu') { const l = leitungMitId(m.id); if (l) l.offen = false; }
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      clearTimeout(uhr);
      const war = bruecke.ws === ws && bruecke.verbunden;
      if (bruecke.ws === ws) { bruecke.verbunden = false; for (const l of bruecke.leitungen.values()) l.offen = false; }
      if (war) { zeigeBruecke(); setTimeout(neuVerbinden, 2000); }
      ende(false);
    };
  });
}

const leitungMitId = (id) => { for (const l of bruecke.leitungen.values()) if (l.p.id === id) return l; return null; };

/** Brücke verloren (Fenster zu, PC-Neustart): immer wieder versuchen. Laufende Generatoren öffnen ihren Anschluss dann selbst. */
async function neuVerbinden() {
  if (bruecke.verbunden) return;
  zeigeBruecke();
  if (!await verbindeBruecke(2500)) setTimeout(neuVerbinden, 3000);
}

function zeigeBruecke(text) {
  const el = $('#bruecke');
  el.hidden = false;
  if (bruecke.besetzt) { el.className = 'info fehler'; el.textContent = 'RADIX-Brücke besetzt'; el.title = text || ''; return; }
  if (modus === 'chrome') {
    el.className = 'info'; el.textContent = 'ohne RADIX-Brücke';
    el.title = 'Die RADIX-Brücke läuft nicht: Generatoren direkt über Chrome. Nummern nach jedem Öffnen mit «Alle testen» prüfen. Brücke starten (Desktop «RADIX-Brücke»), dann diese Seite neu laden.';
    return;
  }
  el.className = 'info ' + (bruecke.verbunden ? 'ok' : 'fehler');
  el.textContent = bruecke.verbunden ? `RADIX-Brücke ${bruecke.version} ✓` : 'RADIX-Brücke getrennt – verbinde neu …';
  el.title = bruecke.verbunden ? 'Generator-Nummer fest am USB-Steckplatz (einmal zuordnen, gilt nach jedem Neustart)' : 'Das Fenster «RADIX-Brücke» auf dem PC ist zu oder abgestürzt. Neu starten: Desktop-Verknüpfung «RADIX-Brücke».';
}

/** Anschlussliste der Brücke (alle 2 s bei Änderung): neue Generatoren als Karte, ausgesteckte melden, wieder eingesteckte verbinden. */
function brueckenListe(ports) {
  const da = new Set();
  for (const p of ports) {
    const key = p.schluessel || p.id;
    da.add(key);
    let l = bruecke.leitungen.get(key);
    if (!l) { l = new BrueckenLeitung(p); bruecke.leitungen.set(key, l); fuegeHinzu(l); continue; }
    if (l.p.id !== p.id && l.offen) l.offen = false;                       // COM-Name hat gewechselt: neu öffnen
    const vorher = l.p.com;
    l.p = p;
    const g = generatoren.find(x => x.leitung === l);
    if (g && vorher !== p.com) { g.log(`Steckplatz ${p.ort}: jetzt ${p.com} (vorher ${vorher})`); g.zeigeVerbindung(g.verbunden ? 'ok' : 'fehler'); }
    if (l.weg) { l.weg = false; if (g) { g.getrennt = false; g.log(`${p.com} wieder da`); if (!g.lauf) g.verbinde(); } }
  }
  for (const [id, l] of bruecke.leitungen) {
    if (da.has(id) || l.weg) continue;
    l.weg = true; l.offen = false;
    const g = generatoren.find(x => x.leitung === l);
    if (g) {
      g.getrennt = true; g.verbunden = false;
      if (g.gx) continue;
      g.zeigeVerbindung('fehler', 'getrennt'); g.log(`${l.p.com} ausgesteckt`);
      if (!g.lauf) g.setzeStatus(`${l.p.com} ausgesteckt oder ohne Strom – verbindet von selbst, sobald er wieder da ist.`, 'fehler');
    }
  }
}

// ------------------------------------------------------------------ Programmliste -> Ablauf
const NICHT_UNTERSTUETZT = /fehlt|Keine|nicht unterstützt|nicht gefunden|Unbekannter/;

/** Zeitmarke «um 06:00» (auch «ab 6:00», «06:00», «um 6.00 Uhr»): die Programme darunter starten erst zu dieser Uhrzeit. */
function deuteZeitmarke(zeile) { return K.zeitmarke(zeile); }

/** Nächster Zeitpunkt (ms) mit dieser Uhrzeit nach «ab». */
function naechsteUhrzeit(hhmm, ab) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(ab); d.setHours(h, m, 0, 0);
  if (d.getTime() <= ab) d.setDate(d.getDate() + 1);
  return d.getTime();
}
const fmtUhr = (ms) => new Date(ms).toLocaleString('de-CH', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** Programmliste einer Karte vorbereiten: Programme deuten, Presets zuordnen, gemeinsamen Ablauf bauen. */
function bereiteListeVor(text, standardPreset) {
  const items = [];
  String(text || '').split('\n').forEach((zeile, zeilenNr) => {
    const um = deuteZeitmarke(zeile);
    if (um) { items.push({ zeile: zeile.trim(), zeilenNr, r: { art: 'zeit', um }, fehler: '' }); return; }
    const r = K.deuteListenZeile(zeile, daten.finder);
    if (r) items.push({ zeile: zeile.trim(), zeilenNr, r, fehler: r.art === 'fehler' ? r.text : '' });
  });
  // Preset je Programm: Finder-Kachel; Pause/Schumann übernehmen das Preset davor (sonst danach); eigene Zeilen das Karten-Preset
  const std = standardPreset || STD_PRESET;
  const eigenes = (it) => it.r.art === 'finder' && it.r.programm.art === 'pr' ? it.r.programm.preset : it.r.art === 'zeile' ? std : null;
  let letztes = null;
  for (const it of items) { if (it.fehler) continue; it.preset = eigenes(it) || letztes; if (eigenes(it)) letztes = it.preset; }
  for (let i = items.length - 1, naechstes = null; i >= 0; i--) { const it = items[i]; if (it.fehler) continue; if (!it.preset) it.preset = naechstes; if (eigenes(it)) naechstes = it.preset; }
  for (const it of items) if (!it.fehler && !it.preset) it.preset = std;

  const einst = [], einstIndex = new Map(), schritte = [], warnungen = [];
  items.forEach((it, pi) => {
    if (it.r.art === 'zeit') {                                   // Zeitmarke: wartender Schritt ohne feste Dauer
      it.code = '⏰'; it.name = `Start um ${it.r.um}`; it.sek = 0; it.warnungen = [];
      it.start = schritte.length;
      schritte.push({ sek: 0, pause: true, marke: true, um: it.r.um, ei: null, pi });
      it.ende = schritte.length;
      return;
    }
    const p = it.r.art === 'finder' ? it.r.programm : null;
    it.code = p ? p.code : it.r.art === 'zeile' ? 'Zeile' : '?';
    it.name = p ? p.name.replace(/^(pa|sm)\d{2}\s+/i, '') : it.r.art === 'zeile' ? it.r.zeile : it.zeile;
    if (it.fehler) return;
    if (!daten.geladen) { it.fehler = 'Spooky2-Ordner noch nicht gewählt'; return; }
    const roh = daten.katalog.get(it.preset.toLowerCase());
    if (!roh) { it.fehler = `Preset «${it.preset}» nicht gefunden`; return; }
    if (!einstIndex.has(it.preset)) {
      const { preset, fehlt } = K.loeseBasis(roh, daten.katalog);
      const e = K.einstellungen(preset);
      const w = [...e.warnungen];
      if (fehlt) w.unshift(`Basis-Preset fehlt: ${fehlt}`);
      for (const welle of [e.out1.welle, e.out2.welle]) if (welle && !K.findeWelle(daten.wellen, welle.datei)) w.push(`Wellenform «${welle.datei}» fehlt im Ordner Waveforms`);
      einstIndex.set(it.preset, einst.length);
      einst.push({ key: it.preset, e, roh: preset, warnungen: w });
    }
    const ei = einstIndex.get(it.preset), ein = einst[ei];
    it.wobble = p && p.wobbleProzent ? K.wobbleAus(p.wobbleProzent, ein.roh) : ein.e.wobble;
    const plan = K.erstellePlan(ein.e, [{ name: it.code, eintraege: K.leseFrequenzzeile(p ? p.zeile : it.r.zeile, p ? p.dwell : K.STANDARD_DWELL) }], { wobble: it.wobble });
    it.sek = plan.gesamtSek;
    it.warnungen = [...new Set([...ein.warnungen, ...plan.warnungen])];
    if (it.warnungen.some(x => NICHT_UNTERSTUETZT.test(x))) it.fehler = it.warnungen.filter(x => NICHT_UNTERSTUETZT.test(x)).join(' · ');
    it.start = schritte.length;
    for (const s of plan.schritte) schritte.push({ ...s, ei, pi });
    it.ende = schritte.length;
  });
  for (const it of items) if (it.fehler) warnungen.push(`${it.code !== '?' ? it.code : it.zeile.slice(0, 30)}: ${it.fehler}`);
  // Leere Liste ist kein Fehler (keine rote Meldung), Start bleibt aber gesperrt – die Zusammenfassung sagt «Liste leer»
  if (items.length && !schritte.some(s => !s.pause) && !warnungen.length) warnungen.push('Keine abspielbaren Frequenzen');
  else if (schritte.length && schritte[schritte.length - 1].marke) warnungen.push('Nach der letzten Zeitmarke steht kein Programm');
  const blockiert = warnungen.length > 0 || !items.length;
  return { items, einst, plan: { schritte, gesamtSek: schritte.reduce((a, s) => a + s.sek, 0) }, warnungen, blockiert };
}

// ------------------------------------------------------------------ Generator
const generatoren = [];
// Einstellungen gehören zur Generator-Nummer (= Kontrollblatt), nicht zum COM-Anschluss: nach einem Neustart kann Windows
// die Anschlüsse anders verteilen. Dann mit «Testen» prüfen und die Nummer korrigieren – Programmliste und Kunde wandern mit.
function ladeSpeicher() {
  const s = lade(SPEICHER, null);
  if (s && s.gen) return s;
  const neu = { zuordnung: [], gen: {} };
  lade('gs-generatoren-v1', []).forEach((g, i) => { const nr = String(g.nr ?? i + 1); neu.zuordnung[i] = nr; neu.gen[nr] = g; });   // aus 0.1–0.3
  return neu;
}
let speicher = ladeSpeicher();
const speichereAlle = () => {
  for (const g of generatoren) speicher.gen[g.einst.nr] = g.daten();
  // Zuordnung Anschluss -> Nummer: nur die Plätze der vorhandenen Generatoren überschreiben. Beim Start kommen die Anschlüsse
  // einzeln dazu – vorher wurde hier nach dem ersten alles Weitere abgeschnitten und die Nummern verrutschten bei jedem Neuladen.
  if (modus === 'chrome') {
    const z = Array.isArray(speicher.zuordnung) ? [...speicher.zuordnung] : [];
    generatoren.forEach((g, i) => { z[i] = g.einst.nr; });
    speicher.zuordnung = z;
  } else {
    // Brücke: Nummer pro Steckplatz. Jede Nummer nur einmal – ein nicht eingesteckter Steckplatz gibt sie an den ab, der sie jetzt hat.
    const orte = speicher.orte || {}, jetzt = generatoren.filter(g => g.leitung.schluessel);
    for (const g of jetzt) for (const [k, v] of Object.entries(orte)) if (v === g.einst.nr && k !== g.leitung.schluessel) delete orte[k];
    for (const g of jetzt) orte[g.leitung.schluessel] = g.einst.nr;
    speicher.orte = orte;
  }
  speichere(SPEICHER, speicher);
};

class Generator {
  constructor(port, index) {
    this.leitung = port instanceof Leitung ? port : new Leitung(port);
    this.index = index;
    const belegt = (n) => generatoren.some(g => g.einst.nr === String(n));
    let nr = speicher.zuordnung[index];
    if (this.leitung.p) {                                                     // Brücke: Nummer gehört zum Steckplatz
      const orte = speicher.orte || {}, gemerkt = orte[this.leitung.schluessel];
      const fremd = (n) => Object.entries(orte).some(([k, v]) => v === String(n) && k !== this.leitung.schluessel && !generatoren.some(g => g.leitung.schluessel === k) && bruecke.leitungen.has(k));
      nr = gemerkt != null ? gemerkt : (this.leitung.p.nr != null && !fremd(this.leitung.p.nr) && !Object.values(orte).includes(String(this.leitung.p.nr)) ? this.leitung.p.nr : null);
      if (nr == null) { let n = 1; while (belegt(n) || Object.values(orte).includes(String(n))) n++; nr = n; }
    }
    if (nr == null || belegt(nr)) { nr = index + 1; while (belegt(nr)) nr++; }
    this.lauf = null;                                                       // laufender Ablauf
    this.ladeEinst(String(nr));
    this.protokoll = [];
    this.neue = [];
    this.verbunden = false;                                                 // Generator hat auf einen Befehl geantwortet
    this.verbindet = null;                                                  // laufende Verbindungsprüfung (Promise)
    this.baueKarte();
  }

  /** Verbindungszustand im Chip neben dem Namen: ✓ verbunden, … prüft, ✗ keine Verbindung. */
  zeigeVerbindung(art, text = '') {
    const c = $('.chip', this.karte);
    c.textContent = `${this.chipTyp} ${art === 'ok' ? '✓' : art === 'pruefe' ? '…' : '✗'}${text ? ' ' + text : ''}`;
    c.className = 'chip ' + art;
    if (this.leitung.p) c.title = `${this.leitung.p.com} · USB-Steckplatz ${this.leitung.p.ort || '?'}\nDie Generator-Nummer gehört zu diesem Steckplatz.`;
  }

  /**
   * Verbindung herstellen und prüfen: Anschluss öffnen, beide Ausgänge aus (harmlos, der Generator muss mit «ok» antworten).
   * Antwortet er nicht: Anschluss schliessen und neu öffnen, dann andere Baudraten versuchen (falls ein Gerätetyp anders spricht).
   * Rückgabe true/false; bei Fehler steht der Grund im Status der Karte.
   */
  /** GeneratorX Pro (CH342)? Dann bleibt der Anschluss für Spooky2 frei. */
  get gx() { return istGX(this.leitung.port); }
  get chipTyp() { if (this.leitung.p) return this.leitung.p.com; const i = this.leitung.port.getInfo(); return this.gx ? 'GX Pro' : i.usbVendorId === 0x1a86 ? 'CH340' : i.usbVendorId === 0x10c4 ? 'CP210x' : 'USB'; }
  /** GX-Karte ohne offenen Anschluss: RADIX öffnet ihn erst bei Start oder Testen und gibt ihn nach dem Stopp wieder frei. */
  zeigeGX(nurChip = false) {
    const c = $('.chip', this.karte);
    c.textContent = this.leitung.p ? `${this.leitung.p.com} · GX Pro` : 'GX Pro'; c.className = 'chip gx';
    c.title = `GeneratorX Pro${this.leitung.p ? ` an ${this.leitung.p.com}, USB-Steckplatz ${this.leitung.p.ort || '?'}` : ''}. RADIX öffnet den Anschluss erst bei Start oder Testen und gibt ihn nach dem Stopp wieder frei. Nach Strom aus/ein muss Spooky2 den GX einmal freischalten (starten und schliessen).`;
    if (!nurChip && !this.lauf && !this.imTest) this.setzeStatus('GeneratorX Pro – bereit. RADIX verbindet beim Start (Anschluss bis dahin frei). Nach Strom aus/ein am GX: einmal Spooky2 starten und schliessen.', 'gx');
  }
  /**
   * GX verbinden: Anschluss mit 115200 öffnen, Ausgänge aus (muss «:ok» geben, sonst ist er gesperrt), Grundstellung wie Spooky2.
   * Rückgabe true/false; Grund in this.gxGrund und im Status.
   */
  async verbindeGX() {
    const L = this.leitung, G = K.GX;
    const fehler = (text, chip) => {
      this.verbunden = false; this.gxGrund = text;
      this.zeigeVerbindung('fehler', chip); this.log(text); if (!this.lauf) this.setzeStatus(text, 'fehler');
      return false;
    };
    L.gx = true; L.frei = 0; L.melde = (t) => this.log(t);
    try { await L.oeffne(G.BAUD); } catch (e) { return fehler(`GX Pro: Anschluss lässt sich nicht öffnen (${e.message}). Spooky2 ganz geschlossen?`, 'belegt'); }
    try { await L.sende(G.ausgaenge(0, 0), 1500); }
    catch (e) {
      try { await L.schliesse(); } catch (x) { /* schon zu */ }
      return /:err/.test(e.message) ? fehler(GX_GESPERRT, 'gesperrt') : fehler(`GX Pro antwortet nicht (${e.message}). Eingeschaltet? USB-Kabel?`, 'keine Antwort');
    }
    await this.sende(G.grundstellung());
    this.verbunden = true; this.gxGrund = '';
    this.zeigeVerbindung('ok', 'GX Pro');
    this.log('GX Pro verbunden (freigeschaltet)');
    return true;
  }
  verbinde(leise = false) {
    if (this.gx) { this.verbunden = false; this.zeigeGX(); return Promise.resolve(false); }
    if (this.verbindet) return this.verbindet;
    this.verbindet = (async () => {
      const L = this.leitung, vorher = this.verbunden;
      this.zeigeVerbindung('pruefe', 'prüft');
      const probe = async (baud, timeout) => {
        await L.oeffne(baud);
        await L.sende(K.Befehl.ausgang(0, false), timeout);
        await L.sende(K.Befehl.ausgang(1, false), timeout);
      };
      let grund = '', belegt = false;
      const versuche = [[L.baud, 1500, false], [L.baud, 1500, true], ...BAUDRATEN.filter(b => b !== L.baud).map(b => [b, 700, true])];
      for (const [baud, timeout, neu] of versuche) {
        try {
          if (neu) { await L.schliesse(); await new Promise(r => setTimeout(r, 300)); }
          try { await L.oeffne(baud); } catch (e) { belegt = true; grund = e.message || String(e); break; }   // Öffnen scheitert: Baudrate egal
          await probe(baud, timeout);
          this.verbunden = true;
          this.zeigeVerbindung('ok', baud === BAUDRATEN[0] ? '' : `${baud} Baud`);
          if (!vorher || baud !== BAUDRATEN[0]) this.log(`Verbunden${baud === BAUDRATEN[0] ? '' : ` mit ${baud} Baud (anders als Spooky2 XM)`}`);
          if (!this.lauf && $('.status', this.karte).classList.contains('fehler')) this.setzeStatus('Verbunden – bereit');
          return true;
        } catch (e) { if (!grund) grund = e.message || String(e); }
      }
      try { await L.schliesse(); await L.oeffne(BAUDRATEN[0]); } catch (e) { /* bleibt zu */ }
      this.verbunden = false;
      this.zeigeVerbindung('fehler', belegt ? 'belegt' : 'keine Antwort');
      const text = belegt
        ? `Keine Verbindung: Anschluss belegt (${grund}). Spooky2 ganz geschlossen? Zweites RADIX-Fenster offen?`
        : `Keine Verbindung: Generator ${grund === 'keine Antwort' ? 'antwortet nicht' : grund} (auch nach Neu-Öffnen und mit anderen Baudraten). Generator eingeschaltet (Netzteil)? USB-Kabel/Hub?`;
      if (!leise || vorher || !$('.status', this.karte).classList.contains('fehler')) { if (!this.lauf) this.setzeStatus(text, 'fehler'); this.log(text); }
      return false;
    })();
    this.verbindet.finally(() => { this.verbindet = null; });
    return this.verbindet;
  }
  /** Einstellungen der Generator-Nummer laden (gespeichert unter dieser Nummer). */
  ladeEinst(nr) {
    const g = speicher.gen[nr] || {};
    // Übernahme aus Version 0.1/0.2: Preset + Frequenzzeile
    this.einst = { nr, liste: g.liste ?? g.zeile ?? '', standardPreset: g.standardPreset ?? g.preset ?? '', durchlaeufe: g.durchlaeufe ?? 1, startUm: g.startUm || '', auto: g.auto ?? true };
    this.uebernommen = g.uebernommen || null;                              // { blatt, datum, anzahl } – bereits übernommene Einträge der heutigen Zeile
    this.geleert = g.geleert || null;                                      // { blatt, datum, anzahl } – beim Leeren: was bis dahin in der Zeile stand, gilt als erledigt
    this.fortsetzen = g.lauf && g.lauf.liste === this.einst.liste ? g.lauf : null;   // gespeicherter Stand nach Neuladen
  }
  /** Felder der Karte mit den Einstellungen füllen. */
  zeigeEinst() {
    const k = this.karte;
    $('.nr', k).value = this.einst.nr;
    $('.liste', k).value = this.einst.liste;
    $('.preset', k).value = this.einst.standardPreset;
    $('.durchlaeufe', k).value = this.einst.durchlaeufe;
    $('.start-um', k).value = this.einst.startUm;
    $('.auto-cb', k).checked = this.einst.auto;
    $('.btn-weiter', k).hidden = !this.fortsetzen;
    this.aktualisiereKunde();
    this.pruefe();
    if (this.fortsetzen) this.setzeStatus(`Unterbrochen bei Schritt ${this.fortsetzen.schritt + 1}, Durchlauf ${this.fortsetzen.durchlauf}`, 'warnung');
    else this.setzeStatus('bereit');
  }
  /** Andere Nummer für diesen Anschluss; hat ein anderer Anschluss diese Nummer, werden die beiden getauscht. */
  wechsleNummer(neu) {
    const alt = this.einst.nr, feld = $('.nr', this.karte);
    neu = String(parseInt(neu, 10) || '');
    if (!neu || neu === alt) { feld.value = alt; return; }
    if (this.lauf) { feld.value = alt; this.setzeStatus('Nummer erst nach dem Stopp ändern', 'fehler'); return; }
    const anderer = generatoren.find(g => g !== this && g.einst.nr === neu);
    if (anderer && anderer.lauf) { feld.value = alt; this.setzeStatus(`Generator ${neu} läuft gerade – dort zuerst stoppen`, 'fehler'); return; }
    const imTest = [this.imTest, anderer && anderer.imTest];
    speichereAlle();                                  // Stand unter den bisherigen Nummern sichern
    this.ladeEinst(neu); this.zeigeEinst();
    this.log(`Nummer ${alt} → ${neu}`);
    if (anderer) { anderer.ladeEinst(alt); anderer.zeigeEinst(); anderer.log(`Nummer ${neu} → ${alt} (getauscht)`); anderer.setzeStatus(`Nummer getauscht: jetzt Generator ${alt} – mit «Testen» prüfen`, 'warnung'); }
    speichereAlle();
    this.setzeStatus(`Jetzt Generator ${neu}${anderer ? ` (getauscht mit ${alt})` : ''} – mit «Testen» prüfen`, 'warnung');
    if (gezeigt === this || gezeigt === anderer) zeige(gezeigt);
    if (imTest[0]) this.teste();                       // im Test: Display zeigt gleich die neue Nummer
    if (imTest[1]) anderer.teste();
  }
  daten() {
    const l = this.lauf;
    return { ...this.einst, uebernommen: this.uebernommen, geleert: this.geleert, lauf: l && l.status !== 'fertig' ? { schritt: l.schritt, tImSchritt: l.tImSchritt, durchlauf: l.durchlauf, status: l.status, startUm: l.startUmMs, liste: l.listeText } : null };
  }
  /** Ganzes Protokoll in die Zwischenablage (zum Einfügen im Chat). */
  async kopiereProtokoll() {
    const knopf = $('.btn-kopieren', this.karte), text = `RADIX ${VERSION} · Generator ${this.einst.nr}\n` + this.protokoll.join('\n');
    try { await navigator.clipboard.writeText(text); knopf.textContent = 'Kopiert ✓'; }
    catch (e) {                                                   // ohne Zwischenablage-Recht: Text markieren, dann Strg+C
      const r = document.createRange(); r.selectNodeContents($('.protokoll pre', this.karte));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); knopf.textContent = 'Markiert – Strg+C';
    }
    setTimeout(() => { knopf.textContent = 'Kopieren'; }, 2500);
  }
  log(text, art = '') {
    this.protokoll.push(`${jetzt()}  ${text}`);
    if (this.protokoll.length > 300) this.protokoll.shift();
    const el = $('.protokoll', this.karte);
    if (el.open) { el.querySelector('pre').textContent = this.protokoll.join('\n'); }
    if (art === 'fehler') this.setzeStatus(text, 'fehler');
  }
  baueKarte() {
    const k = document.getElementById('vorlage-generator').content.firstElementChild.cloneNode(true);
    this.karte = k;
    const info = this.leitung.port.getInfo();
    $('.chip', k).textContent = this.chipTyp;
    const nr = $('.nr', k);
    nr.onchange = () => this.wechsleNummer(nr.value.trim());
    $('.nr-zurueck', k).onclick = () => { const n = parseInt(this.einst.nr, 10) || 1; if (n > 1) this.wechsleNummer(String(n - 1)); };
    $('.nr-weiter', k).onclick = () => { const n = parseInt(this.einst.nr, 10) || 0; if (n < hoechsteNummer()) this.wechsleNummer(String(n + 1)); };
    const li = $('.liste', k);
    let warte = null;
    li.oninput = () => { clearTimeout(warte); warte = setTimeout(() => this.setzeListe(li.value), 350); };
    li.onchange = () => { clearTimeout(warte); this.setzeListe(li.value); };
    const pr = $('.preset', k);
    pr.onchange = () => { this.einst.standardPreset = pr.value.trim(); speichereAlle(); this.pruefe(); };
    const du = $('.durchlaeufe', k);
    du.onchange = () => { this.einst.durchlaeufe = Math.max(0, parseInt(du.value, 10) || 0); du.value = this.einst.durchlaeufe; speichereAlle(); this.pruefe(); };
    const st = $('.start-um', k);
    st.onchange = () => { this.einst.startUm = st.value; speichereAlle(); };
    $('.btn-start', k).onclick = () => this.starte();
    $('.btn-stop', k).onclick = () => { if (this.lauf) this.stoppe('gestoppt'); else if (this.imTest) this.beendeTest(); };
    $('.btn-testen', k).onclick = () => this.imTest ? this.beendeTest() : this.teste();
    $('.btn-weiter', k).onclick = () => this.starte(this.fortsetzen);
    $('.btn-naechste-f', k).onclick = () => this.springe('frequenz');
    $('.btn-naechstes-p', k).onclick = () => this.springe('programm');
    $('.btn-heute', k).onclick = () => this.uebernehmeHeute();
    $('.btn-leeren', k).onclick = () => this.leere();
    $('.btn-morgen', k).onclick = () => this.uebernehmeMorgen();
    $('.btn-anhaengen', k).onclick = () => this.haengeNeueAn();
    const au = $('.auto-cb', k);
    au.onchange = () => { this.einst.auto = au.checked; this.uebernommen = null; speichereAlle(); this.aktualisiereKunde(); };
    $('.vorschau', k).onclick = (ev) => { const b = ev.target.closest('button[data-z]'); if (b) this.setzeVariante(+b.dataset.z, b.dataset.v); };
    $('.protokoll', k).ontoggle = () => { $('.protokoll pre', k).textContent = this.protokoll.join('\n'); };
    $('.btn-kopieren', k).onclick = () => this.kopiereProtokoll();
    $('.btn-gx-senden', k).onclick = () => this.gxEigene();
    $('.gx-befehl', k).onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); this.gxEigene(); } };
    $('#generatoren').appendChild(k);
    this.zeigeEinst();
  }
  /** Laufendes Preset gross im Kartenkopf (rot = Killing, grün = übrige); leer = Generator steht. */
  zeigePreset(name, wechsel = false) {
    const el = $('.preset-aktiv', this.karte);
    el.textContent = name ? (wechsel ? '→ ' : '') + name : '';
    el.className = 'preset-aktiv' + (name ? (/killing/i.test(name) ? ' k' : ' h') : '') + (wechsel ? ' wechsel' : '');
    el.title = name ? (wechsel ? 'Generator wird umgestellt auf ' : 'Laufendes Preset: ') + name : '';
  }
  setzeStatus(text, art = '') { const s = $('.status', this.karte); s.textContent = text; s.className = 'status ' + art; }
  setzeListe(text) {
    if (text === this.einst.liste) return;
    if (this.lauf) {                                   // während dem Lauf: nur ab dem nächsten Programm änderbar
      const f = this.uebernimmImLauf(text);
      if (f) { $('.liste', this.karte).value = this.einst.liste; this.melde(f, 'fehler'); this.pruefe(); return; }
      this.einst.liste = text;
      speichereAlle(); this.pruefe(); this.aktualisiereKunde();
      return;
    }
    this.einst.liste = text;
    if (this.fortsetzen) { this.fortsetzen = null; $('.btn-weiter', this.karte).hidden = true; this.setzeStatus('bereit'); }
    speichereAlle(); this.pruefe(); this.aktualisiereKunde();
  }

  // ---------------------------------------------------------------- Kontrollblatt
  blatt() { const nr = parseInt(this.einst.nr, 10); return daten.kontrolle && Number.isFinite(nr) ? daten.kontrolle.blaetter[String(nr)] || null : null; }
  /** Ganze heutige Zeile des Kontrollblatts (für die Kopplung). */
  heuteAlle() { const b = this.blatt(); return b ? K.kontrolleHeute(b) : { eintraege: [], hinweis: '' }; }
  /** Heutige Zeile ohne das, was beim letzten «Leeren» schon drin stand (erledigt). */
  heute() {
    const h = this.heuteAlle(), g = this.geleert;
    if (g && g.blatt === parseInt(this.einst.nr, 10) && g.datum === K.datumText(new Date())) h.eintraege = h.eintraege.slice(Math.min(g.anzahl, h.eintraege.length));
    return h;
  }

  aktualisiereKunde() {
    const b = this.blatt();
    $('.kunde', this.karte).textContent = b && b.name ? b.name.trim() : '';
    $('.btn-heute', this.karte).disabled = !b || !!this.lauf;
    $('.btn-morgen', this.karte).disabled = !b;
    // Programme des Kunden zum Antippen
    const menue = $('.menue', this.karte), liste = $('.menue-liste', this.karte);
    const eintraege = b ? K.kontrolleEintraege(b.programme).filter(x => x.code !== 'um') : [];
    menue.hidden = !eintraege.length;
    let html = '', sparte = null;
    eintraege.forEach((x, i) => {
      if (x.abschnitt !== sparte) { sparte = x.abschnitt; if (sparte) html += `<div class="sparte">${esc(sparte)}</div>`; }
      const varianten = x.code.startsWith('pr') && !x.variante && daten.finder && !daten.finder.programme.has(x.code) ? ['NF', 'HF'] : [x.variante || ''];
      const knoepfe = varianten.map(v => `<button class="ghost klein" data-i="${i}" data-v="${v}" title="An die Programmliste anhängen">+${v ? ' ' + v : ''}</button>`).join('');
      html += `<div class="eintrag"><code>${esc(x.code)}${x.variante ? ' ' + x.variante : ''}</code><span title="${esc(x.name)}">${esc(x.name)}</span><small>${esc(x.dauer)}</small>${knoepfe}</div>`;
    });
    liste.innerHTML = html;
    liste.onclick = (ev) => {
      const btn = ev.target.closest('button'); if (!btn) return;
      const x = eintraege[+btn.dataset.i], v = btn.dataset.v;
      const zeile = `${x.code}${v ? ' ' + v : ''}  ${x.name}`;
      this.fuegeZeilenAn([zeile]);
    };
    if (this.einst.auto) this.koppeln(); else this.pruefeNeue();
  }

  /**
   * Kopplung: jeder neue Eintrag in der heutigen Zeile des Kontrollblatts (Doppelklick dort) geht auf diesen Generator
   * und wird hinten an die Programmliste angehängt. Gestartet wird von Hand (Start oder Startzeit); läuft er schon,
   * kommt das Neue nach dem laufenden Programm dran.
   */
  koppeln() {
    $('.neu', this.karte).hidden = true;
    const b = this.blatt(), nr = parseInt(this.einst.nr, 10);
    if (!b || !daten.finder || !daten.geladen) return;            // erst wenn Finder und Spooky2-Ordner da sind
    const { eintraege, hinweis } = this.heuteAlle();
    if (hinweis) return;
    const heute = K.datumText(new Date());
    let u = this.uebernommen;
    if (!u || u.blatt !== nr) { this.uebernommen = { blatt: nr, datum: heute, anzahl: eintraege.length }; speichereAlle(); return; }   // erster Blick: Bestehendes nicht starten
    if (u.datum !== heute) u = { blatt: nr, datum: heute, anzahl: 0 };   // neuer Tag: alles von heute ist neu
    if (eintraege.length < u.anzahl) u.anzahl = eintraege.length;       // Zeile im Kontrollblatt gekürzt
    const neu = eintraege.slice(u.anzahl);
    u.anzahl = eintraege.length;
    this.uebernommen = u;
    speichereAlle();
    if (!neu.length) return;
    const zeilen = neu.map(x => K.kontrolleZeile(x, b, daten.finder));
    this.log(`Vom Kontrollblatt ${nr}: ${zeilen.map(z => z.split(/\s{2,}|\t/)[0]).join(', ')}`);
    this.fuegeZeilenAn(zeilen);
    if (!this.lauf) this.melde(`Vom Kontrollblatt übernommen: ${zeilen.map(z => z.split(/\s{2,}|\t/)[0]).join(', ')} – mit Start (oder Startzeit) starten`, 'ok');
    springeZu(nr);                                                  // 0.6.7: Doppelklick in der KA zeigt gleich diesen Generator
  }

  /** NF oder HF für eine Zeile der Programmliste festlegen (Knopf in der Vorschau). */
  setzeVariante(zeilenNr, v) {
    const zeilen = this.einst.liste.split('\n');
    const z = zeilen[zeilenNr];
    if (!z) return;
    // Ganze Zeile neu schreiben (Code + Name der Finder-Kachel): sonst gilt weiter die Angabe im Namen («… - NF (Hz)»)
    const m = z.match(/^\s*pr\s?(\d{1,4})\b/i);
    const code = m ? `pr${m[1].padStart(4, '0')} ${v}` : '';
    const p = code && daten.finder ? daten.finder.programme.get(code) : null;
    zeilen[zeilenNr] = p ? `${code}  ${p.name.replace(/^(pa|sm)\d{2}\s+/i, '')}` : z.replace(/^(\s*pr\s?\d{1,4})\b/i, `$1 ${v}`);
    const text = zeilen.join('\n');
    $('.liste', this.karte).value = text;
    this.setzeListe(text);
  }

  /** Einträge der heutigen Kontrollblatt-Zeile, die noch nicht in der Programmliste stehen. */
  pruefeNeue() {
    const box = $('.neu', this.karte);
    const { eintraege } = this.heute();
    const schluessel = (zeile) => { const r = K.deuteListenZeile(zeile, daten.finder); return r && r.art === 'finder' ? r.code : K.sauber(zeile).split(/\s+/)[0].toLowerCase(); };
    const vorhanden = new Map();
    for (const z of this.einst.liste.split('\n')) { if (!z.trim()) continue; const s = schluessel(z); vorhanden.set(s, (vorhanden.get(s) || 0) + 1); }
    this.neue = [];
    const bl = this.blatt();
    for (const x of eintraege) {
      x.zeile = K.kontrolleZeile(x, bl, daten.finder);
      const s = schluessel(x.zeile);
      if (vorhanden.get(s)) vorhanden.set(s, vorhanden.get(s) - 1); else this.neue.push(x);
    }
    box.hidden = !this.neue.length;
    $('.neu-text', box).textContent = `Kontrollblatt heute: ${this.neue.length} neu – ${this.neue.map(x => x.code + (x.variante ? ' ' + x.variante : '')).join(', ')}`;
  }

  uebernehmeHeute() {
    const { eintraege, hinweis } = this.heute();
    if (!eintraege.length) { this.setzeStatus(hinweis ? `Kontrollblatt: ${hinweis}` : this.geleert && this.heuteAlle().eintraege.length ? 'Kontrollblatt: seit dem Leeren nichts Neues eingetragen' : 'Kontrollblatt: heute noch kein Programm eingetragen', 'warnung'); return; }
    const b = this.blatt();
    const text = eintraege.map(x => K.kontrolleZeile(x, b, daten.finder)).join('\n');
    $('.liste', this.karte).value = text;
    this.setzeListe(text);
    this.log(`Aus Kontrollblatt ${parseInt(this.einst.nr, 10)} übernommen: ${eintraege.length} Programme`);
  }

  /**
   * Zeile von morgen aus dem Kontrollblatt anhängen, mit Zeitmarke davor (auch während dem Lauf). Die Uhrzeit kommt aus dem
   * Feld «Start um» (zuerst eintragen); danach wird das Feld geleert, damit «Start» das Programm davor sofort startet.
   */
  uebernehmeMorgen() {
    const b = this.blatt();
    if (!b) return;
    const morgen = new Date(); morgen.setDate(morgen.getDate() + 1);
    const tag = K.datumText(morgen);
    const um = this.einst.startUm;
    if (!um) { this.melde('Zuerst unten bei «Start um» die Startzeit für morgen eintragen, dann «Morgen aus Kontrollblatt»', 'fehler'); $('.start-um', this.karte).focus(); return; }
    const { eintraege, hinweis } = K.kontrolleHeute(b, morgen);
    if (!eintraege.length) { this.melde(hinweis ? `Kontrollblatt morgen: ${hinweis}` : `Kontrollblatt: für morgen (${tag}) noch nichts eingetragen`, 'fehler'); return; }
    const zeilen = [`um ${um}`, ...eintraege.map(x => K.kontrolleZeile(x, b, daten.finder))];
    this.fuegeZeilenAn(zeilen);
    this.einst.startUm = ''; $('.start-um', this.karte).value = ''; speichereAlle();   // Uhrzeit steckt jetzt in der Liste
    this.log(`Morgen ${tag} aus Kontrollblatt ${parseInt(this.einst.nr, 10)}: ${eintraege.length} Programme ab ${um}`);
    this.melde(`Morgen (${tag}): ${eintraege.length} Programm${eintraege.length === 1 ? '' : 'e'} ab ${um} angehängt${this.lauf ? '' : ' – jetzt Start drücken'}`, 'ok');
  }

  /**
   * Liste leeren; läuft der Generator, wird er nach Rückfrage gestoppt. Alles, was jetzt in der heutigen Kontrollblatt-Zeile
   * steht, gilt als erledigt: «Heute aus Kontrollblatt» bringt danach nur noch, was neu dazukommt.
   */
  async leere() {
    if (this.lauf) {
      if (!confirm(`Generator ${this.einst.nr} stoppen und die Programmliste leeren?`)) return;
      await this.stoppe('Gestoppt, Liste geleert');
    }
    const nr = parseInt(this.einst.nr, 10), heute = K.datumText(new Date()), anzahl = this.heuteAlle().eintraege.length;
    this.geleert = { blatt: nr, datum: heute, anzahl };
    this.uebernommen = { blatt: nr, datum: heute, anzahl };
    this.meldung = null;
    $('.liste', this.karte).value = '';
    this.setzeListe('');
    this.log(`Liste geleert${anzahl ? ` – ${anzahl} Einträge von heute im Kontrollblatt gelten als erledigt` : ''}`);
    speichereAlle();
  }

  haengeNeueAn() { if (this.neue.length) this.fuegeZeilenAn(this.neue.map(x => x.zeile)); }

  /** Zeilen anhängen; während dem Lauf wird der Ablauf hinten verlängert, ohne den laufenden Teil zu verändern. */
  fuegeZeilenAn(zeilen) {
    const basis = this.einst.liste.replace(/\s+$/, '');
    const text = (basis ? basis + '\n' : '') + zeilen.join('\n');
    if (this.lauf) {
      const f = this.uebernimmImLauf(text);
      if (f) { this.melde('Nicht angehängt: ' + f, 'fehler'); return; }
      const codes = zeilen.map(z => z.split(/\s{2,}|\t/)[0]).join(', ');
      this.log(`Angehängt: ${codes}`);
      this.melde(`Angehängt: ${codes}`, 'ok');
    }
    $('.liste', this.karte).value = text;
    this.einst.liste = text;
    speichereAlle(); this.pruefe(); this.pruefeNeue();
  }

  /**
   * Neue Programmliste in den laufenden Ablauf übernehmen. Das laufende und die schon gelaufenen Programme müssen gleich
   * bleiben; alles danach darf neu sein, sich ändern oder wegfallen. Programme mit offenem Punkt (z. B. NF/HF fehlt) werden
   * übersprungen, bis er geklärt ist. Rückgabe: Fehlertext oder null.
   */
  uebernimmImLauf(text) {
    const l = this.lauf;
    const v = bereiteListeVor(text, this.einst.standardPreset);
    const s = l.plan.schritte[l.schritt], pi = s ? s.pi : -1;
    for (let i = 0; i <= pi; i++) {
      const alt = l.items[i], neu = v.items[i];
      if (alt.fehler) continue;                                    // war übersprungen: darf nachträglich geklärt werden
      if (!neu || neu.zeile !== alt.zeile) return i === pi ? `${alt.code} läuft gerade – das laufende Programm lässt sich nicht ändern` : `${alt.code} ist schon gelaufen – nur Programme nach dem laufenden ändern`;
    }
    if (s) {
      const alt = l.items[pi], neu = v.items[pi];
      if (neu.fehler || neu.ende - neu.start !== alt.ende - alt.start) return `${alt.code} läuft gerade – das laufende Programm lässt sich nicht ändern`;
      l.schritt = neu.start + (l.schritt - alt.start);
    }
    const aktiv = l.aktivEi != null && l.einst[l.aktivEi] ? l.einst[l.aktivEi].key : null;
    if (s && s.marke && v.plan.schritte[l.schritt]) v.plan.schritte[l.schritt].zeitMs = s.zeitMs;
    l.plan = v.plan; l.items = v.items; l.einst = v.einst; l.listeText = text;
    l.warnungen = v.warnungen.filter(w => !/^Keine (Programme|abspielbaren)/.test(w));
    if (aktiv) l.aktivEi = v.einst.findIndex(x => x.key === aktiv);
    this.rechneMarken();
    speichereAlle();
    return null;
  }

  /** Uhrzeit jeder Zeitmarke ab der aktuellen Stelle festlegen: jede die nächste nach der vorherigen (06:00 nach 22:00 = morgen). */
  rechneMarken(ab = Date.now()) {
    const l = this.lauf, s = l.plan.schritte;
    let t = ab;
    for (let k = l.schritt; k < s.length; k++) {
      if (!s[k].marke) continue;
      s[k].zeitMs = k === l.schritt && s[k].zeitMs ? s[k].zeitMs : naechsteUhrzeit(s[k].um, t);
      t = s[k].zeitMs;
    }
  }

  /** Meldung über der Vorschau, die der laufende Fortschritt nicht überschreibt (verschwindet nach 20 s). */
  melde(text, art = '') {
    this.meldung = { text, art, bis: Date.now() + 20000 };
    clearTimeout(this.meldeUhr);
    this.meldeUhr = setTimeout(() => { this.meldung = null; this.pruefe(); }, 20000);
    this.pruefe();
  }

  // ---------------------------------------------------------------- Prüfen und Vorschau
  pruefe() {
    const w = $('.warnungen', this.karte), z = $('.zusammenfassung', this.karte), vs = $('.vorschau', this.karte);
    let anzeigen = this.lauf ? { items: this.lauf.items, plan: this.lauf.plan, warnungen: this.lauf.warnungen || [], blockiert: false, einst: this.lauf.einst } : bereiteListeVor(this.einst.liste, this.einst.standardPreset);
    if (!this.lauf && this.gx) {                                     // was der GX Pro noch nicht kann, sperrt den Start
      const gw = [...new Set(anzeigen.einst.flatMap(x => K.gxWarnungen(x.e).map(t => `${x.key}: ${t}`)))];
      if (gw.length) anzeigen = { ...anzeigen, warnungen: [...anzeigen.warnungen, ...gw], blockiert: true };
    }
    const aktPi = this.lauf && this.lauf.plan.schritte[this.lauf.schritt] ? this.lauf.plan.schritte[this.lauf.schritt].pi : -1;
    vs.innerHTML = anzeigen.items.map((it, i) => {
      if (it.r.art === 'zeit') {
        const st = this.lauf && this.lauf.plan.schritte[it.start], wann = st && st.zeitMs ? ` (${fmtUhr(st.zeitMs)})` : '';
        return `<div class="p marke" data-pi="${i}"><code>⏰</code><span class="name">Start um ${it.r.um}${wann}</span><span class="zeit"></span>` +
          `<span class="pinfo">Was darunter steht, startet erst um ${it.r.um}. Läuft dann noch ein Programm davor, wird es beendet.</span></div>`;
      }
      const nv = /^(pr\d{4}) (NF|HF)$/.exec(it.code || ''), andere = nv && (nv[2] === 'NF' ? 'HF' : 'NF');
      const wechsel = nv && !it.fehler && i > aktPi && daten.finder && daten.finder.programme.has(`${nv[1]} ${andere}`)
        ? ` <button class="ghost klein wechsel" data-z="${it.zeilenNr}" data-v="${andere}" title="Dieses Programm als ${andere} spielen">→ ${andere}</button>` : '';
      const preset = it.preset ? `<b class="${/killing/i.test(it.preset) ? 'k' : 'h'}">${esc(it.preset)}</b>` : '';
      const wob = it.wobble ? ` · <span class="w" title="Frequency Wobble, Dreieck ${it.wobble.stufen} Stufen, ${it.wobble.hz} Stufen/s – am Gerät noch nicht gegen Spooky2 geprüft">Wobble ${String(it.wobble.prozent).replace('.', ',')} % (vorläufig)</span>` : '';
      const wahl = /NF oder HF/.test(it.fehler || '') ? ` <button class="ghost klein" data-z="${it.zeilenNr}" data-v="NF">NF</button> <button class="ghost klein" data-z="${it.zeilenNr}" data-v="HF">HF</button>` : '';
      const hinweis = it.fehler ? esc(it.fehler) + wahl : (it.warnungen || []).filter(x => !NICHT_UNTERSTUETZT.test(x)).map(esc).join(' · ');
      return `<div class="p${it.fehler ? ' fehler' : ''}" data-pi="${i}"><code>${esc(it.code)}</code><span class="name" title="${esc(it.zeile)}">${esc(it.name)}</span><span class="zeit">${it.sek != null ? fmtZeit(it.sek) : ''}</span>` +
        `<span class="pinfo">${preset}${wob}${hinweis ? (preset ? ' · ' : '') + hinweis : ''}${wechsel}</span></div>`;
    }).join('');
    const m = this.meldung && this.meldung.bis > Date.now() ? this.meldung : null;
    w.textContent = [m ? m.text : '', ...anzeigen.warnungen.map(x => this.lauf ? 'Übersprungen, bis geklärt – ' + x : x)].filter(Boolean).join(' · ');
    w.className = 'warnungen' + (m && m.art === 'ok' && !anzeigen.warnungen.length ? ' ok' : '');
    const d = this.einst.durchlaeufe, n = anzeigen.items.filter(it => it.r.art !== 'zeit').length, nm = anzeigen.items.length - n;
    z.textContent = !daten.geladen ? 'Zuerst den Spooky2-Ordner wählen.' : n ? `${n} Programm${n === 1 ? '' : 'e'} · ${anzeigen.einst.length} Preset${anzeigen.einst.length === 1 ? '' : 's'} · ${fmtZeit(anzeigen.plan.gesamtSek)} pro Durchlauf` + (d ? ` · ${d} × = ${fmtZeit(anzeigen.plan.gesamtSek * d)}` : ' · endlos') + (nm ? ` · ${nm} Zeitmarke${nm === 1 ? '' : 'n'} (Wartezeit nicht eingerechnet)` : '') : 'Liste leer';
    if (this.lauf) { this.markiereAktiv(); return this.lauf; }
    this.vorbereitet = anzeigen.blockiert ? null : anzeigen;
    $('.btn-start', this.karte).disabled = !this.vorbereitet;
    $('.btn-weiter', this.karte).disabled = !this.vorbereitet;
    return this.vorbereitet;
  }
  markiereAktiv() {
    const l = this.lauf, pi = l && l.plan.schritte[l.schritt] ? l.plan.schritte[l.schritt].pi : -1;
    for (const row of this.karte.querySelectorAll('.vorschau .p')) row.classList.toggle('aktiv', +row.dataset.pi === pi);
  }

  sperre(laufend) {
    for (const s of ['.nr', '.nr-zurueck', '.nr-weiter', '.preset', '.durchlaeufe', '.btn-testen', '.btn-heute']) $(s, this.karte).disabled = laufend;
    $('.btn-start', this.karte).disabled = laufend || !this.vorbereitet;
    $('.btn-stop', this.karte).disabled = !laufend && !this.imTest;
    $('.btn-naechste-f', this.karte).disabled = !laufend;
    $('.btn-naechstes-p', this.karte).disabled = !laufend;
    this.karte.classList.toggle('laeuft', laufend);
    if (!laufend) $('.btn-heute', this.karte).disabled = !this.blatt();
  }

  /** Ausgänge aus (XM: w61/w62, GX: je Kanal aus und Amplitude 0). */
  ausBefehle() { return this.gx ? K.GX.aus() : [['Ausgang 1 aus', K.Befehl.ausgang(0, false)], ['Ausgang 2 aus', K.Befehl.ausgang(1, false)]]; }

  /** Befehle senden. Gehören sie zu einem Lauf, der inzwischen gestoppt wurde, wird der Rest nicht mehr gesendet (0.6.6):
   *  sonst kamen z. B. «Ausgang ein» nach den Stopp-Befehlen an. */
  async sende(liste) {
    const lauf = this.lauf;
    for (const [text, befehl, timeout] of liste) {
      if (lauf && this.lauf !== lauf) throw new Error(ABGEBROCHEN);
      try { await this.leitung.sende(befehl, timeout); if (!this.leise) this.log(`${text} ✓`); }
      catch (e) { this.log(`${text}: ${e.message}`, 'fehler'); throw e; }
    }
  }

  /** Zuordnung prüfen: Display des angeschlossenen Generators zeigt die Kartennummer als Frequenz (Ausgänge aus, kein Signal). */
  async teste() {
    if (this.lauf) return;
    if (this.gx) return this.testeGX();
    try {
      if (!(await this.verbinde())) return;
      const nr = parseInt(this.einst.nr, 10);
      const z = K.neuerZustand();
      await this.sende([['Ausgang 1 aus', K.Befehl.ausgang(0, false)], ['Ausgang 2 aus', K.Befehl.ausgang(1, false)], ...K.frequenzBefehle(nr, nr, z)]);
      this.setzeStatus(`Test: Display zeigt ${nr} Hz. Steht am Generator die Nummer ${nr}? Sonst mit ◀ ▶ die Nummer des Generators einstellen. Ende mit «Test beenden» oder Stopp.`, 'warnung');
      this.log(`Test: ${nr} Hz auf dem Display`);
      this.setzeTest(true);
    } catch (e) { this.verbunden = false; this.zeigeVerbindung('fehler', 'keine Antwort'); this.setzeStatus('Test fehlgeschlagen: ' + e.message + ' – nochmals «Testen» (verbindet neu)', 'fehler'); }
  }

  /** Test-Zustand: Knopf heisst «Test beenden», Stopp ist aktiv. */
  setzeTest(an) {
    this.imTest = an;
    $('.btn-testen', this.karte).textContent = an ? 'Test beenden' : 'Testen';
    $('.btn-testen', this.karte).classList.toggle('aktiv', an);
    if (!this.lauf) $('.btn-stop', this.karte).disabled = !an;
  }
  /** Test beenden: Ausgänge sicher aus, Karte wieder bereit. (Die Zahl bleibt auf dem Display, bis ein Programm startet.) */
  async beendeTest() {
    if (this.gx) return this.beendeTestGX();
    this.setzeTest(false);
    try { await this.sende([['Ausgang 1 aus', K.Befehl.ausgang(0, false)], ['Ausgang 2 aus', K.Befehl.ausgang(1, false)]]); } catch (e) { /* Gerät weg */ }
    this.setzeStatus('Test beendet – bereit');
    this.log('Test beendet');
  }

  // ---------------------------------------------------------------- GeneratorX Pro: Test (0.6.4, Takt 0.6.6)
  /** Eine Zeile an den GX schicken, Befehl und Antwort ins Protokoll. Rückgabe: Antwort (Text, evtl. leer). */
  async gxSende(text, warte = 700) {
    const zeile = /\r?\n$/.test(text) ? text : text + '\r\n';
    const a = await this.leitung.roh(zeile, warte);
    this.log(`GX → ${zeigeRoh(zeile, 120)}   ← ${a ? zeigeRoh(a, 300) : '(keine Antwort)'}`);
    return a;
  }
  /** GX-Test: Anschluss mit 115200 öffnen, Firmware fragen, Ausgänge aus, Kartennummer als Frequenz auf beide Ausgänge. */
  async testeGX() {
    if (this.lauf) return;
    const G = K.GX, nr = parseInt(this.einst.nr, 10);
    this.setzeTest(true);
    $('.gx-test', this.karte).hidden = false;
    $('.protokoll', this.karte).open = true;
    $('.protokoll pre', this.karte).textContent = this.protokoll.join('\n');
    const c = $('.chip', this.karte);
    try {
      await this.leitung.oeffne(G.BAUD);
      this.log(`GX-Test: Anschluss offen mit ${G.BAUD} Baud`);
      c.className = 'chip gx offen'; c.textContent = `${this.leitung.p ? this.leitung.p.com + ' · ' : ''}GX Pro · Test`;
      const ver = await this.gxSende(G.version);
      const aus = await this.gxSende(G.ausgaenge(0, 0));
      if (/:err/.test(aus)) { this.zeigeVerbindung('fehler', 'gesperrt'); this.setzeStatus(`GX-Test: ${GX_GESPERRT}`, 'fehler'); return; }
      if (!/:ok/.test(aus)) { this.setzeStatus(`GX-Test: ${ver ? 'Der GX antwortet, aber nicht mit «:ok»' : 'Keine Antwort vom GX'} (siehe Protokoll). Eingeschaltet? USB-Kabel?`, 'fehler'); return; }
      for (const [, z] of G.grundstellung()) await this.gxSende(z, 250);
      await this.gxSende(G.frequenz(0, nr));
      await this.gxSende(G.frequenz(1, nr));
      this.setzeStatus(`GX-Test: Display zeigt ${nr} Hz auf Out1 und Out2 (Ausgänge aus). Ist das der GX mit der Nummer ${nr}? Sonst mit ◀ ▶ umstellen. Ende mit «Test beenden».`, 'warnung');
    } catch (e) {
      this.log(`GX-Test: ${e.message}`);
      this.setzeStatus(`GX-Test: Anschluss lässt sich nicht öffnen (${e.message}). Spooky2 ganz geschlossen?`, 'fehler');
    }
  }
  /** GX-Test beenden: Ausgänge aus, Anschluss wieder frei für Spooky2. */
  async beendeTestGX() {
    this.setzeTest(false);
    $('.gx-test', this.karte).hidden = true;
    try { if (this.leitung.offen) for (const [, z] of K.GX.aus()) await this.gxSende(z, 250); } catch (e) { /* Gerät weg */ }
    try { await this.leitung.schliesse(); } catch (e) {}
    this.verbunden = false;
    this.log('GX-Test beendet, Anschluss wieder frei');
    this.zeigeGX();
    this.setzeStatus('GX-Test beendet – Anschluss wieder frei für Spooky2', 'gx');
  }
  /** Eigene Zeile aus dem GX-Testfeld senden (für Versuche, die Claude im Chat vorgibt). */
  async gxEigene() {
    const feld = $('.gx-befehl', this.karte), text = feld.value.trim();
    if (!text || !this.imTest) return;
    try { await this.gxSende(text); feld.select(); }
    catch (e) { this.log(`GX: ${e.message}`); this.setzeStatus(`GX: ${e.message}`, 'fehler'); }
  }

  // ---------------------------------------------------------------- Ablauf
  async starte(stand = null, sofort = false) {
    if (this.lauf) return;
    if (this.imTest) { if (this.gx) await this.beendeTestGX(); else this.setzeTest(false); }
    const v = this.pruefe();
    if (!v) return;
    if (stand && stand.liste !== this.einst.liste) stand = null;
    this.fortsetzen = null;
    $('.btn-weiter', this.karte).hidden = true;
    let startUmMs = null;
    if (stand?.startUm && stand.status === 'wartet') startUmMs = stand.startUm;
    else if (!stand && !sofort && this.einst.startUm) {
      const [h, m] = this.einst.startUm.split(':').map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0);
      if (d.getTime() <= Date.now()) {
        d.setDate(d.getDate() + 1);
        if (!confirm(`Startzeit ${this.einst.startUm} ist heute schon vorbei.\n\nOK = erst morgen um ${this.einst.startUm} starten\nAbbrechen = nicht starten (Feld «Start um» leeren für sofort)`)) return;
      }
      startUmMs = d.getTime();
    }
    const schritt = stand && stand.schritt < v.plan.schritte.length ? stand.schritt : 0;
    this.lauf = {
      plan: v.plan, items: v.items, einst: v.einst, listeText: this.einst.liste, warnungen: [],
      schritt, tImSchritt: stand && schritt === stand.schritt ? stand.tImSchritt ?? 0 : 0, durchlauf: stand?.durchlauf ?? 1,
      durchlaeufe: this.einst.durchlaeufe, zustand: K.neuerZustand(), status: startUmMs ? 'wartet' : 'einrichten',
      startUmMs, letzterTick: null, letzterTakt: null, beschaeftigt: false, aktivEi: null, aktivPi: null,
    };
    this.rechneMarken(startUmMs || Date.now());
    this.sperre(true);
    this.pruefe();
    speichereAlle();
    if (startUmMs) this.setzeStatus(`Wartet bis ${fmtUhr(startUmMs)}`, 'warnung');
  }

  /** Generator auf das Preset des aktuellen (bzw. nächsten klingenden) Schritts einrichten. */
  async einrichten() {
    const l = this.lauf;
    l.beschaeftigt = true;
    try {
      const s = l.plan.schritte;
      let ei = s[l.schritt].ei;
      if (s[l.schritt].pause) { const n = s.slice(l.schritt).find(x => !x.pause) || s.find(x => !x.pause); if (n) ei = n.ei; }
      const ein = l.einst[ei], key = ein.key;
      this.zeigePreset(ein.e.name, true);
      this.setzeStatus(`Generator wird eingerichtet: ${ein.e.name || 'Preset'} …`);
      if (!this.verbunden || !this.leitung.offen) {
        if (this.gx) { if (!(await this.verbindeGX())) throw new Error(this.gxGrund || 'GX Pro nicht bereit'); }
        else if (!(await this.verbinde())) throw new Error('Generator antwortet nicht');
      }
      if (!this.lauf) return;
      await this.sende(this.gx ? K.gxEinrichtung(ein.e, daten.wellen, `RADIX ${this.einst.nr} - ${ein.e.name}`) : K.einrichtung(ein.e, daten.wellen));
      if (!this.lauf) return;
      l.aktivEi = l.einst.findIndex(x => x.key === key);
      this.zeigePreset(ein.e.name);
      this.log(`Preset aktiv: ${ein.e.name}`);
      l.status = 'laeuft';
      speichereAlle();
      l.zustand = K.neuerZustand();
      l.letzterTick = performance.now();        // Einrichtzeit zählt nicht zur Programmzeit
      await this.spieleSchritt(true);
    } catch (e) {
      if (this.lauf !== l) return;                                // inzwischen gestoppt: kein Fehler
      this.verbunden = false; this.zeigeVerbindung('fehler', this.gx && this.gxGrund === GX_GESPERRT ? 'gesperrt' : 'keine Antwort');
      this.stoppe(this.gx && this.gxGrund && e.message === this.gxGrund ? e.message : 'Fehler beim Einrichten: ' + e.message, true);
    } finally { if (this.lauf) this.lauf.beschaeftigt = false; }
  }

  /** Aktuellen Schritt an den Generator geben (bei Wechsel, Sweep-Fortschritt oder Wobble-Takt). */
  async spieleSchritt(neu) {
    const l = this.lauf;
    const s = l.plan.schritte[l.schritt];
    const b = [];
    const ausgaenge = this.gx ? K.gxAusgangBefehle : K.ausgangBefehle;
    if (s.pause) b.push(...ausgaenge(false, l.zustand));
    else {
      const e = l.einst[s.ei].e, { f1, f2 } = K.frequenzenBei(s, l.tImSchritt, e);
      b.push(...(this.gx ? K.gxFrequenzBefehle(f1, f2, l.zustand, neu, e.out2Modus.art === 'gleich') : K.frequenzBefehle(f1, f2, l.zustand)));
      b.push(...ausgaenge(true, l.zustand));
      l.f1 = f1; l.f2 = f2;
    }
    l.letzterTakt = K.taktBei(s, l.tImSchritt);
    this.leise = !neu;                           // Wobble- und Sweep-Schritte nicht einzeln protokollieren
    try { if (b.length) await this.sende(b); } finally { this.leise = false; }
    if (neu) {
      if (s.pi !== l.aktivPi) { l.aktivPi = s.pi; const it = l.items[s.pi]; this.log(`Programm ${s.pi + 1}/${l.items.length}: ${it.code} ${it.name}`); this.markiereAktiv(); }
      this.log(s.marke ? `Schritt ${l.schritt + 1}/${l.plan.schritte.length}: Ausgänge aus, warten bis ${fmtUhr(s.zeitMs)}` : `Schritt ${l.schritt + 1}/${l.plan.schritte.length}: ${s.pause ? 'Pause' : `${fmtHz(l.f1)} / ${fmtHz(l.f2)}`} für ${s.sek} s`);
    }
  }

  /** Vorspulen: der Taktgeber führt den Sprung beim nächsten Takt aus (nie mitten in einem Befehl an den Generator). */
  springe(art) {
    const l = this.lauf;
    if (!l) return;
    if (l.status === 'wartet') { this.melde('Wartet noch auf die Startzeit – nichts zu überspringen', 'fehler'); return; }
    if (art === 'programm') {                                       // würde der Sprung den Generator stoppen? -> nachfragen
      const s = l.plan.schritte, i = l.schritt;
      let j = i;
      while (j + 1 < s.length && s[j + 1].pi === s[i].pi) j++;
      const letztes = !s[i].marke && j + 1 >= s.length && l.durchlaeufe && l.durchlauf >= l.durchlaeufe;
      if (letztes && !confirm(`${l.items[s[i].pi].code === 'Zeile' ? l.items[s[i].pi].name : l.items[s[i].pi].code} ist das letzte Programm – Generator ${this.einst.nr} wird danach gestoppt. Trotzdem überspringen?`)) return;
    }
    l.sprung = art;
  }
  /** Sprung ausführen: Zeit im Schritt ans Ende setzen, der normale Ablauf geht dann zum nächsten Schritt bzw. Programm. */
  fuehreSprungAus(art) {
    const l = this.lauf, s = l.plan.schritte, i = l.schritt, it = l.items[s[i].pi];
    if (s[i].marke) {                                             // Warten auf Zeitmarke abbrechen: sofort weiter
      s[i].zeitMs = Date.now();
      this.log(`⏭ Zeitmarke ${s[i].um} übersprungen – startet sofort`);
      this.melde(`Zeitmarke ${s[i].um} übersprungen`, 'ok');
      return;
    }
    if (art === 'programm') {
      let j = i;
      while (j + 1 < s.length && s[j + 1].pi === s[i].pi) j++;
      l.schritt = j;
      this.log(`⏭ Programm übersprungen: ${it.code} ${it.name}`);
      this.melde(`Übersprungen: ${it.code}`, 'ok');
    } else {
      this.log(`⏭ Schritt ${i + 1} übersprungen (${s[i].pause ? 'Pause' : fmtHz(l.f1)})`);
    }
    l.tImSchritt = s[l.schritt].sek;
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
      if (l.sprung) { const art = l.sprung; l.sprung = null; this.fuehreSprungAus(art); }
      let gewechselt = false;
      // Zeitmarke weiter unten ist fällig: laufendes Programm beenden, dorthin springen
      const jetztMs = Date.now(), alle = l.plan.schritte;
      let faellig = -1;
      for (let k = l.schritt + 1; k < alle.length; k++) if (alle[k].marke && jetztMs >= alle[k].zeitMs) faellig = k;
      if (faellig >= 0) {
        const vorher = l.items[alle[l.schritt].pi];
        this.log(`⏰ ${alle[faellig].um}: ${alle[l.schritt].marke ? 'Warten' : vorher.code + ' ' + vorher.name} beendet, weiter nach Zeitplan`);
        l.schritt = faellig; l.tImSchritt = 0; gewechselt = true;
      }
      for (;;) {
        const st = l.plan.schritte[l.schritt];
        if (st.marke) {
          if (Date.now() < st.zeitMs) { l.tImSchritt = 0; break; }      // warten, Ausgänge sind aus
          l.tImSchritt = 0;
          this.log(`⏰ ${st.um}: Start nach Zeitplan`);
        } else {
          if (l.tImSchritt < st.sek) break;
          l.tImSchritt -= st.sek;
        }
        l.schritt++;
        gewechselt = true;
        if (l.schritt >= l.plan.schritte.length) {
          l.schritt = 0;
          if (l.durchlaeufe && l.durchlauf >= l.durchlaeufe) { await this.stoppe('fertig'); return; }
          l.durchlauf++;
          this.log(`Durchlauf ${l.durchlauf} beginnt`);
          this.rechneMarken();
        }
      }
      const s = l.plan.schritte[l.schritt];
      if (!s.pause && s.ei !== l.aktivEi) {          // anderes Preset: Generator umstellen
        this.log(`Preset-Wechsel auf ${l.einst[s.ei].e.name}`);
        l.status = 'einrichten';
        return;
      }
      if (gewechselt) await this.spieleSchritt(true);
      else if (K.taktBei(s, l.tImSchritt) !== l.letzterTakt) await this.spieleSchritt(false);
      this.zeigeFortschritt();
    } catch (e) {
      if (this.lauf !== l) return;                                // inzwischen gestoppt: kein Fehler
      this.verbunden = false; this.zeigeVerbindung('fehler', 'keine Antwort');
      this.stoppe('Verbindung verloren: ' + e.message, true);
    } finally { if (this.lauf) this.lauf.beschaeftigt = false; }
  }

  zeigeFortschritt() {
    const l = this.lauf; if (!l) return;
    const s = l.plan.schritte[l.schritt], it = l.items[s.pi];
    if (s.marke) { this.setzeStatus(`Wartet bis ${fmtUhr(s.zeitMs)} (Zeitmarke ${s.um}), Ausgänge aus`, 'warnung'); return; }
    const vorher = l.plan.schritte.slice(0, l.schritt).reduce((a, x) => a + x.sek, 0) + l.tImSchritt;
    const rest = l.plan.gesamtSek - vorher + (l.durchlaeufe ? (l.durchlaeufe - l.durchlauf) * l.plan.gesamtSek : 0);
    this.setzeStatus(`${it.code} · ${s.pause ? 'Pause' : `Out1 ${fmtHz(l.f1)} · Out2 ${fmtHz(l.f2)}`} · Programm ${s.pi + 1}/${l.items.length} · Durchlauf ${l.durchlauf}${l.durchlaeufe ? '/' + l.durchlaeufe : ''} · ${l.durchlaeufe ? 'noch ' + fmtZeit(rest) : 'endlos'}`, 'ok');
    $('.balken > div', this.karte).style.width = `${Math.min(100, vorher / l.plan.gesamtSek * 100)}%`;
  }

  async stoppe(grund, fehler = false) {
    const l = this.lauf;
    this.lauf = null;
    if (l && l.status !== 'wartet' && (!this.gx || this.verbunden)) {   // GX nicht verbunden (gesperrt): nichts senden, Anschluss bleibt zu
      try { await this.sende(this.ausBefehle()); } catch (e) { /* Gerät weg */ }
    }
    if (this.gx && this.leitung.offen) {                            // GX: Anschluss wieder frei (Spooky2), beim nächsten Start neu verbinden
      try { await this.sende([['Anzeige', K.GX.name(`RADIX ${this.einst.nr} - gestoppt`)]]); } catch (e) { /* egal */ }
      try { await this.leitung.schliesse(); } catch (e) { /* schon zu */ }
      this.verbunden = false;
      this.log('GX: Anschluss wieder frei');
    }
    if (this.gx && !fehler) this.zeigeGX(true);
    this.sperre(false);
    this.zeigePreset('');
    $('.balken > div', this.karte).style.width = '0';
    this.setzeStatus(grund === 'fertig' ? `Fertig um ${jetzt()}` : grund, fehler ? 'fehler' : grund === 'fertig' ? 'ok' : '');
    this.log(grund);
    speichereAlle();
    this.pruefe();
    this.aktualisiereKunde();
  }
}

// ------------------------------------------------------------------ Übersicht: ein Knopf pro Generator im Kopf
const zahl = (g) => parseInt(g.einst.nr, 10) || 0;

/** Zustand für die Leiste: k = Killing läuft, h = übriges Preset läuft, w = wartet/stellt um, f = Fehler, '' = steht. */
function zustand(g) {
  const l = g.lauf, st = $('.status', g.karte);
  if (l) {
    if (l.status !== 'laeuft') return { art: 'w', text: l.status === 'wartet' ? 'wartet auf Startzeit' : 'wird eingerichtet' };
    const st = l.plan.schritte[l.schritt];
    if (st && st.marke) return { art: 'w', text: `wartet bis ${st.um}` };
    const e = l.einst[l.aktivEi], name = e ? e.e.name : '';
    return { art: /killing/i.test(name) ? 'k' : 'h', text: `läuft · ${name}` };
  }
  if (g.gx && !st.classList.contains('fehler') && !g.imTest) return { art: 'x', text: 'GeneratorX Pro – bereit, Anschluss frei (verbindet beim Start)' };
  if (st.classList.contains('fehler')) return { art: 'f', text: st.textContent };
  return { art: '', text: st.textContent || 'steht' };
}

let leistenStand = '';
function aktualisiereLeiste() {
  const nav = $('#leiste');
  const aktiv = daten.kontrolle ? daten.kontrolle.aktiv : null;
  const liste = [...generatoren].sort((a, b) => zahl(a) - zahl(b)).map(g => {
    const z = zustand(g), kunde = $('.kunde', g.karte).textContent;
    return { nr: zahl(g), art: z.art, titel: `Generator ${g.einst.nr}${kunde ? ' · ' + kunde : ''} · ${z.text}` };
  });
  // Mit Brücke: alle Nummern 1–24 sofort zeigen; noch nicht gemeldete Generatoren blass («fehlt»), damit beim Hochfahren
  // nichts herumspringt und man sieht, welche noch fehlen
  if (modus === 'bruecke') {
    const da = new Set(liste.map(x => x.nr));
    for (let n = 1; n <= hoechsteNummer(); n++) if (!da.has(n)) liste.push({ nr: n, art: 'fehlt', titel: `Generator ${n}: noch nicht gemeldet – wartet auf Anschluss (Strom, USB-Kabel, Hub?)` });
    liste.sort((a, b) => a.nr - b.nr);
  }
  for (const g of generatoren) g.karte.style.order = zahl(g);          // Karten nach Nummer sortiert
  const gz = gezeigt ? zahl(gezeigt) : null;
  const stand = JSON.stringify([liste, aktiv, gz]);
  if (stand === leistenStand) return;
  leistenStand = stand;
  nav.hidden = liste.length < 1;
  nav.innerHTML = liste.map(x => `<button class="lg ${x.art}${x.nr === aktiv ? ' aktiv' : ''}${x.nr === gz ? ' gezeigt' : ''}" data-nr="${x.nr}" title="${esc(x.titel)}"${x.art === 'fehlt' ? ' disabled' : ''}>${x.nr}</button>`).join('') +
    `<span class="legende">rot Killing · blau Healing · gelb stellt um oder wartet · weiss steht · rot umrandet keine Verbindung · grau gestrichelt GX Pro bereit (Anschluss frei)${modus === 'bruecke' ? ' · blass noch nicht da' : ''}</span>`;
  setzeKopfHoehe();
}

// ------------------------------------------------------------------ Einzelansicht: nur der gewählte Generator, ganze Breite
const ANSICHT = 'radix-ansicht';
let ansicht = lade(ANSICHT, { einzel: true, nr: null });
let gezeigt = null;
/** Diesen Generator zeigen (in der Einzelansicht der einzige sichtbare). */
function zeige(g, merken = true) {
  if (!g) return;
  gezeigt = g;
  for (const x of generatoren) x.karte.classList.toggle('gezeigt', x === g);
  if (merken) { ansicht.nr = zahl(g); speichere(ANSICHT, ansicht); }
  aktualisiereLeiste();
}
/** Gemerkten Generator wieder zeigen; ist er (noch) nicht verbunden, vorläufig den mit der kleinsten Nummer, ohne die Wahl zu überschreiben. */
function zeigeGemerkten() {
  const g = generatoren.find(x => zahl(x) === ansicht.nr);
  if (g) { if (g !== gezeigt) zeige(g); return; }
  const erster = [...generatoren].sort((a, b) => zahl(a) - zahl(b))[0];
  if (erster && erster !== gezeigt) zeige(erster, false);
}
function setzeAnsicht(einzel) {
  ansicht.einzel = einzel; speichere(ANSICHT, ansicht);
  document.body.classList.toggle('einzel', einzel);
  $('#btn-ansicht').textContent = einzel ? 'Alle zeigen' : 'Nur gewählten';
  setzeKopfHoehe();
  if (gezeigt) gezeigt.karte.scrollIntoView({ block: 'start' });
}

/** Zur Karte des Generators mit dieser Nummer gehen (Einzelansicht: nur sie zeigen) und sie kurz hervorheben. */
function springeZu(nr) {
  const g = generatoren.find(x => zahl(x) === Number(nr));
  if (!g) { setzeQuelle('#kontrolle-status', `Blatt ${nr} angeklickt – kein Generator mit Nummer ${nr} verbunden`, 'fehler'); return; }
  zeige(g);
  g.karte.scrollIntoView({ behavior: ansicht.einzel ? 'auto' : 'smooth', block: 'start' });
  g.karte.classList.remove('markiert'); void g.karte.offsetWidth; g.karte.classList.add('markiert');
}

/** Höhe des stehenbleibenden Kopfs, damit die Karte beim Springen nicht darunter verschwindet. */
function setzeKopfHoehe() {
  document.documentElement.style.setProperty('--kopf', $('#kopfbereich').offsetHeight + 'px');
}
/** Beim Scrollen bleibt der Kopf stehen und wird schmal (kleines Logo); oben wieder gross. */
function beobachteScrollen() {
  const pruefe = () => {
    const y = window.scrollY, b = document.body;
    if (!b.classList.contains('gescrollt') && y > 120) { b.classList.add('gescrollt'); setzeKopfHoehe(); }
    else if (b.classList.contains('gescrollt') && y < 10) { b.classList.remove('gescrollt'); setzeKopfHoehe(); }
  };
  window.addEventListener('scroll', pruefe, { passive: true });
  pruefe();
}

// ------------------------------------------------------------------ Zuordnen: alle Nummern auf einmal richtig stellen
// Jeder verbundene Anschluss zeigt einen eindeutigen Code (101, 102, …) auf dem Display. Markus trägt pro Gerät (Nummer am Regal)
// den Code ein, den es zeigt. RADIX gibt jedem Anschluss direkt seine Nummer – ohne Tauschen Schritt für Schritt.
const CODE_AB = 101;
/** Höchste sinnvolle Generator-Nummer: 24 (Regal) oder mehr, wenn mehr Generatoren angeschlossen sind. */
const hoechsteNummer = () => Math.max(24, generatoren.length);
let zuCodes = new Map();                                                // Code -> Generator

async function sendeCodes() {
  zuCodes = new Map();
  const meldung = $('#zuordnen .zu-meldung');
  meldung.className = 'zu-meldung'; meldung.textContent = 'Codes werden gesendet …';
  let ok = 0;
  await Promise.all(generatoren.map(async (g, i) => {
    const code = CODE_AB + i;
    zuCodes.set(code, g);
    if (g.imTest) g.setzeTest(false);
    if (g.gx) return;
    try {
      if (!g.verbunden && !(await g.verbinde(true))) return;
      await g.sende([['Ausgang 1 aus', K.Befehl.ausgang(0, false)], ['Ausgang 2 aus', K.Befehl.ausgang(1, false)], ...K.frequenzBefehle(code, code, K.neuerZustand())]);
      g.setzeStatus(`Zuordnen: Display zeigt Code ${code}`, 'warnung');
      g.log(`Zuordnen: Code ${code} auf dem Display`);
      ok++;
    } catch (e) { /* bleibt ohne Code */ }
  }));
  const gx = generatoren.filter(g => g.gx).length, ohne = generatoren.length - ok - gx;
  meldung.className = 'zu-meldung ok';
  meldung.textContent = `${ok} von ${generatoren.length} Generatoren zeigen einen Code (${CODE_AB} bis ${CODE_AB + generatoren.length - 1}).${gx ? ` ${gx} GX-Pro-Anschlüsse zeigen keinen Code (dort mit «Testen» prüfen).` : ''}${ohne ? ` ${ohne} ohne Verbindung zeigen keinen Code.` : ''}`;
}

async function oeffneZuordnen() {
  if (generatoren.some(g => g.lauf)) { alert('Zuerst alle Generatoren stoppen («Alle stoppen»), dann zuordnen.'); return; }
  const dlg = $('#zuordnen'), raster = $('.zu-raster', dlg);
  const anzahl = Math.max(24, generatoren.length);
  raster.innerHTML = Array.from({ length: anzahl }, (_, i) => `<label><span>Gerät ${i + 1}</span><input inputmode="numeric" data-geraet="${i + 1}" maxlength="3" autocomplete="off"></label>`).join('');
  raster.onkeydown = (ev) => {                                          // Enter springt ins nächste Feld
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const felder = [...raster.querySelectorAll('input')], i = felder.indexOf(ev.target);
    if (i >= 0 && i + 1 < felder.length) felder[i + 1].focus(); else $('.btn-zu-ok', dlg).focus();
  };
  $('.btn-zu-ok', dlg).onclick = uebernehmeZuordnung;
  $('.btn-zu-neu', dlg).onclick = sendeCodes;
  $('.btn-zu-ab', dlg).onclick = async () => {
    dlg.close();
    for (const g of generatoren) if (g.verbunden && !g.lauf) { try { await g.sende([['Ausgang 1 aus', K.Befehl.ausgang(0, false)], ['Ausgang 2 aus', K.Befehl.ausgang(1, false)]]); } catch (e) {} g.setzeStatus('bereit'); }
  };
  dlg.showModal();
  raster.querySelector('input').focus();
  await sendeCodes();
}

/** Eingaben prüfen und alle Nummern auf einmal setzen. Anschlüsse ohne Eintrag (z. B. ohne Verbindung) bekommen die übrigen Nummern. */
async function uebernehmeZuordnung() {
  const dlg = $('#zuordnen'), meldung = $('.zu-meldung', dlg);
  const felder = [...dlg.querySelectorAll('.zu-raster input')];
  const zuteilung = new Map(), fehler = [];
  felder.forEach(f => f.classList.remove('fehler'));
  const gesehen = new Map();
  for (const f of felder) {
    const t = f.value.trim();
    if (!t) continue;
    const code = parseInt(t, 10), g = zuCodes.get(code);
    if (!g) { f.classList.add('fehler'); fehler.push(`Gerät ${f.dataset.geraet}: Code ${t} gibt es nicht`); continue; }
    if (gesehen.has(code)) { f.classList.add('fehler'); gesehen.get(code).classList.add('fehler'); fehler.push(`Code ${code} zweimal eingetragen (Gerät ${gesehen.get(code).dataset.geraet} und ${f.dataset.geraet})`); continue; }
    gesehen.set(code, f);
    zuteilung.set(g, f.dataset.geraet);
  }
  if (fehler.length) { meldung.className = 'zu-meldung'; meldung.textContent = fehler.join(' · '); return; }
  if (!zuteilung.size) { meldung.className = 'zu-meldung'; meldung.textContent = 'Noch nichts eingetragen.'; return; }
  // Übrige Anschlüsse (z. B. ohne Verbindung): die freien Nummern 1, 2, 3 … – Lücken werden gefüllt, keine Nummer über der Anzahl
  const belegt = new Set(zuteilung.values()), hoechste = hoechsteNummer();
  for (const g of generatoren) {
    if (zuteilung.has(g)) continue;
    let nr = g.einst.nr;
    if (belegt.has(nr) || !(parseInt(nr, 10) >= 1 && parseInt(nr, 10) <= hoechste)) { let n = 1; while (belegt.has(String(n))) n++; nr = String(n); }
    zuteilung.set(g, nr); belegt.add(nr);
  }
  speichereAlle();                                                      // Stand unter den bisherigen Nummern sichern
  for (const [g, nr] of zuteilung) if (g.einst.nr !== nr) { g.log(`Zuordnen: Nummer ${g.einst.nr} → ${nr}`); g.ladeEinst(nr); g.zeigeEinst(); }
  speichereAlle();
  dlg.close();
  // Zur Kontrolle: jedes Gerät zeigt jetzt seine eigene Nummer (Test, Ausgänge aus)
  await Promise.all(generatoren.filter(g => g.verbunden).map(g => g.teste()));
  if (gezeigt) zeige(gezeigt);
  aktualisiereLeiste();
}

// ------------------------------------------------------------------ PC wach halten, solange ein Generator läuft oder wartet
let wachSperre = null, wachAnfrage = false;
async function pruefeWach() {
  const noetig = generatoren.some(g => g.lauf);
  try {
    if (noetig && !wachSperre && !wachAnfrage && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wachAnfrage = true;
      wachSperre = await navigator.wakeLock.request('screen');
      wachSperre.addEventListener('release', () => { wachSperre = null; $('#wach').hidden = true; });
    } else if (!noetig && wachSperre) { const w = wachSperre; wachSperre = null; await w.release(); }
  } catch (e) { /* nicht erlaubt (Tab verdeckt, Akku-Sparmodus): beim nächsten Takt erneut */ }
  finally { wachAnfrage = false; }
  $('#wach').hidden = !wachSperre;
}

// ------------------------------------------------------------------ Taktgeber (Web Worker, läuft auch im Hintergrund)
function starteTakt() {
  const code = 'setInterval(() => postMessage(0), 50);';
  const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
  let letztesSpeichern = 0, letzteLeiste = 0, letzterVersuch = Date.now();
  w.onmessage = () => {
    for (const g of generatoren) g.tick();
    if (Date.now() - letzterVersuch > 15000) {
      letzterVersuch = Date.now();
      for (const g of generatoren) if (!g.gx && !g.lauf && !g.imTest && !g.verbunden && !g.verbindet && !g.leitung.weg) g.verbinde(true);
    }
    if (Date.now() - letzteLeiste > 500) { letzteLeiste = Date.now(); aktualisiereLeiste(); pruefeWach(); }
    if (Date.now() - letztesSpeichern > 5000) { letztesSpeichern = Date.now(); if (generatoren.some(g => g.lauf)) speichereAlle(); }
  };
}

// ------------------------------------------------------------------ Start
async function fuegeHinzu(port) {
  if (port instanceof BrueckenLeitung) {
    $('#generatoren .leer')?.remove();
    const g = new Generator(port, generatoren.length);
    generatoren.push(g);
    g.verbinde();
    $('#anzahl').textContent = `${generatoren.length} Generator${generatoren.length === 1 ? '' : 'en'}`;
    speichereAlle();
    zeigeGemerkten();
    return;
  }
  const da = generatoren.find(g => g.leitung.port === port);
  if (da) { da.getrennt = false; if (!da.lauf) da.verbinde(); return; }   // wieder eingesteckt / eingeschaltet: neu verbinden
  // Wieder eingesteckt, aber Chrome meldet ihn als neuen Anschluss (z. B. nach Strom aus/ein): die getrennte Karte übernimmt ihn,
  // statt dass eine zusätzliche Karte (25, 26 …) entsteht. Chrome liefert bei CH340 keine Kennung – sind mehrere getrennt,
  // nimmt er die kleinste Nummer und bittet um «Zuordnen».
  const frei = generatoren.filter(g => g.getrennt && !g.lauf).sort((a, b) => zahl(a) - zahl(b));
  if (frei.length) {
    const g = frei[0];
    try { await g.leitung.schliesse(); } catch (e) { /* alter Anschluss ist weg */ }
    g.leitung = new Leitung(port);
    g.getrennt = false;
    g.log('Wieder eingesteckt (neuer Anschluss)');
    const ok = await g.verbinde();
    if (ok && frei.length > 1) g.setzeStatus(`Wieder eingesteckt – ${frei.length} Generatoren waren getrennt, die Nummer ist nicht sicher: mit «Zuordnen» prüfen`, 'warnung');
    else if (ok) g.setzeStatus('Wieder eingesteckt – verbunden', 'ok');
    speichereAlle();
    return;
  }
  $('#generatoren .leer')?.remove();
  const g = new Generator(port, generatoren.length);
  generatoren.push(g);
  g.verbinde();                                                      // alle gleichzeitig prüfen, nicht warten
  $('#anzahl').textContent = `${generatoren.length} Generator${generatoren.length === 1 ? '' : 'en'}`;
  speichereAlle();
  zeigeGemerkten();
}

/** USB getrennt (Kabel, Strom): Karte zeigt es sofort. */
function getrennt(port) {
  const g = generatoren.find(x => x.leitung.port === port);
  if (!g) return;
  g.verbunden = false; g.leitung.offen = false; g.getrennt = true;
  g.zeigeVerbindung('fehler', 'getrennt');
  g.log('USB getrennt');
  if (!g.lauf) g.setzeStatus('USB getrennt – Kabel/Strom prüfen. Verbindet von selbst, sobald er wieder da ist.', 'fehler');
}

async function init() {
  $('#version').textContent = VERSION;
  if (!('serial' in navigator) || !('showDirectoryPicker' in window)) { $('#kein-chrome').hidden = false; return; }
  $('#btn-ordner').onclick = waehleOrdner;
  $('#btn-hinzu').onclick = async () => { try { await fuegeHinzu(await navigator.serial.requestPort()); } catch (e) { /* abgebrochen */ } };
  $('#btn-alle-testen').onclick = () => { for (const g of generatoren) if (!g.lauf && !g.imTest) g.teste(); };   // 0.6.5: GX auch (öffnet den Anschluss bis «Test beenden»)
  $('#btn-alle-stopp').onclick = () => { for (const g of generatoren) { if (g.lauf) g.stoppe('gestoppt'); else if (g.imTest) g.beendeTest(); } };
  $('#leiste').onclick = (ev) => { const b = ev.target.closest('button[data-nr]'); if (b) springeZu(b.dataset.nr); };
  $('#btn-ansicht').onclick = () => setzeAnsicht(!ansicht.einzel);
  $('#btn-zuordnen').onclick = oeffneZuordnen;
  setzeAnsicht(ansicht.einzel);
  window.addEventListener('resize', setzeKopfHoehe);
  beobachteScrollen();
  window.addEventListener('beforeunload', (ev) => { speichereAlle(); if (generatoren.some(g => g.lauf)) { ev.preventDefault(); ev.returnValue = ''; } });
  if (await verbindeBruecke()) {
    modus = 'bruecke';
    document.body.classList.add('bruecke');
    $('#btn-hinzu').hidden = true;                                       // Generatoren kommen von der Brücke (auch neu eingesteckte)
    zeigeBruecke();
    aktualisiereLeiste();                                                // Nummern 1–24 sofort, auch bevor die Generatoren gemeldet sind
    const leer = $('#generatoren .leer');
    if (leer) leer.textContent = 'RADIX-Brücke verbunden, aber noch keine Generatoren gefunden. Spooky2 schliessen und USB-Kabel prüfen – sie erscheinen von selbst.';
  } else if (bruecke.besetzt) {
    $('#btn-hinzu').hidden = true; $('#btn-zuordnen').hidden = true;
    const leer = $('#generatoren .leer');
    if (leer) leer.textContent = 'RADIX ist schon in einem anderen Fenster oder Tab offen und steuert dort die Generatoren. Dieses Fenster schliessen.';
  } else {
    zeigeBruecke();
    navigator.serial.addEventListener('connect', (ev) => fuegeHinzu(ev.target));
    navigator.serial.addEventListener('disconnect', (ev) => getrennt(ev.target));
    for (const p of await navigator.serial.getPorts()) await fuegeHinzu(p);
    // Startet die Brücke später (z. B. Chrome fragte erst nach der Erlaubnis): Hinweis zum Neuladen
    const suche = setInterval(async () => {
      if (generatoren.some(g => g.lauf)) return;
      if (await verbindeBruecke(1500, true)) {
        clearInterval(suche);
        const el = $('#bruecke'); el.className = 'info ok'; el.textContent = 'RADIX-Brücke gefunden – hier klicken zum Neuladen'; el.style.cursor = 'pointer';
        el.onclick = () => location.reload();
      }
    }, 10000);
  }
  await Promise.all([ordnerBeimStart(), quelleBeimStart('finder'), quelleBeimStart('kontrolle')]);
  beobachteQuellen();
  starteTakt();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
