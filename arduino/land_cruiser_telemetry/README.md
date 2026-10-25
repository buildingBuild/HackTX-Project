# Land Cruiser scan data: ESP32 Wi-Fi gateway

This integration applies only to **Sam Taylor, c08 — 2022 Toyota Land Cruiser 300 VX.R**. Other profiles keep their existing OBD/diagnostic flow. The app's existing scan entry starts collection automatically; there is no separate collection button.

## What the values mean

The browser Demo Mode and the firmware's default `EMULATE_OBD=true` produce **synthetic Mode 01 OBD response payloads**, decode them, and feed them into the Land Cruiser's live scan statistics. They emulate data values, not an ELM327 serial command protocol or a connection to a vehicle's CAN bus.

- `temperature`: emulated engine **coolant temperature in °C**, PID `0105`. Response `41 05 A`: `A - 40`. Example `41057B` → **83 °C**.
- `rpm`: emulated **engine speed in revolutions per minute**, PID `010C`. Response `41 0C A B`: `(256*A + B)/4`. Example `410C0D48` → **850 RPM**.
- `voltage`: emulated **control-module supply voltage in volts**, PID `0142`. Response `41 42 A B`: `(256*A + B)/1000`. Example `414235E8` → **13.8 V**. This is not battery state of charge or battery health.
- `vibration`: an **additional sensor signal, in volts RMS**, not a standard OBD PID or acceleration in g. In attached-sensor mode the firmware calculates the AC RMS of a conditioned analog signal after removing its DC mean.

The OBD meanings and conversions follow [ELM Electronics' interpreter documentation](https://www.elmelectronics.com/wp-content/uploads/2016/07/ELM327DS.pdf) and the [Emtron OBD reference](https://docs.emtronaustralia.com.au/displays/functions/obd2/index.html). Firmware APIs use the [Espressif Arduino core](https://docs.espressif.com/projects/arduino-esp32/en/latest/index.html) and [ArduinoJson 7](https://arduinojson.org/v7/api/).

No simulated threshold trigger changes a DTC, proves a fault, verifies a repair, or alters the profile's fixture diagnosis. The existing `MAINT-AIR-FILTER` result is a separately labeled demo technician scenario; coolant/RPM/voltage/vibration do not establish a dirty air filter.

## Test without any hardware

1. Start the existing backend and frontend as described in `frontend/diagnostic-bay/README.md`.
2. Choose **Sam Taylor (c08)**. Leave **Demo Mode · simulated OBD** selected and click **Start Vehicle Scan**.
3. Samples start once per second during the existing connection screen. The normal workspace appears after the connection sequence and continues updating the same capture. Land Cruiser scans use a **12-second minimum capture window**; completion also waits for the existing diagnosis request.
4. The four readings, small history charts, sample counter, last-success time, scan ID, and provenance label update together. An occasional synthetic excursion triggers the actual configured demo rules. Normal demo readings are around 86–93 °C, 800–940 RPM (occasional short revs), and 13.6–14.3 V.
5. Click **Cancel vehicle scan** while active. Counts and charts must stop. Start again: a new UUID and an empty sample history must appear. A completed scan keeps its captured values but stops receiving new ones.
6. Choose another customer and confirm their original workflow remains available without sensor settings or telemetry.

## Gateway configuration

Add a new random secret of at least 16 characters to the backend `.env` as `SENSOR_DEVICE_TOKEN`. An optional `SENSOR_DEVICE_ID` is display metadata. Restart the backend and refresh the app. The frontend receives only whether hardware is configured; no device secret is returned or placed in `NEXT_PUBLIC_*` variables.

The browser uses the existing `NEXT_PUBLIC_API_BASE_URL`. The ESP32 must reach that **same backend process** via the laptop's LAN address or an HTTPS gateway, not the board's own `localhost`. For a trusted development LAN, run the backend with:

```sh
cd agent-backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

Use HTTPS with a configured root CA when the device connects outside a trusted local development network. Firmware verifies HTTPS certificates. Configure Wi-Fi credentials and the device token only in the local ignored `secrets.h`.

This lightweight gateway stores sessions in memory. Run **one backend worker**; restarting it clears active captures. Multiple workers or durable collection require shared session storage, which is outside this integration. Only one hardware scan can own the device at once. History is bounded to 120 readings per session and 32 sessions; no database migration is needed.

## Initial firmware upload

Target: **classic ESP32 DevKit**, using the Espressif Arduino board package and **ArduinoJson 7**. Other ESP32 variants need their ADC/GPIO pin assignments adjusted. A plain Uno without networking needs an appropriate Wi-Fi gateway and is not supported by this Wi-Fi sketch as-is.

1. Copy `secrets.example.h` to `secrets.h`. Fill in the Wi-Fi SSID/password, the backend's LAN/HTTPS URL, and the matching `SENSOR_DEVICE_TOKEN`. For HTTPS, include the server CA's PEM in `GATEWAY_ROOT_CA` and allow network time synchronization.
2. Leave `EMULATE_OBD=true` for a board-based OBD-value demonstration. It sends `simulated:true` in every message. The app will say **ESP32 OBD emulator · SIMULATED**, even in Hardware Mode.
3. Install/upload with Arduino IDE or Arduino CLI. With CLI installed, the initial commands are:

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli lib install "ArduinoJson@7.4.3"
arduino-cli compile --fqbn esp32:esp32:esp32 arduino/land_cruiser_telemetry
arduino-cli board list
# Replace YOUR_PORT with the ESP32's listed USB serial port.
arduino-cli upload --port YOUR_PORT --fqbn esp32:esp32:esp32 arduino/land_cruiser_telemetry
```

4. Power the board and select **Hardware Mode · ESP32 Wi-Fi** for c08. Click **Start Vehicle Scan**. The board discovers the active scan automatically and publishes roughly once per second. **Arduino IDE and Serial Monitor do not need to remain open.**
5. Disconnect board power or Wi-Fi during a scan: after four seconds without readings, the app reports a disconnect and retains the last successful sample. Reconnect during the active scan to resume. A cancelled/completed scan stops accepting readings immediately; the board learns that it should stop on its next control poll.

Firmware compilation and a physical upload must be checked with the target ESP32 toolchain/board. The included software tests exercise the gateway contract, encodings, and lifecycle independently of hardware.

## Optional attached-sensor measurements

Set `EMULATE_OBD=false`, enable only connected/calibrated channels, and review the pin/constants in the sketch:

- Temperature: 10 kΩ/B3950 NTC divider on GPIO34, fixed 10 kΩ resistor to 3.3 V and NTC to ground. The value describes the thermistor's actual location, **not vehicle coolant** by assumption.
- Vibration: conditioned, DC-biased analog sensor output on GPIO35. Output is V RMS after mean removal; no calibration to acceleration is claimed.
- Voltage: conditioned analog input on GPIO32, scaled by `VOLTAGE_SCALE`. This is the attached module's measurement, not automatically a car battery measurement.
- Rotation: 3.3 V-compatible pulse sensor on GPIO27 with calibrated `PULSES_PER_REVOLUTION`. This describes the attached rotating target, not automatically engine RPM.

Inputs must stay within the board's electrical limits. Do not connect a battery, ignition pulse, raw piezo element, or vehicle OBD/CAN wiring directly to ESP32 GPIO. Automotive electrical connections need suitable protected, isolated interfaces; this sketch does not provide one.

Unconfigured channels are `null`; if no channel is configured or a sensor is invalid, firmware reports a device error rather than inventing a reading. The UI labels these **Attached sensors · MEASURED**. Source provenance cannot change midway through a scan. Restart the scan when changing firmware mode.

Thresholds are centralized in `frontend/diagnostic-bay/lib/telemetry.ts`. Demo rules are temperature >105 °C, voltage <11.8 or >15.2 V, RPM >4500, and vibration signal >0.35 V RMS. These are demo thresholds, not Toyota diagnostic specifications. `ATTACHED_SENSOR_RULES` defaults to disabled thresholds: configure rules only after matching the actual sensor placement, calibration, and use case.

## JSON and lifecycle contract

Example emulated payload, sent by the device to `POST /device/readings` with a `Bearer` device token:

```json
{"scanId":"1b03d055-5e38-4319-a001-4b009020b7ea","timestamp":"2026-10-25T15:00:00Z","simulated":true,"temperature":83,"vibration":0.12,"voltage":13.8,"rpm":850,"obd":{"coolant":"41057B","rpm":"410C0D48","voltage":"414235E8"}}
```

`scanId` must be the UUID returned by authenticated `GET /device/scan-control`, not a hard-coded profile ID. That response supplies the server timestamp as well, so the device need not invent wall-clock time. All four metric keys are required; an unattached channel is `null`. An attached-sensor message uses `simulated:false` and omits `obd`. At least one metric must be measured.

Backend and frontend reject malformed/nonfinite/out-of-range values, wrong sessions, missing provenance, stale/future timestamps, duplicate/out-of-order readings, and OBD frames that disagree with their decoded metrics. Valid data resumes the same active session after reconnecting; no stale backlog is replayed into a new scan.

The frontend collector owns one source and one polling chain. It stops on completion, cancellation, diagnostic errors, customer reset, or unmount/page hide. Browser polls renew an eight-second device lease; a lost browser expires automatically, with a hard maximum of 120 seconds per hardware capture.

Routes: browser `GET /sensor-config`, `POST /sensor-scans`, `GET /sensor-scans/{id}?after=<sequence>`, `POST /sensor-scans/{id}/stop`; authenticated device `GET /device/scan-control`, `POST /device/readings`, `POST /device/status`.

## Exercise Hardware Mode without an ESP32

After configuring the backend token, run this in the same Python environment as the backend:

```sh
python arduino/land_cruiser_telemetry/mock_device.py --gateway http://localhost:8000
```

This process reads the token from the backend `.env` or environment, waits for the app's active scan, then posts **simulated** OBD payloads over the actual gateway. Choose Hardware Mode for c08 and start a scan. Stop the emulator during capture to test disconnect handling; restart it before the capture ends to test recovery. It never represents synthetic values as physical measurements.

Run automated checks from `frontend/diagnostic-bay` with `npm test` and `npx tsc --noEmit`; from `agent-backend`, run `python -m unittest test_sensor_gateway test_guided_repair` using its configured Python environment.
