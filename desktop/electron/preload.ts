import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IPC_CHANNEL,
  type ConvertLogEvent,
  type ConvertRequest,
  type ConvertResponse,
  type FontsTransApi,
  type BuiltinCommonCharsOption,
} from '../shared/ipc';

/**
 * 暴露给渲染进程的安全 API。
 * 用途：
 * - 把“文件选择”“执行转换”等需要 Node/Electron 权限的能力放在主进程/预加载层。
 * - 渲染进程只拿到受控函数，避免直接访问 `ipcRenderer` 带来的安全风险。
 */
const api: FontsTransApi = {
  pickInputTtf: async () => {
    const result = await ipcRenderer.invoke(IPC_CHANNEL.pickInputTtf);
    return typeof result === 'string' ? result : null;
  },
  pickCommonCharsTxt: async () => {
    const result = await ipcRenderer.invoke(IPC_CHANNEL.pickCommonCharsTxt);
    return typeof result === 'string' ? result : null;
  },
  pickOutputWoff2: async (suggestedPath: string | null) => {
    const result = await ipcRenderer.invoke(
      IPC_CHANNEL.pickOutputWoff2,
      suggestedPath
    );
    return typeof result === 'string' ? result : null;
  },
  convertTtfToWoff2: async (request: ConvertRequest) => {
    const result = (await ipcRenderer.invoke(
      IPC_CHANNEL.convertTtfToWoff2,
      request
    )) as unknown;

    // 说明：
    // - `invoke` 的返回值类型在 TS 层面无法自动推断（它来自主进程）。
    // - 这里用最小必要的运行时检查，保证渲染进程不会因为主进程异常返回而崩溃。
    if (typeof result !== 'object' || result === null) {
      const fallback: ConvertResponse = {
        ok: false,
        errorMessage: '主进程返回值异常',
      };
      return fallback;
    }

    const ok = (result as { ok?: unknown }).ok;
    if (ok === true) {
      const response: ConvertResponse = { ok: true };
      return response;
    }

    const errorMessage = (result as { errorMessage?: unknown }).errorMessage;
    const response: ConvertResponse = {
      ok: false,
      errorMessage:
        typeof errorMessage === 'string' ? errorMessage : '转换失败',
    };
    return response;
  },
  onConvertLog: (listener: (event: ConvertLogEvent) => void) => {
    const handler = (_event: IpcRendererEvent, payload: ConvertLogEvent) => {
      listener(payload);
    };

    ipcRenderer.on(IPC_CHANNEL.convertLog, handler);

    // 返回取消订阅函数，避免窗口重复打开或 React StrictMode 下产生重复监听。
    return () => {
      ipcRenderer.off(IPC_CHANNEL.convertLog, handler);
    };
  },
  getBuiltinCommonChars: async () => {
    const result = (await ipcRenderer.invoke(
      IPC_CHANNEL.getBuiltinCommonChars
    )) as unknown;
    if (!Array.isArray(result)) {
      return [];
    }
    return result.filter((item): item is BuiltinCommonCharsOption => {
      return (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { id?: unknown }).id === 'string' &&
        typeof (item as { label?: unknown }).label === 'string' &&
        typeof (item as { path?: unknown }).path === 'string'
      );
    });
  },
};

contextBridge.exposeInMainWorld('fontsTrans', api);
