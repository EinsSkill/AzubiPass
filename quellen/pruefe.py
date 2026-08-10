#!/usr/bin/env python3
"""
AzubiPass · Sichtprüfung

    python3 pruefe.py                    alle gebauten Seiten
    python3 pruefe.py lf1.html           nur eine
    python3 pruefe.py --schnell          nur Handy, nur helle Stimmung

Rendert die fertigen Seiten in einem echten Browser und sucht nach genau den
Fehlern, die beim Draufschauen auffallen — und die man beim Draufschauen
übersieht, sobald es vierzehn Seiten sind.

Geprüft wird:
  1  Lesbarkeit   Kontrast von Text zu Hintergrund nach WCAG
  2  Überlappung  Elemente, die über anderen liegen statt neben ihnen
  3  Grafiken     Beschriftungen, die sich oder Kästen überlagern
  4  Leerraum     Zeichenflächen, die deutlich größer sind als ihr Inhalt
  5  Tippziele    Knöpfe und Links unter 44 px — am Handy nicht zu treffen
  6  Überlauf     Inhalt, der das Fenster seitlich sprengt
  7  Marke        verbotene Wörter, Emojis
  8  Inhalt       unaufgelöste Verweise, offene Prüf-Marker

Und zwar in beiden Größen und beiden Farbstimmungen. Vorher lief das nur bei
1440 × 1200 in Hell — ausgerechnet blind für alles, was am Handy schiefgeht.

Geladen wird über einen kurzlebigen lokalen Server, nicht über file://: Die App
holt ihren Inhalt per fetch, und das lässt kein Browser von der Festplatte zu.

Rückgabewert 1, wenn etwas gefunden wurde — damit taugt es als Freigabe-Tor.
"""

import functools
import http.server
import re
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

from gemeinsames import AUSGABE

HIER = Path(__file__).parent

# Unter Windows kodiert Python die Umleitung in eine Datei sonst in cp1252 —
# und bricht beim ersten Minuszeichen aus einem Kapiteltext mit einem
# UnicodeEncodeError ab. Der Bericht war dann genau bis dahin da und danach weg.
for strom in (sys.stdout, sys.stderr):
    try:
        strom.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

# Handy zuerst: Was dort bricht, bricht am ehesten.
ANSICHTEN = [("Handy", 390, 844), ("Schreibtisch", 1440, 1100)]
STIMMUNGEN = ["light", "dark"]

# Mindestmaß für etwas, das man mit dem Daumen trifft. Apple und Google nennen
# beide 44 px; darunter wird geraten statt getippt.
TIPPZIEL = 44

VERBOTEN = ["revolutionär", "innovativ", "ganzheitlich", "lernreise", "erfolgsgarantie",
            "exklusiv", "hochwertig", "nächste level", "ki-gestützt"]

# Kontrastschwellen nach WCAG: normaler Text 4.5, großer Text 3.0
JS_PRUEFUNG = r"""
(TIPPZIEL) => {
  const raus = { kontrast: [], ueberlappung: [], schilder: [], leerraum: [],
                 tippziel: [], ueberlauf: [] };

  const zahl = s => s.split("(")[1].split(")")[0].split(",").map(Number);
  function lum(c) {
    const [r, g, b] = c.slice(0, 3).map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function grund(el) {
    let n = el, schwebt = false;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const v = zahl(cs.backgroundColor);
      if (!(v.length >= 4 && v[3] < 0.5)) return { c: v, unsicher: schwebt };
      if (cs.position === "fixed") schwebt = true;   // durchsichtig und schwebend
      n = n.parentElement;
    }
    return { c: [255, 255, 255], unsicher: schwebt };
  }
  function verhaeltnis(a, b) {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  // 1 · Kontrast
  document.querySelectorAll("body *").forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return;
    const direkt = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!direkt) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || +cs.opacity < 0.3) return;
    const gr = parseFloat(cs.fontSize) >= 24
      || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
    const g = grund(el);
    if (g.unsicher) return;                      // schwebt über wechselndem Grund
    const v = verhaeltnis(zahl(cs.color), g.c);
    const soll = gr ? 3.0 : 4.5;
    if (v < soll) raus.kontrast.push({
      text: el.textContent.trim().slice(0, 42),
      klasse: (el.className || "").toString().slice(0, 36),
      wert: Math.round(v * 100) / 100, soll
    });
  });

  // 2 · Überlappung: absolut positionierte Elemente über Text
  const kandidaten = [...document.querySelectorAll("body *")].filter(el => {
    const cs = getComputedStyle(el);
    if (cs.backfaceVisibility === "hidden") return false;      // Rückseite einer Klappkarte
    if (el.closest("[style*='preserve-3d'], .karte")) return false;
    return el.offsetParent && (cs.position === "absolute") && el.getBoundingClientRect().width > 0;
  });
  kandidaten.forEach(el => {
    const a = el.getBoundingClientRect();
    const eltern = el.offsetParent;
    if (!eltern) return;
    [...eltern.querySelectorAll("p, li, h1, h2, h3, td, .lz-name, .frage-text")].forEach(t => {
      if (el.contains(t) || t.contains(el)) return;
      const b = t.getBoundingClientRect();
      if (b.width === 0) return;
      const u = !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
      if (u) raus.ueberlappung.push({
        oben: (el.className || "").toString().slice(0, 30),
        unten: t.textContent.trim().slice(0, 34)
      });
    });
  });

  // 3 · Grafiken: Beschriftungen gegen einander und gegen Kästen
  function kastenVon(g) {
    const b = g.getBBox();
    const t = /translate\(([-\d.]+)[ ,]([-\d.]+)\)/.exec(g.getAttribute("transform") || "");
    const dx = t ? +t[1] : 0, dy = t ? +t[2] : 0;
    return { x: b.x + dx, y: b.y + dy, w: b.width, h: b.height };
  }
  const ueber = (a, b) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  document.querySelectorAll("svg").forEach(svg => {
    // Symbole übergehen: Ein 24×24-Zeichen hat absichtlich Luft im Rahmen,
    // damit alle Zeichen gleich groß wirken. Gemeint sind hier die großen
    // Datengrafiken, bei denen leere Fläche ein echter Fehler ist.
    if (svg.getBoundingClientRect().width < 60) return;
    const schilder = [...svg.querySelectorAll(".kreis-schild")].map(kastenVon);
    const pole = [...svg.querySelectorAll(".kreis-pol, .orgn")].map(kastenVon);
    let ss = 0, sk = 0;
    for (let i = 0; i < schilder.length; i++) {
      for (let j = i + 1; j < schilder.length; j++) if (ueber(schilder[i], schilder[j])) ss++;
      for (const p of pole) if (ueber(schilder[i], p)) sk++;
    }
    if (ss || sk) raus.schilder.push({ klasse: svg.getAttribute("class"), untereinander: ss, aufKasten: sk });

    // 4 · Leerraum
    const bb = svg.getBBox();
    const vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && bb.width > 0) {
      const genutzt = (bb.width * bb.height) / (vb[2] * vb[3]);
      if (genutzt < 0.45) raus.leerraum.push({
        klasse: svg.getAttribute("class"),
        genutzt: Math.round(genutzt * 100)
      });
    }
  });

  // 5 · Tippziele
  // Ausgenommen ist, was im Fließtext steht: ein verlinktes Wort mitten im Satz
  // kann nicht 44 px hoch sein, ohne die Zeile auseinanderzureißen. Die WCAG
  // nimmt genau diesen Fall ausdrücklich aus (2.5.8, „inline exception").
  // .begriff und .par sind namentlich dabei, weil Chrome einen <button> auch
  // dann als inline-block rechnet, wenn display:inline dransteht.
  document.querySelectorAll("a[href], button:not(:disabled), input, select, textarea")
    .forEach(el => {
      const cs = getComputedStyle(el);
      if (!el.offsetParent && cs.position !== "fixed") return;
      if (cs.display === "inline" || cs.visibility === "hidden") return;
      if (el.classList.contains("begriff") || el.classList.contains("par")) return;
      if (el.closest(".sprung")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      if (r.height + 0.5 < TIPPZIEL) raus.tippziel.push({
        was: el.tagName.toLowerCase() + "." + (el.className || "").toString().slice(0, 28),
        text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 32),
        hoch: Math.round(r.height)
      });
    });

  // 6 · Überlauf — nichts darf das Fenster seitlich sprengen
  const w = document.documentElement;
  if (w.scrollWidth > window.innerWidth + 2) {
    let schuldig = "";
    document.querySelectorAll("body *").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 2 && r.width > 40 && !schuldig) {
        schuldig = el.tagName.toLowerCase() + "." + (el.className || "").toString().slice(0, 30);
      }
    });
    raus.ueberlauf.push({ breit: w.scrollWidth, fenster: window.innerWidth, wer: schuldig });
  }

  return raus;
}
"""


def sichtbarer_text(pg):
    return pg.evaluate("() => document.body.innerText")


class Stiller(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def server():
    """Kurzlebiger Server auf einem freien Port — die App holt ihren Inhalt per
    fetch, und das lässt kein Browser von file:// aus zu."""
    dienst = socketserver.TCPServer(
        ("127.0.0.1", 0),
        functools.partial(Stiller, directory=str(AUSGABE)))
    threading.Thread(target=dienst.serve_forever, daemon=True).start()
    return dienst, f"http://127.0.0.1:{dienst.server_address[1]}"


def messe(pg, wo, gesehen, befunde):
    r = pg.evaluate(JS_PRUEFUNG, TIPPZIEL)

    def einmal(*schluessel):
        if schluessel in gesehen:
            return False
        gesehen.add(schluessel)
        return True

    for k in r["kontrast"]:
        if einmal("kontrast", k["klasse"], k["text"]):
            befunde.append(f"  [Lesbarkeit] {wo}: Kontrast {k['wert']} (nötig {k['soll']}) "
                           f"— »{k['text']}« in .{k['klasse']}")
    for u in r["ueberlappung"]:
        if einmal("ueber", u["oben"], u["unten"]):
            befunde.append(f"  [Überlappung] {wo}: .{u['oben']} liegt über »{u['unten']}«")
    for s in r["schilder"]:
        if einmal("schild", s["klasse"]):
            befunde.append(f"  [Grafik] {wo}: {s['untereinander']} Beschriftungen "
                           f"überlagern sich, {s['aufKasten']} liegen auf Kästen")
    for l in r["leerraum"]:
        if einmal("leer", l["klasse"]):
            befunde.append(f"  [Leerraum] {wo}: Zeichenfläche nur zu {l['genutzt']} % genutzt")
    for t in r["tippziel"]:
        if einmal("tipp", t["was"], t["text"]):
            befunde.append(f"  [Tippziel] {wo}: {t['hoch']} px hoch (nötig {TIPPZIEL}) "
                           f"— »{t['text']}« in {t['was']}")
    for u in r["ueberlauf"]:
        if einmal("ueberlauf", u["wer"]):
            befunde.append(f"  [Überlauf] {wo}: Seite {u['breit']} px breit bei "
                           f"{u['fenster']} px Fenster — Verursacher: {u['wer']}")


def pruefe_seite(pg, wurzel, datei, marke, befunde, gesehen):
    pg.goto(f"{wurzel}/{datei}", wait_until="networkidle")
    pg.wait_for_timeout(400)

    if datei == "app.html":
        # Die App hat keine [data-zu]-Kapitel, sondern fünf Schirme
        stellen = ["heute", "lernen", "ueben", "suche", "ich"]
    else:
        stellen = pg.evaluate(
            "() => [...new Set([...document.querySelectorAll('[data-zu]')]"
            ".map(e => e.dataset.zu))].filter(x => x !== 'start')") or [None]

    for kap in stellen:
        if kap and datei == "app.html":
            pg.evaluate("id => { location.hash = '#' + id; }", kap)
            pg.wait_for_timeout(400)
        elif kap:
            try:
                pg.locator(f'[data-zu="{kap}"]').first.click(timeout=4000)
            except Exception:
                continue
            pg.wait_for_timeout(1100)
        else:
            pg.evaluate("() => document.querySelectorAll('.rein')"
                        ".forEach(e=>e.classList.add('da'))")
            pg.wait_for_timeout(400)

        messe(pg, f"{datei}{' · ' + kap if kap else ''} {marke}", gesehen, befunde)


def pruefe_marke_und_quelle(pg, wurzel, datei):
    """Was weder an der Fenstergröße noch an der Farbstimmung hängt — einmal
    genügt: verbotene Wörter, Emojis, unaufgelöste Verweise, Prüf-Marker."""
    befunde = []
    pg.goto(f"{wurzel}/{datei}", wait_until="networkidle")
    pg.wait_for_timeout(300)
    text = sichtbarer_text(pg).lower()
    for w in VERBOTEN:
        if w in text:
            befunde.append(f"  [Marke] {datei}: verbotenes Wort »{w}« im sichtbaren Text")
    if re.search(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", sichtbarer_text(pg)):
        befunde.append(f"  [Marke] {datei}: Emoji im sichtbaren Text")

    roh = (AUSGABE / datei).read_text(encoding="utf-8")
    # Datenblöcke ausklammern — auch die mit Attributen (id="karten-daten").
    # Darin steht Rohtext mit Auszeichnung, der erst im Browser umgesetzt wird.
    ohne_daten = re.sub(r'<script type="application/json"[^>]*>.*?</script>', "", roh, flags=re.S)
    offen = re.findall(r"\{\{[^}]+\}\}", ohne_daten)
    if offen:
        befunde.append(f"  [Inhalt] {datei}: {len(offen)} unaufgelöste Verweise, z. B. {offen[0]}")
    marker = roh.count('class="pruefmarke')
    hinweise = []
    if marker:
        hinweise.append(f"  [Hinweis] {datei}: {marker} offene Prüf-Marker")
    return befunde, hinweise


def main():
    argumente = [a for a in sys.argv[1:] if not a.startswith("--")]
    schnell = "--schnell" in sys.argv
    dateien = argumente or [f.name for f in sorted(AUSGABE.glob("*.html"))
                            if "prototyp" not in f.name]

    ansichten = ANSICHTEN[:1] if schnell else ANSICHTEN
    stimmungen = STIMMUNGEN[:1] if schnell else STIMMUNGEN

    alle, infos = [], []
    dienst, wurzel = server()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            for ansicht, breite, hoehe in ansichten:
                for stimmung in stimmungen:
                    print(f"· {ansicht} {breite}×{hoehe}, {stimmung}")
                    pg = b.new_page(viewport={"width": breite, "height": hoehe},
                                    color_scheme=stimmung, device_scale_factor=1)
                    # Frischer Speicher je Durchlauf — sonst prüft der zweite
                    # einen Fortschritt, den der erste erzeugt hat.
                    pg.add_init_script("try{localStorage.clear()}catch(e){}")
                    gesehen = set()
                    for d in dateien:
                        pruefe_seite(pg, wurzel, d, f"[{ansicht}/{stimmung}]", alle, gesehen)
                    pg.close()

            pg = b.new_page(viewport={"width": 1440, "height": 1100})
            for d in dateien:
                f, h = pruefe_marke_und_quelle(pg, wurzel, d)
                alle += f
                infos += h
            pg.close()
            b.close()
    finally:
        dienst.shutdown()

    zeilen = list(infos)
    if alle:
        zeilen += [""] + alle + ["", f"  {len(alle)} Fehler, {len(infos)} Hinweise."]
    else:
        zeilen += ["", "  Keine Fehler. Freigabe möglich"
                   + (" — die Hinweise oben bleiben zu klären." if infos else ".")]

    for z in zeilen:
        print(z)

    # Der Durchlauf dauert Minuten. Wer ihn über eine Umleitung mitschreiben
    # will, verliert das Ergebnis an der ersten falschen Anführungszeichenkette —
    # also legt der Bericht sich selbst ab.
    bericht = HIER / "pruefbericht.txt"
    bericht.write_text("\n".join(zeilen) + "\n", encoding="utf-8")
    print(f"\n  Bericht: {bericht}")
    return 1 if alle else 0


if __name__ == "__main__":
    sys.exit(main())
