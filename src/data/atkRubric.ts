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
    jenisAtk: 'Amplop Surat 1/20',
    hargaSatuan: 20000,
    jumlah: 1000,
    keterangan: 'Amplop pengiriman surat panggilan / pemberitahuan relaas sidang'
  },
  {
    no: 5,
    jenisAtk: 'Cetak Map Bundel A Gugatan',
    hargaSatuan: 10000,
    jumlah: 10000,
    keterangan: 'Pemberkasan Bundel A Perkara Gugatan'
  },
  {
    no: 6,
    jenisAtk: 'Cetak Map Bundel A Permohonan',
    hargaSatuan: 10000,
    jumlah: 10000,
    keterangan: 'Pemberkasan Bundel A Perkara Permohonan'
  },
  {
    no: 7,
    jenisAtk: 'Buku Catatan Persidangan & Register Sidang',
    hargaSatuan: 10000,
    jumlah: 5000,
    keterangan: 'Buku instrumen pencatatan agenda persidangan perkara'
  },
  {
    no: 8,
    jenisAtk: 'Pembelian Pulpen Sidang & Penandatanganan Berita Acara',
    hargaSatuan: 5000,
    jumlah: 5000,
    keterangan: 'Pulpen pencatatan sidang Majelis Hakim & Panitera Pengganti'
  },
  {
    no: 9,
    jenisAtk: 'Tinta Epson 1/20',
    hargaSatuan: 100000,
    jumlah: 5000,
    keterangan: 'Porsi pemakaian cetak berkas & instrumen Berita Acara Sidang (BAS)'
  },
  {
    no: 10,
    jenisAtk: 'Materai untuk Keperluan Leges Bukti Surat Perkara',
    hargaSatuan: 10000,
    jumlah: 10000,
    keterangan: 'Bea materai untuk pemeteraian kemudian (leges) alat bukti surat para pihak'
  },
  {
    no: 11,
    jenisAtk: 'Tinta Refiil Canon 1/10',
    hargaSatuan: 50000,
    jumlah: 5000,
    keterangan: 'Porsi pemakaian cetak penggandaan dokumen pembuktian perkara'
  },
  {
    no: 12,
    jenisAtk: 'Catridge 1/50',
    hargaSatuan: 250000,
    jumlah: 5000,
    keterangan: 'Porsi keausan catridge printer operasional persidangan'
  },
  {
    no: 13,
    jenisAtk: 'Binder Clip & Klip Kertas Penjepit Berkas',
    hargaSatuan: 8000,
    jumlah: 4000,
    keterangan: 'Penjepit berkas pembuktian dan bundel surat perkara'
  },
  {
    no: 14,
    jenisAtk: 'Isi Staples & Perlengkapan Hekter Pemberkasan',
    hargaSatuan: 8000,
    jumlah: 4000,
    keterangan: 'Penjilidan naskah putusan, penetapan, dan relaas panggilan'
  },
  {
    no: 15,
    jenisAtk: 'Cetak Map Putusan',
    hargaSatuan: 8000,
    jumlah: 8000,
    keterangan: 'Map arsip dan salinan putusan perkara gugatan'
  },
  {
    no: 16,
    jenisAtk: 'Cetak Map Penetapan',
    hargaSatuan: 8000,
    jumlah: 8000,
    keterangan: 'Map arsip dan salinan penetapan perkara permohonan'
  },
  {
    no: 17,
    jenisAtk: 'Cetak Map Produk',
    hargaSatuan: 10000,
    jumlah: 10000,
    keterangan: 'Penyerahan produk pengadilan (Akta Cerai / Salinan Putusan)'
  },
  {
    no: 18,
    jenisAtk: 'Perlengkapan Lakban & Sampul Arsip Minutasi',
    hargaSatuan: 8000,
    jumlah: 4000,
    keterangan: 'Penyegelan lakban & pengarsipan berkas perkara minutasi akhir'
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

  // Rangkaian 16 jenis ATK tersusun secara kronologis berurutan dari perkara masuk s/d selesai
  // Sesuai instruksi resmi: rincian detail per item (termasuk Materai untuk keperluan leges), tanpa kategori gabungan/generik
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
      keterangan: 'Pendaftaran awal & pengelompokan berkas perkara saat masuk (3 lembar)',
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
      timelineRatio: 0.18 // Pemanggilan sidang pertama
    },
    {
      jenisAtk: isPermohonan ? 'Cetak Map Bundel A Permohonan' : 'Cetak Map Bundel A Gugatan',
      jumlah: 10000,
      kategori: 'Map',
      keterangan: isPermohonan ? 'Pemberkasan Bundel A Perkara Permohonan oleh Panitera Pengganti' : 'Pemberkasan Bundel A Perkara Gugatan oleh Panitera Pengganti',
      tahap: 'Sidang Awal',
      timelineRatio: 0.28 // Awal persidangan
    },
    {
      jenisAtk: 'Buku Catatan Persidangan & Register Sidang',
      jumlah: 5000,
      kategori: 'Buku',
      keterangan: 'Buku instrumen pencatatan agenda persidangan perkara oleh Panitera Pengganti',
      tahap: 'Sidang Awal',
      timelineRatio: 0.35 // Tahap pembukaan sidang
    },
    {
      jenisAtk: 'Pembelian Pulpen Sidang & Penandatanganan Berita Acara',
      jumlah: 5000,
      kategori: 'Alat Tulis',
      keterangan: 'Pulpen khusus persidangan Majelis Hakim & penandatanganan Berita Acara Sidang (BAS)',
      tahap: 'Pemeriksaan Sidang',
      timelineRatio: 0.45 // Persidangan berjalan
    },
    {
      jenisAtk: 'Tinta Epson 1/20',
      jumlah: 5000,
      kategori: 'Tinta',
      keterangan: 'Pemakaian tinta printer pencetakan Berita Acara Sidang (BAS)',
      tahap: 'Pemeriksaan Sidang',
      timelineRatio: 0.52 // Pertengahan persidangan
    },
    {
      jenisAtk: 'Materai untuk Keperluan Leges Bukti Surat Perkara',
      jumlah: 10000,
      kategori: 'Materai',
      keterangan: 'Bea materai untuk pemeteraian kemudian (leges) alat bukti surat para pihak di persidangan',
      tahap: 'Pemeriksaan Sidang',
      timelineRatio: 0.60 // Tahap pembuktian alat bukti surat
    },
    {
      jenisAtk: 'Tinta Refiil Canon 1/10',
      jumlah: 5000,
      kategori: 'Tinta',
      keterangan: 'Refill tinta penggandaan dokumen pembuktian & instrumen persidangan',
      tahap: 'Pemeriksaan Sidang',
      timelineRatio: 0.68 // Tahap pembuktian
    },
    {
      jenisAtk: 'Catridge 1/50',
      jumlah: 5000,
      kategori: 'Catridge',
      keterangan: 'Porsi keausan catridge printer operasional pemeriksaan perkara',
      tahap: 'Pemeriksaan Sidang',
      timelineRatio: 0.75 // Menjelang putusan
    },
    {
      jenisAtk: 'Binder Clip & Klip Kertas Penjepit Berkas',
      jumlah: 4000,
      kategori: 'Klip',
      keterangan: 'Penjepit berkas pembuktian dan bundel surat perkara',
      tahap: 'Pemeriksaan Sidang',
      timelineRatio: 0.82 // Pengelompokan berkas sidang
    },
    {
      jenisAtk: 'Isi Staples & Perlengkapan Hekter Pemberkasan',
      jumlah: 4000,
      kategori: 'Staples',
      keterangan: 'Penjilidan naskah putusan/penetapan dan relaas panggilan',
      tahap: 'Perkara Selesai',
      timelineRatio: 0.88 // Persiapan minutasi
    },
    {
      jenisAtk: isPermohonan ? 'Cetak Map Penetapan' : 'Cetak Map Putusan',
      jumlah: 8000,
      kategori: 'Map',
      keterangan: isPermohonan ? 'Map naskah resmi Penetapan Hakim' : 'Map naskah resmi Putusan Majelis Hakim',
      tahap: 'Perkara Selesai',
      timelineRatio: 0.94 // Saat pembacaan putusan/penetapan
    },
    {
      jenisAtk: 'Cetak Map Produk',
      jumlah: 10000,
      kategori: 'Map',
      keterangan: 'Map penyerahan produk pengadilan kepada para pihak (Akta Cerai / Salinan Putusan)',
      tahap: 'Perkara Selesai',
      timelineRatio: 0.98 // Penyerahan produk
    },
    {
      jenisAtk: 'Perlengkapan Lakban & Sampul Arsip Minutasi',
      jumlah: 4000,
      kategori: 'Arsip',
      keterangan: 'Penyegelan lakban & pengarsipan berkas perkara minutasi akhir ke ruang arsip',
      tahap: 'Perkara Selesai',
      timelineRatio: 1.0 // Selesai / Minutasi
    }
  ];

  // Hitung total kalkulasi dan sesuaikan item bila targetAmount berbeda (misal sisa saldo parsial)
  const totalSub = selectedItems.reduce((acc, it) => acc + it.jumlah, 0);
  const diff = targetAmount - totalSub;
  if (diff !== 0 && selectedItems.length > 0) {
    // Sesuaikan item lakban/arsip atau item terakhir agar tetap seimbang
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
      nomorPerkara: (caseRecord.nomorPerkara || '').trim(),
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

/**
 * Migrasi otomatis data lama dari cache lokal atau spreadsheet
 * jika masih mengandung teks generik "Pembelian Alat tulis kantor lainnya..."
 * Menggantikannya dengan 16 item rincian spesifik (termasuk Materai leges).
 */
export function migrateLegacySimulasiAtkRecords(
  records: SimulasiAtkRecord[],
  caseList: CaseRecord[]
): SimulasiAtkRecord[] {
  if (!records || records.length === 0) return [];

  // Cari apakah ada baris yang mengandung deskripsi gabungan/generik lama
  const hasLegacyItems = records.some(r => {
    const u = (r.uraian || '').toLowerCase();
    return u.includes('pembelian alat tulis kantor lainnya') ||
           u.includes('alat tulis kantor lainnya yang meliputi') ||
           u.includes('pulpen, buku sidang, stapler') ||
           u.includes('kebutuhan minum para pihak');
  });

  if (!hasLegacyItems) return records;

  // Kelompokkan nomor perkara yang perlu diperbarui
  const casesWithLegacy = new Set<string>();
  records.forEach(r => {
    const u = (r.uraian || '').toLowerCase();
    if (
      u.includes('pembelian alat tulis kantor lainnya') ||
      u.includes('alat tulis kantor lainnya yang meliputi') ||
      u.includes('pulpen, buku sidang, stapler') ||
      u.includes('kebutuhan minum para pihak')
    ) {
      if (r.nomorPerkara) {
        casesWithLegacy.add(r.nomorPerkara.trim().toLowerCase());
      }
    }
  });

  let migrated = records.filter(r => {
    const no = (r.nomorPerkara || '').trim().toLowerCase();
    return !casesWithLegacy.has(no);
  });

  casesWithLegacy.forEach(normNo => {
    const targetCase = caseList.find(c => (c.nomorPerkara || '').trim().toLowerCase() === normNo);
    if (targetCase) {
      const regenerated = generateAtkSimulationDeterministic({
        caseRecord: targetCase,
        targetAmount: 100000,
        tanggalMasuk: targetCase.tanggalRegister,
        tanggalSelesai: targetCase.tanggalPutus || targetCase.tanggalRegister || new Date().toISOString().split('T')[0]
      });
      migrated = [...regenerated, ...migrated];
    }
  });

  return migrated;
}

/**
 * Menggabungkan records Simulasi ATK lokal dan remote (dari Google Sheets)
 * Menjaga agar data AI yang baru saja di-generate atau disimpan di lokal tidak tertimpa kembali
 * ke setelan awal saat halaman di-reload.
 */
export function mergeSimulasiAtkRecords(
  localRecords: SimulasiAtkRecord[],
  remoteRecords: SimulasiAtkRecord[]
): SimulasiAtkRecord[] {
  if (!remoteRecords || remoteRecords.length === 0) return localRecords || [];
  if (!localRecords || localRecords.length === 0) return remoteRecords || [];

  // Group by nomor perkara
  const localByCase = new Map<string, SimulasiAtkRecord[]>();
  localRecords.forEach(r => {
    const k = (r.nomorPerkara || '').trim().toLowerCase();
    if (!localByCase.has(k)) localByCase.set(k, []);
    localByCase.get(k)!.push(r);
  });

  const remoteByCase = new Map<string, SimulasiAtkRecord[]>();
  remoteRecords.forEach(r => {
    const k = (r.nomorPerkara || '').trim().toLowerCase();
    if (!remoteByCase.has(k)) remoteByCase.set(k, []);
    remoteByCase.get(k)!.push(r);
  });

  const allCaseKeys = new Set([...localByCase.keys(), ...remoteByCase.keys()]);
  const result: SimulasiAtkRecord[] = [];

  allCaseKeys.forEach(caseKey => {
    const locals = localByCase.get(caseKey) || [];
    const remotes = remoteByCase.get(caseKey) || [];

    if (locals.length > 0 && remotes.length === 0) {
      result.push(...locals);
      return;
    }
    if (remotes.length > 0 && locals.length === 0) {
      result.push(...remotes);
      return;
    }

    // Both exist: check which one is newer or more granular
    const localHasLegacy = locals.some(r => {
      const u = (r.uraian || '').toLowerCase();
      return u.includes('pembelian alat tulis kantor lainnya') || u.includes('pulpen, buku sidang, stapler');
    });
    const remoteHasLegacy = remotes.some(r => {
      const u = (r.uraian || '').toLowerCase();
      return u.includes('pembelian alat tulis kantor lainnya') || u.includes('pulpen, buku sidang, stapler');
    });

    if (remoteHasLegacy && !localHasLegacy) {
      // Local has clean granular 16 items, remote has legacy bundle: keep local!
      result.push(...locals);
      return;
    }

    // Check latest createdAt timestamp
    const maxLocalCreated = Math.max(...locals.map(r => new Date(r.createdAt || 0).getTime() || 0));
    const maxRemoteCreated = Math.max(...remotes.map(r => new Date(r.createdAt || 0).getTime() || 0));

    if (maxLocalCreated > maxRemoteCreated) {
      result.push(...locals);
    } else {
      result.push(...remotes);
    }
  });

  return result;
}
