/**
 * IPC 频道名与类型定义。
 * 用途：
 * - 让 main/preload/renderer 三端共享同一份频道名与数据结构，避免“魔法字符串”与字段不一致。
 * - 让 TypeScript 在编译期就能发现参数/返回值不匹配的问题。
 */

/**
 * IPC 频道名集合。
 * 说明：
 * - 统一采用 `fontsTrans:` 前缀，避免未来功能扩展时频道冲突。
 */
export const IPC_CHANNEL = {
  pickInputTtf: 'fontsTrans:pickInputTtf',
  pickOutputWoff2: 'fontsTrans:pickOutputWoff2',
  pickCommonCharsTxt: 'fontsTrans:pickCommonCharsTxt',
  convertTtfToWoff2: 'fontsTrans:convertTtfToWoff2',
  convertLog: 'fontsTrans:convertLog',
  getBuiltinCommonChars: 'fontsTrans:getBuiltinCommonChars',
} as const;

/**
 * 转换请求参数。
 * 用途：
 * - 渲染进程把用户选择的路径与选项传给主进程。
 * - 主进程拼接为 `ttf2woff2.py` 的 CLI 参数执行。
 */
export type ConvertRequest = {
  inputPath: string;
  outputPath: string;
  commonCharsPath: string | null;
  encoding: string;
};

/**
 * 转换结果。
 * 说明：
 * - `ok=false` 时，`errorMessage` 给 UI 展示。
 */
export type ConvertResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      errorMessage: string;
    };

/**
 * 转换过程日志事件。
 * 用途：
 * - 主进程把 Python 的 stdout/stderr 实时推送给渲染进程做日志展示。
 */
export type ConvertLogEvent = {
  source: 'stdout' | 'stderr';
  text: string;
};

/**
 * 暴露给渲染进程的 API 形状。
 * 说明：
 * - 通过 preload 的 `contextBridge` 注入到 `window.fontsTrans`。
 * - 渲染进程只依赖这里的函数，不直接接触 `ipcRenderer`，降低安全风险与耦合。
 */
export type FontsTransApi = {
  pickInputTtf: () => Promise<string | null>;
  pickCommonCharsTxt: () => Promise<string | null>;
  pickOutputWoff2: (suggestedPath: string | null) => Promise<string | null>;
  convertTtfToWoff2: (request: ConvertRequest) => Promise<ConvertResponse>;
  onConvertLog: (listener: (event: ConvertLogEvent) => void) => () => void;
  getBuiltinCommonChars: () => Promise<BuiltinCommonCharsOption[]>;
};

/**
 * 内置常用字表选项。
 * 用途：
 * - 让 UI 可以列出官方内置的 txt，点击即可引用。
 */
export type BuiltinCommonCharsOption = {
  id: string;
  label: string;
  path: string;
};
