# 我的关，我的影子（My Level, My Ghost）

小红书（RED）离线小工具游戏，UGC 整活陷阱平台跳跃。玩家自己摆关、录下通关影子，再把关卡和影子交给别人去踩。本地构建 v6 已作为平台版本 1.0.2 提交（审核中）。线上已发布版本仍是 1.0.0。

官方 appId：`6af3e68653ca3e0015ecb2a0`

## 安装与构建

依赖写在 `package.json`（`acorn`、`playwright-core`）。`package.json` 没有 `build` 脚本；其中的 `npm test` 是占位脚本，运行会直接失败。

```bash
npm install
node build_v4.js
```

`node build_v4.js` 用 acorn 做 ES2017 语法检查，重算演示影子，并写出 `dist/`（`index.html`、`css/`、`js/`、`assets/`）。更早的单文件原型：

```bash
node build.js
```

它会在仓库根目录生成 `prototype_v2.html`。

引擎测试不走 `npm test`，直接运行：

```bash
node test/run_tests.js
```

## 目录

- `src/`：游戏源码。物理与关卡引擎（`engine.js`）、界面（`ui_v3.js` 等）、关卡（`levels.js`）、小红书小工具适配（`platform.js`）、页面模板与样式、图集数据。
- `dist/`：`build_v4.js` 写出的可运行包。
- `assets/`：图集与背景（`atlas.png`、`atlas_full.png`、`bg.jpg`）。
- `store_art/`：商店素材（图标、封面、预览二维码）和 `build_store_art.py`。
- `test/`：引擎测试、求解器、各版本截图脚本和结果记录。
- `shots_v6/`：v6 截图（首页、导出、结算、宣传卡）。
- `dist-upload-v6.zip`：v1.0.2 上传包。
- `build.js`、`build_v4.js`：构建脚本。
- `tools_atlas.py`：图集处理脚本。

## 版本

| 位置 | 版本 |
| --- | --- |
| 本地构建 | v6 |
| 已提交、审核中 | 1.0.2（上传包为 `dist-upload-v6.zip`） |
| 线上已发布 | 1.0.0 |

## 创作规则

后续 AI 生成关卡与机关开发遵循 [机关与关卡创作规则](docs/LEVEL_DESIGN_RULES.md)。文档区分当前能力与待开发设计，并定义触发方式、确定性回放、2KB 评论快照和关卡验收门禁。
