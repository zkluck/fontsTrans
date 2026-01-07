/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string;
    /** /dist/ or /public/ */
    VITE_PUBLIC: string;
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  /**
   * 由 `preload.ts` 通过 `contextBridge` 注入的 API。
   * 用途：
   * - 渲染进程只调用这些受控函数。
   * - 具体实现由主进程 IPC 提供。
   */
  fontsTrans: import('../shared/ipc').FontsTransApi;
}
