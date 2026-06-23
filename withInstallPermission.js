// Custom Expo config plugin: injects REQUEST_INSTALL_PACKAGES permission
// into AndroidManifest.xml AND sets the Android window background to white.
//
// The window background is the color shown at the OS level before React
// Native renders. Setting it to white eliminates any gray flash or
// gray edges caused by the default Android window background.
//
// Usage: add to app.json plugins array:
//   "./withInstallPermission"

const { withAndroidManifest, withAndroidStyles } = require('expo/config-plugins');

function addPermission(androidManifest, permission) {
  const manifest = androidManifest.manifest;
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }
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
  // Step 1: Add install permission
  config = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = addPermission(
      modConfig.modResults,
      'android.permission.REQUEST_INSTALL_PACKAGES'
    );
    return modConfig;
  });

  // Step 2: Force white window background at the Android theme level
  config = withAndroidStyles(config, (modConfig) => {
    const styles = modConfig.modResults;
    // Find the AppTheme style
    const appTheme = styles?.resources?.style?.find(
      (s) => s.$?.name === 'AppTheme'
    );
    if (!appTheme) return modConfig;

    // Remove existing windowBackground if any
    if (appTheme.item) {
      appTheme.item = appTheme.item.filter(
        (item) => item.$?.['name'] !== 'android:windowBackground'
      );
    } else {
      appTheme.item = [];
    }

    // Add white window background
    appTheme.item.push({
      $: { name: 'android:windowBackground' },
      _: '@android:color/white',
    });

    return modConfig;
  });

  return config;
};