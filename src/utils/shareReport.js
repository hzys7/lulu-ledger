// Share report as PDF — generates HTML, converts to PDF, then shares
// via the system share sheet (which includes WeChat, WhatsApp, etc.)

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { generateMonthlyReportHtml, generateYearlyReportHtml } from './generateReportHtml';
import { generateMonthlySummary, generateYearlySummary } from './export';

/**
 * Generate and share a monthly report PDF.
 *
 * @param {Array} transactions  Full transaction list
 * @param {number} year
 * @param {number} month       0-based (0 = January)
 * @param {Object} settings    App settings (for currency etc.)
 * @param {Object} catColors   Object mapping category names to hex colors
 * @param {string} title       Optional filename prefix (default: "璐璐记账月报")
 */
export async function shareMonthlyReport(transactions, year, month, settings, catColors, title) {
  const summary = generateMonthlySummary(transactions, year, month);
  const html = generateMonthlyReportHtml({
    year,
    month,
    ...summary,
    transactions,
    settings,
    catColors: catColors || {},
  });

  const dateStr = `${year}${String(month + 1).padStart(2, '0')}`;
  const fileName = `${title || '璐璐记账月报'}_${dateStr}.pdf`;

  const { uri } = await Print.printToFileAsync({ html });
  // Copy to a more accessible location (Print stores in a temp dir)
  const dest = new File(Paths.cache, fileName);
  const src = new File(uri);
  await src.copy(dest);

  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(dest.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `分享 ${dateStr} 月报`,
    });
  }
  return dest.uri;
}

/**
 * Generate and share a yearly report PDF.
 */
export async function shareYearlyReport(transactions, year, settings, catColors) {
  const summary = generateYearlySummary(transactions, year);
  const html = generateYearlyReportHtml({
    year,
    ...summary,
    catColors: catColors || {},
    settings,
  });

  const fileName = `璐璐记账年报_${year}.pdf`;
  const { uri } = await Print.printToFileAsync({ html });
  const dest = new File(Paths.cache, fileName);
  const src = new File(uri);
  await src.copy(dest);

  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(dest.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `分享 ${year} 年报`,
    });
  }
  return dest.uri;
}
