// Custom Expo config plugin: injects REQUEST_INSTALL_PACKAGES permission
// into AndroidManifest.xml. Required for the APK self-update feature to
// work — without this the "Install unknown apps" toggle is grayed out.
//
// Usage: add to app.json plugins array:
//   "./withInstallPermission"

const { withAndroidManifest } = require('expo/config-plugins');

function addPermission(androidManifest, permission) {
  const manifest = androidManifest.manifest;
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }

  // Avoid duplicates
  const already = manifest['uses-permission'].some(
    (p) => p.$?.['android:name'] === permission
  );
  if (!already) {
    manifest['uses-permission'].push({
      $: { 'android:name': permission },
    });
  }

  return androidManifest;
}

module.exports = function withInstallPermission(config) {
  return withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = addPermission(
      modConfig.modResults,
      'android.permission.REQUEST_INSTALL_PACKAGES'
    );
    return modConfig;
  });
};
