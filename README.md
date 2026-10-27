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
- Die 3D-Deckkraft und die Darstellung von Foto, Modell oder Überlagerung sind umschaltbar.
- Haus- und Kamerakonfiguration können als JSON exportiert/importiert werden. Die letzte gültige Konfiguration bleibt zusätzlich im localStorage des Browsers erhalten. Das Foto selbst wird weder gespeichert noch hochgeladen.

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

## Struktur

- src/model: reine, testbare Geometrie- und Kamerarechnungen
- src/scene: Three.js-Darstellung und Kamerasteuerung
- src/config: Standardwerte, Validierung und JSON-Serialisierung
- src/ui: Definitionen der Bedienelemente
- tests: automatisierte Geometrie-, Optik- und Persistenztests
