/**
 * ============================================================================
 * VOKA-SEAT — ESP32 + PIR HC-SR501 Firmware Template
 * ============================================================================
 *
 * ATURAN WAJIB (AGENTS.md §3 Red Rules):
 *   - Sensor EKSKLUSIF: PIR HC-SR501 (inframerah pasif)
 *   - Orientasi: casing dimiringkan 30–45° ke bawah-depan menghadap kursi
 *   - Vacant Timeout: 10 menit sebelum status berubah dari 1 → 0
 *   - Debounce: sinyal HIGH harus bertahan ≥ 200ms sebelum dianggap valid
 *   - Pin: PIR_OUT → GPIO 27 (INPUT)
 *   - Polling: ≤ 100ms interval
 *
 * ALUR KERJA:
 *   1. ESP32 membaca GPIO 27 setiap 100ms
 *   2. Jika HIGH bertahan ≥ 200ms → status = 1 (occupied), reset vacant timer
 *   3. Jika LOW selama 10 menit berturut-turut → status = 0 (vacant)
 *   4. Setiap perubahan status → publish JSON ke MQTT topic
 *   5. Backend menerima → update DB → broadcast WebSocket → UI berubah warna
 *
 * KONEKSI KE BACKEND:
 *   - MQTT Broker: sesuaikan MQTT_BROKER_HOST dan MQTT_BROKER_PORT
 *   - Topic: "vokafe/iot/telemetry"
 *   - Payload: {"id_kursi": <1-24>, "status": <0|1>}
 *   - Payload harus ≤ 256 bytes dan valid JSON
 *
 * DEPENDENSI (install via Arduino Library Manager):
 *   - WiFi.h (built-in ESP32)
 *   - PubSubClient by Nick O'Leary (MQTT)
 *   - ArduinoJson by Benoit Blanchon (JSON serialization)
 *
 * ============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ============================================================================
// KONFIGURASI — SESUAIKAN SEBELUM UPLOAD
// ============================================================================

// --- WiFi (VLAN 20 Hidden SSID "VOKAFE-IoT") ---
const char* WIFI_SSID     = "VOKAFE-IoT";       // Hidden SSID, VLAN 20
const char* WIFI_PASSWORD = "ganti-dengan-password-iot";

// --- MQTT Broker ---
// Untuk preview lokal: gunakan IP komputer yang menjalankan backend
// Untuk production: gunakan domain cloud server
const char* MQTT_BROKER_HOST = "192.168.20.1";   // Ganti dengan IP/domain broker
const int   MQTT_BROKER_PORT = 1883;             // Port MQTT (default 1883)
const char* MQTT_TOPIC       = "vokafe/iot/telemetry";

// --- Identitas Node ---
// Setiap ESP32 node mewakili SATU kursi. Ganti sesuai posisi pemasangan.
const int   SEAT_ID          = 5;                // ID kursi (1–24)
const char* MQTT_CLIENT_ID   = "voka-seat-05";   // Unik per node

// --- Pin Hardware ---
const int   PIR_PIN          = 27;               // GPIO 27 — PIR HC-SR501 OUT

// --- Timing (dalam milidetik) ---
const unsigned long POLL_INTERVAL_MS    = 100;        // Polling setiap 100ms
const unsigned long DEBOUNCE_MS         = 200;        // HIGH harus bertahan 200ms
const unsigned long VACANT_TIMEOUT_MS   = 600000;     // 10 menit = 600.000ms
const unsigned long WIFI_RECONNECT_MS   = 5000;       // Reconnect WiFi tiap 5 detik
const unsigned long MQTT_RETRY_DELAY_MS = 2000;       // Retry MQTT publish tiap 2 detik
const int           MQTT_MAX_RETRIES    = 3;          // Maksimal 3x retry publish

// --- Fault Detection ---
const unsigned long FAULT_TIMEOUT_MS    = 3600000;    // 60 menit tanpa perubahan = fault

// ============================================================================
// STATE VARIABLES
// ============================================================================

WiFiClient   espClient;
PubSubClient mqttClient(espClient);

int  currentStatus       = 0;       // 0 = vacant, 1 = occupied
int  lastPublishedStatus = -1;      // Force publish on first boot
bool pirHighStarted      = false;
unsigned long pirHighStartTime  = 0;
unsigned long lastMotionTime    = 0;
unsigned long lastPollTime      = 0;
unsigned long lastStatusChange  = 0;
unsigned long bootTime          = 0;

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println("\n========================================");
  Serial.println("  VOKA-SEAT Node — ESP32 + PIR HC-SR501");
  Serial.printf("  Seat ID: %d\n", SEAT_ID);
  Serial.println("========================================\n");

  // Inisialisasi GPIO
  pinMode(PIR_PIN, INPUT);

  // Inisialisasi status awal = 0 (vacant) per AGENTS.md §3
  currentStatus = 0;
  lastMotionTime = millis();
  bootTime = millis();

  // Koneksi WiFi
  connectWiFi();

  // Konfigurasi MQTT
  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);

  // Koneksi MQTT
  connectMQTT();

  // Publish status awal saat boot (sync state)
  publishStatus();

  Serial.println("✅ Setup complete. Polling started.\n");
}

// ============================================================================
// LOOP — Polling setiap 100ms
// ============================================================================

void loop() {
  unsigned long now = millis();

  // Pastikan koneksi WiFi dan MQTT tetap aktif
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    // Discard telemetry selama disconnected (AGENTS.md §3)
    return;
  }

  if (!mqttClient.connected()) {
    connectMQTT();
    if (!mqttClient.connected()) {
      delay(WIFI_RECONNECT_MS);
      return;
    }
    // Transmit current state on reconnection for sync
    publishStatus();
  }

  mqttClient.loop();

  // Polling interval guard
  if (now - lastPollTime < POLL_INTERVAL_MS) return;
  lastPollTime = now;

  // --- Baca sensor PIR ---
  int pirReading = digitalRead(PIR_PIN);

  // --- Debounce logic (200ms) ---
  if (pirReading == HIGH) {
    if (!pirHighStarted) {
      pirHighStarted = true;
      pirHighStartTime = now;
    } else if (now - pirHighStartTime >= DEBOUNCE_MS) {
      // Gerakan terdeteksi dan sudah melewati debounce
      lastMotionTime = now;

      if (currentStatus == 0) {
        // Transisi: vacant → occupied
        currentStatus = 1;
        lastStatusChange = now;
        Serial.printf("🪑 Seat %d: OCCUPIED (motion detected)\n", SEAT_ID);
        publishStatus();
      }
    }
  } else {
    pirHighStarted = false;
  }

  // --- Vacant Timeout (10 menit tanpa gerakan) ---
  if (currentStatus == 1) {
    if (now - lastMotionTime >= VACANT_TIMEOUT_MS) {
      currentStatus = 0;
      lastStatusChange = now;
      Serial.printf("🪑 Seat %d: VACANT (10-min timeout)\n", SEAT_ID);
      publishStatus();
    }
  }

  // --- Fault Detection (60 menit tanpa perubahan) ---
  if (now - lastStatusChange >= FAULT_TIMEOUT_MS && lastStatusChange > 0) {
    Serial.printf("⚠️  Seat %d: FAULT — no state change for 60 minutes\n", SEAT_ID);
    // Opsional: kirim flag fault ke backend atau nyalakan LED indikator
    lastStatusChange = now; // Reset agar tidak spam log
  }
}

// ============================================================================
// MQTT PUBLISH — dengan retry 3x
// ============================================================================

void publishStatus() {
  // Buat JSON payload: {"id_kursi": 5, "status": 1}
  StaticJsonDocument<64> doc;
  doc["id_kursi"] = SEAT_ID;
  doc["status"]   = currentStatus;

  char payload[64];
  serializeJson(doc, payload, sizeof(payload));

  bool published = false;
  for (int attempt = 1; attempt <= MQTT_MAX_RETRIES; attempt++) {
    if (mqttClient.publish(MQTT_TOPIC, payload)) {
      published = true;
      Serial.printf("📤 Published: %s (attempt %d)\n", payload, attempt);
      break;
    }
    Serial.printf("❌ Publish failed (attempt %d/%d)\n", attempt, MQTT_MAX_RETRIES);
    delay(MQTT_RETRY_DELAY_MS);
  }

  if (published) {
    lastPublishedStatus = currentStatus;
  } else {
    Serial.println("⚠️  All publish retries exhausted. Will retry on next change.");
  }
}

// ============================================================================
// WiFi CONNECTION
// ============================================================================

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("📶 Connecting to WiFi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n✅ WiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n❌ WiFi connection failed. Will retry...");
  }
}

// ============================================================================
// MQTT CONNECTION
// ============================================================================

void connectMQTT() {
  if (mqttClient.connected()) return;

  Serial.printf("🔌 Connecting to MQTT: %s:%d\n", MQTT_BROKER_HOST, MQTT_BROKER_PORT);

  if (mqttClient.connect(MQTT_CLIENT_ID)) {
    Serial.println("✅ MQTT connected!");
  } else {
    Serial.printf("❌ MQTT connection failed, rc=%d\n", mqttClient.state());
  }
}
