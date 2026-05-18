# Requirements Document

## Introduction

VOKA-SEAT is a comprehensive IoT-based real-time seat occupancy monitoring system for VOKAFE, a coffeeshop located in the center of a vocational school campus. The system integrates distributed PIR (Passive Infrared) sensors mounted on ESP32 microcontrollers with a cloud-hosted backend and two web-based frontends: an Admin Dashboard for back-office operations and a Mobile Web App for customer-facing ordering and seat availability viewing. The system tracks 24 individual seats across 3 zones, broadcasting occupancy changes in real-time via WebSockets with zero page reloads.

## Glossary

- **VOKA-SEAT_System**: The complete integrated IoT seat monitoring and coffeeshop management platform comprising firmware, backend, and frontend subsystems.
- **Sensor_Node**: An ESP32 microcontroller unit paired with a single PIR sensor, responsible for detecting human thermal presence at one specific seat.
- **PIR_Sensor**: A Passive Infrared sensor (HC-SR501 type) that detects thermal radiation emitted by human body movement within its field of view.
- **Backend_Server**: The Node.js + Express.js application deployed on AWS EC2 behind Nginx reverse proxy, responsible for receiving telemetry, persisting state, and broadcasting updates.
- **Admin_Dashboard**: The desktop web application used by VOKAFE staff for real-time seat monitoring, order management, inventory tracking, and analytics.
- **Customer_App**: The mobile-optimized web application used by students/customers for viewing seat availability, browsing the menu, placing orders, and managing their account.
- **Telemetry_Payload**: The JSON data packet sent by a Sensor_Node containing seat identifier and occupancy status: `{"id_kursi": <number>, "status": <0|1>}`.
- **Vacant_Timeout**: A 10-minute countdown timer implemented in firmware that must elapse without any motion detection before a seat status transitions from occupied (1) to available (0).
- **WebSocket_Broadcaster**: The Socket.IO server component that pushes real-time seat status changes to all connected browser clients.
- **Prisma_ORM**: The Object-Relational Mapping layer used to interact with the PostgreSQL database.
- **Customer_Email**: Customer email address used as the unique identifier for customer accounts. Replaces the prior NIM identifier.
- **Admin_Account**: A single privileged user account seeded from environment variables (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) that grants access to all admin-only API routes and the Admin_Dashboard. Managed outside the customer User table.
- **Guest_Order**: An order placed by an unauthenticated customer. Stored without a user reference. Cannot be retrieved later via Order History because there is no account linked to it. The Payment_Success_Screen still displays the order number and a session-scoped Order Detail view immediately after checkout.
- **Zone**: A logical grouping of seats in the VOKAFE floor plan. Three zones exist: Left (Barista Counter, Seats 1-4), Top (Tribune/Tiered, Seats 11-24), and Center/Right (Concrete Tables, Seats 5-10).
- **VLAN_20**: The isolated virtual LAN segment carrying IoT telemetry traffic over the hidden SSID "VOKAFE-IoT".
- **NAT_Masquerade**: Network Address Translation rule on MikroTik router that forwards IoT subnet traffic to the public internet where the cloud server resides.
- **VOKAFE_Brand_Logo**: The official brand logo consisting of a stylized infinity/coffee-cup icon in solid Magenta (#D81B60) followed by the "VOKAFE" wordmark rendered in a Magenta-to-Purple gradient. This logo must appear on all user-facing interfaces as the primary brand identifier.
- **Admin_Flat_Palette**: The Admin_Dashboard color palette consisting of flat utility tokens: backgrounds #FFFFFF and #F3F4F6, text #1E293B (primary) and #475569 (secondary), occupied seat #D81B60 with white text, available seat #F3F4F6 with #E5E7EB border. This palette is the only palette used by the Admin_Dashboard.
- **Customer_MD3_Tokens**: The Customer_App Material Design 3 token-based color system, distinct from the Admin_Flat_Palette. Token values: primary #b80035, primary-container #e11d48, on-primary #ffffff, secondary-container #6cf8bb, on-secondary-container #00714d, surface #fbf8fc, surface-bright #fbf8fc, surface-container-lowest #ffffff, surface-container #f0edf1, surface-container-low #f6f2f7, surface-container-high #eae7eb, surface-container-highest #e4e1e6, surface-variant #e4e1e6, on-surface #1b1b1e, on-surface-variant #5c3f40, outline-variant #e5bdbe, error #ba1a1a, error-container #ffdad6, on-error-container #93000a, primary-fixed #ffdada, surface-tint #be0037.
- **Customer_Typography**: The Customer_App typography system using Lexend for headlines (font-headline-md at 24px/600, font-headline-sm at 20px/500, font-headline-lg-mobile at 28px/600, font-display-lg at 32px/600) and Inter for body and labels (font-body-md at 16px/400, font-body-sm at 14px/400, font-label-md at 14px/600, font-label-sm at 12px/500).
- **Customer_Border_Radius**: The Customer_App border-radius scale: DEFAULT 0.25rem, lg 0.5rem, xl 0.75rem, full 9999px.
- **Customer_Spacing_Scale**: The Customer_App spacing scale: xs 4px, sm 8px, md 16px, lg 24px, xl 32px, margin-mobile 16px, margin-tablet 24px.
- **Material_Symbols_Outlined**: The Google Material Symbols Outlined icon font used by the Customer_App for all icons (e.g., home, grid_view, shopping_cart, person, search, qr_code_scanner, mail, lock, add, arrow_forward, lock_reset, receipt_long, check_circle, expand_more, arrow_back).
- **Customer_Top_App_Bar**: A 64px-tall sticky top app bar on the Customer_App displaying the VOKAFE brand logo on the left and a Material_Symbols_Outlined search icon on the right, with surface (#fbf8fc) background and a subtle shadow.
- **Cart_Summary_Bar**: A sticky bar shown above the bottom navigation on the Menu tab of the Customer_App when the cart contains at least one item, displaying the item count, total price (IDR formatted), and a "View Cart" button.
- **Payment_Success_Screen**: A dedicated confirmation screen presented after a successful payment that shows the order number, ordered items summary, total paid, and primary actions to view the order status or return to the Menu tab.
- **Order_Status_Pill**: A pill-shaped status indicator displayed on order history list items, color-coded by status: pending = amber, preparing = primary (#b80035), ready = tertiary/green, completed = secondary-container (#6cf8bb on #00714d), cancelled = error/red.

## Floor Plan Reference

This section documents the authoritative spatial layout of the VOKAFE seating area as derived from the official floor plan image. Both the Admin Dashboard Tablespace view and the Customer App Tables tab MUST render seats in the exact spatial arrangement described below.

### Zone Layout Overview

The floor plan is divided into 3 distinct zones arranged spatially as follows:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ZONA ATAS — Kursi Tangga                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │
│  │ Row 4: 24 23 22 21│ │ Row 4: 24 23 22 21│ │ Row 4: 24 23 22 21│  │
│  │ Row 3: 18 19 20 20│ │ Row 3: 18 19 20 20│ │ Row 3: 18 19 20 20│  │
│  │ Row 2: 17 16 15 14│ │ Row 2: 17 16 15 14│ │ Row 2: 17 16 15 14│  │
│  │ Row 1: 11 12 12 13│ │ Row 1: 11 12 12 13│ │ Row 1: 11 12 12 13│  │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘       │
├────────┬────────────────────────────────────────────────────────────┤
│ ZONA   │              ZONA TENGAH & KANAN — Meja Beton              │
│ KIRI   │                                                            │
│        │   ┌──S──S──┐   ┌──S──S──┐   ┌──S──S──┐                   │
│BARISTA │   │ Meja 5 │   │ Meja 7 │   │ Meja 8 │                   │
│ DAN    │   └──S──S──┘   └──S──S──┘   └──S──S──┘                   │
│KASIR   │                                                            │
│        │   ┌──S──S──┐   ┌──S──S──┐   ┌──S──S──┐                   │
│┌─┐     │   │ Meja 6 │   │ Meja 9 │   │ Meja 10│                   │
││S│ 1   │   └──S──S──┘   └──S──S──┘   └──S──S──┘                   │
│├─┤     │                                                            │
││S│ 2   │                                                            │
│├─┤     │                                                            │
││S│ 3   │                                                            │
│├─┤     │                                                            │
││S│ 4   │                                                            │
│└─┘     │                                                            │
└────────┴────────────────────────────────────────────────────────────┘
```

### Zona Kiri — Barista dan Kasir (Left Zone)

- **Position:** Far-left vertical strip of the floor plan
- **Label:** "BARISTA DAN KASIR"
- **Layout:** 4 small square tables arranged vertically (top to bottom)
- **Tables:** Numbered 1, 2, 3, 4 from top to bottom
- **Sensors per table:** 1 sensor seat (S) positioned on the left side of each table
- **Total seats:** 4 (Seat IDs: 1, 2, 3, 4)
- **Seat rendering:** Each seat is a single square indicator box labeled with its seat number

### Zona Atas — Kursi Tangga (Top Zone — Tribune/Tiered Seating)

- **Position:** Top section of the floor plan, spanning the full width above the center zone
- **Label:** "Kursi Tangga"
- **Layout:** 4 rows of tiered seating arranged in 3 repeated column groups (left, center, right)
- **Row structure (per column group, bottom to top):**
  - Row 1 (front/bottom): Seats 11, 12, 12, 13
  - Row 2: Seats 17, 16, 15, 14
  - Row 3: Seats 18, 19, 20, 20
  - Row 4 (back/top): Seats 24, 23, 22, 21
- **Repetition:** The same seat ID pattern is repeated across 3 side-by-side column groups representing the physical tribune sections
- **Total unique seat IDs:** 14 (Seat IDs: 11–24)
- **Seat rendering:** Each seat position is a small square indicator; the 3 column groups are rendered side by side with uniform spacing

### Zona Tengah & Kanan — Meja Beton (Center/Right Zone — Concrete Tables)

- **Position:** Center and right area of the floor plan, below the tribune zone
- **Label:** "Meja Beton"
- **Layout:** 6 large rectangular concrete tables arranged in a 2-row × 3-column grid
- **Table arrangement:**
  - Left column: Meja 5 (top), Meja 6 (bottom)
  - Center column: Meja 7 (top), Meja 9 (bottom)
  - Right column: Meja 8 (top), Meja 10 (bottom)
- **Sensors per table:** 4 sensor positions — 2 on the top (long) side and 2 on the bottom (long) side
- **Seat group identifier:** Each table's sensor positions are grouped under the table number (e.g., Meja 5 has 4 sensor positions all reporting as seat group 5)
- **Total tables:** 6 (Meja 5–10)
- **Table rendering:** Each table is rendered as a brown/gold colored rectangle with "S" indicator boxes on the top and bottom edges

### Visual Representation Rules

| Element | Occupied (status = 1) | Available (status = 0) |
|---------|----------------------|----------------------|
| Seat indicator box | Solid Magenta/Pink (#D81B60) background, white text | Light gray/white (#F3F4F6) background, 1px solid border (#E5E7EB) |
| Table surface (Meja Beton) | Brown/gold rectangle (non-interactive, visual only) | Brown/gold rectangle (non-interactive, visual only) |
| Zone label | Static text label, not interactive | Static text label, not interactive |

### Spatial Constraints for UI Rendering

1. The Zona Atas (tribune) MUST be rendered at the top of the viewport/container, spanning the full width
2. The Zona Kiri (barista) MUST be rendered as a narrow vertical strip on the far left, below the tribune
3. The Zona Tengah & Kanan (concrete tables) MUST be rendered to the right of the barista zone, below the tribune
4. The 3 column groups in the tribune zone MUST be rendered side by side with equal spacing
5. Seat indicators within the tribune MUST maintain their row-and-column grid positions as specified above
6. Concrete table sensor positions (S) MUST be rendered on the top and bottom edges of each table rectangle
7. The overall layout MUST preserve the relative spatial relationships between zones as shown in the floor plan image

---

## Requirements

### Requirement 1: PIR Sensor Occupancy Detection

**User Story:** As a VOKAFE operator, I want each seat to be monitored by a dedicated PIR sensor so that occupancy is detected automatically without manual intervention.

#### Acceptance Criteria

1. THE Sensor_Node SHALL detect human thermal radiation using exclusively a PIR_Sensor mounted under the table at a 30-45 degree downward angle facing the chair.
2. WHEN the PIR_Sensor output on GPIO pin 27 transitions from LOW to HIGH and remains HIGH for at least 200 milliseconds, THE Sensor_Node SHALL set the local seat status to occupied (1).
3. WHEN the PIR_Sensor stops detecting motion (GPIO pin 27 reads LOW continuously for at least 200 milliseconds), THE Sensor_Node SHALL start the Vacant_Timeout countdown of 600000 milliseconds (10 minutes).
4. WHEN the Vacant_Timeout expires without any motion interruption, THE Sensor_Node SHALL set the local seat status to available (0).
5. WHEN motion is detected during an active Vacant_Timeout countdown, THE Sensor_Node SHALL reset the Vacant_Timeout timer and maintain the occupied (1) status.
6. THE Sensor_Node SHALL read the PIR_Sensor output on GPIO pin 27 configured as a digital INPUT with a polling interval not exceeding 100 milliseconds.
7. WHEN the Sensor_Node completes its boot sequence, THE Sensor_Node SHALL initialize the local seat status to available (0) and begin polling the PIR_Sensor within 2000 milliseconds of power-on.
8. IF the PIR_Sensor output remains in a single unchanging state (HIGH or LOW) for more than 3600000 milliseconds (60 minutes), THEN THE Sensor_Node SHALL flag the sensor status as potentially faulty and continue reporting the last confirmed seat status.

### Requirement 2: Telemetry Transmission

**User Story:** As a system architect, I want each Sensor_Node to transmit occupancy changes to the cloud server so that the backend can maintain an accurate real-time state of all seats.

#### Acceptance Criteria

1. WHEN the seat status changes from available (0) to occupied (1), THE Sensor_Node SHALL transmit a Telemetry_Payload containing the seat identifier and status value 1 within 2 seconds of the state change detection.
2. WHEN the seat status changes from occupied (1) to available (0), THE Sensor_Node SHALL transmit a Telemetry_Payload containing the seat identifier and status value 0 within 2 seconds of the state change detection.
3. THE Sensor_Node SHALL format the Telemetry_Payload as a JSON object with fields "id_kursi" (integer, 1–24) and "status" (integer, 0 or 1), not exceeding 128 bytes in total size.
4. THE Sensor_Node SHALL connect to the hidden SSID "VOKAFE-IoT" on VLAN_20 for network access.
5. IF the network connection is lost, THEN THE Sensor_Node SHALL attempt reconnection at a 5-second retry interval and SHALL discard any telemetry events generated during the disconnection period.
6. THE Sensor_Node SHALL transmit the Telemetry_Payload to the configured MQTT broker topic "vokafe/iot/telemetry" using QoS level 1 (at-least-once delivery).
7. IF an MQTT publish attempt fails, THEN THE Sensor_Node SHALL retry the publish up to 3 times with a 2-second interval between attempts before discarding the payload.
8. WHEN the network connection is re-established after a disconnection, THE Sensor_Node SHALL transmit the current seat status as a Telemetry_Payload to synchronize state with the cloud server.

### Requirement 3: Network Isolation and Routing

**User Story:** As a network administrator, I want IoT telemetry traffic isolated on a dedicated VLAN so that sensor communication does not interfere with campus user traffic and remains secure.

#### Acceptance Criteria

1. THE VOKA-SEAT_System SHALL operate IoT telemetry on VLAN 20 with a hidden SSID "VOKAFE-IoT" separate from the campus network (VLAN 10), with no inter-VLAN routing permitted between VLAN 10 and VLAN 20 such that devices on one VLAN cannot reach devices on the other.
2. THE VOKA-SEAT_System SHALL apply NAT Masquerade rules to route traffic from the IoT subnet (VLAN 20) to the public internet where the Backend_Server resides, enabling outbound connectivity from IoT devices to the cloud endpoint.
3. THE VOKA-SEAT_System SHALL encrypt the VOKAFE-IoT wireless network with WPA2 or higher encryption.
4. THE VOKA-SEAT_System SHALL be configured exclusively via MikroTik RouterOS CLI commands, with no GUI-based configuration permitted.
5. IF the NAT Masquerade rule or upstream internet link is non-functional, THEN THE VOKA-SEAT_System SHALL retain the last-applied network configuration and resume forwarding IoT telemetry traffic to the Backend_Server within 30 seconds of connectivity restoration without requiring manual intervention.

### Requirement 4: Backend Telemetry Ingestion

**User Story:** As a backend developer, I want the server to receive and process telemetry payloads so that seat status is persisted and available for querying.

#### Acceptance Criteria

1. WHEN a valid Telemetry_Payload is received on the MQTT topic "vokafe/iot/telemetry", THE Backend_Server SHALL parse the JSON and extract the "id_kursi" and "status" fields, where a valid payload is defined as: well-formed JSON containing both "id_kursi" (integer 1–24) and "status" (integer 0 or 1) fields.
2. WHEN a valid Telemetry_Payload is received, THE Backend_Server SHALL upsert the seat record in PostgreSQL via Prisma_ORM with the new status value, where the updated timestamp is automatically set to the server's current time at the moment of upsert.
3. WHEN a seat record is successfully upserted, THE Backend_Server SHALL broadcast the updated seat object to all connected WebSocket clients within 2 seconds of payload receipt.
4. IF the Telemetry_Payload contains an "id_kursi" value outside the integer range 1–24, THEN THE Backend_Server SHALL discard the payload without persisting, log a validation error indicating the invalid seat identifier, and continue processing subsequent payloads.
5. IF the Telemetry_Payload contains a "status" value other than integer 0 or integer 1, THEN THE Backend_Server SHALL discard the payload without persisting, log a validation error indicating the invalid status value, and continue processing subsequent payloads.
6. IF the Telemetry_Payload is not well-formed JSON or is missing the "id_kursi" or "status" fields, THEN THE Backend_Server SHALL discard the payload, log a parse error, and continue processing subsequent payloads.
7. IF the database is unreachable during an upsert attempt, THEN THE Backend_Server SHALL log the error including the seat identifier that failed, discard the payload, and continue processing subsequent payloads without crashing.

### Requirement 5: Real-Time WebSocket Broadcasting

**User Story:** As a frontend developer, I want the backend to broadcast seat status changes via WebSocket so that all connected clients see updates instantly without page reloads.

#### Acceptance Criteria

1. WHEN a seat status is successfully created or updated in the database, THE WebSocket_Broadcaster SHALL emit a "seat_update" event to all connected Socket.IO clients within 500 milliseconds of the database write completing.
2. WHEN a "seat_update" event is emitted, THE WebSocket_Broadcaster SHALL include the seat identifier (integer, 1–24) and the new status value (0 for available, 1 for occupied) in the event payload.
3. WHEN a new client connects via Socket.IO, THE Backend_Server SHALL emit the current status of all 24 seats to that client as an array of objects each containing the seat identifier and status value.
4. IF the database is unreachable when a new client connects, THEN THE Backend_Server SHALL emit an error event to that client indicating that initial seat state could not be loaded.
5. WHILE in development mode, THE Backend_Server SHALL accept WebSocket connections from any origin. WHILE in production mode, THE Backend_Server SHALL accept WebSocket connections only from origins specified in the server environment configuration.
6. THE Backend_Server SHALL support at least 100 concurrent WebSocket connections without dropping existing connections.

### Requirement 6: Admin Dashboard — Real-Time Seat Map

**User Story:** As a VOKAFE cashier/admin, I want to see a live floor plan showing which seats are occupied or available so that I can manage seating efficiently.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a floor plan map in the Tablespace view conforming to the spatial layout defined in the "Floor Plan Reference" section, showing all 24 seats organized into 3 zones: Zona Kiri (Seats 1-4 as single-seat vertical strip), Zona Atas (Seats 11-24 as 4-row × 3-column-group tribune), and Zona Tengah & Kanan (Seats 5-10 as 6 concrete tables in a 2×3 grid).
2. WHEN a "seat_update" WebSocket event is received, THE Admin_Dashboard SHALL update the corresponding seat indicator within 100 milliseconds without a page reload.
3. THE Admin_Dashboard SHALL render occupied seats with a solid Magenta/Pink (#D81B60) background and white text, conforming to the Visual Representation Rules in the Floor Plan Reference.
4. THE Admin_Dashboard SHALL render available seats with a light gray/white (#F3F4F6) background and a 1px solid border (#E5E7EB), conforming to the Visual Representation Rules in the Floor Plan Reference.
5. THE Admin_Dashboard SHALL include a fixed 240px-wide left sidebar with navigation to Dashboard, Orders, Tablespace, Inventory, and Analytics sections.
6. WHEN the Admin_Dashboard Tablespace view is first loaded, THE Admin_Dashboard SHALL fetch the current occupancy status of all 24 seats from the backend API and render each seat indicator accordingly before any WebSocket event is received.
7. IF the WebSocket connection is lost, THEN THE Admin_Dashboard SHALL display a visible connection-status indicator informing the user that live updates are unavailable, and SHALL attempt to reconnect automatically at intervals of no more than 5 seconds.
8. THE Admin_Dashboard SHALL display the seat number (1-24) within each seat indicator so that the cashier can identify individual seats.
9. THE Admin_Dashboard SHALL render the Zona Atas tribune section at the top of the Tablespace view with 3 side-by-side column groups, each containing 4 rows of seat indicators arranged per the Floor Plan Reference row structure (Row 1: 11,12,12,13 / Row 2: 17,16,15,14 / Row 3: 18,19,20,20 / Row 4: 24,23,22,21).
10. THE Admin_Dashboard SHALL render each Meja Beton (tables 5-10) as a brown/gold colored rectangle with 4 sensor position indicators (2 on the top edge, 2 on the bottom edge) arranged in the 2-row × 3-column grid layout specified in the Floor Plan Reference.
11. THE Admin_Dashboard SHALL render the Zona Kiri section as a vertical strip on the far left showing the "BARISTA DAN KASIR" label and 4 single-seat indicators (Seats 1-4) arranged vertically from top to bottom, each with 1 sensor indicator on the left side of the table.

### Requirement 7: Admin Dashboard — Order Queue Management

**User Story:** As a VOKAFE cashier, I want to see incoming orders in a prioritized queue so that I can process them efficiently and assign tables to customers.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display pending orders as cards in a grid layout sorted by waiting time in descending order (longest-waiting orders first), displaying a maximum of 24 order cards per page.
2. THE Admin_Dashboard SHALL categorize order cards by urgency: "URGENT" (waiting longer than 7 minutes), "WAITING" (3–7 minutes), and "NEW" (less than 3 minutes).
3. WHEN an order card is in "URGENT" status, THE Admin_Dashboard SHALL display a red/out-of-stock color accent bar and a timer showing elapsed waiting time in MM:SS format, updated every 1 second.
4. WHEN an order card is in "WAITING" status, THE Admin_Dashboard SHALL display an amber/low-stock color accent bar and a timer showing elapsed waiting time in MM:SS format, updated every 1 second.
5. WHEN an order card is in "NEW" status, THE Admin_Dashboard SHALL display a primary color accent bar and a timer showing elapsed waiting time in MM:SS format, updated every 1 second.
6. THE Admin_Dashboard SHALL display on each order card the order ID, customer name, ordered item list with quantities, and an "Assign Table" button.
7. WHEN the "Assign Table" button is clicked, THE Admin_Dashboard SHALL present only seats with status 0 (available) from real-time seat data for selection.
8. WHEN the cashier selects a seat from the available seats list and confirms the assignment, THE Admin_Dashboard SHALL persist the seat assignment and remove the order card from the pending queue within 2 seconds.
9. IF no seats are available (all 24 seats have status 1) when the "Assign Table" button is clicked, THEN THE Admin_Dashboard SHALL display a message indicating no seats are currently available and keep the order card in the queue unchanged.

### Requirement 8: Admin Dashboard — Inventory Management

**User Story:** As a VOKAFE manager, I want to track raw material inventory levels so that I can restock before items run out and avoid order fulfillment failures.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display an inventory table listing all raw materials, where each row shows the item name, unit of measure, current stock quantity, and configured minimum threshold.
2. IF a raw material's current stock quantity is greater than zero and at or below its configured minimum threshold, THEN THE Admin_Dashboard SHALL display that item's row with an amber/yellow warning color indicator.
3. IF a raw material's current stock quantity equals zero, THEN THE Admin_Dashboard SHALL display that item's row with a red alert color indicator.
4. WHEN an inventory item's quantity falls below its configured minimum threshold, THE Admin_Dashboard SHALL display a restock alert notification that identifies the affected item by name and remains visible until the item's stock quantity is updated to a value at or above the minimum threshold.
5. THE Admin_Dashboard SHALL update the inventory table and stock indicators within 5 seconds of a stock quantity change being recorded in the system.

### Requirement 9: Admin Dashboard — Analytics and Reporting

**User Story:** As a VOKAFE manager, I want to view sales analytics, peak hour data, and seat efficiency metrics so that I can make informed business decisions.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display daily (calendar day) and weekly (Monday–Sunday) sales totals, each accompanied by a percentage change compared to the previous equivalent period (previous day or previous week) as the trend indicator.
2. THE Admin_Dashboard SHALL display peak hour analysis by ranking 1-hour time slots (from opening to closing) by average seat occupancy percentage, and showing the top 3 busiest time slots for the selected day or week.
3. THE Admin_Dashboard SHALL display seat efficiency metrics per zone (Left, Top, Center/Right) showing average occupancy duration in minutes and turnover rate (number of occupy-then-vacate cycles per seat per day) for the selected date range up to the last 7 days.
4. WHEN the manager activates the "Export Report" function, THE Admin_Dashboard SHALL generate a downloadable CSV file containing the currently displayed analytics data within 10 seconds.
5. IF no sales or occupancy data exists for the selected date range, THEN THE Admin_Dashboard SHALL display a message indicating that no data is available for the selected period.

### Requirement 10: Customer App — Menu Catalog and Ordering

**User Story:** As a VOKAFE customer (student), I want to browse the menu and place orders from my phone so that I can order without waiting in line.

#### Acceptance Criteria

1. THE Customer_App SHALL display a menu catalog with item names, descriptions (maximum 120 characters), prices (in IDR format with thousands separator), and images for each menu item.
2. WHEN the customer taps the "quick add-to-cart" button on a menu item, THE Customer_App SHALL add 1 unit of that item to the cart.
3. WHEN a menu item is added to cart, THE Customer_App SHALL update the cart badge count in the bottom navigation within 1 second to reflect the total number of items in the cart.
4. THE Customer_App SHALL organize menu items into named categories and display the category list so the customer can filter the catalog by selecting a single category at a time.
5. IF a menu item is marked as unavailable, THEN THE Customer_App SHALL visually indicate the item as unavailable and disable its "quick add-to-cart" button.
6. IF the image for a menu item fails to load, THEN THE Customer_App SHALL display a placeholder image in place of the missing item image.

### Requirement 11: Customer App — Live Seat Availability View

**User Story:** As a VOKAFE customer, I want to see which seats are currently available before visiting the coffeeshop so that I can plan my visit.

#### Acceptance Criteria

1. THE Customer_App SHALL display the complete 24-seat floor plan map within a scrollable and pannable container, conforming to the spatial layout defined in the "Floor Plan Reference" section, rendering all three zones (Zona Kiri: seats 1–4 with Barista counter as vertical strip, Zona Atas: seats 11–24 Kursi Tangga as 4-row × 3-column-group tribune, Zona Tengah & Kanan: Meja 5–10 as 6 concrete tables in a 2×3 grid) in the same spatial arrangement as the Admin_Dashboard Tablespace view.
2. WHEN the Customer_App seat map view is first loaded, THE Customer_App SHALL fetch and display the current status of all 24 seats from the backend within 3 seconds before relying on WebSocket events for subsequent updates.
3. WHEN a "seat_update" WebSocket event is received, THE Customer_App SHALL update the corresponding seat indicator within 1 second of event receipt without a page reload.
4. IF the WebSocket connection is lost or fails to establish, THEN THE Customer_App SHALL display a visible connectivity status indicator informing the user that seat data may be stale, and SHALL attempt to reconnect automatically at intervals of no more than 5 seconds.
5. THE Customer_App SHALL render occupied seats with a solid Magenta (#D81B60) background and white (#ffffff) text, and SHALL render available seats with a mint-green (#6cf8bb) background and on-secondary-container (#00714d) text without a border, conforming to the Customer_MD3_Tokens.
6. THE Customer_App SHALL display the seat map in the "Tables" tab of the bottom navigation.
7. THE Customer_App SHALL render the Zona Atas tribune section at the top of the seat map container with 3 side-by-side column groups, each containing 4 rows of seat indicators arranged per the Floor Plan Reference row structure (Row 1: 11,12,12,13 / Row 2: 17,16,15,14 / Row 3: 18,19,20,20 / Row 4: 24,23,22,21).
8. THE Customer_App SHALL render each Meja Beton (tables 5-10) as a brown/gold colored rectangle with 4 sensor position indicators (2 on the top edge, 2 on the bottom edge) in the 2-row × 3-column grid layout specified in the Floor Plan Reference.
9. THE Customer_App SHALL render the Zona Kiri section as a vertical strip on the far left showing the "BARISTA DAN KASIR" label and 4 single-seat indicators (Seats 1-4) arranged vertically from top to bottom.
10. THE Customer_App SHALL display an Indoor/Outdoor segmented toggle above the floor plan, with "Indoor" as the default active segment showing the full 24-seat layout and "Outdoor" as a placeholder segment that, when selected, displays a "Coming Soon" message and SHALL NOT render any seat indicators.
11. THE Customer_App SHALL display a legend below the Indoor/Outdoor toggle and above the floor plan showing two entries: an "Available" entry with a mint-green (#6cf8bb) swatch and an "Occupied" entry with a Magenta (#D81B60) swatch.
12. THE Customer_App SHALL display a floating action button (FAB) anchored to the bottom-right of the Tables view, positioned above the bottom navigation, displaying the Material_Symbols_Outlined "qr_code_scanner" icon on a primary (#b80035) background with on-primary (#ffffff) icon color and a glow shadow.
13. WHEN the customer taps the QR scanner FAB, THE Customer_App SHALL display a "Coming soon" toast notification and SHALL NOT initiate any backend QR check-in flow during the MVP scope.

### Requirement 12: Customer App — Shopping Cart and Checkout

**User Story:** As a VOKAFE customer, I want to review my cart and complete payment so that my order is submitted to the kitchen, regardless of whether I am logged in.

#### Acceptance Criteria

1. THE Customer_App SHALL display all cart items with item name, quantity (range: 1 to 99), individual price, and a total amount that recalculates within 1 second whenever any item quantity is adjusted or an item is removed.
2. THE Customer_App SHALL allow quantity adjustment (increase, decrease, remove) for each cart item, enforcing a minimum quantity of 1 per item and treating a decrease below 1 as item removal from the cart.
3. WHEN the customer initiates checkout and the cart contains at least one item, THE Customer_App SHALL present a list of supported payment methods on the checkout screen as selectable options before the order is submitted, including at minimum: e-wallet, bank transfer, and cash on pickup.
4. IF the customer initiates checkout with an empty cart, THEN THE Customer_App SHALL display a message indicating the cart is empty and prevent progression to the payment step.
5. WHEN payment is confirmed by an authenticated customer, THE Customer_App SHALL submit the order to the Backend_Server with the customer's JWT in the Authorization header, the Backend_Server SHALL persist the order with `userEmail` set to the authenticated customer's email, and THE Customer_App SHALL display the Payment_Success_Screen with an order number within 5 seconds of payment confirmation.
6. WHEN payment is confirmed by an unauthenticated customer, THE Customer_App SHALL submit the order to the Backend_Server without an Authorization header, the Backend_Server SHALL persist the order as a Guest_Order with `userEmail` set to NULL, and THE Customer_App SHALL display the Payment_Success_Screen with an order number within 5 seconds of payment confirmation.
7. IF payment fails, THEN THE Customer_App SHALL display an error message indicating the payment was unsuccessful and retain all cart contents and quantities unchanged for retry.
8. IF payment is confirmed but the order submission to the Backend_Server fails, THEN THE Customer_App SHALL display an error message indicating the order could not be submitted, retain the order details locally, and provide a retry option to resubmit the order without requiring a second payment.
9. THE Payment_Success_Screen SHALL display the order number, the ordered items summary (item name and quantity for each item), the total amount paid in IDR formatted with thousands separator, and two primary action buttons labeled "View Order Status" and "Back to Menu".
10. WHEN the customer taps the "View Order Status" button on the Payment_Success_Screen, THE Customer_App SHALL navigate to the order detail view for the newly created order using the order number returned by the Backend_Server, where the detail view is reachable in a session-scoped form even for a Guest_Order.
11. WHEN the customer taps the "Back to Menu" button on the Payment_Success_Screen, THE Customer_App SHALL navigate to the Menu tab and clear all items from the cart.
12. WHILE the customer is on the checkout screen and has not selected a payment method, THE Customer_App SHALL keep the "Pay Now" submission action disabled.
13. WHEN an unauthenticated customer reaches the Payment_Success_Screen, THE Customer_App SHALL display an "Optional: Save Order to Account" prompt below the primary action buttons that, when tapped, navigates to the Login screen, AND on successful login or registration the Backend_Server SHALL retroactively associate the just-placed Guest_Order with the new account by setting `userEmail` to the authenticated customer's email.
14. WHILE the customer is authenticated, THE Customer_App SHALL NOT display the "Optional: Save Order to Account" prompt on the Payment_Success_Screen.

### Requirement 13: Customer App — User Profile and Optional Authentication

**User Story:** As a VOKAFE customer, I want to browse the menu, view tables, manage my cart, and check out without being forced to log in, while still having the option to sign in or register so that I can later retrieve my order history.

#### Acceptance Criteria

1. THE Customer_App SHALL treat customer authentication as optional and SHALL allow unauthenticated browsing of the Menu tab, Tables tab, Cart tab, the Checkout screen, and the Payment_Success_Screen.
2. WHEN a customer navigates to the Profile tab WHILE unauthenticated, THE Customer_App SHALL render a guest-state Profile view containing a "Sign In or Create Account" call-to-action button and SHALL NOT display name, email, or order history entries.
3. WHEN a customer taps the "Sign In or Create Account" button from the guest Profile view, THE Customer_App SHALL navigate to the Login screen within 300 milliseconds.
4. WHEN a customer submits valid credentials consisting of an email address and a password on the Login screen, THE Customer_App SHALL authenticate the customer via POST `/api/auth/login`, persist the JWT returned by the Backend_Server in localStorage under the key `vokafe_customer_jwt`, and navigate to the authenticated Profile view within 3 seconds.
5. WHILE the customer is authenticated, THE Customer_App SHALL display in the Profile view the customer's name, the customer's email address, an "Order History" navigation entry, and a "Logout" button.
6. IF the email input on the Login or Register screen does not match the regular expression `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, THEN THE Customer_App SHALL reject the submission with an inline validation error indicating that a valid email address is required.
7. WHILE the customer is unauthenticated, THE Customer_App SHALL hide the "Order History" navigation entry from the Profile view and SHALL NOT include an Authorization header on any outgoing API request.
8. WHILE the customer is authenticated, THE Customer_App SHALL include the header `Authorization: Bearer <jwt>` on every customer-scoped API request, including POST `/api/orders`, GET `/api/orders/history`, and GET `/api/orders/:id` filtered to the authenticated customer's own orders.
9. THE Customer_App SHALL provide a Register screen accessible from a footer link on the Login screen, where the customer enters email (RFC 5322 format), full name (1 to 100 characters), password (minimum 8 characters), and password confirmation, in that order.
10. IF the password and password confirmation values on the Register screen do not match, THEN THE Customer_App SHALL display a validation error and SHALL NOT submit the registration.
11. IF the email submitted on the Register screen already exists in the system, THEN THE Backend_Server SHALL return HTTP 409 Conflict and THE Customer_App SHALL display an error message indicating that the email is already registered without creating a duplicate account.
12. WHEN a Register submission passes all client-side validation, THE Customer_App SHALL submit the registration to the Backend_Server which SHALL create a User record per Requirement 14.1 and respond with success or error.
13. WHEN registration succeeds, THE Customer_App SHALL automatically authenticate the new user, persist the returned JWT in localStorage, and navigate to the authenticated Profile view within 3 seconds.
14. WHEN the customer is authenticated, THE Customer_App SHALL display the Customer_Top_App_Bar persistently across the Menu, Tables, Cart, and Profile tabs, containing the VOKAFE_Brand_Logo on the left and a Material_Symbols_Outlined "search" icon button on the right.
15. WHILE the customer is unauthenticated, THE Customer_App SHALL still display the Customer_Top_App_Bar across the Menu, Tables, Cart, and Profile tabs so that the bottom-navigation tabs remain accessible without login.
16. WHEN the customer taps the "Logout" button in the authenticated Profile view, THE Customer_App SHALL clear the `vokafe_customer_jwt` value from localStorage and navigate to the guest-state Profile view within 1 second.

### Requirement 14: Database Schema Design

**User Story:** As a backend developer, I want a well-structured database schema so that all system entities are properly stored and related.

#### Acceptance Criteria

1. THE Prisma_ORM SHALL define a User model with email (String, maximum 254 characters, validated against RFC 5322 email format) as the primary key, along with name (String, maximum 100 characters), passwordHash (String, maximum 255 characters), createdAt (DateTime, default to current timestamp), and updatedAt (DateTime, auto-updated on modification).
2. THE Prisma_ORM SHALL define a Seat model with id (Integer, valid range 1–24) as the primary key, status (Integer, 0 for available or 1 for occupied, default 0), zone (String, one of "left", "center", or "upper"), and an updatedAt timestamp that auto-updates on modification.
3. THE Prisma_ORM SHALL define an Order model with an auto-incremented Integer id as the primary key, a nullable foreign key reference to User via the field `userEmail` (String, maximum 254 characters, on delete SetNull, NULL for guest orders placed by unauthenticated customers), a nullable foreign key reference to Seat (via seat id), totalAmount (Decimal with precision 10 and scale 2, range 0.00 to 99,999,999.99), status (String, one of "pending", "preparing", "ready", "completed", or "cancelled"), createdAt (DateTime, default to current timestamp), and updatedAt (DateTime, auto-updated on modification).
4. THE Prisma_ORM SHALL define an Inventory model with an auto-incremented Integer id as the primary key, itemName (String, maximum 100 characters, unique), quantity (Integer, minimum 0), unit (String, maximum 20 characters), minimumThreshold (Integer, minimum 0), createdAt (DateTime, default to current timestamp), and updatedAt (DateTime, auto-updated on modification).
5. THE Prisma_ORM SHALL define an OrderItem model with an auto-incremented Integer id as the primary key, a foreign key reference to Order (via order id), a foreign key reference to MenuItem (via menu item id), quantity (Integer, minimum 1), and priceAtOrder (Decimal with precision 10 and scale 2, storing the menu item price at the time the order was placed).
6. THE Prisma_ORM SHALL define a MenuItem model with an auto-incremented Integer id as the primary key, name (String, maximum 100 characters), description (String, maximum 500 characters), price (Decimal with precision 10 and scale 2, minimum 0.01), category (String, maximum 50 characters), imageUrl (String, maximum 500 characters, nullable), and isAvailable (Boolean, default true).
7. THE Prisma_ORM SHALL enforce referential integrity such that deleting a User sets `userEmail` to NULL on all that user's Orders (preserving the orders as Guest_Order records rather than cascading deletion), deleting an Order cascades deletion to all associated OrderItems, and a Seat reference on an Order is set to null if the Seat is deleted.
8. THE Prisma_ORM SHALL persist guest orders placed by unauthenticated customers with `userEmail = NULL`, and the Backend_Server SHALL accept order creation requests that omit `userEmail` and store them as Guest_Order records.

### Requirement 15: Cloud Infrastructure and Security

**User Story:** As a system administrator, I want the backend deployed securely on cloud infrastructure so that the system is reliable and protected from unauthorized access.

#### Acceptance Criteria

1. THE Backend_Server SHALL be deployed on an AWS EC2 instance behind an Nginx reverse proxy.
2. THE Backend_Server SHALL terminate SSL/TLS connections at the Nginx layer to encrypt all client-server communication.
3. WHEN a GET request is made to /api/health, THE Backend_Server SHALL return an HTTP 200 response with a JSON body containing at minimum a "status" field indicating operational state, within 5 seconds of receiving the request.
4. IF an unauthenticated request (missing or invalid JWT token) is made to a protected API endpoint, THEN THE Backend_Server SHALL return an HTTP 401 Unauthorized response with a JSON body containing an error message indicating the authentication failure reason.
5. IF incoming request data fails validation (missing required fields, incorrect data types, or values outside permitted ranges), THEN THE Backend_Server SHALL reject the request with an HTTP 400 response containing a JSON body that indicates which field(s) failed validation, without processing the request further.
6. THE Backend_Server SHALL sanitize all incoming string inputs by removing or escaping characters that could enable injection attacks before passing data to the database layer or broadcasting to connected clients.
7. THE Backend_Server SHALL provide two distinct authentication endpoints: POST `/api/auth/login` for customer credentials (email plus password) returning a JWT whose payload includes `role: 'customer'`, and POST `/api/auth/admin/login` for the Admin_Account credentials (`ADMIN_USERNAME` plus `ADMIN_PASSWORD`) returning a JWT whose payload includes `role: 'admin'`.
8. WHEN a request to an admin-only API route is presented with a JWT whose payload does not include `role: 'admin'`, THE Backend_Server SHALL return HTTP 403 Forbidden with a JSON body indicating insufficient privileges.
9. THE Backend_Server SHALL seed exactly one Admin_Account at startup from the environment variables `ADMIN_USERNAME` and `ADMIN_PASSWORD`, hashing the plaintext password using bcrypt with a cost factor of at least 10, and SHALL store the hashed credentials in a separate AdminUser table or in-memory map that is distinct from the customer User table.

### Requirement 16: Telemetry Payload Parsing and Validation

**User Story:** As a backend developer, I want robust parsing and validation of incoming telemetry data so that malformed payloads do not corrupt the system state.

#### Acceptance Criteria

1. WHEN a message is received on the "vokafe/iot/telemetry" MQTT topic, THE Backend_Server SHALL parse the message body as JSON.
2. IF the message body is not valid JSON, THEN THE Backend_Server SHALL log the parse error, discard the message, and continue processing subsequent messages without interruption.
3. IF the parsed JSON payload does not contain exactly the fields "id_kursi" (integer) and "status" (integer), THEN THE Backend_Server SHALL discard the message and log a validation error.
4. IF the "id_kursi" value is not an integer in the range 1 to 24 inclusive, or the "status" value is not 0 or 1, THEN THE Backend_Server SHALL discard the message and log a validation error indicating the out-of-range field.
5. WHEN the parsed payload passes all validation checks, THE Backend_Server SHALL accept the Telemetry_Payload for processing.
6. FOR ALL valid Telemetry_Payload objects, parsing the JSON string and then serializing the parsed object back to JSON SHALL produce an equivalent payload (round-trip property).
7. IF the message body exceeds 256 bytes, THEN THE Backend_Server SHALL discard the message without attempting to parse it.

### Requirement 17: Customer App — Bottom Navigation

**User Story:** As a VOKAFE customer, I want a fixed bottom navigation bar so that I can quickly switch between Menu, Tables, Cart, and Profile sections.

#### Acceptance Criteria

1. THE Customer_App SHALL display a bottom navigation bar fixed to the viewport bottom with four tabs in left-to-right order: Menu (home icon), Tables (grid_view icon), Cart (shopping_cart icon), and Profile (person icon), each displaying a Material_Symbols_Outlined icon and a text label.
2. THE Customer_App SHALL keep the bottom navigation bar visible and anchored to the viewport bottom while the user scrolls content within any section.
3. WHEN a navigation tab is tapped, THE Customer_App SHALL switch to the corresponding section within 300 milliseconds without a full page reload.
4. THE Customer_App SHALL highlight the currently active tab by applying the primary-container (#e11d48) background and on-primary-container (#fffaf9) icon and label color, while inactive tabs use the on-surface-variant (#5c3f40) color.
5. WHEN the Customer_App is first loaded and no tab has been previously selected, THE Customer_App SHALL set the Menu tab as the default active tab, AND THE Customer_App SHALL keep the Profile tab reachable from the bottom navigation regardless of whether the customer is authenticated.
6. THE Customer_App SHALL display a numeric badge on the Cart tab indicating the total number of items currently in the cart, displaying the exact count for values from 1 to 99 and displaying "99+" for counts exceeding 99.
7. IF the cart contains zero items, THEN THE Customer_App SHALL hide the badge from the Cart tab.
8. WHILE the customer is on the Menu tab and the cart contains at least one item, THE Customer_App SHALL display a Cart_Summary_Bar anchored above the bottom navigation bar showing the total item count, the total price formatted in IDR with thousands separator, and a "View Cart" button.
9. WHILE the customer is on any tab other than the Menu tab, THE Customer_App SHALL hide the Cart_Summary_Bar.
10. IF the cart contains zero items, THEN THE Customer_App SHALL hide the Cart_Summary_Bar regardless of the active tab.
11. WHEN the customer taps the "View Cart" button on the Cart_Summary_Bar, THE Customer_App SHALL switch to the Cart tab within 300 milliseconds.

### Requirement 18: UI Design System Compliance

**User Story:** As a VOKAFE brand manager, I want all user interfaces to follow the established design system so that the brand identity is consistent across all touchpoints.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL use the Admin_Flat_Palette exclusively, with White (#FFFFFF) and Light Gray (#F3F4F6) as primary background colors and Dark Blue/Slate tones (#1E293B for primary text, #475569 for secondary accents) for textual and non-brand-accent UI elements.
2. THE Customer_App SHALL use the Customer_MD3_Tokens exclusively, with surface (#fbf8fc) and surface-container-lowest (#ffffff) as primary background colors, on-surface (#1b1b1e) for primary text, and on-surface-variant (#5c3f40) for secondary text.
3. FOR Admin_Dashboard, THE Admin_Dashboard SHALL render occupied seat indicators with a Magenta (#D81B60) background and white (#FFFFFF) text, and SHALL render available seat indicators with a Light Gray (#F3F4F6) background and a 1px solid #E5E7EB border.
4. FOR Customer_App, THE Customer_App SHALL render occupied seat indicators with a Magenta (#D81B60) background and white (#ffffff) text, and SHALL render available seat indicators with a mint-green secondary-container (#6cf8bb) background and on-secondary-container (#00714d) text without a border.
5. THE Admin_Dashboard and Customer_App SHALL apply consistent component spacing, elevation, and border-radius patterns within their own design system so that all UI components share uniform visual structure within each application.
6. WHILE the viewport width is 1024px or greater, THE Admin_Dashboard SHALL display a fixed 240px left sidebar for navigation.
7. WHILE the viewport width is less than 1024px, THE Customer_App SHALL display a fixed bottom tab navigation bar containing Menu, Tables, Cart, and Profile tabs.
8. WHEN a seat status changes, THE VOKA-SEAT_System SHALL update the seat indicator color in real time without requiring a page reload on both the Admin Dashboard and the Customer App.
9. THE VOKA-SEAT_System SHALL display the VOKAFE brand logo (infinity/coffee-cup icon in Magenta #D81B60 with "VOKAFE" wordmark in a Magenta-to-Purple gradient) in the following locations: at the top of the Admin_Dashboard sidebar, in the Customer_App login and register screen headers, and centered in the Customer_Top_App_Bar of authenticated Customer_App views.
10. THE Admin_Dashboard SHALL render the VOKAFE brand logo at the top of the fixed left sidebar, sized to fit within the 240px sidebar width with appropriate padding, serving as a home/brand identifier.
11. THE Customer_App SHALL render the VOKAFE brand logo centered in the login and register screen headers and on the left side of the Customer_Top_App_Bar in authenticated views at a height of 32px.
12. THE VOKA-SEAT_System SHALL store the brand logo as an SVG asset at `frontend/public/logo-vokafe.svg` and reference it from both the Admin_Dashboard and Customer_App interfaces to ensure consistent rendering across all screen densities.
13. THE Customer_App SHALL apply the Customer_Border_Radius scale (DEFAULT 0.25rem, lg 0.5rem, xl 0.75rem, full 9999px) to all rounded UI elements consistently.
14. THE Customer_App SHALL apply the Customer_Spacing_Scale (xs 4px, sm 8px, md 16px, lg 24px, xl 32px, margin-mobile 16px, margin-tablet 24px) to all padding, margin, and gap values.
15. THE Customer_App SHALL apply the Customer_Typography stack, using Lexend for all headlines and Inter for all body text and labels.
16. THE Customer_App SHALL render all icons using the Material_Symbols_Outlined icon font, including but not limited to: home, grid_view, shopping_cart, person, search, qr_code_scanner, mail, lock, lock_reset, add, arrow_forward, receipt_long, check_circle, expand_more, arrow_back.
17. THE Customer_App SHALL render every primary action button with a primary (#b80035) background, on-primary (#ffffff) text, a 12px (rounded-xl, 0.75rem) border-radius, and a glow shadow defined as `0 4px 12px rgba(225, 29, 72, 0.2)`.
18. WHEN any touchable element in the Customer_App is pressed, THE Customer_App SHALL scale that element to 95% of its rendered size for the duration of the press to provide tactile feedback.

### Requirement 19: Customer App — Order History Detail and Empty State

**User Story:** As an authenticated VOKAFE customer, I want to view my past orders with rich detail so that I can review what I ordered, when, and the current status of each order.

#### Acceptance Criteria

1. WHILE the customer is unauthenticated, THE Customer_App SHALL NOT render the "Order History" entry in the Profile tab, and the Order History list, the Order Detail view, and the order-history empty state SHALL be reachable only when the customer is authenticated.
2. THE Customer_App SHALL display each order in the order history list as a card showing the order date and time, an item summary listing item names separated by commas, the total amount in IDR formatted with thousands separator, and an Order_Status_Pill.
3. THE Customer_App SHALL color the Order_Status_Pill by status as follows: pending uses an amber background with on-tertiary text tone, preparing uses primary (#b80035) background with on-primary (#ffffff) text, ready uses tertiary-container (#00836c) background with on-tertiary-container (#eefff7) text, completed uses secondary-container (#6cf8bb) background with on-secondary-container (#00714d) text, and cancelled uses error (#ba1a1a) background with on-error (#ffffff) text.
4. WHEN the customer taps an order card in the order history list, THE Customer_App SHALL navigate to an order detail view for that order.
5. THE order detail view SHALL display the full item list with quantity and unit price for each item, the subtotal, any tax amount, the grand total, the assigned seat number when the order has a non-null seat assignment, and the timestamp of each status change in chronological order.
6. IF an order has no assigned seat, THEN THE order detail view SHALL display "No seat assigned" in place of the seat number.
7. WHEN the authenticated user has zero past orders, THE Customer_App SHALL display an empty state in the order history section containing an illustration placeholder, the message "No orders yet", and a "Browse Menu" call-to-action button.
8. WHEN the customer taps the "Browse Menu" call-to-action button in the empty state, THE Customer_App SHALL navigate to the Menu tab within 300 milliseconds.
9. THE Customer_App SHALL render order history list cards using the Customer_MD3_Tokens with surface-container-lowest (#ffffff) background, xl (0.75rem) border-radius, and a subtle shadow consistent with the Customer_App design system.

### Requirement 20: Customer App — Login and Register Visual Specification

**User Story:** As a VOKAFE customer, I want a polished, consistent login and registration experience so that signing in feels trustworthy and easy on a phone.

#### Acceptance Criteria

1. THE Customer_App Login screen SHALL render a single content card vertically and horizontally centered in the viewport, with surface-container-lowest (#ffffff) background, xl (0.75rem) border-radius, and an ambient shadow defined as `0 8px 24px rgba(0, 0, 0, 0.08)`.
2. THE Customer_App Login screen SHALL display the VOKAFE_Brand_Logo at the top of the content card, the headline "Welcome Back" rendered in font-headline-md, and the subline "Please enter your details to sign in." rendered in font-body-md with on-surface-variant (#5c3f40) color directly below the headline.
3. THE Customer_App Login screen SHALL render the email identifier input field as the first field, labeled "Email", with a leading Material_Symbols_Outlined "mail" icon, the HTML attribute `inputMode="email"`, and the password input field with a leading Material_Symbols_Outlined "lock" icon, where both inputs use a surface-bright (#fbf8fc) background, an outline-variant (#e5bdbe) border, and a 48px height.
4. THE Customer_App Login screen SHALL render a primary submit button labeled "Login" with the styling defined in Requirement 18.17 and full width within the content card.
5. THE Customer_App Login screen SHALL display a footer section below the submit button containing the text "Don't have an account?" followed by a "Sign Up" link rendered in primary (#b80035) color that navigates to the Register screen.
6. THE Customer_App Register screen SHALL mirror the Login screen layout, with surface-container-lowest (#ffffff) card, xl border-radius, and the same ambient shadow.
7. THE Customer_App Register screen SHALL display the VOKAFE_Brand_Logo at the top, the headline "Create Account" in font-headline-md, and a subline describing the registration purpose.
8. THE Customer_App Register screen SHALL render four input fields in the following order, each with a leading Material_Symbols_Outlined icon: email with "mail" icon, full name with "person" icon, password with "lock" icon, and password confirmation with "lock_reset" icon.
9. THE Customer_App Register screen SHALL render a primary submit button labeled "Create Account" with the styling defined in Requirement 18.17.
10. THE Customer_App Register screen SHALL display a footer section below the submit button containing the text "Already have an account?" followed by a "Login here" link rendered in primary (#b80035) color that navigates to the Login screen.
11. WHEN the customer taps the "Sign Up" link on the Login screen, THE Customer_App SHALL navigate to the Register screen within 300 milliseconds without a full page reload.
12. WHEN the customer taps the "Login here" link on the Register screen, THE Customer_App SHALL navigate to the Login screen within 300 milliseconds without a full page reload.

### Requirement 21: Admin Authentication and Authorization

**User Story:** As a VOKAFE manager or cashier, I want the Admin_Dashboard to require login so that operational data, order queues, inventory, and analytics are protected from unauthorized access.

#### Acceptance Criteria

1. WHILE no admin JWT is present in localStorage under the key `vokafe_admin_jwt`, THE Admin_Dashboard SHALL render an admin Login screen containing a username input field, a password input field, a single "Sign In" submit button, and the VOKAFE_Brand_Logo, and SHALL NOT render any other admin view.
2. WHEN an admin submits credentials matching the seeded Admin_Account, THE Backend_Server SHALL respond with HTTP 200 and a JSON body containing a JWT whose payload includes `role: 'admin'`, AND THE Admin_Dashboard SHALL persist the JWT in localStorage under the key `vokafe_admin_jwt` and render the authenticated dashboard within 1 second.
3. IF the submitted credentials do not match the Admin_Account, THEN THE Backend_Server SHALL return HTTP 401 with a JSON body containing a generic "Invalid credentials" error message, AND THE Admin_Dashboard SHALL display the same generic error message inline on the admin Login screen without revealing which field is incorrect.
4. WHILE the admin is authenticated, THE Admin_Dashboard SHALL display a "Logout" button in the sidebar, AND WHEN the admin taps the "Logout" button, THE Admin_Dashboard SHALL clear the `vokafe_admin_jwt` value from localStorage and navigate to the admin Login screen within 1 second.
5. WHEN any admin-only API request returns HTTP 401 or HTTP 403 due to a token that is expired, missing, or carries an insufficient role, THE Admin_Dashboard SHALL clear the `vokafe_admin_jwt` value from localStorage and redirect to the admin Login screen within 1 second.
6. THE Admin_Dashboard SHALL include the header `Authorization: Bearer <jwt>` on every admin-only API request, including GET `/api/orders/pending`, PATCH `/api/orders/:id/assign-seat`, PATCH `/api/orders/:id/status`, GET `/api/inventory`, PATCH `/api/inventory/:id`, GET `/api/analytics/sales`, and GET `/api/analytics/occupancy`.
7. THE Backend_Server SHALL seed the Admin_Account at startup from the environment variables `ADMIN_USERNAME` and `ADMIN_PASSWORD`, AND SHALL hash the plaintext value of `ADMIN_PASSWORD` using bcrypt with a cost factor of at least 10 before persisting the hashed credential.
8. THE Admin_Account SHALL be the only account capable of authenticating against POST `/api/auth/admin/login`, AND IF a customer-table credential is submitted to POST `/api/auth/admin/login`, THEN THE Backend_Server SHALL return HTTP 401 with a generic "Invalid credentials" error message and SHALL NOT issue a JWT.
