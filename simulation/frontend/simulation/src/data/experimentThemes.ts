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
    summary: '同一辆失控的电车，两种做法：扳道岔，或者把一个人推下天桥。',
    description:
      '18:42，矿区一辆刹车失灵的货运电车沿坡道下滑，主线上有五名检修工人，侧线上有一名巡检员。变式一里你有一只道岔手柄，扳动只需不到一秒。变式二没有侧线和手柄，你站在六米高的天桥上，旁边是唯一够重的路人。两个版本要算的人数相同，能用的办法不同。',
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
          '你值夜班，守着道岔控制台，手边只有一个机械手柄。主线通向五名检修工人，侧线上有一名正在记录数据的巡检员。扳下去，电车转到侧线，撞上那名巡检员；不扳，电车继续开向五名工人。你没有动手，也没有拦住车。',
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
          '这里没有侧线，也没有手柄。失控电车冲向轨道上的五名工人，你站在跨轨天桥上，旁边是唯一够重的路人。能挡住车的办法只剩一个：把他推下六米高的桥面。他会死，五个人可能得救。',
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
        text: '按可以预见的结果比较：救下五个人，能不能抵得上这一次主动造成的伤害。',
      },
      {
        title: '义务论禁令',
        text: '有些做法光看结果说不过去。比如未经同意，把一个人当作挡车的工具。',
      },
      {
        title: '双重效应',
        text: '如果伤害只是行动的副作用，而不是达成目的的手段，判断可能和直接推人不同。',
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
      '公元前 256 年，李冰父子在岷江出山口修了三处工程。鱼嘴把江水分成内江和外江；飞沙堰在涨水时把水和泥沙泄回外江；宝瓶口控制进入成都平原的水量。可以先跟着工匠走一遍建造和岁修，再改动其中一处，看另外两处怎么变。',
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
          '跟着李冰、李二郎和蜀郡工匠，从沿江踏勘开始，依次开凿宝瓶口、用竹笼筑鱼嘴、把飞沙堰筑低，枯水期再用杩槎淘滩。共六次工程决策，每次都记下返工或验收情况，最后把淘滩深度和堰顶高度交给负责岁修的人。',
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
          '鱼嘴把岷江分成内江和外江。枯水期水多走内江的深槽，保证灌区用水；涨水时外江的宽槽多分一些水。分流比例一改，灌区收成和下游防洪安全都会跟着变。',
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
          '洪水漫过飞沙堰时自动泄回外江，弯道的环流同时把泥沙甩出内江。堰顶筑高，平时能多留水灌田；可真到洪水那天，能越堰泄走的余量就少了。',
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
          '宝瓶口是进入成都平原的最后一道口。口子拓宽，能多灌田，但暴雨时洪峰也会更快传到下游渠段。',
        status: 'planned',
        durationMinutes: 7,
        decisionCount: 1,
        tags: ['进水口', '洪峰', '区域公平'],
      },
    ],
    panorama: {
      title: '都江堰全景漫游',
      subtitle: '从鱼嘴到飞沙堰，在真实水利工程里走一圈',
      description:
        '用 720° 实景视角进入都江堰景区。在鱼嘴分水堤看内外江怎么分流，在飞沙堰看溢流和排沙，再从安澜索桥走到二王庙，看这套工程怎样把水、沙和平原灌区连在一起。',
      href: '/panorama/index?space=dujiangyan',
      tags: ['720° 全景', '实景踏勘', '工程空间'],
    },
    principles: [
      {
        title: '因势利导',
        text: '不和水硬碰，借地形、弯道和水势来分水、排沙。',
      },
      {
        title: '系统冗余',
        text: '分水、泄洪、限流由三处分担。一处出问题，另外两处还能分担一部分。',
      },
      {
        title: '岁修制度',
        text: '枯水期截流、淘滩到卧铁、修堰复水，每年都要做。工程建成不等于安全了。',
      },
    ],
  },
  {
    id: 'autonomous',
    index: '03',
    title: '自动驾驶',
    englishTitle: 'AUTONOMOUS DRIVING',
    category: '算法伦理',
    summary: '前方 42 米有人，对向 31 米有货车，从感知到执行只有 2.1 秒，这 2.1 秒内车是程序在开。',
    description:
      '暴雨夜，L4 测试车以 58 km/h 驶入学校路段，感知置信度为 78%。你是决策工程师，出发前就要把决策表定下来：年龄、性别能不能作为判断条件；行人和乘员怎么排序；法规约束和减少损失发生冲突时听哪个；事故后 EDR 数据归谁。表写入程序后，车辆自动运行，不再请求人工接管。',
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
          '出发前写好并锁定决策表。测试车在 2.1 秒内按表避险；碰撞后，感知数据和日志也按同一份条款处理。',
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
        text: '事故避不开时，表里要写清剩下的风险由谁承担，依据是什么。',
      },
      {
        title: '可解释性',
        text: '事后要能复现当时的分支选择，说清为什么走这一条，而不是只给一个输出结果。',
      },
      {
        title: '数据责任',
        text: '原始感知数据、模型版本和人工接管记录放在一起，调查组才能核对责任。',
      },
    ],
  },
  {
    id: 'collapse',
    index: '04',
    title: '大楼倒塌',
    englishTitle: 'STRUCTURAL COLLAPSE',
    category: '工程伦理',
    summary: '三处隐患单独看都不算致命，但都挤在只剩九天的工期里。',
    description:
      '安和里雨污分流改造开工第 19 天。第三段污水管接口错位，渗水已接近 3 号楼基础；南门外 17:10 放学，减速带被混凝土车压成三段；基坑东侧还留着缺口，护栏材料没到。你是项目安全负责人，白天按现场记录逐项处理，次日联合调查组进驻项目部，需要你说清哪些指令和签字是你经手的。',
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
          '16:20 开始巡检，查管网渗漏、南门减速带和基坑东侧临边缺口，夜里增加沉降监测。每一步是停工整改还是照常施工，都要留下签字和指令。次日 08:10，调查组按时间逐项核对。',
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
        text: '每一处单看都不致命，但同一个夜里叠在一起，就可能超出结构安全的范围。',
      },
      {
        title: '责任链',
        text: '建设、施工、监理和监管各有一部分信息，也各有一份义务。事后要分别核对。',
      },
      {
        title: '预防原则',
        text: '损害可能无法挽回、证据又不齐全时，先做成本最低的那一项减险措施。',
      },
    ],
  },
]

export const experimentThemeById = new Map(
  experimentThemes.map((theme) => [theme.id, theme]),
)
