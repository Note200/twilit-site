/*
 * twilit · 暮色线 —— 太阳位置与晨昏线计算（纯逻辑，无 DOM）
 * 浏览器 <script src> 挂到 window.Terminator；Node 里 require 用于测试。
 *
 * 公式取自 NOAA Solar Calculator 的常用简化式（精度 ±0.5°，对一张 900px 的世界地图足够：
 * 0.5° 在图上约 1.2px）。**不依赖任何网络接口**，全部本地算。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Terminator = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var REFRACTION = 90.833;   // 含大气折射与日面半径的标准日出日落天顶角

  /** 一年中的第几天（含小数部分） */
  function dayOfYear(date) {
    var start = Date.UTC(date.getUTCFullYear(), 0, 0);
    return (date.getTime() - start) / 86400000;
  }

  /** 年内角 γ（弧度） */
  function gamma(date) {
    return 2 * Math.PI / 365 * (dayOfYear(date) - 1 + (date.getUTCHours() - 12) / 24);
  }

  /** 太阳赤纬（度）：春分≈0，夏至≈+23.4，冬至≈-23.4 */
  function declination(date) {
    var g = gamma(date);
    return DEG * (0.006918
      - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
      - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
      - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g));
  }

  /** 时差方程（分钟）：真太阳时与平太阳时之差 */
  function equationOfTime(date) {
    var g = gamma(date);
    return 229.18 * (0.000075
      + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
      - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  }

  /** 直射点（太阳在正头顶的那一点） */
  function subsolarPoint(date) {
    var utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    var lon = -15 * (utcHours - 12 + equationOfTime(date) / 60);
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return { lat: declination(date), lon: lon };
  }

  /** 某点的太阳高度角（度）。负值即在夜半球。 */
  function solarElevation(lat, lon, date) {
    var p = subsolarPoint(date);
    var cosZenith = Math.sin(lat * RAD) * Math.sin(p.lat * RAD)
      + Math.cos(lat * RAD) * Math.cos(p.lat * RAD) * Math.cos((lon - p.lon) * RAD);
    if (cosZenith > 1) cosZenith = 1;
    if (cosZenith < -1) cosZenith = -1;
    return 90 - Math.acos(cosZenith) * DEG;
  }

  /**
   * 某个经度上"太阳高度角为 0"的纬度（晨昏线上的一点）
   * sin φ sin δ + cos φ cos δ cos H = 0  →  tan φ = -cos H / tan δ
   */
  function terminatorLatitude(lon, date) {
    var p = subsolarPoint(date);
    var H = (lon - p.lon) * RAD;
    var tanD = Math.tan(p.lat * RAD);
    if (Math.abs(tanD) < 1e-6) {
      // 春/秋分附近：晨昏线几乎沿经线，取极地极限值
      return Math.cos(H) >= 0 ? 90 : -90;
    }
    var phi = Math.atan(-Math.cos(H) / tanD) * DEG;
    // 夜半球在 cos H 与 δ 决定的那一侧
    return Math.cos(H) * tanD > 0 ? phi : (phi > 0 ? phi - 180 : phi + 180);
  }

  /** 日出日落（UTC 分钟，0~1440）；极昼/极夜时返回 null */
  function sunTimes(lat, lon, date) {
    var decl = declination(date) * RAD;
    var phi = lat * RAD;
    var cosHa = Math.cos(REFRACTION * RAD) / (Math.cos(phi) * Math.cos(decl)) - Math.tan(phi) * Math.tan(decl);
    if (cosHa > 1) return { sunrise: null, sunset: null, dayLength: 0, polar: 'night' };
    if (cosHa < -1) return { sunrise: null, sunset: null, dayLength: 24, polar: 'day' };
    var ha = Math.acos(cosHa) * DEG;
    var eq = equationOfTime(date);
    var noon = 720 - 4 * lon - eq;                  // 太阳正午（UTC 分钟）
    return {
      sunrise: noon - 4 * ha,
      sunset: noon + 4 * ha,
      solarNoon: noon,
      dayLength: 8 * ha / 60,                       // 小时
      polar: null
    };
  }

  /** 把 UTC 分钟转成本地时刻字符串（按浏览器时区） */
  function minutesToLocalClock(minutes, date) {
    if (minutes === null || minutes === undefined) return null;
    var d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCMinutes(Math.round(minutes));
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /**
   * 夜景浓度 0~1（用于地图着色）
   * 0 → 白天；0.28 民用暮光；0.5 航海暮光；0.68 天文暮光；1 → 深夜
   */
  function nightAlpha(elevation) {
    var stops = [[1, 0], [-6, 0.28], [-12, 0.5], [-18, 0.68], [-30, 1]];
    if (elevation >= stops[0][0]) return 0;
    for (var i = 0; i < stops.length - 1; i++) {
      var a = stops[i], b = stops[i + 1];
      if (elevation <= a[0] && elevation >= b[0]) {
        var t = (a[0] - elevation) / (a[0] - b[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return 1;
  }

  /**
   * 晨昏光带强度 0~1：峰值在高度角 0°（日出日落线上），向两侧衰减
   * 昼侧衰减到 +8°、夜侧衰减到 −14°，这样正好覆盖暮光最浓的那一段。
   */
  function rimAlpha(elevation) {
    if (elevation > 0) return Math.max(0, 1 - elevation / 8);
    return Math.max(0, 1 - (-elevation) / 14);
  }

  /**
   * 一次性生成两张遮罩：黑夜压暗 + 晨昏暖光带
   * @returns {{night: Uint8ClampedArray, rim: Uint8ClampedArray}} 0~255
   */
  function masks(w, h, date) {
    var p = subsolarPoint(date);
    var sinD = Math.sin(p.lat * RAD), cosD = Math.cos(p.lat * RAD);
    var cosLon = new Float64Array(w), sinLon = new Float64Array(w);
    for (var x = 0; x < w; x++) {
      var lon = (x + 0.5) / w * 360 - 180;
      var d = (lon - p.lon) * RAD;
      cosLon[x] = Math.cos(d); sinLon[x] = Math.sin(d);
    }
    var night = new Uint8ClampedArray(w * h), rim = new Uint8ClampedArray(w * h);
    for (var y = 0; y < h; y++) {
      var lat = 90 - (y + 0.5) / h * 180;
      var sinP = Math.sin(lat * RAD), cosP = Math.cos(lat * RAD);
      var base = sinP * sinD;
      for (var x2 = 0; x2 < w; x2++) {
        var cosZ = base + cosP * cosD * cosLon[x2];
        if (cosZ > 1) cosZ = 1; else if (cosZ < -1) cosZ = -1;
        var elev = 90 - Math.acos(cosZ) * DEG;
        var i = y * w + x2;
        night[i] = Math.round(nightAlpha(elev) * 255);
        rim[i] = Math.round(rimAlpha(elev) * 255);
      }
    }
    return { night: night, rim: rim };
  }

  /**
   * 生成整张等距圆柱投影地图的夜间遮罩
   * @returns {Uint8ClampedArray} 长度 w*h，值为 0~255 的夜间不透明度
   */
  function nightMask(w, h, date) {
    return masks(w, h, date).night;
  }

  /** 界面用的一揽子读数 */
  function describe(date) {
    var p = subsolarPoint(date);
    return {
      utc: date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      subsolar: { lat: p.lat, lon: p.lon },
      declination: declination(date),
      equationOfTime: equationOfTime(date),
      nightFraction: null
    };
  }

  return {
    REFRACTION: REFRACTION,
    dayOfYear: dayOfYear,
    declination: declination,
    equationOfTime: equationOfTime,
    subsolarPoint: subsolarPoint,
    solarElevation: solarElevation,
    terminatorLatitude: terminatorLatitude,
    sunTimes: sunTimes,
    minutesToLocalClock: minutesToLocalClock,
    nightAlpha: nightAlpha,
    rimAlpha: rimAlpha,
    nightMask: nightMask,
    masks: masks,
    describe: describe
  };
});
