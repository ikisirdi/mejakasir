/**
 * Utility helper untuk mengonversi angka nominal Rupiah menjadi teks terbilang Bahasa Indonesia
 * Contoh: 1500000 -> "Satu Juta Lima Ratus Ribu Rupiah"
 */
export function terbilang(n: number): string {
  if (isNaN(n) || n === 0) return 'Nol Rupiah';
  
  const satuan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];
  
  function convert(num: number): string {
    num = Math.floor(Math.abs(num));
    if (num < 12) {
      return satuan[num];
    } else if (num < 20) {
      return convert(num - 10) + ' Belas';
    } else if (num < 100) {
      return convert(Math.floor(num / 10)) + ' Puluh ' + convert(num % 10);
    } else if (num < 200) {
      return 'Seratus ' + convert(num - 100);
    } else if (num < 1000) {
      return convert(Math.floor(num / 100)) + ' Ratus ' + convert(num % 100);
    } else if (num < 2000) {
      return 'Seribu ' + convert(num - 1000);
    } else if (num < 1000000) {
      return convert(Math.floor(num / 1000)) + ' Ribu ' + convert(num % 1000);
    } else if (num < 1000000000) {
      return convert(Math.floor(num / 1000000)) + ' Juta ' + convert(num % 1000000);
    } else if (num < 1000000000000) {
      return convert(Math.floor(num / 1000000000)) + ' Miliar ' + convert(num % 1000000000);
    } else {
      return convert(Math.floor(num / 1000000000000)) + ' Triliun ' + convert(num % 1000000000000);
    }
  }

  const result = convert(n).replace(/\s+/g, ' ').trim();
  return result ? `${result} Rupiah` : 'Nol Rupiah';
}
