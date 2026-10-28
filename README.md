# PV ShadowLab – Phase 2

Lokales Werkzeug zum parametrischen Modellieren eines einfachen Hauses und zur gemeinsamen geometrischen Kalibrierung anhand eines iPhone-Fotos. Es gibt bewusst noch keine PV-, Sonnenstands- oder Verschattungssimulation.

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
- Das zuletzt ausgewählte Originalfoto wird ausschließlich lokal in IndexedDB gespeichert und beim nächsten Start automatisch wiederhergestellt, bis ein anderes Foto gewählt wird. Für die feste Stativserie bleiben Kamera, Drehung und Messpunkte beim Foto-Wechsel erhalten. Ein anderes Seitenverhältnis deaktiviert die Messpunkte zur Prüfung. 26 mm Kleinbildäquivalent ist der anfängliche Optikwert; es gibt keinen automatischen FOV-Reset bei einem neuen Foto.
- Die 3D-Deckkraft und die Darstellung von Foto, Modell oder Überlagerung sind umschaltbar.
- Haus- und Kamerakonfiguration können als JSON exportiert/importiert werden. Die letzte gültige Konfiguration bleibt zusätzlich im localStorage des Browsers erhalten. Das Originalfoto liegt getrennt in IndexedDB und wird nicht hochgeladen.
- Sämtliche Kalibrierungsmarkierungen lassen sich gemeinsam ein- und ausblenden; diese Ansichtseinstellung wird mit der Konfiguration gespeichert.
- Im gemeinsamen Bereich **Kalibrierung** Objekt und Eckpunkt auswählen und im Foto setzen. Beide Fenster, Gebäude-/Dachpunkte sowie Dachanschluss und Öffnung des Kamins verwenden dieselbe Erfassung. Ein bestehender Punkt kann per Messpunkt-Klick oder über seine Tabellenzeile erneut gesetzt werden. Jede Zeile erlaubt Aktivierung, Messgewicht und Löschen.
- Ein Präzisionskreuz, Mausrad-Zoom von 100 bis 1200 Prozent und Verschieben per Ziehen erleichtern die Auswahl. Ziehen setzt keinen Punkt. In der freien Ansicht gelten weiterhin die normalen OrbitControls.
- **Kalibrierung berechnen** optimiert alle aktiven Messpunkte gemeinsam. Standardmäßig sind nur die sechs Kamerapose-Parameter freigegeben. Im Expertenbereich lassen sich FOV, Bildmittelpunkt, unsichere Geometrie, Kaminoberkante und lokale Objektkorrekturen freigeben; Grenzen und aktuelle Werte sind dort sichtbar und editierbar.
- Kreise zeigen Messpunkte, cyanfarbene Kreuze die Modellprojektion; Linien verbinden beide. Die Fehlerliste ist absteigend nach Einzelpunktfehler sortiert. RMS und Maximum verwenden aktive Punkte und echte Originalbild-Pixel, unabhängig von Fenstergröße und Zoom. Die robusten Gewichte sind am Fehlerwert als Tooltip sichtbar. Ein ausgeblendeter Punkt bleibt für die Optimierung aktiv; der Aktivierungshaken in seiner Zeile steuert die Teilnahme.
- Konfiguration einschließlich aller Messpunkte, Freigaben, Grenzen und Korrekturen wird lokal und als JSON gespeichert. Zoom und Bildverschiebung werden separat als lokale Arbeitsansicht gespeichert.
- Phase-1-Konfigurationen werden automatisch nach Version 2 migriert. Vorher wird das exakte Original gesichert und bleibt über **Phase-1-Original exportieren** exportierbar. Unbekannte Punkte werden mit Hinweis gesichert, nicht falsch zugeordnet.
- Der getrennte Arbeitsbereich **Dachvermessung** lädt eine Drohnenaufnahme nur temporär, entzerrt die Dachhälfte aus vier Ecken und vergleicht Kamin sowie beide Fenster metrisch mit dem PV-Plan. Die beiden Maßsätze 10,73 × 6,29 m und 10,83 × 6,24 m sind umschaltbar, ohne das Hausmodell zu ändern. Messwerte, Zentimeterdifferenzen und eine vorsichtige Unsicherheitsschätzung lassen sich als JSON exportieren. PV-Module in der Aufnahme gelten ausdrücklich als nachträgliche Planzeichnung. Details: [docs/phase2.1-drone.md](docs/phase2.1-drone.md).

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

Die Projektion ist eine ideale Lochkamera. Der optische Mittelpunkt kann in NDC (rechts/oben positiv) verschoben werden. Das Konfigurationsfeld lensDistortion ist für eine spätere, datengetriebene radiale/tangentiale Korrektur reserviert und derzeit immer null.

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

Die Plan-Koordinaten bleiben als Referenz erhalten. Optionale Korrekturen werden pro Objekt separat gespeichert: Versatz in Metern und Maßfaktoren entlang First und Dachschräge. Es gibt keine gemeinsame Rasteroptimierung mehr. Eine aktive alte Rasterkorrektur wird bei der Migration auf explizite lokale Korrekturen aller Objekte übertragen und als Altbestand kenntlich gemacht; inaktive Altwerte bleiben im Original-Backup.

Der Kamin wird als vertikaler Körper mit waagerechter Öffnung und unterschiedlich gefärbten Seiten dargestellt. Seine Oberkante ist eine **absolute Y-Höhe in Metern über Modellnull**. Die unteren vier Ecken sind der Schnitt seiner vertikalen Wände mit der geneigten Dachebene. Alle acht Punkte sind auswählbar; für die sichtbare Front genügen die beiden traufseitigen Dachanschlüsse und die direkt darüberliegenden Öffnungsecken. Bei der Migration entspricht die neue absolute Oberkante dem bisherigen höchsten Dachanschlusspunkt plus alter Kaminhöhe.

Störflächen und Kamin werden transparent über das Referenzfoto gelegt. Ihre Deckkraft folgt der allgemeinen Modelldeckkraft mit einem zusätzlichen Transparenzfaktor, damit die darunterliegenden Bilddetails sichtbar bleiben.

## Struktur

- src/model: reine, testbare Geometrie- und Kamerarechnungen
- src/scene: Three.js-Darstellung und Kamerasteuerung
- src/config: Standardwerte, Validierung und JSON-Serialisierung
- src/ui: Definitionen der Bedienelemente
- tests: automatisierte Geometrie-, Optik- und Persistenztests

## Verfahren und Grenzen

Der gemeinsame Optimierer verwendet begrenztes Levenberg–Marquardt mit numerischer Jacobi-Matrix, skalierten Parameterschritten und punktweiser Huber-Gewichtung (Standard 4 Originalpixel). Die Informationsmatrix wird auf Rang und Kondition geprüft. Nicht beobachtbare Parameterkombinationen, ungültige Geometrie und fehlende Konvergenz werden nicht übernommen. Stark korrelierte oder an Grenzen liegende Parameter werden mit Warnung angezeigt. Details, Migration und Abnahme: [docs/phase2.md](docs/phase2.md).

Die feste Stativserie liefert dieselbe Ansicht; zusätzliche Fotos allein schaffen keine zusätzliche 3D-Perspektive. Punkte in einer einzigen Dachebene erlauben bei freier Optik und Geometrie keine beliebig präzise Trennung der Fehlerursachen. Bekannte Maße zunächst sperren, räumlich verteilte Referenzen setzen und nur begründet zusätzliche Parameter freigeben. Das tatsächliche Südzimmerfenster kann erst anhand seiner im Originalfoto gesetzten Ecken beurteilt werden; die Anwendung behauptet keine automatische Ursache.
