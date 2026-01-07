# 使用 FontTools 将 TTF 直接保存为 WOFF2
# 说明：
# 1. TTFont 读取原始 TTF 文件
# 2. 设置 flavor 为 'woff2' 告诉 FontTools 输出 WOFF2 格式
# 3. save() 写出目标文件，不做子集化，保留字体全部表

from fontTools.ttLib import TTFont  # 导入 FontTools 的 TTFont
from fontTools import subset  # 导入 FontTools 的子集化模块，用于仅保留指定字符
from typing import Optional  # 导入 Optional，用于兼容 Python 3.8/3.9 的可选类型标注


# 基础字符集合（可打印 ASCII 字符）。
# 用途：
#   - 你只维护汉字常用字表时，也能默认保留英文/数字/标点等字符，避免子集后页面出现缺字。
# 说明：
#   - 范围为 U+0020(空格) ~ U+007E(~)，不包含换行等控制字符。
BASIC_ASCII_TEXT = "".join(chr(code) for code in range(0x20, 0x7F))


# 常用中文标点与中文排版常见字符。
# 用途：
#   - 常用字表通常只覆盖汉字，可能不包含“，。！？《》【】（）”等中文标点。
#   - 全角空格（U+3000）在中文排版中也比较常见，默认一起保留，避免子集后出现缺字。
BASIC_CJK_PUNCT_TEXT = "，。！？、；：‘’“”《》【】（）—…·　"


def _build_subset_text(
    primary_text: str,
    include_basic_ascii: bool,
    include_basic_cjk_punct: bool,
) -> str:
    """构造用于子集化的最终字符集合。

    参数：
      - primary_text: 你提供的“常用字/字符集合”（通常来自文件或直接传入）
      - include_basic_ascii: 是否自动追加英文/数字/标点等基础字符集合
      - include_basic_cjk_punct: 是否自动追加常用中文标点与全角空格
    """
    # primary_text 可能包含换行/空格等，这里不做复杂清洗；文件读取函数会做空白规整。
    final_text = primary_text
    if include_basic_ascii:
        final_text += BASIC_ASCII_TEXT
    if include_basic_cjk_punct:
        final_text += BASIC_CJK_PUNCT_TEXT

    return final_text


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
    include_basic_ascii: bool = True,
    include_basic_cjk_punct: bool = True,
    common_chars_encoding: str = "utf-8",
) -> None:
    """
    将 TTF 转换为 WOFF2 的简洁函数。
    参数：
      - input_path: 输入 TTF 文件路径
      - output_path: 输出 WOFF2 文件路径
      - common_chars_path: 常用字 txt 文件路径（提供则会先做子集化再转换）
      - common_text: 直接传入常用字字符串（提供则会先做子集化再转换）
      - include_basic_ascii: 是否自动追加英文/数字/标点等基础字符（默认 True，推荐开启）
      - include_basic_cjk_punct: 是否自动追加常用中文标点与全角空格（默认 True，推荐开启）
      - common_chars_encoding: 读取 common_chars_path 时使用的编码（默认 utf-8）
    """
    font = TTFont(input_path)      # 读取 TTF

    # 如果提供了常用字，则先对子集化（仅保留这些字符需要的字形）。
    # 说明：
    #   - common_text 优先级高于 common_chars_path
    #   - 两者都不提供时，保持原行为：完整转换（不做子集化）
    if common_text is not None:
        final_text = _build_subset_text(common_text, include_basic_ascii, include_basic_cjk_punct)
        _subset_font_by_text(font, final_text)
    elif common_chars_path is not None:
        file_text = _read_common_text_from_file(common_chars_path, encoding=common_chars_encoding)
        final_text = _build_subset_text(file_text, include_basic_ascii, include_basic_cjk_punct)
        _subset_font_by_text(font, final_text)

    font.flavor = "woff2"          # 指定输出格式为 WOFF2（依赖 brotli）
    font.save(output_path)         # 写出结果


def _main() -> None:
    """命令行入口。

    用途：
      - 让你可以直接在终端运行该脚本进行转换，而不是改代码。
    示例：
      - python ttf2woff2.py --input a.ttf --output a.woff2
      - python ttf2woff2.py --input a.ttf --output a.woff2 --common-chars common_chars.txt
      - python ttf2woff2.py --input a.ttf --output a.woff2 --common-text "你好abc123"
    """
    import argparse  # 标准库 argparse，用于解析命令行参数

    parser = argparse.ArgumentParser(description="将 TTF 转换为 WOFF2，并支持按常用字子集化")
    parser.add_argument("--input", required=True, help="输入 TTF 文件路径")
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
        "--no-basic-ascii",
        action="store_true",
        help="禁用自动追加英文/数字/标点等基础字符集合（默认会追加，推荐保留）",
    )
    parser.add_argument(
        "--no-basic-cjk-punct",
        action="store_true",
        help="禁用自动追加常用中文标点与全角空格（默认会追加，推荐保留）",
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
        include_basic_ascii=not bool(args.no_basic_ascii),
        include_basic_cjk_punct=not bool(args.no_basic_cjk_punct),
        common_chars_encoding=str(args.encoding),
    )


if __name__ == "__main__":
    _main()