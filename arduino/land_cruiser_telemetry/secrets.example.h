#pragma once
// Copy to secrets.h (gitignored), then fill these in locally.
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
// A LAN address reachable from the board, or an HTTPS gateway. No trailing slash.
const char* GATEWAY_BASE_URL = "http://192.168.1.10:8000";
const char* DEVICE_TOKEN = "MATCH_BACKEND_SENSOR_DEVICE_TOKEN";
// For HTTPS, paste the gateway certificate authority's PEM certificate here.
// TLS verification is required; the firmware never calls setInsecure().
const char* GATEWAY_ROOT_CA = "";
