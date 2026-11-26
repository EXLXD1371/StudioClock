# 演播时钟 Android 平板版

## 安装与运行

将 `StudioClock-1.0.1-android.apk` 发送或复制到平板，在平板文件管理器中打开并按系统提示安装。应用名称为“演播时钟”。1.0.1 删除了指定的五处提示文字，沿用原发布签名，可覆盖安装 1.0.0。这是可直接侧载安装的签名 Release APK。

支持 Android 8.0（API 26）及以上，系统 Android System WebView 需为 90 或更新版本。APK 不含 CPU 专属原生库，同一份包适用于常见 ARM / ARM64 / x86 / x86_64 设备。无需另装 Windows WebView2。

首次启动默认全屏，默认保持屏幕常亮。右上角太阳按钮可切换常亮，展开按钮可退出或进入全屏。常亮仅在应用处于前台时有效；离开应用后系统正常息屏。横竖屏自动适配。

设置开播时间、自动开始、主计时与独立计时的操作与 Windows 版一致。设置保存在平板本地，与电脑端不自动同步。返回键依次关闭设置、退出全屏、将应用切至后台。

计时按本机时间戳计算。切到后台或锁屏后不要求系统持续运行计时任务，回到应用时会补计已经过去的时间。它不是后台闹钟，不会在后台唤醒屏幕或弹出开播通知。修改系统时间也会影响计时结果。

界面、字体和图标全部内置。应用不申请网络、文件存储、摄像头或麦克风权限。卸载应用或清除应用数据会清除计时设置。

## 项目与构建

Android 使用轻量原生 WebView 容器，并与 Windows 版共享 `src/` 下的 Vue 业务逻辑。通过 AndroidX WebViewAssetLoader 从 APK 读取本地 HTTPS 资源；所有外部导航和资源请求均被阻止。

环境：完整 JDK 17 或 21（需含 javac、jlink）、Gradle 8.13、Android SDK Platform 36、Build Tools 35.0.0 或更高版本。Android Gradle Plugin 固定为 8.13.2。发布脚本选择 SDK 中已安装的最新稳定版 Build Tools，也可通过 `-BuildToolsVersion` 显式指定。

```powershell
# 使用本机 Visual Studio 附带的 SDK / JDK 和已有依赖缓存
./scripts/android-release.ps1 -SdkPath 'C:/Program Files (x86)/Android/android-sdk' -JavaPath 'C:/Program Files/Android/openjdk/jdk-21.0.8' -Offline -UseMirror
```

SDK / JDK 优先使用参数和环境变量；未指定时先查找 Visual Studio 共享安装目录，SDK 还会检查用户目录中的 `Android/Sdk`，最后才使用项目 `.runtime` 缓存。Gradle 位于 `.runtime/android-tools/gradle-8.13`，可通过 `-GradlePath` 指定其他安装位置。`-Offline` 让 Gradle 只使用本机依赖缓存；`-UseMirror` 也用于匹配之前镜像仓库的缓存。需要联网代理时传入 `-Proxy http://127.0.0.1:端口`，只影响本次构建。

发布脚本执行单测、Vue Android 构建、Gradle Release 构建、Android Lint、APK 签名校验，然后将产物和 SHA-256 写入 `release/StudioClock-1.0.1-android/`。

签名密钥位于 `android/signing/studio-clock-release.jks`，密码配置在 `android/keystore.properties`；二者均不进入 Git 或发布目录。请妥善备份这两个文件，后续覆盖安装更新必须使用同一签名密钥。不要只保留 APK 后删除密钥。

## 验证范围

平板横竖屏布局和前端 Android 控件通过模拟桥接的浏览器测试验证；这些测试不等同于 Android 真机验证。本次未进行平板实机安装测试，实际构建、签名和静态检查结果见项目发布验证记录。

验证记录：`docs/ANDROID_VALIDATION.md`。1.0.1 发布构建、签名校验和 35 项自动测试已通过；Android Lint 为 0 错误、3 条 API / 依赖版本更新提示。
