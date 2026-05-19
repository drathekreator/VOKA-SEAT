/**
 * ============================================================================
 * VOKA-SEAT Node — ESP32 + PIR HC-SR501 (Presence Detection at Cafe Table)
 * ============================================================================
 *
 * HARDWARE SETUP (FIXED — JANGAN DIUBAH PER NODE):
 *   - PIR HC-SR501 OUT  → ESP32 GPIO 27 (digital INPUT)
 *   - PIR VCC           → ESP32 5V (atau 3V3 — module HC-SR501 tolerate keduanya)
 *   - PIR GND           → ESP32 GND
 *   - Trimpot Time Delay PIR  : putar penuh ke MINIMUM (~3 detik)
 *   - Jumper Mode             : posisi H (Repeat Trigger)
 *
 *   Catatan: kalibrasi delay/repeat dilakukan di SOFTWARE (lihat di bawah).
 *   Hardware Time-Delay sengaja di-minimum-kan agar firmware yang menentukan
 *   threshold debouncing.
 *
 * SOFTWARE CALIBRATION (FILTER DEBOUNCING):
 *   1. Threshold Trigger ON  : 2 detik
 *      Sinyal HIGH harus stabil 2 detik berturut-turut sebelum status
 *      berubah ke "Terisi". Kalau dalam 2 detik sinyal sempat LOW, timer
 *      di-reset (dianggap noise/fluktuasi).
 *
 *   2. Threshold Trigger OFF : 5 menit (Grace Period)
 *      Saat status "Terisi" dan PIR membaca LOW, jangan langsung ubah ke
 *      "Kosong". Mulai grace timer 300.000 ms. Kalau dalam masa itu ada
 *      HIGH → reset timer (pertahankan "Terisi"). Kalau timer expire tanpa
 *      gerakan → ubah ke "Kosong".
 *
 *   Logika full non-blocking pakai millis() absolut. TIDAK ada delay() di
 *   manapun di runtime loop.
 *
 * INTEGRASI BACKEND (VOKA-SEAT cloud, sudah live):
 *   Broker MQTT publik : vokafe.duckdns.org:1884 (TCP, allow_anonymous true)
 *   Topic              : vokafe/iot/telemetry
 *   Payload format     : {"id_kursi": <1..24>, "status": <0|1>}
 *
 * LIBRARY DEPENDENCIES (Arduino IDE → Library Manager):
 *   - WiFi.h           (built-in ESP32 core)
 *   - PubSubClient     by Nick O'Leary
 *   - ArduinoJson      by Benoit Blanchon (v6 atau v7)
 *
 * BOARD CONFIG (Arduino IDE → Tools):
 *   Board     : ESP32 Dev Module
 *   Upload    : 921600 baud
 * ============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ============================================================================
// KONFIGURASI — UBAH SEBELUM UPLOAD KE TIAP NODE
// ============================================================================

// --- Identitas Node (per kursi, ganti per upload) ---
const int   SEAT_ID         = 5;              // ID kursi (1-24)
const char* MQTT_CLIENT_ID  = "voka-seat-05"; // Unik per node

// --- WiFi ---
const char* WIFI_SSID     = "ganti-dengan-ssid";
const char* WIFI_PASSWORD = "ganti-dengan-password";

// --- MQTT Broker (production VOKA-SEAT) ---
const char* MQTT_BROKER_HOST = "vokafe.duckdns.org";
const int   MQTT_BROKER_PORT = 1884;
const char* MQTT_TOPIC       = "vokafe/iot/telemetry";

// MVP: broker allow_anonymous=true. Kosongkan dua baris ini.
// Kalau broker di-harden (mosquitto_passwd), isi sesuai kredensial.
const char* MQTT_USERNAME = "";
const char* MQTT_PASSWORD = "";

// --- Pin Hardware ---
constexpr int PIR_PIN = 27;

// --- Timing Threshold (filter debouncing software) ---
constexpr unsigned long TRIGGER_ON_MS   = 2UL * 1000UL;       // 2 detik (stable HIGH)
constexpr unsigned long TRIGGER_OFF_MS  = 5UL * 60UL * 1000UL; // 300.000 ms = 5 menit (grace period)
constexpr unsigned long POLL_INTERVAL_MS = 50;                 // Polling tiap 50ms (cukup responsif)

// --- Reconnect / retry timings ---
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 5UL * 1000UL;
constexpr unsigned long MQTT_RETRY_INTERVAL_MS = 2UL * 1000UL;
constexpr int           MQTT_PUBLISH_RETRIES   = 3;

// ============================================================================
// STATE — JANGAN diubah manual
// ============================================================================
WiFiClient   espClient;
PubSubClient mqttClient(espClient);

// Output state — variabel global yang merepresentasikan status akhir meja.
// false = Kosong (Vacant), true = Terisi (Occupied).
bool isOccupied = false;

// Trigger ON debounce: timestamp pertama kali PIR membaca HIGH dalam
// kondisi VACANT. Jika tetap HIGH selama TRIGGER_ON_MS, naik ke OCCUPIED.
// Nilai 0 = belum ada timer berjalan.
unsigned long highSinceMs = 0;

// Trigger OFF grace period: timestamp pertama kali PIR membaca LOW dalam
// kondisi OCCUPIED. Jika seterusnya LOW selama TRIGGER_OFF_MS, turun ke
// VACANT. Setiap kali muncul HIGH dalam grace window, timer ini di-RESET
// kembali ke 0.
unsigned long lowSinceMs = 0;

// Polling guard
unsigned long lastPollMs = 0;

// Reconnect guards
unsigned long lastWifiAttemptMs = 0;
unsigned long lastMqttAttemptMs = 0;

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);

  // Tunggu Serial up tanpa pakai delay() — pakai millis polling.
  unsigned long t0 = millis();
  while (!Serial && (millis() - t0) < 1000UL) {
    yield();
  }

  Serial.println("\n========================================");
  Serial.println("  VOKA-SEAT Node");
  Serial.printf ("  Seat ID    : %d\n", SEAT_ID);
  Serial.printf ("  Client ID  : %s\n", MQTT_CLIENT_ID);
  Serial.printf ("  Broker     : %s:%d\n", MQTT_BROKER_HOST, MQTT_BROKER_PORT);
  Serial.printf ("  Topic      : %s\n", MQTT_TOPIC);
  Serial.printf ("  Trigger ON : %lu ms (stable HIGH)\n", TRIGGER_ON_MS);
  Serial.printf ("  Trigger OFF: %lu ms (grace period)\n", TRIGGER_OFF_MS);
  Serial.println("========================================\n");

  pinMode(PIR_PIN, INPUT);

  // Initial state: VACANT
  isOccupied = false;
  highSinceMs = 0;
  lowSinceMs  = 0;

  // PubSubClient setup (config saja — koneksi aktual di-handle loop ensureConnected())
  mqttClient.setBufferSize(256);
  mqttClient.setKeepAlive(60);
  mqttClient.setServer(MQTT_BROKER_HOST, MQTT_BROKER_PORT);

  // Coba konek WiFi + MQTT awal (non-blocking, akan retry di loop kalau gagal)
  ensureWifiConnected();
  ensureMqttConnected();

  // Publish state awal supaya backend tahu node ini live (status=0)
  if (mqttClient.connected()) {
    onStateChange();
  }

  Serial.println("Setup complete. Loop started.\n");
}

// ============================================================================
// LOOP — non-blocking, semua timing pakai millis()
// ============================================================================
void loop() {
  // Pelihara WiFi & MQTT keepalive. Kedua fungsi non-blocking — hanya
  // attempt reconnect kalau interval retry sudah lewat.
  ensureWifiConnected();
  ensureMqttConnected();
  mqttClient.loop();

  unsigned long now = millis();

  // Polling guard: hanya proses tiap POLL_INTERVAL_MS untuk hemat CPU
  if (now - lastPollMs < POLL_INTERVAL_MS) return;
  lastPollMs = now;

  int pirReading = digitalRead(PIR_PIN);

  if (!isOccupied) {
    // ------------------------------------------------------------------
    // Mode 1: VACANT → tunggu HIGH stabil selama TRIGGER_ON_MS (2 detik)
    // ------------------------------------------------------------------
    if (pirReading == HIGH) {
      if (highSinceMs == 0) {
        // Pertama kali HIGH dalam fase ini — mulai timer trigger-on.
        highSinceMs = now;
      } else if (now - highSinceMs >= TRIGGER_ON_MS) {
        // HIGH sudah stabil selama TRIGGER_ON_MS → naik ke OCCUPIED.
        // Reset kedua timer agar fase OFF mulai dari nol.
        isOccupied  = true;
        highSinceMs = 0;
        lowSinceMs  = 0;
        onStateChange();   // panggil callback sekali untuk transisi valid
      }
    } else {
      // Sinyal LOW di fase VACANT → reset timer trigger-on (anti-noise).
      // Sinyal HIGH yang tidak stabil 2 detik penuh dianggap fluktuasi.
      highSinceMs = 0;
    }

  } else {
    // ------------------------------------------------------------------
    // Mode 2: OCCUPIED → grace period TRIGGER_OFF_MS (5 menit) tanpa gerakan
    // ------------------------------------------------------------------
    if (pirReading == HIGH) {
      // Ada gerakan dalam masa OCCUPIED — reset timer grace period.
      // Pengguna masih duduk dan baru saja bergerak, jadi pertahankan
      // status "Terisi" tanpa batas selama gerakan terus muncul.
      lowSinceMs = 0;
    } else {
      if (lowSinceMs == 0) {
        // Pertama kali LOW di fase OCCUPIED — mulai grace timer.
        lowSinceMs = now;
      } else if (now - lowSinceMs >= TRIGGER_OFF_MS) {
        // 5 menit penuh tanpa HIGH sekalipun → turun ke VACANT.
        isOccupied  = false;
        highSinceMs = 0;
        lowSinceMs  = 0;
        onStateChange();   // panggil callback sekali untuk transisi valid
      }
    }
  }
}

// ============================================================================
// onStateChange() — DIPANGGIL TEPAT SATU KALI per transisi VALID
//
// Tugas: serialize state ke JSON dan publish ke broker MQTT VOKA-SEAT.
// Backend di vokafe.duckdns.org akan menerima, update Postgres, lalu
// broadcast WebSocket ke semua browser client yang connected.
// ============================================================================
void onStateChange() {
  const int statusInt = isOccupied ? 1 : 0;

  Serial.printf("[State] Seat %d -> %s (status=%d)\n",
                SEAT_ID, isOccupied ? "OCCUPIED" : "VACANT", statusInt);

  // Build JSON payload sesuai kontrak backend:
  //   {"id_kursi": <1..24>, "status": <0|1>}
  StaticJsonDocument<64> doc;
  doc["id_kursi"] = SEAT_ID;
  doc["status"]   = statusInt;

  char payload[80];
  size_t len = serializeJson(doc, payload, sizeof(payload));
  if (len == 0) {
    Serial.println("[State] ERROR: JSON serialize failed");
    return;
  }

  // TODO: Insert MQTT/ThingsBoard publish payload here
  // Default implementation di bawah men-publish ke broker VOKA-SEAT.
  // Kalau mau swap ke ThingsBoard / HiveMQ / broker lain, ganti
  // body fungsi publishTelemetry() (atau bypass dengan implementasi
  // langsung di sini).
  publishTelemetry(payload);
}

// ============================================================================
// publishTelemetry() — MQTT publish dengan retry up to MQTT_PUBLISH_RETRIES
// ============================================================================
void publishTelemetry(const char* payload) {
  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Not connected — payload dropped (will resync on reconnect)");
    return;
  }

  for (int attempt = 1; attempt <= MQTT_PUBLISH_RETRIES; attempt++) {
    if (mqttClient.publish(MQTT_TOPIC, payload, false)) {
      Serial.printf("[MQTT] Published (try %d): %s\n", attempt, payload);
      return;
    }
    Serial.printf("[MQTT] Publish failed (try %d/%d), retry...\n",
                  attempt, MQTT_PUBLISH_RETRIES);
    // Tidak ada delay antara retry — biarkan loop() yang lain berjalan.
    // PubSubClient akan re-evaluate connection state di iterasi berikutnya.
    mqttClient.loop();
    yield();
  }

  Serial.println("[MQTT] All retries exhausted; will sync on next state change.");
}

// ============================================================================
// ensureWifiConnected() — non-blocking, retry tiap WIFI_RETRY_INTERVAL_MS
// ============================================================================
void ensureWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (lastWifiAttemptMs != 0 && (now - lastWifiAttemptMs) < WIFI_RETRY_INTERVAL_MS) {
    return;  // belum waktunya retry
  }
  lastWifiAttemptMs = now;

  Serial.printf("[WiFi] Connecting to '%s'... ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  // WiFi.begin() returns immediately — status akan berubah secara async.
  // Kita check status di iterasi loop berikutnya, tidak block di sini.
  Serial.println("(async, will check next loop iteration)");
}

// ============================================================================
// ensureMqttConnected() — non-blocking, retry tiap MQTT_RETRY_INTERVAL_MS
// ============================================================================
void ensureMqttConnected() {
  if (mqttClient.connected()) return;
  if (WiFi.status() != WL_CONNECTED) return;  // wait for WiFi first

  unsigned long now = millis();
  if (lastMqttAttemptMs != 0 && (now - lastMqttAttemptMs) < MQTT_RETRY_INTERVAL_MS) {
    return;
  }
  lastMqttAttemptMs = now;

  Serial.printf("[MQTT] Connecting to %s:%d as '%s'... ",
                MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_CLIENT_ID);

  bool ok;
  if (strlen(MQTT_USERNAME) > 0) {
    ok = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD);
  } else {
    ok = mqttClient.connect(MQTT_CLIENT_ID);
  }

  if (ok) {
    Serial.println("OK");
    // Saat re-connect setelah putus, sync state ke backend supaya UI
    // tidak ketinggalan kalau ada perubahan saat node offline.
    onStateChange();
  } else {
    Serial.printf("FAIL (rc=%d)\n", mqttClient.state());
    // PubSubClient state codes:
    //   -4 connection timeout, -3 connection lost, -2 connect failed,
    //   -1 disconnected, 0 ok, 1 bad protocol, 2 bad client id,
    //    3 unavailable, 4 bad credentials, 5 unauthorized
  }
}
