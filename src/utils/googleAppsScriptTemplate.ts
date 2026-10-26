/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * AUTOABSEN KOLASE P3K - GOOGLE APPS SCRIPT AUTOMATION
 * =========================================================================
 * Form: https://docs.google.com/forms/d/e/1FAIpQLScYbiBkznkdZq8j2EE2qEwD_gKzMwwX4aVcfb8ADDTslgHikA/viewform
 * 
 * STRUKTUR KOLOM SHEET (Absensi_P3k):
 * - Kolom A (1): Timestamp
 * - Kolom B (2): NIP
 * - Kolom C (3): Nama Lengkap & Gelar
 * - Kolom D (4): Unggah Foto Diri / Bukti Kehadiran (URL Google Drive)
 * - Kolom E (5): Sesi Absensi (Pagi / Sore)
 * - Kolom F (6): Status Pemrosesan Kolase (Otomatis diisi script)
 *
 * PANDUAN PEMASANGAN:
 * 1. Buka Google Sheets 'Absensi_P3k'
 * 2. Klik menu 'Ekstensi' (Extensions) > 'Apps Script'
 * 3. Hapus kode default, lalu tempel (paste) seluruh kode ini
 * 4. Tekan Ctrl+S (Simpan)
 * 5. Jalankan fungsi 'inisialisasiSpreadsheet()' untuk membuat sheet PENGATURAN
 * 6. Pasang Pemicu (Trigger):
 *    - Klik menu jam (Triggers) di panel kiri
 *    - Klik '+ Tambahkan Pemicu'
 *    - Pilih fungsi: 'onFormSubmitTrigger'
 *    - Sumber acara: 'Dari spreadsheet'
 *    - Jenis acara: 'Saat mengirim formulir' (On form submit)
 *    - Simpan & setujui otorisasi akun Google
 *
 * CARA MEMBUAT TOMBOL SIGN / EKSEKUSI DI GOOGLE SHEETS:
 * 1. Di Google Sheets, klik menu 'Sisipkan' (Insert) > 'Gambar' (Drawing)
 * 2. Gambar bentuk tombol kotak, beri teks '▶️ SIGN & BUAT KOLASE', klik Simpan
 * 3. Klik titik tiga di tombol tersebut, pilih 'Tetapkan Skrip' (Assign Script)
 * 4. Ketik: tombolSignKolase, lalu klik OK!
 * =========================================================================
 */

// Konfigurasi Default Sistem (Tersinkronisasi dengan Google Form P3K)
const CONFIG = {
  FOLDER_INDUK: "DOKUMENTASI ABSENSI P3K",
  MAKS_FOTO_PER_HALAMAN: 6,
  KOLOM_TIMESTAMP: 1, // Kolom A
  KOLOM_NIP: 2,       // Kolom B
  KOLOM_NAMA: 3,      // Kolom C
  KOLOM_FOTO: 4,      // Kolom D (Unggah Foto Diri / Bukti Kehadiran)
  KOLOM_SESI: 5,      // Kolom E (Sesi Absensi: Pagi / Sore)
  KOLOM_STATUS: 6,    // Kolom F (Status)
  ATURAN_DUPLIKAT: "TOLAK" // Pilihan: "TOLAK" | "TANDAI" | "TIMPA"
};

/**
 * 1. Deteksi Indeks Kolom Otomatis berdasarkan Nama Header di Baris 1
 */
function getHeaderMap(sheet) {
  const lastCol = Math.max(6, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = { ...CONFIG };

  headers.forEach((h, i) => {
    const text = String(h).trim().toLowerCase();
    if (text.includes('timestamp') || text.includes('waktu')) map.KOLOM_TIMESTAMP = i + 1;
    else if (text.includes('nip')) map.KOLOM_NIP = i + 1;
    else if (text.includes('nama')) map.KOLOM_NAMA = i + 1;
    else if (text.includes('foto') || text.includes('bukti') || text.includes('unggah')) map.KOLOM_FOTO = i + 1;
    else if (text.includes('sesi')) map.KOLOM_SESI = i + 1;
    else if (text.includes('status')) map.KOLOM_STATUS = i + 1;
  });

  return map;
}

/**
 * 2. Menu Kustom di Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📸 Absensi P3K')
    .addItem('▶️ Sign / Buat Kolase Sekarang', 'tombolSignKolase')
    .addItem('⚙️ Inisialisasi Sheet Pengaturan', 'inisialisasiSpreadsheet')
    .addItem('📁 Buka Folder Google Drive Kolase', 'bukaFolderDrive')
    .addToUi();
}

/**
 * Fungsi yang dipanggil saat Tombol Sign di Google Sheets diklik
 */
function tombolSignKolase() {
  const tglHariIni = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  generateKolaseUntukSesi(tglHariIni, "Pagi");
  generateKolaseUntukSesi(tglHariIni, "Sore");
  SpreadsheetApp.getUi().alert("✅ Sukses: 1 File PDF dokumentasi presensi P3K (multi-halaman sesuai jumlah peserta, maks 6 foto per halaman) untuk tanggal " + tglHariIni + " berhasil dibuat dan disimpan di Google Drive!");
}

/**
 * Menyiapkan sheet PENGATURAN
 */
function inisialisasiSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetPengaturan = ss.getSheetByName("PENGATURAN");
  
  if (!sheetPengaturan) {
    sheetPengaturan = ss.insertSheet("PENGATURAN");
    const dataAwal = [
      ["PARAMETER", "NILAI", "KETERANGAN"],
      ["NAMA_INSTANSI", "ABSENSI P3K - PEMERINTAH DAERAH", "Nama instansi di header kolase"],
      ["UNIT_KERJA", "PEGAWAI PEMERINTAH DENGAN PERJANJIAN KERJA", "Unit / Kategori Presensi"],
      ["TEMA_BINGKAI", "ELEGAN_BEIGE", "Pilihan: ELEGAN_BEIGE | FORMAL_INSTANSI | MINIMALIS"],
      ["ATURAN_DUPLIKAT", "TOLAK", "Pilihan: TOLAK | TANDAI | TIMPA"],
      ["ORIENTASI", "PORTRAIT", "PORTRAIT (1080x1350) atau LANDSCAPE (1920x1080)"],
      ["SLOGAN_FOOTER", "Dokumentasi Resmi Kehadiran P3K", "Catatan footer di bawah gambar"]
    ];
    sheetPengaturan.getRange(1, 1, dataAwal.length, 3).setValues(dataAwal);
    sheetPengaturan.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#F1F5F9");
    sheetPengaturan.autoResizeColumns(1, 3);
    SpreadsheetApp.getUi().alert("Sheet 'PENGATURAN' berhasil dibuat!");
  } else {
    SpreadsheetApp.getUi().alert("Sheet 'PENGATURAN' sudah aktif.");
  }
}

/**
 * 3. Pemicu Form Submit (onFormSubmitTrigger)
 */
function onFormSubmitTrigger(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  const colMap = getHeaderMap(sheet);
  
  try {
    const timestamp = sheet.getRange(lastRow, colMap.KOLOM_TIMESTAMP).getValue();
    const nip = String(sheet.getRange(lastRow, colMap.KOLOM_NIP).getValue()).trim();
    const nama = String(sheet.getRange(lastRow, colMap.KOLOM_NAMA).getValue()).trim();
    const fotoUrl = String(sheet.getRange(lastRow, colMap.KOLOM_FOTO).getValue()).trim();
    const sesi = String(sheet.getRange(lastRow, colMap.KOLOM_SESI).getValue()).trim();

    const tglObj = new Date(timestamp);
    const dateStr = Utilities.formatDate(tglObj, Session.getScriptTimeZone(), "yyyy-MM-dd");

    // Cek Duplikasi
    const duplicateStatus = cekDuplikasi(sheet, lastRow, nip, dateStr, sesi, colMap);
    if (duplicateStatus === "DUPLIKAT_DITOLAK") {
      sheet.getRange(lastRow, colMap.KOLOM_STATUS).setValue("DITOLAK (NIP SUDAH ADA)");
      return;
    }

    // Buat & Perbarui Kolase otomatis
    generateKolaseUntukSesi(dateStr, sesi);

    sheet.getRange(lastRow, colMap.KOLOM_STATUS).setValue("SUKSES DIPROSES");
  } catch (error) {
    Logger.log("Error: " + error.toString());
    sheet.getRange(lastRow, colMap.KOLOM_STATUS).setValue("GAGAL: " + error.toString());
  }
}

/**
 * Validasi Duplikasi NIP
 */
function cekDuplikasi(sheet, currentRow, nip, targetDate, targetSession, colMap) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < currentRow - 1; i++) {
    const row = data[i];
    const rowDate = Utilities.formatDate(new Date(row[colMap.KOLOM_TIMESTAMP - 1]), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const rowNip = String(row[colMap.KOLOM_NIP - 1]).trim();
    const rowSesi = String(row[colMap.KOLOM_SESI - 1]).trim();

    if (rowDate === targetDate && rowNip === nip && rowSesi === targetSession) {
      if (CONFIG.ATURAN_DUPLIKAT === "TOLAK") return "DUPLIKAT_DITOLAK";
    }
  }
  return "OK";
}

/**
 * 4. Pengelolaan Folder di Google Drive
 */
function dapatkanFolderSesi(dateStr, sesi) {
  const rootFolders = DriveApp.getFoldersByName(CONFIG.FOLDER_INDUK);
  let indukFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder(CONFIG.FOLDER_INDUK);

  const tglFolders = indukFolder.getFoldersByName(dateStr);
  let tglFolder = tglFolders.hasNext() ? tglFolders.next() : indukFolder.createFolder(dateStr);

  const namaSesiFolder = sesi.toUpperCase();
  const sesiFolders = tglFolder.getFoldersByName(namaSesiFolder);
  let sesiFolder = sesiFolders.hasNext() ? sesiFolders.next() : tglFolder.createFolder(namaSesiFolder);

  return sesiFolder;
}

/**
 * 5. Membuat File Kolase (Google Slides / Drive)
 */
function generateKolaseUntukSesi(dateStr, targetSesi) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const colMap = getHeaderMap(sheet);
  const data = sheet.getDataRange().getValues();
  const listPeserta = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[colMap.KOLOM_TIMESTAMP - 1]) continue;
    
    const rowDate = Utilities.formatDate(new Date(row[colMap.KOLOM_TIMESTAMP - 1]), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const rowSesi = String(row[colMap.KOLOM_SESI - 1]).trim();
    const status = String(row[colMap.KOLOM_STATUS - 1] || "");

    if (rowDate === dateStr && rowSesi === targetSesi && !status.includes("DITOLAK")) {
      listPeserta.push({
        nip: String(row[colMap.KOLOM_NIP - 1]).trim(),
        nama: String(row[colMap.KOLOM_NAMA - 1]).trim(),
        fotoUrl: String(row[colMap.KOLOM_FOTO - 1]).trim()
      });
    }
  }

  if (listPeserta.length === 0) return;

  const targetFolder = dapatkanFolderSesi(dateStr, targetSesi);
  const totalHalaman = Math.ceil(listPeserta.length / CONFIG.MAKS_FOTO_PER_HALAMAN);

  // Buat presentasi sementara untuk render gambar
  const slideDeck = SlidesApp.create("Temp_Kolase_P3K_" + dateStr + "_" + targetSesi);
  const slideId = slideDeck.getId();

  try {
    for (let p = 0; p < totalHalaman; p++) {
      const pageIndex = p + 1;
      const pesertaHalaman = listPeserta.slice(p * 6, (p + 1) * 6);
      const slide = (p === 0) ? slideDeck.getSlides()[0] : slideDeck.appendSlide();
      
      // Header Text
      const headerBox = slide.insertTextBox(
        "DOKUMENTASI ABSENSI P3K - " + targetSesi.toUpperCase() + "\\n" +
        dateStr + " · HALAMAN " + pageIndex + " DARI " + totalHalaman + "\\n" +
        "TOTAL: " + listPeserta.length + " PESERTA",
        40, 20, 640, 80
      );
      headerBox.getText().getTextStyle().setFontSize(14).setBold(true);

      // Grid 3 kolom x 2 baris
      for (let s = 0; s < pesertaHalaman.length; s++) {
        const item = pesertaHalaman[s];
        const col = s % 3;
        const row = Math.floor(s / 3);
        const x = 50 + col * 200;
        const y = 120 + row * 180;

        try {
          const fileId = ambilDriveFileId(item.fotoUrl);
          if (fileId) {
            const fileBlob = DriveApp.getFileById(fileId).getBlob();
            slide.insertImage(fileBlob, x, y, 180, 130);
          }
        } catch (e) {
          slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, 180, 130);
        }

        const textBox = slide.insertTextBox(item.nama + "\\nNIP: " + item.nip, x, y + 135, 180, 40);
        textBox.getText().getTextStyle().setFontSize(10).setBold(true);
      }
    }
    slideDeck.saveAndClose();

    // Simpan ke Drive sebagai 1 File PDF Multi-Halaman (jika 2 gambar = 2 halaman PDF)
    const pdfBlob = DriveApp.getFileById(slideId).getAs("application/pdf");
    pdfBlob.setName("Dokumentasi_Absensi_P3K_" + dateStr + "_" + targetSesi + "_(" + totalHalaman + "_Halaman).pdf");
    targetFolder.createFile(pdfBlob);

  } finally {
    DriveApp.getFileById(slideId).setTrashed(true);
  }
}

function ambilDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/[-\\w]{25,}/);
  return match ? match[0] : null;
}

function bukaFolderDrive() {
  const folders = DriveApp.getFoldersByName(CONFIG.FOLDER_INDUK);
  if (folders.hasNext()) {
    SpreadsheetApp.getUi().alert("Folder Drive Absensi P3K:\\n" + folders.next().getUrl());
  } else {
    SpreadsheetApp.getUi().alert("Folder belum dibuat. Jalankan tombol sign / absensi terlebih dahulu.");
  }
}
`;
