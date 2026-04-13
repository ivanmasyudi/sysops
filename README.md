# DevProof Dashboard

Dashboard aktivitas tim engineering berbasis GitHub. Project ini menampilkan commit, pull request, issue, heatmap konsistensi, repo teraktif, milestone, dan recent activity dalam satu tampilan yang ringan.

## What It Does

- Menarik data real dari GitHub lewat backend internal
- Mendukung filter `7 / 30 / 90 / 365` hari
- Auto refresh berkala + live refresh saat webhook GitHub masuk
- Menjaga token GitHub tetap aman di server

## Stack

- `Vite + React + TypeScript`
- `Tailwind CSS`
- `Express`
- `Recharts`

## Quick Start

1. Install dependency
   ```bash
   npm install
   ```

2. Isi `.env`
   ```env
   GITHUB_OWNER="your-org-or-username"
   GITHUB_REPOS=""
   GITHUB_TOKEN="your-token"
   GITHUB_WEBHOOK_SECRET="your-secret"
   VITE_API_BASE_URL="http://localhost:8787"
   ```

3. Jalankan API
   ```bash
   npm run dev:api
   ```

4. Jalankan frontend
   ```bash
   npm run dev:web
   ```

## Webhook

Set webhook GitHub ke:

```text
/api/github/webhook
```

Saat webhook masuk, cache akan dibersihkan, dashboard di-warm ulang, lalu frontend akan refresh lebih cepat lewat SSE.

## Notes

- Jika `GITHUB_REPOS` kosong, dashboard akan membaca semua repo milik `GITHUB_OWNER`
- Data bersifat near real-time, bukan live per detik
- Endpoint health tersedia di `/api/health`
