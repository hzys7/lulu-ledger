#!/usr/bin/env node
// Patch the prebuild-generated android/app/proguard-rules.pro to add
// keep rules for expo-modules classes that R8 strips.
// Idempotent: safe to run multiple times.
//
// Missing classes error from R8:
//   expo.modules.core.interfaces.services.KeepAwakeManager
//   expo.modules.kotlin.types.AnyTypeProvider
//   expo.modules.kotlin.types.LazyKType
//
// These classes are only reachable via service-registry lookups and
// reflection, so R8 can't see them.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const proguardPath = path.join(repoRoot, 'android', 'app', 'proguard-rules.pro');

if (!fs.existsSync(proguardPath)) {
  console.error('[patch-proguard] proguard-rules.pro not found at', proguardPath, '- run expo prebuild first');
  process.exit(1);
}

let src = fs.readFileSync(proguardPath, 'utf8');

const SENTINEL = '# >>> lulu-ledger expo-av patch';
const END_SENTINEL = '# <<< lulu-ledger expo-av patch';

// Remove any previous patch (idempotent re-run)
if (src.includes(SENTINEL) && src.includes(END_SENTINEL)) {
  const re = new RegExp(
    '[ \\t]*' + escapeForRegex(SENTINEL) +
    '[\\s\\S]*?' +
    escapeForRegex(END_SENTINEL) +
    '\\n?',
    'g'
  );
  src = src.replace(re, '');
  console.log('[patch-proguard] removed previous patch block');
}

// Append keep rules at the end of the file
const patchBlock = [
  '',
  SENTINEL,
  '-keep class expo.modules.** { *; }',
  '-dontwarn expo.modules.**',
  END_SENTINEL,
  '',
].join('\n');

src += patchBlock;
fs.writeFileSync(proguardPath, src, 'utf8');

console.log('[patch-proguard] OK. Patched:', proguardPath);
// Echo patched lines
const out = src.split('\n');
out.forEach((line, idx) => {
  if (line.includes(SENTINEL) || line.includes(END_SENTINEL) || line.includes('-keep class expo') || line.includes('-dontwarn expo')) {
    console.log('  line ' + (idx + 1) + ': ' + line);
  }
});

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
