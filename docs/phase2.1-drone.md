# Phase 2.1: Drohnenbild und Geometrievalidierung

## Arbeitsbereich

„Dachvermessung“ arbeitet vollständig getrennt von der iPhone-Kalibrierung. Das Drohnenbild bleibt nur im Arbeitsspeicher und wird weder in IndexedDB noch in der gemeinsamen Konfiguration gespeichert. Kamera, Messpunkte und Modellparameter der iPhone-Aufnahme werden beim Öffnen, Vermessen und Schließen nicht verändert.

Die nachträglich in die Aufnahme gezeichneten PV-Module werden ausdrücklich nicht als reale Geometrie verwendet. Referenzen sind ausschließlich die vier äußeren Ecken der untersuchten Dachhälfte und danach möglichst eindeutige Dachanschluss- beziehungsweise Rahmenkanten.

Die Dachreferenzen werden in dieser Reihenfolge gesetzt:

1. Traufe links = (0, 0)
2. Traufe rechts = (Dachlänge, 0)
3. First rechts = (Dachlänge, Dachschräge)
4. First links = (0, Dachschräge)

Damit entspricht die Entzerrung exakt der vorhandenen PV-Konvention: X entlang der Traufe beziehungsweise des Firsts von Modell-Z− nach Z+, Y auf der geneigten Fläche von Traufe zu First. Die vier Punkte sind einzeln auswählbar und durch erneuten Klick korrigierbar.

## Homographie und Darstellung

`src/model/homography.ts` löst die acht freien Koeffizienten einer projektiven 3×3-Abbildung aus vier Punktpaaren mit Pivotisierung. Zu kleine, kollineare, singuläre oder numerisch instabile Punktlagen werden abgelehnt. Die inverse Abbildung erzeugt eine entzerrte Rasteransicht mit frei wählbaren Pixeln pro Meter. Das Raster zeigt ganze Meter; Y=0 liegt an der unteren Traufkante.

Es stehen zwei unabhängige Maßsätze zur Verfügung:

| Quelle | X Dachlänge | Y Dachschräge | Differenz zum Modell |
|---|---:|---:|---:|
| bisheriges Modell | 10,73 m | 6,29 m | – |
| Angabe Drohnenaufnahme | 10,83 m | 6,24 m | X +10 cm, Y −5 cm |

Die Auswahl skaliert ausschließlich die Drohnenmessung und überschreibt keine Modellmaße. Eine einzelne Homographie kann nicht entscheiden, welcher Maßsatz richtig ist.

## Objektmessung und Unsicherheit

Für Kamin, Badfenster und Südzimmerfenster werden jeweils vier Bildpunkte in metrische Dachkoordinaten transformiert. Durchgezogene farbige Polygone sind Messungen, gestrichelte Rechtecke die unveränderten PV-Planwerte. Die Tabelle zeigt Min-/Max-Koordinaten, alle vier Grenzdifferenzen, Mittelpunkt- und Größenabweichungen in Zentimetern.

Die Unsicherheitsanzeige variiert deterministisch jeden Dachreferenzpunkt einzeln um ± die eingestellte Klickunsicherheit in beiden Bildachsen und verschiebt zusätzlich jeden Objektpunkt. Angezeigt wird der größte RMS-Effekt der vier Objektecken. Diese Schätzung erfasst manuelles Klicken, Perspektive und Bildmaßstab, aber keine systematische falsche Identifikation oder Höhe über der mathematischen Dachfläche. Darum ist sie mit „ca.“ gekennzeichnet. Fensterrahmen und Kaminoberkanten oberhalb der Dachfläche können durch Parallaxe verzerrt erscheinen; möglichst Dachanschluss- oder Schnittkanten verwenden.

Der JSON-Export enthält Maßsatz, Konvention, Bildpunkte, transformierte Punkte, Planvergleich, Differenzen und Unsicherheit. Eine Übernahme in das Hausmodell ist absichtlich nicht implementiert. Damit kann keine Messung versehentlich Planwerte überschreiben; eine spätere Übernahme kann auf diesem Export aufbauen und muss ausdrücklich bestätigt sowie reversibel sein.

## Prüfung der WebApp-Transformation

Die Phase-2-Tests vergleichen weiterhin die eigene Projektionsfunktion mit der tatsächlich konfigurierten Three.js-Kamera über mehrere Bildformate, Rollwinkel, Hausrotationen, Bildmittelpunkte und 3D-Punkte. Ergänzt wurden Tests für:

- exakte Dach-Eckzuordnung und Homographie-Rücktransformation,
- Ablehnung degenerierter Referenzpunkte,
- synthetische metrische Objektmessung,
- X-/Y-Vorzeichen der PV-Konvention,
- lokale PV-Korrektur genau einmal in der Reihenfolge Maßstab, dann Versatz,
- Fenster- und Kaminpunkte auf derselben geneigten Dachfläche.

Der aktuelle Code zeigt damit keinen mathematischen Hinweis auf Hypothese C: Bad- und Südzimmerfenster nutzen dieselbe Transformation und unterscheiden sich nur in Planwerten beziehungsweise expliziten lokalen Korrekturen. Ein Projektionsfehler, der nur das Südzimmerfenster betrifft, während benachbarte Dachreferenzen korrekt liegen, ist mit dem idealen Kameramodell wenig plausibel. Reale Daten können weiterhin systematische Randfehler durch Cropping, Objektivverzeichnung, falsche Klickpunkte oder eine unzureichend bestimmte iPhone-Kamera zeigen; diese erscheinen in der gemeinsamen Residuenansicht.

## Diagnose

Die Anwendung gibt nur vorsichtige Hinweise:

- Südzimmer-Mittelpunktfehler größer als die doppelte geschätzte Unsicherheit, während Kamin und Badfenster innerhalb dieser Schwelle liegen: Hypothese A wird gestützt, aber nicht bewiesen.
- Alle Objekte deutlich außerhalb der Schwelle: globalen Maß-/Bezugfehler, Dachreferenzen und iPhone-Kamera prüfen (Hypothese B beziehungsweise Messaufbau).
- Gemischtes oder nicht signifikantes Bild: keine eindeutige Entscheidung.

Eine erste manuelle Auswertung der inzwischen lokal vorhandenen Ostaufnahme ist unter [drone-east-preliminary.md](drone-east-preliminary.md) dokumentiert. Sie stützt derzeit Hypothese A, bleibt wegen der eingeblendeten Planung und der Auswahl erhöhter sichtbarer Kanten vorläufig.

Für eine belastbare Aussage werden die echte Drohnenaufnahme und manuell gesetzte Punkte benötigt. Die Software nimmt keine Koordinatenkorrektur vor.
