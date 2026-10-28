# Phase 2: gemeinsame geometrische Kalibrierung

## Bestandsanalyse und korrigierte Inkonsistenzen

- Die drei alten Koordinatensuchen hatten getrennte Zielfunktionen. Das Badfenster konnte über den gemeinsamen Rastermaßstab Fehler der Kamera kompensieren und damit andere Objekte verschieben. Die Optimierungsfunktionen und getrennten UI-Aktionen wurden entfernt.
- Der alte Pixelwert aus NDC-Norm mal Bildschirmdiagonale war bei nicht quadratischen Bildern unzutreffend und zoomabhängig. Jetzt gilt `dx = (projX − messX) × Bildbreite / 2`, `dy = (projY − messY) × Bildhöhe / 2`. RMS ist `sqrt(mean(dx²+dy²))`, Maximum der größte aktive Abstand. Diese Kennzahlen sind ungewichtet; die Zielfunktion verwendet zusätzlich Mess- und robuste Gewichte.
- Die bisherige mathematische Projektion stimmt einschließlich Gebäudeausrichtung und Roll mit Three.js überein. Der neue optionale Bildmittelpunkt wurde konsistent in beiden Projektionen ergänzt. `src/scene/photoCamera.ts` konfiguriert die tatsächliche Kamera und wird in den Vergleichstests benutzt.
- Der bisherige Import überschrieb Normalabstände pauschal und der Start konnte Referenzmaße automatisch über gespeicherte Hausmaße schreiben. Die Phase-2-Migration erhält explizit gespeicherte Haus-, Kamera- und Planwerte. Die überbaute Lüftung bleibt wie bisher ausgeschlossen.
- Ein neues Foto setzte FOV und Messpunkte zurück. Für die feste Stativserie bleiben nun Kameraparameter, Drehung und Punkte bei gleichem Format erhalten. Maßgeblich ist die tatsächlich dekodierte und gedrehte Bildgröße. Eine explizite Bilddrehung dreht auch Messpunkte, Roll und Bildmittelpunkt und passt FOV/Seitenverhältnis geometrisch konsistent an.

## Datenmodell

Konfigurationsversion 2 enthält eine gemeinsame `calibration` mit Beobachtungen `{pointId, x, y, active, weight}`, Parameterfreigaben/-grenzen, lokalen Objektkorrekturen, absoluter Kaminoberkante und Originalbildgröße. Bildpunkte sind NDC, rechts/oben positiv. Ein stabiler Punktkatalog liefert pro ID Objekt, semantischen Namen, Herkunft und die aus der aktuellen Geometrie abgeleitete 3D-Koordinate.

Der Katalog umfasst Grundkanten, obere Wandecken, äußere Dachecken, Firstenden, beide Fenster mit vier Ecken sowie Kaminanschluss und Öffnung mit je vier Ecken. Der sichtbaren Kaminfront entsprechen `east-01:lower-left/right` am Dach und `east-01:top-lower-left/right` an der Öffnung. Alte obere Kaminpunkte werden genau auf diese Öffnungsecken migriert.

PV-Plan X läuft entlang Modell-Z von der linken Dachkante, Plan-Y auf der Dachschräge von Traufe nach First. Für die Ostfläche gilt mit Dachneigung α:

```text
along = alongOffset + planX × alongScale
slope = slopeOffset + planY × slopeScale
x = −(Breite/2 + Traufüberstand) + slope × cos α − normalOffset × sin α
y = Traufhöhe − Traufüberstand × tan α + slope × sin α + normalOffset × cos α
z = −(Tiefe/2 + Giebelüberstand) + along
```

Offsets und Maßfaktoren sind explizite Abweichungen je Objekt, keine Änderungen am Plan. Die Skalierung bezieht sich aus Gründen der exakten Altbestandserhaltung auf den Planursprung; ihr Einfluss auf die Lage ist gemeinsam mit dem Offset zu beurteilen. Identität: Offset 0 m, Maßfaktor 1. Bei unabhängigen Gebäudemaßen bleiben Firstlänge, Firsthöhe und Dachschräge abgeleitet; es gibt dafür keine widersprüchlichen zusätzlichen Optimierungsparameter. Breite, Tiefe und Gebäudeausrichtung sind im Optimierer immer fest (manuell weiter einstellbar).

Die Kaminoberkante `chimneyTopY` ist absolut über Modellnull und verändert sich bei einer Dachänderung nicht implizit. An den vier Basisecken ergeben sich unterschiedliche sichtbare Wandhöhen. Kandidaten mit Öffnung unterhalb eines Dachanschlusspunktes werden verworfen.

## Optimierung und Diagnose

Deterministisches begrenztes Levenberg–Marquardt, zentrale numerische Ableitungen, Parameterskalierung, diagonale Dämpfung und Huber-IRLS auf dem zweidimensionalen Abstand je Messpunkt. Standardmäßig sechs freie Pose-Parameter, feste Optik und Geometrie. Optionale Parameter: FOV, optischer Mittelpunkt, Traufhöhe, Dachneigung, Dachüberstände, absolute Kaminoberkante und je Objekt lokale Positions-/Maßkorrekturen. Die bekannten Dachwerte sind standardmäßig gesperrt.

Parametergrenzen sind im Expertenbereich sichtbar und können innerhalb der unterstützten physikalischen Grenzen eingeengt werden. Aktuelle Werte außerhalb eigener Grenzen führen zu einer verständlichen Ablehnung statt stiller Änderung. Messgewichte sind positiv und bis 100 begrenzt. Für N freie Parameter werden mindestens N+2 skalare Beobachtungen verlangt; die reine Anzahl ersetzt die Rangprüfung nicht.

Die normierte gewichtete Informationsmatrix wird per Jacobi-Eigenwertverfahren untersucht. Relative Eigenwerte kleiner als 1e-10 gelten als Rangverlust: Ergebnis wird nicht übernommen. Eine Konditionszahl über 1e6 führt zur Warnung vor starker Korrelation. Es werden bewusst keine scheinpräzisen Parameterunsicherheiten ausgegeben. Die Kennzahlen sind lokale numerische Diagnosen, kein Beweis globaler Eindeutigkeit.

Ergebnisse werden nur bei Konvergenz, gültiger Geometrie und vollem lokalem Rang übernommen. Die Optimierung arbeitet auf einer Kopie; bei Ablehnung bleibt die Ausgangskonfiguration erhalten. Die UI zeigt Status, Iterationen, Rang, RMS, Maximum und Einzelabweichungen; die Expertenansicht zusätzlich die Konditionszahl. Änderungen an Messpunkten oder Modellparametern entfernen den veralteten Ergebnisstatus und zeigen wieder die aktuellen Fehler.

Große Einzelabweichungen werden markiert und robust abgewichtet. Heuristische Hinweise können eine Konzentration auf ein Objekt, eine gemeinsame Fehlerrichtung oder zunehmende Randfehler benennen. Sie behaupten keine konkrete Ursache. Vollständig ausgeblendete Markierungen ändern die Teilnahme an der Optimierung nicht; dafür dienen die Aktivierungshaken je Messpunkt.

## Optik und Fotoserie

26 mm Kleinbildäquivalent wird über die Kleinbilddiagonale 43,2666 mm und das tatsächliche Seitenverhältnis in vertikalen FOV umgerechnet. Bei 4:3 ergibt das etwa 53,060°. Diese Konvention ist ein plausibler Ausgangswert, keine Messung des tatsächlichen Croppings. Der Browser dekodiert die EXIF-Orientierung; anschließend folgt die konfigurierte zusätzliche CCW-Drehung (Default 90°). Es gibt keine weitere EXIF-Rohachsenannahme. Verzeichnung bleibt deaktiviert (`lensDistortion: null`).

Die zuletzt geladene Fotodatei liegt unverändert lokal in IndexedDB. Gleiche Bildformate einer statischen Serie teilen Kamera und Messpunkte. Eine geänderte Auflösung mit gleichem Seitenverhältnis erhält die NDC-Punkte und verwendet die neue Pixelgröße für Fehler. Ein anderes Seitenverhältnis deaktiviert vorhandene Punkte mit Hinweis zur manuellen Prüfung; der nominelle diagonale Brennweitenwert wird bei der Formatanpassung beibehalten. Unbekanntes Cropping kann aus dem Dateiformat allein nicht erkannt werden.

## Migration und Datensicherung

Der bestehende localStorage-Schlüssel bleibt erhalten. Vor der ersten automatischen Phase-1-Migration wird das exakte Original unter `pv-shadowlab-before-phase2` gesichert. Außerdem enthält die neue Konfiguration `calibration.legacyConfig` mit dem unveränderten Quell-JSON, auch bei JSON-Import. Der Original-Export bleibt verfügbar; der normale JSON-Export enthält alle neuen Daten und das Backup.

Gebäudepunkte behalten ihre IDs, Badfensterpunkte erhalten das Präfix `east-03:`, obere alte Kaminfrontpunkte werden `east-01:top-lower-*` zugeordnet. Unbekannte, doppelte oder ungültige Punkte werden nicht stillschweigend zugeordnet; Hinweis und Original-Backup erlauben die Prüfung. Eine aktive alte globale Rasterkorrektur wird in explizite lokale Korrekturen aller verbleibenden Objekte überführt. Inaktive alte Korrekturen bleiben ausschließlich im gesicherten Original. Die absolute Kaminoberkante wird aus dem tatsächlich bisher dargestellten höchsten Dachanschluss plus alter Höhe berechnet.

Kann die gespeicherte Konfiguration nicht sicher gelesen werden, bleiben die Originaldaten exportierbar und die UI zeigt einen Wiederherstellungshinweis. Bekannte Maße werden nicht mehr automatisch über gespeicherte Werte geschrieben.

## Verifikation

Automatisierte Tests decken Projektion, Kamera-Rekonstruktion, deterministische Ergebnisse, gleichzeitige lokale Fenster-/Kaminkorrektur, frei geschaltete Optik, Ausreißer, Messgewichte, deaktivierte Punkte, feste Parameter, Grenzen, Rangverlust, ungültige Ausgangslagen, Originalpixel-Fehler, Dachflächen, Kaminanschluss und -oberkante, konsistente Bilddrehung sowie JSON-Migration/Roundtrip ab. Three.js-Vergleiche verwenden drei Bildformate, drei Rollwinkel, drei Gebäudeausrichtungen und mehrere 3D-Punkte.

Zusätzlich in einem isolierten Chromium-Browser geprüft: Start ohne Laufzeitfehler, Auswahl beider Fenster, Expertenparameter, synthetische gemeinsame Kalibrierung mit 20 Punkten, Foto-Wechsel ohne Kameraverlust, korrigieren/deaktivieren/löschen, gemeinsame Markierungssichtbarkeit und Refresh, Zoom/Verschieben und freie Ansicht. Der Nutzer-Browser und dessen gespeicherte Kalibrierung werden dabei nicht verändert.

## Grenzen und offene fachliche Prüfung

- Die geometrische Übereinstimmung mit dem realen Südzimmerfenster muss anhand seiner neu gesetzten Originalfoto-Ecken bewertet werden. Synthetische Tests können die Richtigkeit der dokumentierten PV-Plan-Koordinaten nicht beweisen.
- Alle 287 Aufnahmen haben dieselbe Perspektive. Weitere Fotos erhöhen damit nicht automatisch die geometrische Beobachtbarkeit. Dachpunkte sind weitgehend koplanar; freie Optik und zusätzliche Geometrie können stark korrelieren. Zusätzliche räumlich getrennte Gebäude-/Kaminpunkte und gesperrte Referenzmaße helfen.
- Absolute geografische iPhone-Position und Nordbezug sind ohne äußere Vermessung nicht bestimmbar. Die Position im metrischen Hauskoordinatensystem ist bei geeigneten Referenzen kalibrierbar.
- Der Optimierer ist lokal; eine völlig falsche Ausgangspose kann eine manuelle Annäherung erfordern. Rang- und Konditionsprüfung sind lokale Diagnosen. Robuste Gewichte ersetzen keine Prüfung falsch zugeordneter Punkte.
- Kein automatischer Nachweis von Cropping oder Objektivverzeichnung; keine Sonnenstands-, Schatten-, PV- oder REST-Funktionen. Kein automatischer Commit/Push.
