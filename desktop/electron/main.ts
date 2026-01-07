import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
} from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  IPC_CHANNEL,
  type ConvertRequest,
  type ConvertResponse,
  type ConvertLogEvent,
  type BuiltinCommonCharsOption,
} from '../shared/ipc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null;

/**
 * 是否已注册 IPC。
 * 用途：
 * - macOS 下 `activate` 可能多次调用 `createWindow()`，如果每次都 `ipcMain.handle` 会报错。
 * - 因此我们只在首次创建窗口时注册一次。
 */
let ipcRegistered = false;
const BUILTIN_COMMON_CHARS_CONFIG: Array<{
  id: string;
  label: string;
  filename: string;
}> = [
  {
    id: 'common-3500',
    label: '常用字表（3500 字）',
    filename: 'common_chars_3500.txt',
  },
  {
    id: 'common-7000',
    label: '常用字表（7000 字）',
    filename: 'common_chars_7000.txt',
  },
];

/**
 * 生成内置常用字表列表。
 * 用途：
 * - 让渲染进程可以直接使用官方提供的 txt，减少手动找文件步骤。
 */
function getBuiltinCommonCharsOptions(): BuiltinCommonCharsOption[] {
  const baseDir = app.isPackaged
    ? path.join(getResourcesPath(), 'common_chars')
    : path.join(process.env.APP_ROOT ?? __dirname, 'resources', 'common_chars');

  return BUILTIN_COMMON_CHARS_CONFIG.map((item) => {
    const candidatePath = path.join(baseDir, item.filename);
    if (!fs.existsSync(candidatePath)) {
      return null;
    }
    return {
      id: item.id,
      label: item.label,
      path: candidatePath,
    };
  }).filter((entry): entry is BuiltinCommonCharsOption => entry !== null);
}

/**
 * 获取主窗口实例。
 * 说明：
 * - 某些时刻（例如打开多个窗口/或窗口未聚焦）`BrowserWindow.getFocusedWindow()` 可能是 null。
 * - 我们优先取聚焦窗口，其次退回到 `win`。
 */
function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? win;
}

/**
 * 获取脚本/可执行文件的运行方式。
 * 用途：
 * - 开发态：直接调用 `python ttf2woff2.py ...`（方便调试，你本机需要有 Python）
 * - 生产态：调用随安装包一起分发的可执行文件（用户无需安装 Python）
 */
function resolvePythonCli(): {
  command: string;
  argsPrefix: string[];
  cwd: string;
} {
  // APP_ROOT 指向桌面工程根目录（即 package.json 所在目录）。
  const desktopProjectRoot = process.env.APP_ROOT;
  // Python 子项目位于仓库根目录的 py/ 中。
  const repoRoot = path.resolve(desktopProjectRoot, '..');
  const pythonSrcDir = path.join(repoRoot, 'py', 'src');

  if (app.isPackaged) {
    // `process.resourcesPath`：安装包解压后的 resources 目录。
    // 我们会把平台对应的可执行文件放到 `resources/py/<platform>/` 下。
    // 说明：
    // - Windows 与 macOS 的二进制不可互用。
    // - 采用分平台目录，可以让你在不同平台各自构建时，只打进对应平台的产物。
    const exeName =
      process.platform === 'win32' ? 'ttf2woff2.exe' : 'ttf2woff2';
    const resourcesPath = getResourcesPath();
    const exePath = path.join(resourcesPath, 'py', process.platform, exeName);
    return {
      command: exePath,
      argsPrefix: [],
      cwd: resourcesPath,
    };
  }

  // 开发态：使用 uv run python 确保依赖环境正确。
  const scriptPath = path.join(pythonSrcDir, 'ttf2woff2.py');
  return {
    command: 'uv',
    argsPrefix: [
      'run',
      '--project',
      path.join(repoRoot, 'py'),
      'python',
      scriptPath,
    ],
    cwd: repoRoot,
  };
}

/**
 * 获取 Electron 的 resourcesPath。
 * 说明：
 * - Electron 运行时会在 `process` 上注入 `resourcesPath`，但 Node 的类型声明里没有这个字段。
 * - 这里通过类型收窄来避免使用 `any`。
 */
function getResourcesPath(): string {
  const electronProcess = process as NodeJS.Process & { resourcesPath: string };
  return electronProcess.resourcesPath;
}

/**
 * 执行一次 ttf->woff2 转换。
 * 说明：
 * - 这个函数会把 stdout/stderr 实时回传给渲染进程，用于 UI 展示日志。
 */
function runConvert(
  browserWindow: BrowserWindow,
  request: ConvertRequest
): Promise<ConvertResponse> {
  return new Promise((resolve) => {
    const { command, argsPrefix, cwd } = resolvePythonCli();

    // 组装 CLI 参数。
    // 说明：
    // - 你现有的 python 脚本已经支持这些参数。
    // - 采用数组形式传参，可以避免路径中包含空格时的转义问题。
    const args: string[] = [
      ...argsPrefix,
      '--input',
      request.inputPath,
      '--output',
      request.outputPath,
    ];

    if (request.commonCharsPath) {
      args.push('--common-chars', request.commonCharsPath);
    }
    if (request.encoding) {
      args.push('--encoding', request.encoding);
    }

    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    // 把 Python 的 stdout/stderr 变成“日志事件”推送给渲染进程。
    // 用途：
    // - UI 可以显示运行中的日志。
    // - 一旦报错，stderr 也会对排查有帮助。
    child.stdout.on('data', (chunk: Buffer) => {
      const payload: ConvertLogEvent = {
        source: 'stdout',
        text: chunk.toString('utf-8'),
      };
      browserWindow.webContents.send(IPC_CHANNEL.convertLog, payload);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const payload: ConvertLogEvent = {
        source: 'stderr',
        text: chunk.toString('utf-8'),
      };
      browserWindow.webContents.send(IPC_CHANNEL.convertLog, payload);
    });

    child.on('error', (error: Error) => {
      resolve({
        ok: false,
        errorMessage: `启动转换进程失败：${error.message}`,
      });
    });

    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }

      // 说明：
      // - code 不为 0：一般是脚本内部异常 / 参数不合法 / 环境依赖缺失。
      // - signal：在极少数情况下，进程会被系统信号终止。
      const reason = signal ? `signal=${signal}` : `code=${String(code)}`;
      resolve({
        ok: false,
        errorMessage: `转换失败（${reason}），请查看日志输出`,
      });
    });
  });
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // 注册 IPC：确保只注册一次。
  // 说明：
  // - 这些 handle 会被 `preload.ts` 暴露给渲染进程。
  // - 渲染进程只负责 UI，所有文件系统/子进程能力都放在主进程侧。
  if (!ipcRegistered) {
    ipcRegistered = true;

    ipcMain.handle(IPC_CHANNEL.pickInputTtf, async () => {
      const browserWindow = getMainWindow();
      if (!browserWindow) return null;

      const result = await dialog.showOpenDialog(browserWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Font Files (TTF/OTF)', extensions: ['ttf', 'otf'] }],
      });

      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    });

    ipcMain.handle(IPC_CHANNEL.pickCommonCharsTxt, async () => {
      const browserWindow = getMainWindow();
      if (!browserWindow) return null;

      const result = await dialog.showOpenDialog(browserWindow, {
        properties: ['openFile'],
        filters: [{ name: 'TXT', extensions: ['txt'] }],
      });

      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    });

    ipcMain.handle(
      IPC_CHANNEL.pickOutputWoff2,
      async (_event: IpcMainInvokeEvent, suggestedPath: string | null) => {
        const browserWindow = getMainWindow();
        if (!browserWindow) return null;

        const result = await dialog.showSaveDialog(browserWindow, {
          defaultPath: suggestedPath ?? undefined,
          filters: [{ name: 'WOFF2', extensions: ['woff2'] }],
        });

        if (result.canceled || !result.filePath) return null;
        return result.filePath;
      }
    );

    ipcMain.handle(
      IPC_CHANNEL.convertTtfToWoff2,
      async (_event: IpcMainInvokeEvent, request: ConvertRequest) => {
        const browserWindow = getMainWindow();
        if (!browserWindow) {
          const response: ConvertResponse = {
            ok: false,
            errorMessage: '窗口未就绪，无法执行转换',
          };
          return response;
        }

        return runConvert(browserWindow, request);
      }
    );

    ipcMain.handle(IPC_CHANNEL.getBuiltinCommonChars, async () => {
      return getBuiltinCommonCharsOptions();
    });
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
