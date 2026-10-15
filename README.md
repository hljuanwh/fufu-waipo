# 福福成长清单（外婆页）

给外婆在手机上看的育儿页：**技能清单**（点一下标「不会 / 会 / 熟练」）和**本周要点**（只读）。
网址：https://hljuanwh.github.io/fufu-waipo/

## 现在的做法：各管各的（2026-10-15 起）

```
桔子 Obsidian ── 每晚 23:30 jz-night 第 5 步 ── scripts/export.py --push ──▶ docs/data.json（GitHub Pages）
                                                                                   │
外婆手机 ◀──────────────────────────── 打开网页读 data.json ──────────────────────┘
          点的等级只存在她手机浏览器里（localStorage: fufu-mine）
```

- 外婆**没点过**的项，显示桔子工作台里的等级（每晚更新）；**点过**的只听外婆的，旁边写「外婆 x 月 x 日标的（桔子那边是「会」）」。
- 外婆点的**不会传回桔子的工作台**，桔子这边完全不受影响。
- 每月滚动加的新一档技能、改过的本周要点，当晚 23:30 之后出现在外婆页上。
- 风险：外婆标的存在手机浏览器里，换手机、清浏览器数据、iPhone Safari 长期不打开都可能丢（丢了就回到跟着桔子的状态）。页面会请求浏览器「持久保存」，页脚建议把网页添加到主屏幕。
- **`docs/data.json` 在公开仓库里**：技能清单和要点谁都能看到（网页本来就没密码，这是桔子定的）。

手动更新：`python3 scripts/export.py --push`（内容没变不提交；上次没推上去的会补推）。

## 停用的：Cloudflare 双向同步（代码保留）

最早做的是外婆改等级 → Cloudflare Worker + D1 → 工作台插件拉回 `技能清单.md` 的双向同步（`worker/`，插件里的 `syncWaipo()`）。
**外婆在国内不开 VPN 连不上 `*.workers.dev`**（10-15 实测：网页能开，数据出不来），所以停了：插件的 `settings.waipoUrl` 清空即停用，`waipoToken` 和 Worker 的 `SYNC_TOKEN` secret 还在。

想恢复双向同步：给 Worker 绑一个自己的域名（Cloudflare 上买域名 → Workers 自定义域），把 `docs/index.html` 改回读 Worker（见 git 历史 1dba571），插件 `settings.waipoUrl` 填新地址。Worker 接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/state` | 技能、要点、生日、最近外婆的改动 |
| POST | `/api/level` | `{k, level}`，只改等级 |
| POST | `/api/sync` | 插件用，要 `Authorization: Bearer <SYNC_TOKEN>`；按「月龄\|名称」认技能，后改的算 |

部署：`cd worker && npx wrangler@4 deploy`（登录过期先 `npx wrangler@4 login`）。D1 库 `fufu-waipo` 在 APAC。

## 注意

- 页面不引用任何外部字体和 CDN，国内手机打开不会卡在加载资源上。
- localStorage 跟 hljuanwh.github.io 下的其他页面（亲子英语、作品集、行程页）同源，键名都用 `fufu-` 开头避免撞车。
