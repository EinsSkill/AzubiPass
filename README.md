# AzubiPass

> Lernen, üben und sicherer in die Prüfung gehen – als installierbare Lernplattform für Kaufleute für Büromanagement.

AzubiPass bündelt Lernzettel, Kapitel, Karteikarten und interaktive Übungsfragen in einer offlinefähigen Web-App. Das Projekt ist auf verständliches Lernen, eigenständiges Üben und einen praktischen Prüfungssimulator ausgerichtet.

[![Projekt öffnen](https://img.shields.io/badge/GitHub-Projekt_öffnen-173f35?style=for-the-badge&logo=github&logoColor=white)](https://github.com/EinsSkill/AzubiPass)

## Was steckt drin?

- alle 13 Lernfelder des KMK-Rahmenlehrplans
- 75 Kapitel und 96 interaktive Fachgrafiken
- 139 Karteikarten und 138 Übungsfragen
- Probeklausur mit eigenem Aufgabenbestand
- Suche, Offline-Speicher und installierbare App-Struktur
- Inhalte und Darstellung sauber voneinander getrennt

## Projektstatus

**In Arbeit – Pilot Release 0.1**

AzubiPass wird kontinuierlich als persönliches, nichtkommerzielles Open-Source-Lernprojekt weiterentwickelt. Das Repository und die Projektseite dürfen angesehen, geteilt und als Projekt gezeigt werden.

> AzubiPass ist nicht mit der IHK, AkA oder einem Prüfungsausschuss verbunden. Die Inhalte sind nicht amtlich geprüft und ersetzen keine offiziellen Unterlagen.

## Für Interessierte

Der Einstieg in die Projektstruktur:

```
quellen/        Inhalte, Aufgaben und Build-Werkzeuge
docs/           gebaute App und Projektseite
doku/           Bedienung, Formatregeln und Konzeptdokumente
```

Inhalt und Darstellung sind getrennt. Ein neues Kapitel wird als strukturierte Quelldatei ergänzt und anschließend gebaut – HTML wird nicht von Hand gepflegt.

## Lokal bauen

Voraussetzung: Python 3.

```bash
cd quellen
python schriften.py
python build.py
python build_app.py
python build_landing.py
```

## Lokal prüfen

```bash
python pruefe.py
python funktionstest.py
```

Für die lokale Ansicht:

```bash
cd docs
python -m http.server 4502
```

Danach öffnet `http://localhost:4502/` direkt das Home-Menü „Heute“.
`app.html` bleibt als bestehender App-Einstieg erhalten; die optionale
Projektvorstellung ist unter `landing.html` erreichbar.

## Rechtliches und Datenschutz

- keine Nutzerkonten
- keine Werbung und kein Verkauf
- kein Tracking
- Lernfortschritt bleibt im Browser des jeweiligen Geräts
- Schriften werden lokal ausgeliefert

Vor einer geschäftsmäßigen oder kommerziellen Veröffentlichung müssten die rechtlichen Angaben angepasst werden.

---

Ein Lernprojekt mit echtem Nutzwert – gebaut für die Ausbildung und offen dokumentiert für alle, die sich den Aufbau ansehen möchten.
