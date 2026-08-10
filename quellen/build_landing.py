#!/usr/bin/env python3
"""
AzubiPass · Landing-Page-Renderer

    python3 build_landing.py

Liest landing.config.json, berechnet die Fertigstellungstermine und erzeugt index.html.
Der Katalog wird nicht gepflegt, sondern gebaut — wie die Lernkapitel auch.
"""

import json
import html
from datetime import date, timedelta
from pathlib import Path

from gemeinsames import AUSGABE, schriftkopf, veroeffentliche

HIER = Path(__file__).parent
MONATE = ["Jan.", "Feb.", "März", "April", "Mai", "Juni",
          "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."]


def datum(d):
    return f"{d.day}. {MONATE[d.month - 1]}"


def termine(cfg):
    """Rechnet aus, wann welches Lernfeld fertig ist."""
    p = cfg["produktion"]
    lauf = date.fromisoformat(p["start"])
    nach_nr = {lf["nr"]: lf for lf in cfg["lernfelder"]}
    plan = {}
    for nr in p["reihenfolge"]:
        wochen = p["wochen_pro_groesse"][str(nach_nr[nr]["stunden"])]
        lauf += timedelta(weeks=wochen)
        plan[nr] = lauf
    return plan


def preis(lf, cfg):
    if lf["nr"] == 1:
        return "kostenlos"
    return cfg["preise"]["klein"] if lf["stunden"] <= 40 else cfg["preise"]["gross"]


def lade_lernfeld(lf):
    """Holt Kapitelzahl und Dauer aus der echten Lernfeld-Datei."""
    if not lf.get("quelle"):
        return None
    pfad = HIER / lf["quelle"]
    if not pfad.exists():
        return None
    d = json.loads(pfad.read_text(encoding="utf-8"))
    ziel = AUSGABE / f'{d["id"]}.html'
    if not ziel.exists():
        return None
    return {"kapitel": len(d["kapitel"]),
            "minuten": sum(k.get("minuten", 0) for k in d["kapitel"]),
            "seite": ziel.name,
            "frei_ab": next((k["titel"] for k in d["kapitel"] if k.get("frei")), None)}


def slug(t):
    s2 = t.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s2 = "".join(c if c.isalnum() or c == " " else "" for c in s2)
    return "-".join(s2.split())[:60]


def katalog(cfg, plan):
    zeilen, fertig, kapitel_gesamt = [], 0, 0
    for lf in cfg["lernfelder"]:
        daten = lade_lernfeld(lf)
        st = lf["status"]
        zusatz, marke = "", ""

        if daten:
            fertig += 1
            kapitel_gesamt += daten["kapitel"]
            marke = ('<span class="pill frei">komplett kostenlos</span>' if st == "frei"
                     else '<span class="pill fertig">verfügbar</span>')
            zusatz = (f'<span class="lf-umfang">{daten["kapitel"]} Kapitel · '
                      f'{daten["minuten"]} Min</span>')
            titel = (f'<a class="lf-titel" href="{daten["seite"]}">'
                     f'{html.escape(lf["titel"])}</a>')
            aktion = (f'<a class="lf-oeffnen" href="{daten["seite"]}">Öffnen{PFEIL}</a>')
            klasse = "lf offen"
        else:
            titel = f'<span class="lf-titel gesperrt">{html.escape(lf["titel"])}</span>'
            if st == "geplant":
                marke = '<span class="pill geplant">in Arbeit</span>'
                zusatz = f'<span class="termin">ab {datum(plan[lf["nr"]])}</span>'
                aktion = '<button class="lf-merken" type="button">Bescheid sagen</button>'
            else:
                marke = '<span class="pill spaeter">3. Lehrjahr</span>'
                zusatz = '<span class="termin">folgt später</span>'
                aktion = ""
            klasse = "lf"

        zeilen.append(f'''<li class="{klasse}" data-jahr="{lf['jahr']}" data-teil="{lf['teil']}" data-status="{st}">
  <span class="lf-nr">LF {lf['nr']}</span>
  <span class="lf-mitte">
    {titel}
    <span class="lf-meta">{lf['jahr']}. Lehrjahr · {lf['stunden']} Std · {lf['teil']}{zusatz and " · "}{zusatz}</span>
  </span>
  <span class="lf-rechts">{marke}<span class="lf-preis">{preis(lf, cfg)}</span>{aktion}</span>
</li>''')
    return "\n".join(zeilen), fertig, kapitel_gesamt


# ------------------------------------------------------------------ Marken

MARKE_MERKE = ('<svg width="14" height="14" viewBox="0 0 13 13" aria-hidden="true">'
               '<rect x="1" y="1" width="11" height="11" fill="none" stroke="currentColor" '
               'stroke-width="1.4" transform="rotate(45 6.5 6.5)"/></svg>')
MARKE_ACHTUNG = ('<svg width="14" height="14" viewBox="0 0 13 13" aria-hidden="true">'
                 '<path d="M6.5 1 12 11.5H1z" fill="none" stroke="currentColor" stroke-width="1.4" '
                 'stroke-linejoin="round"/><path d="M6.5 5v3" stroke="currentColor" stroke-width="1.4"/></svg>')
MARKE_TIPP = ('<svg width="14" height="14" viewBox="0 0 13 13" aria-hidden="true">'
              '<circle cx="6.5" cy="6.5" r="5.3" fill="none" stroke="currentColor" stroke-width="1.4"/>'
              '<path d="M6.5 3.6v3.4l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>')
PFEIL = ('<svg width="17" height="10" viewBox="0 0 17 10" fill="none" aria-hidden="true">'
         '<path d="M0 5h15M11 1l4 4-4 4" stroke="currentColor" stroke-width="1.6"/></svg>')


def baue():
    cfg = json.loads((HIER / "landing.config.json").read_text(encoding="utf-8"))
    plan = termine(cfg)
    liste, fertig, kapitel_gesamt = katalog(cfg, plan)
    letzter = max(plan.values())

    stil, verhalten = veroeffentliche("landing.css", "landing.js")
    p = cfg["person"]

    doc = f'''<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AzubiPass — Lernzettel und Prüfungstraining für Kaufleute für Büromanagement</title>
<meta name="description" content="Lernzettel, Übungen und Prüfungstraining für Kaufleute für Büromanagement nach der neuen Ausbildungsordnung 2025. Lernfeld 1 komplett kostenlos.">
<link rel="canonical" href="https://azubipass.de/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%2312301F'/%3E%3Cpath d='M8 21l5-11h2l5 11h-2.4l-1.1-2.6h-5l-1.1 2.6zm4.3-4.6h3.4L14 12.2z' fill='%23C9A227'/%3E%3C/svg%3E">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AzubiPass">
<meta property="og:locale" content="de_DE">
<meta property="og:url" content="https://azubipass.de/">
<meta property="og:title" content="AzubiPass — Bestehen. Nicht büffeln.">
<meta property="og:description" content="Lernzettel für Kaufleute für Büromanagement nach der neuen AO 2025. Lernfeld 1 komplett gratis, bei allen anderen das erste Thema.">
<meta property="og:image" content="https://azubipass.de/teilen.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#12301F">
{schriftkopf()}
<link rel="stylesheet" href="{stil}">
<script src="{verhalten}" defer></script>
</head>
<body>

<header class="kopf" id="kopf">
  <a class="wortmarke" href="/">Azubi<i>Pass</i></a>
  <nav class="nav">
    <a href="#katalog">Lernfelder</a>
    <a href="#pruefung">Prüfung</a>
    <a href="#person">Über</a>
    <a class="kn-gold klein" href="#demo">Kostenlos starten</a>
  </nav>
</header>

<!-- ============================ HERO ============================ -->
<section class="hero">
  <div class="hero-links">
    <p class="augenbraue">Kaufleute für Büromanagement · neue AO 2025</p>
    <h1>Bestehen.<br><em>Nicht büffeln.</em></h1>
    <p class="hero-lead">
      Lernzettel, Übungen und Prüfungstraining für alle 13 Lernfelder — nach der
      Ausbildungsordnung, die seit August 2025 gilt. Gemacht von einem Azubi, der
      dieselbe IHK-Prüfung schreibt wie du.
    </p>
    <div class="hero-knoepfe">
      <a class="kn-gold" href="#demo">Kapitel kostenlos öffnen{PFEIL}</a>
      <a class="kn-leer" href="#katalog">Alle Lernfelder</a>
    </div>
    <ul class="hero-fakten">
      <li><b data-zaehl="13">0</b>Lernfelder</li>
      <li><b data-zaehl="{kapitel_gesamt}">0</b>Kapitel fertig</li>
      <li><b>LF 1</b>komplett gratis</li>
    </ul>
  </div>

  <figure class="hero-rechts">
    <div class="rahmen">
      <div class="rahmen-kopf">
        <span class="rahmen-punkt"></span>
        <span>Lernfeld 1 · Der Wirtschaftskreislauf</span>
      </div>
      <div id="kreislauf"></div>
      <div class="rahmen-fuss">
        <span class="stufe-name" id="stufeName">Einfacher Kreislauf</span>
        <span class="legende"><i class="g"></i>Güterstrom<i class="m"></i>Geldstrom</span>
      </div>
    </div>
    <figcaption>Kein Mockup. Das läuft so in der Lernplattform.</figcaption>
  </figure>
</section>

<!-- ============================ PROBLEM ============================ -->
<section class="band problem rein">
  <div class="mitte schmal">
    <p class="gross">
      Kennst du den Moment: Klassenarbeit nächste Woche, deine Zettel sind Chaos, das
      YouTube-Video ist von 2019 und im Buch steht noch die alte Ausbildungsordnung.
    </p>
    <p>
      Genau da war ich auch. Also hab ich mir die Lernzettel gebaut, die ich selbst
      gesucht hab — und daraus ist das hier geworden.
    </p>
  </div>
</section>

<!-- ============================ BEWEIS ============================ -->
<section class="band beweis" id="demo">
  <div class="mitte">
    <h2 class="rein">Was Papier nicht kann</h2>
    <p class="unter rein">Drei Sachen zum Ausprobieren. Kein Konto, keine Mail, nichts.</p>

    <div class="beweis-zeile rein">
      <div class="beweis-text">
        <span class="marke">{MARKE_MERKE}</span>
        <h3>Die Lösung kommt erst, wenn du geantwortet hast.</h3>
        <p>
          Im PDF steht die Antwort direkt unter der Frage — man spickt, ohne es zu
          merken. Hier nicht. Probier's aus.
        </p>
      </div>
      <div class="beweis-box">
        <p class="frage-typ">Selbsttest · Lernfeld 6</p>
        <p class="frage-text">Was ist der Unterschied zwischen Inventur, Inventar und Bilanz?</p>
        <textarea id="stAntwort" placeholder="Schreib, was du weißt …"></textarea>
        <div class="knopfreihe">
          <button class="kn-dunkel" id="stZeigen" disabled>Antwort vergleichen</button>
          <button class="kn-text" id="stWeiss">Weiß ich nicht</button>
        </div>
        <div class="loesung" id="stLoesung">
          <p class="lk">Musterlösung</p>
          <p>Die Inventur ist der Vorgang der Bestandsaufnahme. Das Inventar ist das
          schriftliche Ergebnis — eine Liste aller Vermögensgegenstände und Schulden
          mit Mengen und Werten. Die Bilanz ist die nach HGB verdichtete
          Gegenüberstellung von Aktiva und Passiva.</p>
        </div>
      </div>
    </div>

    <div class="beweis-zeile umgekehrt rein">
      <div class="beweis-text">
        <span class="marke">{MARKE_TIPP}</span>
        <h3>Rechnen statt nachlesen.</h3>
        <p>
          Aktiva gleich Passiva steht in jedem Buch. Hier kannst du versuchen, es
          kaputtzumachen — und scheiterst. Schieb die Werte.
        </p>
      </div>
      <div class="beweis-box dunkel">
        <div class="regler">
          <label>Vermögen<input type="range" id="rVerm" min="20000" max="200000" step="5000" value="150000"></label>
          <label>Schulden<input type="range" id="rSchuld" min="0" max="200000" step="5000" value="80000"></label>
        </div>
        <div class="bilanz">
          <div><p class="saeule-kopf">Aktiva</p><div class="saeule" id="sAktiva"></div></div>
          <div><p class="saeule-kopf">Passiva</p><div class="saeule" id="sPassiva"></div></div>
        </div>
        <p class="waage" id="waage"></p>
        <p class="warn" id="warnUeber">Schulden über Vermögen: Das Eigenkapital wird negativ — die Gleichung gilt trotzdem.</p>
      </div>
    </div>

    <div class="beweis-zeile rein">
      <div class="beweis-text">
        <span class="marke">{MARKE_ACHTUNG}</span>
        <h3>Fehler sind in Stunden korrigiert, nicht in Auflagen.</h3>
        <p>
          Jedes Kapitel zeigt, wann es zuletzt fachlich geprüft wurde. Und an jedem
          steht ein Knopf, mit dem du einen Fehler melden kannst.
        </p>
      </div>
      <div class="beweis-box">
        <div class="pruefzeile">
          <span class="pruef-links">
            <b>Lernfeld 6 · Kapitel 6 — Umsatzsteuer</b>
            <span>Zuletzt fachlich geprüft: 12. Juli 2026</span>
          </span>
          <button class="kn-text" id="meldeKnopf">Fehler melden</button>
        </div>
        <p class="melde-echo" id="meldeEcho">Danke. Solche Meldungen sind der Grund, warum das hier aktueller ist als jedes gedruckte Buch.</p>
      </div>
    </div>
  </div>
</section>

<!-- ============================ PERSON ============================ -->
<section class="band person" id="person">
  <div class="mitte schmal rein">
    <div class="portrait" aria-hidden="true">LS</div>
    <h2>Wer das gebaut hat</h2>
    <p class="gross">
      Ich bin {html.escape(p['name'])}, {html.escape(p['rolle'])} in einem
      {html.escape(p['betrieb'])}. Ich schreibe dieselbe IHK-Prüfung wie du.
    </p>
    <p>
      Kein Verlag, kein Coach, keine Redaktion. Ich sitze in derselben Berufsschule und
      lerne denselben Stoff — nur schreibe ich mit, während ich es tue.
    </p>
    <p class="zitat">Wenn hier etwas falsch wäre, würde ich selbst durchfallen.</p>
  </div>
</section>

<!-- ============================ COUNTDOWN ============================ -->
<section class="band countdown rein" id="pruefung">
  <div class="mitte">
    <div class="cd-box">
      <div class="cd-zahl">
        <b id="cdTage">—</b>
        <span>Tage bis zur nächsten schriftlichen AP2</span>
      </div>
      <div class="cd-text">
        <p><b>Noch genug Zeit — oder schon knapp?</b></p>
        <p>
          Wenn du weniger als acht Wochen hast, brauchst du keinen kompletten Kurs,
          sondern einen Plan. Dafür gibt es den Endspurt: alle Lernfelder deines
          Prüfungsteils, Simulationen und einen Vier-Wochen-Plan für
          {cfg['preise']['abo_endspurt']} — drei Monate, kein Abo danach.
        </p>
        <a class="kn-gold" href="#katalog">Zum Endspurt{PFEIL}</a>
      </div>
    </div>
  </div>
</section>

<!-- ============================ KATALOG ============================ -->
<section class="band katalog" id="katalog">
  <div class="mitte">
    <h2 class="rein">Alle 13 Lernfelder</h2>
    <p class="unter rein">
      Sortiert wie deine Berufsschule — nach Lernfeld. {fertig} sind fertig und sofort
      lesbar, das erste und zweite Lehrjahr wird bis {datum(letzter)} vollständig.
      Lernfeld 1 kriegst du komplett geschenkt. Bei allen anderen ist das erste Thema
      frei — schau rein, dann weißt du, ob's was für dich ist.
    </p>

    <div class="filter rein" role="group" aria-label="Katalog filtern">
      <span class="filter-gruppe" data-feld="jahr">
        <button class="an" data-wert="alle">Alle Jahre</button>
        <button data-wert="1">1. Lehrjahr</button>
        <button data-wert="2">2. Lehrjahr</button>
        <button data-wert="3">3. Lehrjahr</button>
      </span>
      <span class="filter-gruppe" data-feld="teil">
        <button class="an" data-wert="alle">Beide Teile</button>
        <button data-wert="AP1">AP1</button>
        <button data-wert="AP2">AP2</button>
      </span>
    </div>

    <ul class="lf-liste rein" id="lfListe">
{liste}
    </ul>
    <p class="leer-hinweis" id="leerHinweis">Mit dieser Kombination gibt es kein Lernfeld.</p>

    <div class="bescheid rein">
      <div>
        <b>Alle {fertig} Lernfelder sind fertig.</b>
        <span>Kein Konto, keine Mail, keine Anmeldung. Öffnen und lesen.</span>
      </div>
      <a class="kn-gold klein" href="app.html">Zur App{PFEIL}</a>
    </div>
  </div>
</section>

<!-- ============================ STIMMEN ============================ -->
<section class="band stimmen rein">
  <div class="mitte schmal">
    <p class="zitat gross">Seit einem Jahr im Einsatz in meiner eigenen Berufsschulklasse.</p>
    <p class="klein-grau">
      Hier stehen echte Stimmen, sobald es sie gibt. Ausgedachte kommen mir nicht auf
      die Seite.
    </p>
  </div>
</section>

<!-- ============================ ABSCHLUSS ============================ -->
<section class="band abschluss rein">
  <div class="mitte schmal">
    <h2>Fang mit dem Gratis-Teil an.</h2>
    <p class="gross">Wenn der dir nichts bringt, bringt dir der Rest auch nichts.</p>
    <a class="kn-gold gross-kn" href="#demo">Kostenlos starten{PFEIL}</a>
    <p class="klein-grau">Kein Konto nötig. Keine Mail. Kein Abo im Hintergrund.</p>
  </div>
</section>

<footer class="fuss">
  <div class="mitte">
    <span class="wortmarke">Azubi<i>Pass</i></span>
    <nav>
      <a href="impressum.html">Impressum</a>
      <a href="datenschutz.html">Datenschutz</a>
    </nav>
    <p>© 2026 {html.escape(p['name'])} · Inhalte nach der Ausbildungsordnung vom 25.02.2025
       und dem Rahmenlehrplan der KMK in der Fassung vom 20.03.2025.</p>
  </div>
</footer>

<script>window.AZUBIPASS = {{ pruefung: "{cfg['pruefung']['naechster_termin']}" }};</script>
</body>
</html>'''

    ziel = AUSGABE / "index.html"
    ziel.write_text(doc, encoding="utf-8")

    print(f"  Landing Page → {ziel.name}")
    print(f"  {len(cfg['lernfelder'])} Lernfelder im Katalog, {fertig} davon verfügbar "
          f"({kapitel_gesamt} Kapitel verlinkt)")
    print(f"  Fertigstellung des letzten Lernfelds berechnet auf {letzter.isoformat()}")
    if cfg["pruefung"].get("pruefen"):
        print(f"  ACHTUNG: {cfg['pruefung']['pruefen']}")
    return ziel


if __name__ == "__main__":
    baue()
