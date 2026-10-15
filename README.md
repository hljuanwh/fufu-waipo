# 福福成长清单（外婆页）

给外婆在手机上看的育儿页：**技能清单**（点一下改「不会 / 会 / 熟练」）和**本周要点**（只读）。
外婆改的等级会同步回桔子 Obsidian 里的 `12-工作台/育儿/技能清单.md`；桔子在工作台改了，外婆刷新就能看到。

- 网页：`docs/index.html`，GitHub Pages 发布（仓库 Settings → Pages → main / docs）
- 中转站：`worker/`，Cloudflare Worker + D1 数据库（免费额度）
- 同步：桔子的 Obsidian 插件「桔子的工作台」（`juzi-workbench` 的 `syncWaipo()`）

## 数据怎么走

```
外婆手机 ──点等级──▶ Worker /api/level ──▶ D1
                                          ▲  │
桔子 Obsidian（电脑或手机）── /api/sync ───┘  ▼
  推：整份技能清单 + 本周要点 + 福福生日      拉：外婆改过的等级 → 写回 技能清单.md
```

- 技能用「月龄|名称」认（例如 `23|向前踢球，球能往前滚一段`）。在 Obsidian 里改了名字，就当成删掉旧的、加了新的。
- 两边改了同一项：按改的时间，**后改的算**。
- 插件什么时候同步：打开 Obsidian 5 秒后；技能清单或本周要点文件一改（3 秒后）；开着时每 5 分钟一次；命令面板「同步外婆页」。
- 外婆改过的，插件同步时会弹提示「外婆更新了 N 项技能」。
- 每月滚动加新一档技能（`## N 月龄`）后，下次同步就会出现在外婆页上。

## 接口

| 方法 | 路径 | 谁用 | 说明 |
|---|---|---|---|
| GET | `/api/state` | 外婆页 | 技能、要点、生日、最近 30 天外婆的改动 |
| POST | `/api/level` | 外婆页 | `{k, level}`，只能改等级；不要密码 |
| POST | `/api/sync` | 插件 | 要 `Authorization: Bearer <SYNC_TOKEN>`；清单为空会拒绝（防止误清空） |

`SYNC_TOKEN` 是 Worker 的 secret，同一个值存在插件的 `data.json`（`settings.waipoToken`），**不进仓库**。

## 部署 / 更新

```bash
cd worker
npx wrangler@4 login                 # 只要登录过期才需要
npx wrangler@4 deploy                # 改了 src/index.js 后
npx wrangler@4 d1 execute fufu-waipo --remote --file schema.sql   # 只在建库时跑一次
```

网页改了直接 `git push`，GitHub Pages 一两分钟后更新。网页里的中转站地址写在 `docs/index.html` 的 `API` 常量。

本地测试：`npx wrangler@4 dev --local`（用 `worker/.dev.vars` 里的测试 token），然后打开 `docs/index.html?api=http://localhost:8787`。

## 注意

- 没有密码：拿到链接的人都能看、都能改等级。数据不在这个仓库里，只在 Cloudflare 的数据库里。
- 页面不引用任何外部字体和 CDN，国内手机打开不会卡在加载资源上。
