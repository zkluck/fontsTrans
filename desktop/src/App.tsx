import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { BuiltinCommonCharsOption } from '../shared/ipc';
import './App.css';

/**
 * 字体转换工具 UI - Premium Version.
 */
function App() {
  /**
   * 生成一个默认的输出路径建议。
   */
  const buildSuggestedOutputPath = (ttfPath: string): string => {
    const lower = ttfPath.toLowerCase();
    if (lower.endsWith('.ttf') || lower.endsWith('.otf')) {
      return ttfPath.slice(0, ttfPath.length - 4) + '.woff2';
    }
    return ttfPath + '.woff2';
  };

  const [inputPath, setInputPath] = useState<string>('');
  const [outputPath, setOutputPath] = useState<string>('');
  const [commonCharsPath, setCommonCharsPath] = useState<string>('');
  const [builtinCommonChars, setBuiltinCommonChars] = useState<
    BuiltinCommonCharsOption[]
  >([]);

  const [encoding, setEncoding] = useState<string>('utf-8');
  const [logs, setLogs] = useState<string[]>([]);
  const [converting, setConverting] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');

  useEffect(() => {
    const dispose = window.fontsTrans.onConvertLog((event) => {
      setLogs((prev: string[]) => {
        const next = prev.length > 500 ? prev.slice(prev.length - 500) : prev;
        // 修复日志末尾换行处理，确保每一条日志都在新的一行开始
        const text = event.text.endsWith('\n') ? event.text : event.text + '\n';
        return [...next, `[${event.source}] ${text}`];
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

  const suggestedOutputPath = useMemo(() => {
    if (!inputPath) return null;
    return buildSuggestedOutputPath(inputPath);
  }, [inputPath]);

  const canConvert = useMemo(() => {
    return Boolean(inputPath) && Boolean(outputPath) && !converting;
  }, [converting, inputPath, outputPath]);

  const onPickInput = async () => {
    setStatusText('');
    const selected = await window.fontsTrans.pickInputTtf();
    if (!selected) return;
    setInputPath(selected);
    if (!outputPath) {
      setOutputPath(buildSuggestedOutputPath(selected));
    }
  };

  const onPickOutput = async () => {
    setStatusText('');
    const selected = await window.fontsTrans.pickOutputWoff2(
      suggestedOutputPath
    );
    if (!selected) return;
    setOutputPath(selected);
  };

  const onPickCommonChars = async () => {
    setStatusText('');
    const selected = await window.fontsTrans.pickCommonCharsTxt();
    if (!selected) return;
    setCommonCharsPath(selected);
  };

  const onClearCommonChars = () => {
    setCommonCharsPath('');
  };

  const onUseBuiltinCommonChars = (option: BuiltinCommonCharsOption) => {
    setCommonCharsPath(option.path);
  };

  const onConvert = async () => {
    if (!inputPath || !outputPath) return;

    setStatusText('');
    setLogs([]);
    setConverting(true);

    const result = await window.fontsTrans.convertTtfToWoff2({
      inputPath,
      outputPath,
      commonCharsPath: commonCharsPath ? commonCharsPath : null,
      encoding: encoding || 'utf-8',
    });

    setConverting(false);
    if (result.ok) {
      setStatusText('✅ 转换成功');
      return;
    }

    setStatusText(`❌ ${result.errorMessage}`);
  };

  const onClearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="fontsTransApp">
      <div className="fontsTransApp__header">
        <h1 className="fontsTransApp__title">FontsTrans</h1>
        <p className="fontsTransApp__subtitle">专业的 TTF/OTF 转 WOFF2 子集化工具</p>
      </div>

      <div className="fontsTransApp__panel">
        {/* Section 1: Files */}
        <div className="fontsTransApp__section">
          <span className="fontsTransApp__sectionTitle">文件设置</span>

          <div className="fontsTransApp__row">
            <div className="fontsTransApp__label">输入 TTF/OTF</div>
            <div className="fontsTransApp__displayArea">
              <span className="fontsTransApp__value">
                {inputPath || '未选择源字体文件 (TTF/OTF)'}
              </span>
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
            <div className="fontsTransApp__label">输出路径</div>
            <div className="fontsTransApp__displayArea">
              <span className="fontsTransApp__value">
                {outputPath || '未选择导出目的地'}
              </span>
            </div>
            <button
              className="fontsTransApp__button"
              type="button"
              onClick={onPickOutput}
              disabled={converting}
            >
              保存位置
            </button>
          </div>
        </div>

        {/* Section 2: Optimization */}
        <div className="fontsTransApp__section">
          <span className="fontsTransApp__sectionTitle">字体子集化</span>

          <div className="fontsTransApp__row">
            <div className="fontsTransApp__label">常用字表</div>
            <div className="fontsTransApp__displayArea">
              <span className="fontsTransApp__value">
                {commonCharsPath || '完整转换（不进行子集化）'}
              </span>
            </div>
            <button
              className="fontsTransApp__button"
              type="button"
              onClick={onPickCommonChars}
              disabled={converting}
            >
              选择 .txt
            </button>
            {commonCharsPath && (
              <button
                className="fontsTransApp__button fontsTransApp__button--secondary"
                type="button"
                onClick={onClearCommonChars}
                disabled={converting}
              >
                清除
              </button>
            )}
          </div>

          {builtinCommonChars.length > 0 && (
            <div className="fontsTransApp__row">
              <div className="fontsTransApp__label">内置方案</div>
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
          )}

          <div className="fontsTransApp__row">
            <div className="fontsTransApp__label">转换选项</div>
            <div className="fontsTransApp__options">
              <div className="fontsTransApp__selectField" style={{ marginLeft: 0 }}>
                <span className="fontsTransApp__checkboxText">txt 编码:</span>
                <select
                  className="fontsTransApp__select"
                  value={encoding}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setEncoding(e.target.value)
                  }
                  disabled={converting}
                >
                  <option value="utf-8">UTF-8</option>
                  <option value="gbk">GBK</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Actions */}
        <div className="fontsTransApp__actions">
          <button
            className="fontsTransApp__button fontsTransApp__button--primary"
            type="button"
            onClick={onConvert}
            disabled={!canConvert}
          >
            {converting ? '正在转换...' : '立即开始转换'}
          </button>
        </div>

        {statusText && <div className="fontsTransApp__status">{statusText}</div>}
      </div>

      <div className="fontsTransApp__logPanel">
        <div className="fontsTransApp__logHeader">
          <span className="fontsTransApp__logTitle">运行状态</span>
          <button
            className="fontsTransApp__button fontsTransApp__button--secondary"
            style={{ height: '28px', padding: '0 12px', fontSize: '11px' }}
            type="button"
            onClick={onClearLogs}
            disabled={converting || logs.length === 0}
          >
            清空日志
          </button>
        </div>
        <pre className="fontsTransApp__log">{logs.join('')}</pre>
      </div>
    </div>
  );
}

export default App;
