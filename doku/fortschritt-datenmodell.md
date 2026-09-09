# AzubiPass · Fortschritt-Datenmodell

**Stand:** 9. September 2026  ·  **Status:** Phase 1 abgeschlossen · Datenmodell für Phase 4 ergänzt

Dieses Dokument ist die verbindliche Grundlage für Lernstand, Wiederholung,
Sicherungen und spätere Probeklausur-Ergebnisse. Es beschreibt das Konto, das
die App im Browser unter `azubipass:konto` speichert.

## Grundsatz

Der Schlüssel `azubipass:konto` bleibt bestehen. Die Bedeutung der Daten wird
über `version` im gespeicherten Objekt gesteuert. Die aktuelle Kontofassung ist
**3**. Dadurch können bestehende Spielstände weiterverwendet werden, ohne dass
die App bei einer Änderung still auf null fällt.

## Konto, Fassung 3

```json
{
  "version": 3,
  "fortschritt": {
    "lf10-k4": {
      "ziele": [],
      "checks": {},
      "zuordnen": {},
      "test": {},
      "fertig": false
    }
  },
  "karten": {},
  "vokabeln": {},
  "quiz": {},
  "lesezeichen": [],
  "aktivitaet": [],
  "zuletzt": null,
  "pruefungstermin": null,
  "geaendertAm": null,
  "stimmung": "hell",
  "uebernommen": false,
  "probeklausuren": []
}
```

`fortschritt` enthält ausschließlich kapitelbezogene Lernaktionen. Ein
Karten-Eintrag wird erst angelegt, wenn eine Karte tatsächlich bewertet wurde;
das reine Öffnen des Trainers erzeugt keinen vorgetäuschten Lernstand. Das gilt
auch für `vokabeln`: Jeder Eintrag ist über eine stabile Vokabel-ID an einen
Grundwortschatz- oder Testblock gebunden und enthält nur nach einer Bewertung
`fach`, `faellig` und `fehler`. Neue Testlisten können dadurch als eigene Blöcke
angeliefert werden, ohne den Grundwortschatz oder den bisherigen Lernstand zu
verändern.

`probeklausuren` enthält kompakte Ergebniszusammenfassungen abgegebener
Klausuren. Beim Abgeben und nach jeder Selbstbewertung werden Kennung, Datum,
Punkte, Prozentwert, Kapitel und Auswertungsstatus dort aktualisiert. Eine
laufende Klausur bleibt unter `azubipass:probeklausur:v1`, damit ein Absturz
oder Neuladen den Lernstand nicht beschädigt; Antworten werden nicht in die
Sicherung kopiert. Export, Import und Zurücksetzen berücksichtigen beide
Ebenen passend: Ergebnisse reisen mit, ein laufender Bogen wird beim
Zurücksetzen entfernt.

## Antwort-IDs

Multiple-Choice-Optionen erhalten eine ID aus ihrer Aufgabenkennung und einem
Hash des Optionstextes. Die Oberfläche darf die Optionen deshalb mit jeder
Anzeige neu mischen, ohne eine gespeicherte Antwort auf eine andere Option zu
verschieben. Neue Antworten speichern die Options-ID unter `o`; alte Einträge
mit der Positionsangabe `w` werden beim ersten Laden einmalig umgestellt.
Ändert sich eine Option, ändert sich auch ihr Aufgabenabdruck und die alte
Antwort wird sicher verworfen.

## Migrationsregeln

1. Fehlt `azubipass:konto`, werden vorhandene alte Schlüssel pro Lernfeld
   einmalig in das zentrale Konto übernommen.
2. Ein Konto der Fassung 1 wird auf Fassung 2 angehoben; alle bekannten Daten
   bleiben erhalten, `probeklausuren` wird als leere Liste ergänzt.
3. Ein Konto der Fassung 2 wird auf Fassung 3 angehoben; `vokabeln` startet leer,
   weil noch keine Vokabel bewertet wurde. Bestehende Karten- und Kapitelstände
   bleiben erhalten.
4. Fehlende oder falsch typisierte Sammlungen werden durch leere Sammlungen
   ersetzt. Ungültige einzelne Kapitelobjekte werden verworfen, der übrige
   Lernstand bleibt bestehen.
5. Der alte Kartenstand aus den früheren positionsabhängigen Einträgen wird
   nicht geraten oder falsch zugeordnet. Karten starten nur dann neu, wenn sie
   noch keine stabile ID besitzen.
6. Exporte enthalten das Kontoobjekt einschließlich `version`. Der Import
   führt Daten zusammen; er überschreibt den lokalen Kontostand nicht blind.
7. `geaendertAm` wird bei lokalen Änderungen aktualisiert. Fehlt der Zeitstempel
   in einer alten Sicherung, werden vorhandene lokale Einträge bevorzugt und
   fehlende Einträge ergänzt.

## Aktueller Umfang dieses Schritts

- Die Kontofassung ist auf 3 angehoben; alte Konten werden verlustarm migriert.
- Beim Laden werden alte und unvollständige Konten normalisiert.
- `vokabeln` speichert den Leitner-Fortschritt des Englischtrainers getrennt vom
  normalen Kartenstapel; Richtung, Modus und Blockauswahl bleiben eine Ansichtssache.
- `probeklausuren` nimmt abgegebene Ergebnisse dauerhaft im gemeinsamen Konto
  auf und zeigt sie unter „Ich“ als Verlauf.
- Export und Import führen die Ergebnisliste zusammen; eine spätere
  abgeschlossene Auswertung ersetzt einen offenen Zwischenstand derselben
  Klausur. Kapitelstände, Karten und Übungsantworten werden anhand des
  Änderungszeitpunkts zusammengeführt; eine ältere Sicherung setzt keinen
  neueren lokalen Stand zurück.
- Das Zurücksetzen leert das Konto und entfernt zusätzlich den separaten
  laufenden Klausurbogen.
- Die Regressionen für Migration, Kapitelabschluss, Wiederholung, stabile
  Antwort-IDs, Ergebnisverlauf und nichtdestruktiven Sicherungsimport sind
  erfolgreich durchgelaufen. Der vollständige Browserlauf bleibt wegen der
  fehlenden lokalen Playwright/Chromium-Umgebung als späterer Abnahmepunkt
  markiert.
