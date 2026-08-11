# AzubiPass

Lernzettel und Prüfungstraining für Kaufleute für Büromanagement — als
installierbare App, die ohne Netz läuft.

Alle 13 Lernfelder des KMK-Rahmenlehrplans, 75 Kapitel, 96 interaktive
Fachgrafiken, 139 Karteikarten, 138 Übungsfragen.

## Aufbau

```
quellen/          Kapiteldaten (JSON) und die Bauwerkzeuge (Python, CSS, JS)
quellen/*.aufgaben.json   Aufgabenbausteine für die eigene Probeklausur
quellen/belege/   Belegvorlagen (HTML) und ihre Vorgaben
docs/             das Gebaute — was GitHub Pages ausliefert, nichts von Hand ändern
doku/             LIESMICH.md (Bedienung), kapitel-format.md, app-konzept.md,
                  eigene-probeklausur.md (Produktentscheidung zur Probeklausur)
```

Inhalt und Darstellung sind getrennt. Ein neues Kapitel heißt: JSON schreiben,
neu bauen. Kein HTML von Hand.

## Bauen

```
cd quellen
python schriften.py     # einmalig — holt die Schriften, danach nie wieder nötig
python build.py         # alle Lernzettel
python build_app.py     # App-Schale, Manifest, Offline-Speicher, Suche,
                        # Aufgabenbestand der Probeklausur, Rechtstexte
python build_landing.py # Startseite
```

Die Reihenfolge zählt: `build_app.py` liest, was `build.py` erzeugt hat.

## Prüfen

```
python pruefe.py        # sieht es richtig aus? 2 Größen × 2 Farbstimmungen
python funktionstest.py # tut es, was es verspricht? 167 Verhaltensprüfungen
```

Beide geben 1 zurück, wenn etwas gefunden wurde. `pruefe.py --schnell` prüft nur
Handy und helle Farben.

## Örtlich ansehen

```
cd docs
python -m http.server 4502
```

Dann `http://localhost:4502/app.html`. Ein Doppelklick auf die Datei reicht
nicht: Offline-Speicher und Suche brauchen einen echten Server.

## Rechtliches

`quellen/rechtliches.json` steuert, was auf den Rechtsseiten steht.

Solange `nur_privat` auf `true` steht, ist die App für den Eigengebrauch gebaut
— ohne Anbieterkennzeichnung, weil § 5 DDG nur geschäftsmäßige Dienste betrifft.
**Sobald der Link weitergegeben wird**, muss `nur_privat` auf `false` und
Anschrift plus E-Mail müssen eingetragen werden; der Build weigert sich dann,
solange etwas fehlt.

Die Schriften werden selbst ausgeliefert — es geht keine Anfrage an Google.
Der Lernfortschritt bleibt im Browser des Geräts und wird nirgendwohin
übertragen.

## Keine Verbindung zu IHK oder AkA

Privates Lernprojekt. Keine Verbindung zu einer Industrie- und Handelskammer,
zur AkA oder zu einem Prüfungsausschuss. Die Inhalte sind weder amtlich noch von
einer dieser Stellen geprüft. Alle Angaben ohne Gewähr.

Ausführlich: [doku/LIESMICH.md](doku/LIESMICH.md).
