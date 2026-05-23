# Codex 认证抓取

一个轻量的 Chrome Manifest V3 扩展，用于从当前浏览器的 `chatgpt.com` 登录态读取 Codex OAuth 凭证，并导出为多种工具可用的 JSON 格式。

> 安全提示：导出的 JSON 包含敏感凭证，请只在可信设备上使用。不要把导出文件、剪贴板内容或预览内容发送给他人，也不要提交到公开仓库。

## 功能

- 从 `https://chatgpt.com/api/auth/session` 读取当前浏览器登录态中的 OAuth `access_token`
- 支持复制到剪贴板并同时下载 JSON 文件
- 支持检查 GitHub 最新版本并下载更新包
- 支持导出格式：
  - `auth.json`
  - `CPA` / CLIProxyAPI 兼容格式
  - `sub2api` 兼容格式
  - `Cockpit Tools` 兼容格式
  - `CC Switch` Codex OAuth 兼容格式
- 缺失 `refresh_token` 时按空字符串导出：`"refresh_token": ""`
- 根据系统提示 Codex CLI 的 `auth.json` 保存位置
  - macOS / Linux：`~/.codex/auth.json`
  - Windows：`%USERPROFILE%\.codex\auth.json`

## 安装

1. 下载或克隆本仓库。
2. 打开 Chrome / Edge 的扩展管理页面。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本仓库目录。
6. 先在同一浏览器中登录 `chatgpt.com`，再点击扩展图标使用。

## 使用

1. 点击扩展面板中的“抓取凭证”。
2. 抓取成功后选择导出格式。
3. 扩展会同时：
   - 将 JSON 复制到剪贴板
   - 下载对应 `.json` 文件
4. 如需给 Codex CLI 使用，请把 `auth.json` 放到对应系统的 Codex 配置目录。

## 更新

点击面板右上角“更新”会检查 GitHub 仓库中的最新版本。由于 Chrome / Edge 不允许扩展在运行时覆盖自己的安装文件，按钮会在发现新版本时下载最新 ZIP。下载后请解压覆盖本地插件目录，再到扩展管理页点击重新加载。

## 文件名规则

- `auth.json`
- `codex-cpa-邮箱名.json`
- `codex-sub2api-邮箱名.json`
- `codex-cockpit-邮箱名.json`
- `codex-ccswitch-邮箱名.json`

如果邮箱不可用，会使用 `account_id` 或 `unknown` 作为文件名后缀。

## 权限说明

- `clipboardWrite`：复制导出的 JSON 到剪贴板
- `downloads`：下载导出的 JSON 文件
- `https://chatgpt.com/*`：读取当前登录态的 session 接口
- `https://raw.githubusercontent.com/*`：检查 GitHub 最新版本

## 格式来源

导出格式参考了对应项目或官方实现：

- OpenAI Codex CLI 认证结构
- CLIProxyAPI / CPA 的 Codex token storage 结构
- Cockpit Tools 的 Codex portable export / sub2api export 格式
- CC Switch 的 `codex_oauth_auth.json` Codex OAuth 持久化结构

---

# Codex Credential Exporter

A lightweight Chrome Manifest V3 extension that reads Codex OAuth credentials from the current browser session on `chatgpt.com` and exports them as JSON formats compatible with Codex CLI and related tools.

> Security notice: exported JSON files contain sensitive credentials. Use this extension only on trusted devices. Do not share exported files, clipboard contents, or preview data, and never commit real credentials to a public repository.

## Features

- Reads the OAuth `access_token` from `https://chatgpt.com/api/auth/session`
- Copies exported JSON to the clipboard and downloads it as a file
- Checks the latest GitHub version and downloads the update package
- Supported export formats:
  - `auth.json`
  - `CPA` / CLIProxyAPI-compatible format
  - `sub2api`-compatible format
  - `Cockpit Tools`-compatible format
  - `CC Switch` Codex OAuth-compatible format
- Exports missing `refresh_token` values as an empty string: `"refresh_token": ""`
- Shows the Codex CLI `auth.json` target path by operating system
  - macOS / Linux: `~/.codex/auth.json`
  - Windows: `%USERPROFILE%\.codex\auth.json`

## Installation

1. Download or clone this repository.
2. Open the Chrome / Edge extensions page.
3. Enable Developer mode.
4. Click “Load unpacked”.
5. Select this repository folder.
6. Sign in to `chatgpt.com` in the same browser, then open the extension popup.

## Usage

1. Click “抓取凭证” / “Grab credentials”.
2. Choose an export format after the credential is captured.
3. The extension will:
   - copy the JSON to your clipboard
   - download the JSON file
4. For Codex CLI, place `auth.json` in the Codex config directory for your OS.

## Updates

Click `更新` / `Update` in the popup header to check the latest version on GitHub. Chrome / Edge extensions cannot overwrite their own installed files at runtime, so the button downloads the latest ZIP when a newer version exists. Unzip it over the local extension folder, then reload the extension from the extensions page.

## Download File Names

- `auth.json`
- `codex-cpa-email.json`
- `codex-sub2api-email.json`
- `codex-cockpit-email.json`
- `codex-ccswitch-email.json`

If the email address is unavailable, the extension falls back to `account_id` or `unknown`.

## Permissions

- `clipboardWrite`: copy exported JSON to the clipboard
- `downloads`: download exported JSON files
- `https://chatgpt.com/*`: access the current browser session endpoint
- `https://raw.githubusercontent.com/*`: check the latest GitHub version

## Format References

The export formats are based on the official or project-side structures for:

- OpenAI Codex CLI authentication
- CLIProxyAPI / CPA Codex token storage
- Cockpit Tools Codex portable export and sub2api export formats
- CC Switch `codex_oauth_auth.json` Codex OAuth storage
