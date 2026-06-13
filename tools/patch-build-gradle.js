#!/usr/bin/env node
// Patch the prebuild-generated android/app/build.gradle to add a release
// signing config that reads from environment variables (set by CI).
// Idempotent: safe to run multiple times.
//
// What this script does:
//   1. Locates `signingConfigs { ... }` and inserts a `release { }` block before
//      the closing brace, reading keystore from env vars with a local fallback.
//   2. In `buildTypes.release { ... }`, replaces `signingConfig signingConfigs.debug`
//      with `signingConfig signingConfigs.release`. Leaves .release alone.
//   3. Exits with non-zero status if either step did not take effect, so CI
//      fails fast instead of silently building with the debug keystore.
//
// Works on the file at: <repo_root>/android/app/build.gradle
// (CI runs from repo root; locally we resolve from this script's __dirname.)

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const buildGradlePath = path.join(repoRoot, 'android', 'app', 'build.gradle');

if (!fs.existsSync(buildGradlePath)) {
  console.error('[patch] build.gradle not found at', buildGradlePath, '- run expo prebuild first');
  process.exit(1);
}

let src = fs.readFileSync(buildGradlePath, 'utf8');

const SENTINEL = '// >>> lulu-ledger signing patch';
const END_SENTINEL = '// <<< lulu-ledger signing patch';

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Remove any previous patch block (idempotent re-runs).
if (src.includes(SENTINEL) && src.includes(END_SENTINEL)) {
  const re = new RegExp(
    '[ \\t]*' + escapeForRegex(SENTINEL) +
    '[\\s\\S]*?' +
    escapeForRegex(END_SENTINEL) +
    '\\n?',
    'g'
  );
  src = src.replace(re, '');
  console.log('[patch] removed previous patch block (idempotent re-run)');
}

// --- Step 1: insert release block inside signingConfigs { ... } ---

// Find the line range of the top-level `signingConfigs { ... }` block.
const lines = src.split(/\r?\n/);
let scStart = -1;
let scEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^\s*signingConfigs\s*\{\s*$/.test(lines[i])) { scStart = i; break; }
}
if (scStart === -1) {
  console.error('[patch] FAIL: could not find `signingConfigs {` in build.gradle');
  process.exit(1);
}
const scIndent = (lines[scStart].match(/^\s*/) || [''])[0].length;
for (let i = scStart + 1; i < lines.length; i++) {
  if (new RegExp('^\\s{' + scIndent + '}\\}\\s*$').test(lines[i])) { scEnd = i; break; }
}
if (scEnd === -1) {
  console.error('[patch] FAIL: could not find closing `}` of signingConfigs block');
  process.exit(1);
}

const innerIndent = ' '.repeat(scIndent + 4);
const releaseLines = [
  '',
  innerIndent + SENTINEL,
  innerIndent + 'release {',
  innerIndent + '    def ksFilePath = System.getenv(\'LULU_KEYSTORE_FILE\') ?: file(\'keys/lululedger-release.keystore\').absolutePath',
  innerIndent + '    storeFile file(ksFilePath)',
  innerIndent + '    storePassword System.getenv(\'LULU_KEYSTORE_PASS\') ?: \'lululedger2026\'',
  innerIndent + '    keyAlias System.getenv(\'LULU_KEY_ALIAS\') ?: \'lululedger\'',
  innerIndent + '    keyPassword System.getenv(\'LULU_KEY_PASS\') ?: \'lululedger2026\'',
  innerIndent + '}',
  innerIndent + END_SENTINEL,
];
lines.splice(scEnd, 0, ...releaseLines);

console.log('[patch] inserted release block before line', scEnd + 1, 'of signingConfigs');

// --- Step 2: flip buildTypes.release to use signingConfigs.release ---

const finalText = lines.join('\n');

// Match buildTypes { ... release { ... signingConfig signingConfigs.<x> ... } ... }.
// Match either .debug (needs flip) or .release (already done). Idempotent.
const BUILD_TYPES_RE = /(buildTypes\s*\{[\s\S]*?\n\s*release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.(debug|release)/;
const btMatch = finalText.match(BUILD_TYPES_RE);
if (!btMatch) {
  console.error('[patch] FAIL: could not find `signingConfig signingConfigs.<name>` inside buildTypes.release');
  process.exit(1);
}

let patched = finalText;
if (btMatch[2] === 'debug') {
  patched = finalText.replace(BUILD_TYPES_RE, '$1signingConfig signingConfigs.release');
  if (patched === finalText) {
    console.error('[patch] FAIL: signingConfig line was not modified (regex matched but no change)');
    process.exit(1);
  }
  console.log('[patch] flipped buildTypes.release signingConfig: debug -> release');
} else {
  console.log('[patch] buildTypes.release already uses signingConfigs.release (no change needed)');
}

fs.writeFileSync(buildGradlePath, patched, 'utf8');

// Echo the modified lines so CI logs make it obvious what was injected.
console.log('[patch] OK. Patched:', buildGradlePath);
const out = patched.split('\n');
out.forEach((line, idx) => {
  if (line.includes(SENTINEL) || line.includes(END_SENTINEL) ||
      /signingConfig\s+signingConfigs\.(debug|release)/.test(line) ||
      /^\s*release\s*\{\s*$/.test(line)) {
    console.log('  line ' + (idx + 1) + ': ' + line.trimEnd());
  }
});