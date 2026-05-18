/**
 * ============================================================================
 * VOKA-SEAT Node — ESP32 + PIR HC-SR501
 * ============================================================================
 *
 * ATURAN WAJIB (AGENTS.md §3 — Red Rules, JANGAN diubah):
 *   1. Sensor EKSKLUSIF: PIR HC-SR501 (passive infrared, deteksi panas tubuh)
 *   2. Pemasangan: under-table mounting, double-sided industrial tape
 *   3. Orientasi casing: 30-45 derajat ke bawah-depan menghadap kursi
 *   4. Vacant Timeout: 10 menit pergerakan berhenti sebelum status berubah ke 0
 *   5. Debounce: HIGH harus bertahan ≥ 200 ms sebelum dianggap valid
 *   6. Polling: ≤ 100 ms interval
 *
 * PIN MAPPING (WAJIB):
 *   PIR VCC  → ESP32 VCC (3V3 atau 5V)
 *   PIR GND  → ESP32 GND
 *   PIR OUT  → ESP32 GPIO 27 (INPUT digital)
 *
 * ALUR DATA:
 *   PIR detect → debounce 200ms → ESP32 set status = 1
 *      ↓
 *   Publish JSON ke broker MQTT publik:
 *      vokafe.duckdns.org:1884 / topic: vokafe/iot/telemetry
 *      Payload: {"id_kursi": <1-24>, "status": <0|1>}
 *      ↓
 *   Backend (voka_seat_backend) terima → update PostgreSQL
 *      → broadcast WebSocket ke semua client
 *      → UI customer + admin update warna kursi instant
 *
 * LIBRARY DEPENDENCIES (Arduino Library Manager):
 *   - WiFi.h           (built-in ESP32 core)
 *   - PubSubClient     by Nick O'Leary       (MQTT client)
 *   - ArduinoJson      by Benoit Blanchon    (JSON serializer, v6 atau v7)
 *
 * BOARD CONFIG (Arduino IDE → Tools):
 *   Board     : ESP32 Dev Module (atau board spesifik kamu)
 *   Upload    : 921600 baud
 *   Flash     : 4MB / 80MHz
 *   Partition : Default
 *
 * ============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ============================================================================
// KONFIGURASI — SESUAIKAN PER NODE SEBELUM UPLOAD
// ============================================================================

// --- Identitas Node ---
// SETIAP ESP32 mewakili SATU kursi. Ganti SEAT_ID dan MQTT_CLIENT_ID
// per node sesuai posisi pemasangan fisik.
const int   SEAT_ID         = 5;             // ID kursi (1–24)
const char* MQTT_CLIENT_ID  = "voka-seat-05"; // Unik per node

// --- WiFi ---
// Sesuaikan dengan jaringan yang digunakan ESP32 untuk konek ke internet.
// Untuk production sesuai design.md, harusnya hidden SSID VLAN 20 (VOKAFE-IoT).
// Untuk demo / development, bisa pakai WiFi rumah / hotspot.
const char* WIFI_SSID     = "ganti-dengan-ssid";
const char* WIFI_PASSWORD = "ganti-dengan-password-wifi";

// --- MQTT Broker (production) ---
const char* MQTT_BROKER_HOST = "vokafe.duckdns.org";
const int   MQTT_BROKER_PORT = 1884;
const char* MQTT_TOPIC       = "vokafe/iot/telemetry";

// MVP: broker pakai allow_anonymous = true. Username/password kosong.
// Untuk production hardening (lihat deploy/DEPLOY_COMMANDS.md §10),
// ganti dua baris di bawah dengan kredensial dari mosquitto_passwd.
const char* MQTT_USERNAME = "";
const char* MQTT_PASSWORD = "";

// --- Pin Hardware ---
const int PIR_PIN = 27;               // GPIO 27 — PIR HC-SR501 OUT

// --- Timing (milidetik) ---
const unsigned long POLL_INTERVAL_MS    = 100;        // Polling setiap 100ms
const unsigned long DEBOUNCE_MS         = 200;        // HIGH harus bertahan 200ms
const unsigned long VACANT_TIMEOUT_MS   = 600000UL;   // 10 menit = 600.000ms
const unsigned long WIFI_RECONNECT_MS   = 5000;       // Reconnect WiFi tiap 5 detik
const unsigned long MQTT_RETRY_DELAY_MS = 2000;       // Retry MQTT publish tiap 2 detik
const int           MQTT_MAX_RETRIES    = 3;          // Maksimal 3x retry per publish

// --- Fault Detection (opsional) ---
const unsigned long FAULT_TIMEOUT_MS = 3600000UL;     // 60 menit tanpa perubahan

// ============================================================================
// STATE VARIABLES — JANGAN diubah manual
// ============================================================================
WiFiClient   espClient;
PubSubClient mqttClient(espClient);

int  currentStatus      = 0;
bool pirHighStarted     = false;
unsigned long pirHighStartTime = 0;
unsigned long lastMotionTime   = 0;
unsigned long lastPollTime     = 0;
unsigned long lastStatusChange = 0;

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println("\n========================================");
  Serial.println("  VOKA-SEAT Node");
  Serial.printf ("  Seat ID    : %d\n", SEAT_ID);
  Serial.printf ("  Client ID  : %s\n", MQTT_CLIENT_ID);
  Serial.printf ("  Broker     : %s:%d\n", MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  Serial.printf ("  Topic      : %s\n", MQTT_TOPIC);
  Serial.println("========================================\n");

  pinMode(PIR_PIN, INPUT);

  currentStatus    = 0;
  lastMotionTime   = millis();
  lastStatusChange = millis();

  // Set buffer size untuk PubSubClient (default 256 cukup, payload kita kecil)
  mqttClient.setBufferSize(256);
  mqttClient.setKeepAlive(60);
  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);

  connectWiFi();
  connectMQTT();

  // Publish status awal (vacant) saat boot — sync state ke backend
  publishStatus();

  Serial.println("✅ Setup complete. Polling started.\n");
}

// ============================================================================
// LOOP
// ============================================================================
void loop() {
  unsigned long now = millis();

  // ---- Health: WiFi + MQTT keepalive ----
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi disconnected, reconnecting...");
    connectWiFi();
    return;
  }
  if (!mqttClient.connected()) {
    Serial.println("⚠️  MQTT disconnected, reconnecting...");
    connectMQTT();
    if (!mqttClient.connected()) {
      delay(WIFI_RECONNECT_MS);
      return;
    }
    // Pada reconnect, kirim ulang state terakhir untuk sync
    publishStatus();
  }
  mqttClient.loop();

  // ---- Polling guard ----
  if (now - lastPollTime < POLL_INTERVAL_MS) return;
  lastPollTime = now;

  // ---- Baca PIR ----
  int pirReading = digitalRead(PIR_PIN);

  // ---- Debounce HIGH (200ms) ----
  if (pirReading == HIGH) {
    if (!pirHighStarted) {
      pirHighStarted   = true;
      pirHighStartTime = now;
    } else if (now - pirHighStartTime >= DEBOUNCE_MS) {
      // Gerakan ter-debounce, refresh "last motion"
      lastMotionTime = now;

      // Transisi vacant → occupied
      if (currentStatus == 0) {
        currentStatus    = 1;
        lastStatusChange = now;
        Serial.printf("🪑 Seat %d: OCCUPIED (motion detected)\n", SEAT_ID);
        publishStatus();
      }
    }
  } else {
    pirHighStarted = false;
  }

  // ---- Vacant Timeout (10 menit tanpa gerakan) ----
  if (currentStatus == 1 && (now - lastMotionTime >= VACANT_TIMEOUT_MS)) {
    currentStatus    = 0;
    lastStatusChange = now;
    Serial.printf("🪑 Seat %d: VACANT (10-min timeout)\n", SEAT_ID);
    publishStatus();
  }

  // ---- Fault detection (60 menit tanpa perubahan, opsional) ----
  if (now - lastStatusChange >= FAULT_TIMEOUT_MS) {
    Serial.printf("⚠️  Seat %d: no state change for 60 minutes (sensor fault?)\n", SEAT_ID);
    lastStatusChange = now;  // reset agar tidak spam log
  }
}

// ============================================================================
// MQTT PUBLISH (dengan retry 3x)
// ============================================================================
void publishStatus() {
  // Pastikan MQTT connected sebelum publish
  if (!mqttClient.connected()) {
    Serial.println("❌ Cannot publish — MQTT not connected");
    return;
  }

  // Build payload JSON: {"id_kursi": 5, "status": 1}
  StaticJsonDocument<64> doc;
  doc["id_kursi"] = SEAT_ID;
  doc["status"]   = currentStatus;

  char payload[80];
  size_t len = serializeJson(doc, payload, sizeof(payload));
  if (len == 0) {
    Serial.println("❌ JSON serialization failed");
    return;
  }

  // Retry up to MQTT_MAX_RETRIES
  for (int attempt = 1; attempt <= MQTT_MAX_RETRIES; attempt++) {
    if (mqttClient.publish(MQTT_TOPIC, payload, false)) {
      Serial.printf("📤 Published (attempt %d): %s\n", attempt, payload);
      return;
    }
    Serial.printf("❌ Publish failed (attempt %d/%d), retrying...\n", attempt, MQTT_MAX_RETRIES);
    delay(MQTT_RETRY_DELAY_MS);
  }

  Serial.println("⚠️  All publish retries exhausted. Will retry on next state change.");
}

// ============================================================================
// WIFI CONNECTION
// ============================================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("📶 Connecting to WiFi: %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✅ WiFi connected! IP: %s, RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\n❌ WiFi connection failed.");
  }
}

// ============================================================================
// MQTT CONNECTION
// ============================================================================
void connectMQTT() {
  if (mqttClient.connected()) return;
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.printf("🔌 Connecting to MQTT: %s:%d", MQTT_BROKER_HOST, MQTT_BROKER_PORT);

  bool ok;
  // PubSubClient.connect() varian: dengan / tanpa username
  if (strlen(MQTT_USERNAME) > 0) {
    ok = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);
  } else {
    ok = mqttClient.connect(MQTT_CLIENT_ID);
  }

  if (ok) {
    Serial.println(" ✅ MQTT connected!");
  } else {
    Serial.printf(" ❌ MQTT connection failed, rc=%d\n", mqttClient.state());
    Serial.println("    rc codes: -4=timeout, -3=lost, -2=conn-failed, -1=disconn,");
    Serial.println("              0=ok, 1=bad-proto, 2=bad-id, 3=unavailable,");
    Serial.println("              4=bad-credentials, 5=unauthorized");
  }
}
