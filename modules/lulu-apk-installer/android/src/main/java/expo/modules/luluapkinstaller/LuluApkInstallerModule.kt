package expo.modules.luluapkinstaller

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PERMISSION_REQUEST_CODE = 12345

class LuluApkInstallerModule : Module() {

  private var pendingPermissionPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("LuluApkInstaller")

    /**
     * Check whether the user has granted the "Install unknown apps"
     * permission to this app.  On Android 8+ this is required before
     * launching ACTION_VIEW with an APK content URI.
     */
    AsyncFunction("isInstallPermissionGranted") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        appContext.throwingActivity.packageManager.canRequestPackageInstalls()
      } else {
        true
      }
    }

    /**
     * Request the "Install unknown apps" permission via system dialog.
     * Uses ACTION_MANAGE_UNKNOWN_APP_SOURCES which triggers the system
     * permission prompt directly (not just the settings page).
     *
     * This is the key fix: on many Android devices the settings toggle
     * appears grayed-out until the app has first triggered this intent.
     *
     * Returns true if granted, false if denied.
     */
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

      // Reject any previous pending promise
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

    /**
     * Install an APK from a content:// URI.
     *
     * Launches the system PackageInstaller via ACTION_VIEW with the
     * correct MIME type and read-permission flag.  Fire-and-forget.
     *
     * Caller must check isInstallPermissionGranted() first.
     *
     * @param uriString A content:// URI backed by a FileProvider that
     *   points to the APK file on disk.
     */
    AsyncFunction("installApk") { uriString: String ->
      val uri: Uri = Uri.parse(uriString)
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val activity = appContext.throwingActivity
      activity.startActivity(intent)
    }

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
