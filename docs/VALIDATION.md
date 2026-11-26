# 1.0.1 发布验证

日期：2026-11-26。

- 删除截图标出的五处文字；主计时暂停提示保留“计时已暂停”。计时逻辑未修改。
- 使用本机 Node.js、Rust 和 Visual Studio MSVC 工具链，Cargo 离线构建成功；EXE 产品版本为 1.0.1。
- 28 项计时单元测试、5 项桌面界面测试通过。另有 2 项 Android 前端模拟测试通过；首次并发运行在页面导航阶段超过 30 秒，单独以 60 秒超时重跑通过。
- 已查看更新后的桌面和平板截图；原有窗口尺寸、平板横竖屏布局检查通过。
- `release/StudioClock-1.0.1-windows-x64/StudioClock.exe`：3,292,160 字节。
- SHA-256：`ea72837c51b31d47c423a9ce9144d43e2462134bf6c3bedf5a965c5a03080a89`。
- 本次未重新启动原生窗口：检查时用户的 1.0.0 实例仍在运行。使用新版前应先退出旧版，避免单实例机制继续唤起旧窗口。

以下保留 1.0.0 的历史验证记录，其原生启动结果不代表本次重新执行。

# 1.0.0 发布验证

验证日期：2026-11-25。构建目标：Windows x86_64-pc-windows-msvc。

## 已通过

- `npm test`：28 项逻辑测试，包含到点启动、延迟回调补计、暂停 / 继续 / 重置、跨日、独立计时、设置保存和损坏数据恢复。
- `npm run test:ui`：5 项本机 Edge 自动化流程测试，包含真实按钮交互、计划修改、重启恢复、快捷键、输入校验和布局。
- 布局覆盖 1120×800、760×660、1920×1080、390×844；桌面窗口无水平或垂直裁切。
- 界面无 JavaScript 异常，资源请求全部来自本地。
- 时间设置使用独立 24 小时制时、分输入，不依赖 Windows 的 AM/PM 区域格式。
- `npm run release`：类型检查、Vue 生产构建、Rust 优化构建、许可证收集、便携包和 SHA-256 生成成功。
- 从发布目录启动 `StudioClock.exe`：已创建标题为“演播时钟 · Studio Clock”的窗口，进程响应正常。
- 第二次启动 EXE：第二进程以退出码 0 退出，保留原有实例。
- PE 依赖检查：未依赖单独的 VCRUNTIME / MSVCP DLL；仍使用 Windows 系统 DLL 和系统 WebView2。

## 产物

- `release/StudioClock-1.0.0-windows-x64/StudioClock.exe`：3,292,160 字节，约 3.14 MiB。
- `release/StudioClock-1.0.0-windows-x64.zip`：便携应用、说明、第三方许可证、SHA-256。
- `release/StudioClock-1.0.0-windows-x64/SHA256SUMS.txt`：EXE 的实际 SHA-256。

## 验证边界

桌面 Computer Use 工具初始化因运行环境错误 `windows sandbox failed: helper_unknown_error: setup refresh had errors` 失败，重置后仍未恢复。因此本次未自动点击验证原生窗口置顶、全屏、最小化和拖动；这些功能已编译，配置了对应的 Tauri 权限。EXE 的启动、窗口响应和单实例检查已独立完成。

尚未在不含 WebView2 的干净系统、其他 Windows 版本、多显示器和不同 DPI 环境中实机验证。应用使用本机时钟，不提供网络校时。
