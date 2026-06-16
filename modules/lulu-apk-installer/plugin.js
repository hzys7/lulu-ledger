// Expo config plugin for lulu-apk-installer
// Registers the native module so it's compiled into the Android build.

const { withProjectBuildGradle } = require('expo/config-plugins');

module.exports = function luluApkInstallerPlugin(config) {
  return config;
};
