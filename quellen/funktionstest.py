#!/usr/bin/env python3
"""
AzubiPass · Funktionstest

    python3 funktionstest.py

pruefe.py schaut, ob es gut aussieht. Das hier schaut, ob es funktioniert:
Sprungverteiler und Zurück-Taste, Kommazahlen in den Rechnern, ein Konto statt
dreizehn, Karten an Kennungen statt an Positionen, die fünf Schirme der App,
Suche, Sicherung, dunkle Stimmung, die Übernahme des alten Bestands und das
Lesen ohne Netz.

Das erste ist eine Meinung über Aussehen, das zweite eine Tatsache über
Verhalten. Beides braucht man.
"""
import functools
import http.server
import json
import re
import socketserver
import sys
import tempfile
import threading
from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

from gemeinsames import AUSGABE as SEITE

ergebnisse = []


def pruefe(name, bedingung, zusatz=""):
    ergebnisse.append((name, bool(bedingung), zusatz))
    print(f"  {'OK  ' if bedingung else 'FEHL'} {name}{'  ' + str(zusatz) if zusatz else ''}")


# ------------------------------------------------------------------ Konto bauen
#
# Der Startbildschirm entscheidet aus dem Konto heraus, welches Kapitel dran
# ist. Diese Entscheidung lässt sich nicht durch Klicken herstellen — man
# müsste 74 Kapitel durchlesen, um den Fall „alles fertig" zu erreichen. Also
# wird das Konto direkt gesetzt und danach geprüft, was die App daraus macht.

INHALT = json.loads((SEITE / "mittel" / "inhalt.json").read_text(encoding="utf-8"))
KAPITEL = [(lf["id"], k["id"], lf["titel"], k["titel"])
           for lf in INHALT["lernfelder"] for k in lf["kapitel"]]

AUFGABEN_DATEI = SEITE / "mittel" / "aufgaben.json"
AUFGABEN = json.loads(AUFGABEN_DATEI.read_text(encoding="utf-8")) \
    if AUFGABEN_DATEI.exists() else None


def tag(versatz):
    return (date.today() + timedelta(days=versatz)).isoformat()


def kuerzel(lf_id):
    """Dieselbe Kurzform, die app.js vor die Fortschrittsreihe setzt."""
    return lf_id.upper() if re.fullmatch(r"lf\d+", lf_id) else lf_id[:4].upper()


def erledigt():
    return {"ziele": [], "checks": {}, "zuordnen": {}, "test": {}, "fertig": True}


def konto(fertig=(), zuletzt=None, termin=None, faellige_karten=None):
    """Ein Konto im gewünschten Zustand.

    faellige_karten=None heißt: nichts eintragen — dann sind alle Karten fällig,
    weil kern.js für unbekannte Karten auf heute zurückfällt. Eine Zahl legt
    genau so viele auf heute und schiebt den Rest in die Zukunft."""
    karten = {}
    if faellige_karten is not None:
        for i, k in enumerate(INHALT["karten"]):
            karten[k["id"]] = {"fach": 1, "fehler": 0,
                               "faellig": tag(0) if i < faellige_karten else tag(30)}
    return {
        "version": 1,
        "fortschritt": {s: erledigt() for s in fertig},
        "karten": karten, "quiz": {}, "lesezeichen": [],
        "aktivitaet": [], "zuletzt": zuletzt, "pruefungstermin": termin,
        "stimmung": "system", "uebernommen": False,
    }


def app_mit(b, w, k, farbe="light"):
    """Frischer Browser-Kontext mit vorbereitetem Konto.

    Bewusst kein add_init_script: Das liefe bei jedem Neuladen erneut und würde
    genau den Test unmöglich machen, der prüft, ob etwas ein Neuladen übersteht."""
    ktx = b.new_context(viewport={"width": 390, "height": 844},
                        locale="de-DE", color_scheme=farbe, accept_downloads=True)
    pg = ktx.new_page()
    pg.goto(f"{w}/app.html")
    pg.evaluate("k => { localStorage.clear(); "
                "localStorage.setItem('azubipass:konto', k); }", json.dumps(k))
    pg.goto(f"{w}/app.html", wait_until="networkidle")
    pg.wait_for_timeout(700)
    return ktx, pg


def heutetext(pg):
    return pg.locator("#heute").inner_text()


class Stiller(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


# ------------------------------------------------- Eigene Probeklausur · Daten
#
# Was sich ohne Browser prüfen lässt, wird ohne Browser geprüft: Ein fehlendes
# Konto oder ein Baustein ohne Punkte ist eine Tatsache über die Datei, keine
# Frage an die Darstellung.

def schluessel(s):
    s = str(s).lower()
    for alt, neu in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(alt, neu)
    return re.sub(r"[^a-z0-9]", "", s)


def probeklausur_daten():
    print("\n· Probeklausur · Aufgabenbestand")
    if not AUFGABEN:
        pruefe("mittel/aufgaben.json wurde gebaut", False, "Datei fehlt")
        return
    pruefe("mittel/aufgaben.json wurde gebaut", True)

    bausteine = AUFGABEN["bausteine"]
    kapitel = AUFGABEN["kapitel"]
    buch = [k for k in kapitel if k["lernfeld"] == "buchfuehrung"]
    buch_b = [b for b in bausteine if b["lernfeld"] == "buchfuehrung"]

    pruefe("Neun Buchführungskapitel mit Aufgaben", len(buch) == 9, len(buch))
    kennungen = [b["id"] for b in buch_b]
    pruefe("45 eindeutige Baustein-Kennungen",
           len(kennungen) == 45 and len(set(kennungen)) == 45,
           f"{len(kennungen)} Bausteine, {len(set(kennungen))} verschieden")
    pruefe("Jeder Baustein hat Punkte und Dauer",
           all(b.get("punkte") and b.get("dauer_min") for b in bausteine))
    zu_wenig = [k["schluessel"] for k in buch if k["bausteine"] < 5]
    pruefe("Jedes Kapitel hat mindestens fünf Bausteine", not zu_wenig, zu_wenig)

    eng = []
    for k in buch:
        bereiche = {b["anforderungsbereich"] for b in buch_b
                    if b["kapitel"] == k["kapitel"]}
        if len(bereiche) < 2:
            eng.append(k["schluessel"])
    pruefe("Jedes Kapitel deckt mindestens zwei Anforderungsbereiche ab", not eng, eng)

    # Konten
    index = {}
    for k in AUFGABEN["kontenplan"]:
        index[k["nr"]] = k
        index[schluessel(k["name"])] = k
        for a in k.get("alias", []):
            index[schluessel(a)] = k
    offen = []
    for b in bausteine:
        for e in b.get("eingabe") or []:
            if e.get("block") != "buchungssatz":
                continue
            for z in e.get("loesung") or []:
                for seite in ("soll", "haben"):
                    wert = z.get(seite)
                    if wert in (None, ""):
                        continue
                    if wert not in index and schluessel(wert) not in index:
                        offen.append(f'{b["id"]}:{wert}')
    pruefe("Jede Kontonummer oder Kontenbezeichnung ist auflösbar", not offen, offen)

    # Belege
    fehlend = []
    for b in bausteine:
        for a in b.get("anzeige") or []:
            if a.get("beleg") and a["beleg"] not in AUFGABEN["belege"]:
                fehlend.append(f'{b["id"]}:{a["beleg"]}')
    pruefe("Jede Belegreferenz hat eine Vorlage", not fehlend, fehlend)
    pruefe("Belegvorlagen sind mitgebaut",
           all(v.get("html") for v in AUFGABEN["belege"].values()),
           list(AUFGABEN["belege"]))

    # Verweise
    bekannt = {e["id"] for e in INHALT["begriffe"]}
    tot = []
    for b in bausteine:
        for art, kennung in re.findall(r"\{\{(begriff|par):([a-z0-9-]+)\|",
                                       json.dumps(b, ensure_ascii=False)):
            if kennung not in bekannt:
                tot.append(f'{b["id"]}:{art}:{kennung}')
    pruefe("Alle Begriffs- und Paragraphenverweise sind auflösbar", not tot, tot)

    roh = AUFGABEN_DATEI.read_text(encoding="utf-8")
    pruefe("Keine hinweis_konto-Merkzettel mehr im Bestand",
           "hinweis_konto" not in roh)

    # Renderer
    renderer = (Path(__file__).parent / "aufgaben.js").read_text(encoding="utf-8")
    unbekannt = []
    for b in bausteine:
        for e in b.get("eingabe") or []:
            if f'e.block === "{e["block"]}"' not in renderer:
                unbekannt.append("eingabe:" + e["block"])
        for a in b.get("anzeige") or []:
            if f'a.block === "{a["block"]}"' not in renderer:
                unbekannt.append("anzeige:" + a["block"])
    pruefe("Alle vorkommenden Block-Typen kennt der Renderer",
           not unbekannt, sorted(set(unbekannt)))


def probeklausur_build():
    print("\n· Probeklausur · Build und Offline")
    sw = (SEITE / "sw.js").read_text(encoding="utf-8")
    pruefe("Aufgabenbestand steht im Offline-Vorrat", "mittel/aufgaben.json" in sw)
    pruefe("Renderer steht im Offline-Vorrat", "mittel/aufgaben.js" in sw)
    pruefe("Kein Verweis auf den Wegwerf-Prototyp",
           "vorschau-aufgaben" not in sw
           and not (SEITE / "vorschau-aufgaben.html").exists())
    pruefe("App bindet den Renderer ein",
           "mittel/aufgaben.js" in (SEITE / "app.html").read_text(encoding="utf-8"))

    # Reproduzierbar: derselbe Quellstand ergibt denselben Bestand. Verglichen
    # wird ohne das Baudatum — das ist absichtlich jedes Mal neu.
    import subprocess
    vorher = json.loads(AUFGABEN_DATEI.read_text(encoding="utf-8"))
    lauf = subprocess.run([sys.executable, "build_app.py"],
                          cwd=str(Path(__file__).parent),
                          capture_output=True, text=True)
    nachher = json.loads(AUFGABEN_DATEI.read_text(encoding="utf-8"))
    vorher.pop("gebaut", None)
    nachher.pop("gebaut", None)
    pruefe("Build läuft ohne Fehler durch", lauf.returncode == 0,
           lauf.stdout.strip().splitlines()[-1:] if lauf.returncode else "")
    pruefe("Build ist reproduzierbar", vorher == nachher)


# ------------------------------------------------- Eigene Probeklausur · Logik
#
# Rechner, Ziehungen und Zusammensteller laufen im Browser. Sie hier in Python
# nachzubauen hieße, zwei Fassungen derselben Regeln zu pflegen — und geprüft
# wäre dann die Python-Fassung, nicht die, die der Nutzer bedient.

LOGIK = r"""
async () => {
  const P = window.APK.pruefstand;
  await P.laden();
  const V = P.vorrat();
  const raus = {};

  // --- Variablen -----------------------------------------------------------
  const variabel = V.bausteine.filter(b => b.variablen);
  let schlecht = [], unplausibel = [], schritt_falsch = [], abgeleitet_falsch = [];
  let bedingung_falsch = [];
  for (const b of variabel) {
    for (let s = 0; s < 100; s++) {
      let w;
      try { w = P.werteZiehen(b, "test-" + s); }
      catch (e) { schlecht.push(b.id + ": " + e.message); break; }
      for (const [name, v] of Object.entries(b.variablen)) {
        if (typeof v !== "object" || v === null || v.von === undefined) continue;
        if (w[name] < v.von || w[name] > v.bis) unplausibel.push(b.id + "." + name);
        const schritt = v.schritt || 1;
        if (Math.abs((w[name] - v.von) % schritt) > 1e-6) {
          schritt_falsch.push(b.id + "." + name);
        }
      }
      for (const [name, formel] of Object.entries(b.abgeleitet || {})) {
        if (Math.abs(P.rechne(formel, w) - w[name]) > 1e-6) {
          abgeleitet_falsch.push(b.id + "." + name);
        }
      }
      if (b.pruefung_variablen && P.rechne(b.pruefung_variablen, w) !== true) {
        bedingung_falsch.push(b.id);
      }
      for (const [name, wert] of Object.entries(w)) {
        if (wert < 0 || !isFinite(wert)) unplausibel.push(b.id + "." + name + "=" + wert);
      }
    }
  }
  raus.variabel_zahl = variabel.length;
  raus.ziehung_fehler = schlecht.slice(0, 4);
  raus.unplausibel = [...new Set(unplausibel)].slice(0, 4);
  raus.schritt_falsch = [...new Set(schritt_falsch)].slice(0, 4);
  raus.abgeleitet_falsch = [...new Set(abgeleitet_falsch)].slice(0, 4);
  raus.bedingung_falsch = [...new Set(bedingung_falsch)].slice(0, 4);

  // Derselbe Seed, dieselben Werte
  const einer = variabel[0];
  raus.seed_gleich = JSON.stringify(P.werteZiehen(einer, "gleich"))
                  === JSON.stringify(P.werteZiehen(einer, "gleich"));

  // Unbekannte Ausdrücke fliegen auf
  const boese = ["alert(1)", "window.location", "ak; drop", "1 + unbekannt", "eval(x)"];
  raus.abgelehnt = boese.every(a => {
    try { P.rechne(a, { ak: 1 }); return false; } catch (e) { return true; }
  });
  raus.rechnet = Math.abs(P.rechne("runde(1000 / 3, 2)", {}) - 333.33) < 1e-9;

  // --- Zusammensteller -----------------------------------------------------
  const alle = V.kapitel.map(k => k.schluessel);
  const zwei = alle.slice(0, 2);

  const a1 = P.stelleZusammen({ kapitel: zwei, dauer: 45, seed: "S1" });
  raus.nur_gewaehlt = a1.aufgaben.every(id =>
    zwei.indexOf(P.baustein(id).lernfeld + ":" + P.baustein(id).kapitel) !== -1);
  raus.keine_doppelte = new Set(a1.aufgaben).size === a1.aufgaben.length;

  const a2 = P.stelleZusammen({ kapitel: alle, dauer: 90, seed: "S2" });
  raus.abdeckung = new Set(a2.aufgaben.map(id =>
    P.baustein(id).lernfeld + ":" + P.baustein(id).kapitel)).size === alle.length;
  raus.dauer_gehalten = a2.minuten <= 90;
  raus.dauer_genutzt = a2.minuten >= 90 * 0.8;
  raus.typenmischung = new Set(a2.aufgaben.flatMap(id =>
    P.baustein(id).eingabe.map(e => e.block))).size >= 4;

  const kurz = P.stelleZusammen({ kapitel: alle, dauer: 15, seed: "S3" });
  raus.zu_kurz = kurz.fehler === "zu_kurz" && kurz.mindestdauer > 15;

  const leer = P.stelleZusammen({ kapitel: [], dauer: 60, seed: "S4" });
  raus.leer_abgelehnt = leer.fehler === "leer" && leer.aufgaben.length === 0;

  const g1 = P.stelleZusammen({ kapitel: alle, dauer: 90, seed: "gleich" });
  const g2 = P.stelleZusammen({ kapitel: alle, dauer: 90, seed: "gleich" });
  raus.seed_klausur_gleich = JSON.stringify(g1.aufgaben) === JSON.stringify(g2.aufgaben);

  let anders = 0;
  for (let i = 0; i < 8; i++) {
    const v = P.stelleZusammen({ kapitel: alle, dauer: 90, seed: "neu" + i,
                                 vorher: g1.aufgaben });
    if (JSON.stringify(v.aufgaben) !== JSON.stringify(g1.aufgaben)) anders++;
  }
  raus.neue_variante = anders >= 7;

  // --- Zahlen lesen --------------------------------------------------------
  raus.komma = P.zahlLesen("1.234,56") === 1234.56
            && P.zahlLesen("1234.56") === 1234.56
            && P.zahlLesen("1.500") === 1500
            && P.zahlLesen("12,5") === 12.5
            && P.zahlLesen("quatsch") === null;

  // --- Konten --------------------------------------------------------------
  raus.konto_nummer = (P.konto("2800") || {}).nr === "2800";
  raus.konto_name = (P.konto("Guthaben bei Kreditinstituten") || {}).nr === "2800";
  raus.konto_alias = (P.konto("Bank") || {}).nr === "2800";
  raus.konto_liste = (P.konto("2800 — Guthaben bei Kreditinstituten") || {}).nr === "2800";
  raus.konto_unsinn = P.konto("Gibtsnicht") === null;

  return raus;
}
"""


def probeklausur_logik(pg):
    print("\n· Probeklausur · Rechner, Ziehungen, Zusammensteller")
    r = pg.evaluate(LOGIK)

    pruefe("100 Ziehungen je variablem Baustein ohne Fehler",
           not r["ziehung_fehler"], r["ziehung_fehler"])
    pruefe("Keine negativen oder unplausiblen Werte",
           not r["unplausibel"], r["unplausibel"])
    pruefe("Schrittweiten werden eingehalten",
           not r["schritt_falsch"], r["schritt_falsch"])
    pruefe("Abgeleitete Werte stimmen", not r["abgeleitet_falsch"], r["abgeleitet_falsch"])
    pruefe("Prüfbedingungen werden eingehalten",
           not r["bedingung_falsch"], r["bedingung_falsch"])
    pruefe("Derselbe Seed erzeugt dieselben Werte", r["seed_gleich"])
    pruefe("Unbekannte Ausdrücke werden abgelehnt", r["abgelehnt"])
    pruefe("Der Rechner rechnet richtig", r["rechnet"])

    pruefe("Nur Aufgaben aus gewählten Kapiteln", r["nur_gewaehlt"])
    pruefe("Keine Aufgabe doppelt", r["keine_doppelte"])
    pruefe("Alle gewählten Kapitel kommen vor", r["abdeckung"])
    pruefe("Dauerziel wird nicht überschritten", r["dauer_gehalten"])
    pruefe("Dauerziel wird weitgehend ausgenutzt", r["dauer_genutzt"])
    pruefe("Sinnvolle Typenmischung", r["typenmischung"])
    pruefe("Zu kurze Dauer wird ehrlich gemeldet", r["zu_kurz"])
    pruefe("Leere Auswahl lässt sich nicht starten", r["leer_abgelehnt"])
    pruefe("Identischer Seed erzeugt identische Klausur", r["seed_klausur_gleich"])
    pruefe("Neuer Seed erzeugt eine andere Variante", r["neue_variante"])

    pruefe("Zahlen mit Komma und Punkt werden gelesen", r["komma"])
    pruefe("Konto über die Nummer auflösbar", r["konto_nummer"])
    pruefe("Konto über die Bezeichnung auflösbar", r["konto_name"])
    pruefe("Konto über die Schulbezeichnung auflösbar", r["konto_alias"])
    pruefe("Konto aus der Vervollständigung auflösbar", r["konto_liste"])
    pruefe("Unbekanntes Konto bleibt unbekannt", r["konto_unsinn"])


BEWERTUNG = r"""
async () => {
  const P = window.APK.pruefstand;
  await P.laden();
  const V = P.vorrat();
  const raus = {};
  const finde = (pruef) => V.bausteine.find(pruef);

  // Eine Klausur aus genau einem Baustein bauen und die Antworten setzen
  function stelle(b, antworten, selbst) {
    const werte = P.werteZiehen(b, "bewertung");
    localStorage.setItem("azubipass:probeklausur:v1", JSON.stringify({
      v: 1, seed: "bewertung", kapitel: [b.lernfeld + ":" + b.kapitel], dauer: 60,
      ende: null, gestartet: true, abgegeben: true, aufgaben: [b.id],
      werte: { [b.id]: werte }, antworten: { [b.id]: antworten(werte) },
      markiert: [], aktuell: 0, selbst: selbst ? { [b.id]: selbst } : {},
      vorher: [], abgelaufen: false
    }));
    return werte;
  }

  // Zahl mit Dezimalkomma und Folgefehler (K1-03: Vermögen, Schulden, EK)
  const zahlB = finde(b => b.id === "buchfuehrung-k1-03");
  let w = stelle(zahlB, w => ({ 0: String(w.vermoegen).replace(".", ","),
                                1: String(w.schulden).replace(".", ","),
                                2: String(w.eigenkapital) }));
  raus.zahl_voll = P.bewerte(zahlB.id).punkte === zahlB.punkte;

  // Folgefehler: Vermögen falsch, Eigenkapital passend zum eigenen Wert
  w = stelle(zahlB, w => ({ 0: String(w.vermoegen + 1000), 1: String(w.schulden),
                            2: String(w.vermoegen + 1000 - w.schulden) }));
  const ff = P.bewerte(zahlB.id);
  raus.folgefehler = ff.punkte === zahlB.punkte - 2;

  // Teilpunkte Zuordnung
  const zuB = finde(b => b.eingabe.some(e => e.block === "zuordnung")
                      && b.bewertung.punkte_je_treffer);
  const zuBlock = zuB.eingabe.findIndex(e => e.block === "zuordnung");
  stelle(zuB, () => ({ [zuBlock]: Object.fromEntries(
    zuB.eingabe[zuBlock].elemente.map((x, i) =>
      [i, i === 0 ? "%%falsch%%" : x.loesung])) }));
  const zuE = P.bewerte(zuB.id);
  raus.zuordnung_teil = zuE.punkte
    === (zuB.eingabe[zuBlock].elemente.length - 1) * zuB.bewertung.punkte_je_treffer;

  // Reihenfolge
  const rfB = finde(b => b.eingabe.some(e => e.block === "reihenfolge"));
  const rfI = rfB.eingabe.findIndex(e => e.block === "reihenfolge");
  const richtig = [];
  rfB.eingabe[rfI].elemente.forEach((x, i) => { richtig[x.position - 1] = i; });
  stelle(rfB, () => ({ [rfI]: richtig }));
  raus.reihenfolge_voll =
    P.bewerte(rfB.id).punkte === rfB.punkte;
  stelle(rfB, () => ({ [rfI]: richtig.slice().reverse() }));
  raus.reihenfolge_falsch =
    P.bewerte(rfB.id).punkte < rfB.punkte;

  // Auswahl
  const awB = finde(b => b.eingabe.length === 1 && b.eingabe[0].block === "auswahl");
  stelle(awB, () => ({ 0: awB.eingabe[0].optionen.findIndex(o => o.richtig) }));
  raus.auswahl_richtig =
    P.bewerte(awB.id).punkte === awB.punkte;
  stelle(awB, () => ({ 0: awB.eingabe[0].optionen.findIndex(o => !o.richtig) }));
  raus.auswahl_falsch = P.bewerte(awB.id).punkte === 0;

  // Buchungssatz: vollständig, in vertauschter Zeilenfolge
  const bsB = finde(b => b.id === "buchfuehrung-k3-02");
  const bsI = bsB.eingabe.findIndex(e => e.block === "buchungssatz");
  function satz(w, umgedreht) {
    const zeilen = bsB.eingabe[bsI].loesung.map(z => {
      const seite = z.soll != null ? "soll" : "haben";
      return { seite: seite, konto: String(z[seite]),
               betrag: String(w[z.betrag]) };
    });
    return umgedreht ? zeilen.slice().reverse() : zeilen;
  }
  stelle(bsB, w => ({ [bsI]: satz(w, false) }));
  raus.buchungssatz_voll =
    P.bewerte(bsB.id).punkte === bsB.punkte;
  stelle(bsB, w => ({ [bsI]: satz(w, true) }));
  raus.buchungssatz_vertauscht =
    P.bewerte(bsB.id).punkte === bsB.punkte;
  stelle(bsB, w => ({ [bsI]: satz(w, false).map((z, i) =>
    i === 0 ? { seite: z.seite, konto: z.konto, betrag: "" } : z) }));
  const teil = P.bewerte(bsB.id);
  raus.buchungssatz_teil = teil.punkte > 0 && teil.punkte < bsB.punkte;

  // Offene Antwort: ohne Haken null, mit Haken genau die Kriterienpunkte
  const offB = finde(b => b.bewertung.art === "selbstbewertung");
  const offI = offB.eingabe.findIndex(e => e.block === "textfeld");
  stelle(offB, () => ({ [offI]: "Irgendein Text, der alles behauptet." }));
  raus.offen_null = P.bewerte(offB.id).punkte === 0;
  stelle(offB, () => ({ [offI]: "Irgendein Text." }),
         offB.bewertung.raster.map((_, i) => i === 0));
  raus.offen_kriterium =
    P.bewerte(offB.id).punkte === offB.bewertung.raster[0].punkte;

  // Kapitelwerte ergeben zusammen den Gesamtwert
  const alle = V.kapitel.map(k => k.schluessel);
  const klausur = P.stelleZusammen({ kapitel: alle, dauer: 90, seed: "summe" });
  const werte = {}, antworten = {};
  klausur.aufgaben.forEach(id => { werte[id] = P.werteZiehen(P.baustein(id), "summe"); });
  localStorage.setItem("azubipass:probeklausur:v1", JSON.stringify({
    v: 1, seed: "summe", kapitel: alle, dauer: 90, ende: null, gestartet: true,
    abgegeben: true, aufgaben: klausur.aufgaben, werte: werte, antworten: antworten,
    markiert: [], aktuell: 0, selbst: {}, vorher: [], abgelaufen: false
  }));
  const ges = P.ergebnis();
  raus.summe_stimmt =
    Math.abs(ges.kapitel.reduce((s, k) => s + k.moeglich, 0) - ges.moeglich) < 1e-9
    && Math.abs(ges.kapitel.reduce((s, k) => s + k.erreicht, 0) - ges.erreicht) < 1e-9;
  raus.leer_null = ges.erreicht === 0;

  localStorage.removeItem("azubipass:probeklausur:v1");
  return raus;
}
"""


def probeklausur_bewertung(pg):
    print("\n· Probeklausur · Bewertung")
    r = pg.evaluate(BEWERTUNG)
    pruefe("Zahlenbewertung einschließlich Dezimalkomma", r["zahl_voll"])
    pruefe("Folgefehler wird anerkannt", r["folgefehler"])
    pruefe("Auswahl richtig gibt volle Punkte", r["auswahl_richtig"])
    pruefe("Auswahl falsch gibt keine Punkte", r["auswahl_falsch"])
    pruefe("Zuordnung mit Teilpunkten", r["zuordnung_teil"])
    pruefe("Reihenfolge richtig gibt volle Punkte", r["reihenfolge_voll"])
    pruefe("Falsche Reihenfolge gibt weniger", r["reihenfolge_falsch"])
    pruefe("Buchungssatz vollständig richtig", r["buchungssatz_voll"])
    pruefe("Vertauschte Buchungszeilen kosten nichts", r["buchungssatz_vertauscht"])
    pruefe("Buchungssatz mit fehlendem Betrag gibt Teilpunkte", r["buchungssatz_teil"])
    pruefe("Offene Antwort zählt ohne Selbstbewertung null", r["offen_null"])
    pruefe("Selbstbewertung zählt genau die abgehakten Kriterien", r["offen_kriterium"])
    pruefe("Kapitelwerte ergeben zusammen den Gesamtwert", r["summe_stimmt"])
    pruefe("Ohne Antworten gibt es keine Punkte", r["leer_null"])


def probeklausur_klausur(b, w):
    """Der Klausurmodus im Browser: keine Lösungen, Antworten bleiben, Neuladen
    stellt wieder her, Verwerfen betrifft nur die Klausur."""
    print("\n· Probeklausur · Klausurmodus")
    ktx = b.new_context(viewport={"width": 390, "height": 844}, locale="de-DE")
    pg = ktx.new_page()
    pg.goto(f"{w}/app.html")
    pg.evaluate("k => { localStorage.clear(); "
                "localStorage.setItem('azubipass:konto', k); }",
                json.dumps(konto(fertig=["lf10-k1"])))
    pg.goto(f"{w}/app.html#ueben", wait_until="networkidle")
    pg.wait_for_timeout(900)

    pg.get_by_text("Eigene Probeklausur").click()
    pg.wait_for_timeout(900)
    pruefe("Einstieg unter Üben führt zur Kapitelwahl",
           pg.locator("#ueben .pk--kapitel").count() > 0)
    pruefe("Nur Kapitel mit Aufgaben stehen zur Wahl",
           pg.locator("#ueben .pk--gruppe").count() == 1,
           pg.locator("#ueben .pk--gruppe").count())

    pg.locator("#ueben .pk--gruppenalle").click()
    pg.get_by_role("button", name="90 Min.").click()
    pg.wait_for_timeout(200)
    pruefe("Auswahl prüfen ist erst mit Kapiteln möglich",
           not pg.locator(".pk--zonknopf").is_disabled())
    pg.locator(".pk--zonknopf").click()
    pg.wait_for_timeout(400)
    # Kleinschreibung vergleichen: Etliche Beschriftungen stehen per CSS in
    # Versalien, und inner_text liefert genau das, was zu sehen ist.
    zus = pg.locator("#ueben").inner_text().lower()
    pruefe("Zusammenfassung nennt Aufgaben, Punkte und Zeit",
           "aufgaben" in zus and "punkte" in zus and "bearbeitungszeit" in zus)
    pruefe("Zusammenfassung sagt, dass keine Lösungen gezeigt werden",
           "keine lösungen" in zus)
    pruefe("Der Timer läuft vor dem Start noch nicht",
           pg.locator("#pk-uhr").count() == 0)

    pg.get_by_role("button", name="Probeklausur starten").click()
    pg.wait_for_timeout(700)
    pruefe("Die Klausur beginnt mit Aufgabe 1",
           "aufgabe 1 von" in pg.locator("#ueben").inner_text().lower())
    pruefe("Der Timer läuft", pg.locator("#pk-uhr").count() == 1)

    text = pg.locator("#ueben").inner_text()
    pruefe("Keine Musterlösung vor der Abgabe",
           "Musterlösung" not in text
           and pg.locator("#ueben .pk--loesung").count() == 0)
    pruefe("Keine Erklärung vor der Abgabe",
           pg.locator("#ueben .pk--erklaerung").count() == 0)
    pruefe("Keine Richtigkeitsanzeige während der Bearbeitung",
           pg.locator("#ueben .pk--marke").count() == 0)

    # Antwort setzen, blättern, zurück — bleibt sie stehen?
    pg.evaluate("""() => {
      const o = JSON.parse(localStorage.getItem('azubipass:probeklausur:v1'));
      o.aktuell = o.aufgaben.findIndex(id =>
        window.APK.pruefstand.baustein(id).eingabe.some(e => e.block === 'zahl'));
      localStorage.setItem('azubipass:probeklausur:v1', JSON.stringify(o));
      location.reload();
    }""")
    pg.wait_for_timeout(1200)
    feld = pg.locator("#ueben .pk--zahlfeld").first
    feld.fill("1234,56")
    pg.wait_for_timeout(300)
    stand_vorher = pg.locator("#pk-uhr").inner_text()
    pg.get_by_role("button", name="Weiter ›").click()
    pg.wait_for_timeout(400)
    pg.get_by_role("button", name="‹ Zurück").click()
    pg.wait_for_timeout(400)
    pruefe("Antworten bleiben beim Aufgabenwechsel erhalten",
           pg.locator("#ueben .pk--zahlfeld").first.input_value() == "1234,56")

    pg.get_by_role("button", name="☆ Später ansehen").click()
    pg.wait_for_timeout(300)
    pruefe("Markierung wird gesetzt",
           pg.get_by_role("button", name="★ Gemerkt").count() == 1)

    ende_vorher = pg.evaluate(
        "() => JSON.parse(localStorage.getItem('azubipass:probeklausur:v1')).ende")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(1400)
    pruefe("Neuladen stellt die laufende Klausur wieder her",
           "aufgabe" in pg.locator("#ueben").inner_text().lower()
           and pg.locator("#pk-uhr").count() == 1,
           pg.locator("#ueben").inner_text().split("\n")[:3])
    pruefe("Antwort übersteht das Neuladen",
           pg.locator("#ueben .pk--zahlfeld").first.input_value() == "1234,56")
    pruefe("Markierung übersteht das Neuladen",
           pg.get_by_role("button", name="★ Gemerkt").count() == 1)
    pruefe("Der Timer wird durch Neuladen nicht zurückgesetzt",
           pg.evaluate("() => JSON.parse(localStorage.getItem"
                       "('azubipass:probeklausur:v1')).ende") == ende_vorher
           and pg.locator("#pk-uhr").inner_text() <= stand_vorher,
           pg.locator("#pk-uhr").inner_text())

    # Abgelaufene Zeit löscht keine Eingaben
    pg.evaluate("""() => {
      const o = JSON.parse(localStorage.getItem('azubipass:probeklausur:v1'));
      o.ende = Date.now() + 1200;
      localStorage.setItem('azubipass:probeklausur:v1', JSON.stringify(o));
      location.reload();
    }""")
    pg.wait_for_timeout(3500)
    pruefe("Abgelaufene Zeit wird deutlich gesagt",
           "zeit ist abgelaufen" in pg.locator("#ueben").inner_text().lower())
    pruefe("Abgelaufene Zeit löscht keine Eingaben",
           "1234,56" in json.dumps(pg.evaluate(
               "() => JSON.parse(localStorage.getItem"
               "('azubipass:probeklausur:v1')).antworten")))

    # Warnung bei unbeantworteten Aufgaben und Abgabe
    pg.evaluate("() => { window.confirm = () => true; }")
    pg.get_by_role("button", name="Jetzt abgeben").click()
    pg.wait_for_timeout(900)
    aus = pg.locator("#ueben").inner_text()
    pruefe("Nach der Abgabe erscheint die Auswertung", "auswertung" in aus.lower())
    pruefe("Auswertung nennt Punkte und Prozent",
           "punkten" in aus.lower() and "%" in aus)
    # Kein Notenschlüssel: gesucht wird die Vergabe einer Note, nicht das Wort.
    pruefe("Auswertung nennt keine Note",
           not re.search(r"\bNote\s*[1-6]", aus))
    pruefe("Auswertung führt Kapitel einzeln auf",
           pg.locator("#pk-kapitel .reihe").count() > 0,
           pg.locator("#pk-kapitel .reihe").count())
    pruefe("Auswertung bietet eine neue Variante an",
           pg.get_by_role("button", name="Neue Variante erstellen").count() == 1)

    # Eine abgeschlossene Klausur kommt nicht als laufende zurück
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(1300)
    pg.get_by_text("Eigene Probeklausur").click()
    pg.wait_for_timeout(900)
    pruefe("Abgeschlossene Klausur wird nicht als laufende angezeigt",
           pg.locator("#pk-uhr").count() == 0
           and pg.locator("#ueben .pk--kapitel").count() > 0)

    # Verwerfen betrifft nur den Klausurzustand
    pg.evaluate("""() => {
      const o = JSON.parse(localStorage.getItem('azubipass:probeklausur:v1'));
      o.abgegeben = false; o.ende = Date.now() + 600000;
      localStorage.setItem('azubipass:probeklausur:v1', JSON.stringify(o));
      window.confirm = () => true;
    }""")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(1300)
    pg.evaluate("() => { window.confirm = () => true; }")
    pg.get_by_role("button", name="Später weiter").click()
    pg.wait_for_timeout(500)
    pg.get_by_role("button", name="Verwerfen").click()
    pg.wait_for_timeout(600)
    schluessel_danach = pg.evaluate(
        "() => Object.keys(localStorage).filter(k => k.startsWith('azubipass')).sort()")
    pruefe("Verwerfen entfernt nur den Klausurzustand",
           schluessel_danach == ["azubipass:konto"], schluessel_danach)
    pruefe("azubipass:konto bleibt unverändert erhalten",
           pg.evaluate("() => JSON.parse(localStorage.getItem('azubipass:konto'))"
                       ".fortschritt['lf10-k1'].fertig") is True)

    # Beschädigter Zustand führt nicht zum Absturz
    pg.evaluate("() => localStorage.setItem('azubipass:probeklausur:v1', '{kaputt')")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(1300)
    pg.get_by_text("Eigene Probeklausur").click()
    pg.wait_for_timeout(900)
    pruefe("Beschädigter Klausurzustand führt zu einem verständlichen Zustand",
           pg.locator("#ueben .pk--kapitel").count() > 0)
    ktx.close()


def kapitelroute(b, w):
    """Der direkte Weg aus einem Kapitel in die Probeklausur.

        app.html#ueben/probeklausur?kapitel=<lernfeld>:<kapitel>

    Eine gültige Kennung wählt vor. Eine unbekannte darf keinen Fehler
    erzeugen, keine Ansicht zerlegen und nichts Gespeichertes anfassen."""
    print("\n· Probeklausur · Weg aus dem Kapitel")
    ktx = b.new_context(viewport={"width": 390, "height": 844}, locale="de-DE")
    pg = ktx.new_page()
    fehler = []
    pg.on("pageerror", lambda e: fehler.append(str(e)))
    pg.goto(f"{w}/app.html")
    pg.evaluate("k => { localStorage.clear(); "
                "localStorage.setItem('azubipass:konto', k); }", json.dumps(konto()))

    # Die Aktion steht im Kapitel und zeigt auf genau diese Adresse
    pg.goto(f"{w}/buchfuehrung.html#k3", wait_until="networkidle")
    pg.wait_for_timeout(700)
    aktion = pg.locator("#k3 .weiter-pk")
    pruefe("Kapitel bietet 'Dieses Kapitel als Probeklausur üben'",
           aktion.count() == 1, aktion.count())
    ziel = aktion.first.get_attribute("href") if aktion.count() else ""
    pruefe("Die Aktion zeigt auf die Kapitelroute",
           ziel == "app.html#ueben/probeklausur?kapitel=buchfuehrung:k3", ziel)

    # Gültige Kennung
    pg.goto(f"{w}/app.html#ueben/probeklausur?kapitel=buchfuehrung:k3",
            wait_until="networkidle")
    pg.wait_for_timeout(1100)
    pruefe("Gültige Kennung öffnet die Probeklausur",
           pg.locator("#ueben .pk--kapitel").count() > 0)
    gewaehlt = pg.evaluate(
        "() => Array.from(document.querySelectorAll('#ueben .pk--kapitel'))"
        ".filter(l => l.querySelector('input').checked)"
        ".map(l => l.querySelector('.pk--kapitelnr').textContent)")
    pruefe("Genau das gemeinte Kapitel ist vorgewählt", gewaehlt == ["K3"], gewaehlt)
    pruefe("Die Vorwahl wird sichtbar gesagt",
           pg.locator("#ueben .pk--vorwahl").count() == 1)
    pruefe("Die Auswahl nennt die ungefähre Aufgabenzahl",
           "aufgaben" in pg.locator("#ueben .pk--zonetext").inner_text().lower(),
           pg.locator("#ueben .pk--zonetext").inner_text())

    # Unbekannte Kennung — mit echtem Neuladen. Ein Sprung von #…k3 auf #…k99
    # wechselt nur die Raute; die Seite bliebe dieselbe und die vorige Auswahl
    # stünde noch. Geprüft wird aber der Fall „jemand öffnet einen kaputten
    # Link", und der beginnt bei null.
    vorher = pg.evaluate("() => localStorage.getItem('azubipass:konto')")
    pg.goto(f"{w}/app.html#ueben/probeklausur?kapitel=gibtsnicht:k99",
            wait_until="networkidle")
    pg.reload(wait_until="networkidle")
    pg.wait_for_timeout(1100)
    pruefe("Unbekannte Kennung öffnet die normale Auswahl",
           pg.locator("#ueben .pk--kapitel").count() > 0)
    pruefe("Unbekannte Kennung wählt nichts vor",
           pg.evaluate("() => Array.from(document.querySelectorAll("
                       "'#ueben .pk--kapitel input')).every(i => !i.checked)"))
    pruefe("Unbekannte Kennung sagt nichts von einer Vorwahl",
           pg.locator("#ueben .pk--vorwahl").count() == 0)
    pruefe("Unbekannte Kennung erzeugt keinen Fehler", not fehler, fehler[:1])
    pruefe("Unbekannte Kennung ändert keine Nutzerdaten",
           pg.evaluate("() => localStorage.getItem('azubipass:konto')") == vorher)

    # Ohne Auswahl lässt sich nichts starten
    pruefe("Ohne Kapitel kann keine Klausur beginnen",
           pg.locator("#ueben .pk--zonknopf").is_disabled())

    # Vier Haupttabs, kein fünfter für das Kapitel
    for wo in ("app.html#ueben/probeklausur?kapitel=buchfuehrung:k3",
               "buchfuehrung.html#k3"):
        pg.goto(f"{w}/{wo}", wait_until="networkidle")
        pg.wait_for_timeout(600)
        pruefe(f"Genau vier Haupttabs ({wo.split('#')[0]})",
               pg.locator("nav.tableiste .tab").count() == 4,
               pg.locator("nav.tableiste .tab").count())
    beschriftung = pg.evaluate(
        "() => Array.from(document.querySelectorAll('nav.tableiste .tab span'))"
        ".map(s => s.textContent)")
    pruefe("Kein fünfter Kapitel-Tab",
           beschriftung == ["Heute", "Lernen", "Üben", "Ich"], beschriftung)
    ktx.close()


def hervorhebungen(b, w):
    """Der halbhohe Textmarker ist weg, die Begriffe sind keine gepunkteten
    Linien mehr, und beide lassen sich mit dem Daumen treffen."""
    print("\n· Kapitel · Hervorhebungen")
    ktx = b.new_context(viewport={"width": 390, "height": 844}, locale="de-DE")
    pg = ktx.new_page()
    pg.goto(f"{w}/buchfuehrung.html#k3", wait_until="networkidle")
    pg.wait_for_timeout(800)

    m = pg.evaluate("""() => {
      const e = document.querySelector('.kapitel:not([hidden]) mark');
      if (!e) return null;
      const cs = getComputedStyle(e);
      return {bild: cs.backgroundImage, grund: cs.backgroundColor,
              klon: cs.boxDecorationBreak || cs.webkitBoxDecorationBreak,
              radius: parseFloat(cs.borderTopLeftRadius),
              pad: parseFloat(cs.paddingLeft)};
    }""")
    pruefe("Eine wichtige Aussage ist im Kapitel vorhanden", m is not None)
    if m:
        pruefe("Kein halbhoher Verlauf mehr", m["bild"] == "none", m["bild"])
        pruefe("Die Fläche liegt unter der ganzen Phrase",
               m["grund"] != "rgba(0, 0, 0, 0)", m["grund"])
        pruefe("Die Fläche bricht mit der Zeile mit", m["klon"] == "clone", m["klon"])
        pruefe("Höchstens 2 px Radius", m["radius"] <= 2, m["radius"])
        pruefe("Kleiner waagerechter Innenabstand", m["pad"] > 0, m["pad"])

    t = pg.evaluate("""() => {
      const raus = {};
      for (const k of ['begriff', 'par']) {
        const e = document.querySelector('.kapitel:not([hidden]) .' + k);
        if (!e) { raus[k] = null; continue; }
        const cs = getComputedStyle(e), af = getComputedStyle(e, '::after');
        raus[k] = {stil: cs.borderBottomStyle + '|' + cs.borderTopStyle,
                   gewicht: cs.fontWeight, schrift: cs.fontFamily,
                   zielHoehe: parseFloat(af.height), zielLage: af.position};
      }
      return raus;
    }""")
    pruefe("Ein anklickbarer Begriff ist vorhanden", t["begriff"] is not None)
    if t["begriff"]:
        pruefe("Begriff ohne gepunktete Linie",
               "dotted" not in t["begriff"]["stil"], t["begriff"]["stil"])
        pruefe("Begriff ist halbfett",
               int(t["begriff"]["gewicht"]) >= 600, t["begriff"]["gewicht"])
        pruefe("Begriff hat ein 44-px-Bedienziel",
               t["begriff"]["zielLage"] == "absolute"
               and t["begriff"]["zielHoehe"] >= 44, t["begriff"]["zielHoehe"])

    pg.goto(f"{w}/lf4.html#k4", wait_until="networkidle")
    pg.wait_for_timeout(800)
    par = pg.evaluate("""() => {
      const e = document.querySelector('.kapitel:not([hidden]) .par');
      if (!e) return null;
      const cs = getComputedStyle(e), af = getComputedStyle(e, '::after');
      return {stil: cs.borderBottomStyle, schrift: cs.fontFamily,
              grund: cs.backgroundColor, zielHoehe: parseFloat(af.height),
              zielLage: af.position};
    }""")
    pruefe("Eine Paragraphenkennung ist vorhanden", par is not None)
    if par:
        pruefe("Paragraph ohne gepunktete Linie", par["stil"] != "dotted", par["stil"])
        pruefe("Paragraph steht in Mono", "Mono" in par["schrift"], par["schrift"])
        pruefe("Paragraph hat eine eigene Fläche",
               par["grund"] != "rgba(0, 0, 0, 0)", par["grund"])
        pruefe("Paragraph hat ein 44-px-Bedienziel",
               par["zielLage"] == "absolute" and par["zielHoehe"] >= 44,
               par["zielHoehe"])

    # Suchtreffer müssen sich von der fachlichen Hervorhebung unterscheiden
    pg.goto(f"{w}/app.html#suche", wait_until="networkidle")
    pg.wait_for_timeout(700)
    pg.locator("#suche input").fill("Bilanz")
    pg.wait_for_timeout(700)
    unterschied = pg.evaluate("""() => {
      const e = document.querySelector('#suche .such-treffer');
      if (!e) return null;
      const cs = getComputedStyle(e);
      return {grund: cs.backgroundColor, gewicht: cs.fontWeight};
    }""")
    pruefe("Suchtreffer haben eine eigene Klasse", unterschied is not None)
    if unterschied:
        pruefe("Suchtreffer sind eine kräftige Vollfläche",
               unterschied["grund"] == "rgb(201, 162, 39)", unterschied["grund"])
    ktx.close()


def aufgaben_fehlen(b, w):
    """Fehlende oder beschädigte Aufgabendaten führen zu einem verständlichen
    Zustand — nicht zu einer kaputten Ansicht."""
    print("\n· Probeklausur · Aufgabendaten fehlen")
    for fall, antwort in (("fehlend", None), ("beschaedigt", "{kaputt")):
        ktx = b.new_context(viewport={"width": 390, "height": 844}, locale="de-DE")
        pg = ktx.new_page()
        fehler = []
        pg.on("pageerror", lambda e: fehler.append(str(e)))
        if antwort is None:
            pg.route("**/mittel/aufgaben.json", lambda r: r.fulfill(status=404, body=""))
        else:
            pg.route("**/mittel/aufgaben.json",
                     lambda r: r.fulfill(status=200, body=antwort,
                                         content_type="application/json"))
        pg.goto(f"{w}/app.html")
        pg.evaluate("k => { localStorage.clear(); "
                    "localStorage.setItem('azubipass:konto', k); }", json.dumps(konto()))
        pg.goto(f"{w}/app.html#ueben/probeklausur", wait_until="networkidle")
        pg.wait_for_timeout(1400)
        text = pg.locator("#ueben").inner_text().lower()
        pruefe(f"Aufgabendaten {fall}: verständliche Meldung statt leerer Seite",
               "nicht gefunden" in text or "aufgaben" in text, text[:70])
        pruefe(f"Aufgabendaten {fall}: ein Weg zurück bleibt",
               pg.locator("#ueben .pk--zurueck").count() > 0
               or pg.locator("nav.tableiste .tab").count() == 4)
        pruefe(f"Aufgabendaten {fall}: azubipass:konto bleibt unberührt",
               pg.evaluate("() => localStorage.getItem('azubipass:konto')") is not None)
        pruefe(f"Aufgabendaten {fall}: kein unbehandelter Fehler",
               not fehler, fehler[:1])
        ktx.close()


def schriften_ortlich(b, w):
    """Die Schriften kommen vom eigenen Server, nicht von Google."""
    print("\n· Schriften")
    ktx = b.new_context(viewport={"width": 390, "height": 844}, locale="de-DE")
    pg = ktx.new_page()
    fremd = []
    pg.on("request", lambda r: fremd.append(r.url)
          if "fonts.googleapis" in r.url or "fonts.gstatic" in r.url else None)
    pg.goto(f"{w}/app.html", wait_until="networkidle")
    pg.wait_for_timeout(900)
    pruefe("Keine Schriftanfrage nach außen", not fremd, fremd[:1])
    geladen = pg.evaluate(
        "() => Array.from(document.fonts).map(f => f.family)")
    for name in ("Source Serif 4", "IBM Plex Sans", "IBM Plex Mono"):
        pruefe(f"{name} wird örtlich ausgeliefert", name in geladen)
    ktx.close()


def main():
    dienst = socketserver.TCPServer(
        ("127.0.0.1", 0), functools.partial(Stiller, directory=str(SEITE)))
    threading.Thread(target=dienst.serve_forever, daemon=True).start()
    w = f"http://127.0.0.1:{dienst.server_address[1]}"

    with sync_playwright() as p:
        b = p.chromium.launch()
        ktx = b.new_context(viewport={"width": 390, "height": 844},
                            locale="de-DE", accept_downloads=True)
        pg = ktx.new_page()

        # ---------------------------------------------------------- Lernzettel
        print("\n· Lernzettel lf10")
        pg.goto(f"{w}/lf10.html", wait_until="networkidle")
        pruefe("Deckblatt sichtbar", pg.locator("#start").is_visible())

        # Kapitel über die Adresse — der Sprungverteiler
        pg.evaluate("location.hash = '#k1'")
        pg.wait_for_timeout(700)
        pruefe("Kapitel per Adresse erreichbar", pg.locator("#k1").is_visible())
        pruefe("Adresse hat sich geändert", "#k1" in pg.url, pg.url)

        # Zurück-Taste des Browsers
        pg.go_back()
        pg.wait_for_timeout(600)
        pruefe("Zurück-Taste führt aufs Deckblatt", pg.locator("#start").is_visible())

        pg.evaluate("location.hash = '#k4'")
        pg.wait_for_timeout(900)

        # Lesezeichen
        pg.locator("#merken").click()
        pg.wait_for_timeout(600)
        pruefe("Lesezeichen gesetzt",
               pg.locator("#merken").get_attribute("aria-pressed") == "true")

        # Kommazahl im Rechner
        felder = pg.locator("#k4 .lz input")
        if felder.count() > 1:
            feld = felder.nth(1)
            pruefe("Rechenfeld nimmt Zahlentastatur",
                   feld.get_attribute("inputmode") == "decimal")
            feld.fill("12,5")
            pg.wait_for_timeout(400)
            wert = pg.evaluate(
                "() => document.querySelector('#k4 .lz.ende .lz-wert').textContent")
            pruefe("Komma wird gerechnet", "—" not in wert and wert.strip() != "", wert)

        # Check beantworten → Fortschritt
        checks = pg.locator("#k4 .check .opt")
        if checks.count():
            checks.first.click()
            pg.wait_for_timeout(700)
            pruefe("Check-Antwort im Konto gespeichert", pg.evaluate(
                "() => { const k = JSON.parse(localStorage.getItem('azubipass:konto')||'{}');"
                "return Object.keys(k.fortschritt||{}).some(s => "
                "Object.keys(k.fortschritt[s].checks||{}).length > 0); }"))

        # Ein Konto statt dreizehn
        schluessel = pg.evaluate(
            "() => Object.keys(localStorage).filter(k => k.startsWith('azubipass'))")
        pruefe("Genau ein Speichereintrag", schluessel == ["azubipass:konto"], schluessel)

        # Karten-Kennungen statt Positionen
        pruefe("Karten hängen an Kennungen", pg.evaluate(
            "() => { const d = JSON.parse(document.getElementById('karten-daten').textContent);"
            "return d.length > 0 && d.every(k => typeof k.id === 'string' && k.id.includes('-')); }"))

        # Trainer
        pg.evaluate("location.hash = '#trainer'")
        pg.wait_for_timeout(900)
        pruefe("Trainer zeigt eine Karte", pg.locator(".tr-frage").count() > 0)
        pg.locator(".tr-seite .dreher").click()
        pg.wait_for_timeout(400)
        pg.locator(".tr-gewusst").click()
        pg.wait_for_timeout(600)
        karten = pg.evaluate(
            "() => JSON.parse(localStorage.getItem('azubipass:konto')).karten")
        pruefe("Nur die bewertete Karte wird eingetragen", len(karten) == 1, karten)
        eine = list(karten.values())[0] if karten else None
        pruefe("Karte rückt ein Fach vor", eine and eine.get("fach") == 2, eine)
        pruefe("Karte bekommt ein Fälligkeitsdatum in der Zukunft",
               eine and eine.get("faellig") and eine["faellig"] > "2026-08-07",
               eine.get("faellig") if eine else None)

        # ---------------------------------------------------------- App
        print("\n· App")
        pg.goto(f"{w}/app.html", wait_until="networkidle")
        pg.wait_for_timeout(700)
        text = pg.locator("#heute").inner_text()
        pruefe("Hauptaktion führt ins zuletzt gelesene Kapitel",
               "Kapitel fortsetzen" in text, text.split("\n")[:4])
        pruefe("Countdown steht auf der Startseite",
               "Abschlussprüfung" in text and "Tage" in text)
        pruefe("Keine Begrüßungsfloskel mehr", "Guten Tag" not in text)

        for schirm in ["lernen", "ueben", "suche", "ich"]:
            pg.evaluate(f"location.hash = '#{schirm}'")
            pg.wait_for_timeout(600)
            pruefe(f"Schirm {schirm} baut sich auf",
                   len(pg.locator(f"#{schirm}").inner_text().strip()) > 40)

        # Suche
        pg.evaluate("location.hash = '#suche'")
        pg.wait_for_timeout(500)
        pg.locator("#suche input").fill("Skonto")
        pg.wait_for_timeout(1400)
        treffer = pg.locator("#suche .reihe").count()
        pruefe("Suche findet Treffer", treffer > 0, f"{treffer} Zeilen")
        zahl = pg.locator("#suche .such-zahl").inner_text()
        pruefe("Trefferzahl wird angezeigt", "Treffer" in zahl, zahl)

        # Lesezeichen sichtbar
        pg.evaluate("location.hash = '#ich'")
        pg.wait_for_timeout(700)
        pruefe("Lesezeichen erscheint unter Ich",
               "K4" in pg.locator("#ich").inner_text())

        # Export
        with pg.expect_download() as d:
            pg.get_by_text("Fortschritt sichern").click()
        datei = d.value
        pruefe("Sicherung wird heruntergeladen",
               datei.suggested_filename.startswith("azubipass-fortschritt-"),
               datei.suggested_filename)

        # Dark Mode über den Schalter
        pg.get_by_role("button", name="Dunkel", exact=True).click()
        pg.wait_for_timeout(500)
        pruefe("Dunkel-Schalter wirkt",
               pg.evaluate("() => document.documentElement.dataset.stimmung") == "dunkel")
        # Der Schalter wirkt dort, wo gelesen wird. Die vier App-Schirme tragen
        # in beiden Stimmungen dieselbe tiefgrüne Fläche; nachgewiesen wird die
        # Einstellung deshalb auf der Lesefläche des Kapitels und nicht auf
        # „Ich". Gespeichert ist sie im selben Konto, also überlebt sie den
        # Seitenwechsel.
        pg.goto(f"{w}/lf10.html#k1")
        pg.wait_for_timeout(700)
        grund = pg.evaluate(
            "() => getComputedStyle(document.body).backgroundColor")
        pruefe("Seite ist wirklich dunkel", grund in ("rgb(20, 22, 20)",), grund)

        # Übernahme aus alten Einträgen
        print("\n· Übernahme des alten Bestands")
        ktx2 = b.new_context(viewport={"width": 390, "height": 844}, locale="de-DE")
        pg2 = ktx2.new_page()
        pg2.goto(f"{w}/lf10.html")
        pg2.evaluate("""() => {
          localStorage.clear();
          localStorage.setItem('azubipass:lf10', JSON.stringify({
            '#kap': 'k2',
            k2: { a: 1, ziele: ['b1','b2'], checks: {0:1}, test: {}, zuordnen: {} },
            karten: { 0: 3, 1: 2 }
          }));
        }""")
        pg2.goto(f"{w}/app.html", wait_until="networkidle")
        pg2.wait_for_timeout(800)
        uebernommen = pg2.evaluate(
            "() => JSON.parse(localStorage.getItem('azubipass:konto'))")
        pruefe("Alter Fortschritt wird übernommen",
               "lf10-k2" in (uebernommen.get("fortschritt") or {}))
        pruefe("Alte Lernziele bleiben erhalten",
               (uebernommen["fortschritt"].get("lf10-k2") or {}).get("ziele") == ["b1", "b2"])
        pruefe("Verrutschter Kartenstand wird NICHT mitgenommen",
               not uebernommen.get("karten"))
        pruefe("Übernahme wird dem Nutzer gesagt",
               "übernommen" in pg2.locator("#heute").inner_text().lower())

        # ---------------------------------------------------------- Heute
        print("\n· Startbildschirm · welches Kapitel ist dran")

        lf0, k0, lft0, kt0 = KAPITEL[0]
        lf1, k1, lft1, kt1 = KAPITEL[1]
        lfz, kz, lftz, ktz = KAPITEL[-1]

        # A · Noch nie etwas geöffnet
        ktxA, pgA = app_mit(b, w, konto())
        t = heutetext(pgA)
        pruefe("Neuer Nutzer: Erstes Kapitel starten", "Erstes Kapitel starten" in t)
        pruefe("Neuer Nutzer: erstes Kapitel des ersten Lernfelds", kt0 in t, kt0)
        pruefe("Neuer Nutzer: Fortschritt 0", f"0 von {len(KAPITEL)}" in t, t[-90:])
        pruefe("Neuer Nutzer: keine erfundene Aktivität", "An 0 von 7 Tagen gelernt" in t)
        ktxA.close()

        # B · Mittendrin, das zuletzt geöffnete Kapitel ist noch offen
        ktxB, pgB = app_mit(b, w, konto(
            fertig=[f"{lf0}-{k0}"],
            zuletzt={"zu": f"{lf1}.html#{k1}", "lernfeld": lf1, "kapitel": k1,
                     "titel": "veralteter Titel aus dem Konto", "nummer": "K99"}))
        t = heutetext(pgB)
        pruefe("Aktiver Nutzer: Kapitel fortsetzen", "Kapitel fortsetzen" in t)
        pruefe("Aktiver Nutzer: genau das offene Kapitel", kt1 in t, kt1)
        pruefe("Titel kommt aus inhalt.json, nicht aus dem Konto",
               "veralteter Titel" not in t and "K99" not in t)
        pruefe("Hauptaktion zeigt auf dieses Kapitel",
               pgB.locator("#heute .hm-kapitel").get_attribute("href")
               == f"{lf1}.html#{k1}")
        ktxB.close()

        # C · Das zuletzt geöffnete Kapitel ist fertig
        ktxC, pgC = app_mit(b, w, konto(
            fertig=[f"{lf0}-{k0}"],
            zuletzt={"zu": f"{lf0}.html#{k0}", "lernfeld": lf0, "kapitel": k0}))
        t = heutetext(pgC)
        pruefe("Fertiges letztes Kapitel: nächstes Kapitel starten",
               "Nächstes Kapitel starten" in t)
        pruefe("Kein Rücksprung in ein fertiges Kapitel", kt1 in t and kt0 not in t)
        ktxC.close()

        # D · Der Verweis zeigt ins Leere
        ktxD, pgD = app_mit(b, w, konto(
            zuletzt={"zu": "lf99.html#gibtsnicht", "lernfeld": "lf99",
                     "kapitel": "gibtsnicht", "titel": "entfernt"}))
        t = heutetext(pgD)
        pruefe("Ungültiger Verweis zerlegt den Schirm nicht", len(t.strip()) > 60)
        pruefe("Ungültiger Verweis fällt auf das erste offene Kapitel zurück",
               kt0 in t, t.split("\n")[:3])
        pruefe("Ungültiges Ziel wird nicht verlinkt",
               "lf99" not in pgD.locator("#heute .hm-kapitel").get_attribute("href"))
        ktxD.close()

        # E · Alles durch
        ktxE, pgE = app_mit(b, w, konto(
            fertig=[f"{a}-{c}" for a, c, _, _ in KAPITEL]))
        t = heutetext(pgE)
        pruefe("Alle Kapitel fertig: Prüfungstraining öffnen",
               "Prüfungstraining öffnen" in t)
        pruefe("Alle fertig: Ziel ist der Übungsteil",
               pgE.locator("#heute .hm-kapitel").get_attribute("href") == "app.html#ueben")
        pruefe("Alle fertig: Bilanz stimmt",
               f"{len(KAPITEL)} von {len(KAPITEL)} Kapiteln abgeschlossen" in t)
        ktxE.close()

        # F · Fortschrittsfeld: nicht der Reihe nach abgeschlossen
        print("\n· Startbildschirm · Fortschrittsfeld")
        ktxF, pgF = app_mit(b, w, konto(fertig=[f"{lfz}-{kz}"]))
        reihen = pgF.evaluate("""() => [...document.querySelectorAll('#heute .hm-reihe')]
            .map(r => ({ kuerzel: r.querySelector('.hm-kuerzel').textContent,
                         gesamt: r.querySelectorAll('.hm-strich').length,
                         voll: r.querySelectorAll('.hm-strich.voll').length }))""")
        pruefe("Eine Reihe je Lernfeld", len(reihen) == len(INHALT["lernfelder"]),
               len(reihen))
        pruefe("Ein Strich je Kapitel",
               sum(r["gesamt"] for r in reihen) == len(KAPITEL),
               sum(r["gesamt"] for r in reihen))
        letzte = [r for r in reihen if r["kuerzel"] == kuerzel(lfz)][0]
        erste = [r for r in reihen if r["kuerzel"] == kuerzel(lf0)][0]
        pruefe(f"Abgeschlossenes Kapitel erscheint in {kuerzel(lfz)}",
               letzte["voll"] == 1, letzte)
        pruefe("Und NICHT im ersten Lernfeld", erste["voll"] == 0, erste)
        pruefe("Fortschrittsfeld hat eine sprechende Beschriftung",
               f"1 von {len(KAPITEL)} Kapiteln abgeschlossen"
               in pgF.locator("#heute .hm-feld").get_attribute("aria-label"),
               pgF.locator("#heute .hm-feld").get_attribute("aria-label"))
        ktxF.close()

        # G · Karteikarten: 0, 1, viele
        print("\n· Startbildschirm · fällige Karten")
        for anzahl, erwartet in [(0, "Heute keine Karteikarten fällig"),
                                 (1, "1 Karte wartet"),
                                 (12, "12 Karten warten")]:
            ktxG, pgG = app_mit(b, w, konto(faellige_karten=anzahl))
            t = heutetext(pgG)
            pruefe(f"{anzahl} fällige Karten: »{erwartet}«", erwartet in t,
                   [z for z in t.split("\n") if "Karte" in z][:2])
            knopf = pgG.locator("#heute a.hm-pflicht").count()
            pruefe(f"{anzahl} fällige Karten: {'Link' if anzahl else 'kein toter Knopf'}",
                   (knopf > 0) == (anzahl > 0), knopf)
            ktxG.close()

        # H · Prüfungstermin
        print("\n· Prüfungstermin")
        standard = INHALT["pruefung"]
        ktxH, pgH = app_mit(b, w, konto())
        pruefe("Ohne eigenen Termin gilt der Standard aus landing.config.json",
               "Abschlussprüfung" in heutetext(pgH))

        pgH.evaluate("location.hash = '#ich'")
        pgH.wait_for_timeout(600)
        pgH.locator("#ich .terminfeld").fill(tag(40))
        pgH.get_by_role("button", name="Termin speichern").click()
        pgH.wait_for_timeout(600)
        pgH.evaluate("location.hash = '#heute'")
        pgH.wait_for_timeout(500)
        pruefe("Eigener Termin wirkt ohne Neuladen",
               "noch 40 Tage" in heutetext(pgH), heutetext(pgH).split("\n")[:2])

        pgH.reload(wait_until="networkidle")
        pgH.wait_for_timeout(800)
        pruefe("Eigener Termin übersteht das Neuladen",
               "noch 40 Tage" in heutetext(pgH))
        pruefe("Eigener Termin liegt im bestehenden Konto",
               pgH.evaluate("() => JSON.parse(localStorage.getItem"
                            "('azubipass:konto')).pruefungstermin") == tag(40))
        pruefe("Kein zweiter Speichereintrag", pgH.evaluate(
            "() => Object.keys(localStorage).filter(k => k.startsWith('azubipass'))")
            == ["azubipass:konto"])

        # Standard wiederherstellen
        pgH.evaluate("location.hash = '#ich'")
        pgH.wait_for_timeout(600)
        pgH.get_by_role("button", name="Standardtermin verwenden").click()
        pgH.wait_for_timeout(600)
        pruefe("Standardtermin lässt sich wiederherstellen",
               pgH.evaluate("() => JSON.parse(localStorage.getItem"
                            "('azubipass:konto')).pruefungstermin") is None)
        pgH.evaluate("location.hash = '#heute'")
        pgH.wait_for_timeout(500)
        pruefe("Nach dem Zurücksetzen rechnet der Countdown wieder mit dem Standard",
               f"noch {(date.fromisoformat(standard) - date.today()).days} Tage"
               in heutetext(pgH))
        ktxH.close()

        # I · Vergangener Termin
        ktxI, pgI = app_mit(b, w, konto(termin=tag(-12)))
        t = heutetext(pgI)
        pruefe("Vergangener Termin: Aufforderung statt Zahl",
               "Prüfungstermin aktualisieren" in t)
        pruefe("Vergangener Termin: keine negative Tageszahl",
               "-12" not in t and "noch -" not in t, t.split("\n")[:2])
        pruefe("Vergangener Termin führt zu den Einstellungen",
               pgI.locator("#heute .hm-zaehler-handeln").get_attribute("href")
               == "app.html#ich")
        ktxI.close()

        # J · Unbrauchbarer Termin fällt still auf den Standard zurück
        ktxJ, pgJ = app_mit(b, w, konto(termin="2026-02-31"))
        pruefe("Ungültiges Datum wird ignoriert, Standard greift",
               "Abschlussprüfung" in heutetext(pgJ)
               and "aktualisieren" not in heutetext(pgJ))
        ktxJ.close()

        # K · Sicherung nimmt den Termin mit
        print("\n· Sicherung mit Prüfungstermin")
        ktxK, pgK = app_mit(b, w, konto(termin=tag(55)))
        pgK.evaluate("location.hash = '#ich'")
        pgK.wait_for_timeout(700)
        with pgK.expect_download() as d:
            pgK.get_by_text("Fortschritt sichern").click()
        pfad = str(Path(tempfile.gettempdir()) / "azubipass-test-sicherung.json")
        d.value.save_as(pfad)
        gesichert = json.loads(Path(pfad).read_text(encoding="utf-8"))
        pruefe("Prüfungstermin steht in der Sicherungsdatei",
               gesichert.get("pruefungstermin") == tag(55),
               gesichert.get("pruefungstermin"))
        ktxK.close()

        ktxL, pgL = app_mit(b, w, konto())
        pgL.evaluate("location.hash = '#ich'")
        pgL.wait_for_timeout(700)
        pgL.locator("#ich input[type=file]").set_input_files(pfad)
        pgL.wait_for_timeout(1400)
        pruefe("Eingespielte Sicherung bringt den Termin mit",
               pgL.evaluate("() => JSON.parse(localStorage.getItem"
                            "('azubipass:konto')).pruefungstermin") == tag(55))
        pgL.evaluate("location.hash = '#heute'")
        pgL.wait_for_timeout(500)
        pruefe("Eingespielter Termin rechnet auf Heute",
               "noch 55 Tage" in heutetext(pgL))

        # Alles zurücksetzen entfernt ihn wieder
        pgL.evaluate("location.hash = '#ich'")
        pgL.wait_for_timeout(600)
        pgL.evaluate("() => { window.confirm = () => true; }")
        pgL.get_by_role("button", name="Alles zurücksetzen").click()
        pgL.wait_for_timeout(900)
        pruefe("Alles zurücksetzen entfernt den eigenen Termin",
               pgL.evaluate("() => JSON.parse(localStorage.getItem"
                            "('azubipass:konto') || '{}').pruefungstermin") in (None,))
        ktxL.close()

        # L · Die App-Welt bleibt in beiden Stimmungen dunkelgrün
        #
        # Vorher folgte Lernen der Stimmung und Heute nicht — die App zerfiel
        # dadurch in zwei Welten. Jetzt tragen alle vier Hauptbereiche dieselbe
        # tiefgrüne Fläche, und die Hell-/Dunkel-Einstellung gilt für die
        # Lesefläche im Kapitel, wo sie hingehört.
        print("\n· Farben")
        GRUEN = "rgb(18, 48, 31)"
        for farbe in ("light", "dark"):
            ktxM, pgM = app_mit(b, w, konto(), farbe=farbe)
            grund = pgM.evaluate(
                "() => getComputedStyle(document.body).backgroundColor")
            pruefe(f"Heute ist dunkelgrün ({farbe})", grund == GRUEN, grund)
            for bereich in ("lernen", "ueben", "ich"):
                pgM.evaluate(f"location.hash = '#{bereich}'")
                pgM.wait_for_timeout(400)
                jetzt = pgM.evaluate(
                    "() => getComputedStyle(document.body).backgroundColor")
                pruefe(f"{bereich.capitalize()} ist dieselbe grüne Welt ({farbe})",
                       jetzt == GRUEN, jetzt)
            pgM.evaluate("location.hash = '#heute'")
            pgM.wait_for_timeout(500)
            pruefe(f"Zurück auf Heute wieder grün ({farbe})",
                   pgM.evaluate("() => getComputedStyle(document.body).backgroundColor")
                   == GRUEN)
            # Das Kapitel dreht dagegen sehr wohl — sonst wäre die Einstellung
            # eine Einstellung ohne Wirkung.
            pgM.goto(f"{w}/lf10.html#k1")
            pgM.wait_for_timeout(600)
            lese = pgM.evaluate(
                "() => getComputedStyle(document.body).backgroundColor")
            pruefe(f"Kapitel folgt der Stimmung ({farbe})",
                   lese == ("rgb(245, 245, 240)" if farbe == "light"
                            else "rgb(20, 22, 20)"), lese)
            ktxM.close()

        # M · Inhalt lädt nicht
        #
        # Der dunkelgrüne Grund hängt an data-bereich, und das setzt erst der
        # Verteiler — der ohne inhalt.json nie startet. Genau richtig: Die
        # Fehlermeldung steht dadurch auf normalem Grund und bleibt lesbar,
        # statt in dunklem Grün zu verschwinden.
        print("\n· Inhalt nicht ladbar")
        ktxN = b.new_context(viewport={"width": 390, "height": 844}, locale="de-DE")
        ktxN.route("**/inhalt.json", lambda r: r.abort())
        pgN = ktxN.new_page()
        pgN.goto(f"{w}/app.html", wait_until="domcontentloaded")
        pgN.wait_for_timeout(1500)
        t = pgN.locator("#heute").inner_text()
        pruefe("Fehlende Inhalte erzeugen eine verständliche Meldung",
               "Inhalt nicht gefunden" in t, t.split("\n")[:1])
        pruefe("Fehlermeldung steht nicht auf dunklem Grund", pgN.evaluate(
            "() => getComputedStyle(document.body).backgroundColor") != "rgb(18, 48, 31)")
        ktxN.close()

        # ---------------------------------------------------------- Probeklausur
        probeklausur_daten()

        pgP = ktx.new_page()
        pgP.goto(f"{w}/app.html", wait_until="networkidle")
        pgP.wait_for_timeout(700)
        probeklausur_logik(pgP)
        probeklausur_bewertung(pgP)
        pgP.close()

        probeklausur_klausur(b, w)
        kapitelroute(b, w)
        hervorhebungen(b, w)
        aufgaben_fehlen(b, w)
        schriften_ortlich(b, w)

        # Service Worker
        print("\n· Offline")
        pg3 = ktx.new_page()
        pg3.goto(f"{w}/app.html", wait_until="networkidle")
        pg3.wait_for_timeout(2500)
        bereit = pg3.evaluate("() => navigator.serviceWorker.controller !== null")
        pruefe("Zwischenspeicher übernimmt", bereit)
        if bereit:
            pg3.context.set_offline(True)
            pg3.goto(f"{w}/lf3.html", wait_until="domcontentloaded")
            pg3.wait_for_timeout(900)
            pruefe("Lernzettel lädt ohne Netz",
                   pg3.locator("#start").count() > 0)
            pg3.context.set_offline(False)

        b.close()
    dienst.shutdown()

    # Zum Schluss, weil er neu baut: Vorher liefe der Server auf halb neuen
    # Dateien und die Offline-Prüfung oben würde unzuverlässig.
    probeklausur_build()

    fehl = [n for n, ok, _ in ergebnisse if not ok]
    print(f"\n  {len(ergebnisse) - len(fehl)} von {len(ergebnisse)} bestanden.")
    if fehl:
        print("  Durchgefallen:")
        for n in fehl:
            print(f"    · {n}")
    return 1 if fehl else 0


if __name__ == "__main__":
    sys.exit(main())
