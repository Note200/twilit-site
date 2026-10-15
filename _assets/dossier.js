/*
 * twilit · 1999 收录档案 —— 纯逻辑引擎（无 DOM 依赖）
 * 浏览器 <script src> 挂到 window.Dossier；Node 里 require 直接用于测试。
 *
 * 设计原则：所有判定都是确定性的（同一个 seed / 同一个时刻永远给同一张档案），
 * 这样既能写测试，也让访客刷新时不会觉得"档案是随机的假数据"。
 * 数据全部来自本机（时间、停留时长、localStorage 里的到访次数），不上传任何东西。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dossier = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------- 时代章（呼应《重返未来：1999》的多个时代） ---------------- */
  var ERAS = [
    { id: '1929', label: '一九二九', note: '泡沫破裂前的最后一个黄昏' },
    { id: '1966', label: '一九六六', note: '磁带与霓虹之间的地带' },
    { id: '1999', label: '一九九九', note: '世纪末的电子黄昏' },
    { id: '2007', label: '二〇〇七', note: '最后一批 CRT 熄灭之前' }
  ];

  /* ---------------- 时段 ---------------- */
  var PHASES = [
    { id: 'dawn', label: '凌晨', from: 0, to: 5, note: '世界最安静的时段' },
    { id: 'early', label: '清晨', from: 6, to: 8, note: '光刚开始变白' },
    { id: 'day', label: '白昼', from: 9, to: 16, note: '正午的读数最平淡' },
    { id: 'dusk', label: '黄昏', from: 17, to: 19, note: '一天里最像 twilit 的时刻' },
    { id: 'night', label: '深夜', from: 20, to: 23, note: '屏幕光比白天更真实' }
  ];

  /* ---------------- 异常等级（分数阈值） ---------------- */
  var LEVELS = [
    { id: 'stable', label: '稳定', min: 0, desc: '读数平稳，无明显异常波动。' },
    { id: 'drift', label: '微扰', min: 20, desc: '存在轻微漂移，仍在容差范围内。' },
    { id: 'watching', label: '观测中', min: 45, desc: '信号持续存在，建议继续观测。' },
    { id: 'resonant', label: '高共鸣', min: 75, desc: '与本站频段高度重合——你在这里待了很久。' }
  ];

  /* ---------------- 档案评语（按等级分组，确定性抽取） ---------------- */
  var COMMENTS = {
    stable: [
      '一次普通的收录。世界没有为此改变什么。',
      '记录完毕。你来得很快，走得大概也会很快。',
      '信号干净，没有留下多余的痕迹。'
    ],
    drift: [
      '略有停驻。像是路过时多看了一眼橱窗。',
      '读数开始出现缓慢的偏移——通常是好奇心造成的。',
      '你比大多数人在这里多待了一会儿。'
    ],
    watching: [
      '停留时间超出了常规区间，已转入持续观测。',
      '似乎有什么让你留下来了。我们没有追问。',
      '档案备注：这一位看得很仔细。'
    ],
    resonant: [
      '你几乎和这个频段重合了。像同一个人写的两封信。',
      '深夜、反复到访、长时间停留——按 1999 年的标准，这属于高共鸣个体。',
      '档案备注：不必解释。这里的灯一直亮着。'
    ]
  };

  /* ---------------- 基础工具 ---------------- */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /** 32 位整数散列，保证"同输入同输出"，用于编号与评语抽取 */
  function hash32(n) {
    var x = (n | 0) ^ 0x9e3779b9;
    x ^= x << 13; x |= 0;
    x ^= x >>> 17;
    x ^= x << 5; x |= 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return x;
  }

  /** 编号：TWILIT-1999-XXXX（由 seed 决定，同 seed 同编号） */
  function buildNumber(seed) {
    var s = isNum(seed) ? Math.floor(seed) : String(seed == null ? 0 : seed).length;
    var h = hash32(s);
    return 'TWILIT-1999-' + String(h % 10000).padStart(4, '0');
  }

  /** 时代章：由编号末两位决定（四选一，分布均匀且与编号自洽） */
  function eraOf(number) {
    var tail = parseInt(String(number).slice(-2), 10);
    if (!isFinite(tail)) tail = 0;
    return ERAS[tail % ERAS.length];
  }

  /** 时段：按小时归档（0-23 → DAWN/EARLY/DAY/DUSK/NIGHT） */
  function phaseOf(hour) {
    var h = Math.max(0, Math.min(23, Math.floor(isNum(hour) ? hour : 0)));
    for (var i = 0; i < PHASES.length; i++) {
      if (h >= PHASES[i].from && h <= PHASES[i].to) return PHASES[i];
    }
    return PHASES[0];
  }

  /**
   * 异常等级评分（0~100）
   * 停留时长最多 55 分、到访次数最多 24 分、时段最多 18 分
   */
  function scoreOf(input) {
    var dwell = Math.max(0, isNum(input.seconds) ? input.seconds : 0);
    var visits = Math.max(1, Math.floor(isNum(input.visits) ? input.visits : 1));
    var phase = phaseOf(input.hour);
    var s = Math.min(55, dwell / 3)          // 165 秒以上拿满
      + Math.min(24, (visits - 1) * 6)       // 第 5 次到访以上拿满
      + (phase.id === 'dawn' || phase.id === 'night' ? 18
        : phase.id === 'dusk' ? 12 : 4);
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  /** 等级：取分数能跨过的最高阈值 */
  function levelOf(input) {
    var score = scoreOf(input);
    var picked = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) if (score >= LEVELS[i].min) picked = LEVELS[i];
    return { id: picked.id, label: picked.label, desc: picked.desc, score: score };
  }

  /** 评语：同一张档案永远拿到同一句 */
  function commentFor(levelId, number) {
    var pool = COMMENTS[levelId] || COMMENTS.stable;
    var tail = parseInt(String(number).replace(/\D/g, ''), 10) || 0;
    return pool[hash32(tail) % pool.length];
  }

  /** 时长格式化 HH:MM:SS */
  function formatDuration(sec) {
    var s = Math.max(0, Math.floor(isNum(sec) ? sec : 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return [h, m, ss].map(function (v) { return String(v).padStart(2, '0'); }).join(':');
  }

  /** 时刻格式化 YYYY-MM-DD HH:MM:SS */
  function formatMoment(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
      + ':' + String(d.getSeconds()).padStart(2, '0');
  }

  /** 时区偏移 +08:00 形式 */
  function formatZone(d) {
    var off = -d.getTimezoneOffset();
    var sign = off >= 0 ? '+' : '-';
    var a = Math.abs(off);
    return sign + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0');
  }

  /**
   * 汇总一张档案
   * @param {object} input { now?:Date, startTime?:number(ms), visits?:number, seed?:number }
   */
  function collect(input) {
    input = input || {};
    var now = input.now instanceof Date ? input.now : new Date();
    var start = isNum(input.startTime) ? input.startTime : now.getTime();
    var seconds = Math.max(0, Math.floor((now.getTime() - start) / 1000));
    var visits = Math.max(1, Math.floor(isNum(input.visits) ? input.visits : 1));
    var seed = isNum(input.seed) ? input.seed : now.getTime();
    var number = buildNumber(seed);
    var era = eraOf(number);
    var phase = phaseOf(now.getHours());
    var level = levelOf({ seconds: seconds, visits: visits, hour: now.getHours() });

    return {
      number: number,
      era: era,
      phase: phase,
      level: level,
      comment: commentFor(level.id, number),
      moment: formatMoment(now),
      zone: formatZone(now),
      dwell: formatDuration(seconds),
      dwellSeconds: seconds,
      visits: visits,
      rows: [
        ['收录编号', number],
        ['收录时刻', formatMoment(now) + ' ' + formatZone(now)],
        ['观测时长', formatDuration(seconds)],
        ['本机到访', '第 ' + visits + ' 次'],
        ['时段归属', phase.label + '（' + phase.note + '）'],
        ['时代共鸣', era.label + '（' + era.note + '）'],
        ['异常等级', level.label + '（评分 ' + level.score + '/100）']
      ]
    };
  }

  return {
    ERAS: ERAS,
    PHASES: PHASES,
    LEVELS: LEVELS,
    COMMENTS: COMMENTS,
    hash32: hash32,
    buildNumber: buildNumber,
    eraOf: eraOf,
    phaseOf: phaseOf,
    scoreOf: scoreOf,
    levelOf: levelOf,
    commentFor: commentFor,
    formatDuration: formatDuration,
    formatMoment: formatMoment,
    formatZone: formatZone,
    collect: collect
  };
});
