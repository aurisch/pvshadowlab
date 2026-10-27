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

- Bestätigtes Rohmauerwerk: 8,99 × 8,99 m
- Mögliche Putzstärke: ungefähr 3–5 cm je Seite, noch nicht bestätigt
- Daraus mögliches fertiges Außenmaß: ungefähr 9,05–9,09 m
- Dachneigung: vermutlich 30–35°, noch zu messen

Bis das fertige Fassadenmaß gemessen ist, verwendet das Modell 8,99 m für Breite und Tiefe. Die unsichere Putzstärke wird nicht als vermeintlich exakter Geometriewert eingerechnet.

## Struktur

- src/model: reine, testbare Geometrie- und Kamerarechnungen
- src/scene: Three.js-Darstellung und Kamerasteuerung
- src/config: Standardwerte, Validierung und JSON-Serialisierung
- src/ui: Definitionen der Bedienelemente
- tests: automatisierte Geometrie-, Optik- und Persistenztests
