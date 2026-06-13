# Android APK 打包步骤

完整流程：从零搭建 Android 编译环境到产出可安装的 `app-release.apk`。

## 1. 安装 JDK 17

```powershell
winget install --id EclipseAdoptium.Temurin.17.JDK -e --source winget
```

或手动下载：<https://adoptium.net/>（选择 Windows x64 JDK 17 .msi），安装到 `C:\Android\jdk-17`。

验证：
```powershell
& ''C:\Android\jdk-17\bin\java.exe'' -version
```

## 2. 安装 Android SDK

### 2.1 下载 cmdline-tools

到 <https://developer.android.com/studio#command-line-tools-only> 下载 Windows 版的 command line tools，文件名形如 `commandlinetools-win-XXXXXXX_latest.zip`。

解压到 `C:\Android\android-sdk\cmdline-tools\latest\`（必须有 `latest` 这一层），最终结构：

```
C:\Android\android-sdk\
  cmdline-tools\
    latest\
      bin\
      lib\
```

### 2.2 设置环境变量

```powershell
$env:JAVA_HOME = ''C:\Android\jdk-17''
$env:ANDROID_HOME = ''C:\Android\android-sdk''
$env:ANDROID_SDK_ROOT = ''C:\Android\android-sdk''
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
```

### 2.3 接受 licenses + 安装组件

```powershell
# 接受 licenses（用文件喂 y）
$temp = [System.IO.Path]::GetTempFileName()
''y'' * 50 | Out-File -FilePath $temp -Encoding ascii -NoNewline
Get-Content $temp | & ''C:\Android\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat'' --licenses

# 安装组件
& ''C:\Android\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat'' ''platform-tools'' ''platforms;android-35'' ''build-tools;35.0.0''
```

验证：
```powershell
& ''C:\Android\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat'' --list_installed
```

## 3. 生成 release keystore

见 [KEYSTORE_INFO.md](./KEYSTORE_INFO.md)。

## 4. Prebuild + Build

```powershell
cd C:\path\to\this\repo
npm install
npx expo prebuild --platform android --clean
cd android
.\gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

APK 位置：`android/app/build/outputs/apk/release/app-release.apk`

> 移除 `-PreactNativeArchitectures=arm64-v8a` 可以打全平台（armeabi-v7a + arm64-v8a + x86 + x86_64），但首次编译会从 ~14 分钟涨到 ~30+ 分钟。

## 5. 验证

```powershell
& aapt dump badging app-release.apk | Select-String "package|application-label"
& apksigner verify --print-certs --verbose app-release.apk
```

应看到 `versionCode=4 versionName=1.0.3` 和 `Verified using v2 scheme: true`。

## 6. 复制到手机

把 `app-release.apk` 传到手机（微信/数据线/网盘），点击安装。如果提示"未知来源"，到手机设置 → 安全 → 允许此来源安装。