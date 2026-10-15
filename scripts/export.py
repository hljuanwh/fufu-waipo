#!/usr/bin/env python3
"""把 Obsidian 里的技能清单和本周要点导出成外婆页的 docs/data.json。

内容没变就什么都不做；变了才写文件。加 --push 会顺手 commit 并推到 GitHub（推失败重试 3 次）。
每晚 23:30 的 jz-night 任务会跑：python3 ~/Documents/Claude/福福外婆页/scripts/export.py --push
解析规则跟工作台插件一致（parseList / parseTips）。
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta

VAULT = os.path.expanduser('~/Documents/Sherry')
SKILLS = os.path.join(VAULT, '12-工作台/育儿/技能清单.md')
TIPS = os.path.join(VAULT, '12-工作台/育儿/本周要点.md')
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, 'docs', 'data.json')
BABY = {'name': '福福', 'birth': '2024-11-10'}
LEVELS = ['不会', '会', '熟练']
FIELD = re.compile(r'\s*\[([^\[\]:]+?)::\s*([^\]]*)\]')


def split_fields(text):
    f = {}
    def take(m):
        f[m.group(1).strip()] = m.group(2).strip()
        return ''
    return FIELD.sub(take, text).strip(), f


def month_of(sec):
    m = re.match(r'\s*(\d+)', sec)
    return int(m.group(1)) if m else 0


def read_skills():
    out, sec = [], ''
    with open(SKILLS, encoding='utf-8') as fh:
        for line in fh.read().split('\n'):
            h = re.match(r'^##\s+(.+?)\s*$', line)
            if h:
                sec = h.group(1)
                continue
            m = re.match(r'^- (?!\[[ xX]\] )(.+)$', line)
            if not m:
                continue
            name, f = split_fields(m.group(1))
            if not name:
                continue
            month = month_of(sec)
            out.append({'k': f'{month}|{name}', 'month': month, 'name': name, 'dim': f.get('维度') or '其他',
                        'level': f.get('等级') if f.get('等级') in LEVELS else '不会'})
    return out


def read_tips():
    with open(TIPS, encoding='utf-8') as fh:
        text = fh.read()
    out = []
    for blk in re.split(r'^## ', text, flags=re.M)[1:]:
        title, *rest = blk.split('\n')
        body, f = split_fields('\n'.join(rest))
        lo, hi = (re.split(r'[–-]', f.get('月龄', '')) + ['', ''])[:2]
        out.append({'title': title.strip(), 'topic': f.get('主题') or '其他',
                    'lo': int(lo) if lo.strip().isdigit() else 0, 'hi': int(hi) if hi.strip().isdigit() else 999, 'body': body.strip()})
    return out


def git(*args):
    return subprocess.run(['git', '-C', REPO, *args], capture_output=True, text=True)


def push():
    """有没推上去的 commit 就推（上次网络失败的也会补推）"""
    git('fetch', '-q', 'origin', 'main')
    ahead = git('rev-list', '--count', 'origin/main..main').stdout.strip()
    if ahead in ('', '0'):
        return 0
    for _ in range(3):
        p = git('push', 'origin', 'main')
        if p.returncode == 0:
            print('已推到 GitHub，外婆页一两分钟后更新')
            return 0
        time.sleep(5)
    print('推送失败（网络？），已在本地 commit，下次再推：', p.stderr.strip()[-200:])
    return 1


def main():
    pushing = '--push' in sys.argv
    skills = read_skills()
    if not skills:
        print('技能清单读出来是空的（iCloud 没下载？），不导出')
        return 1
    data = {**BABY, 'skills': skills, 'tips': read_tips()}
    old = None
    if os.path.exists(OUT):
        with open(OUT, encoding='utf-8') as fh:
            old = json.load(fh)
    if old and {k: v for k, v in old.items() if k != 'updated'} == data:
        print(f'没有变化（{len(skills)} 项技能、{len(data["tips"])} 条要点）')
        return push() if pushing else 0
    data['updated'] = datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(f'已导出：{len(skills)} 项技能、{len(data["tips"])} 条要点')
    if not pushing:
        return 0
    git('add', 'docs/data.json')
    c = git('commit', '-m', f'更新清单 {data["updated"][:10]}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')
    if c.returncode != 0 and 'nothing to commit' not in c.stdout:
        print('commit 失败：', c.stderr.strip())
        return 1
    return push()


if __name__ == '__main__':
    sys.exit(main())
