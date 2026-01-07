import os
import sys
import argparse
from fontTools.ttLib import TTFont  # 导入 FontTools 的 TTFont
from fontTools import subset  # 导入 FontTools 的子集化模块，用于仅保留指定字符
from typing import Optional  # 导入 Optional，用于兼容 Python 3.8/3.9 的可选类型标注

# 尝试导入 otf2ttf，用于支持 OTF 转换
try:
    from otf2ttf.cli import otf_to_ttf
except ImportError:
    otf_to_ttf = None


def _read_common_text_from_file(file_path: str, encoding: str = "utf-8") -> str:
    """从文本文件读取“常用字/字符集合”。

    用途：
      - 让你把常用字放在一个 txt 文件里（可以换行、空格分隔），脚本读取后用于字体子集化。
    约定：
      - 会把所有空白字符当作“分隔符”忽略（例如换行、制表符）。
      - 默认会额外保留普通空格（U+0020）与全角空格（U+3000），避免子集后页面排版缺空格。
      - 子集化时重复字符不影响结果。
    """
    # 默认以 UTF-8 读取更通用；如果你的文件是 GBK/ANSI，可在命令行用 --encoding gbk。
    try:
        with open(file_path, "r", encoding=encoding) as f:
            text = f.read()
    except UnicodeDecodeError as e:
        raise ValueError(
            f"读取 {file_path} 失败：编码 {encoding} 不匹配。你可以尝试在命令行加 --encoding gbk"
        ) from e

    # 去掉可能存在的 UTF-8 BOM，避免把 BOM 当成一个需要保留的字符.
    normalized_text = text.lstrip("\ufeff")

    # 将空白字符当作分隔符（split 会按任意空白分隔），再拼回“纯字符集合”。
    # 说明：
    #   - 这样你可以把常用字一行一个/用空格隔开，脚本都能正确处理。
    #   - 这里不做复杂去重，FontTools 子集化对重复字符是幂等的.
    compact_text = "".join(normalized_text.split())

    # 补上普通空格（U+0020）与全角空格（U+3000），避免子集后排版出现空格缺字.
    return compact_text + " 　"


def _subset_font_by_text(font: TTFont, text: str) -> None:
    """按给定文本对子集化字体（原地修改 font）。

    说明：
      - 这一步会删除字体中“未被 text 用到”的字形和相关表数据，从而显著减小体积。
      - 子集化会影响字体覆盖范围：输出字体将只支持 text 中出现的字符。
    """
    cleaned_text = text
    if not cleaned_text:
        raise ValueError("common_text 为空：无法进行子集化")

    options = subset.Options()
    # 保留所有 name 信息，避免部分平台显示字体名称异常。
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    # 尽量保留 OpenType 布局特性（连字/kerning 等），避免子集后排版异常。
    options.layout_features = ["*"]
    # 保留 notdef（缺字方框）相关信息，避免极端情况下渲染异常。
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recommended_glyphs = True

    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=cleaned_text)
    subsetter.subset(font)


def ttf_to_woff2(
    input_path: str,
    output_path: str,
    common_chars_path: Optional[str] = None,
    common_text: Optional[str] = None,
    common_chars_encoding: str = "utf-8",
) -> None:
    """
    将 TTF/OTF 转换为 WOFF2 的简洁函数。
    参数：
      - input_path: 输入 TTF/OTF 文件路径
      - output_path: 输出 WOFF2 文件路径
      - common_chars_path: 常用字 txt 文件路径（提供则会先做子集化再转换）
      - common_text: 直接传入常用字字符串（提供则会先做子集化再转换）
      - common_chars_encoding: 读取 common_chars_path 时使用的编码（默认 utf-8）
    """
    print(f"正在读取字体: {input_path}", flush=True)
    font = TTFont(input_path)

    # 检测并处理 OTF 转换
    is_otf = input_path.lower().endswith(".otf") or font.sfntVersion == "OTTO"
    if is_otf:
        if otf_to_ttf is None:
            raise ImportError("未发现 otf2ttf 库，无法转换 OTF 文件。请先安装: pip install otf2ttf")
        print(f"检测到 OTF 格式，正在执行内存转换: {input_path}", flush=True)
        try:
            otf_to_ttf(font)
            print("OTF 已成功转换为 TTF (In-Memory)", flush=True)
        except Exception as e:
            print(f"OTF 转 TTF 失败: {e}", flush=True)
            raise

    # 如果提供了常用字，则先对子集化（仅保留这些字符需要的字形）。
    # 说明：
    #   - common_text 优先级高于 common_chars_path
    #   - 两者都不提供时，保持原行为：完整转换（不做子集化）
    if common_text is not None:
        print("正在按传入文本进行子集化...", flush=True)
        _subset_font_by_text(font, common_text)
    elif common_chars_path is not None:
        print(f"正在读取常用字表: {common_chars_path}", flush=True)
        file_text = _read_common_text_from_file(common_chars_path, encoding=common_chars_encoding)
        print("正在执行子集化转换...", flush=True)
        _subset_font_by_text(font, file_text)

    print("正在保存渲染为 woff2 格式...", flush=True)
    font.flavor = "woff2"          # 指定输出格式为 WOFF2（依赖 brotli）
    font.save(output_path)         # 写出结果
    print(f"转换成功! 已保存至: {output_path}", flush=True)


def _main() -> None:
    """命令行入口。

    用途：
      - 让你可以直接在终端运行该脚本进行转换，而不是改代码。
    示例：
      - python ttf2woff2.py --input a.ttf --output a.woff2
      - python ttf2woff2.py --input a.otf --output a.woff2
      - python ttf2woff2.py --input a.ttf --output a.woff2 --common-chars common_chars.txt
      - python ttf2woff2.py --input a.ttf --output a.woff2 --common-text "你好abc123"
    """

    parser = argparse.ArgumentParser(description="将 TTF/OTF 转换为 WOFF2，并支持按常用字子集化")
    parser.add_argument("--input", required=True, help="输入 TTF/OTF 文件路径")
    parser.add_argument("--output", required=True, help="输出 WOFF2 文件路径")
    parser.add_argument(
        "--common-chars",
        default=None,
        help="常用字 txt 文件路径（提供则先子集化再转换；文件可按空格/换行分隔）",
    )
    parser.add_argument(
        "--common-text",
        default=None,
        help="直接传入常用字字符串（提供则先子集化再转换；优先级高于 --common-chars）",
    )
    parser.add_argument(
        "--encoding",
        default="utf-8",
        help="读取 --common-chars 文件时使用的编码（默认 utf-8；Windows 上常见 gbk）",
    )

    args = parser.parse_args()

    ttf_to_woff2(
        input_path=str(args.input),
        output_path=str(args.output),
        common_chars_path=None if args.common_chars is None else str(args.common_chars),
        common_text=None if args.common_text is None else str(args.common_text),
        common_chars_encoding=str(args.encoding),
    )


if __name__ == "__main__":
    _main()