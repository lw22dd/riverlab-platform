# 都江堰仿真 · 状态机枚举与阶段口径

> 用途：回答外部评审提出的三个缺口中的两个——**17 个离散 action 与 6 次选择的完整状态机表**、**8 阶段（总纲）与 9 阶段（原型 HTML）的最终定稿口径**。
> 数据来源：`simulation/frontend/simulation/src/data/scenarios/dujiangyan-build.json`（41 节点 / 6 决策点 / 17 action）与 `simulation/frontend/simulation/src/three/scenes/dujiangyan.ts` 的 `handleAction`。

## 0. 归约规则

场景不维护自己的时间轴，**每一帧的状态都由外部传入的 action 归约得到**：

```
state = actions.reduce(applyAction, INITIAL_STATE)
```

- `applyAction` 只能向前推进（点火→浇水→凿进→落笼→分水→堰高→截流→淘滩→复水），不做逐帧累积。
- 任意顺序重放同一串 action，画面一致；`dujiangyan:reset` 把状态与动画组（火、烟、笼、堰、杩槎、淤沙）一起复位。
- 相机由 action 附带切到对应预设（`overview / survey / bottleneck / fishmouth / split / weir / maintenance / irrigation`），不参与状态归约。

## 1. 17 个 action

| # | action | 触发节点 | 视觉状态变化 | 相机 | 幂等 |
| --- | --- | --- | --- | --- | --- |
| 1 | `dujiangyan:flood` | `d_flood` 江水漫入田地 | 水位抬升、西岸低地泛洪面淡入、外江转浑黄、飞沙堰溢流 | overview | 是 |
| 2 | `dujiangyan:dry` | `d_libing` 查看枯水河槽 | 水位落到枯水线、内江露出深槽、外江露出边滩 | overview | 是 |
| 3 | `dujiangyan:show:survey` | `d_survey` 标出三处踏勘点 | 打开 3 个调查热点与「玉垒山 / 岷江 / 成都平原」标注，其余隐藏 | survey | 是 |
| 4 | `dujiangyan:ignite` | `d_fire` 崖下积薪起火 | 三处火塘点燃、火焰锥亮起、烟粒子启动、石塞面渐焦黑 | bottleneck | 否（累加） |
| 5 | `dujiangyan:quench` | `d_quench` 引江水浇裂热石 | 蒸汽粒子、石塞竖向裂纹显形、岩面由焦黑转湿深 | bottleneck | 否 |
| 6 | `dujiangyan:chisel` | `d_chisel` 工匠凿进口门 | 石塞逐块下沉外倾、露出口门豁口；引水渠组 `visible=true` 并淡入 | bottleneck | 否 |
| 7 | `dujiangyan:cages` | `d_cages` 沉笼接成分水堤 | 竹笼沿堤轴逐笼落位（`setCageCount` 按序入位，已落位的笼不再被吸附），鱼嘴鼻尖合龙 | fishmouth | 否（可重复推进） |
| 8 | `dujiangyan:split:dry` | `d_split_dry` 枯水进入内江深槽 | 枯水工况：内江密纹快流、外江疏纹露滩 | split | 是 |
| 9 | `dujiangyan:split:flood` | `d_split_flood` 洪水由外江宽槽分泄 | 洪水工况：外江浑黄猛泻、内江受顶托、溢流启动 | split | 是 |
| 10 | `dujiangyan:weir:low` | `d_weir_low_note` / `d_weir_lesson` | 堰身降到低位（`weirWall.scale.y≈0.52`），洪水可越顶 | weir | 是 |
| 11 | `dujiangyan:weir:mid` | `d_weir_mid_note` | 堰身中位（≈0.86），只在大洪水时越顶 | weir | 是 |
| 12 | `dujiangyan:weir:high` | `d_weir_high_note` | 堰身加到高位（≈1），内江壅水、东侧渠水漫岸 | weir | 是 |
| 13 | `dujiangyan:cribs` | `d_cribs` 架杩槎截住内江 | 三座三脚杩槎竖起、内江断流、下游退水露滩 | maintenance | 否 |
| 14 | `dujiangyan:dredge` | `d_dredge` 凤栖窝淘至卧铁 | 淤沙堆被削平、露出河床与淘滩标尺 | maintenance | 否（累加削减） |
| 15 | `dujiangyan:restore` | `d_restore` 拆杩槎恢复供水 | 杩槎收起、内江复流、水面回升 | maintenance | 是 |
| 16 | `dujiangyan:celebrate` | `d_spirit` / `d_legacy` | 引水渠全开、田块由枯黄转青绿、村舍与林带显形 | irrigation | 是 |
| 17 | `dujiangyan:reset` | 场景卸载 / 重开 | 全部动画组复位、水位与堰高归零、标注清空 | overview | 是 |

## 2. 6 个决策点 × 3 个选项

`✅` = 3D 有可见差异；`⚠` = 3D 有差异但只到"后果提示"级别；`❌` = 目前只有文字与指标后果，场景仍走标准路径。

| 决策点 | 选项 | 结局节点 | 3D | 现状与缺口 |
| --- | --- | --- | --- | --- |
| ① 治水路线 `d_choice_method` | 带绳尺逐处测量 | `d_method_survey_note` | ❌ | 建议：踏勘热点的三处高亮做成只在该分支出现 |
| | 峡口横江筑坝 | `d_method_dam_note` | ❌ | 建议：加一条横坝剪影 + 坝前淤积楔，洪水期溢流缺口 |
| | 平原凿井灌田 | `d_method_well_note` | ❌ | 建议：平原加 2–3 口井点，渠网不出现 |
| ② 开凿工法 `d_choice_carve` | 火烧水浇随裂随凿（正解） | `d_fire` | ✅ | 4→5→6 三连 action 才会走完火—水—凿 |
| | 全凭锤凿 | `d_carve_hammer_note` | ❌ | 建议：跳过 4/5，直接把石塞凿穿进度锁在半程（露出未贯通剖面） |
| | 改线绕山 | `d_carve_detour_note` | ❌ | 建议：宝瓶口保持封闭，另画一条南侧干沟（有沟无水） |
| ③ 鱼嘴用料 `d_choice_fishmouth` | 竹笼卵石（正解） | `d_cages` | ✅ | 竹笼实例化成堤 |
| | 条石干砌 | `d_fish_stone_note` | ❌ | 建议：换成条石堤几何 + 洪水期两处塌陷缺口 |
| | 黏土夯筑 | `d_fish_earth_note` | ❌ | 建议：土黄色梯形堤身，洪水期溃口 |
| ④ 分水河槽 `d_choice_split` | 内江深窄、外江宽浅（正解） | `d_split_dry` | ✅ | 8/9 两个 action 切换工况 |
| | 内江放宽放浅 | `d_split_wide_note` | ⚠ | 若接入，可给内江一个 `splitRatio` 偏低的流场 |
| | 保留闸口守水 | `d_split_gate_note` | ⚠ | 同上 |
| ⑤ 飞沙堰高 `d_choice_weir` | 低顶溢流（正解） | `d_weir_low_note` | ✅ | action 10 |
| | 堰顶偏高 | `d_weir_mid_note` | ✅ | action 11 |
| | 加高堰身 | `d_weir_high_note` | ✅ | action 12，且东侧渠水漫岸 |
| ⑥ 岁修 `d_choice_maintenance` | 每年截流淘滩（正解） | `d_cribs` | ✅ | action 13→14→15 |
| | 巨石砌固免修 | `d_maint_reinforce_note` | ❌ | 建议：堤身换成大石砌体，淤沙不削、次年枯水内江流纹衰减 |
| | 停修放任 | `d_maint_ignore_note` | ❌ | 建议：不做 13–15，淤沙堆保留且抬高，内江过水断面变窄 |

**结论（需要项目组拍板）**：目前真正驱动 3D 的只有 ④⑤⑥ 三个决策点共 6 个选项 + 正解路径；①②③ 的错误分支停在文字后果层。要让"选错也看得出来"，最小改动是给每条错误分支各加一个几何开关（上表建议列），不改状态机结构。

## 3. 8 阶段（总纲）与 9 阶段（原型 HTML）的对照

外部评审建议合并"火烧"与"泼水激裂"为同一阶段的双拍，统一为 **8 阶段 / 64 s**。现原型 HTML 是 **9 阶段 / 59 s**。

| 总纲 8 阶段 | 秒 | 原型 9 阶段 | 秒 | 合并方式 |
| --- | --- | --- | --- | --- |
| 1 `before` 峡口未凿 | 8 | 1 `before` 峡口未凿 | 6 | 整体加长 2 s，末 2 s 停机 |
| 2 `fire_quench` 火烧水激 | 8 | 2 `fire` 火烧崖壁 + 3 `quench` 泼水激裂 | 6 + 6 | 合成一个 12 s 阶段的 0–6 / 6–12 两拍，或压到 8 s（火 3.5 s + 水 4.5 s） |
| 3 `chisel` 凿开宝瓶口 | 8 | 4 `chisel` 凿开宝瓶口 | 6.5 | 加长 1.5 s |
| 4 `cages` 依洲筑鱼嘴 | 9 | 5 `cages` 竹笼筑鱼嘴 | 7 | 加长 2 s |
| 5 `split` 内外分水 | 8 | 6 `split` 内外分水 | 6.5 | 加长 1.5 s |
| 6 `weir` 飞沙堰溢流 | 8 | 7 `weir` 飞沙堰溢流 | 7 | 加长 1 s |
| 7 `maint` 岁修淘滩 | 7 | 8 `maint` 岁修淘滩 | 6 | 加长 1 s |
| 8 `harvest` 天府得水 | 8 | 9 `harvest` 天府得水 | 8 | 不变 |

**建议口径**：以 **8 阶段 / 64 s** 为正式版本（总纲与评审一致，便于对外叙述"八段"），原型的第 2、3 阶段合并为一个 `fire_quench`（内部保留 `fire` / `quench` 两个 beat，字幕分两句）。改动范围只有 `PHASES` 数组与 `phaseStart` 换算，不动任何几何与 action。
