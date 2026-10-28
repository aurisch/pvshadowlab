# PV ShadowLab – Phase 1

Lokales Werkzeug zum parametrischen Modellieren eines einfachen Hauses und zum manuellen Kalibrieren einer idealen perspektivischen Kamera anhand eines iPhone-Fotos. Es gibt bewusst noch keine PV-, Sonnenstands- oder Verschattungssimulation.

## Start

Voraussetzung ist eine aktuelle Node.js-Version (empfohlen: Node 22 oder neuer).

    npm install
    npm run dev

Vite zeigt danach die lokale URL an. Weitere Prüfungen:

    npm run typecheck
    npm test
    npm run build

## Bedienung

- In der **freien Ansicht** lässt sich das Haus per Maus drehen, verschieben und zoomen.
- Die **Fotokamera** wird numerisch oder per Slider über Position, Azimut, Elevation, Rollwinkel und vertikalen Bildwinkel eingestellt.
- Beim Laden eines Fotos wird sein natives Seitenverhältnis übernommen und gesperrt. Foto und WebGL-Projektion belegen damit exakt dieselbe unverzerrte Fläche.
- Jedes geladene Foto erhält automatisch die vorgeschriebene Rotation um 90° gegen den Uhrzeigersinn. Es kann anschließend in 90°-Schritten weitergedreht oder auf diese Pflichtrotation zurückgesetzt werden.
- Das zuletzt ausgewählte Originalfoto wird ausschließlich lokal in IndexedDB gespeichert und beim nächsten Start automatisch wiederhergestellt, bis ein anderes Foto gewählt wird. Bei einem neuen Foto setzt die Anwendung 90° CCW, das tatsächliche Seitenverhältnis und den aus 26 mm abgeleiteten FOV automatisch; beim Neuladen bleiben spätere manuelle Kalibrierwerte erhalten.
- Die 3D-Deckkraft und die Darstellung von Foto, Modell oder Überlagerung sind umschaltbar.
- Haus- und Kamerakonfiguration können als JSON exportiert/importiert werden. Die letzte gültige Konfiguration bleibt zusätzlich im localStorage des Browsers erhalten. Das Foto selbst wird weder gespeichert noch hochgeladen.
- Sämtliche Kalibrierungsmarkierungen lassen sich gemeinsam ein- und ausblenden; diese Ansichtseinstellung wird mit der Konfiguration gespeichert.
- In der Punktkalibrierung werden bekannte Modellpunkte ausgewählt und im Foto angeklickt. Die äußeren Dachecken enthalten Trauf- und Giebelüberstand und entsprechen damit den gut sichtbaren äußersten Dachpunkten. Ein Präzisionskreuz, stufenloser Mausrad-Zoom von 100 bis 1200 Prozent und Verschieben per Ziehen erleichtern die Auswahl. Eine Ziehbewegung setzt keinen Punkt. Ab vier Beobachtungen optimiert die Anwendung Position, Azimut, Elevation und Roll der Fotokamera; der optische FOV bleibt dabei bewusst fixiert.
- Kalibrierpunkte werden automatisch gespeichert und sind Teil des JSON-Imports und -Exports. Zoom und Bildverschiebung werden als lokale Arbeitsansicht wiederhergestellt, aber nicht in die geometrische JSON-Konfiguration aufgenommen.

## Koordinaten- und Winkelkonventionen

Das Modell verwendet ein rechtshändiges, metrisches Koordinatensystem:

- **X:** Gebäudebreite
- **Y:** Höhe, positiv nach oben
- **Z:** Gebäudetiefe
- **Ursprung:** Mittelpunkt der Gebäudegrundfläche
- **Dachfirst:** parallel zur Z-Achse

Die Traufhöhe bezeichnet den Schnittpunkt von Außenwand und Dachfläche. Ein Traufüberstand verlängert die Dachfläche daher entlang ihrer Neigung nach außen und unten; er erhöht die Firsthöhe nicht. Der Giebelüberstand verlängert die Dachflächen in Z-Richtung.

Die Gebäudeausrichtung ist eine Drehung um +Y. 0° lässt Breite und Tiefe auf X/Z liegen; positive Winkel drehen – von oben betrachtet – von +Z in Richtung +X. Diese Konvention entspricht einem später möglichen geografischen Azimut mit +Z als Nordrichtung und +X als Ostrichtung.

Für die Fotokamera gilt:

- Azimut 0° blickt nach +Z, 90° nach +X.
- Positive Elevation blickt nach oben, negative nach unten.
- Roll ist die Drehung um die optische Achse.
- FOV ist der **vertikale** Bildwinkel.
- Die 35-mm-äquivalente Umrechnung verwendet die Kleinbilddiagonale von 43,27 mm und das eingestellte Bildseitenverhältnis.

Die Projektion ist in Phase 1 eine ideale Lochkamera. Das Konfigurationsfeld lensDistortion ist für eine spätere, datengetriebene radiale/tangentiale Korrektur reserviert und derzeit immer null.

## Referenzaufnahme vom 27. Oktober 2026

Die aus dem bereitgestellten EXIF-Datensatz übernommenen Werte sind:

- Kamera: iPhone 11 Pro, Rückkamera 4,25 mm f/1,8
- Reale Brennweite: 4,25 mm
- 35-mm-äquivalente Brennweite: 26 mm
- Quelldatei: 4032 × 3024 px
- Nach Berücksichtigung der EXIF-Orientierung und der vorgeschriebenen 90°-CCW-Drehung: Querformat mit Seitenverhältnis 4:3
- Daraus berechneter vertikaler Bildwinkel der dargestellten Aufnahme: 53,060°
- Blende: f/1,8
- Belichtungszeit: 1/1754 s
- ISO: 32
- Blitz: aus
- Belichtungskorrektur: 0 EV
- Aufnahmezeit laut EXIF: 27. Oktober 2026, 11:06:40 (+01:00)

Für die geometrische Kalibrierung werden insbesondere das tatsächlich dargestellte Seitenverhältnis, die Drehung und das 26-mm-Kleinbildäquivalent verwendet. Die EXIF-Pixelachsen allein sind wegen der zusätzlich gespeicherten Orientierung nicht ausreichend, um Hoch- oder Querformat festzulegen. Blende, Belichtungszeit und ISO werden nur als Referenz dokumentiert und beeinflussen die virtuelle Lochkamera nicht.

## Bekannte Gebäudemaße

- Gebäudebreite und -tiefe: 9,10 × 9,10 m
- Dokumentiertes Rohmauerwerk: 8,99 × 8,99 m
- Dachneigung: 30°
- Gemessener Traufüberstand: 0,90 m
- Dachlänge in Z-Richtung: 10,73 m
- Länge der geneigten Dachfläche: 6,29 m
- Daraus abgeleiteter Giebelüberstand je Seite: (10,73 − 9,10) / 2 = 0,815 m

Die Werte sind als Modell-Defaults hinterlegt. Die schräge Dachlänge aus Geometrie und Rundungswerten beträgt (9,10 / 2 + 0,90) / cos(30°) ≈ 6,293 m und stimmt damit mit der dokumentierten Länge von 6,29 m überein.

### Störflächen auf dem Ost-Dach

Der Ursprung liegt links unten an der Traufe. Die Plan-X-Koordinate läuft entlang der 10,73 m langen Dachkante von Modell-Z− nach Z+. Plan-Y läuft auf der 6,29 m langen geneigten Fläche von der Traufe zum First. Die dokumentierten Z = 100 mm werden bewusst ignoriert; die Störflächen liegen direkt in der Dachebene.

- Störfläche 01: Kamin, X 3,217–4,263 m, Y 3,438–5,077 m
- Störfläche 03: Fenster Bad, X 4,641–5,189 m, Y 3,878–4,819 m
- Störfläche 04: Fenster Südzimmer, X 8,015–8,852 m, Y 3,554–4,630 m

Die frühere Störfläche 02 „Lüftung“ (X 4,526–4,680 m, Y 1,782–1,994 m) wurde überbaut und wird daher nicht mehr im aktiven Modell dargestellt. Auch beim Import älterer Konfigurationen wird sie entfernt.
Die Beschriftung der Störflächen ist standardmäßig ausgeblendet und kann im Bereich „Gebäude & Dach“ eingeschaltet werden. Eingeschaltete Beschriftungen liegen als Texturen in der Dachfläche und folgen daher der perspektivischen Projektion.

Die Störflächenkalibrierung verwendet zunächst die vier sichtbaren Ecken des Bad-Fensters. Sie optimiert gemeinsamen Versatz und Maßstab des PV-Planrasters entlang der Dachkante und Dachschräge. Das Ergebnis wird auf alle Störflächen angewendet, automatisch gespeichert und mit der JSON-Konfiguration exportiert. Beim Wechsel des Fotos bleiben die ermittelten Rasterparameter erhalten; nur die bildabhängigen Klickpunkte werden gelöscht.
Mit dem Schalter „Gespeicherte Störflächenkalibrierung verwenden“ kann jederzeit zwischen den unveränderten PV-Planwerten und der kalibrierten Darstellung verglichen werden, ohne die gespeicherten Korrekturwerte zu löschen.

Der Kamin wird als vertikaler 3D-Körper mit waagerechter Oberkante und vier unterschiedlich gefärbten Seitenflächen dargestellt. Für die Fotokalibrierung wird nur seine sichtbare Front verwendet: unten links/rechts am Dachdurchtritt und direkt darüber oben links/rechts an der Kaminöffnung. Die im Foto nicht sichtbare Tiefe stammt weiterhin aus der dokumentierten Grundfläche. Seine Höhe kann numerisch eingegeben oder aus mindestens einer oberen Kaminecke optimiert werden. Höhe und Kalibrierung werden ebenfalls automatisch und im JSON gespeichert.
Störflächen und Kamin werden transparent über das Referenzfoto gelegt. Ihre Deckkraft folgt der allgemeinen Modelldeckkraft mit einem zusätzlichen Transparenzfaktor, damit die darunterliegenden Bilddetails sichtbar bleiben.

## Struktur

- src/model: reine, testbare Geometrie- und Kamerarechnungen
- src/scene: Three.js-Darstellung und Kamerasteuerung
- src/config: Standardwerte, Validierung und JSON-Serialisierung
- src/ui: Definitionen der Bedienelemente
- tests: automatisierte Geometrie-, Optik- und Persistenztests
