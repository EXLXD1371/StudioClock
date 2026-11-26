# 演播时钟 · Studio Clock

基于 docs/requirements.md 的 Windows 演播室时钟。Vue 3 + TypeScript + Tauri 2，黑色界面，绿色主时钟 / 主计时，红色辅助计时，内置 JetBrains Mono 等宽字体。

## 直接运行

本机构建后双击 `release/StudioClock-1.0.1-windows-x64/StudioClock.exe`。

面向 Windows 10 / 11 x64，依赖系统 WebView2 Runtime，无需 Node.js、Rust、服务器或网络连接。C 运行库静态链接。具体规则、快捷键见 [使用说明](docs/USER_GUIDE.md)。

## 功能

- 本机日期、星期、24 小时制时钟。
- 精确到分钟的开播计划，支持跨日，倒计时到零后保持零。
- 主计时自动开始 / 手动开始 / 暂停 / 继续 / 重置。
- 独立计时器，互不影响。
- 自动保存与重启恢复；时间戳计算，避免后台节流造成漏秒。
- 全屏、窗口置顶、键盘快捷键、单实例。
- 本地字体和图标，运行时无外部资源请求。

需求文档中倒计时结束的句子未写完，本实现定义为归零后保持；参考图使用黄色主计时，但按文字要求采用绿色。首次计划默认为下一次 19:00，计划只执行一次。更改计划重置主计时，独立计时不变。

## 开发与构建

环境：Node.js 22.12+（本机使用 24）、Rust stable MSVC、Visual Studio C++ Build Tools、Windows SDK、WebView2。

```powershell
npm ci
npm run dev                 # 浏览器开发
npm run desktop:dev         # Tauri 开发窗口
npm test                    # 计时 / 跨日 / 恢复逻辑
npm run test:ui             # 使用本机 Edge 的界面测试
npm run build              # 类型检查与前端构建
npm run release            # 单测、生产构建、EXE、ZIP、SHA-256
```

首次需要网络下载 npm / Cargo 依赖。`package-lock.json` 与 `src-tauri/Cargo.lock` 固定依赖。可选 `npm run tauri -- build --bundles nsis` 生成安装包；默认 release 产物为免安装 EXE 和 ZIP。

运行依赖详情：[Tauri Windows 分发文档](https://v2.tauri.app/distribute/windows-installer/)。本项目使用系统 WebView2 以保持体积小，不内嵌整个浏览器运行时。

## 文件结构

- `src/clock.ts`：独立计时状态与日期规则。
- `src/useStudioClock.ts`：Vue 响应式状态、定时刷新、本地存储。
- `src/App.vue` / `src/style.css`：界面、设置、键盘和窗口控制。
- `src-tauri/`：Windows 窗口、权限、单实例与打包。
- `tests/`：计时逻辑单元测试与 Edge 界面流程测试。
- `scripts/release.ps1`：可重复的 Windows 发布构建。

计时依赖本机时钟；不会访问网络校时。当前产物未使用商业代码签名证书签名。

验证结果与范围见 [发布验证记录](docs/VALIDATION.md)。

## Android 平板版

平板安装包位于 `release/StudioClock-1.0.1-android/StudioClock-1.0.1-android.apk`。Android 8.0 及以上，系统 WebView 90+；支持横竖屏、原生全屏、屏幕常亮、离线使用。复用 Vue 界面与全部计时逻辑，采用 Android 系统 WebView 容器，不需要 Rust / NDK。

安装、签名备份和构建方式见 [Android 使用说明](docs/ANDROID.md)。运行 `npm run android:release` 生成签名 Release APK；构建不会覆盖已发布的 Windows EXE。

Android 发布构建、签名与兼容性验证范围见 [Android 验证记录](docs/ANDROID_VALIDATION.md)。

## 开源协议

本项目原创代码采用 [MIT License](LICENSE)，版权所有者为 **EXLXD1371**，版权年份为 **2026**。

你可以使用、修改、复制和分发本项目，也可以商用、出售副本或集成到闭源产品中。分发软件副本或其主要部分时，须保留原版权声明和完整 MIT 许可文本。软件按原样提供，不作任何担保。完整条款以 [LICENSE](LICENSE) 中的英文正文为准；[OSI 的 MIT 标准文本](https://opensource.org/license/mit) 可供查阅。

第三方代码、字体和图标继续遵循各自的许可证，本项目的 MIT 协议不替代这些许可。分发发布包时请一并保留 `LICENSE.txt` 和对应的第三方声明：Windows 版见 [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)，Android 版见 [ANDROID_THIRD_PARTY_NOTICES.txt](ANDROID_THIRD_PARTY_NOTICES.txt)。
