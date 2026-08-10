# AzubiPass

Lernzettel und Prüfungstraining für Kaufleute für Büromanagement — als
installierbare App, die ohne Netz läuft.

## Sofort ansehen

Die App braucht einen Server. Ein Service Worker und `fetch` funktionieren nicht
über `file://`, ein Doppelklick auf `app.html` reicht also nicht mehr.

    cd seite
    python3 -m http.server 4502

Dann `http://localhost:4502/app.html` öffnen. Die einzelnen Lernzettel
(`lf3.html` und so weiter) lassen sich weiterhin auch direkt öffnen; nur
Startseite, Suche und Offline-Betrieb brauchen den Server.

Enthalten sind alle **13 Lernfelder mit zusammen 75 Kapiteln**:

| Datei | Lernfeld | Kapitel | Jahr |
|---|---|---|---|
| lf1.html | LF 1 · Die eigene Rolle im Betrieb | 7 | 1 |
| lf2.html | LF 2 · Büroprozesse gestalten | 6 | 1 |
| lf3.html | LF 3 · Aufträge bearbeiten | 6 | 1 |
| lf4.html | LF 4 · Sachgüter beschaffen und Verträge schließen | 7 | 1 |
| lf5.html | LF 5 · Kunden akquirieren und binden | 6 | 2 |
| buchfuehrung.html | LF 6 · Werteströme erfassen und beurteilen | 9 | 2 |
| lf7.html | LF 7 · Gesprächssituationen gestalten | 4 | 2 |
| lf8.html | LF 8 · Personalwirtschaftliche Aufgaben | 6 | 2 |
| lf9.html | LF 9 · Liquidität sichern und Finanzierung | 6 | 3 |
| lf10.html | LF 10 · Wertschöpfungsprozesse steuern | 6 | 3 |
| lf11.html | LF 11 · Geschäftsprozesse darstellen und optimieren | 4 | 3 |
| lf12.html | LF 12 · Veranstaltungen und Geschäftsreisen | 4 | 3 |
| lf13.html | LF 13 · Ein Projekt planen und durchführen | 4 | 3 |

Dazu 96 interaktive Grafiken, 139 Karteikarten, 138 Übungsfragen und
343 Begriffe und Gesetzestexte.

## Die App

`app.html` ist die Schale mit fünf Bereichen:

- **Heute** — wo du weitermachst, Countdown zur AP2, Gesamtfortschritt,
  Wochenziel, fällige Karten.
- **Lernen** — die 13 Lernfelder mit Fortschrittsbalken.
- **Üben** — fällige Karteikarten, Übungsfragen, Schwachstellen.
- **Suche** — Volltext über alle Lernfelder plus Begriffe und Paragraphen.
- **Ich** — Fortschritt im Detail, Lesezeichen, Sicherung, helle/dunkle Farben.

Auf dem Handy fragt die App beim ersten Besuch, ob sie auf den Startbildschirm
darf. Danach startet sie ohne Browserleiste und läuft ohne Netz.

**Auf dem iPhone ist das Installieren kein Komfort, sondern Datenschutz für
deinen Lernstand:** Safari räumt den Speicher gewöhnlicher Webseiten nach sieben
Tagen ohne Besuch auf. Für Seiten auf dem Startbildschirm gilt das nicht.

## Karteikarten

Die Karten werden nicht gepflegt — sie entstehen aus dem Pflichtfeld
`karteikarte` jedes `merke`-Blocks. Der Trainer läuft an zwei Stellen mit
demselben Stand: am Ende jedes Lernzettels (nur dieses Lernfeld) und unter
„Üben" in der App (alle Lernfelder).

Fünf Fächer mit Wartezeit: sofort · 1 Tag · 3 Tage · 7 Tage · 21 Tage. Gewusst
schiebt eine Karte ein Fach weiter, nicht gewusst zurück auf eins. Gezogen wird
nur, was auch fällig ist — man kann eine Karte nicht dreimal in derselben Minute
„gewusst" klicken und sie damit für erledigt erklären. Genau die Zeitkomponente
macht verteiltes Wiederholen wirksam.

Jede Karte hat eine Kennung aus Lernfeld, Kapitel, Abschnitt und laufender
Nummer (`lf10-k4-b2-m1`). Vorher hing ihr Stand an der Position im Stapel: Kam
irgendwo ein Merksatz dazu, rutschte alles dahinter um eins und der Lernstand
zeigte still auf fremde Karten.

## Selbst neu bauen

Im Ordner `quellen/` liegt alles, woraus die Seiten entstehen. Gebaut wird nach
`../seite/`, gemeinsame Dateien nach `../seite/mittel/`.

    python3 schriften.py        # einmalig: Schriften holen und selbst ausliefern
    python3 build.py            # alle Lernzettel (oder: build.py lf5.lernfeld.json)
    python3 build_app.py        # App, Manifest, Zwischenspeicher, Suche, Rechtsseiten
    python3 build_landing.py    # Startseite

    python3 pruefe.py           # Sichtprüfung — sieht es richtig aus?
    python3 funktionstest.py    # Funktionstest — tut es, was es verspricht?

Die Reihenfolge ist wichtig: `build_app.py` liest, was `build.py` erzeugt hat.

`schriften.py` läuft nur einmal. Danach liegen die achtzehn Schnitte als eigene
Dateien in `seite/mittel/`, es geht keine Anfrage mehr an Google — und die
Lernzettel sehen auch ohne Netz richtig aus.

### Warum Stil und Verhalten nicht mehr in jeder Seite stehen

Bis vor Kurzem war jede Seite eigenständig: CSS und JavaScript steckten in jeder
Datei. Mit selbst ausgelieferten Schriften ginge das nicht mehr auf — die
Schnitte wiegen zusammen ein Megabyte, vierzehnmal eingebettet wären das über
zwanzig. Jetzt liegen Stil, Verhalten und Schriften in `seite/mittel/` und der
Browser holt sie genau einmal. Preis dafür: Eine einzelne `lf3.html` lässt sich
nicht mehr allein weitergeben, sie braucht den Ordner `mittel/` daneben.

### Die beiden Prüfungen

`pruefe.py` rendert jede Seite in **beiden Größen** (390 × 844 und 1440 × 1100)
und **beiden Farbstimmungen** und meldet: zu geringen Kontrast nach WCAG,
Überlappungen, sich überdeckende Grafikbeschriftungen, ungenutzte Zeichenfläche,
Tippziele unter 44 px, seitlichen Überlauf, verbotene Wörter und Emojis.
`--schnell` beschränkt auf Handy und Hell.

`funktionstest.py` klickt sich durch: Sprungverteiler und Zurück-Taste,
Kommazahlen in den Rechnern, ein Konto statt dreizehn, Karten an Kennungen,
die fünf Schirme, Suche, Sicherung, dunkle Stimmung, Übernahme des alten
Bestands, Lesen ohne Netz.

Beide geben 1 zurück, wenn etwas gefunden wurde — damit taugen sie als
Freigabe-Tor.

## Prüf-Marker

Angaben, die von Jahreswerten abhängen — Basiszinssatz, Verpflegungspauschalen,
Aufbewahrungsfristen, Betragsgrenzen —, stehen nicht als geratene Zahl in den
Daten. Sie bekommen ein `pruefen`-Feld, das sichtbar auf der Seite erscheint und
von `build.py` und `pruefe.py` gezählt wird.

`build.py` vergleicht gezählte gegen tatsächlich gerenderte Marker. Steht ein
`pruefen` an einer Stelle, die es nicht anzeigt — etwa tief in den Daten einer
Grafik —, meldet der Build einen FEHLER. Eine Warnung, die niemand sieht, ist
schlimmer als keine: Sie täuscht Sicherheit vor.

## Fortschritt

Alles liegt in **einem** Eintrag im Browser: `azubipass:konto`. Darin stehen
gelesene Kapitel, abgehakte Lernziele, beantwortete Checks und Zuordnungen,
getippte Selbsttest-Antworten, der Kartenstand, Lesezeichen und die Tage, an
denen gelernt wurde. Nichts davon verlässt das Gerät.

Vorher lag pro Lernzettel ein eigener Eintrag, und keiner wusste vom anderen —
ein Gesamtfortschritt, eine Suche über alles oder ein Kartenstapel aus allen
Lernfeldern waren damit nicht zu haben. Beim ersten Start werden alte Einträge
übernommen; der alte Kartenstand bewusst nicht, weil er an Positionen hing.

Jede **einzelne Aufgabe** trägt einen Abdruck ihres Textes. Ändert sich eine
Frage, wird genau diese Antwort verworfen. Vorher hing der Abdruck am ganzen
Kapitel: Ein korrigiertes Komma warf Haken, Checks, Zuordnungen und getippte
Antworten des kompletten Kapitels weg.

Unter „Ich" lässt sich der Stand als Datei sichern und wieder einspielen. Beim
Einspielen wird zusammengeführt statt überschrieben; bei Karten gewinnt das
höhere Fach.

## Rechtliches

`quellen/rechtliches.json` trägt die Angaben für Impressum und
Datenschutzerklärung. `build_app.py` erzeugt daraus `impressum.html` und
`datenschutz.html` und **warnt, solange Pflichtangaben fehlen** — die Seiten
tragen dann zusätzlich einen sichtbaren Hinweis.

Abgedeckt sind: Anbieterkennzeichnung nach § 5 DDG, Information nach Art. 13
DSGVO, die Einordnung des lokalen Speichers als technisch notwendig nach
§ 25 Abs. 2 Nr. 2 TDDDG (deshalb kein Cookie-Banner), Haftungsausschluss für die
Lerninhalte, die ausdrückliche Distanzierung von IHK, AkA und
Prüfungsausschüssen sowie die Lizenzhinweise der beiden Schriftfamilien
(SIL Open Font License 1.1).

**Nicht abgedeckt** ist alles, was erst beim Verkaufen nötig wird: AGB,
Widerrufsbelehrung, Verbraucherstreitbeilegung. In `rechtliches.json` steht
dafür `inhalt.verkauf`. Solange das `false` ist, wird nichts davon erzeugt —
absichtlich, denn diese Texte gehören nicht automatisch generiert.

## Noch offen

- **Anbieteranschrift und E-Mail** in `quellen/rechtliches.json` eintragen.
  Ohne sie darf die Seite in Deutschland nicht öffentlich stehen; `build_app.py`
  sagt das bei jedem Lauf.
- **Acht offene Prüf-Marker** fachlich klären, verteilt auf LF1, LF2, LF3, LF4,
  LF9 und LF12. `pruefe.py` listet sie beim Durchlauf auf.
- **`frei`-Grenze auswerten.** In den Lernfeld-Dateien steht pro Kapitel
  `frei: true/false`, `build.py` liest das nie. Solange nichts verkauft wird,
  gibt es dafür auch keinen Grund.
- Vorschaubild `teilen.png` für geteilte Links.
