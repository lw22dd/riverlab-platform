import type { ExperimentTheme } from '@/models/experiment.model'
import trolleyCover from '@/assets/covers/trolley.png'
import dujiangyanCover from '@/assets/covers/dujiangyan.png'
import autonomousCover from '@/assets/covers/autonomous.png'
import collapseCover from '@/assets/covers/collapse.png'

/**
 * 本地实验主题目录。
 *
 * 结构与建议的后端 `GET /experiments` 返回保持一致：
 * 一个主题包含多个场景变式；变式接入引擎后通过 `scenarioId` 跳转。
 * 页面通过 `apis/experiment.api.ts` 异步读取，后续替换为真实接口时无需改动视图。
 */
export const experimentThemes: ExperimentTheme[] = [
  {
    id: 'trolley',
    index: '01',
    title: '电车悖论',
    englishTitle: 'THE TROLLEY PROBLEM',
    category: '道德哲学',
    summary: '同一辆失控的电车，两个版本：扳一下道岔，或者亲手把一个人推下天桥。',
    description:
      '18:42，矿区一辆制动失效的货运电车沿坡道滑向主线上的五名检修工人，旁边的侧线上只有一名巡检员。变式一交给你一只道岔手柄，行程不到一秒；变式二取消侧线和手柄，你站在六米高的天桥上，身旁是唯一够重的路人。两个版本要算的数一样，能用上的手段不一样。',
    artwork: 'trolley',
    cover: trolleyCover,
    accent: '#0b6e99',
    accentRgb: '11, 110, 153',
    tags: ['功利主义', '义务论', '双重效应'],
    featured: true,
    variants: [
      {
        id: 'switch',
        title: '扳道岔',
        subtitle: '五个人，还是一个人',
        description:
          '你守着夜班的道岔控制台，手里只有这一只机械手柄。主线通向五名检修工人，侧线上蹲着一名正在记录的巡检员。扳下去，是你亲手把电车送到那一个人面前；不扳，你没有动手，也没有拦住它。',
        status: 'ready',
        scenarioId: 'trolley-problem',
        durationMinutes: 7,
        decisionCount: 2,
        tags: ['道岔', '主动干预', '责任陈述'],
      },
      {
        id: 'footbridge',
        title: '桥上推人',
        subtitle: '把一个人当作工具',
        description:
          '现场没有侧线，也没有手柄。失控的电车冲向轨道上的五名工人，你站在跨轨天桥上，身旁是唯一够重的路人。还能挡住车头的办法只剩一个：把他推下六米高的桥面。他会死，五个人可能得救。',
        status: 'ready',
        scenarioId: 'trolley-footbridge',
        durationMinutes: 8,
        decisionCount: 2,
        tags: ['天桥困境', '直接伤害', '工具化'],
      },
    ],
    principles: [
      {
        title: '后果计算',
        text: '按可以预见的后果来比较：五个人活下来，是否抵得上一次主动造成的伤害。',
      },
      {
        title: '义务论禁令',
        text: '有些动作不能只用结果来辩护，把一个没有同意过的人当作阻挡电车的手段就是其中之一。',
      },
      {
        title: '双重效应',
        text: '如果伤害是动作的副作用而不是使用的手段，判断可能和直接推人不一样。',
      },
    ],
  },
  {
    id: 'dujiangyan',
    index: '02',
    title: '都江堰水利',
    englishTitle: 'DUJIANGYAN IRRIGATION',
    category: '工程伦理',
    summary: '不筑横江大坝，靠鱼嘴分水、飞沙堰泄洪排沙、宝瓶口限制进水量。',
    description:
      '公元前 256 年，李冰父子在岷江出山口安排三处工程：鱼嘴把江水分进内外两江，飞沙堰在涨水时让水挟沙翻回外江，宝瓶口限定进入成都平原的水量。你可以先跟着工匠走一遍建造和岁修，再单独改动其中一处，看它怎样牵动其余两处。',
    artwork: 'dujiangyan',
    cover: dujiangyanCover,
    accent: '#0f6e84',
    accentRgb: '15, 110, 132',
    tags: ['水利工程', '风险分配', '系统韧性'],
    featured: true,
    variants: [
      {
        id: 'build-process',
        title: '建造过程仿真',
        subtitle: '从踏勘到岁修的六次现场判断',
        description:
          '跟随李冰、李二郎和蜀郡工匠，从沿江踏勘开始，开凿宝瓶口、竹笼筑鱼嘴、低作飞沙堰，再到枯水期架杩槎淘滩。六次工程判断，每次都会留下返工或验收记录，最后把淘滩深度和堰顶高度交给守岁修的人。',
        status: 'ready',
        scenarioId: 'dujiangyan-build',
        durationMinutes: 12,
        decisionCount: 6,
        tags: ['角色引导', '动画叙事', '建造模拟'],
      },
      {
        id: 'fish-mouth',
        title: '鱼嘴分水',
        subtitle: '四六分水，枯洪两用',
        description:
          '鱼嘴把岷江分为内江与外江。枯水期水归内江的深槽，保住灌区用水；涨水时由外江的宽槽多承水。分流比例一改，灌区收成和下游防洪安全会同时跟着变。',
        status: 'planned',
        durationMinutes: 9,
        decisionCount: 2,
        tags: ['分水比例', '灌溉', '下游风险'],
      },
      {
        id: 'flood-discharge',
        title: '飞沙堰泄洪',
        subtitle: '溢流、排沙与代价',
        description:
          '洪水漫过飞沙堰时自动泄回外江，弯道环流同时把泥沙甩出内江。堰顶筑高，平日多留一些水灌田；真到洪水来的那天，能越堰的余量就少了。',
        status: 'planned',
        durationMinutes: 8,
        decisionCount: 2,
        tags: ['泄洪', '排沙', '安全裕度'],
      },
      {
        id: 'bottle-neck',
        title: '宝瓶口引流',
        subtitle: '进水口的最后一道约束',
        description:
          '宝瓶口是进入成都平原的最后一道口子，控制着灌区的水量。口子拓宽能多灌田，也会让暴雨时的洪峰更快传到下游渠段。',
        status: 'planned',
        durationMinutes: 7,
        decisionCount: 1,
        tags: ['进水口', '洪峰', '区域公平'],
      },
    ],
    panorama: {
      title: '都江堰全景漫游',
      subtitle: '从鱼嘴到飞沙堰，走进真实水利工程',
      description:
        '用 720° 实景视角走进都江堰景区：在鱼嘴分水堤看内外江分流，在飞沙堰看溢流排沙，在安澜索桥与二王庙之间理解这套工程怎样把水、沙与平原灌区连成一体。',
      href: '/panorama/?space=dujiangyan',
      tags: ['720° 全景', '实景踏勘', '工程空间'],
    },
    principles: [
      {
        title: '因势利导',
        text: '不和水硬抗，借地形、弯道和水势完成分流与排沙。',
      },
      {
        title: '系统冗余',
        text: '分水、泄洪、限流分由三处承担，任何一处出状况，其余两处还能顶住一部分。',
      },
      {
        title: '岁修制度',
        text: '枯水期截流、淘滩到卧铁、修堰复水，一年一年接着做；工程安全不是建成那天就算完。',
      },
    ],
  },
  {
    id: 'autonomous',
    index: '03',
    title: '自动驾驶',
    englishTitle: 'AUTONOMOUS DRIVING',
    category: '算法伦理',
    summary: '前方 42 米有人，对向 31 米有货车，从感知到执行只剩 2.1 秒，这段时间里没有人在开车。',
    description:
      '暴雨夜，L4 测试车以 58 km/h 进入学校路段，感知置信度 78%。作为决策工程师，你在出发前把决策表写定：年龄和性别能不能进入条件、行人与乘员怎么排、法规约束和减损冲突时听哪一条、事故之后 EDR 数据留给谁。程序写入后车辆自动运行，不再请求人工接管。',
    artwork: 'autonomous',
    cover: autonomousCover,
    accent: '#3e6fa8',
    accentRgb: '62, 111, 168',
    tags: ['算法治理', '风险分配', '可解释性'],
    variants: [
      {
        id: 'storm-avoidance',
        title: '暴雨避险',
        subtitle: '感知置信度 78%',
        description:
          '出发前编写并锁定决策表，测试车在 2.1 秒内按表完成避险动作；碰撞之后的感知数据和日志，仍按同一份条款处置。',
        status: 'ready',
        scenarioId: 'autonomous-driving',
        durationMinutes: 9,
        decisionCount: 3,
        tags: ['感知不确定性', '避险策略', 'EDR 数据'],
      },
    ],
    principles: [
      {
        title: '风险分配',
        text: '事故无法完全避免时，表里要写明剩下的风险由谁承担，依据是什么。',
      },
      {
        title: '可解释性',
        text: '事后能复现当时的分支选择、说清为什么走了这一条，而不是只交出一个输出结果。',
      },
      {
        title: '数据责任',
        text: '原始感知数据、模型版本与人工接管记录放在一起，才够调查组核对责任。',
      },
    ],
  },
  {
    id: 'collapse',
    index: '04',
    title: '大楼倒塌',
    englishTitle: 'STRUCTURAL COLLAPSE',
    category: '工程伦理',
    summary: '三处单独看都不算致命的隐患，挤在只剩九天的工期里。',
    description:
      '安和里雨污分流改造开工第 19 天：第三段污水管接口错位，渗水已经接近 3 号楼基础；南门外 17:10 放学，减速带被混凝土车压成三段；基坑东侧因护栏材料未到还留着缺口。你是项目安全负责人，白天按现场记录逐项处置，次日联合调查组进驻项目部，要听你说清哪些指令和签字经过你的手。',
    artwork: 'collapse',
    cover: collapseCover,
    accent: '#a9761a',
    accentRgb: '169, 118, 26',
    tags: ['工程安全', '责任链', '预防原则'],
    variants: [
      {
        id: 'foundation-pit',
        title: '安和里 3 号楼',
        subtitle: '九天工期内的现场处置',
        description:
          '16:20 开始的巡检：管网渗漏、南门减速带、基坑东侧临边缺口，夜里再加上沉降监测。停工整改还是照进度施工，每一步都要留下签字和指令；次日 08:10 调查组按时间逐项核对。',
        status: 'ready',
        scenarioId: 'building-collapse',
        durationMinutes: 11,
        decisionCount: 4,
        tags: ['深基坑', '渗漏', '联合调查'],
      },
    ],
    principles: [
      {
        title: '累积风险',
        text: '单看每一处都不算致命，叠在同一个夜里，就可能越过结构安全的界线。',
      },
      {
        title: '责任链',
        text: '建设、施工、监理和监管各握着一部分信息，也各有一份义务，事后要分开核对。',
      },
      {
        title: '预防原则',
        text: '损害可能收不回来、证据又还不齐全时，先把成本最低的那一步减险措施做掉。',
      },
    ],
  },
]

export const experimentThemeById = new Map(
  experimentThemes.map((theme) => [theme.id, theme]),
)
