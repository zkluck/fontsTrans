# FontsTrans 桌面工具

本仓库包含两个子项目：

- `py/`：Python CLI（TTF → WOFF2，支持常用字子集化），使用 `uv` 管理依赖，并提供 PyInstaller 打包脚本。
- `desktop/`：Electron + React 前端，使用 `pnpm` 管理依赖，打包时会把 PyInstaller 产物和内置常用字表一起打进安装包。

## 环境要求

- Python 3.10+（建议 3.12，与 uv 兼容）
- [uv](https://docs.astral.sh/uv/) 0.8+：用于管理 Python 依赖与运行 CLI / PyInstaller。
- Node.js 20+，建议使用 [pnpm](https://pnpm.io/)（本项目锁定 `pnpm-lock.yaml`）。
- Windows 开启“开发者模式”或以管理员运行终端，以便 electron-builder 可以创建符号链接（`signAndEditExecutable=true`）。

## 快速开始

```bash
# 1. 安装 Python 依赖
cd py
uv sync
uv run python src/ttf2woff2.py --help

# 2. Windows 打包 Python CLI
uv run powershell -ExecutionPolicy Bypass -File build-win.ps1

# 3. 安装桌面端依赖
cd ../desktop
pnpm install

# 4. 开发模式
pnpm run dev

# 5. 打包安装包（会读取 desktop/py 中的 ttf2woff2.exe + 常用字表）
pnpm run build
```

## 目录结构

```
fontsTrans/
├── README.md                # 当前文档
├── py/
│   ├── src/ttf2woff2.py
│   ├── build-win.ps1        # Windows: uv + PyInstaller 打包
│   ├── build-mac.sh         # macOS: uv + PyInstaller 打包
│   ├── dist/win32/          # PyInstaller 输出，build-win.ps1 会同步到 desktop/py/win32
│   └── dist/darwin/         # macOS 构建产物放这里，再复制到 desktop/py/darwin
└── desktop/
    ├── electron/            # 主进程 + preload
    ├── shared/              # IPC 类型
    ├── src/                 # React UI
    ├── py/                  # 随 Electron 打包的 Python 可执行文件
    └── resources/common_chars/  # 内置常用字表（3500 / 7000）
```

## 常见问题

- **TypeScript lint 警告**：当前 `typescript@5.9.3` 超出 `@typescript-eslint` 官方支持范围，会看到警告但不影响构建。若需消除，降至 5.5.x。
- **Electron 构建权限**：Windows 如提示 `Cannot create symbolic link`，请开启“开发者模式”或以管理员运行命令。
- **Python 依赖找不到**：确认已经在 `py/` 目录执行过 `uv sync`，并在运行 CLI/脚本时使用 `uv run ...`。
