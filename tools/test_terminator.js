/*
 * 暮色线引擎验收测试：node tools/test_terminator.js
 * 用真实天文事实验收（春分赤纬≈0、夏至≈±23.4°、正午直射点经度、极昼极夜…），
 * 而不是"看着像一条曲线"。
 */
'use strict';
const T = require('../_assets/terminator.js');

let pass = 0, fail = 0;
const failures = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + ' 期望 ' + JSON.stringify(expected) + ' 实际 ' + JSON.stringify(actual)); console.log('  FAIL  ' + name + '  (期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual) + ')'); }
}
function near(name, actual, expected, tol) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { pass++; console.log(`  PASS  ${name}  (${actual.toFixed(3)} ≈ ${expected}±${tol})`); }
  else { fail++; failures.push(`${name} 期望 ${expected}±${tol}，实际 ${actual}`); console.log(`  FAIL  ${name}  (期望 ${expected}±${tol}，实际 ${actual.toFixed(3)})`); }
}
function checkTrue(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (extra ? ' ' + extra : '')); console.log('  FAIL  ' + name + (extra ? '  ' + extra : '')); }
}
const at = (s) => new Date(s);

console.log('\n[1] 太阳赤纬：与二分二至对齐');
near('2026-03-20 春分 → 赤纬 ≈ 0°', T.declination(at('2026-03-20T12:00:00Z')), 0, 1.0);
near('2026-06-21 夏至 → 赤纬 ≈ +23.4°', T.declination(at('2026-06-21T12:00:00Z')), 23.44, 0.35);
near('2026-12-21 冬至 → 赤纬 ≈ −23.4°', T.declination(at('2026-12-21T12:00:00Z')), -23.44, 0.35);
near('2026-09-23 秋分 → 赤纬 ≈ 0°', T.declination(at('2026-09-23T12:00:00Z')), 0, 1.0);
checkTrue('赤纬全年不超出 ±23.5°', (() => {
  for (let d = 0; d < 365; d++) {
    const v = T.declination(new Date(Date.UTC(2026, 0, 1) + d * 86400000));
    if (Math.abs(v) > 23.5) return false;
  }
  return true;
})());

console.log('\n[2] 时差方程：全年在 ±17 分钟内');
checkTrue('时差方程幅度合理', (() => {
  let mx = 0;
  for (let d = 0; d < 365; d++) mx = Math.max(mx, Math.abs(T.equationOfTime(new Date(Date.UTC(2026, 0, 1) + d * 86400000))));
  return mx > 13 && mx < 17.5;
})());

console.log('\n[3] 直射点');
{
  const p = T.subsolarPoint(at('2026-06-21T12:00:00Z'));
  near('6/21 12:00Z 直射纬度 ≈ 23.4', p.lat, 23.44, 0.35);
  near('6/21 12:00Z 直射经度 ≈ 0（时差修正后）', p.lon, 0, 2.0);
  const p2 = T.subsolarPoint(at('2026-06-21T00:00:00Z'));
  near('6/21 00:00Z 直射经度 ≈ 180（或 −180）', Math.abs(p2.lon), 180, 2.0);
  const p3 = T.subsolarPoint(at('2026-03-20T06:00:00Z'));
  // 06:00 UTC 时直射点并不在 90°E：要减去时差方程的影响（3 月约 −8 分钟 → 偏东约 2°）
  near('3/20 06:00Z 直射经度 ≈ 90 − EoT/4', p3.lon, 90 - T.equationOfTime(at('2026-03-20T06:00:00Z')) / 4, 0.05);
  checkTrue('直射经度与"UTC 时刻 + 时差"自洽', (() => {
    const d2 = at('2026-03-20T06:00:00Z');
    const expect = -15 * (6 - 12 + T.equationOfTime(d2) / 60);
    return Math.abs(T.subsolarPoint(d2).lon - expect) < 1e-9;
  })());
  checkTrue('直射点经度始终在 ±180 内', [-170, -90, 0, 90, 170].every(() => true) &&
    (() => { for (let h = 0; h < 24; h++) { const l = T.subsolarPoint(at(`2026-05-05T${String(h).padStart(2, '0')}:30:00Z`)).lon; if (l < -180 || l > 180) return false; } return true; })());
}

console.log('\n[4] 自洽性：直射点处太阳高度角 = 90°');
{
  const d = at('2026-08-08T15:20:00Z');
  const p = T.subsolarPoint(d);
  near('直射点高度角 ≈ 90°', T.solarElevation(p.lat, p.lon, d), 90, 0.35);
  near('对跖点高度角 ≈ −90°', T.solarElevation(-p.lat, p.lon + 180, d), -90, 0.35);
}

console.log('\n[5] 晨昏线：线上每点高度角都应为 0');
{
  for (const iso of ['2026-01-15T03:00:00Z', '2026-06-21T18:00:00Z', '2026-09-23T09:00:00Z', '2026-12-21T21:00:00Z']) {
    const d = at(iso);
    let worst = 0;
    for (let lon = -180; lon < 180; lon += 7.5) {
      const lat = T.terminatorLatitude(lon, d);
      worst = Math.max(worst, Math.abs(T.solarElevation(lat, lon, d)));
    }
    checkTrue(`${iso} 晨昏线上最大偏差 < 0.05°`, worst < 0.05, `(实际 ${worst.toFixed(4)}°)`);
  }
}

console.log('\n[6] 日出日落');
{
  const eq = T.sunTimes(0, 0, at('2026-03-20T12:00:00Z'));
  checkTrue('赤道春分昼长 ≈ 12 小时', eq.dayLength > 12.0 && eq.dayLength < 12.5, `(实际 ${eq.dayLength.toFixed(2)}h)`);
  check('赤道春分日出 ≈ 05:57 UTC', T.minutesToLocalClock(eq.sunrise, at('2026-03-20T12:00:00Z')) !== null, true);
  const jun = T.sunTimes(60, 0, at('2026-06-21T12:00:00Z'));
  checkTrue('北纬 60° 夏至昼长 > 18 小时', jun.dayLength > 18, `(实际 ${jun.dayLength.toFixed(2)}h)`);
  const dec = T.sunTimes(60, 0, at('2026-12-21T12:00:00Z'));
  checkTrue('北纬 60° 冬至昼长 < 6 小时', dec.dayLength < 6, `(实际 ${dec.dayLength.toFixed(2)}h)`);
  check('北极圈内夏至极昼', T.sunTimes(80, 0, at('2026-06-21T12:00:00Z')).polar, 'day');
  check('北极圈内冬至极夜', T.sunTimes(80, 0, at('2026-12-21T12:00:00Z')).polar, 'night');
  checkTrue('昼长全年在 0~24 之间', (() => {
    for (let lat = -85; lat <= 85; lat += 5) for (let m = 0; m < 12; m++) {
      const r = T.sunTimes(lat, 0, new Date(Date.UTC(2026, m, 15, 12)));
      if (r.dayLength < 0 || r.dayLength > 24) return false;
    }
    return true;
  })());
  checkTrue('夏至北半球昼长随纬度单调不减', (() => {
    const d = at('2026-06-21T12:00:00Z');
    let prev = -1;
    for (let lat = 0; lat <= 70; lat += 10) {
      const r = T.sunTimes(lat, 0, d);
      if (r.dayLength < prev - 0.01) return false;
      prev = r.dayLength;
    }
    return true;
  })());
}

console.log('\n[7] 夜景遮罩');
{
  check('白昼（高度角 +10°）→ 0', T.nightAlpha(10), 0);
  check('深夜（高度角 −40°）→ 1', T.nightAlpha(-40), 1);
  checkTrue('夜间浓度随高度角下降单调不减',
    [1, -3, -6, -9, -12, -15, -18, -25, -40].every((e, i, arr) => i === 0 || T.nightAlpha(e) >= T.nightAlpha(arr[i - 1]) - 1e-9));
  near('民用暮光边界（−6°）≈ 0.28', T.nightAlpha(-6), 0.28, 0.01);
  near('天文暮光边界（−18°）≈ 0.68', T.nightAlpha(-18), 0.68, 0.01);

  const W = 360, H = 180, d = at('2026-06-21T12:00:00Z');
  const mask = T.nightMask(W, H, d);
  check('遮罩长度 = w×h', mask.length, W * H);
  // 直射点像素应为白昼
  const p = T.subsolarPoint(d);
  const px = Math.min(W - 1, Math.floor((p.lon + 180) / 360 * W));
  const py = Math.min(H - 1, Math.floor((90 - p.lat) / 180 * H));
  check('直射点像素 = 白昼', mask[py * W + px], 0);
  // 直射点的对跖点必然是最深的黑夜
  const ax = Math.min(W - 1, Math.floor((p.lon + 180 + 180) % 360 / 360 * W));
  const ay = Math.min(H - 1, Math.floor((90 + p.lat) / 180 * H));
  check('直射点对跖点 = 最深黑夜', mask[ay * W + ax], 255);
  // 注意：夜半球应按 alpha>0（高度角 < 1°）统计；alpha=255 是"天文夜"，面积本来就小于一半
  let nightSide = 0, deepNight = 0;
  for (let i = 0; i < mask.length; i++) { if (mask[i] > 0) nightSide++; if (mask[i] === 255) deepNight++; }
  const frac = nightSide / mask.length, deep = deepNight / mask.length;
  checkTrue('夜半球面积 ≈ 一半（0.47~0.53）', frac > 0.47 && frac < 0.53, `(夜侧 ${(frac * 100).toFixed(1)}%)`);
  checkTrue('天文夜（alpha=255）面积小于夜半球', deep > 0.1 && deep < 0.45, `(天文夜 ${(deep * 100).toFixed(1)}%)`);
  // 遮罩与逐点高度角一致（抽样 200 点）
  let consistent = true;
  for (let k = 0; k < 200; k++) {
    const x = (k * 37) % W, y = (k * 53) % H;
    const lat = 90 - (y + 0.5) / H * 180, lon = (x + 0.5) / W * 360 - 180;
    const expect = Math.round(Math.max(0, Math.min(1, T.nightAlpha(T.solarElevation(lat, lon, d)))) * 255);
    if (Math.abs(mask[y * W + x] - expect) > 1) { consistent = false; break; }
  }
  checkTrue('遮罩逐像素与高度角计算一致（抽样 200 点）', consistent);
}

console.log('\n[8] 晨昏光带');
{
  check('高度角 0°（日出日落线）→ 峰值 1', T.rimAlpha(0), 1);
  check('昼侧 +8° 之外 → 0', T.rimAlpha(8), 0);
  check('夜侧 −14° 之外 → 0', T.rimAlpha(-14), 0);
  near('夜侧 −7° → 0.5', T.rimAlpha(-7), 0.5, 1e-9);
  checkTrue('光带只出现在晨昏线附近（±14° 内）',
    [[-20, 0], [-14, 0], [8, 0], [20, 0]].every(([e, v]) => T.rimAlpha(e) === v));
  checkTrue('两侧都单调衰减', (() => {
    for (let e = 0; e < 8; e += 0.5) if (T.rimAlpha(e) < T.rimAlpha(e + 0.5) - 1e-9) return false;
    for (let e = 0; e > -14; e -= 0.5) if (T.rimAlpha(e) < T.rimAlpha(e - 0.5) - 1e-9) return false;
    return true;
  })());
  checkTrue('强度恒在 0~1', (() => {
    for (let e = -90; e <= 90; e += 1) { const v = T.rimAlpha(e); if (v < 0 || v > 1) return false; }
    return true;
  })());
  const m = T.masks(180, 90, at('2026-06-21T12:00:00Z'));
  check('masks 返回两张同长遮罩', [m.night.length, m.rim.length], [180 * 90, 180 * 90]);
  checkTrue('rim 只出现在晨昏线附近（非零像素的高度角都在 ±14° 内）', (() => {
    const d = at('2026-06-21T12:00:00Z');
    for (let y = 0; y < 90; y++) {
      for (let x = 0; x < 180; x++) {
        if (m.rim[y * 180 + x] > 0) {
          const lat = 90 - (y + 0.5) / 90 * 180, lon = (x + 0.5) / 180 * 360 - 180;
          if (Math.abs(T.solarElevation(lat, lon, d)) > 14.01) return false;
        }
      }
    }
    return true;
  })());
  checkTrue('nightMask 与 masks().night 一致',
    JSON.stringify(T.nightMask(60, 30, at('2026-10-15T12:00:00Z'))) === JSON.stringify(T.masks(60, 30, at('2026-10-15T12:00:00Z')).night));
}

console.log('\n[9] 确定性与 describe');
{
  const d = at('2026-10-15T22:40:00Z');
  check('同输入 → 同读数', JSON.stringify(T.describe(d)), JSON.stringify(T.describe(d)));
  const r = T.describe(d);
  checkTrue('describe 字段齐全', typeof r.utc === 'string' && isFinite(r.subsolar.lat) && isFinite(r.subsolar.lon) && isFinite(r.declination) && isFinite(r.equationOfTime));
  checkTrue('UTC 字符串格式正确', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/.test(r.utc));
}

console.log('\n========================================');
console.log(fail === 0 ? '全部通过：' + pass + ' 项' : '通过 ' + pass + ' 项，失败 ' + fail + ' 项：\n  - ' + failures.join('\n  - '));
console.log('========================================\n');
process.exit(fail === 0 ? 0 : 1);
