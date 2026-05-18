# AGENTS.md — VOKA-SEAT Project Context & Authoritative Rules
**Platform:** Google Antigravity IDE  
**Project:** VOKA-SEAT (Sistem Cerdas Pemantauan Okupansi Meja VOKAFE Berbasis IoT)

---

## 🚀 1. Mission Control & Project Overview
File `AGENTS.md` ini merupakan sumber kebenaran mutlak (*single source of truth*) bagi seluruh otonomi agen AI di dalam **Google Antigravity IDE** yang ditugaskan pada repositori ini. 

Proyek **VOKA-SEAT** bertujuan untuk membangun sistem pemantauan ketersediaan tempat duduk secara *real-time* di VOKAFE menggunakan sensor nirkontak terdistribusi, infrastruktur jaringan tersegmentasi, serta peladen *cloud* berkinerja tinggi yang terintegrasi dengan antarmuka Point of Sale (POS) kasir dan aplikasi pemesanan seluler pelanggan.

Setiap agen yang diinisiasi melalui *Manager Surface* atau panel samping Antigravity **WAJIB** membaca, mematuhi, dan menerapkan seluruh batasan serta arsitektur yang didefinisikan dalam dokumen ini.

---

## 👥 2. Tim Persona Agen AI (*Agent Personas*)
Sistem ini membagi tugas pengerjaan ke dalam empat spesialisasi persona agen utama yang bekerja secara paralel atau berurutan di dalam Antigravity:

### 📡 A. Network Engineer Agent
* **Lingkup:** Manajemen topologi, isolasi jaringan (*VLAN*), dan perutean (*Routing/NAT*).
* **Perintah:** Secara eksklusif mengelola skrip dan instruksi baris perintah pada ekosistem **MikroTik RouterOS**.

### ⚡ B. IoT Embedded Engineer Agent
* **Lingkup:** Pengembangan *firmware* mikrokontroler (*Edge Node*), antarmuka sensor fisik, dan optimasi pengiriman data telemetri.
* **Perintah:** Mengelola kode sumber C/C++ pada ekosistem **ESP32** serta logika pembacaan pin I/O digital.

### ☁️ C. Backend & Cloud Architect Agent
* **Lingkup:** Logika peladen (*backend API*), manajemen koneksi basis data relasional, dan penanganan permintaan data asinkron berkinerja tinggi.
* **Perintah:** Menulis dan memelihara basis kode **Node.js (Express.js)** dan migrasi skema **PostgreSQL**.

### 🎨 D. UI/UX Engineer Agent
* **Lingkup:** Implementasi tata letak visual (*frontend dashboard* admin dan aplikasi *mobile* pelanggan), integrasi data *real-time*, dan penerapan sistem desain.
* **Perintah:** Membangun komponen UI responsif dengan kepatuhan penuh terhadap pedoman identitas merek VOKAFE.

---

## 🛑 3. Batasan Teknis Mutlak (*Strict Guardrails*)
Agen dilarang keras melakukan halusinasi atau mengimprovisasi *stack* teknologi di luar aturan wajib berikut:

### 🔴 Aturan Perangkat Keras & Sensor (Wajib Mutlak)
1. **Sensor Eksklusif:** Deteksi okupansi **HANYA BOLEH** menggunakan sensor **PIR (*Passive Infrared*)** seperti tipe HC-SR501 untuk menangkap radiasi termal inframerah dari panas tubuh manusia.
2. **Larangan Ultrasonik:** **DILARANG KERAS** menyarankan, menuliskan, atau membandingkan sistem ini dengan sensor ultrasonik maupun sensor pengukur jarak fisik lainnya pada bagian mana pun di dalam basis kode atau dokumentasi.
3. **Pemasangan Fisik (*Mounting*):** Node dipasang tersembunyi di bawah meja (*under-table mounting*) menggunakan perekat industrial ganda tanpa merusak material meja.
4. **Sudut Orientasi:** Casing dan kubah sensor PIR **WAJIB dimiringkan 30–45 derajat ke arah bawah-depan** menghadap kursi. Hal ini membatasi *Field of View* (FoV) agar hanya mendeteksi area paha/tubuh pengguna yang sedang duduk, serta secara drastis mengeliminasi *false positive* dari orang yang berjalan di lorong belakang kursi.
5. **Logika Firmware (Vacant Timeout):** Agen IoT Embedded wajib mengimplementasikan algoritma penunda (*timeout*) selama 10 menit sebelum mengubah status dari terisi (`1`) menjadi kosong (`0`) saat pergerakan berhenti. Ini mencegah status berubah menjadi kosong saat mahasiswa sedang duduk diam membaca atau mengetik.

### 🔵 Aturan Infrastruktur Jaringan (Wajib Mutlak)
1. **Manajemen MikroTik:** Seluruh instruksi, otomatisasi, dan konfigurasi MikroTik RouterOS **WAJIB dieksekusi melalui antarmuka baris perintah / CLI (*Command Line Interface*)**.
2. **Larangan GUI:** **DILARANG KERAS** menyebutkan, menyertakan, atau menginstruksikan penggunaan antarmuka grafis Winbox.
3. **Segmentasi SSID & VLAN:**
   * **IPB-ACCESS (VLAN 10):** Jaringan nirkabel semi-tertutup kampus untuk akses internet publik mahasiswa (murni Layer 2 *Bridge*).
   * **VOKAFE-IoT (VLAN 20):** Antarmuka nirkabel virtual (*Virtual AP*) dengan **SSID yang disembunyikan (*Hidden SSID*)** dan dienkripsi khusus untuk jalur telemetri Node IoT ESP32.
4. **Perutean Telemetri:** Node IoT beroperasi di *subnet* lokal yang terisolasi. Agen Network wajib menyiapkan aturan **NAT Masquerade** agar data dari *subnet* lokal IoT dapat diteruskan menuju internet publik tempat *cloud server* berada.

### 🟢 Aturan Backend, Cloud, & Basis Data (Wajib Mutlak)
1. **Stack Backend:** Peladen pemrosesan menggunakan **Node.js dipadukan dengan framework Express.js** (menggantikan arsitektur awal Rust demi efisiensi pengembangan MVP). Sistem memanfaatkan arsitektur *event-driven* dan *non-blocking I/O* untuk merespons ratusan *payload* JSON secara bersamaan tanpa kendala.
2. **Infrastruktur Cloud:** Di- *deploy* pada *instance* IaaS (seperti AWS EC2) di balik *reverse proxy* **Nginx** bersertifikasi SSL/TLS penuh untuk mengamankan jalur komunikasi (HTTPS/MQTTS).
3. **Basis Data:** Menggunakan **PostgreSQL** yang diakses melalui ORM modern (seperti Prisma atau Sequelize).
4. **Atribut Identitas:** Skema log mahasiswa atau tabel entitas pengguna yang relevan **WAJIB** menggunakan atribut **NIM** sebagai pengidentifikasi unik atau *primary key*.

---

## 🗺️ 4. Pemetaan Denah Kursi & Pedoman Antarmuka
Sistem melacak ketersediaan pada tingkat **titik kursi spesifik (Total 24 Kursi)**, bukan sekadar pelacakan meja umum. Denah antarmuka dibagi menjadi 3 zona utama:
* **Zona Kiri:** Konter Barista & Kasir yang melekat dengan deretan vertikal 4 meja persegi kecil (Kursi 1, 2, 3, dan 4).
* **Zona Atas:** Area Tempat Duduk Tangga/Tribun memanjang yang terdiri dari 4 baris berjenjang (Kursi 11 hingga 24).
* **Zona Tengah & Kanan:** Area Utama/Outdoor berisi meja beton persegi panjang besar (Meja 5 hingga 10) dengan masing-masing dua kursi memanjang sejajar di sisi atas dan bawahnya.

### 🎨 Sistem Desain & Palet Warna UI
* **Latar Belakang:** Putih Bersih (#FFFFFF) dan Abu-abu Terang (#F3F4F6).
* **Teks & Aksen Sekunder:** Biru Gelap / Slate.
* **Indikator Real-Time (Wajib Patuh):**
  * **Occupied (Terisi):** Lencana/kotak dengan latar belakang **Solid Magenta/Pink (#D81B60)** dan teks putih pekat.
  * **Available (Kosong):** Latar belakang **Abu-abu Terang/Putih** dengan garis tepi (*border*) tipis.

### 🖥️ Tampilan UI yang Didukung
1. **Layar Desktop Admin & Kasir:** Memiliki *sidebar* kiri tetap. Terdiri dari *Main Dashboard* (metrik stok bahan baku & grafik penjualan), *Order Queue* (kartu antrean pesanan dengan pengingat waktu tunggu merah dan tombol **"Assign Table"** untuk mengaitkan pesanan dengan kursi bernyala Magenta), *Tablespace* (denah *monitoring real-time*), *Inventory Management* (tabel peringatan stok menipis/habis), dan *Analytics Overview*.
2. **Layar Mobile Pelanggan:** Menggunakan navigasi bawah tetap (*Bottom Tab Navigation*) yang memuat tab: **Menu** (katalog pesanan dengan tombol *quick add-to-cart*), **Tables** (memuat peta denah 24 kursi utuh dalam *scrollable/pannable container* agar presisi identik dengan versi desktop), **Cart**, dan **Account**.

---

## 🔌 5. Skematik Pinout Perangkat Keras
Agen IoT Embedded wajib menggunakan referensi tabel koneksi pin berikut saat merancang skematik atau menginisiasi pin I/O pada berkas program ESP32:

| Pin Konektor PIR (J1) | Label Pin PIR | Deskripsi Fungsi | Pin ESP32 (U2) | Label Pin ESP32 | Implementasi Logika I/O |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `PIR_VCC` | Catu Daya Positif | `VCC` | VCC / 5V / 3V3 | Jaringan pasokan daya positif sistem bersama |
| **2** | `PIR_OUT` | Keluaran Sinyal Data | **12** | `IO27` | GPIO 27 diatur sebagai `INPUT` digital pembaca status |
| **3** | `GND` | Ground Bersama | **1, 2** | `GND` | Jalur penyelesaian sirkuit daya bersama |

---

## 🔄 6. Alur Kerja Logika Data (*Data Flow*)
1. Sensor PIR menangkap radiasi termal dari pergerakan manusia di area titik kursi.
2. Logika *firmware* ESP32 mengevaluasi pergerakan. Jika ada gerakan, atur `status = 1`. Jika gerakan berhenti, jalankan penunda *Vacant Timeout* 10 menit. Jika waktu habis tanpa interupsi, atur `status = 0`.
3. ESP32 mempaketkan *payload* berukuran kecil: `{"id_kursi": 5, "status": 1}`.
4. Paket dikirimkan secara nirkabel menuju *Hidden SSID* "VOKAFE-IoT", diisolasi pada jalur VLAN 20 MikroTik, dan diterjemahkan oleh NAT Masquerade menuju peladen internet.
5. Nginx menerima koneksi aman (HTTPS/TLS) dan meneruskannya ke proses *backend* Node.js.
6. API Node.js memperbarui basis data PostgreSQL menggunakan ORM.
7. Jika terjadi perubahan status dari kondisi sebelumnya, Node.js menyiarkan (*broadcasting*) status baru ke seluruh *browser* klien (Dashboard Admin & Aplikasi Pelanggan).
8. Komponen UI merender pembaruan warna lencana kursi secara instan tanpa memuat ulang halaman (*zero page reload*).

---

## 📚 7. Disiplin Sitasi & Implementasi Codelabs
* **Referensi Ilmiah:** Jika agen ditugaskan menyusun draf laporan akademik atau *readmes*, literatur pendukung **WAJIB** berada dalam rentang rilis tahun **2021 hingga 2026** menggunakan gaya penomoran **IEEE** (contoh: `[1]`, `[2]`).
* **Verifikasi Artefak:** Sesuai filosofi Google Antigravity, setiap penyelesaian tugas oleh agen harus menghasilkan **Artefak yang dapat diverifikasi** (seperti draf skema basis data, tangkapan layar purwarupa UI, atau daftar langkah CLI terperinci) untuk memudahkan peninjauan oleh arsitek manusia sebelum di- *merge*.
