# Aufgabenbausteine — Spezifikation

**AzubiPass** · Stand 11.08.2026
Universelles Format für alle 13 Lernfelder und 75 Kapitel.
Ersetzt die lernfeldspezifische Typenliste aus dem Simulator-Konzept.

---

## 1. Der Grundgedanke

Nicht zehn feste Aufgabentypen, von denen jeder eigenen Code braucht, sondern
zwei Sorten Legosteine, die jede Aufgabe frei kombiniert:

> **Aufgabe = Anzeigeblöcke + Eingabeblöcke + Bewertungsregel**

Ein einziger Renderer, unbegrenzt viele Aufgaben. Ein Buchungssatz mit Beleg ist
`beleg` + `buchungssatz`. Eine Fehlersuche im Geschäftsbrief ist `beleg` +
`hotspot`. Eine Prozessaufgabe ist `text` + `reihenfolge`. Keines davon ist ein
Sonderfall — es sind dieselben Bausteine in anderer Reihenfolge.

Der praktische Ertrag: Wenn später ein Lernfeld dazukommt oder sich die
Prüfungsordnung ändert, schreibst du Inhalte, keinen Code.

---

## 2. Anzeigeblöcke

Was der Prüfling sieht.

| Block | Inhalt | Interaktion |
|---|---|---|
| `text` | Aufgabentext, Situationsbeschreibung | — |
| `beleg` | MAKEL-Beleg aus den Vorlagen | Vergrößern, Zoom |
| `anlage` | benannte Anlage, standardmäßig zugeklappt | Auf- und zuklappen |
| `tabelle` | gegebene Daten | Spalten sortierbar |
| `organigramm` | MAKEL-Aufbau | Abteilungen aufklappen |
| `zeitstrahl` | Fristen, Ablauf, Termine | Punkte antippen |
| `diagramm` | Zahlen aus dem Betrieb | Werte beim Überfahren |
| `bild` | Foto, Skizze | Vergrößern |

Weil `anlage` ein normaler Anzeigeblock ist, bekommt praktisch jede Aufgabe das
Aufklappbare geschenkt — du musst pro Aufgabe nicht daran denken.

---

## 3. Eingabeblöcke

Was der Prüfling tut.

| Block | Eingabe | Bewertung |
|---|---|---|
| `textfeld` | Freitext | Punkteraster, Selbstbewertung |
| `zahl` | Zahl mit Einheit | automatisch, mit Toleranz |
| `auswahl` | Einfach-/Mehrfachauswahl | automatisch |
| `zuordnung` | Elemente auf Ziele ziehen | automatisch, je Treffer |
| `reihenfolge` | Schritte sortieren | automatisch, je Position |
| `hotspot` | Stellen in einem Dokument antippen | automatisch, je Treffer |
| `regler` | Wert auf einer Skala | automatisch, mit Toleranz |
| `tabelle_ausfüllen` | Felder einer Tabelle | automatisch, je Feld |
| `buchungssatz` | Konten, Seiten, Beträge | automatisch, je Zeile |
| `datum` | Datumsangabe | automatisch |

Alle außer `textfeld` sind automatisch auswertbar. Nur `textfeld` braucht das
Punkteraster zur Selbstbewertung.

**Modusverhalten:** Jeder Eingabeblock kennt zwei Verhaltensweisen. Im
Übungsmodus rechnet er mit, rastet ein und färbt sich; im Klausurmodus zeigt er
nur an, was eingetippt wurde. Das steckt im Renderer, nicht im Baustein.

---

## 4. Das Baustein-Format

```json
{
  "id": "lf08-k03-004",
  "kapitel": "LF8-K3",
  "operator": "Ordnen Sie zu",
  "anforderungsbereich": 2,
  "punkte": 4,
  "dauer_min": 3,
  "schwierigkeit": 2,
  "passt_zu": ["vorgang:personaleinstellung"],
  "variablen": null,

  "anzeige": [
    { "block": "text",
      "inhalt": "Ayla Brandt bereitet die Einstellung einer Aushilfe vor." },
    { "block": "anlage", "titel": "Anlage 1: Stellenausschreibung",
      "zugeklappt": true, "beleg": "stellenausschreibung" }
  ],

  "eingabe": [
    { "block": "zuordnung",
      "elemente": ["...", "..."],
      "ziele": ["...", "..."],
      "loesung": { "...": "..." } }
  ],

  "bewertung": { "art": "automatisch", "punkte_je_treffer": 1 },

  "erklaerung": "Warum das so ist — erscheint nur im Übungsmodus.",
  "quelle": "LF8-K3, Abschnitt 2"
}
```

### Die tragenden Felder

- **`kapitel`** — steuert die Abdeckung beim Zusammensetzen
- **`punkte` / `dauer_min`** — das Budget
- **`anforderungsbereich`** — I Wiedergeben, II Anwenden, III Beurteilen.
  Ohne dieses Feld geraten Klausuren still und leise zu leicht, weil sich
  abfragbare Aufgaben schneller schreiben.
- **`operator`** — das Prüfungswort, aus dem die Antworttiefe folgt
- **`passt_zu`** — die Klammer zu einem Vorgang
- **`variablen`** — wie im Simulator-Konzept, für Rechenaufgaben

---

## 5. Vorgänge — der Rahmen über den Kapiteln

Vorgänge dürfen **über Kapitel- und Lernfeldgrenzen laufen**. Ein Kundenauftrag
bei MAKEL geht vom Angebot über den Vertragsschluss und die Buchung bis zur
Mahnung — das sind vier Lernfelder und genau die handlungsorientierte
Betrachtung, die die Prüfung verlangt.

Der Vorgang liegt in einer eigenen Datei, nicht im Baustein:

```json
{
  "id": "vorgang:kundenauftrag-hoodies",
  "titel": "Auftrag der Modehaus Weber GmbH",
  "situation": "Marlene Voß erhält eine Anfrage über 200 Hoodies ...",
  "beleg_gemeinsam": "anfrage_weber",
  "schritte": [
    "lf05-k02-001",
    "lf03-k04-007",
    "lf06-k01-012",
    "lf09-k03-002"
  ],
  "mindestens": 3
}
```

**Die Regel beim Zusammensetzen:** Ein Vorgang wird nur gestellt, wenn
mindestens `mindestens` seiner Schritte zu den gewählten Kapiteln gehören.
Sonst zerfällt er, und seine Bausteine werden als Einzelaufgaben verwendet.

Das ist der eigentliche Kniff: **Du schreibst jeden Baustein nur einmal.** Er
funktioniert allein und im Vorgang — im Vorgang bekommt er lediglich die
gemeinsame Situation vorangestellt und wird als Teilaufgabe nummeriert.

Damit das aufgeht, müssen Bausteine **für sich verständlich** formuliert sein.
Kein „Buchen Sie diesen Vorgang" ohne Bezug, sondern ein eigener Satz, der auch
ohne Rahmen trägt. Der Vorgangstext ergänzt, er ersetzt nicht.

---

## 6. Empfohlene Muster

Blöcke sind frei kombinierbar — aber ein leeres Blatt hilft niemandem beim
Schreiben von 300 Aufgaben. Deshalb liegt zu jeder Kapitelart eine kleine
Rezeptsammlung bei, aus der man sich bedient und von der man abweichen darf.

### Kapitelart: Rechnen (Buchführung, Kalkulation, Steuerung)

| Muster | Blöcke | Punkte | Zeit |
|---|---|---|---|
| Beleg buchen | `beleg` + `buchungssatz` | 3–6 | 4 Min |
| Rechenweg | `text` + `zahl` ×3–5 | 4–8 | 6 Min |
| Abschluss | `tabelle` + `tabelle_ausfüllen` | 6–10 | 10 Min |
| Beurteilen | `diagramm` + `textfeld` | 4–6 | 6 Min |

### Kapitelart: Prozess (Beschaffung, Auftrag, Organisation, Projekt)

| Muster | Blöcke | Punkte | Zeit |
|---|---|---|---|
| Ablauf ordnen | `text` + `reihenfolge` | 3–5 | 3 Min |
| Zuständigkeit | `organigramm` + `zuordnung` | 3–4 | 3 Min |
| Entscheiden | `anlage` ×2 + `textfeld` | 5–8 | 8 Min |

### Kapitelart: Recht und Regeln (Verträge, Personal, Fristen)

| Muster | Blöcke | Punkte | Zeit |
|---|---|---|---|
| Frist bestimmen | `zeitstrahl` + `datum` | 2–4 | 3 Min |
| Fall prüfen | `text` + `auswahl` + `textfeld` | 5–8 | 7 Min |
| Regel anwenden | `beleg` + `zahl` | 3–5 | 4 Min |

### Kapitelart: Kommunikation (Schriftverkehr, Gespräche, Kunden)

| Muster | Blöcke | Punkte | Zeit |
|---|---|---|---|
| Fehler finden | `beleg` + `hotspot` | 4–6 | 5 Min |
| Formulieren | `text` + `textfeld` | 4–8 | 8 Min |
| Reaktion wählen | `text` + `auswahl` + `textfeld` | 4–6 | 5 Min |

### Kapitelart: Begriffe und Grundlagen

| Muster | Blöcke | Punkte | Zeit |
|---|---|---|---|
| Zuordnen | `text` + `zuordnung` | 3–5 | 3 Min |
| Einordnen | `text` + `auswahl` | 2–3 | 2 Min |
| Schätzen | `text` + `regler` | 2–3 | 2 Min |

Jedes der 75 Kapitel bekommt in seiner Kapiteldatei eine `kapitelart`. Damit
weiß der Aufgabenschreiber sofort, aus welchem Regal er greift — und der
Zusammensteller weiß, was er zu erwarten hat.

---

## 7. Umfang: 3–5 Bausteine je Kapitel

75 Kapitel × 3–5 ergibt **225 bis 375 Bausteine**. Breite zuerst.

### Was das für die Klausur bedeutet

Eine 150-Minuten-Klausur verbraucht rund 25–35 Bausteine. Solange man viele
Kapitel wählt, reicht der Vorrat bequem. **Eng wird es bei wenigen Kapiteln:**
Wer nur drei Kapitel ankreuzt, hat 9–15 Bausteine zur Verfügung — die zweite
Klausur wiederholt dann fast alles.

Drei Gegenmittel, in dieser Reihenfolge:

1. **Variablen.** Bei jedem rechenlastigen Baustein Zahlenbereiche hinterlegen.
   Aus 12 Bausteinen werden gefühlt 60.
2. **Warnung statt Wiederholung.** Der Zusammensteller sagt offen: „Für diese
   Auswahl gibt es 14 Aufgaben. Für eine volle Klausur bitte mehr Kapitel
   wählen." Ehrlicher als stillschweigend zu doppeln.
3. **Nachwachsen.** Bausteine, die im Einsatz gut funktionieren, werden
   nachverdichtet — die schwachen Kapitel erkennt man an der Auswertung.

Empfehlung für die Verteilung der 3–5: **einer je Anforderungsbereich.** Also
mindestens ein abfragender, ein anwendender und ein beurteilender Baustein je
Kapitel. Dann ist jede Klausur automatisch niveaugemischt, egal welche Kapitel
gewählt werden.

---

## 8. Der Zusammensteller

**Eingabe:** gewählte Kapitel, Zeitbudget, Schwierigkeit
**Ausgabe:** geordnete Klausur mit Punktesumme

Ablauf:

1. **Vorgänge zuerst.** Prüfen, welche Vorgänge genug Schritte in der Auswahl
   haben. Diese werden am Stück gesetzt, sie tragen die Handlungsorientierung.
2. **Abdeckung sichern.** Jedes gewählte Kapitel, das noch nicht vorkommt,
   bekommt mindestens einen Baustein.
3. **Budget füllen** bis das Zeitbudget erreicht ist.
4. **Niveau prüfen.** Zielverteilung etwa 30 % Anforderungsbereich I, 50 % II,
   20 % III. Weicht es stark ab, wird getauscht statt nachgelegt.
5. **Abwechslung prüfen.** Nicht drei gleichartige Eingabeblöcke hintereinander.
6. **Ordnen.** Vorgänge zusammenhängend, Einzelaufgaben nach Kapitelreihenfolge,
   leichte Aufgaben nicht alle am Anfang.
7. **Würfeln** mit gespeichertem Startwert, damit die Klausur reproduzierbar ist.

Wer ein Prüfungsformat nachstellen will (etwa den zweigeteilten Aufbau von
Kundenbeziehungsprozesse), gibt zusätzlich eine Blockstruktur vor — das ist
eine Einstellung des Zusammenstellers, keine Eigenschaft der Bausteine.

---

## 9. Ablage und Prüfung

```
quellen/
  bausteine/
    lf01.json … lf13.json        Bausteine je Lernfeld
  vorgaenge/
    kundenauftrag-hoodies.json   kapitelübergreifende Vorgänge
    personaleinstellung.json
  muster/
    kapitelarten.json            die Rezeptsammlung aus Abschnitt 6
  belege/                        die HTML-Belegvorlagen
```

`funktionstest.py` prüft zusätzlich:

- Jeder Baustein verweist auf ein existierendes Kapitel.
- Jede `beleg`-Angabe verweist auf eine vorhandene Vorlage.
- Jeder Vorgang verweist auf existierende Bausteine.
- Punkte und Dauer sind gesetzt und plausibel (grob 1 Punkt je Minute).
- Jedes Kapitel hat mindestens drei Bausteine und deckt mindestens zwei
  Anforderungsbereiche ab.
- Variablenbereiche liefern über 100 Ziehungen nur plausible Werte.

---

## 10. Wie die 300 Bausteine entstehen

Der Engpass ist nicht die Technik, sondern das Schreiben. Ein Weg, der sich
durchhalten lässt:

1. **Ein Kapitel als Muster vollständig von Hand** — damit Ton und Punkteraster
   feststehen.
2. Danach kapitelweise: Kapiteltext plus `kapitelart` plus die Muster aus
   Abschnitt 6 als Vorgabe, daraus einen Entwurf erzeugen.
3. **Jeder Entwurf wird gelesen und korrigiert.** Bei Prüfungsaufgaben rächt
   sich Ungenauigkeit sofort — eine falsche Musterlösung ist schlimmer als eine
   fehlende Aufgabe.
4. `funktionstest.py` läuft über jeden Stapel.
5. Vorgänge kommen zuletzt, wenn genug Bausteine da sind, die sich verketten
   lassen.

Reihenfolge der Kapitel: die prüfungsschweren zuerst — Rechnungswesen,
Auftragsbearbeitung, Personal, kaufmännische Steuerung.

---

## 11. Offen

- Wird `kapitelart` je Kapitel gepflegt oder aus dem vorhandenen Inhalt
  abgeleitet?
- Sollen Bausteine eine Fassung für Snacks bekommen (verkürzt, ohne Rahmen)
  oder bleiben Snacks ein eigener Bestand?
- Ab wann lohnt eine Aufgaben-Pflegeoberfläche statt JSON von Hand?
