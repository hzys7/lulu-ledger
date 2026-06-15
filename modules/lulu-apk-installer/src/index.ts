import { requireNativeModule } from 'expo-modules-core';

const LuluApkInstaller = requireNativeModule('LuluApkInstaller');

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
