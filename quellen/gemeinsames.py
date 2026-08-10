#!/usr/bin/env python3
"""
AzubiPass · Was alle Bauwerkzeuge wissen müssen.

Hier steht nur, was sonst in build.py, build_landing.py, build_app.py und
pruefe.py mehrfach identisch stünde. Der Grund ist nicht Sparsamkeit, sondern
Sicherheit: Läuft der Ausgabepfad oder der Seitenkopf an einer der Stellen
auseinander, schreibt ein Skript still etwas anderes — ohne Fehlermeldung. So
etwas findet man erst, wenn eine Seite alt aussieht und niemand weiß, warum.
"""

import html
import json
import shutil
from pathlib import Path

HIER = Path(__file__).parent

# Gebaute Seiten landen in ../docs. Der Name ist nicht frei gewählt: GitHub
# Pages liefert entweder die Wurzel eines Branches aus oder genau den Ordner
# /docs. Mit diesem Namen fällt der Umweg über einen zweiten Branch oder eine
# Bau-Automatik weg — hochladen genügt.
def _ausgabe():
    docs, alt = HIER.parent / "docs", HIER.parent / "seite"
    if docs.is_dir():
        return docs
    if alt.is_dir():                 # älterer Stand: nicht plötzlich zwei Ausgaben
        return alt
    docs.mkdir(parents=True, exist_ok=True)
    return docs


AUSGABE = _ausgabe()

# Alles, was mehrere Seiten gemeinsam benutzen: Stil, Verhalten, Schriften,
# Suchindex, Karten. Getrennt ausgeliefert statt in jede Seite kopiert — sonst
# stünden dieselben anderthalb Megabyte vierzehnmal auf der Platte und der
# Browser lädt sie vierzehnmal statt einmal.
MITTEL = AUSGABE / "mittel"

MARKE = "AzubiPass"
FARBE_HELL = "#F5F5F0"
FARBE_DUNKEL = "#141614"

GOOGLE_LINK = '''<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">'''


def veroeffentliche(*namen):
    """Kopiert Quelldateien unverändert nach mittel/ und gibt ihre Adressen zurück.

    Kopieren statt Einbetten: Dieselbe CSS in vierzehn Seiten hineinzuschreiben
    kostet den Browser vierzehn Downloads für eine Datei, die sich nie
    unterscheidet."""
    MITTEL.mkdir(parents=True, exist_ok=True)
    for name in namen:
        shutil.copyfile(HIER / name, MITTEL / name)
    return [f"mittel/{name}" for name in namen]


def schriftkopf():
    """Gibt die Kopfzeilen für die Schriften zurück.

    Sobald schriften.py einmal gelaufen ist, liegen die Schnitte in mittel/ und
    die Seite fragt niemanden mehr. Solange die Datei fehlt, bleibt der
    Google-Weg: Die Seite soll nicht in Georgia dastehen, nur weil ein Schritt
    vergessen wurde — build.py meldet es dann aber deutlich."""
    if (MITTEL / "schriften.css").exists():
        return '<link rel="stylesheet" href="mittel/schriften.css">'
    return GOOGLE_LINK


def schriften_lokal():
    return (MITTEL / "schriften.css").exists()


def kopf(titel, beschreibung, stile=(), skripte=()):
    """Der komplette <head> einer Seite — überall derselbe.

    viewport-fit=cover zusammen mit den env(safe-area-*)-Regeln in der CSS ist
    das, was die App auf Geräten mit Aussparung nicht unter die Uhr rutschen
    lässt. Zwei theme-color-Zeilen, damit sich die Statusleiste des Handys in
    beiden Farbstimmungen an die Seite angleicht statt gegen sie zu stehen."""
    verweise = "\n".join(f'<link rel="stylesheet" href="{s}">' for s in stile)
    programme = "\n".join(f'<script src="{s}" defer></script>' for s in skripte)
    return f'''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(titel)} · {MARKE}</title>
<meta name="description" content="{html.escape(beschreibung)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="{FARBE_HELL}" media="(prefers-color-scheme:light)">
<meta name="theme-color" content="{FARBE_DUNKEL}" media="(prefers-color-scheme:dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="mittel/symbol.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="mittel/symbol-180.png">
<meta name="apple-mobile-web-app-title" content="{MARKE}">
{schriftkopf()}
{verweise}
{programme}'''


# Strichzeichnungen für die Tab-Leiste. Gleiche Bauart wie die Marken im Text:
# 1,5 px Strich, keine Flächen — damit sie neben der Schrift nicht laut werden.
TABS = [
    ("heute", "Heute", "M4 10.5 12 4l8 6.5V20H4z"),
    ("lernen", "Lernen", "M4 5h5.5A2.5 2.5 0 0 1 12 7.5V20a2.2 2.2 0 0 0-2.2-2H4zm16 0h-5.5A2.5 2.5 0 0 0 12 7.5V20a2.2 2.2 0 0 1 2.2-2H20z"),
    ("ueben", "Üben", "M9 8h11v11H9zM5.5 5H16M4 8.5v8"),
    ("ich", "Ich", "M12 12.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zM4.5 20.5a7.5 7.5 0 0 1 15 0"),
]

LUPE = ('<svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">'
        '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6"/>'
        '<path d="M16.3 16.3 21 21" stroke="currentColor" stroke-width="1.6" '
        'stroke-linecap="round"/></svg>')


def tableiste(aktiv=""):
    """Die vier Hauptbereiche, unten, auf jeder Seite gleich.

    Die Adressen zeigen immer auf app.html — steht man schon dort, behandelt der
    Browser das als reinen Sprung innerhalb der Seite und lädt nichts neu. So
    braucht es nur eine Leiste statt einer für die App und einer für die
    Lernzettel."""
    knoepfe = []
    for schluessel, name, pfad in TABS:
        an = " an" if schluessel == aktiv else ""
        jetzt = ' aria-current="page"' if an else ""
        knoepfe.append(
            f'<a class="tab{an}" href="app.html#{schluessel}"{jetzt}>'
            f'<svg viewBox="0 0 24 24" width="23" height="23" fill="none" aria-hidden="true">'
            f'<path d="{pfad}" stroke="currentColor" stroke-width="1.5" '
            f'stroke-linecap="round" stroke-linejoin="round"/></svg>'
            f'<span>{name}</span></a>')
    return ('<nav class="tableiste" aria-label="Hauptbereiche">'
            + "".join(knoepfe) + '</nav>')


def lade(lernfeld_datei):
    """Liest eine Lernfeld-Datei samt ihrer Kapitel und dem gemeinsamen Speicher.

    Steht hier und nicht in build.py, weil build_app.py dieselben Daten braucht.
    Zweimal geladen hieße: zwei Stellen, an denen der gemeinsame Speicher anders
    zusammengesetzt werden könnte."""
    pfad = Path(lernfeld_datei)
    lf = json.loads(pfad.read_text(encoding="utf-8"))
    basis = pfad.parent

    # Gemeinsamer Speicher zuerst, lernfeldeigene Einträge überschreiben ihn
    gem_datei = basis / "gemeinsam.json"
    gem = json.loads(gem_datei.read_text(encoding="utf-8")) if gem_datei.exists() else {}
    for feld in ("begriffe", "paragraphen"):
        zusammen = dict(gem.get(feld, {}))
        zusammen.update(lf.get(feld, {}))
        lf[feld] = zusammen

    kapitel_daten, fehlend = [], []
    for eintrag in lf["kapitel"]:
        kap = basis / eintrag["datei"]
        if not kap.exists():
            fehlend.append(eintrag["datei"])
            continue
        kapitel_daten.append(json.loads(kap.read_text(encoding="utf-8")))
    return lf, kapitel_daten, fehlend


def lernfeld_dateien():
    """Alle Lernfeld-Dateien in Quellenordner, in stabiler Reihenfolge."""
    def nummer(p):
        ziffern = "".join(c for c in p.stem.split(".")[0] if c.isdigit())
        return (0 if ziffern else 1, int(ziffern) if ziffern else 0, p.name)
    return sorted(HIER.glob("*.lernfeld.json"), key=nummer)


def rechtliches():
    """Die Angaben aus rechtliches.json — oder ein leeres Gerüst mit Platzhaltern."""
    datei = HIER / "rechtliches.json"
    if datei.exists():
        return json.loads(datei.read_text(encoding="utf-8"))
    return {}


def nur_privat():
    """Eigengebrauch — keine Anbieterkennzeichnung nötig, aber auch nichts
    weitergeben."""
    return bool(rechtliches().get("nur_privat"))


def fussleiste():
    """Impressum und Datenschutz sind in Deutschland Pflicht, sobald die Seite
    geschäftsmäßig betrieben wird — und dann von jeder Unterseite aus mit zwei
    Klicks erreichbar. Deshalb hängen sie an jeder Seite, nicht nur an der
    Startseite.

    Im Eigengebrauch heißt die Seite ehrlich „Hinweise" statt „Impressum": Ein
    Link namens Impressum, hinter dem keins steht, ist schlechter als keiner."""
    erste = "Hinweise" if nur_privat() else "Impressum"
    return ('<footer class="fussleiste">'
            f'<a href="impressum.html">{erste}</a>'
            '<a href="datenschutz.html">Datenschutz</a>'
            f'<span>{MARKE}</span>'
            '</footer>')
