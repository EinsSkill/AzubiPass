#!/usr/bin/env python3
"""
AzubiPass · App

    python3 build_app.py

Läuft nach build.py und macht aus den einzelnen Lernzetteln eine App:

    app.html               Startseite, Lernen, Üben, Suche, Ich
    manifest.webmanifest   damit sie sich auf den Homescreen legen lässt
    sw.js                  Zwischenspeicher, damit sie ohne Netz läuft
    mittel/inhalt.json     Lernfelder, Kapitel, Karten, Quizfragen
    mittel/suche.json      Volltext — getrennt, weil er nur beim Suchen gebraucht wird
    mittel/aufgaben.json   Aufgabenbausteine, Kontenplan und Belege der Probeklausur
    mittel/symbol.*        App-Symbol
    impressum.html         Pflichtangaben nach § 5 DDG
    datenschutz.html       Pflichtangaben nach Art. 13 DSGVO

Ein eigener Schritt und kein zweites Bausystem: Er liest nur, was die
Kapiteldateien ohnehin enthalten.
"""

import html
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

from build import karten_sammeln
from gemeinsames import (AUSGABE, LUPE, MARKE, MITTEL, fussleiste, kopf, lade,
                         lernfeld_dateien, rechtliches, schriften_lokal,
                         tableiste, veroeffentliche)

HIER = Path(__file__).parent
PLATZHALTER = "BITTE_AUSFUELLEN"


# ---------------------------------------------------------------- Text

def klartext(s):
    """Nimmt die Auszeichnung heraus — für Suche und Vorschau."""
    s = str(s or "")
    s = re.sub(r"\{\{(?:begriff|par):[a-z0-9-]+\|(.+?)\}\}", r"\1", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"(?<!\w)\*(.+?)\*(?!\w)", r"\1", s)
    s = re.sub(r"==(.+?)==", r"\1", s)
    return re.sub(r"\s+", " ", s).strip()


def bausteintext(b):
    """Alles, was in einem Baustein steht, als Fließtext."""
    t = b.get("typ")
    if t in ("absatz", "merke", "achtung", "praxistipp"):
        return [b.get("text", ""), b.get("karteikarte", "")]
    if t == "tabelle":
        raus = list(b.get("spalten", []))
        for z in b.get("zeilen", []):
            raus += list(z.get("zellen", [])) + [z.get("detail", "")]
        return raus
    if t == "vertiefung":
        return [b.get("titel", "")] + list(b.get("absaetze", []))
    if t == "check":
        return [b.get("frage", "")] + [o.get("text", "") for o in b.get("optionen", [])]
    if t == "zuordnen":
        return [b.get("lead", "")] + [a.get("text", "") for a in b.get("aufgaben", [])]
    if t == "grafik":
        return [b.get("titel", ""), b.get("lead", ""), b.get("regel", "")]
    return []


# ---------------------------------------------------------------- Sammeln

def quiz_sammeln(lf, kapitel_daten):
    """Die Checks und Zuordnungen als Übungsvorrat.

    Sie sind längst geschrieben — mit Frage, richtiger Antwort und einer
    Rückmeldung zu jeder falschen. Nur benutzt hat sie bisher niemand außerhalb
    des Kapitels, in dem sie stehen."""
    raus = []
    for ch in kapitel_daten:
        for a in ch["bloecke"]:
            zahl = {"c": 0, "z": 0}
            for b in a["inhalt"]:
                ort = f'{lf["id"]}-{ch["id"]}-{a["id"]}'
                gemeinsam = {
                    "lernfeld": lf["id"], "lernfeldTitel": lf["titel"],
                    "kapitel": f'K{ch["nummer"]} · {ch["titel"]}',
                    "zu": f'{lf["id"]}.html#{ch["id"]}',
                }
                if b["typ"] == "check":
                    zahl["c"] += 1
                    raus.append(dict(gemeinsam, art="check", id=f'{ort}-c{zahl["c"]}',
                                     frage=b["frage"],
                                     optionen=[{"text": o["text"],
                                                "richtig": bool(o.get("richtig")),
                                                "echo": o["echo"]}
                                               for o in b["optionen"]]))
                elif b["typ"] == "zuordnen":
                    zahl["z"] += 1
                    raus.append(dict(gemeinsam, art="zuordnen", id=f'{ort}-z{zahl["z"]}',
                                     frage=b["lead"],
                                     kategorien=b["kategorien"],
                                     aufgaben=[{"text": x["text"], "loesung": x["loesung"]}
                                               for x in b["aufgaben"]]))
    return raus


def tests_sammeln(lf, kapitel_daten):
    """Die offenen Selbsttestfragen. Ein Rechner kann sie nicht bewerten — aber
    „das wusste ich nicht" ist eine Selbsteinschätzung, und die ist für die
    Schwachstellenliste die ehrlichste Quelle, die es gibt."""
    return [{
        "id": f'{lf["id"]}-{ch["id"]}-t{i}',
        "frage": klartext(f["frage"]),
        "typ": f["typ"],
        "lernfeld": lf["id"], "lernfeldTitel": lf["titel"],
        "kapitel": f'K{ch["nummer"]} · {ch["titel"]}',
        "zu": f'{lf["id"]}.html#{ch["id"]}',
    } for ch in kapitel_daten for i, f in enumerate(ch["selbsttest"], 1)]


def suche_sammeln(lf, kapitel_daten):
    """Ein Eintrag pro Abschnitt — fein genug, um an die Stelle zu springen,
    grob genug, dass die Datei nicht ausufert."""
    raus = []
    for ch in kapitel_daten:
        for a in ch["bloecke"]:
            stuecke = []
            for b in a["inhalt"]:
                stuecke += [klartext(x) for x in bausteintext(b) if x]
            raus.append({
                "t": klartext(a["titel"]),
                "x": " ".join(s for s in stuecke if s),
                "lf": lf["id"], "lft": lf["titel"],
                "k": f'K{ch["nummer"]} · {klartext(ch["titel"])}',
                "zu": f'{lf["id"]}.html#{ch["id"]}-{a["id"]}',
            })
        raus.append({
            "t": "Zusammenfassung",
            "x": " ".join(klartext(s) for s in ch["zusammenfassung"])
                 + " " + klartext(ch["pruefungstipp"]),
            "lf": lf["id"], "lft": lf["titel"],
            "k": f'K{ch["nummer"]} · {klartext(ch["titel"])}',
            "zu": f'{lf["id"]}.html#{ch["id"]}',
        })
    return raus


def begriffe_sammeln(lf):
    """Begriffe und Paragraphen liegen zentral — daraus wird ein Lexikon,
    ohne dass jemand eine Zeile nachpflegt."""
    raus = []
    for art, feld in (("Begriff", "begriffe"), ("Gesetzestext", "paragraphen")):
        for schluessel, e in lf.get(feld, {}).items():
            raus.append({"art": art, "id": schluessel,
                         "titel": e["titel"], "text": e["text"]})
    return raus


# ---------------------------------------------------------------- Aufgabenvorrat
#
# Aus den *.aufgaben.json, dem Kontenplan und den Belegvorlagen wird eine
# einzige Datei für die App. Sie liegt unter mittel/ und wandert dadurch
# automatisch in den Offline-Vorrat — dieselbe Mechanik wie bei den Kapiteln.
#
# Der Build prüft dabei alles, was sich vorher prüfen lässt: Kontonummern,
# Belegverweise, Begriffe, Aufgabentypen und Formeln. Fällt hier etwas auf,
# bricht er ab. Ein Tippfehler in einer Kontonummer soll nicht erst dem
# Prüfling um Mitternacht auffallen.


class Aufgabenfehler(Exception):
    """Etwas in den Aufgabendaten stimmt nicht — mit Ansage, nicht mit Traceback."""


BELEGE = HIER / "belege"

ANZEIGE_BLOECKE = {"text", "tabelle", "anlage"}
EINGABE_BLOECKE = {"zahl", "auswahl", "zuordnung", "reihenfolge", "buchungssatz", "textfeld"}
FORMEL_FUNKTIONEN = {"runde", "abrunden", "aufrunden", "min", "max", "abs"}

# Dieselbe Zerlegung wie der Rechner in aufgaben.js. Hier wird nur geprüft, was
# vorkommen darf — gerechnet wird ausschließlich im Browser, damit es nicht zwei
# Rechner gibt, die auseinanderlaufen können.
MARKEN = re.compile(r"\s*(\d+\.?\d*|[A-Za-z_][A-Za-z0-9_]*|>=|<=|==|!=|&&|\|\||[-+*/(),<>])")


def formel_pruefen(ausdruck, bekannt, wo):
    """Nur Zahlen, bekannte Größen, freigegebene Zeichen und Funktionen."""
    rest, pos = str(ausdruck), 0
    while pos < len(rest):
        treffer = MARKEN.match(rest, pos)
        if not treffer:
            raise Aufgabenfehler(
                f"{wo}: unverständlicher Ausdruck „{ausdruck}“ ab Zeichen {pos + 1}")
        marke = treffer.group(1)
        pos = treffer.end()
        if marke[0].isdigit():
            continue
        if marke[0].isalpha() or marke[0] == "_":
            folgt = MARKEN.match(rest, pos)
            if folgt and folgt.group(1) == "(":
                if marke not in FORMEL_FUNKTIONEN:
                    raise Aufgabenfehler(f"{wo}: unbekannte Funktion „{marke}“ in „{ausdruck}“")
            elif marke not in bekannt:
                raise Aufgabenfehler(f"{wo}: unbekannte Größe „{marke}“ in „{ausdruck}“")
    return True


def kontenplan_lesen():
    datei = HIER / "musterunternehmen.json"
    if not datei.exists():
        return [], {}
    daten = json.loads(datei.read_text(encoding="utf-8"))
    konten, index = [], {}

    def schluessel(s):
        s = str(s).lower()
        for alt, neu in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
            s = s.replace(alt, neu)
        return re.sub(r"[^a-z0-9]", "", s)

    for klasse in daten.get("kontenplan", {}).get("klassen", []):
        for k in klasse.get("konten", []):
            eintrag = {"nr": k["nr"], "name": k["name"], "klasse": klasse["nummer"]}
            if k.get("alias"):
                eintrag["alias"] = k["alias"]
            konten.append(eintrag)
            index[k["nr"]] = eintrag
            index[schluessel(k["name"])] = eintrag
            for a in k.get("alias", []):
                index[schluessel(a)] = eintrag
    index["#schluessel"] = schluessel
    return konten, index


def konto_aufloesen(bezeichner, index):
    if bezeichner in (None, ""):
        return None
    roh = str(bezeichner).strip()
    return index.get(roh) or index.get(index["#schluessel"](roh))


def belegvorlagen():
    """Die HTML-Vorlagen und ihre Vorgaben. Ohne Ordner: keine Belege, kein Fehler."""
    if not BELEGE.is_dir():
        return {}, {}
    steuer = {}
    steuerdatei = BELEGE / "belege.json"
    if steuerdatei.exists():
        steuer = json.loads(steuerdatei.read_text(encoding="utf-8")).get("vorlagen", {})
    vorlagen = {}
    for pfad in sorted(BELEGE.glob("*.html")):
        name = pfad.stem
        s = steuer.get(name, {})
        roh = pfad.read_text(encoding="utf-8")
        # Der erklärende Kopfkommentar muss weg, bevor irgendetwas gesucht wird:
        # Er nennt die Wiederholungsmarken beispielhaft, und der Renderer würde
        # sonst dieses Beispiel füllen statt der echten Tabellenzeile.
        roh = re.sub(r"^\s*<!--.*?-->\s*", "", roh, count=1, flags=re.DOTALL)
        vorlagen[name] = {
            "html": roh,
            "marke": s.get("wiederholung", {}).get("marke"),
            "saldo_fortschreiben": bool(s.get("saldo_fortschreiben")),
        }
    return vorlagen, steuer


def beleg_fuellen(anlage, steuer, wo):
    """Vorgaben und Aufgabendaten zu einem flachen Satz Platzhalterwerte.

    Die Aufgabe nennt nur, worauf es fachlich ankommt. Rechnungsdatum, IBAN und
    Kundennummer stehen trotzdem auf dem Papier — die kommen aus belege.json.
    Werte können selbst noch {platzhalter} enthalten; die füllt erst der Browser
    mit den gewürfelten Zahlen."""
    s = steuer.get(anlage["beleg"], {})
    daten = dict(anlage.get("daten") or {})
    quelle = s.get("wiederholung", {}).get("quelle")
    marke = s.get("wiederholung", {}).get("marke")

    roh = daten.pop(quelle, None) if quelle else None
    if roh is None and marke:
        einzeln = daten.pop(marke, None)
        if isinstance(einzeln, str):
            roh = [{"text": einzeln}]
        elif isinstance(einzeln, dict):
            roh = [einzeln]
    zeilen = []
    for eintrag in (roh or []):
        zeile = dict(s.get("zeilen_vorgaben") or {})
        zeile.update(eintrag if isinstance(eintrag, dict) else {"text": eintrag})
        # Eine Zeile, die ihre Seite nennt, legt ihren Betrag auf diese Seite.
        seite = zeile.pop("art", None)
        if seite and "betrag" in zeile:
            zeile[seite] = zeile.pop("betrag")
        zeilen.append({k: str(v) for k, v in zeile.items()})

    werte = dict(s.get("vorgaben") or {})
    werte.update(daten)
    return {"werte": {k: str(v) for k, v in werte.items()}, "zeilen": zeilen}


def aufgaben_sammeln(lf, kapitel_daten, konten_index, vorlagen, steuer):
    """Alle *.aufgaben.json eines Lernfelds prüfen und einsammeln."""
    kapitel_info = {k["id"]: k for k in kapitel_daten}
    begriffe = set(lf.get("begriffe", {}))
    paragraphen = set(lf.get("paragraphen", {}))
    verweis = re.compile(r"\{\{(begriff|par):([a-z0-9-]+)\|")

    kapitel_raus, bausteine_raus = [], []
    for pfad in sorted(HIER.glob("*.aufgaben.json")):
        datei = json.loads(pfad.read_text(encoding="utf-8"))
        if datei.get("lernfeld") != lf["id"]:
            continue
        kap = datei.get("kapitel")
        if kap not in kapitel_info:
            raise Aufgabenfehler(
                f"{pfad.name}: Kapitel „{kap}“ steht nicht in {lf['id']}.lernfeld.json")

        eigene = []
        for b in datei.get("bausteine", []):
            wo = f"{pfad.name} · {b.get('id', '?')}"
            for feld in ("id", "operator", "anforderungsbereich", "punkte",
                         "dauer_min", "eingabe", "bewertung"):
                if b.get(feld) in (None, ""):
                    raise Aufgabenfehler(f"{wo}: Feld „{feld}“ fehlt")
            if "hinweis_konto" in b:
                raise Aufgabenfehler(
                    f"{wo}: hinweis_konto ist ein Merkzettel und gehört nicht in den "
                    f"fertigen Bestand — Konto im Kontenplan ergänzen und Feld entfernen")

            # Formeln: nur bekannte Größen
            bekannt = set(b.get("variablen") or {})
            for name, formel in (b.get("abgeleitet") or {}).items():
                formel_pruefen(formel, bekannt, wo)
                bekannt.add(name)
            if b.get("pruefung_variablen"):
                formel_pruefen(b["pruefung_variablen"], bekannt, wo)

            # Anzeige: bekannte Blöcke, vorhandene Belege
            for a in b.get("anzeige") or []:
                if a.get("block") not in ANZEIGE_BLOECKE:
                    raise Aufgabenfehler(f"{wo}: unbekannter Anzeigeblock „{a.get('block')}“")
                if a.get("beleg"):
                    if a["beleg"] not in vorlagen:
                        raise Aufgabenfehler(
                            f"{wo}: Beleg „{a['beleg']}“ hat keine Vorlage unter quellen/belege/")
                    a["beleg_gefuellt"] = beleg_fuellen(a, steuer, wo)

            # Eingabe: bekannte Blöcke, auflösbare Konten, prüfbare Lösungen
            for e in b.get("eingabe") or []:
                if e.get("block") not in EINGABE_BLOECKE:
                    raise Aufgabenfehler(f"{wo}: unbekannter Eingabeblock „{e.get('block')}“")
                if e["block"] == "zahl" and isinstance(e.get("loesung"), str):
                    formel_pruefen(e["loesung"], bekannt, wo)
                if e["block"] == "buchungssatz":
                    for zeile in e.get("loesung") or []:
                        for seite in ("soll", "haben"):
                            if zeile.get(seite) in (None, ""):
                                continue
                            if not konto_aufloesen(zeile[seite], konten_index):
                                raise Aufgabenfehler(
                                    f"{wo}: Konto „{zeile[seite]}“ steht nicht im Kontenplan")
                        if isinstance(zeile.get("betrag"), str):
                            formel_pruefen(zeile["betrag"], bekannt, wo)

            # Verweise auf Begriffe und Paragraphen
            for art, kennung in verweis.findall(json.dumps(b, ensure_ascii=False)):
                vorhanden = begriffe if art == "begriff" else paragraphen
                if kennung not in vorhanden:
                    raise Aufgabenfehler(
                        f"{wo}: Verweis {art}:{kennung} steht nicht in {lf['id']}.lernfeld.json")

            eigene.append(dict(b, lernfeld=lf["id"], kapitel=kap,
                               konten_als=datei.get("konten_als", "nummer")))

        if not eigene:
            continue
        info = kapitel_info[kap]
        kapitel_raus.append({
            "schluessel": f'{lf["id"]}:{kap}',
            "lernfeld": lf["id"], "lernfeldTitel": lf["titel"],
            "kapitel": kap, "nummer": info["nummer"], "titel": info["titel"],
            "zu": f'{lf["id"]}.html#{kap}',
            "bausteine": len(eigene),
            "punkte": sum(b["punkte"] for b in eigene),
            "minuten": sum(b["dauer_min"] for b in eigene),
        })
        bausteine_raus += eigene
    return kapitel_raus, bausteine_raus


def aufgaben_schreiben(kapitel, bausteine, konten, vorlagen):
    kennungen = [b["id"] for b in bausteine]
    doppelt = {k for k in kennungen if kennungen.count(k) > 1}
    if doppelt:
        raise Aufgabenfehler("Doppelte Baustein-Kennungen: " + ", ".join(sorted(doppelt)))
    daten = {
        "gebaut": datetime.now().isoformat(timespec="seconds"),
        "kapitel": kapitel,
        "bausteine": bausteine,
        "kontenplan": konten,
        "belege": vorlagen,
    }
    (MITTEL / "aufgaben.json").write_text(
        json.dumps(daten, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return daten


# ---------------------------------------------------------------- Symbol

SYMBOL = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img"
     aria-label="AzubiPass">
  <rect width="512" height="512" rx="114" fill="#12301F"/>
  <rect x="148" y="148" width="216" height="216" transform="rotate(45 256 256)"
        fill="none" stroke="#C9A227" stroke-width="24"/>
  <rect x="217" y="217" width="78" height="78" transform="rotate(45 256 256)"
        fill="#C9A227"/>
</svg>'''


def symbole():
    """Schreibt das Zeichen einmal als SVG und rendert daraus die PNG-Größen,
    die iOS und der Homescreen brauchen.

    Gerendert wird mit Playwright — das ist für pruefe.py ohnehin da. Eine
    Bildbibliothek nur für drei Symbole wäre eine Abhängigkeit zu viel."""
    (MITTEL / "symbol.svg").write_text(SYMBOL, encoding="utf-8")
    groessen = [("symbol-192.png", 192), ("symbol-512.png", 512), ("symbol-180.png", 180)]
    if all((MITTEL / name).exists() for name, _ in groessen):
        return True
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  Hinweis: Playwright fehlt — die PNG-Symbole bleiben aus.")
        print("           Auf dem iPhone zeigt der Homescreen dann ein Vorschaubild.")
        return False

    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, px in groessen:
            seite = b.new_page(viewport={"width": px, "height": px},
                               device_scale_factor=1)
            seite.set_content(
                f'<body style="margin:0">{SYMBOL.replace("512", str(px), 2)}</body>')
            seite.screenshot(path=str(MITTEL / name), omit_background=True)
            seite.close()
        b.close()
    print(f"  Symbole: svg + {len(groessen)} PNG")
    return True


# ---------------------------------------------------------------- Rechtstexte

def rechtsseite(titel, beschreibung, inhalt, stil, kernel):
    return f'''<!DOCTYPE html>
<html lang="de">
<head>
{kopf(titel, beschreibung, stile=[stil], skripte=[kernel])}
</head>
<body data-bereich="">
<a class="sprung" href="#inhalt">Zum Inhalt springen</a>
<header class="kopf auf-papier">
  <a class="zurueck" href="app.html#ich" aria-label="Zurück">
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round" stroke-linejoin="round"/></svg>
  </a>
  <div class="kopf-meta">{html.escape(titel)}</div>
  <span style="width:44px"></span>
</header>
<main id="inhalt" class="schirm rechtstext">
{inhalt}
</main>
{fussleiste()}
{tableiste()}
</body>
</html>'''


def luecken(r):
    """Alle Felder, die noch auf ihren Wert warten.

    Im Eigengebrauch keine — dann ist nichts zu kennzeichnen."""
    if r.get("nur_privat"):
        return []
    fehlt = []
    a = r.get("anbieter", {})
    for feld in ("name", "strasse", "plz_ort", "email"):
        if not a.get(feld) or a.get(feld) == PLATZHALTER:
            fehlt.append(f"anbieter.{feld}")
    return fehlt


def warnkasten(fehlt):
    if not fehlt:
        return ""
    return ('<div class="box achtung"><div class="bk">Noch nicht veröffentlichungsfertig</div>'
            '<p>In <code>quellen/rechtliches.json</code> fehlen noch: '
            + html.escape(", ".join(fehlt)) +
            '. Ohne vollständige Anbieterkennzeichnung darf diese Seite in '
            'Deutschland nicht geschäftsmäßig betrieben werden.</p></div>')


def privatkasten():
    """Steht auf der Hinweisseite, solange die App nur dem Eigengebrauch dient.

    Nicht bloß Dekoration: Sie hält fest, ab wann die Angaben nachgetragen
    werden müssen — damit die Frage nicht in einer JSON-Datei verstaubt."""
    return ('<div class="box praxis"><div class="bk">Privates Lernprojekt</div>'
            '<p>Diese Seite ist für den Eigengebrauch gebaut. Sie wird nicht '
            'beworben, nicht verteilt und es wird nichts angeboten. Eine '
            'Anbieterkennzeichnung nach § 5 DDG gilt für <em>geschäftsmäßige</em> '
            'digitale Dienste — dieser Fall ist keiner.</p>'
            '<p><strong>Sobald der Link weitergegeben wird</strong> — in eine '
            'Klassengruppe, auf Social Media, irgendwo verlinkt — ändert sich '
            'das. Dann in <code>quellen/rechtliches.json</code> '
            '<code>nur_privat</code> auf <code>false</code> setzen, Anschrift '
            'und E-Mail eintragen und neu bauen. Der Build erzeugt daraus ein '
            'vollständiges Impressum und meckert, solange etwas fehlt.</p></div>')


def impressum(r, fehlt):
    a = r.get("anbieter", {})

    def zeile(wert):
        return html.escape(wert) if wert and wert != PLATZHALTER else \
            '<em style="color:var(--warn-schrift)">— fehlt noch —</em>'

    kontakt = f'<p>E-Mail: {zeile(a.get("email"))}</p>'
    if a.get("telefon"):
        kontakt += f'<p>Telefon: {html.escape(a["telefon"])}</p>'
    ust = (f'<h2>Umsatzsteuer-Identifikationsnummer</h2><p>{html.escape(a["umsatzsteuer_id"])}</p>'
           if a.get("umsatzsteuer_id") else "")

    schriften = "".join(
        f'<li>{html.escape(s["name"])} — {html.escape(s["rechte"])}, '
        f'{html.escape(s["lizenz"])} (<a href="{html.escape(s["web"])}" '
        f'rel="noopener noreferrer" target="_blank">Lizenztext</a>)</li>'
        for s in r.get("schriften", []))

    privat = bool(r.get("nur_privat"))
    if privat:
        kopf_teil = f'''{privatkasten()}
  <div class="schirm-kopf">
    <h1>Hinweise</h1>
    <p>Wer das gebaut hat, worauf du dich verlassen kannst und worauf nicht.</p>
  </div>

  <h2>Betrieben von</h2>
  <p>{zeile(a.get("name"))} — privat, für die eigene Prüfungsvorbereitung.</p>'''
    else:
        kopf_teil = f'''
  <div class="schirm-kopf">
    <h1>Impressum</h1>
    <p>Angaben nach § 5 Digitale-Dienste-Gesetz (DDG).</p>
  </div>

  <h2>Anbieter</h2>
  <p>{zeile(a.get("name"))}<br>
     {zeile(a.get("strasse"))}<br>
     {zeile(a.get("plz_ort"))}<br>
     {html.escape(a.get("land", "Deutschland"))}</p>

  <h2>Kontakt</h2>
  {kontakt}

  <h2>Verantwortlich für den Inhalt</h2>
  <p>{zeile(a.get("name"))}, Anschrift wie oben.</p>
  {ust}'''

    return warnkasten(fehlt) + kopf_teil + f'''

  <h2>Keine Verbindung zu IHK, AkA oder Prüfungsausschüssen</h2>
  <p>AzubiPass ist ein privates Lernprojekt. Es besteht <strong>keine</strong>
     Verbindung zu einer Industrie- und Handelskammer, zur Aufgabenstelle für
     kaufmännische Abschluss- und Zwischenprüfungen (AkA) oder zu einem
     Prüfungsausschuss. Die Inhalte sind weder amtlich noch von einer dieser
     Stellen geprüft oder freigegeben. Genannte Marken- und Kennzeichenrechte
     stehen ihren jeweiligen Inhabern zu.</p>

  <h2>Haftung für Inhalte</h2>
  <p>Die Lerninhalte wurden nach bestem Wissen erstellt. Für ihre Richtigkeit,
     Vollständigkeit und Aktualität wird keine Gewähr übernommen — insbesondere
     nicht dafür, dass die dargestellte Rechtslage zum Zeitpunkt des Lesens noch
     gilt. Die Inhalte ersetzen keine Rechts-, Steuer- oder Berufsberatung. Ein
     Prüfungserfolg wird nicht zugesichert.</p>

  <h2>Haftung für Links</h2>
  <p>Diese Seite verweist nur an wenigen Stellen auf fremde Seiten. Für deren
     Inhalte ist stets der jeweilige Anbieter verantwortlich. Zum Zeitpunkt der
     Verlinkung waren keine Rechtsverstöße erkennbar. Wird ein Verstoß bekannt,
     wird der Link entfernt.</p>

  <h2>Urheberrecht</h2>
  <p>{html.escape(r.get("inhalt", {}).get("lizenz_hinweis",
        "Die Inhalte dieser Seite unterliegen dem deutschen Urheberrecht."))}
     Zitierte Gesetzestexte sind nach § 5 UrhG gemeinfrei.</p>

  <h2>Verwendete Schriften</h2>
  <ul>{schriften}</ul>
  <p>Die Schriftdateien werden von dieser Seite selbst ausgeliefert. Beim Aufruf
     geht keine Anfrage an Google.</p>
'''


def datenschutz(r, fehlt):
    a = r.get("anbieter", {})
    h = r.get("hosting", {})
    auf = r.get("aufsicht", {})
    name = a.get("name") if a.get("name") != PLATZHALTER else "— fehlt noch —"

    return warnkasten(fehlt) + f'''
  <div class="schirm-kopf">
    <h1>Datenschutz</h1>
    <p>Informationen nach Art. 13 der Datenschutz-Grundverordnung.</p>
  </div>

  <div class="box praxis"><div class="bk">Das Wichtigste zuerst</div>
    <p>Dein Lernfortschritt bleibt auf deinem Gerät. Er wird nicht übertragen,
       nicht ausgewertet und nicht gespeichert, wo ich ihn sehen könnte. Es gibt
       keine Konten, keine Anmeldung, kein Tracking und keine Werbung.</p></div>

  <h2>Verantwortlicher</h2>
  {'<p>' + html.escape(name) + ' — private Nutzung, keine Anschriftenangabe, '
   'weil hier keine personenbezogenen Daten von anderen verarbeitet werden.</p>'
   if r.get("nur_privat") else
   f'<p>{html.escape(name)}<br>{html.escape(a.get("strasse", ""))}<br>'
   f'{html.escape(a.get("plz_ort", ""))}<br>'
   f'E-Mail: {html.escape(a.get("email", ""))}</p>'}

  <h2>Aufruf der Seite (Server-Protokolle)</h2>
  <p>Die Seite wird bei {html.escape(h.get("anbieter", ""))} gehostet
     ({html.escape(h.get("dienst", ""))}, {html.escape(h.get("anschrift", ""))}).
     Beim Aufruf verarbeitet der Anbieter technisch notwendige Zugriffsdaten,
     darunter deine IP-Adresse, Datum und Uhrzeit, die abgerufene Datei und den
     verwendeten Browser. Diese Verarbeitung ist zum sicheren und störungsfreien
     Betrieb erforderlich; Rechtsgrundlage ist
     {html.escape(h.get("grundlage", "Art. 6 Abs. 1 lit. f DSGVO"))}
     (berechtigtes Interesse am Betrieb der Seite). Auf Dauer und Umfang dieser
     Protokolle habe ich keinen Einfluss; sie liegen beim Anbieter. Soweit dabei
     Daten in die USA übermittelt werden, stützt sich der Anbieter auf das
     EU-US Data Privacy Framework.</p>

  <h2>Speicherung auf deinem Gerät (localStorage)</h2>
  <p>Die App legt deinen Lernstand im lokalen Speicher deines Browsers ab:
     welche Kapitel du gelesen hast, welche Antworten du angeklickt hast, was du
     in die Selbsttest-Felder geschrieben hast, den Stand deiner Karteikarten,
     deine Lesezeichen und die Tage, an denen du gelernt hast.</p>
  <p>Diese Daten verlassen dein Gerät nicht. Es handelt sich um Speicherung, die
     für den von dir ausdrücklich gewünschten Dienst unbedingt erforderlich ist
     — ohne sie wäre nach jedem Schließen alles weg. Sie ist deshalb nach
     § 25 Abs. 2 Nr. 2 TDDDG einwilligungsfrei; ein Cookie-Banner gibt es hier
     bewusst nicht, weil es nichts einzuwilligen gäbe.</p>
  <p>Du löschst diese Daten jederzeit selbst: in der App unter „Ich" über
     <em>Alles zurücksetzen</em> oder in den Einstellungen deines Browsers über
     das Löschen der Websitedaten. Unter „Ich" kannst du sie außerdem als Datei
     sichern und wieder einspielen — diese Datei entsteht auf deinem Gerät und
     wird nirgendwohin geschickt.</p>

  <h2>Schriften</h2>
  <p>Alle Schriften liegen auf dem Server dieser Seite und werden von dort
     geladen. Es besteht keine Verbindung zu Google Fonts oder einem anderen
     externen Dienst.</p>

  <h2>Keine Weitergabe, keine Auswertung</h2>
  <p>Es findet keine Reichweitenmessung statt, es sind keine Analysedienste,
     sozialen Netzwerke, Karten oder Videodienste eingebunden, und es werden
     keine Daten an Dritte weitergegeben oder für automatisierte
     Entscheidungen einschließlich Profiling verwendet.</p>

  <h2>Deine Rechte</h2>
  <p>Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung
     (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit
     (Art. 20) und Widerspruch (Art. 21 DSGVO). Da ich außer den beim Hoster
     anfallenden Protokollen keine personenbezogenen Daten verarbeite, kann ich
     zu deinem Lernstand allerdings gar keine Auskunft geben — ich habe ihn
     nicht.</p>
  <p>Unabhängig davon steht dir ein Beschwerderecht bei einer
     Datenschutz-Aufsichtsbehörde zu, etwa bei der
     {html.escape(auf.get("name", ""))}
     (<a href="{html.escape(auf.get("web", ""))}" rel="noopener noreferrer"
      target="_blank">{html.escape(auf.get("web", ""))}</a>).</p>

  <p class="stand">Stand: {date.today().strftime("%d.%m.%Y")}</p>
'''


# ---------------------------------------------------------------- App-Seite

def app_seite(stil, kernel, appjs, aufgabenjs, lernfelder):
    """Die Schale. Der Inhalt der fünf Schirme entsteht im Browser aus
    inhalt.json — hier steht nur das Gerüst, damit die Seite auch ohne
    JavaScript etwas Sinnvolles zeigt."""
    ohne_js = "".join(
        f'<li><a class="reihe" href="{lf["seite"]}"><span class="reihe-oben">'
        f'<span class="reihe-titel">{html.escape(lf["titel"])}</span></span></a></li>'
        for lf in lernfelder)
    return f'''<!DOCTYPE html>
<html lang="de">
<head>
{kopf("Lernen", "Alle Lernfelder für Kaufleute für Büromanagement — Fortschritt, "
      "Karteikarten und Suche, auch ohne Netz.", stile=[stil],
      skripte=[kernel, aufgabenjs, appjs])}
</head>
<body data-bereich="heute">
<a class="sprung" href="#inhalt">Zum Inhalt springen</a>
<header class="kopf auf-papier" id="kopf">
  <button class="zurueck" id="zurueck" aria-label="Zurück" hidden>
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <div class="kopf-meta" id="kopfMeta">{MARKE}</div>
  <a class="kopf-suche" href="#suche" aria-label="Suchen">{LUPE}</a>
</header>

<main id="inhalt">
  <section class="schirm" id="heute"></section>
  <section class="schirm" id="lernen" hidden></section>
  <section class="schirm" id="ueben" hidden></section>
  <section class="schirm" id="suche" hidden></section>
  <section class="schirm" id="ich" hidden></section>
  <noscript>
    <div class="schirm">
      <div class="schirm-kopf"><h1>{MARKE}</h1>
      <p>Für Fortschritt, Karteikarten und Suche braucht diese Seite JavaScript.
         Die Lernzettel selbst kannst du auch ohne lesen:</p></div>
      <ul class="liste-schlicht">{ohne_js}</ul>
    </div>
  </noscript>
</main>
{fussleiste()}
{tableiste()}
</body>
</html>'''


# ---------------------------------------------------------------- Manifest & SW

def manifest():
    return json.dumps({
        "name": f"{MARKE} · Lernzettel",
        "short_name": MARKE,
        "description": "Lernzettel und Prüfungstraining für Kaufleute für Büromanagement.",
        "start_url": "app.html",
        "scope": "./",
        "display": "standalone",
        "orientation": "portrait-primary",
        "lang": "de",
        "dir": "ltr",
        "background_color": "#F5F5F0",
        "theme_color": "#12301F",
        "categories": ["education"],
        "icons": [
            {"src": "mittel/symbol.svg", "sizes": "any", "type": "image/svg+xml"},
            {"src": "mittel/symbol-192.png", "sizes": "192x192", "type": "image/png",
             "purpose": "any maskable"},
            {"src": "mittel/symbol-512.png", "sizes": "512x512", "type": "image/png",
             "purpose": "any maskable"},
        ],
        "shortcuts": [
            {"name": "Weiterlernen", "url": "app.html#heute"},
            {"name": "Karteikarten", "url": "app.html#ueben"},
            {"name": "Suche", "url": "app.html#suche"},
        ],
    }, ensure_ascii=False, indent=2)


SW_VORLAGE = '''/* AzubiPass · Zwischenspeicher
   Erzeugt von build_app.py — nicht von Hand bearbeiten.

   Der Name des Speichers trägt das Baudatum. Ein neuer Bau legt deshalb einen
   neuen an und räumt die alten weg; ein halb altes, halb neues Gemisch kann es
   nicht geben.

   Bewusst ohne skipWaiting: Eine neue Fassung übernimmt nicht mitten im Lesen,
   sondern meldet sich in der App und wartet, bis jemand sie anfordert. */

var SPEICHER = "azubipass-%VERSION%";
var VORRAT = %DATEIEN%;

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SPEICHER).then(function (c) {
    // Einzeln statt addAll: Eine fehlende Datei soll nicht die ganze
    // Installation scheitern lassen — dann liefe gar nichts offline.
    return Promise.all(VORRAT.map(function (u) {
      return c.add(new Request(u, { cache: "reload" })).catch(function () {});
    }));
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (namen) {
    return Promise.all(namen.map(function (n) {
      return n !== SPEICHER && n.indexOf("azubipass-") === 0 ? caches.delete(n) : null;
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (e) {
  if (e.data === "uebernehmen") self.skipWaiting();
});

self.addEventListener("fetch", function (e) {
  var anfrage = e.request;
  if (anfrage.method !== "GET") return;
  var url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(anfrage, { ignoreSearch: true }).then(function (treffer) {
      if (treffer) return treffer;
      return fetch(anfrage).then(function (antwort) {
        if (antwort && antwort.ok && antwort.type === "basic") {
          var kopie = antwort.clone();
          caches.open(SPEICHER).then(function (c) { c.put(anfrage, kopie); });
        }
        return antwort;
      }).catch(function () {
        // Ohne Netz und ohne Vorrat: Wenigstens die App statt eines
        // Browserfehlers, damit man von dort weiterkommt.
        return anfrage.mode === "navigate" ? caches.match("app.html") : Response.error();
      });
    })
  );
});
'''


def service_worker(dateien):
    version = datetime.now().strftime("%Y%m%d-%H%M%S")
    return (SW_VORLAGE
            .replace("%VERSION%", version)
            .replace("%DATEIEN%", json.dumps(sorted(dateien), ensure_ascii=False, indent=2)))


# ---------------------------------------------------------------- Aufbau

def baue():
    if not schriften_lokal():
        print("ACHTUNG: mittel/schriften.css fehlt — erst schriften.py laufen lassen.\n")

    MITTEL.mkdir(parents=True, exist_ok=True)
    stil, kernel, appjs, aufgabenjs, verhalten = veroeffentliche(
        "azubipass.css", "kern.js", "app.js", "aufgaben.js", "azubipass.js")

    konten, konten_index = kontenplan_lesen()
    belege, belege_steuer = belegvorlagen()

    lernfelder, karten, quiz, tests, suche, begriffe = [], [], [], [], [], {}
    pk_kapitel, pk_bausteine = [], []

    for datei in lernfeld_dateien():
        lf, kapitel_daten, fehlend = lade(datei)
        if not kapitel_daten:
            continue
        seite = AUSGABE / f'{lf["id"]}.html'
        if not seite.exists():
            print(f"  übersprungen (nicht gebaut): {lf['id']}")
            continue

        k, b = aufgaben_sammeln(lf, kapitel_daten, konten_index, belege, belege_steuer)
        pk_kapitel += k
        pk_bausteine += b

        lernfelder.append({
            "id": lf["id"],
            "titel": lf["titel"],
            "seite": f'{lf["id"]}.html',
            "minuten": sum(k.get("minuten", 0) for k in kapitel_daten),
            "kapitel": [{"id": k["id"], "nummer": k["nummer"], "titel": k["titel"],
                         "minuten": k.get("minuten", 0)} for k in kapitel_daten],
        })
        karten += karten_sammeln(lf, kapitel_daten)
        quiz += quiz_sammeln(lf, kapitel_daten)
        tests += tests_sammeln(lf, kapitel_daten)
        suche += suche_sammeln(lf, kapitel_daten)
        for e in begriffe_sammeln(lf):
            begriffe[e["id"]] = e

    cfg = json.loads((HIER / "landing.config.json").read_text(encoding="utf-8"))

    inhalt = {
        "gebaut": datetime.now().isoformat(timespec="seconds"),
        "pruefung": cfg["pruefung"]["naechster_termin"],
        "pruefungName": cfg["pruefung"]["bezeichnung"],
        "lernfelder": lernfelder,
        "karten": karten,
        "quiz": quiz,
        "tests": tests,
        "begriffe": sorted(begriffe.values(), key=lambda e: e["titel"].lower()),
    }
    (MITTEL / "inhalt.json").write_text(
        json.dumps(inhalt, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (MITTEL / "suche.json").write_text(
        json.dumps(suche, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    aufgaben_schreiben(pk_kapitel, pk_bausteine, konten, belege)

    symbole()
    (AUSGABE / "manifest.webmanifest").write_text(manifest(), encoding="utf-8")
    (AUSGABE / "app.html").write_text(
        app_seite(stil, kernel, appjs, aufgabenjs, lernfelder), encoding="utf-8")

    # Was der Build einmal erzeugt hat und heute nicht mehr erzeugt, räumt er
    # selbst weg. docs/ ist Ausgabe — dort von Hand aufzuräumen hieße, sich beim
    # nächsten Bau darauf zu verlassen, dass es jemand wieder tut.
    for veraltet in ("vorschau-aufgaben.html", "entwurf-start.html"):
        pfad = AUSGABE / veraltet
        if pfad.exists():
            pfad.unlink()
            print(f"  entfernt (kein Bauergebnis mehr): {veraltet}")

    r = rechtliches()
    fehlt = luecken(r)
    titel = "Hinweise" if r.get("nur_privat") else "Impressum"
    (AUSGABE / "impressum.html").write_text(
        rechtsseite(titel, "Wer das gebaut hat und worauf du dich verlassen kannst."
                    if r.get("nur_privat") else "Anbieterkennzeichnung nach § 5 DDG.",
                    impressum(r, fehlt), stil, kernel), encoding="utf-8")
    (AUSGABE / "datenschutz.html").write_text(
        rechtsseite("Datenschutz", "Wie diese Seite mit Daten umgeht.",
                    datenschutz(r, fehlt), stil, kernel), encoding="utf-8")

    # Vorrat für den Zwischenspeicher: alles, was die App offline braucht
    dateien = ["./", "app.html", "manifest.webmanifest"]
    dateien += [p.name for p in sorted(AUSGABE.glob("*.html"))]
    dateien += ["mittel/" + p.name for p in sorted(MITTEL.iterdir()) if p.is_file()]
    (AUSGABE / "sw.js").write_text(service_worker(dateien), encoding="utf-8")

    gewicht = sum((AUSGABE / d).stat().st_size for d in dateien
                  if d != "./" and (AUSGABE / d).exists())
    print(f"  {len(lernfelder)} Lernfelder · {len(karten)} Karten · {len(quiz)} Übungen · "
          f"{len(suche)} Suchabschnitte · {len(inhalt['begriffe'])} Begriffe")
    print(f"  Probeklausur: {len(pk_kapitel)} Kapitel mit Aufgaben · "
          f"{len(pk_bausteine)} Bausteine · "
          f"{sum(b['punkte'] for b in pk_bausteine)} Punkte · "
          f"{len(konten)} Konten · {len(belege)} Belegvorlagen")
    print(f"  App gebaut → app.html, manifest, sw.js ({len(dateien)} Dateien, "
          f"{gewicht // 1024} kB offline)")

    if fehlt:
        print("\n  ACHTUNG: Die Seite ist noch nicht veröffentlichungsfertig.")
        print("  In quellen/rechtliches.json fehlt: " + ", ".join(fehlt))
        print("  Ohne diese Angaben darf sie nicht geschäftsmäßig betrieben werden.")
        return 1
    if r.get("nur_privat"):
        print("\n  Hinweis: nur_privat steht auf true — gebaut für den Eigengebrauch,")
        print("  ohne Anbieterkennzeichnung. Vor dem Weitergeben des Links auf false")
        print("  stellen und Anschrift plus E-Mail eintragen.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(baue())
    except Aufgabenfehler as fehler:
        print("\n  ABBRUCH: Die Aufgabendaten sind nicht in Ordnung.")
        print(f"  {fehler}")
        print("  Nichts wurde geschrieben, was davon abhängt. Erst die Quelle")
        print("  unter quellen/ berichtigen, dann neu bauen.")
        sys.exit(1)
