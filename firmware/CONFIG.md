# VOKA-SEAT Firmware Configuration

This document describes the deployment-time configuration knobs for the
ESP32 sensor node firmware in `firmware/voka_seat_node.ino`. Anyone editing
the firmware should read this page first — the same red rules from
`AGENTS.md §3` are also pinned at the top of the `.ino` file as a banner
comment so they are visible in either place.

---

## MQTT broker endpoint

The firmware connects to a shared Mosquitto broker that runs alongside other
projects on the cloud host. To avoid colliding with an existing
`1883:1883` host binding on that machine, VOKA-SEAT publishes the broker
container as **`1884:1883`** in `deploy/docker-compose.yml` (see task 20.1).
The container-internal port stays `1883` so backend → broker traffic on the
docker bridge keeps working unchanged.

The firmware therefore connects to the host-published port:

| Constant | Value | Notes |
| --- | --- | --- |
| `MQTT_BROKER_HOST` | `voka-seat.example.com` | Change to the real host/IP |
| `MQTT_BROKER_PORT` | `1884` | Host-published port (maps to container `1883`) |
| `MQTT_TELEMETRY_TOPIC` | `vokafe/iot/telemetry` | Topic the backend subscribes to |
| `MQTT_QOS` | `1` | At-least-once delivery |

To change the broker host:

1. Edit `MQTT_BROKER_HOST` in `firmware/voka_seat_node.ino`.
2. (Optional) Edit `MQTT_BROKER_PORT` if the deployment changes the host-side
   port mapping in `deploy/docker-compose.yml`.
3. Reflash the ESP32 — see the **Reflash checklist** below.

---

## Hardware constraints (AGENTS.md §3 red rules)

These are **absolute** project rules. They are also pinned as a banner
comment at the top of `voka_seat_node.ino`:

- **PIR sensor:** HC-SR501 ONLY. No ultrasonic, no rangefinders, no other
  distance sensors anywhere in the firmware or docs.
- **Mounting:** under-table, downward tilt **30°–45°** toward the chair,
  using double-sided industrial adhesive (no drilling).
- **Vacant timeout:** **600,000 ms (10 minutes)** of continuous LOW before
  flipping `status` from `1` to `0`. Any HIGH during the countdown resets
  the timer.
- **Debounce threshold:** **200 ms** continuous HIGH required before
  confirming the occupied transition.
- **GPIO 27** is configured as a digital `INPUT` and polled at an interval
  not exceeding **100 ms** (see `POLLING_INTERVAL_MS`).
- **Sensor fault flag:** if `PIR_OUT` stays in a single state (HIGH or LOW)
  for more than **3,600,000 ms (60 minutes)**, raise `sensorFaultFlag` and
  keep reporting the last confirmed seat status.

Network constraints are equally non-negotiable:

- WiFi: hidden SSID **`VOKAFE-IoT`** on **VLAN 20**.
- MQTT: QoS 1, topic `vokafe/iot/telemetry`.

---

## Optional MikroTik DNAT

If — and only if — `deploy/docker-compose.yml` is reconfigured to keep the
broker fully internal to the docker bridge (no `ports:` mapping on the
`mosquitto` service), then the MikroTik gateway in front of the cloud host
must DNAT the public-facing port to the docker host so ESP32 nodes can still
reach `MQTT_BROKER_HOST:1884`.

Per `AGENTS.md §3` blue rules this MUST be configured via MikroTik RouterOS
CLI only. No Winbox.

```routeros
/ip firewall nat add chain=dstnat dst-port=1884 protocol=tcp \
  action=dst-nat to-addresses=<docker-host-ip> to-ports=1883 \
  comment="VOKA-SEAT MQTT bridge"

/ip firewall nat print where comment~"VOKA-SEAT"
```

When the broker is published on the host directly (`1884:1883` in the
compose file, the default for VOKA-SEAT) this DNAT step is **not needed** —
the docker host already exposes `1884` to the LAN and the firmware reaches
it without any router rewrites.

---

## Reflash checklist

1. Update `MQTT_BROKER_HOST` (and `MQTT_BROKER_PORT` if it changed) to the
   production hostname/IP in `firmware/voka_seat_node.ino`.
2. Verify `WIFI_SSID` is still `"VOKAFE-IoT"` (hidden) on VLAN 20 and
   `WIFI_PASSWORD` matches the production WPA2 key.
3. Build and upload via Arduino IDE, or via `arduino-cli`:

   ```bash
   arduino-cli compile --fqbn esp32:esp32:esp32 firmware
   arduino-cli upload  --fqbn esp32:esp32:esp32 -p <COMx-or-ttyUSBx> firmware
   ```

4. Watch the serial console at **115200 baud** to confirm the boot banner,
   the WiFi association to `VOKAFE-IoT`, the MQTT connect line to
   `MQTT_BROKER_HOST:MQTT_BROKER_PORT`, and the first `[TELEMETRY]` publish
   to `vokafe/iot/telemetry`.
