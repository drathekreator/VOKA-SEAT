# Implementation Plan: VOKA-SEAT System

## Overview

This plan implements the VOKA-SEAT IoT-based real-time seat occupancy monitoring system for VOKAFE coffeeshop. The implementation progresses from database schema and core backend infrastructure, through telemetry ingestion and WebSocket broadcasting, to the Admin Dashboard and Customer App frontends. Each task builds incrementally on previous work, with property-based tests validating correctness properties from the design document.

## Tasks

- [x] 1. Database schema and backend project setup
  - [x] 1.1 Update Prisma schema with full data models
    - Update `backend/prisma/schema.prisma` to match the target schema from the design document
    - Add User model with NIM primary key, passwordHash field
    - Add Seat model with zone field (left, center, upper)
    - Add Order, OrderItem, MenuItem, and Inventory models with all relations
    - Enforce referential integrity (cascade deletes on User→Orders, Order→OrderItems, SetNull on Seat deletion)
    - Run `npx prisma generate` to produce the Prisma client
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 1.2 Set up backend project structure and testing infrastructure
    - Install Vitest and fast-check as dev dependencies in backend
    - Create `backend/tests/properties/`, `backend/tests/unit/`, `backend/tests/integration/` directories
    - Add vitest config to `backend/package.json` scripts (`"test": "vitest --run"`)
    - Create `backend/src/telemetry/`, `backend/src/validators/`, `backend/src/services/`, `backend/src/middleware/`, `backend/src/routes/` directory structure
    - _Requirements: 15.1_

  - [x] 1.3 Seed database with initial 24 seats and zone mapping
    - Create `backend/prisma/seed.ts` that inserts all 24 seats with correct zone assignments (seats 1-4 → "left", seats 5-10 → "center", seats 11-24 → "upper")
    - Add seed script to package.json
    - _Requirements: 14.2_

- [x] 2. Telemetry validation and ingestion pipeline
  - [x] 2.1 Implement telemetry payload validator
    - Create `backend/src/telemetry/validator.ts`
    - Validate: message ≤ 256 bytes, well-formed JSON, contains exactly `id_kursi` (integer 1-24) and `status` (integer 0 or 1)
    - Return typed result (valid payload or error reason)
    - _Requirements: 4.1, 4.4, 4.5, 4.6, 16.1, 16.2, 16.3, 16.4, 16.5, 16.7_

  - [x] 2.2 Write property test for telemetry validation (Property 3)
    - **Property 3: Telemetry Payload Validation Completeness**
    - Use fast-check to generate random strings, JSON objects, edge values
    - Verify validator accepts if and only if: ≤256 bytes, well-formed JSON, contains exactly id_kursi (1-24) and status (0|1)
    - **Validates: Requirements 4.1, 4.4, 4.5, 4.6, 16.1, 16.2, 16.3, 16.4, 16.5, 16.7**

  - [x] 2.3 Implement telemetry serializer
    - Create `backend/src/telemetry/serializer.ts`
    - Implement serialize/deserialize functions for TelemetryPayload
    - Ensure round-trip consistency and payload size ≤ 128 bytes
    - _Requirements: 2.3, 16.6_

  - [x] 2.4 Write property test for telemetry serialization (Property 2)
    - **Property 2: Telemetry Payload Serialization Round-Trip**
    - Use fast-check to generate random seat IDs (1-24) and statuses (0|1)
    - Verify serialize→parse produces identical id_kursi and status; serialized ≤ 128 bytes
    - **Validates: Requirements 2.3, 16.6**

  - [x] 2.5 Implement MQTT client with validated ingestion and Seat service
    - Create `backend/src/services/seatService.ts` with upsert logic via Prisma
    - Refactor `backend/src/server.ts` MQTT message handler to use validator and seat service
    - On valid payload: upsert seat record, broadcast via Socket.IO
    - On invalid payload: log error, discard, continue processing
    - On DB error: log error with seat ID, discard, do not crash
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 3. WebSocket broadcasting and REST API foundation
  - [x] 3.1 Implement WebSocket broadcaster with initial state emission
    - Create `backend/src/websocket/broadcaster.ts`
    - On new client connection: emit `all_seats` event with all 24 seat statuses from DB
    - On seat upsert: emit `seat_update` event with `{ id, status, updatedAt }`
    - On DB unreachable during client connect: emit `error` event
    - Configure CORS: allow all origins in dev, restrict in production via env var
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 3.2 Write property test for WebSocket broadcast payload (Property 4)
    - **Property 4: WebSocket Broadcast Payload Invariant**
    - Use fast-check to generate random valid seat update objects
    - Verify every emitted payload contains id (1-24) and status (0|1)
    - **Validates: Requirements 5.2**

  - [x] 3.3 Implement input sanitization middleware
    - Create `backend/src/middleware/sanitizer.ts`
    - Remove/escape characters enabling SQL injection or XSS (`<`, `>`, `'`, `"`, `;`, `--`, `<script>`)
    - Apply to all incoming string inputs before DB layer or broadcast
    - _Requirements: 15.6_

  - [x] 3.4 Write property test for input sanitization (Property 14)
    - **Property 14: Input Sanitization**
    - Use fast-check to generate random strings with injection patterns
    - Verify sanitized output contains no dangerous characters/sequences
    - **Validates: Requirements 15.6**

  - [x] 3.5 Implement NIM validator
    - Create `backend/src/validators/nimValidator.ts`
    - Accept numeric strings of 8-12 digits; reject all others
    - _Requirements: 13.3_

  - [x] 3.6 Write property test for NIM validation (Property 12)
    - **Property 12: NIM Format Validation**
    - Use fast-check to generate random strings (numeric, alpha, mixed, varying lengths)
    - Verify acceptance iff numeric string of 8-12 digits
    - **Validates: Requirements 13.3**

- [x] 4. Checkpoint - Core backend validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Authentication and REST API endpoints
  - [x] 5.1 Implement JWT authentication middleware
    - Create `backend/src/middleware/auth.ts`
    - Verify JWT token on protected routes; return 401 on missing/invalid token
    - Create `backend/src/routes/auth.ts` with POST `/api/auth/login` and POST `/api/auth/register`
    - Hash passwords with bcrypt; authenticate via NIM + password
    - _Requirements: 13.1, 13.2, 15.4_

  - [x] 5.2 Implement seats REST API
    - Create `backend/src/routes/seats.ts`
    - GET `/api/seats` — return all 24 seat statuses with zone info
    - GET `/api/seats/:id` — return single seat status
    - No auth required for seat endpoints
    - _Requirements: 5.3, 6.6, 11.2_

  - [x] 5.3 Implement menu REST API
    - Create `backend/src/routes/menu.ts`
    - GET `/api/menu` — return full menu catalog
    - GET `/api/menu?category=:cat` — filter by category
    - No auth required
    - _Requirements: 10.1, 10.4_

  - [x] 5.4 Implement orders REST API
    - Create `backend/src/routes/orders.ts`
    - POST `/api/orders` (JWT) — create new order with items, calculate total
    - GET `/api/orders/history` (JWT) — paginated order history (20 per page, most recent first)
    - GET `/api/orders/pending` (Admin) — pending orders queue sorted by waiting time desc
    - PATCH `/api/orders/:id/assign-seat` (Admin) — assign available seat to order
    - PATCH `/api/orders/:id/status` (Admin) — update order status
    - _Requirements: 7.1, 7.6, 7.7, 7.8, 12.3, 12.5, 13.5_

  - [x] 5.5 Write property test for order history pagination (Property 13)
    - **Property 13: Order History Pagination and Sorting**
    - Use fast-check to generate random order lists of varying sizes
    - Verify: max 20 per page, sorted by creation date descending, correct page slicing
    - **Validates: Requirements 13.5**

  - [x] 5.6 Implement inventory REST API
    - Create `backend/src/routes/inventory.ts`
    - GET `/api/inventory` (Admin) — return inventory list with quantities and thresholds
    - PATCH `/api/inventory/:id` (Admin) — update inventory quantity
    - _Requirements: 8.1, 8.5_

  - [x] 5.7 Implement analytics REST API
    - Create `backend/src/routes/analytics.ts`
    - GET `/api/analytics/sales` (Admin) — daily/weekly sales totals with trend percentage
    - GET `/api/analytics/occupancy` (Admin) — peak hours and seat efficiency per zone
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [x] 5.8 Write property test for sales trend calculation (Property 16)
    - **Property 16: Sales Trend Percentage Calculation**
    - Use fast-check to generate random sales total pairs
    - Verify: ((current - previous) / previous) × 100 rounded to 1 decimal; handle S_previous = 0
    - **Validates: Requirements 9.1**

  - [x] 5.9 Write property test for peak hour ranking (Property 17)
    - **Property 17: Peak Hour Ranking**
    - Use fast-check to generate random hourly occupancy datasets
    - Verify: returns top 3 slots ranked by avg occupancy descending; handles < 3 slots
    - **Validates: Requirements 9.2**

- [x] 6. Checkpoint - Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Admin Dashboard — Tablespace and real-time seat map
  - [x] 7.1 Set up frontend testing infrastructure
    - Install Vitest, fast-check, React Testing Library, and jsdom in frontend
    - Create `frontend/tests/properties/` and `frontend/tests/unit/` directories
    - Add vitest config and test script to `frontend/package.json`
    - _Requirements: 18.5_

  - [x] 7.2 Create SeatIndicator component with color mapping
    - Create `frontend/src/components/SeatIndicator.tsx`
    - Occupied (status=1): bg #D81B60, white text
    - Available (status=0): bg #F3F4F6, 1px solid border #E5E7EB
    - Display seat number inside indicator
    - _Requirements: 6.3, 6.4, 6.8, 11.5, 18.3, 18.4_

  - [x] 7.3 Write property test for seat indicator color mapping (Property 5)
    - **Property 5: Seat Indicator Color Mapping**
    - Use fast-check to generate random seat status values
    - Verify: status=1 → #D81B60 bg + white text; status=0 → #F3F4F6 bg + #E5E7EB border
    - **Validates: Requirements 6.3, 6.4, 11.5**

  - [x] 7.4 Refactor Tablespace component to match floor plan reference
    - Update `frontend/src/components/Tablespace.tsx` to use SeatIndicator component
    - Render Zona Atas (tribune) at top with 3 column groups × 4 rows per the exact row structure (Row 1: 11,12,12,13 / Row 2: 17,16,15,14 / Row 3: 18,19,20,20 / Row 4: 24,23,22,21)
    - Render Zona Kiri as vertical strip with "BARISTA DAN KASIR" label and seats 1-4
    - Render Zona Tengah & Kanan as 6 Meja Beton (2×3 grid) with 4 sensor positions each (2 top, 2 bottom)
    - _Requirements: 6.1, 6.9, 6.10, 6.11_

  - [x] 7.5 Implement WebSocket connection with reconnection and initial fetch
    - Create `frontend/src/hooks/useSeats.ts` custom hook
    - On mount: fetch GET `/api/seats` for initial state
    - Subscribe to `seat_update` Socket.IO events for live updates
    - On disconnect: show connection-status indicator, auto-reconnect ≤5s
    - _Requirements: 6.2, 6.6, 6.7, 11.2, 11.3, 11.4_

- [x] 8. Admin Dashboard — Order Queue, Inventory, Analytics
  - [x] 8.1 Implement Order Queue view with urgency classification
    - Refactor `frontend/src/components/OrderQueue.tsx`
    - Create `frontend/src/utils/orderUrgency.ts` for urgency classification logic
    - Display order cards sorted by waiting time descending (longest first)
    - Classify: URGENT (>7min, red accent), WAITING (3-7min, amber), NEW (<3min, primary)
    - Show live timer (MM:SS) updated every second on each card
    - Display order ID, customer name, item list with quantities, "Assign Table" button
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 8.2 Write property test for order urgency classification (Property 7)
    - **Property 7: Order Urgency Classification**
    - Use fast-check to generate random elapsed time values (0 to 30 min)
    - Verify: >7min → URGENT, 3-7min → WAITING, <3min → NEW; mutually exclusive and exhaustive
    - **Validates: Requirements 7.2**

  - [x] 8.3 Write property test for order queue sorting (Property 6)
    - **Property 6: Order Queue Sorting by Wait Time**
    - Use fast-check to generate random order arrays with distinct timestamps
    - Verify: displayed in descending order of elapsed waiting time
    - **Validates: Requirements 7.1**

  - [x] 8.4 Implement Assign Table dialog with available seat filtering
    - Create `frontend/src/components/AssignTableDialog.tsx`
    - Create `frontend/src/utils/seatFilter.ts` for filtering available seats
    - On "Assign Table" click: show only seats with status=0
    - On confirm: call PATCH `/api/orders/:id/assign-seat`, remove card from queue
    - If no seats available: show "No seats available" message
    - _Requirements: 7.7, 7.8, 7.9_

  - [x] 8.5 Write property test for available seat filtering (Property 8)
    - **Property 8: Available Seat Filtering for Assignment**
    - Use fast-check to generate random arrays of 24 seat statuses
    - Verify: dialog shows exactly seats with status=0, excludes all status=1
    - **Validates: Requirements 7.7**

  - [x] 8.6 Implement Inventory Management view
    - Create `frontend/src/components/Inventory.tsx`
    - Create `frontend/src/utils/inventoryAlert.ts` for alert classification
    - Display inventory table: item name, unit, current stock, minimum threshold
    - Amber indicator when 0 < quantity ≤ threshold; red when quantity = 0
    - Show restock alert notification for items below threshold
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.7 Write property test for inventory alert classification (Property 9)
    - **Property 9: Inventory Alert Classification**
    - Use fast-check to generate random quantity/threshold pairs
    - Verify: qty=0 → red; 0 < qty ≤ threshold → amber; qty > threshold → no alert; mutually exclusive
    - **Validates: Requirements 8.2, 8.3, 8.4**

  - [x] 8.8 Implement Analytics view with CSV export
    - Create `frontend/src/components/Analytics.tsx`
    - Display daily/weekly sales totals with trend percentage
    - Display peak hour analysis (top 3 busiest time slots)
    - Display seat efficiency per zone (avg occupancy duration, turnover rate)
    - Implement CSV export within 10 seconds
    - Show "no data available" message when no data exists
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 9. Checkpoint - Admin Dashboard complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Customer App — Menu, Tables, Cart
  - [x] 10.1 Implement Customer App shell with bottom navigation
    - Create `frontend/src/customer/CustomerApp.tsx` with bottom tab navigation
    - Create `frontend/src/components/BottomNav.tsx`
    - Create `frontend/src/utils/badgeFormatter.ts` for cart badge logic
    - Four tabs: Menu, Tables, Cart, Account (left to right)
    - Fixed to viewport bottom, visible during scroll
    - Active tab highlighted with Magenta (#D81B60); inactive neutral
    - Default active tab: Menu
    - Cart badge: show count 1-99, "99+" for >99, hidden for 0
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [x] 10.2 Write property test for cart badge formatting (Property 15)
    - **Property 15: Cart Badge Display Formatting**
    - Use fast-check to generate random integers (0 to 200+)
    - Verify: 0 → hidden; 1-99 → exact count; >99 → "99+"
    - **Validates: Requirements 17.6**

  - [x] 10.3 Implement Menu catalog view
    - Create `frontend/src/customer/MenuView.tsx`
    - Display items with name, description (max 120 chars), price (IDR format with thousands separator), image
    - Category filter (single category at a time)
    - Quick add-to-cart button; update cart badge within 1 second
    - Unavailable items: visually indicated, add-to-cart disabled
    - Placeholder image on load failure
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 10.4 Implement Tables view (Customer seat map)
    - Create `frontend/src/customer/TablesView.tsx`
    - Render full 24-seat floor plan in scrollable/pannable container
    - Same spatial layout as Admin Tablespace (3 zones per Floor Plan Reference)
    - Reuse SeatIndicator component and useSeats hook
    - Fetch initial state from GET `/api/seats`; subscribe to `seat_update` events
    - Show connectivity indicator on WebSocket disconnect
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_

  - [x] 10.5 Implement Cart view with checkout flow
    - Create `frontend/src/customer/CartView.tsx`
    - Create `frontend/src/utils/cartCalculator.ts` for total computation and quantity logic
    - Display cart items: name, quantity (1-99), price, total
    - Quantity adjustment: increase, decrease, remove (decrease below 1 = remove)
    - Total recalculates within 1 second of any change
    - Checkout: present payment options if cart non-empty; show error if empty
    - On payment confirmed: submit order, show confirmation with order number
    - On payment failure: show error, retain cart
    - On order submission failure post-payment: show error with retry option
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 10.6 Write property test for cart total computation (Property 10)
    - **Property 10: Cart Total Computation**
    - Use fast-check to generate random item arrays with quantities (1-99) and prices (positive decimals)
    - Verify: total = sum of (quantity × priceAtOrder) for all items
    - **Validates: Requirements 12.1**

  - [x] 10.7 Write property test for cart quantity adjustment (Property 11)
    - **Property 11: Cart Quantity Adjustment Invariant**
    - Use fast-check to generate random cart states and adjustment operations
    - Verify: increase → Q+1; decrease when Q>1 → Q-1; decrease when Q=1 → remove; total recalculated
    - **Validates: Requirements 12.2**

  - [x] 10.8 Implement Account view with login and order history
    - Create `frontend/src/customer/AccountView.tsx`
    - Login form: NIM + password; validate NIM format (8-12 digits)
    - On invalid credentials: show generic error (don't reveal which field is wrong)
    - Authenticated view: display name and NIM
    - Order history: paginated (20 per page), show date, items, total, status
    - Empty state message when no orders
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [x] 11. Checkpoint - Customer App complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. UI design system, branding, and integration
  - [x] 12.1 Implement VOKAFE brand logo and design system compliance
    - Create `frontend/public/logo-vokafe.svg` (infinity/coffee-cup icon in Magenta with VOKAFE wordmark in Magenta-to-Purple gradient)
    - Place logo at top of Admin Dashboard sidebar
    - Place logo in Customer App login header and compact icon in authenticated top nav
    - Verify all color tokens match design system: backgrounds (#FFFFFF, #F3F4F6), text (#1E293B, #475569), occupied (#D81B60), available (#F3F4F6 + #E5E7EB border)
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10, 18.11, 18.12_

  - [x] 12.2 Implement Admin Dashboard sidebar navigation
    - Update `frontend/src/components/Sidebar.tsx`
    - Fixed 240px left sidebar with navigation: Dashboard, Orders, Tablespace, Inventory, Analytics
    - VOKAFE brand logo at top
    - Active state highlighting
    - _Requirements: 6.5, 18.6, 18.10_

  - [x] 12.3 Wire all Admin Dashboard views together
    - Update `frontend/src/App.tsx` to route between all admin views (Dashboard, Orders, Tablespace, Inventory, Analytics)
    - Ensure all views are accessible from sidebar navigation
    - Verify real-time seat updates work across Tablespace view
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 12.4 Wire Customer App routing and navigation
    - Set up routing between Menu, Tables, Cart, Account tabs
    - Ensure bottom navigation state persists across tab switches
    - Verify WebSocket connection shared across views
    - _Requirements: 17.1, 17.3_

- [x] 13. Firmware enhancements
  - [x] 13.1 Enhance firmware with debounce, fault detection, and MQTT retry
    - Update `firmware/voka_seat_node.ino`
    - Add 200ms debounce threshold for occupied detection (HIGH must persist 200ms)
    - Add sensor fault detection: flag if unchanged state > 60 minutes
    - Add MQTT publish retry (3 attempts, 2-second interval)
    - Add WiFi reconnect at 5-second intervals; discard telemetry during disconnection
    - Transmit current state on reconnection for sync
    - Initialize status to 0 and begin polling within 2000ms of power-on
    - _Requirements: 1.2, 1.3, 1.6, 1.7, 1.8, 2.1, 2.2, 2.5, 2.6, 2.7, 2.8_

- [x] 14. Final checkpoint - Full system integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Customer App refactor — Material Design 3 tokens and architecture migration
  - [x] 15.1 Set up customer app architecture and MD3 theme
    - Create the directory structure under `frontend/src/customer/`: auth/, views/, components/, theme/, hooks/
    - Create `frontend/src/customer/theme/tokens.ts` exporting the full Customer_MD3_Tokens color set, Customer_Typography (Lexend headlines + Inter body/labels), Customer_Border_Radius, Customer_Spacing_Scale
    - Update `frontend/tailwind.config.js` with an extended theme that includes the MD3 tokens (primary #b80035, primary-container #e11d48, secondary-container #6cf8bb, on-secondary-container #00714d, surface #fbf8fc, surface-container-lowest #ffffff, surface-container #f0edf1, surface-bright #fbf8fc, surface-variant #e4e1e6, on-surface #1b1b1e, on-surface-variant #5c3f40, outline-variant #e5bdbe, error #ba1a1a, error-container #ffdad6, on-error-container #93000a, etc.), the typography scale, the border-radius scale, and the spacing scale (xs/sm/md/lg/xl + margin-mobile/margin-tablet)
    - Add Material Symbols Outlined and Lexend + Inter Google Fonts links to `frontend/index.html`
    - _Requirements: 18.2, 18.13, 18.14, 18.15, 18.16_

  - [x] 15.2 Create CustomerSeatIndicator component with mint-green available state
    - Create `frontend/src/customer/components/CustomerSeatIndicator.tsx`
    - Occupied (status=1): bg #D81B60 (primary), white text — same as admin
    - Available (status=0): bg #6cf8bb (secondary-container), text #00714d (on-secondary-container), no border
    - Display seat number; apply active:scale-95 tactile feedback
    - This is distinct from the existing `frontend/src/components/SeatIndicator.tsx` used by the Admin Dashboard
    - _Requirements: 11.5, 18.4, 18.18_

  - [ ]* 15.3 Write property test for customer seat indicator color mapping (Property 18)
    - **Property 18: Customer App Available-Seat Color Mapping**
    - Use fast-check to generate random seat status values
    - Verify: status=0 → bg #6cf8bb + text #00714d (no border); status=1 → bg #D81B60 + white text
    - **Validates: Requirements 11.5, 18.4**

  - [x] 15.4 Migrate existing Customer App views into `frontend/src/customer/views/`
    - Move/rename existing customer pages (MenuView, TablesView, CartView, AccountView) under `frontend/src/customer/views/`
    - Rename AccountView → ProfileView (and update imports)
    - Update existing TablesView to use CustomerSeatIndicator instead of the admin SeatIndicator
    - Update Cart and Menu to use the MD3 token classes (bg-surface-container-lowest, text-on-surface, etc.) and Material Symbols Outlined icons
    - _Requirements: 11.5, 13.4, 13.7, 17.1_

- [x] 16. Customer App — persistent chrome and refactored navigation
  - [x] 16.1 Implement Customer Top App Bar
    - Create `frontend/src/customer/components/TopAppBar.tsx`
    - 64px height, bg-surface, sticky top
    - VOKAFE logo on the left (32px height), Material Symbols Outlined "search" icon button on the right
    - Hidden when unauthenticated
    - _Requirements: 13.13, 13.14, 18.11_

  - [x] 16.2 Refactor BottomNav to MD3 style with Profile tab
    - Update `frontend/src/customer/components/BottomNav.tsx` (or move from existing components/BottomNav.tsx)
    - Four tabs left-to-right: Menu (home icon), Tables (grid_view icon), Cart (shopping_cart icon), Profile (person icon)
    - Active tab: bg-primary-container (#e11d48), text on-primary-container (#fffaf9), pill shape
    - Inactive tabs: text on-surface-variant (#5c3f40)
    - Material Symbols Outlined icons
    - active:scale-90 feedback
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 16.3 Implement Cart Summary Bar
    - Create `frontend/src/customer/components/CartSummaryBar.tsx`
    - Sticky above the bottom nav, only visible on Menu tab when cart count ≥ 1
    - Left: item count text (e.g. "2 items") + IDR total below in primary color, bold
    - Right: primary "View Cart" button with rounded-xl and glow shadow per design system
    - Tap "View Cart" → switch to Cart tab within 300ms
    - _Requirements: 17.8, 17.9, 17.10, 17.11_

  - [x] 16.4 Create CustomerApp shell with auth gate
    - Create `frontend/src/customer/CustomerApp.tsx` as the new root
    - Show Login/Register screens when unauthenticated; show TopAppBar + bottom nav + active view when authenticated
    - Wire routing between Menu, Tables, Cart, Profile and overlay screens (Checkout, PaymentSuccess, OrderHistory, OrderDetail)
    - _Requirements: 13.4, 13.13, 13.14, 17.5_

- [x] 17. Customer App — Login and Register screens
  - [x] 17.1 Implement Login screen per visual spec
    - Create `frontend/src/customer/auth/LoginScreen.tsx`
    - Centered white card on bg-surface, rounded-xl, shadow `0 8px 24px rgba(0,0,0,0.08)`
    - VOKAFE logo at top of card
    - Headline "Welcome Back" (font-headline-md), subline "Please enter your details to sign in." (font-body-md, on-surface-variant)
    - NIM input with leading "mail" Material Symbol icon, password input with leading "lock" Material Symbol icon
    - bg-surface-bright field background, outline-variant border, h-12 fields
    - Primary "Login" button (full width, rounded-xl, glow shadow)
    - Footer: "Don't have an account? Sign Up" link in primary color
    - _Requirements: 13.1, 13.2, 13.3, 20.1, 20.2, 20.3, 20.4, 20.5, 20.11_

  - [x] 17.2 Implement Register screen per visual spec
    - Create `frontend/src/customer/auth/RegisterScreen.tsx`
    - Mirror Login layout: centered card, VOKAFE logo, headline "Create Account"
    - Four fields with leading icons: full name (person), NIM (mail), password (lock), password confirmation (lock_reset)
    - Client-side validation: NIM 8–12 digits, password ≥ 8 chars, password matches confirmation
    - Submit calls POST /api/auth/register
    - On NIM-already-exists error: inline error on NIM field
    - On success: auto-login and navigate to Menu within 3 seconds
    - Footer: "Already have an account? Login here" link
    - _Requirements: 13.8, 13.9, 13.10, 13.11, 13.12, 20.6, 20.7, 20.8, 20.9, 20.10, 20.12_

  - [x] 17.3 Implement useAuth hook
    - Create `frontend/src/customer/auth/useAuth.ts`
    - Manage authenticated state, JWT token in localStorage, login/register/logout actions
    - Expose isAuthenticated, user, login, register, logout
    - _Requirements: 13.1, 13.11, 13.12_

- [x] 18. Customer App — Tables view enhancements and ordering flow
  - [x] 18.1 Add Indoor/Outdoor toggle, legend, and QR FAB to Tables view
    - Update `frontend/src/customer/views/TablesView.tsx`
    - Create `frontend/src/customer/components/IndoorOutdoorToggle.tsx` (segmented toggle, surface-container background, indoor active by default)
    - Create `frontend/src/customer/components/SeatLegend.tsx` (Available mint swatch, Occupied magenta swatch)
    - Create `frontend/src/customer/components/ScanQrFab.tsx` (56×56 bottom-right above bottom nav, bg-primary, qr_code_scanner icon, glow shadow)
    - Outdoor toggle shows "Coming Soon" placeholder card; QR FAB tap shows "Coming soon" toast
    - Tables layout still matches the Admin Dashboard Floor Plan Reference (3 zones, tribune row structure, vertical strip, Meja Beton 2×3 grid with sensor positions)
    - _Requirements: 11.1, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13_

  - [x] 18.2 Implement Checkout view with payment method selection
    - Create `frontend/src/customer/views/CheckoutView.tsx`
    - Display cart summary (read-only)
    - Show selectable payment method options: e-wallet, bank transfer, cash on pickup
    - "Pay Now" button disabled until a method is selected
    - On payment confirmation: submit order to backend
    - _Requirements: 12.3, 12.11_

  - [x] 18.3 Implement Payment Success screen
    - Create `frontend/src/customer/views/PaymentSuccessView.tsx`
    - Display order number, items summary (item name and quantity), total paid in IDR with thousands separator
    - Two primary buttons: "View Order Status" (navigate to OrderDetail), "Back to Menu" (navigate to Menu and clear cart)
    - Use check_circle Material Symbol as the success icon
    - _Requirements: 12.5, 12.8, 12.9, 12.10_

- [x] 19. Customer App — Order history detail and pill, OrderStatusHistory backend support
  - [x] 19.1 Add OrderStatusHistory model and backend support
    - Update `backend/prisma/schema.prisma` to add the OrderStatusHistory model with id, orderId (FK), status, changedAt
    - Add the relation field `statusHistory OrderStatusHistory[]` on the Order model
    - Run prisma generate and create migration
    - Update `backend/src/services/orderService.ts` to insert an OrderStatusHistory record whenever an order's status changes
    - Add GET `/api/orders/:id` route returning the order with items, statusHistory, and assigned seat
    - _Requirements: 14.7, 19.4_

  - [x] 19.2 Implement OrderStatusPill component with color mapping
    - Create `frontend/src/customer/components/OrderStatusPill.tsx`
    - Map: pending → amber bg + dark amber text; preparing → primary + white; ready → tertiary (#006855) + white; completed → secondary-container (#6cf8bb) + on-secondary-container (#00714d); cancelled → error-container (#ffdad6) + on-error-container (#93000a)
    - Pill shape (rounded-full) with px-3 py-1
    - _Requirements: 19.2_

  - [x] 19.3 Implement OrderHistoryView with empty state
    - Create `frontend/src/customer/views/OrderHistoryView.tsx`
    - Fetch GET /api/orders/history (paginated 20 per page, most recent first)
    - Each card: order date+time, items summary (comma-separated), total IDR, OrderStatusPill
    - Tap card navigates to OrderDetailView
    - Empty state: illustration placeholder, "No orders yet", "Browse Menu" CTA navigates to Menu within 300ms
    - _Requirements: 13.5, 13.6, 19.1, 19.6, 19.7, 19.8_

  - [x] 19.4 Implement OrderDetailView with status timeline
    - Create `frontend/src/customer/views/OrderDetailView.tsx`
    - Fetch GET /api/orders/:id
    - Display order number, full item list with quantity and unit price, subtotal, total (IDR with thousands separator)
    - Show assigned seat number, or "No seat assigned" placeholder when seatId is null
    - Show status timeline (chronological list of statusHistory entries with timestamp)
    - Use OrderStatusPill for current status
    - _Requirements: 19.3, 19.4, 19.5_

  - [x] 19.5 Implement ProfileView pointing to OrderHistoryView
    - Update `frontend/src/customer/views/ProfileView.tsx` (renamed from AccountView)
    - Display authenticated user's name and NIM
    - Navigation entry to Order History
    - Logout action that calls useAuth.logout
    - _Requirements: 13.4, 13.7_

- [x] 20. Deployment infrastructure — port-safe Docker compose and nginx server block
  - This section addresses co-tenancy on a shared cloud instance where another project already binds host ports `1883`, `9001:9001`, `5433:5432`, and `8080:8080`. VOKA-SEAT MUST NOT bind any of those host ports. Internal container ports may stay on conventional defaults (1883 mosquitto, 9001 mosquitto websockets, 5432 postgres, 3000 backend) since they live inside the docker network — only the host-side mapping changes.
  - [x] 20.1 Author port-safe `docker-compose.yml` for VOKA-SEAT services
    - Create `deploy/docker-compose.yml` (or update existing) covering: `mosquitto`, `postgres`, `backend`, and `frontend` (nginx static-serve) services on a private bridge network `voka_seat_net`.
    - Mosquitto: do **not** publish 1883 on the host. Use `expose: ["1884"]` internally for the broker if needed by external bridges, but prefer keeping the broker inside the network. WebSocket listener internal port stays 9001 but published as `9002:9001` (avoids the existing `9001:9001` binding).
    - Postgres: publish as `5434:5432` (avoids `5433:5432`). Use `voka_seat_db` database name and a dedicated `voka_seat_pg_data` named volume.
    - Backend (Node.js Express): listen on container port 3000, publish as `3100:3000`. Pass env `DATABASE_URL=postgresql://voka:${POSTGRES_PASSWORD}@postgres:5432/voka_seat_db`, `MQTT_URL=mqtt://mosquitto:1883`, `JWT_SECRET=${JWT_SECRET}`, `CORS_ORIGIN=https://voka-seat.example.com`.
    - Frontend (admin + customer Vite build) served by an nginx container on container port 80, publish as `8090:80` (avoids `8080:8080`). Mount `/usr/share/nginx/html` from the built `frontend/dist` directory.
    - Add explicit `restart: unless-stopped`, `healthcheck` blocks, and `depends_on` ordering: `postgres` → `backend`, `mosquitto` → `backend`, `backend` → `frontend`.
    - Document required `.env` keys in `deploy/.env.example`: `POSTGRES_PASSWORD`, `JWT_SECRET`, `PUBLIC_DOMAIN`.
    - **Verifiable artefact:** the resulting compose file must show the host-port table — Mosquitto MQTT: not published (or `1884:1883`), Mosquitto WS: `9002:9001`, Postgres: `5434:5432`, Backend HTTP: `3100:3000`, Frontend HTTP: `8090:80`.
    - _Requirements: deployment, network isolation_

  - [x] 20.2 Author host-side nginx server block for `voka-seat.<domain>`
    - Create `deploy/nginx/voka-seat.conf` as a server block intended for the **host-level** nginx reverse proxy that already terminates TLS for the shared instance (i.e. not the in-container nginx).
    - Listen on `443 ssl http2` and `80` (with redirect to https) for `server_name voka-seat.example.com;` (the actual domain is configurable; leave a placeholder).
    - Reference Let's Encrypt certs at `/etc/letsencrypt/live/voka-seat.example.com/fullchain.pem` and `/privkey.pem` plus `include /etc/letsencrypt/options-ssl-nginx.conf;` and `ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;`.
    - `location /` → `proxy_pass http://127.0.0.1:8090;` (frontend container) with the standard `proxy_set_header Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` headers.
    - `location /api/` → `proxy_pass http://127.0.0.1:3100;` (backend container) with the same headers; `proxy_read_timeout 60s`.
    - `location /socket.io/` → `proxy_pass http://127.0.0.1:3100;` with `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_read_timeout 3600s;` to keep WebSocket sessions alive.
    - Add `client_max_body_size 2m;` (telemetry payloads are tiny but allow headroom for menu image uploads).
    - Add a security header bundle: `add_header X-Frame-Options DENY;`, `X-Content-Type-Options nosniff;`, `Referrer-Policy strict-origin-when-cross-origin;`, `Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`.
    - Provide a CLI checklist (no Winbox, per AGENTS.md §3 blue rules) for installing the file: `sudo ln -s /opt/voka-seat/deploy/nginx/voka-seat.conf /etc/nginx/sites-enabled/voka-seat.conf`, `sudo nginx -t`, `sudo systemctl reload nginx`.
    - **Verifiable artefact:** the resulting `voka-seat.conf` plus a short README snippet showing the upstream port mapping (`127.0.0.1:8090` frontend, `127.0.0.1:3100` backend, `127.0.0.1:3100/socket.io`).
    - _Requirements: deployment, TLS, WebSocket upgrade_

  - [x] 20.3 Document the firmware MQTT endpoint for the shared host
    - Update `firmware/voka_seat_node.ino` config block (or a new `firmware/CONFIG.md`) so ESP32 nodes target the broker on the cloud host's correct host-side port. If the broker is published as `1884:1883`, the firmware connects to `cloud.example.com:1884`. If the broker stays unpublished, document the MikroTik NAT mapping required (per AGENTS.md §3 blue rules: CLI only, no Winbox).
    - Re-state the AGENTS.md §3 red rules in a comment header: PIR HC-SR501 only, 30–45° downward tilt, 10-minute vacant timeout, 200ms debounce.
    - _Requirements: deployment, firmware-to-cloud routing_

- [x] 21. Auth model rewrite — email-keyed customers + optional auth + admin gate
  - This section implements the requirement/design changes around auth scope reduction. All sub-tasks are required (no `*` optional ones for this round). Order is critical because the Prisma schema change cascades.
  - [x] 21.1 Backend — Prisma schema migration: User PK email + AdminUser + nullable userEmail on Order
    - Update `backend/prisma/schema.prisma`:
      - Replace User: `email String @id @db.VarChar(254)`, drop nim. Keep name/passwordHash/createdAt/updatedAt and the orders relation.
      - Add new model `AdminUser` with username (PK, max 64), passwordHash (max 255), createdAt.
      - Update Order: rename `userNim` → `userEmail` (String?, max 254, nullable). Change relation to `user User? @relation(fields: [userEmail], references: [email], onDelete: SetNull)`.
    - Update `backend/prisma.config.ts` if needed.
    - Generate a Prisma migration `20260518_email_user_and_admin` that creates the new schema. For preview convenience, the migration can drop the old User table data (since it was previously NIM-keyed and we have no production data yet).
    - Run `npx prisma generate` to refresh the Prisma client types.
    - _Requirements: 14.1, 14.2, 14.3, 14.7, 14.8, 15.9_

  - [x] 21.2 Backend — Email validator (replaces NIM validator)
    - Create `backend/src/validators/emailValidator.ts` with `validateEmail(input: string): { valid: boolean; error?: string }` using `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` and a max length of 254.
    - Optionally delete or stub `backend/src/validators/nimValidator.ts` so it returns a deprecation export pointing at the email validator (keeps any stale imports compiling). Update all callers to use the new validator.
    - _Requirements: 13.6, 14.1_

  - [x] 21.3 Backend — Property test for email validation (Property 12, replaces NIM PBT)
    - Update or create `backend/tests/properties/emailValidator.property.test.ts`
    - Use fast-check generators: well-formed emails (mix of unicode local parts), malformed strings (no @, no dot, leading/trailing whitespace), edge lengths (0, 1, 254, 255 chars), random unicode garbage.
    - Verify the validator accepts iff regex matches AND length ≤ 254.
    - Delete or update the legacy NIM validator property test so it does not fail.
    - _Requirements: 13.6, 14.1; **Validates: Property 12 (Email Format Validation)**_

  - [x] 21.4 Backend — Customer auth refactor: email-based login + register, role=customer JWT
    - Update `backend/src/routes/auth.ts`:
      - `POST /api/auth/register` — body `{ email, name, password }`. Validate email via emailValidator, length and password ≥ 8 chars. Reject 409 on duplicate email. Hash password with bcrypt (cost ≥ 10). Sign JWT with `{ email, role: 'customer' }`.
      - `POST /api/auth/login` — body `{ email, password }`. Verify against User table. On match, sign JWT with `{ email, role: 'customer' }`. Generic 401 on failure (never reveal which field is wrong).
    - Update existing `backend/src/middleware/auth.ts` (customer middleware) to extract `email` from the JWT instead of `nim`. Reject if `role !== 'customer'` for routes that require customer identity.
    - Update unit tests at `backend/tests/unit/auth.test.ts` (or wherever they live) for the new email-based shape.
    - _Requirements: 13.4, 13.6, 13.9, 13.11, 13.12, 13.13, 15.7_

  - [x] 21.5 Backend — Admin auth: seeded AdminUser, dedicated endpoint, role=admin guard
    - Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` to `.env` and `.env.example`. Defaults for preview: `admin` / `vokafe-admin-2026`.
    - Create `backend/src/services/adminSeed.ts` exporting `seedAdminAccount(prisma): Promise<void>`. On startup, read env vars, hash password with bcrypt cost ≥ 10, upsert into AdminUser table.
    - Wire `seedAdminAccount(prisma)` into `backend/src/server.ts` after Prisma is ready.
    - Create `backend/src/routes/adminAuth.ts` with `POST /api/auth/admin/login`. Body `{ username, password }`. Match against AdminUser. Sign JWT with `{ username, role: 'admin' }`. Generic 401 on mismatch.
    - Mount this router at `/api/auth/admin` in server.ts.
    - Create `backend/src/middleware/adminAuth.ts` — extracts JWT, returns 401 if missing/invalid, returns 403 if `role !== 'admin'`. Apply to existing admin-scoped routes (orders pending/assign-seat/status, inventory, analytics).
    - _Requirements: 15.7, 15.8, 15.9, 21.2, 21.3, 21.6, 21.7, 21.8_

  - [x] 21.6 Backend — POST /api/orders accepts optional auth + Guest_Order
    - Update `backend/src/routes/orders.ts`:
      - `POST /api/orders` — try to read JWT from Authorization header but DO NOT reject if missing/invalid/expired. Only the body is required.
      - If JWT is valid AND `role: 'customer'`: persist Order with `userEmail = jwt.email`.
      - Otherwise: persist Order with `userEmail = null` (Guest_Order).
    - Add `PATCH /api/orders/:id/claim` (Customer JWT required) that sets `userEmail = jwt.email` ONLY when the row's `userEmail` is currently NULL. Return 404 if order not found, 409 if already claimed.
    - _Requirements: 12.5, 12.6, 12.13, 14.8_

  - [x] 21.7 Backend — Property tests for admin role authorization (P19) and optional auth on order creation (P20)
    - Add `backend/tests/properties/adminRoleAuthorization.property.test.ts` and `backend/tests/properties/optionalAuthOnOrderCreation.property.test.ts` (these are integration-style PBTs over a small in-memory backend stub).
    - _Requirements: 15.7, 15.8, 21.6, 12.5, 12.6, 14.8; **Validates: Properties 19, 20**_

  - [x] 21.8 Frontend (customer) — useAuth refactor: email-based login + register, optional state
    - Update `frontend/src/customer/auth/useAuth.ts`:
      - Storage key remains `vokafe_customer_jwt` (rename from any prior key if necessary).
      - `login(email, password)` calls POST `/api/auth/login` with email body. Persist JWT.
      - `register(email, name, password)` calls POST `/api/auth/register`. Persist JWT (auto-login).
      - Expose `isAuthenticated`, `user: { email, name } | null`, `login`, `register`, `logout`.
    - Update `frontend/tests/unit/useAuth.test.tsx` to use email instead of NIM.
    - _Requirements: 13.4, 13.6, 13.7, 13.8, 13.9, 13.13, 13.16_

  - [x] 21.9 Frontend (customer) — Login + Register screens use email
    - Update `frontend/src/customer/auth/LoginScreen.tsx`:
      - First field labeled "Email", `type="email"`, `inputMode="email"`, leading `mail` icon.
      - Validate against `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` client-side.
    - Update `frontend/src/customer/auth/RegisterScreen.tsx`:
      - Field order: email (mail) → full name (person) → password (lock) → password confirmation (lock_reset).
      - Email format validation client-side; duplicate-email error from 409 surfaces inline on email field.
    - Update tests `frontend/tests/unit/LoginScreen.test.tsx` and `RegisterScreen.test.tsx` for the new field shape.
    - _Requirements: 13.4, 13.6, 13.9, 13.11, 13.12, 20.3, 20.8_

  - [x] 21.10 Frontend (customer) — Remove auth gate; Profile guest CTA
    - Update `frontend/src/customer/CustomerApp.tsx`:
      - Remove the auth gate. Render TopAppBar + main + BottomNav for ALL users.
      - When unauthenticated and Profile tab is active, render a guest-state Profile (logo + "Sign In or Create Account" CTA).
      - When authenticated and Profile tab is active, render the existing ProfileView (name + email + Order History entry + Logout).
      - Keep all overlay screens (Checkout, PaymentSuccess, OrderHistory, OrderDetail) reachable as before but ensure OrderHistory and OrderDetail are only mounted when `useAuth().isAuthenticated`.
    - Update `frontend/src/customer/views/ProfileView.tsx`:
      - Take a new `onSignIn: () => void` prop. When unauthenticated, render a centered card with the VOKAFE logo and a single primary "Sign In or Create Account" button that calls `onSignIn`.
      - When authenticated, render the existing name/email/order-history/logout layout but display `user.email` (not user.nim).
    - Update tests `frontend/tests/unit/CustomerApp.test.tsx` and `ProfileView.test.tsx` for the new optional-auth flow.
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.7, 13.14, 13.15, 17.5, 19.1_

  - [x] 21.11 Frontend (customer) — Optional auth on Checkout + Save Order to Account on Payment Success
    - Update `frontend/src/customer/views/CheckoutView.tsx`:
      - Use `useAuth()` to read the JWT. If present, attach `Authorization: Bearer <jwt>`; if absent, omit the header. Submit the order regardless of auth state.
    - Update `frontend/src/customer/views/PaymentSuccessView.tsx`:
      - Add an optional secondary CTA "Save Order to Account" that is rendered ONLY when the order was placed in guest mode (caller passes `wasGuestCheckout: true`).
      - Tap navigates to the LoginScreen via a parent-supplied callback.
      - After login/register success, the parent calls `PATCH /api/orders/:id/claim`.
    - Update tests `frontend/tests/unit/CheckoutView.test.tsx` and `PaymentSuccessView.test.tsx`.
    - _Requirements: 12.5, 12.6, 12.13, 12.14_

  - [x] 21.12 Frontend (admin) — Admin auth gate: AdminLoginScreen + useAdminAuth + AdminAppShell
    - Create `frontend/src/admin/auth/useAdminAuth.ts` (storage key `vokafe_admin_jwt`; expose `login(username, password)`, `logout()`, `isAuthenticated`, `token`).
    - Create `frontend/src/admin/auth/AdminLoginScreen.tsx` (centered card with VOKAFE logo, username input, password input, "Sign In" submit button, generic "Invalid credentials" inline error on 401).
    - Create `frontend/src/admin/AdminAppShell.tsx` that wraps the existing `App.tsx`. When no JWT, render `<AdminLoginScreen />`. Otherwise render the existing admin app.
    - Update `frontend/src/main.tsx` so that the default `/` route renders `AdminAppShell` (instead of the bare `App.tsx`). Keep `/customer` rendering `CustomerApp`.
    - Add an `adminFetch` helper at `frontend/src/admin/adminFetch.ts` that wraps `fetch` and attaches `Authorization: Bearer <vokafe_admin_jwt>`. Wire all existing admin API call sites in `App.tsx` (and any sub-views) to use it.
    - Add a "Logout" button to `frontend/src/components/Sidebar.tsx` that calls `useAdminAuth().logout()`.
    - Add `frontend/tests/unit/AdminLoginScreen.test.tsx` and `frontend/tests/unit/useAdminAuth.test.ts`.
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

  - [x] 21.13 Preview reset — refresh local DB schema and seed
    - Wipe and recreate the preview Postgres schema using `prisma db push` (or `migrate reset` if migrations are enabled). Re-seed the 24 seats. Re-seed the 8 sample menu items. Re-seed the 7 inventory rows.
    - Confirm AdminUser is auto-seeded by the backend on boot from `ADMIN_USERNAME=admin` / `ADMIN_PASSWORD=vokafe-admin-2026`.
    - Restart the backend and frontend dev servers.
    - Smoke-test:
      - GET `/api/health` returns 200
      - GET `/api/seats` returns 24 seats
      - POST `/api/orders` with no auth header succeeds and returns an order with `userEmail = null`
      - POST `/api/auth/admin/login` with admin/vokafe-admin-2026 returns a JWT with role=admin
      - GET `/api/orders/pending` with that JWT returns 200; with a customer JWT returns 403; with no JWT returns 401
    - _Requirements: 14.1, 14.7, 14.8, 15.9, 21.7_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The firmware task (13.1) is C/C++ Arduino code; all other tasks use TypeScript
- The existing Tablespace.tsx and OrderQueue.tsx components will be refactored rather than rewritten from scratch
- Backend uses Vitest + fast-check; Frontend uses Vitest + React Testing Library + fast-check
- Network infrastructure (Requirement 3) is MikroTik CLI configuration and not implementable as code tasks
- Tasks 15–19 add the customer-app MD3 redesign and were not part of the original implementation. They preserve admin dashboard styling unchanged.
- Tasks 15.4 (move existing customer pages) requires careful refactoring; verify imports across App.tsx and tests.
- Section 21 implements the auth model rewrite: NIM→email for customers, optional customer auth, separate admin endpoint with seeded admin (`ADMIN_USERNAME`/`ADMIN_PASSWORD` from .env), admin-only routes protected by role guard, admin dashboard wrapped in auth gate. Preview reset is a separate sub-task at the end.
- Default admin credentials for preview: `username=admin` / `password=vokafe-admin-2026`. Change `ADMIN_USERNAME`/`ADMIN_PASSWORD` in `backend/.env` before any non-preview deployment.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "7.1"] },
    { "id": 2, "tasks": ["2.1", "2.3", "3.5"] },
    { "id": 3, "tasks": ["2.2", "2.4", "3.6", "3.3"] },
    { "id": 4, "tasks": ["2.5", "3.1", "3.4"] },
    { "id": 5, "tasks": ["3.2", "5.1", "5.2", "5.3"] },
    { "id": 6, "tasks": ["5.4", "5.6", "5.7"] },
    { "id": 7, "tasks": ["5.5", "5.8", "5.9"] },
    { "id": 8, "tasks": ["7.2", "13.1"] },
    { "id": 9, "tasks": ["7.3", "7.4", "7.5"] },
    { "id": 10, "tasks": ["8.1", "8.4", "8.6", "8.8"] },
    { "id": 11, "tasks": ["8.2", "8.3", "8.5", "8.7"] },
    { "id": 12, "tasks": ["10.1", "10.3", "10.4", "10.5", "10.8"] },
    { "id": 13, "tasks": ["10.2", "10.6", "10.7"] },
    { "id": 14, "tasks": ["12.1", "12.2"] },
    { "id": 15, "tasks": ["12.3", "12.4"] },
    { "id": 16, "tasks": ["15.1", "19.1"] },
    { "id": 17, "tasks": ["15.2", "16.1", "16.2", "16.3", "17.3", "19.2"] },
    { "id": 18, "tasks": ["15.3", "15.4", "16.4", "17.1", "17.2", "18.1", "18.2", "18.3", "19.3", "19.5"] },
    { "id": 19, "tasks": ["19.4"] },
    { "id": 20, "tasks": ["20.1"] },
    { "id": 21, "tasks": ["20.2", "20.3"] },
    { "id": 22, "tasks": ["21.1"] },
    { "id": 23, "tasks": ["21.2"] },
    { "id": 24, "tasks": ["21.3", "21.4", "21.5", "21.6", "21.8"] },
    { "id": 25, "tasks": ["21.7", "21.9", "21.10", "21.12"] },
    { "id": 26, "tasks": ["21.11"] },
    { "id": 27, "tasks": ["21.13"] }
  ]
}
```
