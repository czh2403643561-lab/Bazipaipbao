/* Local port of the APK's b.b.a.a.m2.ra solar-term calculator. */
(function (root) {
  'use strict';
  const coefficients = root.ApkTermCoefficients;
  if (!coefficients) throw new Error('APK 节气系数未加载');
  const TWO_PI = Math.PI * 2;
  const J2000 = 2451545;
  const TERM_NAMES = ['春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰'];
  const MONTH_JIE_ORDER = [21, 23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const yearCache = new Map();

  function wrapRadians(value) {
    const wrapped = value % TWO_PI;
    return wrapped < 0 ? wrapped + TWO_PI : wrapped;
  }
  function cosineSeries(values, t) {
    let sum = 0;
    for (let i = 0; i < values.length; i += 3) sum += Math.cos(t * values[i + 2] + values[i + 1]) * values[i];
    return sum;
  }
  function trueSolarLongitudeError(days, target) {
    const t = days / 365250, t2 = t * t, t3 = t2 * t, t4 = t3 * t, t5 = t4 * t;
    const earthLongitude = cosineSeries(coefficients.p, t) + cosineSeries(coefficients.q, t) * t
      + cosineSeries(coefficients.r, t) * t2 + cosineSeries(coefficients.s, t) * t3
      + cosineSeries(coefficients.t, t) * t4 + cosineSeries(coefficients.u, t) * t5;
    const earthLatitude = cosineSeries(coefficients.v, t) + cosineSeries(coefficients.w, t) * t;
    const centuries = days / 36525, c2 = centuries * centuries, c3 = c2 * centuries, c4 = c3 * centuries;
    const meanLongitude = coefficients.n[0] + coefficients.n[1] * centuries + coefficients.n[2] * c2 + coefficients.n[3] * c3 + coefficients.n[4] * c4;
    const meanAnomaly = coefficients.m[0] + coefficients.m[1] * centuries + coefficients.m[2] * c2;
    const eccentricity = coefficients.l[0] + coefficients.l[1] * centuries + coefficients.l[2] * c2;
    let longitude = wrapRadians(earthLongitude) + Math.PI;
    const latitude = -earthLatitude;
    const d1 = meanLongitude - longitude, d2 = meanAnomaly - longitude;
    longitude = wrapRadians(longitude - ((Math.cos(d1) - Math.cos(d2) * eccentricity) * 9.936508497454117e-5) / Math.cos(latitude));
    let nutation = 0;
    for (let i = 0; i < coefficients.o.length; i += 9) {
      const angle = coefficients.o[i + 4] * c4 + coefficients.o[i + 3] * c3 + coefficients.o[i + 2] * c2 + coefficients.o[i + 1] * centuries + coefficients.o[i];
      nutation += Math.sin(angle) * (coefficients.o[i + 6] * centuries / 10 + coefficients.o[i + 5]);
    }
    longitude += nutation / 2062648062.4709637;
    return wrapRadians(target - longitude);
  }
  function solarTermJulianDay(year, index) {
    let left = (year - 2000) * 365.2422 + index * 15.2;
    let right = left + 360;
    const target = index * 15 * Math.PI / 180;
    let leftError = trueSolarLongitudeError(left, target);
    let rightError = trueSolarLongitudeError(right, target);
    if (leftError < rightError) rightError -= TWO_PI;
    let previous = 0, slope = 1;
    for (let i = 0; i < 10; i++) {
      const nextSlope = (rightError - leftError) / (right - left);
      if (Math.abs(nextSlope) > 1e-15) slope = nextSlope;
      const next = left - leftError / slope;
      let error = trueSolarLongitudeError(next, target);
      if (error > 1) error -= TWO_PI;
      if (Math.abs(error) < 1e-8) return next + J2000 + 1 / 3;
      previous = next;
      leftError = rightError;
      rightError = error;
      left = right;
      right = previous;
    }
    return previous + J2000 + 1 / 3;
  }
  function deltaTSeconds(jd) {
    const year = (jd - J2000) / 365.2425 + 2000;
    let index = 0;
    while (index < 100) {
      const next = index + 5;
      if (year < coefficients.k[next] || index === 95) break;
      index = next;
    }
    const fraction = (year - coefficients.k[index]) / (coefficients.k[index + 5] - coefficients.k[index]) * 10;
    return coefficients.k[index + 1] + coefficients.k[index + 2] * fraction
      + coefficients.k[index + 3] * fraction ** 2 + coefficients.k[index + 4] * fraction ** 3;
  }
  function termMillis(year, index) {
    const jd = solarTermJulianDay(year, index);
    return Math.round((jd - deltaTSeconds(jd) / 86400 - 2440587.5) * 86400000 / 1000) * 1000;
  }
  function termsForCalendarYear(year) {
    if (yearCache.has(year)) return yearCache.get(year);
    const terms = [];
    for (let index = 19; index < 24; index++) terms.push({ name: TERM_NAMES[index], index, time: termMillis(year - 1, index) });
    for (let index = 0; index < 19; index++) terms.push({ name: TERM_NAMES[index], index, time: termMillis(year, index) });
    const sorted = terms.sort((a, b) => a.time - b.time);
    yearCache.set(year, sorted);
    return sorted;
  }
  function getJie(epoch, forward) {
    const year = new Date(epoch).getUTCFullYear();
    const terms = [year - 1, year, year + 1].flatMap(termsForCalendarYear).filter(term => term.index % 2 === 1).sort((a, b) => a.time - b.time);
    return forward ? terms.find(term => term.time > epoch) : terms.slice().reverse().find(term => term.time <= epoch);
  }
  function correctPillars(lunar, eight, epoch) {
    const ruleEpoch = epoch + 1000; // APK parses birth times with seconds set to 01.
    const year = new Date(ruleEpoch).getUTCFullYear();
    const terms = [year - 1, year, year + 1].flatMap(termsForCalendarYear).sort((a, b) => a.time - b.time);
    const liChun = terms.slice().reverse().find(term => term.index === 21 && term.time <= ruleEpoch);
    const monthJie = terms.slice().reverse().find(term => term.index % 2 === 1 && term.time <= ruleEpoch);
    if (!liChun || !monthJie) throw new Error('无法确定节气边界');
    const yearCycle = ((new Date(liChun.time).getUTCFullYear() - 1984) % 60 + 60) % 60;
    const monthOffset = MONTH_JIE_ORDER.indexOf(monthJie.index);
    const monthGan = ((yearCycle % 10) % 5 * 2 + 2 + monthOffset) % 10;
    const monthZhi = (2 + monthOffset) % 12;
    const state = lunar._p;
    for (const key of ['yearGanIndex', 'yearGanIndexByLiChun', 'yearGanIndexExact']) state[key] = yearCycle % 10;
    for (const key of ['yearZhiIndex', 'yearZhiIndexByLiChun', 'yearZhiIndexExact']) state[key] = yearCycle % 12;
    for (const key of ['monthGanIndex', 'monthGanIndexExact']) state[key] = monthGan;
    for (const key of ['monthZhiIndex', 'monthZhiIndexExact']) state[key] = monthZhi;
    return { yearCycle, monthGan, monthZhi, monthJie, liChun };
  }
  const api = { TERM_NAMES, MONTH_JIE_ORDER, termMillis, termsForCalendarYear, getJie, correctPillars };
  root.ApkTerms = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
