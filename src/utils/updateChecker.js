// 版本检查工具 - 调 GitHub Releases API
import Constants from 'expo-constants';
import * as Application from 'expo-application';

const GITHUB_REPO = 'hzys7/lulu-ledger';
// 走 https://api.github.com 不需要 token，限流 60 次/小时（你的 app 一小时不会启动 60 次）
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// 国内下载镜像：按顺序尝试，任意一个成功就停
// 国内下载镜像（已实测可达的只有 gh-proxy.com）
// 顺序很重要：先试速度更快的镜像，失败再回退 GitHub 原地址
const MIRRORS = [
  'https://gh-proxy.com/',
];

function withMirror(githubUrl) {
  if (!githubUrl) return [];
  return MIRRORS.map((m) => m + githubUrl.replace(/^https?\:/, 'https:'));
}

// 把 "1.0.5" 转成 [1, 0, 5]，方便对比
function parseVersion(v) {
  if (!v) return [0];
  return String(v).split('.').map(n => parseInt(n, 10) || 0);
}

// 对比版本：remote > local 返回 1，相等返回 0，小于返回 -1
export function compareVersion(remote, local) {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return 1;
    if (rv < lv) return -1;
  }
  return 0;
}

// 取当前 app 版本号（从 app.json 读）
export function getLocalVersion() {
  return (
    Constants.expoConfig?.version ||
    Constants.manifest?.version ||
    '0.0.0'
  );
}

// 调 GitHub 查最新 release
export async function fetchLatestRelease() {
  try {
    const res = await fetch(API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      // 404 通常是没创建过 release
      if (res.status === 404) return null;
      throw new Error(`GitHub API ${res.status}`);
    }
    const data = await res.json();
    return {
      tag: data.tag_name,           // e.g. "v1.0.6"
      version: (data.tag_name || '').replace(/^v/, ''),
      name: data.name || data.tag_name,
      body: data.body || '',         // release notes
      publishedAt: data.published_at,
      assets: (data.assets || []).map(a => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size,
      })),
    };
  } catch (e) {
    console.warn('[updateChecker] fetch failed:', e?.message || e);
    return null;
  }
}

// 主入口：检查是否有更新
// 返回 { hasUpdate, remote, local, apk }
export async function checkForUpdate() {
  const local = getLocalVersion();
  const remote = await fetchLatestRelease();
  if (!remote) return { hasUpdate: false, local, remote: null, apk: null };
  const cmp = compareVersion(remote.version, local);
  const rawApk = remote.assets.find(a => a.name.endsWith('.apk')) || null;
  const apk = rawApk
    ? { ...rawApk, mirrors: withMirror(rawApk.url) }
    : null;
  return {
    hasUpdate: cmp > 0,
    isUpToDate: cmp === 0,
    local,
    remote,
    apk,
  };
}