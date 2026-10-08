# Chef-Feedback S3 T3 Stadt

ABNAHME: JA (nach 2 Prüfrunden)

## Begründung
- Das Meer hat Wellen, Fresnel und Schaum an der Küste, bei Tag und Nacht. Die Küste ist erreichbar (Strand, Steg, Kai sind begehbar, Wasser nicht).
- Hafen Marlin Pier: Steg mit T-Kopf, Kai mit Kränen, Containern, Frachtschiff (Fensterbänder, Bug, Reling) und 8 Booten. Die Collider sind lückenlos.
- Landmarken: Meridian Tower auf einer Plaza, Riesenrad mit Lichterketten bei Nacht, Leuchtturm mit weichem Strahl, Pavillon. Dachdetails und neue Fassadenstile.
- Die API `world.groundAt`, `world.playLimit` und `world.isWalkable` ist geliefert und von T2 im Player-Clamp genutzt.
- Draw Calls +40 (Budget ausgeschöpft), keine Allokationen pro Frame.

## Für später
1. Die Screenshots ship-* zeigen noch den alten Rumpf. Sie werden bei der Integration neu erzeugt.
2. Das Draw-Call-Budget der Welt ist ausgereizt. Weitere Welt-Deko nur mit Merge bzw. Instancing oder LOD.
3. Die Riesenrad-Lichter könnten farbiger glühen. Schaum an Stegpfählen und Schiffsrümpfen fehlt.
