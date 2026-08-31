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

  // API Route for AI Audit Kasir
  app.post("/api/ai-audit-kasir", async (req, res) => {
    try {
      const { 
        saldoFisikKasir, 
        saldoStandarBuku, 
        selisih, 
        totalDebet, 
        totalKredit, 
        saldoSkum,
        biayaKasBelumSetor, 
        pinjamanKas, 
        totalDebetPanjarPerkara,
        totalDebetPengembalianPinjaman,
        casesSummary,
        denominations 
      } = req.body;

      const ai = getAiClient();
      if (!ai) {
        return res.json({
          status: "fallback",
          message: "API Key Gemini belum disetel di server environment, asisten akan menampilkan analisis cerdas heuristik."
        });
      }

      const prompt = `Sebagai Auditor Keuangan Ahli Peradilan Agama & Ahli Pembukuan Jurnal SKUM Mahkamah Agung RI, lakukan analisis akar masalah dan berikan rekomendasi audit kasir berdasarkan data rekonsiliasi kas riil berikut:

DATA REKONSILIASI KASIR:
- Uang Fisik Aktual di Kasir (Input): Rp ${(Number(saldoFisikKasir) || 0).toLocaleString('id-ID')}
- Saldo Kas Seharusnya (Buku Standar): Rp ${(Number(saldoStandarBuku) || 0).toLocaleString('id-ID')}
- Selisih Kas Opname: Rp ${(Number(selisih) || 0).toLocaleString('id-ID')} (${Number(selisih) === 0 ? 'SEIMBANG/PAS' : Number(selisih) > 0 ? 'SURPLUS FISIK' : 'DEFISIT FISIK'})
- Logika Penerimaan Panjar Murni Perkara Masuk: Rp ${(Number(totalDebetPanjarPerkara || totalDebet) || 0).toLocaleString('id-ID')}
- Pengembalian / Pelunasan Pinjaman Kas Masuk: Rp ${(Number(totalDebetPengembalianPinjaman) || 0).toLocaleString('id-ID')}
- Total Mutasi Debet SKUM Buku: Rp ${(Number(totalDebet) || 0).toLocaleString('id-ID')}
- Total Pengeluaran (Kredit SKUM): Rp ${(Number(totalKredit) || 0).toLocaleString('id-ID')}
- Saldo Jurnal SKUM (Debet - Kredit): Rp ${(Number(saldoSkum) || 0).toLocaleString('id-ID')}
- Biaya Kas Belum Disetor ke Bendahara: Rp ${(Number(biayaKasBelumSetor) || 0).toLocaleString('id-ID')}
- Pinjaman Bon Saldo SKUM Kasir: Rp ${(Number(pinjamanKas) || 0).toLocaleString('id-ID')}
- Detail Denominasi Uang Pecahan Kasir: ${JSON.stringify(denominations || {})}
- Ringkasan Transaksi / Perkara Terkait: ${JSON.stringify(casesSummary || [])}

TUGAS ANDA:
Berikan analisis audit komprehensif dalam bahasa Indonesia formal, profesional, dan sangat akurat:
1. 📋 **Ringkasan Status Keuangan & Logika Debet SKUM** (Jelaskan secara eksplisit perbedaan antara Penerimaan Panjar Awal Perkara Masuk murni Rp ${(Number(totalDebetPanjarPerkara || totalDebet) || 0).toLocaleString('id-ID')} vs Total Mutasi Debet Buku Rp ${(Number(totalDebet) || 0).toLocaleString('id-ID')} yang ketambahan pengembalian pinjaman Rp ${(Number(totalDebetPengembalianPinjaman) || 0).toLocaleString('id-ID')})
2. 🔍 **Diagnostik & Identifikasi Akar Penyebab Selisih Kasir** (Berdasarkan angka selisih Rp ${(Number(selisih) || 0).toLocaleString('id-ID')}, analisis transaksi: uang fisik kasir vs sisa panjar perkara + titipan kas belum disetor)
3. ⚠️ **Faktor Risiko & Kepatuhan Tata Kelola SKUM**
4. 💡 **Rekomendasi Tindakan Koreksi Kongkret untuk Kasir / Panitera**

Format keluaran Markdown yang rapi, padat, dan solutif.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
      });

      return res.json({
        status: "success",
        analysis: response.text
      });
    } catch (err: any) {
      console.error("AI Audit Error:", err);
      return res.status(500).json({ status: "error", message: err.message });
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
