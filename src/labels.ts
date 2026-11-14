const kindMap: Record<string, string> = {
  "file hash": "hash berkas",
  "file name": "nama berkas",
  "email address": "alamat email",
  "ip address": "alamat IP",
  domain: "domain",
  url: "URL",
};

/**
 * Terjemahan tampilan untuk detail alasan korelasi yang dibuat worker.
 * Kontrak API tidak berubah; hanya lapisan presentasi yang dilokalkan.
 */
export function reasonDetail(detail: string): string {
  if (!detail) return detail;
  let out = detail;
  const match = out.match(/^(.+?) match across both reports/i);
  if (match) {
    const label = kindMap[match[1].toLowerCase()] ?? match[1].toLowerCase();
    out = out.replace(/^.+? match across both reports/i, `${label} sama pada kedua laporan`);
  }
  out = out
    .replace(/ \(specificity adjusted: seen in (\d+) incidents?\)/gi, "; bobot disesuaikan karena muncul di $1 insiden")
    .replace(/ via blinded matching, raw value not disclosed/gi, "; nilai mentah tidak dibuka (blinded matching)")
    .replace(/; treated as common infrastructure, contribution capped/gi, "; infrastruktur umum, kontribusi dibatasi")
    .replace(/^observations are ([\d.,]+) hours? apart$/i, "selisih waktu $1 jam")
    .replace(/^observations are ([\d.,]+) days? apart$/i, "selisih waktu $1 hari");
  return out;
}
