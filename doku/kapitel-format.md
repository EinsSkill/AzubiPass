# AzubiPass · Kapitel-Format

Ein Kapitel ist eine Datenstruktur, kein HTML. Aus derselben Datei entstehen später
Webansicht, PDF und Karteikarten. Wenn du ein Kapitel schreibst, füllst du Felder aus —
Aussehen, Animation und Interaktion kommen aus dem System.

## Zwei Dateiarten

**Lernfeld-Datei** (`buchfuehrung.lernfeld.json`) — einmal pro Lernfeld.
Enthält Meta-Daten, die Kapitelliste und die beiden gemeinsamen Speicher:
`begriffe` und `paragraphen`.

**Kapitel-Datei** (`k1-grundlagen.kapitel.json`) — eine pro Kapitel.
Enthält Lernziele, Blöcke, Zusammenfassung, Selbsttest, Prüfungstipp.

Begriffe und Gesetzestexte stehen **nur** in der Lernfeld-Datei. Ein Kapitel verweist
darauf. Änderst du § 238 HGB einmal, ist er in allen neun Kapiteln korrigiert.

---

## Text-Auszeichnung

In allen Textfeldern gilt dieselbe kleine Syntax:

| Schreibweise | Ergebnis |
|---|---|
| `**fett**` | fett |
| `*kursiv*` | kursiv |
| `==Text==` | goldene Hervorhebung (sparsam — max. 1× pro Absatz) |
| `{{begriff:kaufmann\|Kaufmann}}` | aufklappbare Begriffserklärung |
| `{{par:hgb-238\|§ 238 HGB}}` | aufklappbarer Gesetzestext |

Bei den Verweisen steht vor dem `|` die ID aus der Lernfeld-Datei, dahinter das Wort,
wie es im Satz erscheinen soll. So kannst du beugen: `{{begriff:kaufmann|Kaufleute}}`.

**Regel:** Ein Begriff wird pro Kapitel nur beim *ersten* Auftreten verlinkt.
Alles Weitere ist Lärm.

---

## Kapitel-Felder

```
id, lernfeld, nummer, titel, untertitel, minuten
lernziele[]   { id, text, abschnitt }
bloecke[]     die eigentlichen Inhalte
zusammenfassung[]  Sätze, keine Absätze
selbsttest[]  { typ, frage, loesung }
pruefungstipp
```

`lernziele[].abschnitt` zeigt auf die `id` eines Abschnitts. Genau daran hängt die
Fortschrittslogik: Sobald jemand den Abschnitt liest, hakt sich das Lernziel ab.
**Jedes Lernziel braucht einen Abschnitt — sonst kann es nie erreicht werden.**

---

## Blocktypen

### `abschnitt`
Der Rahmen. Hat `id`, `titel` und `inhalt[]` mit den folgenden Bausteinen.

### `absatz`
`text` — Fließtext mit Auszeichnung. Zwei bis fünf Sätze. Längere Absätze werden
am Handy zur Wand.

### `tabelle`
`spalten[]`, `zeilen[]`. Jede Zeile: `zellen[]`, optional `mono[]` (Spaltenindizes,
die in Monospace gesetzt werden — für §-Angaben und Beträge) und optional `detail`
(Text, der sich beim Anklicken der Zeile ausklappt).

`detail` ist der Ort für Beispiele, Verstöße und Begründungen, die den Haupttext
sonst aufblähen würden.

### `merke`
`text` plus `karteikarte` — die Frage, auf die dieser Merksatz die Antwort ist.
**Das Feld `karteikarte` ist Pflicht.** Daraus entsteht der Fragen-Trainer, ohne dass
du je Karteikarten separat schreiben musst.

Der Trainer ist gebaut: Jeder Merksatz landet als Karte im Leitner-Kasten am Ende
des Lernzettels. Schreib die Frage deshalb so, dass sie **allein stehen kann** —
im Trainer fehlt der Absatz davor. Statt „Warum ist das so?" also „Warum wächst
ein Passivkonto im Haben?".

### `achtung`
`text`. Nur für echte Fallen: teure Fehler, Verwechslungen, rechtliche Folgen.
Höchstens zwei pro Kapitel, sonst nutzt sich die Farbe ab.

### `praxistipp`
`text`. Anwendung, Merkstrategie, Eselsbrücke.

### `vertiefung`
`titel` plus `absaetze[]`. Zugeklappt. Für Wissen, das nicht jeder braucht —
Hintergründe, Herleitungen, Sonderfälle. Nie für Prüfungsrelevantes.

### `check`
`frage` plus `optionen[]` mit `text`, `richtig` (genau eine) und `echo`.

`echo` ist die Rückmeldung zu **jeder** Antwort, auch den falschen — und dort ist sie
sogar wichtiger. Schreib bei falschen Optionen hin, *warum* sie plausibel wirkt und
woran man den Unterschied erkennt. Ein Check ohne gute Echos ist ein Quiz; einer mit
guten Echos ist Unterricht.

Maximal ein Check pro Kapitel, direkt nach dem Stoff, auf den er sich bezieht.

### `zuordnen`
`lead`, `kategorien[]` (2–4), `aufgaben[]` mit `text` und `loesung`.
Gut für Begriffspaare, die verwechselt werden.

### `grafik`
Die Schlüsselgrafik des Kapitels. `variante` bestimmt das Bauteil:

- `stufen` — mehrstufige Erklärung, hier Inventur → Inventar → Bilanz
- `veraenderung` — Bilanzveränderungen als wachsende Säulen
- `t-konto` — Geschäftsvorfall wählen, Beträge laufen in beide Konten
- `kette` — Abschlusskette
- `kalkulationsleiter` — Zuschlagskalkulation Stufe für Stufe
- `vergleich` — zwei Seiten gegenübergestellt
- `organigramm` — Aufbauorganisation und Dienstweg
- `kreislauf` — Wirtschaftskreislauf, baut sich selbst auf
- `staffel` — Fristen und Termine auf einer Zeitachse
- `brief` — Geschäftsbrief nach DIN 5008, Zonen anklickbar
- `lagerkurve` — Sägezahn mit Melde-, Mindest- und Höchstbestand, vier Regler
- `matrix` — Zwei Achsen, vier Felder, Aufgaben per Klick einsortieren
- `liquiditaet` — Monatsbalken mit Bestandslinie, Regler für Zahlungsziel
- `breakeven` — Erlös- und Kostengerade mit Schnittpunkt, drei Regler
- `durchlauf` — Balken aus Bearbeitungs-, Liege-, Transport- und Prüfzeit
- `balkenplan` — Vorgänge auf einer Zeitachse mit Abhängigkeiten und kritischem Pfad

`stufen` kennt zusätzlich das Feld `darstellung` je Stufe: `zaehlen`, `verzeichnis`
oder `bilanz-rechner` (die mitrechnende Bilanz mit Eingabefeldern).

Steht in `variante` etwas, das es nicht gibt, bleibt die Fläche nicht leer —
es erscheint sichtbar „Bauteil … ist noch nicht gebaut."

### Wo keine Verweise stehen dürfen

Manche Felder werden mit `html.escape` ausgegeben und nicht durch die
Auszeichnungssyntax geschickt. Ein `{{begriff:…}}` landet dort **roh auf der
Seite**. Betroffen sind:

- Kapitel-`titel` und `untertitel`
- bei Grafiken: `kopf`, `titel`, `lead`
- im Selbsttest: `typ`
- im Hero: `ueberschrift`, `lead`, `fakten`

`pruefe.py` fängt das ab und meldet unaufgelöste Verweise. Verwende in diesen
Feldern schlichten Text und setze den Verweis in den zugehörigen Absatz.

### Prüf-Marker

Jeder Block darf ein Feld `pruefen` tragen. Der Text erscheint sichtbar unter dem
Block und wird von `build.py` und `pruefe.py` gezählt. Gedacht ist er für alles,
was von Jahreswerten abhängt: Beitragssätze, Pauschalen, Fristen, Betragsgrenzen.

**Lieber ein sichtbarer Marker als eine geratene Zahl.** Bei einem Produkt, für
das Geld genommen wird, ist eine falsche Angabe teurer als eine offene Stelle.

Ein `pruefen` in den Unterdaten einer Grafik — etwa an einem einzelnen Punkt
eines `vergleich` — wird nicht angezeigt. `build.py` erkennt diesen Fall und
meldet ihn als FEHLER. Setz den Marker stattdessen an den Grafik-Block selbst.

Am Lernfeld statt am Block gesetzt, gilt er für den ganzen Lernzettel und
erscheint auf dem Deckblatt.

**Höchstens eine Grafik pro Kapitel.** Sie ist der Moment, den man dem Produkt
zutraut — und der teuerste Teil in der Herstellung.

---

## Faustregeln pro Kapitel

| Element | Menge |
|---|---|
| Abschnitte | 3–5 |
| Grafik | max. 1 |
| Check | max. 1 |
| Zuordnen | max. 1 |
| Achtung | max. 2 |
| Merke | 1 pro Abschnitt |
| Begriffe | unbegrenzt — sie stören nur, wenn man sie anklickt |
| Vertiefung | 1–2 |

---

## Was noch fehlt

1. **Free-Kennzeichnung auswerten.** In der Lernfeld-Datei steht pro Kapitel
   `frei: true/false`. `build.py` liest das Feld bisher nicht, sodass jede Datei
   alle Kapitel enthält. Ohne diese Auswertung gibt es kein Produkt zu verkaufen.
2. **Quellenfeld.** Für die fachliche Prüfung wäre je Abschnitt ein Feld sinnvoll,
   in dem steht, worauf sich der Inhalt stützt. Das kostet beim Schreiben Zeit und
   spart sie, sobald sich ein Gesetz ändert.
3. **Übungsaufgaben.** Bisher gibt es Selbsttest und Checks. Ob zusätzlich ein
   gesammelter Aufgabenteil ans Kapitelende gehört, ist nicht entschieden.
