# Design reference

Static mockups, kept because they record decisions rather than just output.

| File | What it shows |
| --- | --- |
| `lumea-directions.html` | Two directions compared: warm editorial vs dark clinical. **A was chosen.** |
| `lumea-structure.html` | Route map, admin inbox, SMS simulator |
| `lumea-liquid.html` | The liquid hero prototype that became `components/LiquidHero.tsx` |

## Rejected: a procedural 3D bottle

The hero was first attempted as a Three.js serum bottle — a silhouette
revolved with `LatheGeometry`, real glass via `transmission` and a
`RoomEnvironment` for refraction. No model files, which suited a zero-budget
project.

It was abandoned after three rounds of tuning. Procedural glass in a browser
is judged against real product photography and loses; it reads as a 3D demo.
The abstract shader that replaced it has no real-world referent to fall short
of, and costs nothing by comparison — raw WebGL on a single triangle versus
~150kb of Three.js.
