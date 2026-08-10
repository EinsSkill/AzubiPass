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
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

from gemeinsames import AUSGABE as SEITE

ergebnisse = []


def pruefe(name, bedingung, zusatz=""):
    ergebnisse.append((name, bool(bedingung), zusatz))
    print(f"  {'OK  ' if bedingung else 'FEHL'} {name}{'  ' + str(zusatz) if zusatz else ''}")


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
        pruefe("Weiterlernen-Karte zeigt das zuletzt gelesene Kapitel",
               "Weiterlernen" in text)
        pruefe("Countdown steht auf der Startseite", "Tage bis" in text.replace("\n", " ")
               or "TAGE BIS AP2" in text)

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
