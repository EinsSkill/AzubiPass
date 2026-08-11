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

        # L · Heute bleibt in beiden Stimmungen dunkelgrün
        print("\n· Farben")
        for farbe in ("light", "dark"):
            ktxM, pgM = app_mit(b, w, konto(), farbe=farbe)
            grund = pgM.evaluate(
                "() => getComputedStyle(document.body).backgroundColor")
            pruefe(f"Heute ist dunkelgrün ({farbe})", grund == "rgb(18, 48, 31)", grund)
            pgM.evaluate("location.hash = '#lernen'")
            pgM.wait_for_timeout(500)
            anders = pgM.evaluate(
                "() => getComputedStyle(document.body).backgroundColor")
            pruefe(f"Lernen folgt wieder der Stimmung ({farbe})",
                   anders == ("rgb(245, 245, 240)" if farbe == "light"
                              else "rgb(20, 22, 20)"), anders)
            pgM.evaluate("location.hash = '#heute'")
            pgM.wait_for_timeout(500)
            pruefe(f"Zurück auf Heute wieder grün ({farbe})",
                   pgM.evaluate("() => getComputedStyle(document.body).backgroundColor")
                   == "rgb(18, 48, 31)")
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

    fehl = [n for n, ok, _ in ergebnisse if not ok]
    print(f"\n  {len(ergebnisse) - len(fehl)} von {len(ergebnisse)} bestanden.")
    if fehl:
        print("  Durchgefallen:")
        for n in fehl:
            print(f"    · {n}")
    return 1 if fehl else 0


if __name__ == "__main__":
    sys.exit(main())
