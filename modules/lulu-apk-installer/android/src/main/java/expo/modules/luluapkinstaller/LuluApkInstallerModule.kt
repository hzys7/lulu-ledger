package expo.modules.luluapkinstaller

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LuluApkInstallerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LuluApkInstaller")

    /**
     * Check whether the user has granted the "Install unknown apps"
     * permission to this app.  On Android 8+ this is required before
     * launching ACTION_VIEW with an APK content URI.
     *
     * Returns true if the permission is already granted, false if the
     * user still needs to enable it in system settings.
     */
    AsyncFunction("isInstallPermissionGranted") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        appContext.throwingActivity.packageManager.canRequestPackageInstalls()
      } else {
        // Android 7 and below: no special permission needed
        true
      }
    }

    /**
     * Install an APK from a content:// URI.
     *
     * Launches the system PackageInstaller via ACTION_VIEW with the
     * correct MIME type and read-permission flag.  This is a
     * fire-and-forget call – the function resolves immediately after
     * the Intent is sent, because startActivity does not wait for
     * the user to finish the installation.
     *
     * Caller must check isInstallPermissionGranted() first and guide
     * the user to Settings if it returns false.
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
  }
}
