// ESP32 Arduino core + ArduinoJson 7. See README.md before uploading.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <math.h>
#include "secrets.h"

// Default: mimic the meanings/encoding of OBD PIDs, without accessing a car.
// The simulated flag remains true even though these arrive over real Wi-Fi.
constexpr bool EMULATE_OBD = true;

// Used only with EMULATE_OBD=false. Enable only sensors that are connected and
// calibrated. Missing channels are null, never randomly generated measurements.
constexpr bool TEMPERATURE_CONNECTED = false;
constexpr bool VIBRATION_CONNECTED = false;
constexpr bool VOLTAGE_CONNECTED = false;
constexpr bool RPM_CONNECTED = false;
constexpr int TEMPERATURE_PIN = 34; // ADC1, classic ESP32 DevKit
constexpr int VIBRATION_PIN = 35;   // Conditioned/bias-centred analog output
constexpr int VOLTAGE_PIN = 32;     // Conditioned 0–3.3 V maximum input
constexpr int RPM_PIN = 27;         // 3.3 V pulse sensor; external rotation only
constexpr float THERMISTOR_BETA = 3950.0f;
constexpr float THERMISTOR_R0 = 10000.0f;
constexpr float SERIES_RESISTOR = 10000.0f;
constexpr float SUPPLY_VOLTS = 3.3f;
constexpr float VOLTAGE_SCALE = 1.0f; // Calibrate for the attached voltage module
constexpr float PULSES_PER_REVOLUTION = 1.0f;

volatile uint32_t rotationPulses = 0;
portMUX_TYPE pulseMux = portMUX_INITIALIZER_UNLOCKED;
uint32_t lastRpmMillis = 0, lastPoll = 0, lastWifiRetry = 0;
unsigned int sampleIndex = 0;
String previousScan;

struct HttpReply { int code; String body; };
HttpReply requestGateway(const String& path, const String& payload = "");

void ARDUINO_ISR_ATTR pulseDetected() {
  portENTER_CRITICAL_ISR(&pulseMux);
  rotationPulses++;
  portEXIT_CRITICAL_ISR(&pulseMux);
}

HttpReply requestGateway(const String& path, const String& payload) {
  HTTPClient http;
  WiFiClient plain;
  WiFiClientSecure secure;
  String url = String(GATEWAY_BASE_URL) + path;
  bool started;
  if (url.startsWith("https://")) {
    if (strlen(GATEWAY_ROOT_CA) == 0) return {-1, "HTTPS requires a root CA"};
    secure.setCACert(GATEWAY_ROOT_CA);
    started = http.begin(secure, url);
  } else if (url.startsWith("http://")) {
    started = http.begin(plain, url);
  } else return {-1, "Unsupported gateway URL"};
  if (!started) return {-1, "Could not open gateway connection"};
  http.setConnectTimeout(700);
  http.setTimeout(700);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  int code;
  if (payload.length()) {
    http.addHeader("Content-Type", "application/json");
    code = http.POST(payload);
  } else code = http.GET();
  String body = code > 0 ? http.getString() : "Network request failed";
  http.end();
  return {code, body};
}

void reportError(const String& scanId, const char* message) {
  JsonDocument status;
  status["scanId"] = scanId; status["error"] = message;
  String payload; serializeJson(status, payload);
  requestGateway("/device/status", payload);
}

bool attachedMeasurements(JsonDocument& data) {
  bool any = false;
  if (TEMPERATURE_CONNECTED) {
    // Divider: 3.3 V -> fixed series resistor -> ADC -> NTC -> ground.
    float volts = analogReadMilliVolts(TEMPERATURE_PIN) / 1000.0f;
    if (volts <= 0.05f || volts >= SUPPLY_VOLTS - 0.1f) return false;
    float resistance = SERIES_RESISTOR * volts / (SUPPLY_VOLTS - volts);
    float celsius = 1.0f / (1.0f / 298.15f + logf(resistance / THERMISTOR_R0) / THERMISTOR_BETA) - 273.15f;
    if (!isfinite(celsius) || celsius < -50 || celsius > 200) return false;
    data["temperature"] = celsius; any = true;
  }
  if (VIBRATION_CONNECTED) {
    // RMS of the AC part of a conditioned analog sensor signal, in VOLTS.
    // It is not acceleration in g and is not an OBD value.
    float sum = 0, squares = 0;
    for (int i = 0; i < 32; i++) {
      float v = analogReadMilliVolts(VIBRATION_PIN) / 1000.0f;
      sum += v; squares += v * v; delayMicroseconds(1000);
    }
    data["vibration"] = sqrtf(fmaxf(0, squares / 32 - (sum / 32) * (sum / 32)));
    any = true;
  }
  if (VOLTAGE_CONNECTED) {
    float voltage = analogReadMilliVolts(VOLTAGE_PIN) / 1000.0f * VOLTAGE_SCALE;
    if (!isfinite(voltage) || voltage < 0 || voltage > 60) return false;
    data["voltage"] = voltage; any = true;
  }
  if (RPM_CONNECTED) {
    portENTER_CRITICAL(&pulseMux);
    uint32_t pulses = rotationPulses; rotationPulses = 0;
    portEXIT_CRITICAL(&pulseMux);
    uint32_t now = millis(), elapsed = now - lastRpmMillis;
    lastRpmMillis = now;
    float rpm = elapsed ? pulses * 60000.0f / (elapsed * PULSES_PER_REVOLUTION) : 0;
    if (!isfinite(rpm) || rpm > 15000) return false;
    data["rpm"] = rpm; any = true;
  }
  return any;
}

void emulateObd(JsonDocument& data) {
  bool warning = sampleIndex % 10 == 7;
  int celsius = warning ? 108 : random(86, 94);
  unsigned int rpmRaw = (random(800, 940) + (sampleIndex % 5 == 3 ? 1000 : 0)) * 4;
  unsigned int voltageRaw = warning ? 11500 : random(13600, 14301);
  char coolant[7], rpm[9], voltage[9];
  snprintf(coolant, sizeof(coolant), "4105%02X", celsius + 40);
  snprintf(rpm, sizeof(rpm), "410C%04X", rpmRaw);
  snprintf(voltage, sizeof(voltage), "4142%04X", voltageRaw);
  data["temperature"] = celsius;      // PID 0105: A - 40 °C
  data["rpm"] = rpmRaw / 4.0f;        // PID 010C: (256*A + B) / 4 RPM
  data["voltage"] = voltageRaw / 1000.0f; // PID 0142: (256*A + B) / 1000 V
  data["vibration"] = random(40, 140) / 1000.0f;
  data["obd"]["coolant"] = coolant;
  data["obd"]["rpm"] = rpm;
  data["obd"]["voltage"] = voltage;
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  // Required for certificate date validation when using an HTTPS gateway.
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  if (!EMULATE_OBD && RPM_CONNECTED) {
    pinMode(RPM_PIN, INPUT_PULLUP);
    attachInterrupt(RPM_PIN, pulseDetected, RISING);
  }
  lastRpmMillis = millis();
  Serial.println(EMULATE_OBD ? "OBD emulation enabled: ALL values SIMULATED" : "Attached-sensor mode: no vehicle OBD interface");
}

void loop() {
  delay(1);
  uint32_t now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiRetry >= 5000) { lastWifiRetry = now; WiFi.reconnect(); }
    return;
  }
  if (now - lastPoll < 1000) return;
  lastPoll = now;
  HttpReply reply = requestGateway("/device/scan-control");
  if (reply.code != 200) { Serial.printf("Gateway unavailable: %d\n", reply.code); return; }
  JsonDocument control;
  if (deserializeJson(control, reply.body)) { Serial.println("Malformed scan control response"); return; }
  if (control["scanId"].isNull()) { previousScan = ""; return; }
  String scanId = control["scanId"].as<String>();
  if (scanId != previousScan) {
    previousScan = scanId; sampleIndex = 0; lastRpmMillis = millis();
    portENTER_CRITICAL(&pulseMux); rotationPulses = 0; portEXIT_CRITICAL(&pulseMux);
  }
  JsonDocument data;
  data["scanId"] = scanId; data["timestamp"] = control["timestamp"];
  data["simulated"] = EMULATE_OBD;
  data["temperature"] = nullptr; data["vibration"] = nullptr;
  data["voltage"] = nullptr; data["rpm"] = nullptr;
  if (EMULATE_OBD) emulateObd(data);
  else if (!attachedMeasurements(data)) {
    reportError(scanId, "No enabled sensors or a configured sensor returned an invalid measurement. Check firmware flags, wiring, and calibration.");
    return;
  }
  String payload; serializeJson(data, payload);
  HttpReply sent = requestGateway("/device/readings", payload);
  if (sent.code == 410) previousScan = ""; // Scan was cancelled/completed meanwhile.
  else if (sent.code != 200) Serial.printf("Reading rejected or gateway lost: %d\n", sent.code);
  sampleIndex++;
}
