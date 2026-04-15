# Tauri 2 GitHub Actions CI/CD 配置指南

本文档描述如何为 Tauri 2 项目配置 GitHub Actions，实现自动构建 Linux、Windows 和 Android 三个平台的安装包，并自动发布到 GitHub Releases。

## 目录

- [项目结构](#项目结构)
- [触发条件](#触发条件)
- [配置文件](#配置文件)
- [构建流程](#构建流程)
- [发布流程](#发布流程)
- [常见问题](#常见问题)

---

## 项目结构

```
exp1/
├── .github/
│   └── workflows/
│       └── build.yml          # CI/CD 工作流
├── src-tauri/
│   ├── tauri.conf.json       # Tauri 构建配置
│   └── icons/
│       ├── 32x32.png
│       ├── 128x128.png
│       ├── 128x128@2x.png
│       ├── icon.png
│       └── icon.ico           # Windows 必须
└── docs/
    └── ci-cd.md              # 本文档
```

---

## 触发条件

Workflow 在推送符合 `v*` 模式的 tag 时触发：

```yaml
on:
  push:
    tags:
      - 'v*'
```

**发布流程：**

```bash
# 1. 提交代码
git add .
git commit -m "feat: update"
git push

# 2. 创建 tag 并推送
git tag v0.1.0
git push origin v0.1.0
```

---

## 配置文件

### 1. tauri.conf.json

关键配置项：

```json
{
  "productName": "exp1",
  "version": "0.1.0",
  "identifier": "com.ruinb0w.exp1",
  "build": {
    "beforeBuildCommand": "bun run build",  // 使用 bun
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": ["appimage", "msi", "nsis"],  // 不包含 android，会自动处理
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.png",
      "icons/icon.ico"    // Windows NSIS 必须
    ]
  }
}
```

**注意：**
- `targets` 中的值会打包对应平台的安装包
- Android APK 会自动生成，不需要在 targets 中指定
- Windows 必须包含 `.ico` 格式图标

### 2. 图标生成

Windows 需要 `.ico` 格式图标，使用 ImageMagick 生成：

```bash
cd src-tauri/icons
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

---

## 构建流程

### Job 概览

| Job | Runner | 主要职责 |
|-----|--------|----------|
| `linux` | ubuntu-24.04 | 构建 AppImage |
| `windows` | windows-2022 | 构建 MSI + NSIS (exe) |
| `android` | ubuntu-24.04 | 构建 APK |
| `release` | ubuntu-latest | 创建 GitHub Release |

### Linux Job 关键步骤

```yaml
linux:
  runs-on: ubuntu-24.04
  steps:
    - uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2

    - name: Install Linux dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y \
          libgtk-3-dev \
          libwebkit2gtk-4.1-dev \
          libappindicator3-dev \
          librsvg2-dev \
          patchelf

    - name: Setup Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: x86_64-unknown-linux-gnu

    - name: Build Tauri
      run: bun tauri build

    - name: Upload artifacts
      uses: actions/upload-artifact@v4
      with:
        name: linux-build
        path: src-tauri/target/release/bundle/appimage/*.AppImage
```

### Windows Job 关键步骤

```yaml
windows:
  runs-on: windows-2022
  steps:
    - uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2

    - name: Setup Rust
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: x86_64-pc-windows-msvc

    - name: Build Tauri
      run: bun tauri build

    - name: Upload artifacts
      uses: actions/upload-artifact@v4
      with:
        name: windows-build
        path: |
          src-tauri/target/release/bundle/msi/*.msi
          src-tauri/target/release/bundle/nsis/*.exe
```

### Android Job 关键步骤

```yaml
android:
  runs-on: ubuntu-24.04
  steps:
    - uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2

    - name: Setup Java
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '17'

    - name: Setup Android SDK
      uses: android-actions/setup-android@v3

    - name: Generate debug keystore
      run: |
        mkdir -p ~/.android
        keytool -genkeypair -v -keystore ~/.android/debug.keystore \
          -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
          -storepass android -keypass android \
          -dname "CN=Android Debug,O=Android,C=US"

    - name: Build Tauri Android
      run: bun tauri android build

    - name: Upload artifacts
      uses: actions/upload-artifact@v4
      with:
        name: android-build
        path: src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk
```

### Release Job 关键步骤

```yaml
release:
  needs: [linux, windows, android]
  runs-on: ubuntu-latest
  permissions:
    contents: write
  steps:
    - name: Download Linux artifacts
      uses: actions/download-artifact@v4
      with:
        name: linux-build
        path: linux

    - name: Download Windows artifacts
      uses: actions/download-artifact@v4
      with:
        name: windows-build
        path: windows

    - name: Download Android artifacts
      uses: actions/download-artifact@v4
      with:
        name: android-build
        path: android

    - name: Create GitHub Release
      uses: softprops/action-gh-release@v2
      with:
        tag_name: ${{ github.ref_name }}
        generate_release_notes: true
        files: |
          linux/**/*.AppImage
          windows/**/*.msi
          windows/**/*.exe
          android/**/*.apk
```

**注意：** 由于 artifact 下载后保留原始目录结构，release 上传时需使用 `**` 递归匹配。

---

## 发布流程

完整发布命令：

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: release v0.2.0"
git push

# 2. 创建 tag
git tag v0.2.0

# 3. 推送 tag 触发 CI
git push origin v0.2.0
```

CI 自动完成：
1. 三个平台并行构建
2. 上传 artifacts
3. 下载所有 artifacts
4. 创建 GitHub Release 并上传产物

---

## 常见问题

### Linux 构建失败

**问题：** `glib-2.0` not found

**解决：** 安装必要的系统依赖：
```bash
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

### Windows 构建失败

**问题：** `.ico icon` not found

**解决：** 确保 `src-tauri/icons/` 目录下有 `icon.ico` 文件
```bash
cd src-tauri/icons
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

### Android 构建失败

**问题：** `debug.keystore` not found

**解决：** 在 CI 中生成 debug keystore：
```bash
mkdir -p ~/.android
keytool -genkeypair -v -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=Android Debug,O=Android,C=US"
```

### Release 找不到产物文件

**问题：** `Pattern 'windows/*.msi' does not match any files`

**原因：** artifact 下载后保留了原始目录结构

**解决：** 使用 `**` 递归匹配：
```yaml
files: |
  linux/**/*.AppImage
  windows/**/*.msi
  windows/**/*.exe
```

### Android APK 路径找不到

**问题：** `No files were found with the provided path`

**解决：** 确认 APK 实际路径，Android APK 通常位于：
```
src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

---

## 相关资源

- [Tauri Bundle Config](https://v2.tauri.app/reference/config/#bundle)
- [GitHub Actions](https://docs.github.com/en/actions)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)
