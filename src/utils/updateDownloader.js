// 璐璐记账 · 更新下载工具函数

/**
 * 格式化字节数为人类可读字符串
 */
export function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

/**
 * 构建候选下载 URL 列表（按偏好排序）
 */
export function buildCandidateUrls(updateInfo, useProxy) {
  const list = [];
  const mirrors = updateInfo?.apk?.mirrors || [];
  const direct = updateInfo?.apk?.url;
  if (useProxy) {
    if (direct) list.push(direct);
    for (const m of mirrors) list.push(m);
  } else {
    for (const m of mirrors) list.push(m);
    if (direct) list.push(direct);
  }
  return list;
}
