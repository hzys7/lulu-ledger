// Lulu Ledger update checker.
// api.github.com works in most regions but times out (504) in mainland China.
// We fall back to the public GitHub Atom feed which is reachable from CN.
// The Atom feed has no asset URLs, so we CONSTRUCT the APK download URL
// from the tag using a stable naming convention
// (`lulu-ledger-${version}-arm64.apk`) -- the build-android.yml workflow
// has been changed to use exactly that name.

import Constants from 'expo-constants';

const GITHUB_REPO = 'hzys7/lulu-ledger';
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const ATOM_URL = `https://github.com/${GITHUB_REPO}/releases.atom`;

const apkAssetNameFor = (version) => `lulu-ledger-${version}-arm64.apk`;
const apkAssetUrlFor = (version) =>
  `https://github.com/${GITHUB_REPO}/releases/download/v${version}/${apkAssetNameFor(version)}`;

const MIRRORS = [
  'https://ghproxy.net/',
  'https://gh-proxy.com/',
  'https://cors.isteed.cc/',
];

function withMirror(githubUrl) {
  if (!githubUrl) return [];
  return MIRRORS.map((m) => m + githubUrl.replace(/^https?:/, 'https:'));
}

function parseVersion(v) {
  if (!v) return [0];
  return String(v).split('.').map((n) => parseInt(n, 10) || 0);
}

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

export function getLocalVersion() {
  return (
    Constants.expoConfig?.version ||
    Constants.manifest?.version ||
    '0.0.0'
  );
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function pickTagFromTitle(title) {
  if (!title) return null;
  const m = String(title).match(/v(\d+(?:\.\d+)+)/i);
  return m ? m[1] : null;
}

function parseAtomFeed(xml) {
  if (!xml) return null;
  const entryStart = xml.indexOf('<entry>');
  if (entryStart < 0) return null;
  const entryEnd = xml.indexOf('</entry>', entryStart);
  if (entryEnd < 0) return null;
  const entry = xml.slice(entryStart, entryEnd);

  const pick = (tag) => {
    const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i');
    const m = entry.match(re);
    return m ? m[1].trim() : '';
  };
  const pickAttr = (tag, attr) => {
    const re = new RegExp('<' + tag + '[^>]*\\s' + attr + '="([^"]+)"', 'i');
    const m = entry.match(re);
    return m ? m[1] : '';
  };

  const id = pick('id');
  const title = pick('title');
  const updated = pick('updated');
  const contentHtml = pick('content');
  const html_url = pickAttr('link', 'href');

  const idMatch = id.match(/\/v(\d+(?:\.\d+)+)$/);
  const version = idMatch ? idMatch[1] : pickTagFromTitle(title);
  if (!version) return null;

  const body = contentHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

  return {
    tag: 'v' + version,
    version,
    name: title || ('v' + version),
    body,
    publishedAt: updated,
    html_url,
  };
}

async function fetchLatestFromApi() {
  const res = await fetchWithTimeout(
    API_URL,
    { headers: { Accept: 'application/vnd.github+json' } },
    8000
  );
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('GitHub API ' + res.status);
  }
  const data = await res.json();
  const assets = (data.assets || []).map((a) => ({
    name: a.name,
    url: a.browser_download_url,
    size: a.size,
  }));
  return {
    tag: data.tag_name,
    version: (data.tag_name || '').replace(/^v/, ''),
    name: data.name || data.tag_name,
    body: data.body || '',
    publishedAt: data.published_at,
    html_url: data.html_url,
    assets,
    source: 'api',
  };
}

async function fetchLatestFromAtom() {
  const res = await fetchWithTimeout(
    ATOM_URL,
    { headers: { Accept: 'application/atom+xml' } },
    10000
  );
  if (!res.ok) throw new Error('GitHub Atom ' + res.status);
  const xml = await res.text();
  const parsed = parseAtomFeed(xml);
  if (!parsed) throw new Error('Atom: no parseable entry');
  return { ...parsed, source: 'atom' };
}

export async function fetchLatestRelease() {
  let apiErr = null;
  try {
    const fromApi = await fetchLatestFromApi();
    if (fromApi) return fromApi;
  } catch (e) {
    apiErr = e;
    console.warn('[updateChecker] api.github.com failed:', e && e.message || e);
  }

  try {
    const fromAtom = await fetchLatestFromAtom();
    if (fromAtom) {
      const url = apkAssetUrlFor(fromAtom.version);
      return {
        ...fromAtom,
        assets: [
          {
            name: apkAssetNameFor(fromAtom.version),
            url,
            size: 0,
          },
        ],
        _apiError: apiErr ? String(apiErr.message || apiErr) : null,
      };
    }
  } catch (e) {
    console.warn('[updateChecker] releases.atom failed:', e && e.message || e);
  }

  return null;
}

export async function checkForUpdate() {
  const local = getLocalVersion();
  const remote = await fetchLatestRelease();
  if (!remote) return { hasUpdate: false, local, remote: null, apk: null };
  const cmp = compareVersion(remote.version, local);
  const rawApk = remote.assets.find((a) => a.name.endsWith('.apk')) || null;
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
