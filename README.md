# 我的待办桌面版

一个基于 **Tauri 2 + React + TypeScript** 的本地笔记、待办与日历桌面应用，支持 Windows 和 macOS。

## 已实现功能

- 今日待办与已完成分组
- 日历按日期管理待办
- 笔记管理
- 双击卡片原位置编辑
- 编辑时支持多行输入，保存后卡片只显示首行
- 笔记和待办删除
- 今日待办复制到明日
- 本机持久化存储，关闭软件后数据不丢失
- 自动保存状态提示
- Windows/macOS 键盘快捷键

## 快捷键

| 操作 | Windows | macOS |
|---|---|---|
| 新建 | `Ctrl + N` | `Command + N` |
| 保存编辑/新建 | `Ctrl + Enter` | `Command + Enter` |
| 取消 | `Esc` | `Esc` |
| 上下选择待办 | `↑` / `↓` | `↑` / `↓` |
| 编辑选中待办 | `Space` | `Space` |
| 删除选中待办 | `Delete` | `Delete` |

## 开发环境

需要安装：

- Node.js 20 LTS 或更高版本
- Rust stable
- Tauri 系统依赖

### Windows

需要安装 Microsoft C++ Build Tools 和 WebView2。Windows 10/11 通常已经带有 WebView2。

### macOS

安装 Xcode Command Line Tools：

```bash
xcode-select --install
```

## 本地运行

```bash
npm install
npm run tauri:dev
```

## 打包

```bash
npm run tauri:build
```

生成文件位置：

```text
src-tauri/target/release/bundle/
```

Windows 通常会生成 `.exe` 或 `.msi`，macOS 通常会生成 `.app` 和 `.dmg`。

## 推送到 GitHub

仓库地址：

```text
https://github.com/orange-pix-web/daiban.git
```

在项目目录执行：

```bash
git init
git branch -M main
git remote add origin https://github.com/orange-pix-web/daiban.git
git add .
git commit -m "feat: 初始化待办桌面版"
git push -u origin main
```

如果本地已经存在 `origin`：

```bash
git remote set-url origin https://github.com/orange-pix-web/daiban.git
git add .
git commit -m "feat: 初始化待办桌面版"
git push -u origin main
```

## GitHub Actions 打包

项目包含手动打包工作流：

1. 打开 GitHub 仓库的 **Actions**
2. 选择 **Build desktop app**
3. 点击 **Run workflow**
4. 构建完成后，在该次运行页面下载 Windows 或 macOS 构建产物

> macOS 安装包未签名时，系统可能提示开发者身份无法验证。正式分发需要配置 Apple Developer 签名与公证。
