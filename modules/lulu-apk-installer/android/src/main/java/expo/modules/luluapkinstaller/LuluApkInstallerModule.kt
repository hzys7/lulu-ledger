package expo.modules.luluapkinstaller

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PERMISSION_REQUEST_CODE = 12345

class LuluApkInstallerModule : Module() {

  private var pendingPermissionPromise: Promise? = null
  private var downloadCompleteReceiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("LuluApkInstaller")

    // ─── Permission ───────────────────────────────────────────────

    AsyncFunction("isInstallPermissionGranted") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        appContext.throwingActivity.packageManager.canRequestPackageInstalls()
      } else {
        true
      }
    }

    AsyncFunction("requestInstallPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        promise.resolve(true)
        return@AsyncFunction
      }

      val activity = appContext.throwingActivity
      if (activity.packageManager.canRequestPackageInstalls()) {
        promise.resolve(true)
        return@AsyncFunction
      }

      pendingPermissionPromise?.reject("SUPERSEDED", "A new permission request was started", null)
      pendingPermissionPromise = promise

      try {
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
          data = Uri.parse("package:${activity.packageName}")
        }
        activity.startActivityForResult(intent, PERMISSION_REQUEST_CODE)
      } catch (e: Exception) {
        pendingPermissionPromise = null
        promise.reject("INTENT_FAILED", "Failed to launch permission dialog: ${e.message}", e)
      }
    }

    // ─── DownloadManager-based download ──────────────────────────

    /**
     * Download an APK using Android's DownloadManager system service.
     * Downloads to the public Downloads/ directory so the system
     * PackageInstaller can access it without any custom FileProvider.
     *
     * @param url       Direct download URL of the APK
     * @param fileName  File name to save as (e.g. "lulu-ledger-1.2.86.apk")
     * @return downloadId (Long) — used by getDownloadProgress() and
     *         installDownloadedApk()
     */
    AsyncFunction("downloadApk") { url: String, fileName: String ->
      val context = appContext.reactContext ?: throw Exception("ReactContext not available")
      val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

      val request = DownloadManager.Request(Uri.parse(url)).apply {
        setTitle("璐璐记账更新")
        setDescription("正在下载 $fileName")
        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
        setAllowedOverMetered(true)
        setAllowedOverRoaming(true)
        // Scoped storage: DownloadManager is one of the few APIs that
        // can write to the public Downloads/ dir without SAF.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          setRequiresStorageManager(false)
        }
      }

      manager.enqueue(request)
    }

    /**
     * Poll the current download progress and status.
     *
     * @param downloadId  Returned by downloadApk()
     * @return Map with keys:
     *   - status: String ("PENDING"|"RUNNING"|"SUCCESS"|"FAILED"|"PAUSED"|"UNKNOWN")
     *   - bytesDownloaded: Long
     *   - totalBytes: Long
     *   - progressPercent: Double (0..100)
     *   - reason: String? (failure/pause reason text)
     */
    AsyncFunction("getDownloadProgress") { downloadId: Long ->
      val context = appContext.reactContext ?: return@AsyncFunction mapOf(
        "status" to "UNKNOWN", "bytesDownloaded" to 0L, "totalBytes" to 0L,
        "progressPercent" to 0.0, "reason" to "ReactContext not available"
      )

      val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      val query = DownloadManager.Query().setFilterById(downloadId)
      var cursor: Cursor? = null

      try {
        cursor = manager.query(query)
        if (cursor == null || !cursor.moveToFirst()) {
          return@AsyncFunction mapOf(
            "status" to "UNKNOWN", "bytesDownloaded" to 0L, "totalBytes" to 0L,
            "progressPercent" to 0.0, "reason" to "Download not found"
          )
        }

        val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
        val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
        val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
        val reasonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON)
        val reason = if (reasonIdx >= 0) cursor.getString(reasonIdx) else null

        val statusStr = when (status) {
          DownloadManager.STATUS_PENDING -> "PENDING"
          DownloadManager.STATUS_RUNNING -> "RUNNING"
          DownloadManager.STATUS_SUCCESSFUL -> "SUCCESS"
          DownloadManager.STATUS_FAILED -> "FAILED"
          DownloadManager.STATUS_PAUSED -> "PAUSED"
          else -> "UNKNOWN"
        }

        val progress = if (total > 0) (downloaded.toDouble() / total.toDouble()) * 100.0 else 0.0

        return@AsyncFunction mapOf(
          "status" to statusStr,
          "bytesDownloaded" to downloaded,
          "totalBytes" to total,
          "progressPercent" to progress,
          "reason" to (reason ?: "")
        )
      } finally {
        cursor?.close()
      }
    }

    /**
     * Install an APK that was previously downloaded via DownloadManager.
     *
     * Uses DownloadManager.getUriForDownloadedFile() to get a system-
     * backed content:// URI that is accessible to the PackageInstaller
     * on all Android versions (no custom FileProvider needed).
     *
     * @param downloadId  Returned by downloadApk()
     */
    AsyncFunction("installDownloadedApk") { downloadId: Long ->
      val context = appContext.reactContext ?: throw Exception("ReactContext not available")
      val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      val uri = manager.getUriForDownloadedFile(downloadId)
          ?: throw Exception("Download not found or not completed")

      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      context.startActivity(intent)
    }

    /**
     * Get the content:// URI for a completed download (for use with
     * expo-sharing or other fallback methods).
     */
    AsyncFunction("getDownloadedFileUri") { downloadId: Long ->
      val context = appContext.reactContext ?: throw Exception("ReactContext not available")
      val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      val uri = manager.getUriForDownloadedFile(downloadId)
          ?: throw Exception("Download not found or not completed")
      uri.toString()
    }

    // ─── Legacy install (kept for backward compatibility) ────────

    AsyncFunction("installApk") { uriString: String ->
      val uri = Uri.parse(uriString)
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val activity = appContext.throwingActivity
      activity.startActivity(intent)
    }

    // ─── Activity result handler (permission request) ────────────

    OnActivityResult { _, payload ->
      if (payload.requestCode != PERMISSION_REQUEST_CODE) {
        return@OnActivityResult
      }

      val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        appContext.throwingActivity.packageManager.canRequestPackageInstalls()
      } else {
        true
      }
      pendingPermissionPromise?.resolve(granted)
      pendingPermissionPromise = null
    }
  }
}
