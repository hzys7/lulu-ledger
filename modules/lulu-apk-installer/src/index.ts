import { requireNativeModule } from 'expo-modules-core';

const LuluApkInstaller = requireNativeModule('LuluApkInstaller');

/**
 * Check whether the "Install unknown apps" permission is already granted.
 * Returns true if granted, false otherwise.
 */
export async function isInstallPermissionGranted(): Promise<boolean> {
  return LuluApkInstaller.isInstallPermissionGranted();
}

/**
 * Request the "Install unknown apps" permission from the system.
 * Launches the system permission dialog (ACTION_MANAGE_UNKNOWN_APP_SOURCES)
 * and waits for the user's response.
 *
 * This is the key to fixing the grayed-out toggle: on many Android devices,
 * the settings toggle is disabled until the app has first triggered this
 * intent. After calling this, the toggle becomes clickable.
 *
 * Returns true if granted, false if denied.
 */
export async function requestInstallPermission(): Promise<boolean> {
  return LuluApkInstaller.requestInstallPermission();
}

/**
 * Install an APK from a content:// URI.
 *
 * Launches the system PackageInstaller via an Android Intent.
 * This is fire-and-forget – the promise resolves immediately after
 * the Intent is sent and does *not* wait for the user to finish
 * installing.
 *
 * @param uriString A content:// URI pointing to the APK file.
 */
export async function installApk(uriString: string): Promise<void> {
  return LuluApkInstaller.installApk(uriString);
}
