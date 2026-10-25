# Real car models

Drop licensed `.glb` files here, e.g. `camry.glb` and `sienna.glb`.

Then return the file URL from the visualization endpoint in `lib/mock.ts`
(`getVehicleVisualization`), uncommenting `modelUrl: '/models/camry.glb'`.

The app centres the model, sits it on the floor and scales it to the car's length.
Highlighting works for meshes whose names match a part (hood, door_front_left,
bumper_rear, headlight_r, wheel_fl ...). The matching rules are in
`partIdForName` in `lib/car.ts`. Unmatched meshes still render but can't be selected.
