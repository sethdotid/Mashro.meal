# Security Specification — MASHRO Customer Satisfaction Survey

## 1. Data Invariants
1. **Anonimitas Responden & Privasi Data**: Responden survei publik hanya boleh melakukan `create` pada `/survey_responses/{responseId}`. Tidak ada pengguna anonim atau responden biasa yang boleh melakukan `get`, `list`, `update`, atau `delete` terhadap data respons orang lain.
2. **Akses Pemilik Bisnis Terverifikasi**: Hanya pemilik bisnis MASHRO terverifikasi (`email_verified == true` dan email pemilik atau dokumen di `/admins/{uid}`) yang dapat membaca daftar respons (`/survey_responses`), mengelola pengaturan Google Forms (`/owner_settings`), atau mengelola daftar admin (`/admins`).
3. **Integritas Skema & Anti-Shadow Field**: Setiap dokumen `survey_responses` wajib memiliki seluruh kolom wajib, tidak boleh mengandung field liar (`hasOnly`), dan seluruh nilai numerik harus berada pada rentang valid (1–5 untuk skala kepuasan, 0–10 untuk skor rekomendasi).
4. **Integritas Temporal**: `createdAt` pada dokumen baru wajib sama persis dengan `request.time` server Firestore; client tidak boleh memalsukan timestamp masa lalu/masa depan.
5. **Validasi Logika Pre-Order**: Field layanan pre-order (`preOrderEase`, `preOrderResponsiveness`, `preOrderAccuracy`, `preOrderPunctuality`) wajib ada jika `hasOrdered == 'Ya, pernah memesan'` dan dilarang ada jika `hasOrdered == 'Tidak, hanya mencicipi'`.

## 2. "Dirty Dozen" Attack Payloads (Wajib Ditolak `PERMISSION_DENIED`)
1. **Shadow/Ghost Field Injection**: Mengirim dokumen `/survey_responses/{id}` dengan tambahan field `isAdmin: true`.
2. **Timestamp Spoofing**: Mengirim `createdAt: "2020-01-01T00:00:00Z"` (bukan `serverTimestamp()`).
3. **Out-of-Range Rating (High)**: Mengirim `ratingCassava: 99`.
4. **Out-of-Range Rating (Low/Float)**: Mengirim `ratingChicken: 0` atau `ratingChicken: 4.5`.
5. **Invalid NPS Score**: Mengirim `recommendScore: 11` atau `-1`.
6. **Oversized Feedback String (DoW)**: Mengirim `feedbackNotes` sepanjang 5.000 karakter (> 1.000 batas).
7. **Invalid Enum Activity**: Mengirim `activity: "Hacker"`.
8. **Missing Pre-Order Ratings**: Mengirim `hasOrdered: "Ya, pernah memesan"` tanpa `preOrderEase`.
9. **Unauthorized List Scrape**: Pengguna publik atau signed-in non-pemilik mencoba `list` koleksi `survey_responses`.
10. **Public Update Tampering**: Responden mencoba `update` dokumen `survey_responses` yang sudah dikirim.
11. **Unverified Admin Email Spoof**: Token dengan `email: "sethdotid@gmail.com"` tetapi `email_verified: false` mencoba membaca `survey_responses` atau menulis `owner_settings`.
12. **Path Poisoning ID**: Mencoba membuat dokumen dengan `responseId` mengandung karakter ilegal atau panjang > 128 karakter.
