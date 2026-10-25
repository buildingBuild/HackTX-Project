# Real car models

Drop licensed `.glb` files here, e.g. `camry.glb` and `sienna.glb`.

Return model URLs from the backend's `/3d-visualization/{customer_id}` endpoint.
The frontend mapping lives in `lib/api.ts` (`getVehicleVisualization`).

The app centres the model, sits it on the floor and scales it to the car's length.
Highlighting works for meshes whose names match a part (hood, door_front_left,
bumper_rear, headlight_r, wheel_fl ...). The matching rules are in
`partIdForName` in `lib/car.ts`. Unmatched meshes still render but can't be selected.

## Land Cruiser demo assets

- `land-cruiser-300.glb` is the user-supplied **2022 Toyota Land Cruiser 300 VX.R** by **Ddiaz Design**, from [Sketchfab](https://sketchfab.com/3d-models/2022-toyota-land-cruiser-300-vxr-3dfcd7904cdb4e52afa3ce59fa59e1a5), licensed **CC BY-NC-SA 4.0**, as recorded in its embedded asset metadata. Original file: `2022_toyota_land_cruiser_300_vx.r.glb`.
- `land-cruiser-300-open-hood.glb` is the user-supplied open-hood derivative. Original file: `Land_Cruiser_300_Open_Hood_Engine.glb`. Its metadata describes an LC300 body with a fitted **HDJ100 LiDAR engine-bay scan**, a visual composite rather than a factory LC300 mechanical specification. The engine scan's separate provenance was not supplied.

Both files are copied without changes. The application normalizes their scale, animates a hood pivot at runtime, and adds a separate schematic air-cleaner animation. The UI identifies the engine layout and action illustration as illustrative; precise part locations must be checked against the actual vehicle's manual. Retain the attribution and applicable license terms when redistributing these assets.
