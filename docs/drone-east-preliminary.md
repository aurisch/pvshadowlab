# Vorläufige Auswertung `drone-east.jpg`

Datum der Auswertung: 28. Oktober 2026. Das Original liegt lokal unter `reference/drone-east.jpg` und wird nicht als Projektbestand eingeordnet. `drone-west.jpg` zeigt die andere Dachhälfte und enthält nicht die drei gesuchten Objekte.

## Verwendete Referenzen

Die vier roten äußeren Dachkanten der eingeblendeten Vermessung wurden näherungsweise in Originalpixeln abgelesen:

| Zuordnung | Pixel X | Pixel Y |
|---|---:|---:|
| Traufe links | 1428 | 1477 |
| Traufe rechts | 2472 | 1530 |
| First rechts | 2524 | 936 |
| First links | 1436 | 882 |

Die schwarzen PV-Module wurden nicht als Referenz oder Messobjekt verwendet. Sie sind eine nachträgliche Planungszeichnung. Für die Objekte wurden sichtbare äußere Anschluss-/Rahmenbereiche näherungsweise gewählt. Gerade beim Kamin und bei Rahmen oberhalb der Ziegeloberfläche ist das keine exakte Ebenenmessung.

## Mittelpunktvergleich

Der Mittelpunkt ist gegenüber unscharfen Rahmenkanten robuster als die aus Min/Max abgeleitete Größe. Die Werte sind eine erste manuelle Ablesung, keine abschließende Vermessung.

| Maßsatz | Objekt | gemessener Mittelpunkt X / Y [m] | PV-Plan X / Y [m] | Differenz X / Y [cm] |
|---|---|---:|---:|---:|
| 10,73 × 6,29 m | Kamin | 3,996 / 4,218 | 3,740 / 4,258 | +25,6 / −4,0 |
| 10,73 × 6,29 m | Badfenster | 5,047 / 4,378 | 4,915 / 4,349 | +13,2 / +2,9 |
| 10,73 × 6,29 m | Südzimmerfenster | 7,873 / 4,188 | 8,434 / 4,092 | **−56,0 / +9,6** |
| 10,83 × 6,24 m | Kamin | 4,033 / 4,184 | 3,740 / 4,258 | +29,3 / −7,3 |
| 10,83 × 6,24 m | Badfenster | 5,094 / 4,343 | 4,915 / 4,349 | +17,9 / −0,5 |
| 10,83 × 6,24 m | Südzimmerfenster | 7,947 / 4,155 | 8,434 / 4,092 | **−48,7 / +6,3** |

Die reine 4-Pixel-Klickfortpflanzung beträgt an den Objektpunkten rund 2,4 cm. Dieser Wert enthält keine systematische Unsicherheit durch die Wahl einer erhöhten Rahmenkante, die roten eingezeichneten Dachgrenzen, Schatten oder die manuelle Interpretation der Fensterkante. Eine realistische Gesamtunsicherheit ist daher größer; aus dem Bild allein lässt sie sich nicht seriös auf wenige Zentimeter festlegen.

## Diagnose

Der Maßsatzwechsel verschiebt die absoluten X-Mittelpunkte, beseitigt die lokale Auffälligkeit aber nicht. Relativ zum Badfenster liegt der Südzimmer-Mittelpunkt je nach Maßsatz ungefähr 67–69 cm weiter links als nach den PV-Plan-Mittelpunkten zu erwarten. Relativ zum Mittel der Kamin- und Badfensterabweichung beträgt seine zusätzliche Abweichung rund 73 cm.

Das ist deutlich größer als die reine Klickfortpflanzung und stimmt qualitativ mit der Abweichung in der iPhone-Überlagerung überein. Damit wird Hypothese A – falsche beziehungsweise anders definierte Südzimmer-Plan-Koordinaten – derzeit klar gestützt. Mögliche Unterfälle sind:

- im PV-Plan wurde eine andere Kante oder ein anderes Bauteilmaß verwendet,
- die X-Koordinate des Südzimmerfensters ist tatsächlich falsch,
- die sichtbare, erhöhte Rahmenkante erzeugt einen Teil der Verschiebung.

Hypothese C ist nach den synthetischen Projektions-, Achsen- und Doppelkorrekturtests nicht nachweisbar: Bad- und Südzimmerfenster durchlaufen denselben Codepfad. Hypothese B bleibt für globale Restfehler der iPhone-Kamera möglich, erklärt aber schlecht, warum die zusätzliche Abweichung vor allem am Südzimmerfenster auftritt.

Vor einer Koordinatenänderung sollten die vier Dach- und Fensterpunkte im neuen Arbeitsbereich nochmals bei starker Vergrößerung gesetzt werden. Besonders wichtig ist, bei beiden Fenstern dieselbe physische Kante zu wählen. Die Anwendung übernimmt die Messung absichtlich nicht automatisch ins Modell.
