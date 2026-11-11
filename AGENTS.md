# 《我的关，我的影子》项目约定

实现前读取 docs/LEVEL_DESIGN_RULES.md 和 docs/TRAP_MECHANICS_REFERENCE.md。当前新关卡规则版本为 v6；历史快照必须按各自版本回放。

- 保留已选定的大头火柴人图片动画和固定全图视角；不要为放大人物擅自恢复跟随镜头。
- 核心节奏：初见突然中招，快速重试，记住位置后主动破解。默认不靠慢预警让玩家反应闪避。
- 触发区与伤害区分开。机关改动至少成对验证“盲冲中招”和“知情引发后可通过”；仅求解器通过不足以验收。
- 高速移动必须覆盖扫掠路径和落地帧碰撞。机关位置/速度不因死亡次数随机变化。
- 物理行为变化需要新快照版本；玩家、影子、克隆、状态键、校验模拟、重新分享都保留规则版本。完整评论 JSON 按 UTF-8 不超过 2048 字节。
- src 是源码，dist 为构建产物。node build_v4.js 构建；npm test 是旧占位命令，不作为验收依据。
- 改物理/关卡时运行 node test/run_tests.js、node test/trap_timing_test.js、node test/falling_block_route_test.js、node test/layout_intent_test.js。改分享流程时运行 node test/postnote_test.js，并按需跑浏览器测试。
- 普通浏览器仅能验证逻辑与模拟行为，不能声称完成小红书平台或手机真机验收。
- 参考资料未覆盖的机制/参数须标为本项目设计，不声称已完整研究原作全部关卡。

原作开篇实测与证据范围见 docs/LEVEL_DEVIL_FIRST_FIVE_STUDY.md。新开篇按知识递进设计，不为提高难度收紧成像素级操作。区分正常运行帧证据与会扰动输入的虚拟时钟实验。
