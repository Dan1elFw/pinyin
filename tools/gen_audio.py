#!/usr/bin/env python3
"""生成游戏用的朗读音频（微软神经网络语音），写入 audio/ 目录。

用法：
    pip install edge-tts
    python3 tools/gen_audio.py            # 只生成缺少的文件
    python3 tools/gen_audio.py --force    # 全部重新生成
    python3 tools/gen_audio.py --voice zh-CN-XiaoyiNeural --rate=-15%

音频文件按朗读的文字命名，例如 audio/苹果.mp3、audio/玻.mp3（声母 b 的代表字）。
已有的文件默认不会覆盖，所以可以把自己录的音放进去替换。
最后会重写 audio/manifest.js，列出 audio/ 里所有 mp3，游戏只播放清单里有的文件，没有的退回浏览器朗读。
"""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'js' / 'data.js'
AUDIO = ROOT / 'audio'


def collect_texts():
    src = DATA.read_text(encoding='utf-8')
    texts = []
    texts += [m.group(2) for m in re.finditer(r"\['([a-zü]+)', '(.)'\]", src)]                # 字母代表字
    texts += [m.group(1) for m in re.finditer(r"ex: \['([^']+)'", src)]                        # 声调例字
    texts += [m.group(1) for m in re.finditer(r"\['([^'\]]+)', '[a-zv0-5 ]+', '[^'a-z]+'\]", src)]  # 词语（第三项是 emoji）
    return list(dict.fromkeys(texts))


async def synth(text, path, voice, rate, sem):
    import edge_tts
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, voice, rate=rate).save(str(path))
                return True
            except Exception as e:  # 网络偶尔失败，重试
                if attempt == 2:
                    print(f'  失败 {text}: {e}', file=sys.stderr)
                await asyncio.sleep(1 + attempt)
    return False


def write_manifest():
    names = sorted(p.stem for p in AUDIO.glob('*.mp3'))
    (AUDIO / 'manifest.js').write_text(
        '// 由 tools/gen_audio.py 生成：audio/ 目录里已有的音频\n'
        f'window.AUDIO_FILES = {json.dumps(names, ensure_ascii=False)};\n', encoding='utf-8')
    return len(names)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', default='zh-CN-XiaoxiaoNeural')
    ap.add_argument('--rate', default='-10%')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()

    AUDIO.mkdir(exist_ok=True)
    texts = collect_texts()
    todo = [t for t in texts if args.force or not (AUDIO / f'{t}.mp3').exists()]
    print(f'共 {len(texts)} 条，需要生成 {len(todo)} 条（{args.voice}, 语速 {args.rate}）')
    if todo:
        try:
            import edge_tts  # noqa: F401
        except ImportError:
            sys.exit('请先安装：pip install edge-tts')
        sem = asyncio.Semaphore(6)
        ok = await asyncio.gather(*(synth(t, AUDIO / f'{t}.mp3', args.voice, args.rate, sem) for t in todo))
        print(f'生成成功 {sum(ok)} 条，失败 {len(ok) - sum(ok)} 条')
    print(f'manifest.js 已更新，共 {write_manifest()} 个音频')


if __name__ == '__main__':
    asyncio.run(main())
