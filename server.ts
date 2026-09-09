import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json({ limit: "10mb" }));

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Simulation Generator Endpoint using Gemini 3.8 Flash
  app.post("/api/generate-atk-simulation", async (req, res) => {
    try {
      const {
        nomorPerkara = "-",
        jenisPerkara = "Cerai Gugat",
        kategoriPerkara = "Gugatan",
        tanggalRegister = new Date().toISOString().split("T")[0],
        tanggalPutus = new Date().toISOString().split("T")[0],
        targetAmount = 100000
      } = req.body;

      const ai = getAiClient();
      if (ai) {
        const prompt = `Anda adalah sistem kecerdasan buatan administrasi kepaniteraan Pengadilan Agama untuk simulasi rincian pengeluaran ATK / Biaya Pemberkasan perkara.
Simulasikan rincian pengeluaran ATK untuk perkara berikut:
- Nomor Perkara: ${nomorPerkara}
- Jenis Perkara: ${jenisPerkara}
- Kategori Perkara: ${kategoriPerkara}
- Tanggal Perkara Masuk (Pendaftaran): ${tanggalRegister}
- Tanggal Perkara Selesai (Putus): ${tanggalPutus}
- Total Target Pengeluaran: Rp ${targetAmount} (Saldo akhir ATK perkara harus menjadi Rp 0 karena status perkara putus)

Pedoman tabel rincian ATK standar Pengadilan Agama (Total Rp ${targetAmount}):
1. Stofmap Polio untuk pendaftaran Perkara (Rp 6.000) [Kategori: Map]
2. Pembelian Kertas A4 1/5 Rim (Rp 10.000) [Kategori: Kertas]
3. Cetak Map Sampul Perkara (Rp 8.000) [Kategori: Map]
4. Amplop Surat 1/20 (Rp 1.000) [Kategori: Amplop]
5. ${kategoriPerkara === 'Permohonan' ? 'Cetak Map Bundel A Permohonan (Rp 10.000)' : 'Cetak Map Bundel A Gugatan (Rp 10.000)'} [Kategori: Map]
6. Buku Catatan Persidangan & Register Sidang (Rp 5.000) [Kategori: Buku]
7. Pembelian Pulpen Sidang & Penandatanganan Berita Acara (Rp 5.000) [Kategori: Alat Tulis]
8. Tinta Epson 1/20 (Rp 5.000) [Kategori: Tinta]
9. Materai untuk Keperluan Leges Bukti Surat Perkara (Rp 10.000) [Kategori: Materai]
10. Tinta Refiil Canon 1/10 (Rp 5.000) [Kategori: Tinta]
11. Catridge 1/50 (Rp 5.000) [Kategori: Catridge]
12. Binder Clip & Klip Kertas Penjepit Berkas (Rp 4.000) [Kategori: Klip]
13. Isi Staples & Perlengkapan Hekter Pemberkasan (Rp 4.000) [Kategori: Staples]
14. ${kategoriPerkara === 'Permohonan' ? 'Cetak Map Penetapan (Rp 8.000)' : 'Cetak Map Putusan (Rp 8.000)'} [Kategori: Map]
15. Cetak Map Produk (Rp 10.000) [Kategori: Map]
16. Perlengkapan Lakban & Sampul Arsip Minutasi (Rp 4.000) [Kategori: Arsip]

PERINGATAN PENTING:
JANGAN PERNAH membuat item umum/gabungan seperti 'Pembelian Alat tulis kantor lainnya (Pulpen, Buku Sidang, Stapler, Binder Clip, pulsa notifikasi, arsip & konsumsi sidang)'. Setiap item harus dirinci secara terpisah dan detail per item seperti daftar di atas (termasuk Materai untuk keperluan leges).

Ketentuan Mutlak Kronologi Tanggal Transaksi:
1. Transaksi pengeluaran ATK HARUS DIMULAI dari tanggal perkara masuk (${tanggalRegister}) dan BERAKHIR pada tanggal perkara selesai (${tanggalPutus}).
2. Susun tanggal transaksi SETIAP JENIS ATK secara kronologis berurutan:
   - Tahap Pendaftaran/Masuk (${tanggalRegister}): Stofmap Polio, Kertas A4, Map Sampul Perkara.
   - Tahap Sidang Awal: Amplop Surat, Cetak Map Bundel A, Buku Catatan Persidangan.
   - Tahap Pemeriksaan Sidang: Pulpen Sidang, Tinta Epson (BAS), Materai Keperluan Leges Surat Bukti, Tinta Refill Canon, Catridge, Binder Clip.
   - Tahap Selesai (${tanggalPutus}): Isi Staples, Cetak Map Putusan/Penetapan, Cetak Map Produk, Perlengkapan Lakban & Sampul Arsip Minutasi.
3. Total jumlah nominal seluruh pengeluaran HARUS TEPAT sama dengan ${targetAmount}.
4. Berikan output HANYA dalam bentuk JSON array objek dengan format:
[
  {
    "tanggal": "YYYY-MM-DD",
    "jenisAtk": "Nama ATK detail",
    "kategori": "Kertas" | "Map" | "Tinta" | "Catridge" | "Amplop" | "Materai" | "Buku" | "Alat Tulis" | "Klip" | "Staples" | "Arsip",
    "jumlah": number,
    "keterangan": "keterangan tahapan perkara"
  }
]`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        });

        const responseText = response.text || "";
        let parsed = JSON.parse(responseText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const currentSum = parsed.reduce((acc: number, item: any) => acc + (Number(item.jumlah) || 0), 0);
          const diff = Number(targetAmount) - currentSum;
          if (diff !== 0) {
            parsed[parsed.length - 1].jumlah = (Number(parsed[parsed.length - 1].jumlah) || 0) + diff;
          }

          return res.json({
            status: "success",
            source: "gemini",
            items: parsed
          });
        }
      }

      return res.json({
        status: "fallback",
        source: "rule-based"
      });
    } catch (err: any) {
      console.error("Error in /api/generate-atk-simulation:", err);
      return res.status(200).json({
        status: "fallback",
        error: err.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
