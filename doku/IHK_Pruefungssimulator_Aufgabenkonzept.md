# Prüfungssimulator — Aufgabenkonzept

**AzubiPass** · Stand 11.08.2026 · Bezugsunternehmen: MAKEL Studio GmbH, Düsseldorf
Gilt für die App unter `docs/`, gebaut aus `quellen/`.

> **Nicht mehr allein maßgeblich für den Produktumfang.**
> Gebaut ist die **Eigene Probeklausur** — eine selbst zusammengestellte
> Klassenarbeit, keine amtliche IHK-Prüfungssimulation. Was heute gilt, steht in
> [eigene-probeklausur.md](eigene-probeklausur.md); bei Widerspruch gilt jene
> Datei. Dieses Dokument bleibt erhalten, weil seine Aussagen zu Aufgabenarten,
> Operatoren, Anforderungsbereichen und Bewertung weiter tragen. Es beschreibt
> einen weiteren Umfang, als gebaut ist.

---

## 0. Leitgedanke

Der Simulator ist kein Quiz mit Prüfungsanstrich. Er ist der Versuch, das
Gefühl des Prüfungsvormittags herzustellen: ein Beleg liegt vor, die Uhr läuft
leise mit, niemand sagt einem, ob es stimmt. Was ihn von einer Papierklausur
unterscheidet, ist nicht Buntheit, sondern dass die Eingabe mitdenkt — das
T-Konto füllt sich beim Tippen, die Bilanz kippt sichtbar in die Waage.

Drei Regeln, an denen jede spätere Entscheidung gemessen wird:

1. **Die Spielerei kommt aus der Sache.** Ein mitrechnendes Konto ist gut, weil
   Buchen so funktioniert. Ein Punktestand mit Feuerwerk ist es nicht.
2. **Im Klausurmodus hilft nichts.** Kontenplan und Rechner, sonst nichts.
3. **Die Auswertung ist das Produkt.** Die Klausur ist der Anlass; der Wert
   entsteht in dem, was danach auf dem Bogen steht.

---

## 1. Aufgabentypen

Sechs Typen decken das Lernfeld Buchführung vollständig ab und lassen sich
später auf die übrigen Lernfelder übertragen.

### 1.1 Buchungssatz (`buchungssatz`)

Der Kerntyp. Kontofeld mit Autovervollständigung aus dem IKR-Auszug, Soll und
Haben, Betragsfelder. Mehrere Zeilen je Seite möglich (zusammengesetzter
Buchungssatz).

*Interaktion:* Neben dem Eingabefeld stehen zwei leere T-Konten. Sobald ein
Konto erkannt wird, bekommt es seine Beschriftung; sobald ein Betrag steht,
läuft er in die richtige Seite ein.

**Im Klausurmodus bleibt es dabei.** Das T-Konto zeigt ausschließlich, was man
eingetippt hat — keine Prüfung, keine Farbe, kein Hinweis, wenn Soll und Haben
nicht aufgehen. In der echten Prüfung sagt einem das auch niemand, und wer sich
an die Anzeige gewöhnt, verliert genau die Selbstkontrolle, auf die es ankommt.

*Im Übungsmodus* darf die Summenzeile mitrechnen und eine Ungleichheit
anzeigen.

*Bewertung:* Teilpunkte je Zeile — Kontenbezeichnung, Seite, Betrag getrennt.

### 1.2 Rechenweg (`rechenweg`)

Abschreibung, Kalkulationsschema, Skonto, Umsatzsteuerzahllast. Mehrere
Eingabefelder, jedes für sich bepunktet.

*Interaktion:* Die Zwischenschritte stehen als Staffel untereinander, wie ein
Kalkulationsschema auf Papier. Beim Verlassen eines Feldes rutscht das Ergebnis
in die nächste Zeile weiter — als Übernahme, nicht als Korrektur.

*Bewertung:* Punkt je Feld, Toleranz auf zwei Nachkommastellen. **Folgefehler
werden nicht doppelt bestraft:** ein falscher Zwischenwert kostet einmal, der
darauf aufbauende Schritt gilt als richtig, wenn er mit dem eigenen Wert
richtig gerechnet wurde.

### 1.3 Tabelle füllen (`tabelle`)

Inventar, Bilanz, GuV, Kontenabschluss.

*Interaktion im Übungsmodus:* Summenzeilen rechnen live mit. Bei Bilanzen liegt
über der Tabelle eine schmale Waage: Aktiv und Passiv als zwei Balken, die sich
angleichen, während man tippt. Kein Häkchen, kein Lob — die Waage steht
irgendwann gerade, das genügt.

*Im Klausurmodus:* keine Waage, keine mitlaufende Summe. Summen werden selbst
gebildet und eingetragen, wie auf Papier.

### 1.4 Zuordnung (`zuordnung`)

Kontenklassen, Bestands- gegen Erfolgskonten, Belegarten, Aktiv-/Passivtausch.

*Interaktion:* Ziehen mit weichem Einrasten. Auf dem Handy alternativ:
antippen, Ziel antippen.

### 1.5 Gebundene Aufgabe (`auswahl`)

Einfach- und Mehrfachauswahl. Hat in der AP1 einen realen Anteil und gehört
deshalb dazu — nicht als Lückenfüller, sondern in prüfungsüblicher Machart mit
plausiblen Falschantworten.

### 1.6 Offene Antwort (`offen`)

Begründungen, Nennen und Erläutern, Vorschläge an die Geschäftsführung. Der
einzige Typ, der sich offline nicht selbst korrigieren lässt.

*Ablauf:* Freitextfeld → abgeben → Musterlösung erscheint → darunter das
Punkteraster als einzelne Kriterien zum Abhaken:

```
[ ] Bilanzidentität genannt                          1 P.
[ ] § 252 Abs. 1 Nr. 1 HGB als Grundlage genannt     1 P.
[ ] Folge für den Jahresabschluss beschrieben        2 P.
```

Die Punkte summieren sich selbst. Das ist ehrlicher als eine Schätzung und
nebenbei ein zweiter Lerndurchgang: man muss die Musterlösung Kriterium für
Kriterium durchgehen, statt sie zu überfliegen.

---

## 2. Feste und variable Aufgaben

Eine Mischform: **Rechenaufgaben variabel, alles andere fest.**

Variabel sind die Typen, bei denen Wiederholung den Weg trainiert —
Buchungssätze, Abschreibung, Kalkulation, Skonto. Fest bleibt alles, wo die
Formulierung selbst die Denkarbeit trägt: offene Aufgaben, Zuordnungen,
gebundene Aufgaben.

### Aufbau einer variablen Aufgabe

```json
{
  "id": "buchf-k4-012",
  "typ": "buchungssatz",
  "kapitel": "LF4-K4",
  "schwierigkeit": 2,
  "punkte": 4,
  "variablen": {
    "menge":  { "von": 40, "bis": 120, "schritt": 10 },
    "preis":  { "von": 18, "bis": 34,  "schritt": 0.5 },
    "ust":    { "fest": 0.19 }
  },
  "abgeleitet": {
    "netto":  "menge * preis",
    "steuer": "runde(netto * ust, 2)",
    "brutto": "netto + steuer"
  },
  "beleg": "eingangsrechnung",
  "text": "Deniz Aydın legt Ihnen die Rechnung der Weberei vor.",
  "loesung": [
    { "soll": "6000", "haben": null, "betrag": "netto" },
    { "soll": "2600", "haben": null, "betrag": "steuer" },
    { "soll": null, "haben": "4400", "betrag": "brutto" }
  ]
}
```

**Plausibilitätsgrenzen sind Pflicht.** Die Bereiche müssen zu MAKEL passen —
ein Hoodie kostet keine 4.000 €, ein Stoffeinkauf keine 12 €. Und die Schritte
sollten so gewählt sein, dass möglichst glatte Werte herauskommen; krumme
Cent-Beträge nerven, ohne etwas zu lehren.

**Fester Startwert.** Der Zusammensteller würfelt mit einem Seed, der zur
Klausur gespeichert wird. Damit lässt sich dieselbe Klausur später
originalgetreu wieder aufrufen — für die Nachbesprechung oder für zwei Leute,
die dieselbe schreiben wollen.

---

## 3. Belege

Der Punkt, der den Simulator von jeder anderen Lern-App trennt. Statt „Es wurde
Ware auf Ziel gekauft" liegt eine Rechnung vor, und die Aufgabe lautet nur noch:
**Buchen Sie den Geschäftsvorfall.** Genau so kommt es in der Prüfung.

Belege sind **gebautes HTML, keine Bilder** — dann bleiben sie scharf, druckbar,
durchsuchbar und lassen sich mit den variablen Zahlen befüllen.

Optik: echt wirkend, mit MAKEL-Markenoptik. Eigener Briefkopf, Wortmarke,
Anschrift Düsseldorf, Steuernummer, Bankverbindung, Zahlungsbedingungen. Ein
Dokument, das man ohne Zögern für echt hielte. Der Vermerk „Übungsbeleg" steht
klein **außerhalb** des Belegkörpers, im Rand der Aufgabe — rechtlich sauber,
ohne die Illusion zu stören.

**Sechs Vorlagen decken das ganze Lernfeld ab:**

| Vorlage | Verwendung |
|---|---|
| Ausgangsrechnung | Wholesale an Händler, Marlene Voß |
| Eingangsrechnung | Stoff, Druckfarbe, Dienstleister; Deniz Aydın |
| Lieferschein | Wareneingang, Mengenabweichungen; Jonas Weidner |
| Kontoauszug | Zahlungseingänge, Skontoabzug, Bankgebühren |
| Kassenbon KANTE | Tageseinnahmen, Kleinbetragsrechnung |
| Gutschrift / Storno | Korrekturbuchungen nach Lucas Fehlern |

Jede Vorlage ist ein Baustein mit Platzhaltern; die Aufgabe nennt nur
`"beleg": "eingangsrechnung"` und liefert die Werte.

---

## 4. Der Zusammensteller

Kein Generator im KI-Sinn — die App läuft offline. Ein Auswahlverfahren nach
Regeln, das aus dem Vorrat eine Klausur baut.

**Eingabe:** Kapitel (Mehrfachauswahl), Dauer, Schwierigkeit.
**Ausgabe:** eine Klausur mit passender Punktzahl, gemischtem Typenspektrum und
sinnvoller Reihenfolge.

### Die reale Prüfungsstruktur als Vorgabe

| Prüfungsbereich | Zeit | Gewicht | simulierbar? |
|---|---|---|---|
| Informationstechnisches Büromanagement (Teil 1) | 120 Min | 25 % | **nein** — wird am PC in Word/Excel bearbeitet |
| Kundenbeziehungsprozesse | 150 Min | 30 % | **ja — Zielbereich** |
| Fachaufgabe in der Wahlqualifikation | max. 20 Min | 35 % | nein — mündlich |
| Wirtschafts- und Sozialkunde | 60 Min | 10 % | **ja — leicht zu bauen** |

Quelle: Verordnung vom Februar 2025, Angaben der IHKs.

**Teil 1 wird nicht simuliert.** Eine nachgebaute Word/Excel-Prüfung wäre eine
Attrappe. Ehrlicher ist, das offen zu sagen und die Vorbereitung darauf über
Erklärungen und Snacks zu leisten.

### Aufbau Kundenbeziehungsprozesse — zwei getrennte Blöcke

Die 150 Minuten teilen sich auf in **90 Minuten offene Aufgaben** (regional
ausgewertet) und **60 Minuten gebundene Aufgaben** (zentral ausgewertet). Die
Klausur ist also keine gemischte Reihe, sondern zwei Blöcke nacheinander.

Daraus folgt die Typenquote — deutlich anders als zunächst angenommen:

**Block 1 — offen (90 Min, ca. 60 % der Punkte)**

| Typ | Anteil im Block |
|---|---|
| Offene Antwort | 40 % |
| Buchungssatz | 25 % |
| Rechenweg | 25 % |
| Tabelle | 10 % |

Damit wird die **Selbstbewertung mit Punkteraster zum Kernstück**, nicht zum
Randfeature. Sie muss entsprechend sorgfältig gebaut sein.

**Block 2 — gebunden (60 Min, ca. 40 % der Punkte)**

| Typ | Anteil im Block |
|---|---|
| Gebundene Aufgabe | 50 % |
| Zuordnung | 30 % |
| Ausfüllfeld (Zahl, Datum, Begriff) | 20 % |

Automatisch auswertbar, kein Punkteraster nötig.

### Aufbau Wirtschafts- und Sozialkunde

60 Minuten, praktisch nur gebundene Aufgaben, Zuordnungen und Ausfüllfelder.
Die mit Abstand günstigste Klausur zu bauen — und die, die viele unterschätzen.
Inhaltlich aus den WiSo-Lernfeldern, nicht aus dem Rechnungswesen.

### Vorlagen

Fertige Vorlagen zum Antippen, daneben immer die freie Auswahl:

- **Kundenbeziehungsprozesse komplett** — 150 Minuten, beide Blöcke
- **Nur offener Teil** — 90 Minuten
- **Nur gebundener Teil** — 60 Minuten
- **Wirtschafts- und Sozialkunde** — 60 Minuten
- **Lernfeld-Klausur** — 60 Minuten, ein Lernfeld
- **Sprint** — 30 Minuten, gewählte Kapitel
- **Letzte Woche** — Schwerpunkt auf dem, was zuletzt schwach war
- **Frei zusammenstellen** — Kapitel, Dauer, Schwierigkeit selbst wählen

### Aufbau der Klausur

Eine **Mischung aus Situationsaufgaben und Einzelaufgaben** — wie in der echten
Prüfung. Etwa zwei Drittel des Umfangs entfallen auf Situationsaufgaben: ein
Geschäftsvorfall bei MAKEL, dazu drei bis fünf Teilaufgaben, die aufeinander
aufbauen (Beleg prüfen → buchen → Auswirkung auf die Bilanz → begründen). Das
restliche Drittel sind Einzelaufgaben, die gezielt einzelne Kapitel abdecken,
die sonst durchs Raster fielen.

Situationsaufgaben liegen als Bündel im Vorrat, nicht als Einzelaufgaben — der
Zusammensteller zieht sie am Stück.

### Reihenfolge innerhalb der Klausur

---

## 5. Die zwei Modi

### Die Grundregel: Darstellung ja, Bewertung nein

Die Trennlinie läuft nicht zwischen „hübsch" und „nüchtern", sondern zwischen
**Darstellung** und **Bewertung**.

| | Klausurmodus | Übungsmodus |
|---|---|---|
| Beleg gleitet herein, Übergänge zwischen Aufgaben | ja | ja |
| T-Konto zeigt Eingetipptes gesetzt an | ja | ja |
| Summe rechnet mit, Waage gleicht sich an | **nein** | ja |
| Farbe für richtig/falsch, Häkchen | **nein** | ja |
| Einrasten nur bei richtiger Zuordnung | **nein** | ja |

Erlaubt ist alles, was ein Blatt Papier auch könnte — nur schöner gesetzt.
Verboten ist alles, was verrät, ob es stimmt.

### Prüfungsnähe im Inhalt

Wichtiger als die Optik:

- **Operatoren wie in der Prüfung** — Nennen, Beschreiben, Erläutern, Berechnen,
  Beurteilen. Jedes Wort steht für eine bestimmte Antworttiefe und Punktzahl.
  Aufgaben, die „Was ist…?" fragen, trainieren das Falsche.
- **Handlungsorientierte Situationen** aus der Rolle des Azubis bei MAKEL, mit
  nummerierten Anlagen statt bloßer Aufgabentexte.
- **Punkteangabe an jeder Teilaufgabe**, damit man die Zeiteinteilung mitübt.

### Klausurmodus

Ernst gemeint. Zur Verfügung stehen **nur Kontenplan und Taschenrechner**,
beide als schlichte Leisten am Rand — der Kontenplan aufklappbar und
durchsuchbar, aber ohne jeden Hinweis darauf, welches Konto zur aktuellen
Aufgabe passt. Lernzettel, Glossar und Suche sind gesperrt; wer das Fenster
verlässt, bekommt beim Zurückkommen einen kurzen Hinweis, dass die Zeit
weiterlief.

Kein Feedback während der Bearbeitung. Kein Häkchen, keine Farbe, keine
Zwischenwertung.

**Optik: AzubiPass-Dokument, nicht AzubiPass-App.** Schriften, Grün und Gold
bleiben — gesetzt wie ein gedruckter Prüfungssatz: großzügige Ränder,
Anlagennummern, Punkte am Rand, ruhige Typografie. Was wegfällt, ist alles
App-hafte: Hero, bewegte Übergänge zwischen Bereichen, farbige Zustände. Die
Marke bleibt sichtbar, aber sie hält still.

**Navigation: Springen erlaubt, mit Übersicht.** Eine schmale Leiste zeigt alle
Aufgaben mit ihrem Stand — bearbeitet, leer, oder vom Prüfling selbst markiert
(„noch mal ansehen"). Das entspricht dem Blättern im Prüfungsheft und trainiert
nebenbei, schwierige Aufgaben zurückzustellen statt sich festzubeißen.

**Druckfassung.** Der Bogen wird ohnehin für A4 gesetzt — die Druckfassung
fällt über die vorhandene HTML→PDF-Strecke praktisch nebenbei ab, inklusive
Lösungsbogen. Wer auf Papier schreibt, trägt die Antworten danach in einer
schmalen Nachtragsmaske ein (nur Felder, keine Aufgabentexte) und bekommt
dieselbe Auswertung.

**Die Uhr ist dezent.** Eine dünne Linie am oberen Rand, die langsam
zurückweicht — keine blinkenden Ziffern. Erst bei fünfzehn Minuten Restzeit
erscheint die Zahl, bei fünf färbt sie sich. Wer die Zeit genau wissen will,
fährt darüber.

### Freies Üben

Sofortfeedback nach jeder Aufgabe, mit Erklärung, warum es falsch war — nicht
nur, dass. Sprung in den zugehörigen Lernzettel jederzeit möglich. Keine Uhr.

---

## 6. Auswertung

Nach der Abgabe kein Konfetti, sondern ein **Auswertungsbogen** im Stil eines
Prüfungsbogens:

- Punkte je Aufgabe und Teilaufgabe, erreicht von möglich
- Gesamtpunkte, Note nach dem Schlüssel (Punkte ÷ 1,5)
- darunter die **Schwächenkarte**: welche Kapitel wie viele Punkte gekostet
  haben, jeweils mit direktem Sprung in den Lernzettel

Das speist zugleich die **Bestehens-Wahrscheinlichkeit**, die als
Fortschrittsmaß ohnehin schon in der App steckt.

Die offenen Aufgaben werden dabei zuletzt durchgegangen — erst dort hakt man
das Punkteraster ab, danach steht der Bogen vollständig.

---

## 7. Meine Fehler

Ein **eigener Übungsstapel neben dem Simulator**, kein heimliches Einstreuen in
neue Klausuren. Damit bleibt jede Übungsklausur eine saubere
Standortbestimmung.

Regeln:

- Falsch beantwortete Aufgaben wandern nach der Auswertung in den Stapel.
- Bei variablen Aufgaben kommen sie **mit neuen Zahlen** zurück — wiederholt
  wird der Weg, nicht die Lösung.
- Eine Aufgabe verlässt den Stapel erst, wenn sie **zweimal in Folge** sitzt.
- Der Stapel zeigt an, aus welchem Kapitel die Häufungen stammen.

---

## 8. Einbau ins Repo

```
quellen/
  musterunternehmen.json          MAKEL — Stammdaten, Personal, Kontenplan
  belege/
    ausgangsrechnung.html         Vorlagen mit Platzhaltern
    eingangsrechnung.html
    lieferschein.html
    kontoauszug.html
    kassenbon.html
    gutschrift.html
  pruefungsaufgaben/
    lf04_k01_inventur.json        Einzelaufgaben je Kapitel
    lf04_situationen.json         Situationsbündel je Lernfeld
  build_simulator.py              baut Aufgabenvorrat + Belege
```

`build_app.py` bindet den Simulator als weiteren Bereich der App-Schale ein und
liest, was `build_simulator.py` erzeugt hat — dieselbe Reihenfolge-Logik wie
bisher.

Der Zusammensteller selbst läuft im Browser (JS), damit er offline arbeitet.
Der Vorrat wird beim Bauen als eine JSON-Datei je Lernfeld ausgeliefert und im
Offline-Speicher abgelegt.

**Prüfskripte erweitern:** `funktionstest.py` bekommt Prüfungen dafür, dass
jede Aufgabe eine auflösbare Lösung hat, dass alle Variablenbereiche
plausible Werte liefern (Stichprobe über 100 Ziehungen) und dass jede
Kontonummer im Kontenplan existiert.

---

## 9. Reihenfolge der Umsetzung

1. **Kontenplan** als eigene Datei — Grundlage für alles Weitere
2. **Belegvorlagen** bauen und einmal mit Testdaten füllen
3. **Zwei Aufgabentypen** fertig: `buchungssatz` und `offen`. Damit steht die
   Mechanik, inklusive T-Konto-Anzeige und Punkteraster.
4. **Ein Kapitel vollständig** bestücken (Buchführung, K4) — etwa 15 Aufgaben,
   davon zwei Situationsbündel
5. **Zusammensteller und Auswertungsbogen**
6. Restliche Typen, dann Kapitel für Kapitel auffüllen
7. **Meine Fehler** zuletzt — braucht erst Auswertungsdaten

Schritte 1–5 ergeben einen vorführbaren Simulator mit einem Kapitel. Das ist
der sinnvolle Zwischenstand vor dem 1. September.

---

## 10. Offen

- Wie viele Aufgaben je Kapitel? Der Zielumfang von 225–375 aus dem
  Grundkonzept ist ehrgeizig; realistisch für den Prototyp sind 15 je Kapitel.
- Punkteverteilung innerhalb einer Situationsaufgabe — feste Staffel oder je
  Bündel gepflegt?
- Sollen zwei Leute dieselbe Klausur schreiben und vergleichen können? Der Seed
  gibt es technisch her; ob es ins Produkt gehört, ist eine eigene Frage.
