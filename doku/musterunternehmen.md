# Musterunternehmen

Alle Aufgaben des Prüfungssimulators spielen im selben Betrieb: der **MAKEL Studio
GmbH**. Dadurch wirken frei zusammengewürfelte Aufgabensets wie eine echte,
geschlossene Klausur.

Die Stammdaten liegen in `quellen/musterunternehmen.json`. Sie werden nicht in den
Aufgaben wiederholt — eine Aufgabe verweist auf eine Person oder ein Konto, den Rest
zieht der Build aus der Stammdatei.

## Was in der Stammdatei steht

| Block | Inhalt |
| --- | --- |
| `unternehmen` | Name, Rechtsform, Sitz, Gründung, Branche, Sortiment mit Richtpreisen |
| `kennzahlen` | Stammkapital, Umsatz, Bilanzsumme, Mitarbeitende, Größenklasse nach HGB |
| `vertriebskanaele` | Onlineshop 45 %, Wholesale 35 %, Store & Café 20 % |
| `standorte` | Gewerbehof (Studio, Lager, Verwaltung) und Innenstadt-Store |
| `fertigung` | mittlere Fertigungstiefe: Muster und Veredelung im Haus, Serie extern |
| `personen` | neun Mitarbeitende plus die Prüflingsrolle, je mit Themengebiet |
| `konditionen` | Skonto, Zahlungsziele, Mahnstufen, Steuersätze, Abschreibung |
| `kontenplan` | IKR-Auszug, 61 Konten in acht Klassen — für Aufgaben verbindlich |
| `tonalitaet` | Stufe 2, „leicht gefärbt“: genau ein Kontextsatz pro Aufgabe |

## Wer wofür steht

Jede Person deckt ein Themenfeld ab, damit der Generator zu einem Kapitel die
passende Stimme wählen kann.

```
              Yuki Bergmann (41) — Gründerin & GF, Design und Strategie
                                  │
              Tobias Renner (47) — Kaufmännischer Geschäftsführer
                                  │
    ┌──────────────┬──────────────┼──────────────┬──────────────┐
    │              │              │              │              │
Sandra          Ayla           Deniz          Marlene        Jonas
Koslowski (52)  Brandt (36)    Aydın (34)     Voß (29)       Weidner (38)
Buchhaltung     Personal       Einkauf/Prod.  Vertrieb       Lager/Versand
Ausbilderin     Verträge       Skonto         Mahnwesen      Inventur
    │                                                            │
    ▼                                                            ▼
Luca Petrelli (19)                                     Emily Tran (23)
Mitauszubildender, 1. Lehrjahr                         Store & Café KANTE
gebucht falsch — du korrigierst                        Kasse, 7 % und 19 %
```

Der Prüfling ist Auszubildende(r) im 2. Lehrjahr und bearbeitet alle Aufgaben.

## Regeln beim Aufgabenschreiben

1. **Ein Kontextsatz, nicht mehr.** Die Aufgabe muss allein stehen können.
2. **Kein Vorwissen aus anderen Aufgaben.** Der Generator würfelt die Reihenfolge.
3. **Kontonummern aus `kontenplan`.** Keine frei erfundenen Konten.
4. **Konditionen aus `konditionen`.** Weicht eine Aufgabe bewusst ab, steht die
   abweichende Bedingung ausdrücklich im Aufgabentext.
5. **Person passend zum Thema.** Personalfragen kommen von Ayla Brandt,
   Fehlersuche von Luca Petrelli, Kassenfragen von Emily Tran.
6. **Keine Emojis**, keine namentliche Anrede des Prüflings.

## Rechtlicher Rahmen

Das Unternehmen ist vollständig erfunden. Nachgebaut werden Prüfungs*strukturen*
und Formalia, nicht die Texte echter Prüfungsaufgaben — geschützt ist der
konkrete Aufgabentext, nicht der Aufbau einer Klausur. Es besteht keine
Verbindung zu einer IHK, zur AkA oder zu einem Prüfungsausschuss.
