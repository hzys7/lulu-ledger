// Patch the prebuild-generated android/app/build.gradle to add a release
// signing config that reads from environment variables (set by CI).
// Idempotent: safe to run multiple times.
const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(buildGradlePath)) {
  console.error('build.gradle not found at', buildGradlePath, '- run expo prebuild first');
  process.exit(1);
}

let src = fs.readFileSync(buildGradlePath, 'utf8');

const SENTINEL = '// >>> lulu-ledger signing patch';
const END_SENTINEL = '// <<< lulu-ledger signing patch';

if (src.includes(SENTINEL)) {
  // Already patched - remove old block so we can re-insert
  const re = new RegExp(`[\\s]*${SENTINEL}[\\s\\S]*?${END_SENTINEL}\\n?`, 'g');
  src = src.replace(re, '');
}

// Step 1: Find the existing `signingConfigs { ... }` block and replace with
// a version that includes a release entry.
const SIGNING_BLOCK_RE = /signingConfigs\s*\{[\s\S]*?\n\s*\}/m;
const m = src.match(SIGNING_BLOCK_RE);
if (!m) {
  console.error('Could not find signingConfigs block in build.gradle');
  process.exit(1);
}

const inner = m[0].replace(/^\s*signingConfigs\s*\{/, '').replace(/\n\s*\}\s*$/, '');
const newBlock = `signingConfigs {
${inner}

        ${SENTINEL}
        release {
            def ksFilePath = System.getenv('LULU_KEYSTORE_FILE') ?: file('keys/lululedger-release.keystore').absolutePath
            storeFile file(ksFilePath)
            storePassword System.getenv('LULU_KEYSTORE_PASS') ?: 'lululedger2026'
            keyAlias System.getenv('LULU_KEY_ALIAS') ?: 'lululedger'
            keyPassword System.getenv('LULU_KEY_PASS') ?: 'lululedger2026'
        }
        ${END_SENTINEL}
    }`;
src = src.replace(m[0], newBlock);

// Step 2: Flip `buildTypes.release` to use signingConfigs.release.
// Use a careful multi-line match: find the `release {` block within buildTypes
// and replace its `signingConfig signingConfigs.debug` line.
src = src.replace(
  /(buildTypes\s*\{[\s\S]*?\n\s*release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
  '$1signingConfig signingConfigs.release'
);

fs.writeFileSync(buildGradlePath, src, 'utf8');
console.log('Patched', buildGradlePath);