# Security Specification — MASHRO Customer Satisfaction Survey

## 1. Data Invariants
1. **Anonimitas Responden & Privasi Data**: Responden survei publik hanya boleh melakukan `create` pada `/survey_responses/{responseId}`. Tidak ada pengguna anonim yang boleh melakukan `get`, `list`, `update`, atau `delete` pada `/survey_responses`.
2. **Brankas Permanen Terkunci Server (`owner_vault/{vaultId}`)**: Backend Express yang diautentikasi PIN Admin (`MASHRO2026` / `process.env.ADMIN_PIN`) menggunakan `vaultId` kriptografis berbasis HMAC-SHA256 (`^[a-f0-9]{32,64}$`) yang tidak pernah diekspos ke browser publik untuk membaca/menyimpan respons (`/responses`) dan konfigurasi situs (`/site_config`) secara permanen di Firestore (>10 hari).
3. **Integritas Skema & Anti-Shadow Field**: Setiap dokumen `survey_responses` dan `owner_vault/.../responses` wajib memiliki seluruh kolom wajib (termasuk `priceWorthIt` untuk evaluasi harga Rp20.000), tidak boleh mengandung field liar (`hasOnly`), dan seluruh nilai numerik harus berada pada rentang valid (1–5 skala kepuasan, 0–10 rekomendasi).
4. **Integritas Temporal**: `createdAt` dan `updatedAt` pada dokumen baru/pembaruan wajib sama persis dengan `request.time` server Firestore; client tidak boleh memalsukan timestamp.
5. **Validasi Logika Pre-Order & Ukuran Gambar**: Field layanan pre-order wajib ada jika `hasOrdered == 'Ya, pernah memesan'` dan dilarang ada jika `'Tidak, hanya mencicipi'`. Gambar ter-crop dipisah per dokumen dan dibatasi di bawah 750KB agar aman di bawah limit 1MB Firestore.

## 2. "Dirty Dozen" Attack Payloads (Wajib Ditolak `PERMISSION_DENIED`)
1. **Shadow/Ghost Field Injection**: Mengirim dokumen `/survey_responses/{id}` dengan tambahan field `isAdmin: true`.
2. **Timestamp Spoofing**: Mengirim `createdAt: "2020-01-01T00:00:00Z"` (bukan `request.time`).
3. **Out-of-Range Rating (High)**: Mengirim `ratingCassava: 99`.
4. **Out-of-Range Rating (Low/Float)**: Mengirim `ratingChicken: 0` atau `ratingChicken: 4.5`.
5. **Invalid NPS Score**: Mengirim `recommendScore: 11` atau `-1`.
6. **Oversized Feedback String (DoW)**: Mengirim `feedbackNotes` sepanjang 5.000 karakter (> 1.000 batas).
7. **Invalid Enum Activity**: Mengirim `activity: "Hacker"`.
8. **Invalid Price Worth It Option**: Mengirim `priceWorthIt: "Gratis saja"`.
9. **Missing Pre-Order Ratings**: Mengirim `hasOrdered: "Ya, pernah memesan"` tanpa `preOrderEase`.
10. **Unauthorized List Scrape**: Pengguna publik mencoba `list` koleksi `/survey_responses`.
11. **Vault Root Enumeration / Invalid Vault ID**: Mencoba membaca `/owner_vault` atau menggunakan `vaultId` pendek (< 32 karakter).
12. **Path Poisoning ID / Oversized Image**: Mencoba membuat dokumen `responseId` mengandung karakter ilegal (`../`) atau menulis `imageUrl` melebihi 750KB ke `site_config`.
