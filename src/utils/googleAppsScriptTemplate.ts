/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * AUTOABSEN KOLASE - GOOGLE APPS SCRIPT AUTOMATION
 * =========================================================================
 * Script otomatisasi kehadiran Google Forms -> Google Sheets -> Google Drive
 * Membuat file kolase dokumentasi foto peserta otomatis (maks. 6 foto per gambar)
 *
 * PANDUAN PEMASANGAN CEPAT:
 * 1. Buka Google Spreadsheet yang terhubung dengan Google Form Anda.
 * 2. Klik menu 'Ekstensi' (Extensions) > 'Apps Script'.
 * 3. Hapus semua kode yang ada, lalu tempelkan (paste) seluruh kode di bawah ini.
 * 4. Klik ikon Disket (Simpan) atau tekan Ctrl+S.
 * 5. Jalankan fungsi 'inisialisasiSpreadsheet()' satu kali untuk membuat sheet 'PENGATURAN'.
 * 6. Pasang Pemicu (Trigger):
 *    - Klik menu jam (Triggers) di sebelah kiri
 *    - Klik '+ Tambahkan Pemicu' (+ Add Trigger)
 *    - Pilih fungsi: 'onFormSubmitTrigger'
 *    - Sumber acara: 'Dari spreadsheet' (From spreadsheet)
 *    - Jenis acara: 'Saat mengirim formulir' (On form submit)
 *    - Simpan dan berikan izin otorisasi Google.
 * =========================================================================
 */

// Konfigurasi Default Sistem
const CONFIG = {
  FOLDER_INDUK: "ABSENSI HARIAN",
  MAKS_FOTO_PER_HALAMAN: 6,
  KOLOM_TIMESTAMP: 1, // Kolom A
  KOLOM_NIP: 2,       // Kolom B
  KOLOM_NAMA: 3,      // Kolom C
  KOLOM_SESI: 4,      // Kolom D (Pagi / Sore)
  KOLOM_FOTO: 5,      // Kolom E (URL Foto Drive dari Form)
  KOLOM_STATUS: 6,    // Kolom F (Status Pemrosesan)
  ATURAN_DUPLIKAT: "TOLAK" // Pilihan: "TOLAK" | "TANDAI" | "TIMPA"
};

/**
 * 1. Fungsi Inisialisasi Sheet & Menu Kustom
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📸 Absensi & Kolase')
    .addItem('▶️ Generate Ulang Kolase Hari Ini', 'menuGenerateKolaseHariIni')
    .addItem('⚙️ Inisialisasi Sheet Pengaturan', 'inisialisasiSpreadsheet')
    .addItem('📁 Buka Folder Drive Kolase', 'bukaFolderDrive')
    .addToUi();
}

/**
 * Menyiapkan struktur sheet PENGATURAN jika belum ada
 */
function inisialisasiSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetPengaturan = ss.getSheetByName("PENGATURAN");
  
  if (!sheetPengaturan) {
    sheetPengaturan = ss.insertSheet("PENGATURAN");
    const dataAwal = [
      ["PARAMETER", "NILAI", "KETERANGAN"],
      ["NAMA_INSTANSI", "DINAS KOMUNIKASI DAN INFORMATIKA", "Nama instansi di judul kolase"],
      ["UNIT_KERJA", "BIDANG APLIKASI DAN INFORMATIKA", "Unit/sub-unit kerja"],
      ["TEMA_BINGKAI", "ELEGAN_BEIGE", "Pilihan: ELEGAN_BEIGE | FORMAL_INSTANSI | MINIMALIS"],
      ["ATURAN_DUPLIKAT", "TOLAK", "Pilihan: TOLAK (hanya yang pertama) | TANDAI | TIMPA"],
      ["ORIENTASI", "PORTRAIT", "PORTRAIT (1080x1350) atau LANDSCAPE (1920x1080)"],
      ["SLOGAN_FOOTER", "Dokumentasi Resmi Kehadiran Pegawai", "Catatan footer di bagian bawah gambar"]
    ];
    sheetPengaturan.getRange(1, 1, dataAwal.length, 3).setValues(dataAwal);
    sheetPengaturan.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#F1F5F9");
    sheetPengaturan.autoResizeColumns(1, 3);
    SpreadsheetApp.getUi().alert("Sheet 'PENGATURAN' berhasil dibuat!");
  } else {
    SpreadsheetApp.getUi().alert("Sheet 'PENGATURAN' sudah ada.");
  }
}

/**
 * 2. Pemicu Form Submit (Form-Submit Trigger)
 */
function onFormSubmitTrigger(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  try {
    const timestamp = sheet.getRange(lastRow, CONFIG.KOLOM_TIMESTAMP).getValue();
    const nip = String(sheet.getRange(lastRow, CONFIG.KOLOM_NIP).getValue()).trim();
    const nama = String(sheet.getRange(lastRow, CONFIG.KOLOM_NAMA).getValue()).trim();
    const sesi = String(sheet.getRange(lastRow, CONFIG.KOLOM_SESI).getValue()).trim();
    const fotoUrl = String(sheet.getRange(lastRow, CONFIG.KOLOM_FOTO).getValue()).trim();

    const tglObj = new Date(timestamp);
    const dateStr = Utilities.formatDate(tglObj, Session.getScriptTimeZone(), "yyyy-MM-dd");

    // Cek Duplikasi NIP pada hari dan sesi yang sama
    const duplicateStatus = cekDuplikasi(sheet, lastRow, nip, dateStr, sesi);
    if (duplicateStatus === "DUPLIKAT_DITOLAK") {
      sheet.getRange(lastRow, CONFIG.KOLOM_STATUS).setValue("DITOLAK (NIP SUDAH ADA)");
      return;
    }

    // Buat / Perbarui Kolase untuk tanggal dan sesi ini
    generateKolaseUntukSesi(dateStr, sesi);

    sheet.getRange(lastRow, CONFIG.KOLOM_STATUS).setValue("SUKSES DIPROSES");
  } catch (error) {
    Logger.log("Error pemrosesan absensi: " + error.toString());
    sheet.getRange(lastRow, CONFIG.KOLOM_STATUS).setValue("GAGAL: " + error.toString());
  }
}

/**
 * Validasi duplikasi NIP
 */
function cekDuplikasi(sheet, currentRow, nip, targetDate, targetSession) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < currentRow - 1; i++) {
    const row = data[i];
    const rowDate = Utilities.formatDate(new Date(row[CONFIG.KOLOM_TIMESTAMP - 1]), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const rowNip = String(row[CONFIG.KOLOM_NIP - 1]).trim();
    const rowSesi = String(row[CONFIG.KOLOM_SESI - 1]).trim();

    if (rowDate === targetDate && rowNip === nip && rowSesi === targetSession) {
      if (CONFIG.ATURAN_DUPLIKAT === "TOLAK") {
        return "DUPLIKAT_DITOLAK";
      }
    }
  }
  return "OK";
}

/**
 * 3. Logika Pembuatan Folder di Google Drive
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
 * 4. Membuat Gambar Kolase Google Slides / Drive
 */
function generateKolaseUntukSesi(dateStr, targetSesi) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const listPeserta = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[CONFIG.KOLOM_TIMESTAMP - 1]) continue;
    
    const rowDate = Utilities.formatDate(new Date(row[CONFIG.KOLOM_TIMESTAMP - 1]), Session.getScriptTimeZone(), "yyyy-MM-dd");
    const rowSesi = String(row[CONFIG.KOLOM_SESI - 1]).trim();
    const status = String(row[CONFIG.KOLOM_STATUS - 1] || "");

    if (rowDate === dateStr && rowSesi === targetSesi && !status.includes("DITOLAK")) {
      listPeserta.push({
        nip: String(row[CONFIG.KOLOM_NIP - 1]).trim(),
        nama: String(row[CONFIG.KOLOM_NAMA - 1]).trim(),
        fotoUrl: String(row[CONFIG.KOLOM_FOTO - 1]).trim()
      });
    }
  }

  if (listPeserta.length === 0) return;

  const targetFolder = dapatkanFolderSesi(dateStr, targetSesi);
  const totalHalaman = Math.ceil(listPeserta.length / CONFIG.MAKS_FOTO_PER_HALAMAN);

  Logger.log("Membuat kolase untuk " + listPeserta.length + " peserta (" + totalHalaman + " halaman)");

  // Buat Google Slides presentasi sementara untuk menyusun grid 3x2
  const slideDeck = SlidesApp.create("Temp_Kolase_" + dateStr + "_" + targetSesi);
  const slideId = slideDeck.getId();

  try {
    for (let p = 0; p < totalHalaman; p++) {
      const pageIndex = p + 1;
      const pesertaHalaman = listPeserta.slice(p * 6, (p + 1) * 6);
      
      const slide = (p === 0) ? slideDeck.getSlides()[0] : slideDeck.appendSlide();
      
      // Susun Header
      const headerBox = slide.insertTextBox(
        "ABSENSI " + targetSesi.toUpperCase() + "\\n" +
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

        // Ambil File Foto dari ID Drive
        try {
          const fileId = ambilDriveFileId(item.fotoUrl);
          if (fileId) {
            const fileBlob = DriveApp.getFileById(fileId).getBlob();
            slide.insertImage(fileBlob, x, y, 180, 130);
          }
        } catch (e) {
          slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, 180, 130);
        }

        // Teks Nama & NIP di bawah foto
        const textBox = slide.insertTextBox(item.nama + "\\nNIP: " + item.nip, x, y + 135, 180, 40);
        textBox.getText().getTextStyle().setFontSize(10).setBold(true);
      }
    }
    slideDeck.saveAndClose();

    // Export slides ke Drive Folder sebagai PDF / Image
    const pdfBlob = DriveApp.getFileById(slideId).getAs("application/pdf");
    pdfBlob.setName("Dokumentasi_Absensi_" + dateStr + "_" + targetSesi + ".pdf");
    targetFolder.createFile(pdfBlob);

  } finally {
    // Hapus file slide sementara agar Drive tetap bersih
    DriveApp.getFileById(slideId).setTrashed(true);
  }
}

/**
 * Ekstraksi ID File dari Tautan Google Drive / Google Forms
 */
function ambilDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/[-\\w]{25,}/);
  return match ? match[0] : null;
}

/**
 * Aksi Tombol Menu
 */
function menuGenerateKolaseHariIni() {
  const tglHariIni = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  generateKolaseUntukSesi(tglHariIni, "Pagi");
  generateKolaseUntukSesi(tglHariIni, "Sore");
  SpreadsheetApp.getUi().alert("Kolase hari ini (" + tglHariIni + ") berhasil dibuat/diperbarui di Google Drive!");
}

function bukaFolderDrive() {
  const folders = DriveApp.getFoldersByName(CONFIG.FOLDER_INDUK);
  if (folders.hasNext()) {
    const url = folders.next().getUrl();
    SpreadsheetApp.getUi().alert("Folder Drive Absensi:\\n" + url);
  } else {
    SpreadsheetApp.getUi().alert("Folder belum dibuat. Jalankan absensi terlebih dahulu.");
  }
}
`;
