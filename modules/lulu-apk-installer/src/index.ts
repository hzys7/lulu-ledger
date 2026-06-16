import { requireNativeModule } from 'expo-modules-core';

const LuluApkInstaller = requireNativeModule('LuluApkInstaller');

// ─── Permission ──────────────────────────────────────────

/**
 * Check whether the "Install unknown apps" permission is already granted.
 */
export async function isInstallPermissionGranted(): Promise<boolean> {
  return LuluApkInstaller.isInstallPermissionGranted();
}

/**
 * Request the "Install unknown apps" permission from the system.
 * Returns true if granted, false if denied.
 */
export async function requestInstallPermission(): Promise<boolean> {
  return LuluApkInstaller.requestInstallPermission();
}

// ─── DownloadManager download ────────────────────────────

export interface DownloadProgress {
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | 'UNKNOWN';
  bytesDownloaded: number;
  totalBytes: number;
  progressPercent: number;
  reason: string;
}

/**
 * Download an APK using Android's DownloadManager system service.
 * Downloads to the public Downloads/ directory.
 * @returns downloadId - used by getDownloadProgress() and installDownloadedApk()
 */
export async function downloadApk(url: string, fileName: string): Promise<number> {
  return LuluApkInstaller.downloadApk(url, fileName);
}

/**
 * Poll the current download progress.
 */
export async function getDownloadProgress(downloadId: number): Promise<DownloadProgress> {
  return LuluApkInstaller.getDownloadProgress(downloadId);
}

/**
 * Install an APK that was downloaded via DownloadManager.
 * Uses the system's content:// URI (no custom FileProvider needed).
 */
export async function installDownloadedApk(downloadId: number): Promise<void> {
  return LuluApkInstaller.installDownloadedApk(downloadId);
}

/**
 * Get the content:// URI for a completed download (for fallback methods).
 */
export async function getDownloadedFileUri(downloadId: number): Promise<string> {
  return LuluApkInstaller.getDownloadedFileUri(downloadId);
}

// ─── Legacy install (from file:// or content:// URI) ────

/**
 * Install an APK from a URI string (legacy method, kept for fallback).
 */
export async function installApk(uriString: string): Promise<void> {
  return LuluApkInstaller.installApk(uriString);
}
