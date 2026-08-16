# Eigene Probeklausur

Kanonische Produkt- und Architekturentscheidung. Bei Widersprüchen zu älteren
Dokumenten unter `doku/` gilt diese Datei.

Stand: 11.08.2026

---

## Was gebaut ist

**Eigene Probeklausur.** Der Nutzer wählt die Kapitel, die in seiner nächsten
Klassenarbeit vorkommen. AzubiPass stellt daraus örtlich und ohne Netz eine
abwechslungsreiche Probeklausur zusammen, nimmt sie ab und wertet sie nach
Kapiteln aus.

Der Weg:

```
Üben → Eigene Probeklausur → Kapitel wählen → Dauer festlegen →
Auswahl prüfen → Probeklausur starten → bearbeiten → abgeben →
offene Antworten selbst bewerten → Auswertung nach Kapiteln →
neue Variante oder Kapitel wiederholen
```

**Der Schwerpunkt ist die nächste Klassenarbeit**, nicht die Abschlussprüfung.
Das ist der Fall, der wöchentlich eintritt; die AP kommt einmal.

## Was das ausdrücklich nicht ist

**Keine amtliche IHK-Prüfungssimulation.** Keine AP1-/AP2-Nachbildung, keine
festen IHK-Prüfungsblöcke, keine Bestehensprognose. AzubiPass hat keine
Verbindung zu einer IHK, zur AkA oder zu einem Prüfungsausschuss — siehe
`README.md`.

Es wird auch **keine Note** berechnet: Notenschlüssel unterscheiden sich von
Schule zu Schule, und eine erfundene Note wäre eine erfundene Auskunft.

## Erster Inhaltspilot

Lernfeld **Buchführung**, neun Kapitel, 45 Aufgabenbausteine, 208 Punkte,
rund 221 Bearbeitungsminuten. Jedes Kapitel hat genau einen Baustein im
Anforderungsbereich I und III und drei im Bereich II — dadurch ist jede
zusammengestellte Klausur niveaugemischt, egal welche Kapitel gewählt werden.

Die Auswahl zeigt **nur Kapitel, für die es Aufgaben gibt**. Solange nur
Buchführung Bausteine hat, steht dort auch nur Buchführung. Keine zwölf toten
Lernfelder.

## Datenmodell und Erweiterbarkeit

Aufgaben liegen als `quellen/<kapitel>.aufgaben.json` neben der jeweiligen
`<kapitel>.kapitel.json`. Das Format steht in
[AzubiPass_Aufgabenbausteine.md](AzubiPass_Aufgabenbausteine.md).

Ein weiteres Lernfeld heißt: Aufgabendateien schreiben, neu bauen. Auswahl,
Zusammensteller und Renderer bleiben unangetastet — sie lesen ausschließlich
`mittel/aufgaben.json` und die kanonischen Kapitelangaben aus den
Lernfelddateien. Nirgends steht eine feste Kapitelliste im Code.

### Konten

`quellen/musterunternehmen.json` ist die einzige Wahrheit über Konten. Jedes
Konto hat `nr` und `name`; `alias` nennt geläufige Schulbezeichnungen
(„Bank" → 2800, „Bankdarlehen" → 4200, „Mietaufwand" → 6700).

Aufgaben dürfen ein Konto als Nummer **oder** als Bezeichnung nennen — beides
wird innen auf dasselbe Kontoobjekt aufgelöst. Angezeigt wird die Bezeichnung,
die Nummer steht daneben, wo sie fachlich gebraucht wird. Der Build bricht ab,
wenn eine Lösung ein Konto nennt, das es nicht gibt.

### Formeln

`abgeleitet` und `pruefung_variablen` werden von einem eigenen kleinen Rechner
in `quellen/aufgaben.js` ausgewertet: Zahlen, die Variablen der Aufgabe, die
Grundrechenarten, Klammern, Vergleiche und die Funktionen `runde`, `abrunden`,
`aufrunden`, `min`, `max` und `abs`. Sonst nichts.

`abrunden` und `aufrunden` gibt es für Ergebnisse, die nur als ganze Zahl einen
Sinn ergeben. Eine Break-Even-Menge von 342,86 Stück kann niemand verkaufen:
Gefragt ist dann die erste ganze Stückzahl **oberhalb** des Break-Even, denn
genau am Break-Even ist das Ergebnis null. Geschrieben wird das als
`abrunden(runde(fixkosten / db_stueck, 6)) + 1` — das Runden auf sechs
Nachkommastellen fängt vorher den Rechenstaub der Fließkommadivision ab, damit
eine glatt aufgehende Rechnung nicht durch `abrunden` um eins danebenliegt.

**Kein `eval`, kein `new Function`.** Was in einer Aufgabendatei steht, liefe
sonst als JavaScript im Browser des Nutzers. Der Build prüft jede Formel gegen
dieselbe Erlaubnisliste und bricht bei einer unbekannten Größe ab.

## Der Zusammensteller

Regelbasiert und örtlich — **keine KI**, kein Backend, keine reine
Zufallsziehung. Reihenfolge der Regeln:

1. Nur Aufgaben aus gewählten Kapiteln, keine doppelt.
2. Jedes gewählte Kapitel kommt vor. Für die noch nicht abgedeckten Kapitel
   bleibt jeweils ihre kürzeste Aufgabe reserviert.
3. Verschiedene Aufgabenarten und Anforderungsbereiche werden bevorzugt.
4. Die Gesamtdauer nähert sich der gewählten Dauer, überschreitet sie aber
   nicht. Passt weniger hinein, wird die ehrliche Schätzung angezeigt.
5. Reicht die Dauer nicht für alle gewählten Kapitel, wird **kein Kapitel still
   weggelassen** — vor dem Start steht, welche Mindestdauer nötig ist.
6. Ein Seed steuert alles. Gleicher Seed und gleiche Eingaben ergeben dieselbe
   Klausur und dieselben Zahlen; „Neue Variante erstellen" nimmt einen neuen
   Seed und meidet die Aufgaben der vorherigen Klausur.

Dauerwahl: 30, 45, 60 (Standard) und 90 Minuten, dazu eine eigene Dauer von 15
bis 180 Minuten in Fünf-Minuten-Schritten.

## Klausurmodus

Während der Bearbeitung gibt es **keine Rückmeldung**: kein richtig/falsch,
keine Lösungshinweise, keine Echo-Texte, keine Erklärungen, keine mitlaufende
Punktesumme, keine Farbe für Korrektheit. `{{begriff:…}}` und `{{par:…}}` werden
auf das reine Wort reduziert.

Hilfsmittel sind Kontenplan und ein einfacher Taschenrechner. Die
Kontovervollständigung durchsucht den ganzen Kontenplan und bevorzugt kein
Konto — sonst wäre sie eine versteckte Hilfe.

Der Timer speichert eine **absolute Endzeit**. Schließen, Wechseln oder
Neuladen setzt ihn nicht zurück. Läuft er ab, werden die Eingaben gesichert,
der Ablauf wird deutlich gesagt und die Klausur führt kontrolliert zur Abgabe.
Nichts wird gelöscht.

## Bewertung

Automatisch bewertet wird alles, was sich zuverlässig bewerten lässt: Auswahl
(mit Teilpunkten nach einer festen Regel bei Mehrfachauswahl), Zahlen mit
definierter Toleranz und Folgefehlerregel, Zuordnungen, Reihenfolgen und
Buchungssätze bestandteilweise. Gleichwertige Buchungszeilen werden in beliebiger
Reihenfolge anerkannt.

**Offene Antworten bewertet der Nutzer selbst** — nicht pauschal nach Gefühl,
sondern indem er einzelne Kriterien des Punkterasters abhakt. Nur bestätigte
Kriterien zählen; ohne Haken gibt es null Punkte.

Die Auswertung zeigt erreichte von möglichen Punkten, den Prozentwert, das
Ergebnis je Kapitel mit den verlorenen Punkten und einen direkten Weg in die
betroffenen AzubiPass-Kapitel.

## Speicherung

Der laufende Klausurzustand liegt getrennt und versioniert unter
`azubipass:probeklausur:v1`. `azubipass:konto` — der Lernstand eines Jahres —
wird davon nie berührt: nicht migriert, nicht überschrieben, nicht gelöscht.
`localStorage.clear()` kommt in der Probeklausur nicht vor.

Geladen wird defensiv: Was fehlt, halb geschrieben oder aus einer alten Fassung
ist, führt dazu, dass es eben keine laufende Klausur gibt — nicht zum Absturz.
Eine abgeschlossene Klausur wird nicht ungefragt als laufende angezeigt. Eine
laufende lässt sich bewusst verwerfen, nach Rückfrage.

## Was ausdrücklich noch nicht gebaut ist

- offizielle AP1-/AP2-Simulation und feste IHK-Prüfungsblöcke
- Aufgaben für die übrigen zwölf Lernfelder
- KI-generierte Aufgaben
- Backend, Benutzerkonto, Cloud-Synchronisation
- Aufgabeneditor
- ein separater Übungsmodus mit Sofortfeedback
- ein eigener Bereich „Meine Fehler"
- Bestenlisten, Punktejagd, Streaks, Gamification
- PDF- oder Druckausgabe
- Klausuren mit anderen teilen
- Belegvorlagen außer Kontoauszug und Eingangsrechnung
- Vorgänge (`passt_zu`) — die Kennungen stehen in den Bausteinen, die Dateien
  unter `quellen/vorgaenge/` gibt es noch nicht. Ohne sie werden die Bausteine
  als Einzelaufgaben gestellt; das funktioniert.

## Verhältnis zu den älteren Konzeptdateien

[IHK_Pruefungssimulator_Aufgabenkonzept.md](IHK_Pruefungssimulator_Aufgabenkonzept.md)
und [AzubiPass_Uebungskonzept.md](AzubiPass_Uebungskonzept.md) enthalten
weiterhin brauchbare Aussagen zu Aufgabenarten, Operatoren und Bewertung. Sie
beschreiben aber einen weiteren Umfang, als heute gebaut ist, und definieren den
Produktumfang **nicht mehr allein**. Wo sie dieser Datei widersprechen, gilt
diese Datei.
