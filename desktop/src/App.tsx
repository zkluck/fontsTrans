import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { BuiltinCommonCharsOption } from '../shared/ipc';
import './App.css';

/**
 * 字体转换工具 UI。
 * 用途：
 * - 提供“选择 TTF → 选择导出路径 → 转换 → 导出 WOFF2”的最小工作流。
 * - 调用 `window.fontsTrans`（由 preload 注入）与主进程通信，主进程负责执行 Python 转换。
 */
function App() {
  /**
   * 生成一个默认的输出路径建议。
   * 用途：
   * - 默认把 `.ttf` 替换成 `.woff2`。
   */
  const buildSuggestedOutputPath = (ttfPath: string): string => {
    const lower = ttfPath.toLowerCase();
    if (lower.endsWith('.ttf')) {
      return ttfPath.slice(0, ttfPath.length - 4) + '.woff2';
    }
    return ttfPath + '.woff2';
  };

  /**
   * 输入字体（TTF）路径。
   * 用途：
   * - 由用户选择的源文件路径。
   */
  const [inputPath, setInputPath] = useState<string>('');

  /**
   * 输出字体（WOFF2）路径。
   * 用途：
   * - 由用户选择的导出目标。
   */
  const [outputPath, setOutputPath] = useState<string>('');

  /**
   * 常用字表 txt 路径（可选）。
   * 用途：
   * - 若选择，则 Python 会先对子集化，再输出 woff2，从而显著减小体积。
   */
  const [commonCharsPath, setCommonCharsPath] = useState<string>('');
  /**
   * 内置常用字表列表。
   * 用途：
   * - 允许用户一键加载内置的 3500/7000 字表，减少自行找 txt 的成本。
   */
  const [builtinCommonChars, setBuiltinCommonChars] = useState<
    BuiltinCommonCharsOption[]
  >([]);

  /**
   * 是否追加基础 ASCII（英文/数字/基础标点）。
   * 用途：
   * - 默认开启，避免子集后英文缺字。
   */
  const [includeBasicAscii, setIncludeBasicAscii] = useState<boolean>(true);

  /**
   * 是否追加常用中文标点/全角空格。
   * 用途：
   * - 默认开启，避免子集后中文标点缺字。
   */
  const [includeBasicCjkPunct, setIncludeBasicCjkPunct] =
    useState<boolean>(true);

  /**
   * 读取常用字 txt 的编码。
   * 用途：
   * - Windows 上常见是 gbk。
   */
  const [encoding, setEncoding] = useState<string>('utf-8');

  /**
   * 转换过程日志。
   * 用途：
   * - 主进程会把 Python stdout/stderr 推送到渲染进程，这里汇总展示。
   */
  const [logs, setLogs] = useState<string[]>([]);

  /**
   * 当前是否正在转换。
   * 用途：
   * - 转换期间禁用按钮，避免重复点击。
   */
  const [converting, setConverting] = useState<boolean>(false);

  /**
   * 给用户展示的状态提示。
   * 用途：
   * - 成功/失败/校验提示。
   */
  const [statusText, setStatusText] = useState<string>('');

  /**
   * 订阅主进程的日志事件。
   * 说明：
   * - React StrictMode 在开发态可能触发 effect 的二次执行；preload 侧返回的取消函数可保证不会重复监听。
   */
  useEffect(() => {
    const dispose = window.fontsTrans.onConvertLog((event) => {
      setLogs((prev: string[]) => {
        const next = prev.length > 500 ? prev.slice(prev.length - 500) : prev;
        return [...next, `[${event.source}] ${event.text}`];
      });
    });

    return () => {
      dispose();
    };
  }, []);

  useEffect(() => {
    const setupBuiltin = async () => {
      const options = await window.fontsTrans.getBuiltinCommonChars();
      setBuiltinCommonChars(options);
    };
    void setupBuiltin();
  }, []);

  /**
   * 根据 inputPath 生成一个默认的输出路径建议。
   * 用途：
   * - 让“选择导出路径”对用户更友好，默认把 .ttf 替换成 .woff2。
   */
  const suggestedOutputPath = useMemo(() => {
    if (!inputPath) return null;
    return buildSuggestedOutputPath(inputPath);
  }, [inputPath]);

  /**
   * 是否已经满足“可开始转换”的最低条件。
   * 用途：
   * - 用于禁用按钮与快速提示。
   */
  const canConvert = useMemo(() => {
    return Boolean(inputPath) && Boolean(outputPath) && !converting;
  }, [converting, inputPath, outputPath]);

  /**
   * 选择输入 TTF 文件。
   */
  const onPickInput = async () => {
    setStatusText('');
    const selected = await window.fontsTrans.pickInputTtf();
    if (!selected) return;
    setInputPath(selected);

    const nextSuggestedOutputPath = buildSuggestedOutputPath(selected);

    // 用户首次选择输入文件时，如果还没选择输出路径，自动预填建议路径，减少操作。
    if (!outputPath) {
      setOutputPath(nextSuggestedOutputPath);
    }
  };

  /**
   * 选择导出 WOFF2 路径。
   */
  const onPickOutput = async () => {
    setStatusText('');
    const selected = await window.fontsTrans.pickOutputWoff2(
      suggestedOutputPath
    );
    if (!selected) return;
    setOutputPath(selected);
  };

  /**
   * 选择常用字表 txt（可选）。
   */
  const onPickCommonChars = async () => {
    setStatusText('');
    const selected = await window.fontsTrans.pickCommonCharsTxt();
    if (!selected) return;
    setCommonCharsPath(selected);
  };

  /**
   * 清空常用字表设置。
   */
  const onClearCommonChars = () => {
    setCommonCharsPath('');
  };

  /**
   * 使用内置常用字表。
   */
  const onUseBuiltinCommonChars = (option: BuiltinCommonCharsOption) => {
    setCommonCharsPath(option.path);
  };

  /**
   * 开始转换。
   */
  const onConvert = async () => {
    if (!inputPath) {
      setStatusText('请先选择输入 TTF 文件');
      return;
    }
    if (!outputPath) {
      setStatusText('请先选择导出 WOFF2 路径');
      return;
    }

    setStatusText('');
    setLogs([]);
    setConverting(true);

    const result = await window.fontsTrans.convertTtfToWoff2({
      inputPath,
      outputPath,
      commonCharsPath: commonCharsPath ? commonCharsPath : null,
      includeBasicAscii,
      includeBasicCjkPunct,
      encoding: encoding || 'utf-8',
    });

    setConverting(false);
    if (result.ok) {
      setStatusText('转换完成');
      return;
    }

    setStatusText(result.errorMessage);
  };

  /**
   * 清空日志。
   */
  const onClearLogs = () => {
    setLogs([]);
  };

  const commonCharsDisplay = useMemo(() => {
    return commonCharsPath || '（未选择，可选）';
  }, [commonCharsPath]);

  return (
    <div className="fontsTransApp">
      <div className="fontsTransApp__header">
        <div className="fontsTransApp__title">TTF 转 WOFF2</div>
        <div className="fontsTransApp__subtitle">选择文件 → 转换 → 导出</div>
      </div>

      <div className="fontsTransApp__panel">
        <div className="fontsTransApp__row">
          <div className="fontsTransApp__label">输入 TTF</div>
          <div className="fontsTransApp__value">
            {inputPath || '（未选择）'}
          </div>
          <button
            className="fontsTransApp__button"
            type="button"
            onClick={onPickInput}
            disabled={converting}
          >
            选择文件
          </button>
        </div>

        <div className="fontsTransApp__row">
          <div className="fontsTransApp__label">常用字表</div>
          <div className="fontsTransApp__value">{commonCharsDisplay}</div>
          <button
            className="fontsTransApp__button"
            type="button"
            onClick={onPickCommonChars}
            disabled={converting}
          >
            选择 txt
          </button>
          <button
            className="fontsTransApp__button fontsTransApp__button--secondary"
            type="button"
            onClick={onClearCommonChars}
            disabled={converting || !commonCharsPath}
          >
            清除
          </button>
        </div>
        {builtinCommonChars.length > 0 ? (
          <div className="fontsTransApp__row fontsTransApp__row--builtin">
            <div className="fontsTransApp__label">内置</div>
            <div className="fontsTransApp__builtinList">
              {builtinCommonChars.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="fontsTransApp__button fontsTransApp__button--builtin"
                  onClick={() => onUseBuiltinCommonChars(option)}
                  disabled={converting}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="fontsTransApp__row">
          <div className="fontsTransApp__label">导出 WOFF2</div>
          <div className="fontsTransApp__value">
            {outputPath || '（未选择）'}
          </div>
          <button
            className="fontsTransApp__button"
            type="button"
            onClick={onPickOutput}
            disabled={converting}
          >
            选择路径
          </button>
        </div>

        <div className="fontsTransApp__row fontsTransApp__row--options">
          <div className="fontsTransApp__label">选项</div>
          <div className="fontsTransApp__options">
            <label className="fontsTransApp__checkbox">
              <input
                type="checkbox"
                checked={includeBasicAscii}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setIncludeBasicAscii(e.target.checked)
                }
                disabled={converting}
              />
              <span className="fontsTransApp__checkboxText">
                保留基础 ASCII
              </span>
            </label>

            <label className="fontsTransApp__checkbox">
              <input
                type="checkbox"
                checked={includeBasicCjkPunct}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setIncludeBasicCjkPunct(e.target.checked)
                }
                disabled={converting}
              />
              <span className="fontsTransApp__checkboxText">
                保留常用中文标点
              </span>
            </label>

            <div className="fontsTransApp__field">
              <div className="fontsTransApp__fieldLabel">txt 编码</div>
              <select
                className="fontsTransApp__select"
                value={encoding}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setEncoding(e.target.value)
                }
                disabled={converting}
              >
                <option value="utf-8">utf-8</option>
                <option value="gbk">gbk</option>
              </select>
            </div>
          </div>
        </div>

        <div className="fontsTransApp__row fontsTransApp__row--actions">
          <button
            className="fontsTransApp__button fontsTransApp__button--primary"
            type="button"
            onClick={onConvert}
            disabled={!canConvert}
          >
            {converting ? '转换中…' : '开始转换'}
          </button>

          <button
            className="fontsTransApp__button fontsTransApp__button--secondary"
            type="button"
            onClick={onClearLogs}
            disabled={converting || logs.length === 0}
          >
            清空日志
          </button>
        </div>

        {statusText ? (
          <div className="fontsTransApp__status">{statusText}</div>
        ) : null}
      </div>

      <div className="fontsTransApp__logPanel">
        <div className="fontsTransApp__logTitle">日志</div>
        <pre className="fontsTransApp__log">{logs.join('')}</pre>
      </div>
    </div>
  );
}

export default App;
