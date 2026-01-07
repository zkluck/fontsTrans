# FontsTrans 桌面工具

**FontsTrans** 是一款专业的字体转换与子集化压缩工具，能够将庞大的 TTF/OTF 字体文件精简为适合网页使用的极小体积 WOFF2 格式。

本仓库包含两个子项目：

- `py/`：基于 `fontTools` 和 `otf2ttf` 的核心引擎。支持 TTF/OTF 解析、按字表子集化、以及 WOFF2 压缩。使用 `uv` 管理高性能 Python 环境。
- `desktop/`：基于 Electron + React 的跨平台桌面端。提供极具质感的深色玻璃拟态 (Glassmorphism) 界面，支持实时转换日志查看。

## 核心特性

- **双格式支持**: 完美支持 `.ttf` 和 `.otf` 格式输入。
- **内存级子集化**: 精准按需裁剪字体，支持 3500 字/7000 字内置常用字方案，或自定义 `.txt` 字表。
- **极致压缩**: 采用 WOFF2 标准压缩，大幅提升网页字体加载速度。
- **尊享界面**: 现代深色模式 UI，操作直观，交互丝滑。
- **零依赖运行**: 打包后的版本内置 Python 运行环境，由于不再需要用户手动安装环境。

## 环境要求 (用于开发)

- **Python 3.12+**: 建议配套 [uv](https://docs.astral.sh/uv/)。
- **Node.js 20+**: 建议使用 [pnpm](https://pnpm.io/)。
- **Windows**: 建议开启“开发者模式”以优化构建环境。

## 快速开始

### 1. 开发模式
```bash
# 准备 Python 环境
cd py
uv sync

# 启动桌面端
cd ../desktop
pnpm install
pnpm run dev
```

### 2. 生产打包
```bash
# 第一步：构建 Python 二进制 (Windows 示例)
cd py
uv run powershell -ExecutionPolicy Bypass -File build-win.ps1

# 第二步：构建 Electron 安装包
cd ../desktop
pnpm run build
```

## 目录结构

```
fontsTrans/
├── README.md                # 概览文档
├── py/
│   ├── src/ttf2woff2.py     # 转换引擎核心
│   └── pyproject.toml       # Python 依赖 (fonttools, brotli, otf2ttf)
└── desktop/
    ├── electron/            # Main 进程逻辑 (IPC, 进程调度)
    ├── src/                 # React UI (深色玻璃拟态方案)
    └── resources/common_chars/  # 内置常用字表资源
```

## 注意事项

- **子集化范围**: 如果没有提供常用字表，工具将执行全量转换。
- **日志乱码**: 已修复 Windows 终端下的 UTF-8 编码问题，确保日志中的中文字符清晰可见。
- **权限问题**: 在打包或开发时，如遇到符号链接创建失败，请尝试以管理员身份运行终端。
