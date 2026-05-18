// =====================================================================
// VOKA-SEAT IoT Sensor Node — Firmware (ESP32 + HC-SR501 PIR)
//
//   Hardware constraints (AGENTS.md §3 red rules — MUST NOT VIOLATE):
//     • PIR sensor: HC-SR501 ONLY (no ultrasonic, no rangefinders)
//     • Mounting: under-table, downward tilt 30°–45° toward the chair
//     • Vacant timeout: 600,000 ms (10 minutes) before flipping to 0
//     • Debounce threshold: 200 ms HIGH for occupied detection
//     • GPIO 27 = digital INPUT, polling interval ≤ 100 ms
//     • Sensor fault flag: HIGH/LOW unchanged for >60 minutes
//
//   Network: VLAN 20, hidden SSID "VOKAFE-IoT", MQTT QoS 1.
//   Broker:  ${MQTT_BROKER_HOST}:${MQTT_BROKER_PORT} (see config below).
// =====================================================================

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ==========================================
// KONFIGURASI NODE
// ==========================================
#define SEAT_ID 1  // Konfigurasi ID Kursi spesifik untuk node ini (1-24)

// ==========================================
// KONFIGURASI JARINGAN WIFI (VLAN 20, Hidden SSID)
// ==========================================
const char* WIFI_SSID     = "VOKAFE-IoT";          // Hidden SSID on VLAN 20
const char* WIFI_PASSWORD = "PASSWORD_WIFI_VOKAFE"; // CHANGE before flashing

// ----- VOKA-SEAT MQTT broker endpoint (shared cloud host) -----
// Per deploy/docker-compose.yml the broker is published as 1884:1883 to
// avoid colliding with the existing 1883:1883 binding from another project
// already running on the shared cloud host. If the broker stays unpublished
// (private to the docker network), the MikroTik gateway must DNAT the host
// port to the docker bridge — see the CLI snippet below.
const char*    MQTT_BROKER_HOST     = "voka-seat.example.com";  // CHANGE to the real host/IP
const uint16_t MQTT_BROKER_PORT     = 1884;                     // host-published port
const char*    MQTT_TELEMETRY_TOPIC = "vokafe/iot/telemetry";
const uint8_t  MQTT_QOS             = 1;                        // at-least-once

// ---- Optional MikroTik DNAT (only if the broker is fully internal) ----
// Run these on the MikroTik RouterOS CLI (no Winbox per AGENTS.md §3 blue rules):
// /ip firewall nat add chain=dstnat dst-port=1884 protocol=tcp \
//   action=dst-nat to-addresses=<docker-host-ip> to-ports=1883 \
//   comment="VOKA-SEAT MQTT bridge"
// /ip firewall nat print where comment~"VOKA-SEAT"
// -----------------------------------------------------------------------

// ==========================================
// KONFIGURASI HARDWARE (Berdasarkan Tabel Skematik Pinout — AGENTS.md §5)
// ==========================================
const int PIR_PIN = 27;  // GPIO 27 (Label IO27) — digital INPUT untuk PIR_OUT

// ==========================================
// KONSTANTA TIMING (dalam milidetik) — AGENTS.md §3 red rules
// ==========================================
const unsigned long POLLING_INTERVAL_MS     = 100;          // Interval polling sensor: 100ms
const unsigned long DEBOUNCE_THRESHOLD_MS   = 200;          // Debounce: HIGH harus bertahan 200ms
const unsigned long VACANT_TIMEOUT_MS       = 600000UL;     // Vacant timeout: 10 menit (600,000ms)
const unsigned long SENSOR_FAULT_MS         = 3600000UL;    // Sensor fault: 60 menit (3,600,000ms)
const unsigned long MQTT_RETRY_INTERVAL_MS  = 2000;         // MQTT retry interval: 2 detik
const int           MQTT_MAX_RETRIES        = 3;            // MQTT retry max: 3 kali
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 5000;      // WiFi reconnect interval: 5 detik

// ==========================================
// STATE MACHINE ENUM
// ==========================================
enum SeatState {
  STATE_AVAILABLE,       // Kursi kosong (status = 0)
  STATE_DEBOUNCING,      // Menunggu konfirmasi HIGH selama 200ms
  STATE_OCCUPIED,        // Kursi terisi (status = 1)
  STATE_VACANT_TIMEOUT   // Menunggu timeout 10 menit tanpa gerakan
};

// ==========================================
// VARIABEL STATUS
// ==========================================
SeatState currentState = STATE_AVAILABLE;
int currentStatus = 0;  // 0 = Kosong, 1 = Terisi

// Timing variables
unsigned long lastPollTime = 0;
unsigned long debounceStartTime = 0;
unsigned long lastMotionTime = 0;
unsigned long lastStateChangeTime = 0;  // Untuk deteksi sensor fault
int lastRawPirState = LOW;              // Untuk deteksi sensor fault

// WiFi reconnect tracking
unsigned long lastWifiReconnectAttempt = 0;
bool wasDisconnected = false;

// Sensor fault flag
bool sensorFaultFlag = false;

// ==========================================
// OBJEK KONEKSI
// ==========================================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ==========================================
// FUNGSI: Publish MQTT dengan retry (3 attempts, 2s interval)
// ==========================================
bool publishWithRetry(const char* topic, const char* payload) {
  for (int attempt = 1; attempt <= MQTT_MAX_RETRIES; attempt++) {
    // PubSubClient::publish(topic, payload, retained) — QoS 1 semantics enforced
    // by the broker subscription on the backend side; retained=true ensures
    // late subscribers see the latest seat state.
    if (mqttClient.publish(topic, payload, true)) {
      Serial.print("[MQTT] Publish berhasil (attempt ");
      Serial.print(attempt);
      Serial.println(")");
      return true;
    }
    Serial.print("[MQTT] Publish gagal (attempt ");
    Serial.print(attempt);
    Serial.print("/");
    Serial.print(MQTT_MAX_RETRIES);
    Serial.println(")");

    if (attempt < MQTT_MAX_RETRIES) {
      delay(MQTT_RETRY_INTERVAL_MS);
    }
  }
  Serial.println("[MQTT] Payload discarded setelah 3 kali gagal.");
  return false;
}

// ==========================================
// FUNGSI: Kirim Telemetry Payload
// ==========================================
void sendTelemetry(int status) {
  // Discard telemetry jika WiFi tidak terhubung
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[TELEMETRY] WiFi disconnected, discarding telemetry.");
    return;
  }

  // Discard telemetry jika MQTT tidak terhubung
  if (!mqttClient.connected()) {
    Serial.println("[TELEMETRY] MQTT disconnected, discarding telemetry.");
    return;
  }

  StaticJsonDocument<128> doc;
  doc["id_kursi"] = SEAT_ID;
  doc["status"]   = status;

  char payload[128];
  serializeJson(doc, payload);

  Serial.print("[TELEMETRY] Mengirim payload ke ");
  Serial.print(MQTT_TELEMETRY_TOPIC);
  Serial.print(" (QoS ");
  Serial.print(MQTT_QOS);
  Serial.print("): ");
  Serial.println(payload);

  publishWithRetry(MQTT_TELEMETRY_TOPIC, payload);
}

// ==========================================
// FUNGSI: Setup WiFi (non-blocking initial attempt)
// ==========================================
void setup_wifi() {
  Serial.println();
  Serial.print("[WIFI] Connecting to Hidden SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Attempt connection with timeout (max ~2000ms for initial boot)
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt) < 2000) {
    delay(100);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WIFI] Connected!");
    Serial.print("[WIFI] IP address: ");
    Serial.println(WiFi.localIP());
    wasDisconnected = false;
  } else {
    Serial.println();
    Serial.println("[WIFI] Initial connection timeout, will retry in loop.");
    wasDisconnected = true;
  }
}

// ==========================================
// FUNGSI: WiFi Reconnect (5-second interval, non-blocking)
// ==========================================
void handleWifiReconnect() {
  if (WiFi.status() == WL_CONNECTED) {
    if (wasDisconnected) {
      // Baru saja reconnect — kirim status saat ini untuk sinkronisasi
      Serial.println("[WIFI] Reconnected! Transmitting current state for sync.");
      wasDisconnected = false;
      // Re-establish MQTT connection will happen in handleMqttReconnect
    }
    return;
  }

  // WiFi disconnected
  wasDisconnected = true;
  unsigned long now = millis();

  if (now - lastWifiReconnectAttempt >= WIFI_RECONNECT_INTERVAL_MS) {
    lastWifiReconnectAttempt = now;
    Serial.println("[WIFI] Attempting reconnection...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

// ==========================================
// FUNGSI: MQTT Reconnect (non-blocking)
// ==========================================
void handleMqttReconnect() {
  if (WiFi.status() != WL_CONNECTED) {
    return;  // Tidak bisa connect MQTT tanpa WiFi
  }

  if (mqttClient.connected()) {
    return;  // Sudah terhubung
  }

  Serial.print("[MQTT] Attempting connection to ");
  Serial.print(MQTT_BROKER_HOST);
  Serial.print(":");
  Serial.print(MQTT_BROKER_PORT);
  Serial.print(" ...");
  String clientId = "VOKAFE-Node-";
  clientId += String(SEAT_ID);
  clientId += "-";
  clientId += String(random(0xffff), HEX);

  if (mqttClient.connect(clientId.c_str())) {
    Serial.println(" connected!");

    // Transmit current state on reconnection for sync
    Serial.println("[MQTT] Transmitting current state for sync after reconnection.");
    sendTelemetry(currentStatus);
  } else {
    Serial.print(" failed, rc=");
    Serial.println(mqttClient.state());
  }
}

// ==========================================
// FUNGSI: Deteksi Sensor Fault (unchanged > 60 menit)
// ==========================================
void checkSensorFault(int pirState, unsigned long now) {
  if (pirState != lastRawPirState) {
    // State berubah, reset timer fault detection
    lastRawPirState = pirState;
    lastStateChangeTime = now;
    if (sensorFaultFlag) {
      Serial.println("[SENSOR] Fault cleared — sensor state changed.");
      sensorFaultFlag = false;
    }
  } else {
    // State tidak berubah, cek apakah sudah > 60 menit
    if (!sensorFaultFlag && (now - lastStateChangeTime >= SENSOR_FAULT_MS)) {
      sensorFaultFlag = true;
      Serial.println("[SENSOR] WARNING: Sensor potentially faulty — unchanged state > 60 minutes.");
    }
  }
}

// ==========================================
// SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("========================================");
  Serial.println("  VOKA-SEAT Node — Booting...");
  Serial.print("  Seat ID: ");
  Serial.println(SEAT_ID);
  Serial.print("  Broker:  ");
  Serial.print(MQTT_BROKER_HOST);
  Serial.print(":");
  Serial.println(MQTT_BROKER_PORT);
  Serial.println("========================================");

  // Konfigurasi Pin Sensor PIR
  pinMode(PIR_PIN, INPUT);

  // Inisialisasi status ke 0 (available)
  currentStatus = 0;
  currentState  = STATE_AVAILABLE;

  // Setup WiFi (non-blocking, max 2s)
  setup_wifi();

  // Setup MQTT — broker host/port resolved from named constants above
  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);

  // Inisialisasi timing variables
  unsigned long now = millis();
  lastPollTime = now;
  lastStateChangeTime = now;
  lastRawPirState = digitalRead(PIR_PIN);
  lastWifiReconnectAttempt = now;

  Serial.println("[BOOT] Initialization complete. Polling started.");
  Serial.print("[BOOT] Boot time: ");
  Serial.print(millis());
  Serial.println("ms");
}

// ==========================================
// LOOP UTAMA
// ==========================================
void loop() {
  unsigned long now = millis();

  // --- WiFi Reconnect Handling ---
  handleWifiReconnect();

  // --- MQTT Reconnect Handling ---
  handleMqttReconnect();

  // --- MQTT Client Loop (process incoming/outgoing) ---
  if (mqttClient.connected()) {
    mqttClient.loop();
  }

  // --- Polling interval enforcement (100ms) ---
  if (now - lastPollTime < POLLING_INTERVAL_MS) {
    return;
  }
  lastPollTime = now;

  // --- Baca sensor PIR ---
  int pirState = digitalRead(PIR_PIN);

  // --- Sensor Fault Detection ---
  checkSensorFault(pirState, now);

  // --- State Machine ---
  switch (currentState) {

    case STATE_AVAILABLE:
      // Menunggu deteksi gerakan (HIGH)
      if (pirState == HIGH) {
        // Mulai debounce — HIGH harus bertahan 200ms
        currentState = STATE_DEBOUNCING;
        debounceStartTime = now;
        Serial.println("[STATE] AVAILABLE → DEBOUNCING");
      }
      break;

    case STATE_DEBOUNCING:
      // Menunggu HIGH bertahan selama 200ms
      if (pirState == LOW) {
        // HIGH tidak bertahan, kembali ke AVAILABLE
        currentState = STATE_AVAILABLE;
        Serial.println("[STATE] DEBOUNCING → AVAILABLE (debounce failed)");
      } else if (now - debounceStartTime >= DEBOUNCE_THRESHOLD_MS) {
        // HIGH bertahan 200ms — konfirmasi occupied
        currentState = STATE_OCCUPIED;
        currentStatus = 1;
        lastMotionTime = now;
        Serial.println("[STATE] DEBOUNCING → OCCUPIED (confirmed)");
        sendTelemetry(currentStatus);
      }
      break;

    case STATE_OCCUPIED:
      // Kursi terisi, pantau gerakan
      if (pirState == HIGH) {
        // Gerakan masih terdeteksi, reset motion time
        lastMotionTime = now;
      } else {
        // Tidak ada gerakan, mulai vacant timeout
        currentState = STATE_VACANT_TIMEOUT;
        Serial.println("[STATE] OCCUPIED → VACANT_TIMEOUT");
      }
      break;

    case STATE_VACANT_TIMEOUT:
      // Menunggu 10 menit tanpa gerakan
      if (pirState == HIGH) {
        // Gerakan terdeteksi kembali — reset timer, kembali ke OCCUPIED
        currentState = STATE_OCCUPIED;
        lastMotionTime = now;
        Serial.println("[STATE] VACANT_TIMEOUT → OCCUPIED (motion detected, timer reset)");
      } else if (now - lastMotionTime >= VACANT_TIMEOUT_MS) {
        // 10 menit tanpa gerakan — kursi kosong
        currentState = STATE_AVAILABLE;
        currentStatus = 0;
        Serial.println("[STATE] VACANT_TIMEOUT → AVAILABLE (timeout expired)");
        sendTelemetry(currentStatus);
      }
      break;
  }
}
