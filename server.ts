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

Pedoman tabel rincian ATK standar Pengadilan Agama:
1. Stofmap Polio untuk pendaftaran Perkara (Rp 6.000)
2. Pembelian Kertas A4 1/5 Rim (Rp 10.000)
3. Cetak Map Sampul Perkara (Rp 8.000)
4. Amplop Surat 1/20 (Rp 1.000)
5. ${kategoriPerkara === 'Permohonan' ? 'Cetak Map Bundel A Permohonan (Rp 10.000)' : 'Cetak Map Bundel A Gugatan (Rp 10.000)'}
6. Tinta Epson 1/20 (Rp 5.000)
7. Tinta Refiil Canon 1/10 (Rp 5.000)
8. Catridge 1/50 (Rp 5.000)
9. ${kategoriPerkara === 'Permohonan' ? 'Cetak Map Penetapan (Rp 8.000)' : 'Cetak Map Putusan (Rp 8.000)'}
10. Cetak Map Produk (Rp 10.000)
11. Pembelian Alat tulis kantor lainnya yang meliputi keperluan penyelesaian perkara Antara lain Pulpen, Buku Sidang, Instrumen persidangan, Stapler, isi staples Binder Clip, pulsa untuk notifikasi, pendukung penyelesaian perkara, alat keperluan arsip serta kebutuhan minum para pihak dan lain-lain (Rp 32.000 atau sisa hingga total pengeluaran tepat sama dengan Rp ${targetAmount})

Ketentuan Mutlak Kronologi Tanggal Transaksi:
1. Transaksi pengeluaran ATK HARUS DIMULAI dari tanggal perkara masuk (${tanggalRegister}) dan BERAKHIR pada tanggal perkara selesai (${tanggalPutus}).
2. Susun tanggal transaksi SETIAP JENIS ATK secara kronologis berurutan:
   - Tahap Pendaftaran/Masuk: Stofmap Polio (pada ${tanggalRegister}), Kertas A4, Map Sampul Perkara.
   - Tahap Sidang Awal: Amplop Surat panggilan relaas, Cetak Map Bundel A.
   - Tahap Pemeriksaan Sidang: Tinta Epson (BAS), Tinta Refill Canon (bukti), Catridge printer.
   - Tahap Selesai: Cetak Map Putusan/Penetapan, Cetak Map Produk, dan Pembelian ATK Lainnya (pada ${tanggalPutus}).
3. Total jumlah nominal seluruh pengeluaran HARUS TEPAT sama dengan ${targetAmount}.
4. Berikan output HANYA dalam bentuk JSON array objek dengan format:
[
  {
    "tanggal": "YYYY-MM-DD",
    "jenisAtk": "Nama ATK",
    "kategori": "Kertas" | "Map" | "Tinta" | "Catridge" | "Amplop" | "ATK Lainnya",
    "jumlah": number,
    "keterangan": "keterangan singkat tahapan perkara"
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
