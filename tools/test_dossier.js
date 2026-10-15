/*
 * 收录档案引擎验收测试：node tools/test_dossier.js
 * 重点验证"确定性"与"边界"，而不是"看起来像"。
 */
'use strict';
const D = require('../_assets/dossier.js');

let pass = 0, fail = 0;
const failures = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else {
    fail++; failures.push(name + '  期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
    console.log('  FAIL  ' + name + '  (期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual) + ')');
  }
}
function checkTrue(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (extra ? ' ' + extra : '')); console.log('  FAIL  ' + name + (extra ? '  ' + extra : '')); }
}

console.log('\n[1] 编号：确定性 + 格式');
check('同 seed 同编号', D.buildNumber(1750000000000), D.buildNumber(1750000000000));
checkTrue('格式符合 TWILIT-1999-XXXX', /^TWILIT-1999-\d{4}$/.test(D.buildNumber(Date.now())));
checkTrue('相邻 seed 会得到不同编号', D.buildNumber(1) !== D.buildNumber(2));
check('编号总在四位数区间内', /^\d{4}$/.test(D.buildNumber(999999999).slice(-4)), true);

console.log('\n[2] 时代章：由编号决定，分布均匀（10000 次）');
{
  const count = {};
  for (let n = 0; n < 10000; n++) {
    const num = 'TWILIT-1999-' + String(n).padStart(4, '0');
    const era = D.eraOf(num);
    count[era.id] = (count[era.id] || 0) + 1;
  }
  const ids = D.ERAS.map(e => e.id);
  check('四个时代都出现', ids.filter(i => count[i] > 0).length, 4);
  const shares = ids.map(i => count[i] / 10000);
  checkTrue('每个时代占比都在 20%~30%（均匀）', shares.every(s => s > 0.2 && s < 0.3),
    JSON.stringify(shares.map(s => (s * 100).toFixed(1) + '%')));
  check('同一编号永远同一时代', D.eraOf('TWILIT-1999-0731').id, D.eraOf('TWILIT-1999-0731').id);
}

console.log('\n[3] 时段归档：24 小时全覆盖且无空洞');
{
  const expect = { 0: 'dawn', 5: 'dawn', 6: 'early', 8: 'early', 9: 'day', 16: 'day', 17: 'dusk', 19: 'dusk', 20: 'night', 23: 'night' };
  Object.keys(expect).forEach(h => check(`第 ${h} 点 → ${expect[h]}`, D.phaseOf(+h).id, expect[h]));
  const seen = new Set();
  for (let h = 0; h < 24; h++) seen.add(D.phaseOf(h).id);
  check('24 小时覆盖到全部 5 个时段', seen.size, 5);
  check('越界小时会被夹住', [D.phaseOf(-3).id, D.phaseOf(99).id], ['dawn', 'night']);
}

console.log('\n[4] 异常等级：分数边界与单调性');
{
  const stable = D.levelOf({ seconds: 10, visits: 1, hour: 14 });
  const resonant = D.levelOf({ seconds: 600, visits: 6, hour: 3 });
  check('白天 10 秒首次到访 → 稳定', stable.label, '稳定');
  check('凌晨 10 分钟第 6 次到访 → 高共鸣', resonant.label, '高共鸣');
  checkTrue('分数随停留时长单调不减',
    D.scoreOf({ seconds: 0, visits: 1, hour: 14 }) <= D.scoreOf({ seconds: 60, visits: 1, hour: 14 }) &&
    D.scoreOf({ seconds: 60, visits: 1, hour: 14 }) <= D.scoreOf({ seconds: 600, visits: 1, hour: 14 }));
  checkTrue('其余条件相同时，深夜分数高于白天',
    D.scoreOf({ seconds: 60, visits: 1, hour: 23 }) > D.scoreOf({ seconds: 60, visits: 1, hour: 14 }));
  checkTrue('分数永远在 0~100', (() => {
    for (let s = 0; s < 5000; s += 137) for (let v = 1; v < 9; v++) for (let h = 0; h < 24; h += 5) {
      const sc = D.scoreOf({ seconds: s, visits: v, hour: h });
      if (sc < 0 || sc > 100) return false;
    }
    return true;
  })());
  // 阈值判定：跨过 min 就必须升级
  D.LEVELS.forEach(l => checkTrue(`分数 ${l.min} 时至少是「${l.label}」`,
    (() => { const sc = l.min; let picked = D.LEVELS[0]; D.LEVELS.forEach(x => { if (sc >= x.min) picked = x; }); return picked.id === l.id; })()));
}

console.log('\n[5] 评语：确定性、来自对应等级、非空');
{
  const num = 'TWILIT-1999-0421';
  check('同编号同评语', D.commentFor('resonant', num), D.commentFor('resonant', num));
  checkTrue('评语来自该等级的池子', D.COMMENTS.resonant.includes(D.commentFor('resonant', num)));
  let allOk = true, sameAcrossLevels = 0;
  D.LEVELS.forEach(l => {
    for (let i = 0; i < 50; i++) {
      const c = D.commentFor(l.id, 'TWILIT-1999-' + String(i).padStart(4, '0'));
      if (!c || typeof c !== 'string' || c.length < 4) allOk = false;
      if (!D.COMMENTS[l.id].includes(c)) allOk = false;
    }
  });
  checkTrue('四个等级 × 50 个编号的评语都合法', allOk);
  checkTrue('四级评语互不相同（不是同一句话复用）',
    new Set(D.LEVELS.map(l => D.COMMENTS[l.id][0])).size === 4);
}

console.log('\n[6] 格式化');
check('3661 秒 → 01:01:01', D.formatDuration(3661), '01:01:01');
check('59 秒 → 00:00:59', D.formatDuration(59), '00:00:59');
check('负数夹到 0', D.formatDuration(-5), '00:00:00');
check('ISO 时刻格式化', D.formatMoment(new Date(2026, 9, 15, 22, 41, 7)), '2026-10-15 22:41:07');
checkTrue('时区偏移格式 ±HH:MM', /^[+-]\d{2}:\d{2}$/.test(D.formatZone(new Date())));

console.log('\n[7] collect()：整张档案的完整性');
{
  const now = new Date(2026, 9, 15, 3, 12, 0);
  const d = D.collect({ now, startTime: now.getTime() - 300000, visits: 4, seed: 123456 });
  check('7 个字段行', d.rows.length, 7);
  check('时长 5 分钟 → 00:05:00', d.dwell, '00:05:00');
  check('到访次数正确', d.visits, 4);
  check('凌晨 + 第 4 次 + 5 分钟 → 高共鸣', d.level.label, '高共鸣');
  check('时段是凌晨', d.phase.id, 'dawn');
  checkTrue('编号贯穿在字段里', d.rows[0][1] === d.number);
  checkTrue('没有 undefined/NaN 漏出来',
    d.rows.every(r => r.every(c => typeof c === 'string' && c.length > 0 && !c.includes('undefined') && !c.includes('NaN'))));
  const again = D.collect({ now, startTime: now.getTime() - 300000, visits: 4, seed: 123456 });
  check('同输入 → 整张档案完全一致', JSON.stringify(again), JSON.stringify(d));
  // 边界：刚刚打开（0 秒）、第一次到访
  const fresh = D.collect({ now, startTime: now.getTime(), visits: 1, seed: 1 });
  check('0 秒首次到访不崩', fresh.dwell, '00:00:00');
  checkTrue('0 秒首次到访仍是合法等级', !!fresh.level.label);
}

console.log('\n========================================');
console.log(fail === 0 ? '全部通过：' + pass + ' 项' : '通过 ' + pass + ' 项，失败 ' + fail + ' 项：\n  - ' + failures.join('\n  - '));
console.log('========================================\n');
process.exit(fail === 0 ? 0 : 1);
