#!/usr/bin/env python3
"""
AzubiPass · Renderer
Erzeugt aus den Kapitel-Daten die Webversion eines Lernfelds.

    python3 build.py buchfuehrung.lernfeld.json

Ausgabe: <lernfeld-id>.html — eine eigenständige Datei mit allen Kapiteln.
"""

import json
import html
import re
import sys
from pathlib import Path

from gemeinsames import (AUSGABE, LUPE, fussleiste, kopf, lade, lernfeld_dateien,
                         schriften_lokal, tableiste, veroeffentliche)

HIER = Path(__file__).parent


# ---------------------------------------------------------------- Text

def inline(text, lf):
    """Löst die Auszeichnungssyntax und die Verweise auf."""
    t = html.escape(text, quote=False)

    def begriff(m):
        key, wort = m.group(1), m.group(2)
        e = lf["begriffe"].get(key)
        if not e:
            return wort
        return (f'<button class="begriff" data-art="Begriff" '
                f'data-titel="{html.escape(e["titel"])}" '
                f'data-text="{html.escape(e["text"])}">{wort}</button>')

    def par(m):
        key, wort = m.group(1), m.group(2)
        e = lf["paragraphen"].get(key)
        if not e:
            return wort
        return (f'<button class="par" data-art="Gesetzestext" '
                f'data-titel="{html.escape(e["titel"])}" '
                f'data-text="{html.escape(e["text"])}">{wort}</button>')

    t = re.sub(r"\{\{begriff:([a-z0-9-]+)\|(.+?)\}\}", begriff, t)
    t = re.sub(r"\{\{par:([a-z0-9-]+)\|(.+?)\}\}", par, t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\w)\*(.+?)\*(?!\w)", r"<em>\1</em>", t)
    t = re.sub(r"==(.+?)==", r"<mark>\1</mark>", t)
    return t


MARKEN = {
    "merke": '<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" transform="rotate(45 6.5 6.5)"/></svg>',
    "achtung": '<svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1 12 11.5H1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6.5 5v3" stroke="currentColor" stroke-width="1.4"/></svg>',
    "praxistipp": '<svg width="13" height="13" viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="5.3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.5 3.6v3.4l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
}


# ---------------------------------------------------------------- Blöcke

# Kürzel für die Kennung eines Bausteins. Alles, was der Nutzer beantwortet,
# braucht eine, die eine Textänderung überlebt — sonst zeigt sein gespeicherter
# Stand nach dem nächsten Bauen auf eine andere Aufgabe.
KUERZEL = {"merke": "m", "check": "c", "zuordnen": "z"}


def tabelle(b, lf):
    kopf = "".join(f"<th>{inline(s, lf)}</th>" for s in b["spalten"])
    zeilen = []
    for z in b["zeilen"]:
        mono = set(z.get("mono", []))
        klasse = ' class="klappbar"' if z.get("detail") else ""
        tds = "".join(
            f'<td{" class=\"num\"" if i in mono else ""}>{inline(c, lf)}</td>'
            for i, c in enumerate(z["zellen"])
        )
        zeilen.append(f"<tr{klasse}>{tds}</tr>")
        if z.get("detail"):
            zeilen.append(
                f'<tr class="detail"><td colspan="{len(b["spalten"])}">'
                f'{inline(z["detail"], lf)}</td></tr>'
            )
    return ('<div class="tab-huelle rein"><table><thead><tr>'
            f'{kopf}</tr></thead><tbody>{"".join(zeilen)}</tbody></table></div>')


def merke(b, lf, kennung):
    return f'''<div class="karte-huelle rein">
  <div class="karte" id="{kennung}">
    <div class="seite vorder">
      <div class="bk">{MARKEN["merke"]}Merke</div>
      <p>{inline(b["text"], lf)}</p>
      <button class="dreher" data-karte="{kennung}">Abfragen</button>
    </div>
    <div class="seite rueck">
      <div class="bk">Karteikarte</div>
      <p>{inline(b.get("karteikarte", "Formuliere den Merksatz in eigenen Worten."), lf)}</p>
      <button class="dreher" data-karte="{kennung}">Umdrehen</button>
    </div>
  </div>
</div>'''


def hinweisbox(b, lf, art, titel):
    return (f'<div class="box {art} rein"><div class="bk">{MARKEN[art]}{titel}</div>'
            f'<p>{inline(b["text"], lf)}</p></div>')


def vertiefung(b, lf):
    inner = "".join(f"<p>{inline(p, lf)}</p>" for p in b["absaetze"])
    return (f'<details class="vertiefung rein"><summary>{inline(b["titel"], lf)}</summary>'
            f'<div class="v-inhalt">{inner}</div></details>')


def check(b, lf, kennung):
    opts = "".join(
        f'<button class="opt" data-richtig="{"1" if o.get("richtig") else ""}" '
        f'data-echo="{html.escape(o["echo"])}">{inline(o["text"], lf)}</button>'
        for o in b["optionen"]
    )
    return (f'<div class="check rein" id="{kennung}"><div class="check-kopf">Kurz geprüft</div>'
            f'<p class="check-frage">{inline(b["frage"], lf)}</p>'
            f'<div class="optionen">{opts}</div><p class="check-echo" role="status"></p></div>')


def zuordnen(b, lf, kennung):
    reihen = []
    for i, a in enumerate(b["aufgaben"], 1):
        knoepfe = "".join(
            f'<button class="zu-btn" data-w="{html.escape(k)}">{html.escape(k)}</button>'
            for k in b["kategorien"]
        )
        reihen.append(
            f'<div class="zu-reihe" id="{kennung}-{i}" data-loesung="{html.escape(a["loesung"])}">'
            f'<span class="zu-text">{inline(a["text"], lf)}</span>'
            f'<span class="zu-knoepfe">{knoepfe}</span></div>'
        )
    return (f'<div class="zuordnen rein" id="{kennung}"><div class="zu-kopf"><span>Zuordnen</span>'
            f'<span class="zu-zahl"><b>0</b>/{len(b["aufgaben"])} richtig</span></div>'
            f'<p class="zu-lead">{inline(b["lead"], lf)}</p>{"".join(reihen)}</div>')


def grafik(b, lf):
    daten = json.dumps(b, ensure_ascii=False)
    pruef = ''
    if b.get("pruefen"):
        pruef = f'<p class="pruefmarke dunkel">Zu prüfen: {html.escape(b["pruefen"])}</p>'
    regel = f'<p class="sig-regel">{inline(b["regel"], lf)}</p>' if b.get("regel") else ""
    return (f'<div class="sig rein" data-grafik="{b["variante"]}">'
            f'<script type="application/json">{daten}</script>'
            f'<div class="sig-kopf">{html.escape(b["kopf"])}</div>'
            f'<h4>{html.escape(b["titel"])}</h4>'
            f'<p class="sig-lead">{html.escape(b["lead"])}</p>'
            f'<div class="buehne"></div>'
            f'{regel}{pruef}</div>')


def block(b, lf, kennung):
    """Rendert einen Baustein und hängt einen offenen Prüf-Marker daran.

    Der Marker wird hier zentral behandelt, damit ihn jeder Blocktyp trägt.
    Vorher kannten ihn nur absatz, achtung und grafik — ein pruefen-Feld an
    einer Tabelle verschwand still, und genau das darf ein Warnzeichen nie."""
    inhalt = bausteil(b, lf, kennung)
    if b["typ"] != "grafik" and b.get("pruefen"):
        inhalt += f'<p class="pruefmarke">Zu prüfen: {inline(b["pruefen"], lf)}</p>'
    return inhalt


def bausteil(b, lf, kennung):
    t = b["typ"]
    if t == "absatz":
        return f'<p class="rein">{inline(b["text"], lf)}</p>'
    if t == "tabelle":
        return tabelle(b, lf)
    if t == "merke":
        return merke(b, lf, kennung)
    if t == "achtung":
        return hinweisbox(b, lf, "achtung", "Achtung")
    if t == "praxistipp":
        return hinweisbox(b, lf, "praxistipp", "Praxistipp")
    if t == "vertiefung":
        return vertiefung(b, lf)
    if t == "check":
        return check(b, lf, kennung)
    if t == "zuordnen":
        return zuordnen(b, lf, kennung)
    if t == "grafik":
        return grafik(b, lf)
    raise ValueError(f"Unbekannter Blocktyp: {t}")


# ---------------------------------------------------------------- Kapitel

def probeklausur_aktion(ch, lf, hat_aufgaben):
    """Der Weg vom Kapitel in die eigene Probeklausur.

    Nur dort, wo es für dieses Kapitel wirklich Aufgabenbausteine gibt: Ein
    Knopf, der in eine leere Auswahl führt, ist eine Enttäuschung mit
    Ankündigung. Die Kennung ist dieselbe, unter der die Probeklausur ihre
    Kapitel führt — <lernfeld>:<kapitel>."""
    if not hat_aufgaben:
        return ""
    kennung = f'{lf["id"]}:{ch["id"]}'
    return (f'<a class="kn-neben weiter-pk" '
            f'href="app.html#ueben/probeklausur?kapitel={html.escape(kennung)}">'
            f'Dieses Kapitel als Probeklausur üben</a>')


def nur_text(s):
    """Auszeichnung heraus — für eine Inhaltsangabe, die kein Knopf sein darf."""
    s = re.sub(r"\{\{(?:begriff|par):[a-z0-9-]+\|(.+?)\}\}", r"\1", str(s or ""))
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"(?<!\w)\*(.+?)\*(?!\w)", r"\1", s)
    return html.escape(re.sub(r"==(.+?)==", r"\1", s))


def inhaltsrand(ch, lf):
    """Die Abschnitte des Kapitels als Wegmarke.

    Am Schreibtisch steht sie fest neben dem Text; am Handy klappt sie aus einer
    Zeile auf, die mitläuft. Beides aus derselben Liste — ein zweites
    Inhaltsverzeichnis fürs Handy wäre eine zweite Wahrheit.

    Knopf und Liste statt <details>: Ein geschlossenes <details> versteckt
    seinen Inhalt vom Browser aus, und am Schreibtisch soll die Liste dauerhaft
    stehen, ohne dass jemand sie aufklappt. Das ließe sich nur mit einem
    open-Attribut erzwingen, das am Handy sofort wieder weg müsste. Ein Knopf
    mit aria-expanded sagt dasselbe, überall gleich."""
    zeilen = "".join(
        f'<li data-abschnitt="{a["id"]}">'
        f'<a href="#{ch["id"]}-{a["id"]}">{nur_text(a["titel"])}</a></li>'
        for a in ch["bloecke"])
    n = len(ch["bloecke"])
    liste_id = f'{lf["id"]}-{ch["id"]}-lr'
    return (f'<aside class="lauf-rand">'
            f'<div class="lr-inhalt">'
            f'<button class="lr-knopf" type="button" aria-expanded="false" '
            f'aria-controls="{liste_id}">'
            f'<span class="lr-marke">K{ch["nummer"]} · Inhalt</span>'
            f'<span class="lr-stand"><b>1</b> / {n}</span></button>'
            f'<div class="lr-titel">{html.escape(ch["titel"])}</div>'
            f'<ol class="lr-liste" id="{liste_id}">{zeilen}</ol>'
            f'</div></aside>')


def kapitel(ch, lf, naechstes, hat_aufgaben=False):
    ziele = "".join(
        f'<li data-fuer="{z["abschnitt"]}"><span class="haken"></span>'
        f'<span>{inline(z["text"], lf)}</span></li>'
        for z in ch["lernziele"]
    )

    abschnitte = []
    for a in ch["bloecke"]:
        ort = f'{lf["id"]}-{ch["id"]}-{a["id"]}'
        gezaehlt = {}
        stuecke = []
        for x in a["inhalt"]:
            kuerzel = KUERZEL.get(x["typ"], "b")
            gezaehlt[kuerzel] = gezaehlt.get(kuerzel, 0) + 1
            stuecke.append(block(x, lf, f'{ort}-{kuerzel}{gezaehlt[kuerzel]}'))
        abschnitte.append(
            f'<h3 id="{ch["id"]}-{a["id"]}">{inline(a["titel"], lf)}</h3>{"".join(stuecke)}'
        )

    zus = "".join(f"<li>{inline(s, lf)}</li>" for s in ch["zusammenfassung"])

    fragen = []
    for i, f in enumerate(ch["selbsttest"], 1):
        kennung = f'{lf["id"]}-{ch["id"]}-t{i}'
        fragen.append(f'''<div class="frage" id="{kennung}">
  <div class="frage-typ">{html.escape(f["typ"])}</div>
  <p class="frage-text" id="{kennung}-f">{inline(f["frage"], lf)}</p>
  <textarea placeholder="Deine Antwort …" aria-labelledby="{kennung}-f"></textarea>
  <div class="knopfreihe">
    <button class="kn-haupt" disabled>Antwort vergleichen</button>
    <button class="kn-neben">Weiß ich nicht</button>
  </div>
  <div class="loesung"><div class="lk">Musterlösung</div><p>{inline(f["loesung"], lf)}</p></div>
</div>''')

    if naechstes:
        weiter = (f'<div class="weiter-text">Nächstes Kapitel<b>K{naechstes["nummer"]} · '
                  f'{html.escape(naechstes["titel"])}</b></div>'
                  f'<button class="start" data-zu="{naechstes["id"]}">Weiter'
                  f'{PFEIL}</button>')
    else:
        weiter = ('<div class="weiter-text">Lernfeld<b>Alle Kapitel durchgearbeitet</b></div>'
                  f'<button class="start" data-zu="trainer">Karteikarten trainieren{PFEIL}</button>')

    return f'''<section class="kapitel" id="{ch["id"]}" hidden>
  <div class="kapitel-auftakt">
    <div class="kapitel-nr">K{ch["nummer"]}<small>Kapitel</small></div>
    <div>
      <h2>{html.escape(ch["titel"])}</h2>
      <p>{html.escape(ch["untertitel"])}</p>
    </div>
  </div>

  <div class="ziele">
    <div></div>
    <div class="ziele-box">
      <div class="ziele-kopf"><span>Lernziele</span>
        <span class="ziele-zahl"><b>0</b>/{len(ch["lernziele"])} erreicht</span></div>
      <ul class="ziele-liste">{ziele}</ul>
    </div>
  </div>

  <div class="lauf">
    {inhaltsrand(ch, lf)}
    <article class="inhalt">
      {"".join(abschnitte)}

      <div class="zus rein">
        <div class="bk">Zusammenfassung K{ch["nummer"]}</div>
        <ul>{zus}</ul>
      </div>

      <section class="test">
        <div class="test-kopf"><h3>Selbsttest</h3>
          <span class="test-zahl"><b>0</b>/{len(ch["selbsttest"])} bearbeitet</span></div>
        <p class="hinweis">Schreib deine Antwort auf, bevor du auflöst.</p>
        {"".join(fragen)}
      </section>

      <div class="box praxis rein pruefungstipp">
        <div class="bk">{MARKEN["praxistipp"]}IHK-Prüfungstipp</div>
        <p>{inline(ch["pruefungstipp"], lf)}</p>
      </div>
    </article>
  </div>

  <div class="abschluss"><div></div>
    <div class="abschluss-wege">
      <div class="weiter">{weiter}</div>
      {probeklausur_aktion(ch, lf, hat_aufgaben)}
    </div>
  </div>
</section>'''


PFEIL = ('<svg width="17" height="10" viewBox="0 0 17 10" fill="none">'
         '<path d="M0 5h15M11 1l4 4-4 4" stroke="currentColor" stroke-width="1.6"/></svg>')


# ---------------------------------------------------------------- Trainer

def karten_sammeln(lf, kapitel_daten):
    """Zieht jeden Merksatz als Karteikarte heraus — Frage vorn, Merksatz hinten.

    Die Daten liegen längst da: jeder merke-Block hat ein Pflichtfeld
    'karteikarte'. Der Trainer entsteht daraus, ohne dass jemand Karten
    getrennt pflegt.

    Jede Karte bekommt eine Kennung aus Lernfeld, Kapitel, Abschnitt und ihrer
    Nummer im Abschnitt. Vorher hing der Lernstand an der Position im Stapel:
    Kam irgendwo ein Merksatz dazu, rutschte alles dahinter um eins und der
    Stand zeigte still auf fremde Karten. Eine Kennung überlebt das."""
    karten = []
    for ch in kapitel_daten:
        for a in ch["bloecke"]:
            nr = 0
            for b in a["inhalt"]:
                if b["typ"] != "merke" or not b.get("karteikarte"):
                    continue
                nr += 1
                # Roh übergeben, nicht mit inline() rendern: Im Browser setzt mk()
                # dieselbe Auszeichnung um. Zweimal umsetzen würde die Tags escapen.
                karten.append({
                    "id": f'{lf["id"]}-{ch["id"]}-{a["id"]}-m{nr}',
                    "frage": b["karteikarte"],
                    "antwort": b["text"],
                    "lernfeld": lf["id"],
                    "lernfeldTitel": lf["titel"],
                    "kapitel": f'K{ch["nummer"]} · {ch["titel"]}',
                    "zu": f'{lf["id"]}.html#{ch["id"]}',
                })
    return karten


def trainer(karten):
    if not karten:
        return ""
    daten = json.dumps(karten, ensure_ascii=False)
    return f'''<section class="kapitel trainer" id="trainer" hidden>
  <div class="tr-kopf">
    <div>
      <div class="augenbraue">Karteikarten</div>
      <h2>Alles, was du dir merken musst.</h2>
      <p class="tr-lead">{len(karten)} Merksätze aus allen Kapiteln. Was du kannst,
      wandert weiter; was du nicht kannst, kommt zurück. Der Stand bleibt gespeichert.</p>
    </div>
    <div class="tr-faecher" aria-label="Verteilung auf die Fächer"></div>
  </div>
  <script type="application/json" id="karten-daten">{daten}</script>
  <div class="tr-buehne"></div>
</section>'''


def start(lf, kapitel_daten, karten_zahl=0):
    zeilen = "".join(
        f'<li data-zu="{k["id"]}"><span class="kn">K{k["nummer"]}</span>'
        f'<span class="kt">{html.escape(k["titel"])}</span>'
        f'<span class="ks">{k["minuten"]} Min</span></li>'
        for k in kapitel_daten
    )
    h = lf["hero"]
    ueberschrift = re.sub(r"\*(.+?)\*", r"<em>\1</em>", html.escape(h["ueberschrift"], quote=False))
    fakten = "".join(f"<span>{html.escape(f)}</span>" for f in h["fakten"])
    return f'''<section class="hero kapitel" id="start">
  <div class="hero-links">
    <div class="augenbraue">Lernfeld · {html.escape(lf["titel"])}</div>
    <h1>{ueberschrift}</h1>
    <p class="hero-lead">{html.escape(h["lead"])}</p>
    <div class="hero-fakten">{fakten}</div>
    <button class="start" data-zu="{kapitel_daten[0]["id"]}">Mit Kapitel 1 starten{PFEIL}</button>
  </div>
  <div class="hero-rechts">
    <div class="buch-titel">Inhalt</div>
    <ul class="buch">{zeilen}{karten_zeile(karten_zahl)}</ul>
    {lernfeld_marke(lf)}
  </div>
</section>'''


def lernfeld_marke(lf):
    """Ein pruefen-Feld am Lernfeld gilt für den ganzen Lernzettel und gehört
    deshalb aufs Deckblatt — sonst wäre es eine Warnung, die niemand sieht."""
    if not lf.get("pruefen"):
        return ""
    return f'<p class="pruefmarke dunkel">Zu prüfen: {html.escape(lf["pruefen"])}</p>'


def karten_zeile(n):
    """Der Trainer als weitere Zeile der Kapitelliste — gleiche Bauart, gleiche
    Styles, nur abgesetzt. Ein eigener Knopf daneben müsste .buch li nachbauen."""
    if not n:
        return ""
    return (f'<li class="buch-extra" data-zu="trainer">'
            f'<span class="kn">{n}</span>'
            f'<span class="kt">Karteikarten aus allen Kapiteln</span>'
            f'<span class="ks">üben</span></li>')


# ---------------------------------------------------------------- Aufbau

def kapitel_mit_aufgaben(lernfeld_datei, lf):
    """Welche Kapitel dieses Lernfelds Aufgabenbausteine haben.

    Ermittelt aus dem Dateinamen, nicht aus einer Liste im Code: Neben
    <name>.kapitel.json liegt gegebenenfalls <name>.aufgaben.json. Ein weiteres
    Lernfeld heißt damit weiterhin nur „Aufgabendatei schreiben, neu bauen" —
    nirgends steht eine feste Kapitelliste."""
    basis = Path(lernfeld_datei).parent
    raus = set()
    for eintrag in lf["kapitel"]:
        datei = eintrag.get("datei", "")
        if not datei.endswith(".kapitel.json"):
            continue
        if (basis / (datei[:-len(".kapitel.json")] + ".aufgaben.json")).exists():
            raus.add(eintrag["id"])
    return raus


def baue(lernfeld_datei):
    lf, kapitel_daten, fehlend = lade(lernfeld_datei)
    for name in fehlend:
        print(f"  übersprungen (fehlt): {name}")

    karten = karten_sammeln(lf, kapitel_daten)

    mit_aufgaben = kapitel_mit_aufgaben(lernfeld_datei, lf)

    seiten = [start(lf, kapitel_daten, len(karten))]
    for i, ch in enumerate(kapitel_daten):
        naechstes = kapitel_daten[i + 1] if i + 1 < len(kapitel_daten) else None
        seiten.append(kapitel(ch, lf, naechstes, ch["id"] in mit_aufgaben))
    seiten.append(trainer(karten))

    stil, kernel, verhalten = veroeffentliche("azubipass.css", "kern.js", "azubipass.js")

    doc = f'''<!DOCTYPE html>
<html lang="de">
<head>
{kopf(lf["titel"], lf["hero"]["lead"], stile=[stil], skripte=[kernel, verhalten])}
</head>
<body data-lernfeld="{html.escape(lf["id"])}" data-bereich="lernen">
<a class="sprung" href="#inhalt">Zum Inhalt springen</a>
<div class="fortschritt"><span id="balken"></span></div>
<header class="kopf" id="kopf">
  <button class="zurueck" id="zurueck" aria-label="Eine Ebene zurück">
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <div class="kopf-meta" id="kopfMeta">{html.escape(lf["titel"])}</div>
  <button class="kopf-suche" id="merken" aria-label="Kapitel merken" aria-pressed="false" hidden>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" stroke="currentColor" stroke-width="1.6"
            stroke-linejoin="round"/></svg>
  </button>
  <a class="kopf-suche" href="app.html#suche" aria-label="Suchen">{LUPE}</a>
</header>
<main id="inhalt">
{"".join(seiten)}
</main>
{fussleiste()}
{tableiste("lernen")}
</body>
</html>'''

    ziel = AUSGABE / f'{lf["id"]}.html'
    ziel.write_text(doc, encoding="utf-8")

    # Prüf-Marker sammeln
    roh = json.dumps(lf, ensure_ascii=False) + "".join(
        json.dumps(c, ensure_ascii=False) for c in kapitel_daten)
    offen = roh.count('"pruefen"')
    gezeigt = doc.count('class="pruefmarke')

    print(f"  {len(kapitel_daten)} Kapitel gerendert → {ziel.name}")
    genutzt = set(re.findall(r"\{\{(?:begriff|par):([a-z0-9-]+)\|", roh))
    print(f"  {len(genutzt)} von {len(lf['begriffe']) + len(lf['paragraphen'])} Einträgen des Speichers genutzt")
    if offen:
        print(f"  ACHTUNG: {offen} Prüf-Marker offen — vor Veröffentlichung klären")

    # Ein Marker, der niemand sieht, ist schlimmer als keiner: Er täuscht
    # Sicherheit vor. Steht ein pruefen-Feld an einer Stelle, die es nicht
    # rendert — etwa tief in den Daten einer Grafik —, muss das auffallen.
    if gezeigt != offen:
        print(f"  FEHLER: {offen} Prüf-Marker in den Daten, aber {gezeigt} auf der Seite. "
              f"Ein pruefen-Feld steht an einer Stelle, die es nicht anzeigt.")
    return ziel


if __name__ == "__main__":
    if not schriften_lokal():
        print("ACHTUNG: mittel/schriften.css fehlt — die Seiten laden Schriften von\n"
              "Google. Das geht ohne Netz nicht und ist beim Verbreiten heikel.\n"
              "Erst schriften.py laufen lassen.\n")

    # Ohne Argument alle Lernfelder: Vergisst man eins, fällt es sonst erst auf,
    # wenn die App auf eine Seite zeigt, die es nicht gibt.
    dateien = ([HIER / d if not Path(d).is_absolute() else Path(d) for d in sys.argv[1:]]
               or lernfeld_dateien())
    for datei in dateien:
        print(f"· {Path(datei).name}")
        baue(datei)
