// Share report as image — captures a React Native View as PNG and shares
// via the system share sheet. No PDF involved.
//
// Usage (from a component):
//   import { shareCard } from '../utils/shareReport';
//   const cardRef = useRef(null);
//   // ... render <ViewShot ref={cardRef}><ShareCard ... /></ViewShot>
//   await shareCard(cardRef, '璐璐记账月报_202603');

import * as Sharing from 'expo-sharing';

/**
 * Capture a ViewShot ref and share the resulting PNG image.
 *
 * @param {Object} viewShotRef - React ref to a <ViewShot> component
 * @param {string} dialogTitle - Share dialog title
 * @returns {Promise<string>} The captured image URI
 */
export async function shareCard(viewShotRef, dialogTitle = '分享报告') {
  if (!viewShotRef?.current) {
    throw new Error('截图组件未就绪');
  }

  const uri = await viewShotRef.current.capture({
    format: 'png',
    quality: 0.92,
  });

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('当前设备不支持分享');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle,
  });

  return uri;
}
