# Android 1.0.1 发布验证

日期：2026-11-26。

- 产物：`release/StudioClock-1.0.1-android/StudioClock-1.0.1-android.apk`，261,428 字节。
- 包名 `com.studioclock.tablet`，versionName `1.0.1`，versionCode `2`，minSdk 26，targetSdk / compileSdk 36。
- 使用本机 Visual Studio 共享 SDK：`C:/Program Files (x86)/Android/android-sdk`，Build Tools 37.0.0。
- 使用本机完整 JDK：`C:/Program Files/Android/openjdk/jdk-21.0.8`；Gradle 8.13 及依赖使用已有本机缓存，通过 `-Offline -UseMirror` 构建，无需重新下载环境。
- `assembleRelease`、`lintRelease`、APK v2 签名校验通过。Lint 为 0 错误、3 条提示：targetSdk 不是最新版本，以及两个固定 AndroidX 依赖有更新版本。未为此次文字调整升级 API 或依赖。
- SDK 目录只读导致包元数据写入提示，已安装平台和工具均成功读取并完成构建；没有修改该目录权限。
- APK 内置 JavaScript 检查确认指定文字已移除；中文名称、启动 Activity、版本和系统要求通过 `aapt dump badging` 检查。
- 签名证书 SHA-256 与 1.0.0 一致：`aec9568c6ff2224381fbc56077064a3c3dcee4568fe4cf0341d7140aa6a6b25b`，支持覆盖安装。
- APK SHA-256：`eb8220f5cade22c1ad83b96856b9edf3005433c1e2c03a0859da285777f3aa1c`。
- 28 项计时单元测试、5 项桌面测试、2 项平板前端模拟测试通过；平板测试首次在导航加载阶段超过 30 秒，单独以 60 秒超时重跑通过。
- 已检查 1280×800、960×600、800×1280、768×1024 平板布局。本次未做 Android 实机或模拟器安装测试。

以下保留 1.0.0 历史记录，其中的下载工具链已不用于本次发布。

# Android 1.0.0 发布验证

日期：2026-11-26。

## 产物

`release/StudioClock-1.0.0-android/StudioClock-1.0.0-android.apk`

- 261,708 字节（约 256 KiB）。
- 包名 `com.studioclock.tablet`，版本 `1.0.0`，versionCode `1`。
- minSdk 26（Android 8.0），targetSdk / compileSdk 36（Android 16）。
- 非调试 Release APK；使用本地独立发布密钥签名，APK Signature Scheme v2 校验通过。
- 不包含 CPU 专属原生库，不限制 ARM / ARM64 / x86 / x86_64 ABI。
- 网络、存储、摄像头、麦克风权限均未申请；合并清单仅含 AndroidX 自动添加的应用内部 signature 级动态接收器权限。
- SHA-256 见同目录 `SHA256SUMS.txt`。

## 已通过

- `npm test`：28 项计时逻辑测试。
- `npm run test:ui`：7 项界面测试，含 5 项原有计时流程与 2 项平板布局 / Android 桥接流程。
- 平板视口：1280×800、960×600 横屏，800×1280、768×1024 竖屏。主时钟、计时、控制区和底部均无裁切。
- Android 控件的前端模拟测试覆盖全屏、常亮与返回顺序（关闭设置 → 退出全屏 → 退至后台）。
- Vue Android 生产构建使用 Chrome 90 目标，并在原生启动时检查系统 WebView 版本。
- Gradle `assembleRelease` 与 `lintRelease` 通过。Lint 0 错误、2 条提示：当前固定的 AndroidX Activity / WebKit 依赖存在更新版本。
- Android 16 返回手势使用 AndroidX OnBackPressedDispatcher；自适应图标包含单色主题图标。
- `apksigner verify --verbose` 成功，`aapt dump badging` 确认系统版本、中文名称和启动 Activity。

## 构建环境

- Microsoft OpenJDK 21.0.13.1+2（完整 JDK，下载文件通过微软官方 SHA-256 校验）。
- Gradle 8.13，Android Gradle Plugin 8.13.2。
- Android Platform 36 revision 2、Build Tools 35.0.0、Platform Tools 37.0.3；SDK 下载包按 Google 官方仓库清单校验。
- Vue 业务逻辑与 Windows 版共用，Android 原生容器为 Java + 系统 WebView + AndroidX WebViewAssetLoader。

## 验证边界

ADB 检查未发现连接设备，未做平板实机或 Android 模拟器安装测试。浏览器中的 Android 桥接测试是前端模拟测试，不等同于验证原生手势、软键盘或特定设备的 WebView 实际行为。

未承诺后台唤醒或开播闹钟：进入后台后不运行前台服务，恢复时按照时间戳补计。常亮仅影响当前前台窗口。
