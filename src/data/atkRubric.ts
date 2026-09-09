import { SimulasiAtkItemRef, SimulasiAtkRecord, CaseRecord } from '../types';

/**
 * Tabel Rincian Standar Pengeluaran ATK Perkara (Plafon Rp 100.000,- per perkara)
 * Sesuai rujukan resmi administrasi kepaniteraan Pengadilan Agama:
 */
export const ATK_REFERENCE_ITEMS: SimulasiAtkItemRef[] = [
  {
    no: 1,
    jenisAtk: 'Pembelian Kertas A4 1/5 Rim',
    hargaSatuan: 50000,
    jumlah: 10000,
    keterangan: 'Keperluan cetak berkas, gugatan/permohonan, berita acara & putusan'
  },
  {
    no: 2,
    jenisAtk: 'Stofmap Polio untuk pendaftaran Perkara',
    hargaSatuan: 2000,
    jumlah: 6000,
    keterangan: 'Pendaftaran awal & pengelompokan berkas perkara (3 lembar)'
  },
  {
    no: 3,
    jenisAtk: 'Cetak Map Sampul Perkara',
    hargaSatuan: 8000,
    jumlah: 8000,
    keterangan: 'Sampul map berkas perkara resmi'
  },
  {
    no: 4,
    jenisAtk: 'Cetak Map Bundel A Gugatan',
    hargaSatuan: 10000,
    jumlah: 10000,
    keterangan: 'Pemberkasan Bundel A Perkara Gugatan'
  },
  {
    no: 5,
    jenisAtk: 'Cetak Map Bundel A Permohonan',
    hargaSatuan: 10000,
    jumlah: 10000,
    keterangan: 'Pemberkasan Bundel A Perkara Permohonan'
  },
  {
    no: 6,
    jenisAtk: 'Cetak Map Putusan',
    hargaSatuan: 8000,
    jumlah: 8000,
    keterangan: 'Map arsip dan salinan putusan perkara gugatan'
  },
  {
    no: 7,
    jenisAtk: 'Cetak Map Penetapan',
    hargaSatuan: 8000,
    jumlah: 8000,
    keterangan: 'Map arsip dan salinan penetapan perkara permohonan'
  },
  {
    no: 8,
    jenisAtk: 'Cetak Map Produk',
    hargaSatuan: 10000,
    jumlah: 10000,
    keterangan: 'Penyerahan produk pengadilan (Akta Cerai / Salinan Putusan)'
  },
  {
    no: 9,
    jenisAtk: 'Tinta Epson 1/20',
    hargaSatuan: 100000,
    jumlah: 5000,
    keterangan: 'Porsi pemakaian cetak berkas & instrumen sidang'
  },
  {
    no: 10,
    jenisAtk: 'Tinta Refiil Canon 1/10',
    hargaSatuan: 50000,
    jumlah: 5000,
    keterangan: 'Porsi pemakaian cetak penggandaan berkas'
  },
  {
    no: 11,
    jenisAtk: 'Catridge 1/50',
    hargaSatuan: 250000,
    jumlah: 5000,
    keterangan: 'Porsi keausan catridge printer operasional perkara'
  },
  {
    no: 12,
    jenisAtk: 'Amplop Surat 1/20',
    hargaSatuan: 20000,
    jumlah: 1000,
    keterangan: 'Amplop pengiriman surat panggilan / pemberitahuan'
  },
  {
    no: 13,
    jenisAtk: 'Pembelian Alat tulis kantor lainnya yang meliputi keperluan penyelesaian perkara Antara lain Pulpen, Buku Sidang, Instrumen instrument persidangan, Stapler, isi staples Binder Clip, pulsa untuk notifikasi, pendukung penyelesaian perkara, alat keperluan arsip serta kebutuhan minum para pihak dan lain-lain',
    hargaSatuan: 14000,
    jumlah: 14000,
    keterangan: 'Operasional ATK habis pakai persidangan & pelayanan para pihak'
  }
];

/**
 * Menghasilkan tanggal interpolasi yang terdistribusi secara kronologis
 * antara tanggalMasuk (tanggal perkara masuk) dan tanggalSelesai (perkara itu selesai)
 */
export function interpolateDates(startDateStr: string, endDateStr: string, steps: number): string[] {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const startMs = isNaN(start.getTime()) ? Date.now() - 30 * 86400000 : start.getTime();
  const endMs = isNaN(end.getTime()) ? Date.now() : end.getTime();
  const safeEndMs = endMs >= startMs ? endMs : startMs;
  const diffDays = Math.max(0, Math.round((safeEndMs - startMs) / 86400000));

  const dates: string[] = [];
  for (let i = 0; i < steps; i++) {
    const fraction = steps <= 1 ? 0 : i / (steps - 1);
    const dayOffset = Math.round(fraction * diffDays);
    const time = startMs + dayOffset * 86400000;
    dates.push(new Date(time).toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Menghitung tanggal tahapan kronologis setiap jenis ATK berdasarkan progress
 * siklus perkara dari tanggal perkara masuk (0%) sampai perkara selesai (100%)
 */
export function computeSequentialAtkDates(
  startDateStr: string,
  endDateStr: string,
  progressRatios: number[]
): string[] {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const startMs = isNaN(start.getTime()) ? Date.now() - 30 * 86400000 : start.getTime();
  const endMs = isNaN(end.getTime()) ? Date.now() : end.getTime();
  const safeEndMs = endMs >= startMs ? endMs : startMs;
  const diffDays = Math.max(0, Math.round((safeEndMs - startMs) / 86400000));

  let prevTime = startMs;
  return progressRatios.map((ratio, index) => {
    if (ratio <= 0 || diffDays === 0) {
      prevTime = startMs;
      return new Date(startMs).toISOString().split('T')[0];
    }
    if (ratio >= 1.0 || index === progressRatios.length - 1) {
      prevTime = safeEndMs;
      return new Date(safeEndMs).toISOString().split('T')[0];
    }

    const dayOffset = Math.round(ratio * diffDays);
    let targetTime = startMs + dayOffset * 86400000;

    // Pastikan berurutan (tidak mundur dari item sebelumnya dan tidak melebihi tanggal selesai)
    if (targetTime < prevTime) {
      targetTime = prevTime;
    }
    if (targetTime > safeEndMs) {
      targetTime = safeEndMs;
    }
    prevTime = targetTime;
    return new Date(targetTime).toISOString().split('T')[0];
  });
}

export interface GenerateSimulasiParams {
  caseRecord: CaseRecord;
  targetAmount?: number;    // default 100000
  tanggalMasuk?: string;   // Tanggal perkara masuk (pendaftaran)
  tanggalSelesai?: string; // Tanggal perkara selesai (putus/minutasi)
  tanggal?: string;        // backward compatibility for tanggal selesai
}

/**
 * Menghasilkan rincian simulasi pengeluaran ATK perkara otomatis
 * berbasis tabel rincian standar kepaniteraan Pengadilan Agama.
 * Dimulai dari tanggal perkara masuk (pendaftaran) hingga tanggal perkara selesai (putus).
 *
 * Kronologi Tahapan:
 * 1. Tanggal Perkara Masuk (Pendaftaran): Stofmap Polio, Kertas A4, Cetak Map Sampul Muka
 * 2. Tahap Sidang Awal & Panggilan: Amplop Surat (Panggilan relaas), Cetak Map Bundel A
 * 3. Tahap Persidangan & Pembuktian: Tinta Epson (BAS), Tinta Refill Canon (bukti), Catridge printer
 * 4. Tanggal Perkara Selesai (Putus/Minutasi): Cetak Map Putusan/Penetapan, Cetak Map Produk, ATK Lainnya (penutup arsip)
 */
export function generateAtkSimulationDeterministic(params: GenerateSimulasiParams): SimulasiAtkRecord[] {
  const { caseRecord, targetAmount = 100000, tanggalMasuk, tanggalSelesai, tanggal } = params;
  const isPermohonan = (caseRecord.kategoriPerkara === 'Permohonan') || 
                       caseRecord.nomorPerkara.toLowerCase().includes('/pdt.p/') ||
                       caseRecord.jenisPerkara === 'Penetapan Ahli Waris' ||
                       caseRecord.jenisPerkara === 'Dispensasi Nikah' ||
                       caseRecord.jenisPerkara === 'Wali Adhal';

  // 1. Tentukan tanggal perkara masuk
  const regDate = tanggalMasuk || caseRecord.tanggalRegister || '2026-01-01';

  // 2. Tentukan tanggal perkara selesai
  let putusDate = tanggalSelesai || tanggal || caseRecord.tanggalPutus;
  if (!putusDate || !putusDate.trim()) {
    // Jika perkara berstatus Putus/Selesai namun belum tercatat tanggalnya, pakai tanggal sekarang atau default
    if (caseRecord.status === 'Putus' || caseRecord.status === 'Selesai' || caseRecord.status === 'Minutasi' || caseRecord.status === 'Arsip') {
      putusDate = new Date().toISOString().split('T')[0];
    } else {
      // Perkara aktif: estimasikan selesai 45 hari dari tanggal masuk
      const startMs = new Date(regDate).getTime();
      const estEndMs = !isNaN(startMs) ? startMs + 45 * 86400000 : Date.now();
      putusDate = new Date(estEndMs).toISOString().split('T')[0];
    }
  }

  // Rangkaian jenis ATK tersusun secara kronologis berurutan dari perkara masuk s/d selesai
  const selectedItems: {
    jenisAtk: string;
    jumlah: number;
    kategori: string;
    keterangan: string;
    tahap: 'Masuk / Pendaftaran' | 'Sidang Awal' | 'Pemeriksaan Sidang' | 'Perkara Selesai';
    timelineRatio: number; // 0.0 = tanggal perkara masuk, 1.0 = perkara selesai
  }[] = [
    {
      jenisAtk: 'Stofmap Polio untuk pendaftaran Perkara',
      jumlah: 6000,
      kategori: 'Map',
      keterangan: 'Pendaftaran awal & pengelompokan berkas perkara saat masuk',
      tahap: 'Masuk / Pendaftaran',
      timelineRatio: 0.0 // Tepat pada tanggal perkara masuk
    },
    {
      jenisAtk: 'Pembelian Kertas A4 1/5 Rim',
      jumlah: 10000,
      kategori: 'Kertas',
      keterangan: 'Pencetakan surat gugatan/permohonan awal & instrumen berkas pendaftaran',
      tahap: 'Masuk / Pendaftaran',
      timelineRatio: 0.05 // Hari pendaftaran / +1 hari
    },
    {
      jenisAtk: 'Cetak Map Sampul Perkara',
      jumlah: 8000,
      kategori: 'Map',
      keterangan: 'Map sampul muka perkara resmi saat berkas teregister',
      tahap: 'Masuk / Pendaftaran',
      timelineRatio: 0.10 // Awal masuk berkas
    },
    {
      jenisAtk: 'Amplop Surat 1/20',
      jumlah: 1000,
      kategori: 'Amplop',
      keterangan: 'Amplop pengiriman surat panggilan / pemberitahuan relaas sidang para pihak',
      tahap: 'Sidang Awal',
      timelineRatio: 0.20 // Pemanggilan sidang pertama
    },
    {
      jenisAtk: isPermohonan ? 'Cetak Map Bundel A Permohonan' : 'Cetak Map Bundel A Gugatan',
      jumlah: 10000,
      kategori: 'Map',
      keterangan: isPermohonan ? 'Pemberkasan Bundel A Perkara Permohonan oleh Panitera Pengganti' : 'Pemberkasan Bundel A Perkara Gugatan oleh Panitera Pengganti',
      tahap: 'Sidang Awal',
      timelineRatio: 0.35 // Awal persidangan
    },
    {
      jenisAtk: 'Tinta Epson 1/20',
      jumlah: 5000,
      kategori: 'Tinta',
      keterangan: 'Pemakaian tinta printer pencetakan Berita Acara Sidang (BAS)',
      tahap: 'Pemeriksaan Sidang',
      timelineRatio: 0.50 // Pertengahan persidangan
    },
    {
      jenisAtk: 'Tinta Refiil Canon 1/10',
      jumlah: 5000,
      kategori: 'Tinta',
      keterangan: 'Refill tinta penggandaan dokumen pembuktian & instrumen persidangan',
      tahap: 'Pemeriksaan Sidang',
      timelineRatio: 0.65 // Tahap pembuktian
    },
    {
      jenisAtk: 'Catridge 1/50',
      jumlah: 5000,
      kategori: 'Catridge',
      keterangan: 'Porsi keausan catridge printer operasional pemeriksaan perkara',
      tahap: 'Pemeriksaan Sidang',
      timelineRatio: 0.80 // Menjelang putusan
    },
    {
      jenisAtk: isPermohonan ? 'Cetak Map Penetapan' : 'Cetak Map Putusan',
      jumlah: 8000,
      kategori: 'Map',
      keterangan: isPermohonan ? 'Map naskah resmi Penetapan Hakim' : 'Map naskah resmi Putusan Majelis Hakim',
      tahap: 'Perkara Selesai',
      timelineRatio: 0.95 // Menjelang / saat pembacaan putusan
    },
    {
      jenisAtk: 'Cetak Map Produk',
      jumlah: 10000,
      kategori: 'Map',
      keterangan: 'Map penyerahan produk pengadilan kepada para pihak (Akta Cerai / Salinan Putusan)',
      tahap: 'Perkara Selesai',
      timelineRatio: 1.0 // Tepat saat perkara selesai
    },
    {
      jenisAtk: 'Pembelian Alat tulis kantor lainnya (Pulpen, Buku Sidang, Stapler, Binder Clip, pulsa notifikasi, arsip & konsumsi sidang)',
      jumlah: 32000, // Menjamin total pengeluaran tepat sama dengan Rp 100.000 (6+10+8+1+10+5+5+5+8+10+32 = 100.000)
      kategori: 'ATK Lainnya',
      keterangan: 'Perlengkapan ATK habis pakai persidangan, penutupan berkas, dan pengarsipan perkara',
      tahap: 'Perkara Selesai',
      timelineRatio: 1.0 // Tepat saat perkara selesai
    }
  ];

  // Hitung total kalkulasi dan sesuaikan item terakhir bila targetAmount berbeda (misal sisa saldo parsial)
  const totalSub = selectedItems.reduce((acc, it) => acc + it.jumlah, 0);
  const diff = targetAmount - totalSub;
  if (diff !== 0 && selectedItems.length > 0) {
    selectedItems[selectedItems.length - 1].jumlah = Math.max(1000, selectedItems[selectedItems.length - 1].jumlah + diff);
  }

  // Sebar tanggal secara kronologis berurutan dari tanggal perkara masuk sampai perkara selesai
  const timelineRatios = selectedItems.map(it => it.timelineRatio);
  const dates = computeSequentialAtkDates(regDate, putusDate, timelineRatios);

  const timestampBase = Date.now();
  return selectedItems.map((item, index) => {
    const tgl = dates[index] || putusDate;

    return {
      id: `sim-atk-${caseRecord.id}-${index}-${timestampBase}`,
      tanggal: tgl,
      nomorPerkara: caseRecord.nomorPerkara,
      kategoriPerkara: caseRecord.kategoriPerkara,
      statusPerkara: caseRecord.status,
      uraian: item.jenisAtk,
      penerimaan: 0,
      pengeluaran: item.jumlah,
      kategori: item.kategori,
      keterangan: `${item.keterangan} [${item.tahap}]`,
      isAiGenerated: true,
      createdAt: new Date(timestampBase + index * 1000).toISOString()
    };
  });
}
