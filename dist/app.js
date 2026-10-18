/* global Solar, Lunar */
const form = document.getElementById('chart-form');
const error = document.getElementById('error');
const result = document.getElementById('result');
const calendarType = document.getElementById('calendar-type');
const displayMode = document.getElementById('display-mode');
const modeOutput = document.getElementById('mode-output');
const nowStatus = document.getElementById('now-status');
let latestData = null;

calendarType.addEventListener('change', () => document.getElementById('leap-wrap').classList.toggle('hidden', calendarType.value !== 'lunar'));
displayMode.addEventListener('change', () => { if (latestData) renderMode(latestData, displayMode.value); });
document.querySelector('.mode-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (!button || !latestData) return;
  displayMode.value = button.dataset.mode;
  renderMode(latestData, button.dataset.mode);
});
document.querySelector('.display-settings').addEventListener('change', () => { if (latestData) renderMode(latestData, displayMode.value); });

function number(id) { return Number(document.getElementById(id).value); }
function value(id) { return document.getElementById(id).value.trim(); }
function beijingNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}
function validDate(y, m, d) {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
function safeText(item) { return String(item == null ? '' : item); }
function solarMillis(solar) { return Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()); }
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = safeText(text);
  return node;
}
function shown(id) { return document.getElementById(id).checked; }
function startOffset(lunar, yun, solar) {
  const jie = yun.isForward() ? lunar.getNextJie().getSolar() : lunar.getPrevJie().getSolar();
  const elapsed = Math.floor(Math.abs(solarMillis(jie) - solarMillis(solar)) / 720000);
  return { years: Math.floor(elapsed / 360), months: Math.floor((elapsed % 360) / 30), days: elapsed % 30 };
}
function firstLuckAge(offset, mode, forward) {
  if (mode === 'year') return null;
  if (mode === 'simple') return Math.max(1, offset.years);
  if (mode === 'rounded') return Math.max(1, offset.years + (offset.months >= 5 ? 1 : 0));
  return Math.max(1, offset.years + (forward ? 1 : 0));
}
function buildLuck(yun, solar, birthPillarYear, offset, mode) {
  const daYun = yun.getDaYun(11);
  if (mode === 'year') {
    return daYun.map((item, index) => {
      const startYear = index === 0 ? birthPillarYear : item.getStartYear();
      const years = index === 0
        ? Array.from({ length: Math.max(0, daYun[1].getStartYear() - birthPillarYear) }, (_, i) => {
          const year = birthPillarYear + i;
          const ganzhi = Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar().getYearInGanZhi();
          return { year, ganzhi };
        })
        : item.getLiuNian().map(annual => ({ year: annual.getYear(), ganzhi: annual.getGanZhi() }));
      return {
        ganzhi: item.getGanZhi() || '运前',
        startAge: index === 0 ? 1 : startYear - birthPillarYear + 1,
        startYear,
        years,
      };
    });
  }
  const firstAge = firstLuckAge(offset, mode, yun.isForward());
  const birthYear = birthPillarYear;
  return daYun.map((item, index) => {
    const startAge = index === 0 ? 1 : firstAge + (index - 1) * 10;
    const startYear = birthYear + startAge - 1;
    const yearCount = index === 0 ? Math.max(0, firstAge - 1) : 10;
    const years = Array.from({ length: yearCount }, (_, i) => {
      const year = startYear + i;
      const ganzhi = Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar().getYearInGanZhi();
      return { year, ganzhi };
    });
    return { ganzhi: item.getGanZhi() || '运前', startAge, startYear, years };
  });
}

function calculate() {
  const y = number('year'), m = number('month'), d = number('day');
  const h = number('hour'), minute = number('minute');
  if (![y, m, d, h, minute].every(Number.isInteger) || y < 1901 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || minute < 0 || minute > 59) throw new Error('请填写 1901—2099 年内的完整出生时间。');
  let solar;
  if (calendarType.value === 'lunar') {
    const lunarMonth = document.getElementById('leap').checked ? -m : m;
    const lunar = Lunar.fromYmdHms(y, lunarMonth, d, h, minute, 0);
    if (lunar.getYear() !== y || lunar.getMonth() !== lunarMonth || lunar.getDay() !== d) throw new Error('农历日期不存在，请检查是否为闰月。');
    solar = lunar.getSolar();
  } else {
    if (!validDate(y, m, d)) throw new Error('公历日期不存在，请检查年月日。');
    solar = Solar.fromYmdHms(y, m, d, h, minute, 0);
  }
  const lunar = solar.getLunar();
  const eight = lunar.getEightChar();
  eight.setSect(document.getElementById('zi-rule').value === '23' ? 1 : 2);
  const names = ['年柱', '月柱', '日柱', '时柱'];
  const keys = ['Year', 'Month', 'Day', 'Time'];
  const pillars = keys.map((key, i) => ({
    name: names[i], ganzhi: eight[`get${key}`](), nayin: eight[`get${key}NaYin`](),
    shishen: key === 'Day' ? '日主' : eight[`get${key}ShiShenGan`](),
    hiddenStems: eight[`get${key}HideGan`](), hiddenGods: eight[`get${key}ShiShenZhi`](),
    stage: eight[`get${key}DiShi`](), empty: eight[`get${key}XunKong`](),
  }));
  const yun = eight.getYun(number('gender'));
  const offset = startOffset(lunar, yun, solar);
  const solarYearGanZhi = Solar.fromYmdHms(solar.getYear(), 7, 1, 12, 0, 0).getLunar().getYearInGanZhiExact();
  const birthPillarYear = lunar.getYearInGanZhiExact() === solarYearGanZhi ? solar.getYear() : solar.getYear() - 1;
  const yunMode = value('yun-mode');
  const luck = buildLuck(yun, solar, birthPillarYear, offset, yunMode);
  const priorJie = lunar.getPrevJie();
  const daysAfterJie = Math.floor((Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay()) - Date.UTC(priorJie.getSolar().getYear(), priorJie.getSolar().getMonth() - 1, priorJie.getSolar().getDay())) / 86400000) + 1;
  const extras = [
    ['节气', `出生于${priorJie.getName()}后第 ${daysAfterJie} 日`],
    ['胎元', `${eight.getTaiYuan()} · ${eight.getTaiYuanNaYin()}`],
    ['命宫', `${eight.getMingGong()} · ${eight.getMingGongNaYin()}`],
    ['身宫', `${eight.getShenGong()} · ${eight.getShenGongNaYin()}`],
  ];
  return { solar, lunar, pillars, offset, luck, yunMode, extras, name: value('chart-name') };
}

function heading(text, className = 'block-title') { return make('h3', className, text); }
function renderPillarStrip(data, detailed = false) {
  const box = make('div', detailed ? 'pillar-strip detailed-strip' : 'pillar-strip');
  for (const pillar of data.pillars) {
    const card = make('article', 'pillar-card');
    card.append(make('span', 'pillar-label', pillar.name), make('strong', 'ganzhi', pillar.ganzhi));
    if (detailed) {
      card.append(make('span', 'small-god', pillar.shishen));
      if (shown('show-nayin')) card.append(make('span', 'small-nayin', pillar.nayin));
    }
    box.append(card);
  }
  return box;
}
function renderTraditional(data) {
  const fragment = document.createDocumentFragment();
  fragment.append(renderPillarStrip(data, true));
  const table = make('div', 'traditional-table');
  for (const pillar of data.pillars) {
    const card = make('article', 'trad-card');
    card.append(make('h3', '', pillar.name));
    const rows = [['天干十神', pillar.shishen]];
    if (shown('show-hidden')) rows.push(['藏干', pillar.hiddenStems.map((stem, i) => `${stem} ${pillar.hiddenGods[i]}`).join(' · ')]);
    if (shown('show-nayin')) rows.push(['纳音', pillar.nayin]);
    if (shown('show-stage')) rows.push(['长生', pillar.stage]);
    if (shown('show-empty')) rows.push(['旬空', pillar.empty]);
    for (const [label, content] of rows) {
      const row = make('div', 'trad-row'); row.append(make('span', '', label), make('span', '', content)); card.append(row);
    }
    table.append(card);
  }
  fragment.append(table);
  if (shown('show-extras')) fragment.append(renderExtras(data));
  fragment.append(renderLuck(data));
  return fragment;
}
function renderExtras(data) {
  const section = make('section', 'extra-section'); section.append(heading('命盘信息'));
  const list = make('div', 'traditional-extra');
  for (const [label, content] of data.extras) {
    const item = make('div', 'extra-item'); item.append(make('span', '', label), make('strong', '', content)); list.append(item);
  }
  section.append(list); return section;
}
function renderLuck(data) {
  const section = make('section', 'luck-section');
  const modeLabels = { year: '按年（原版默认）', cumulative: '按岁累加', simple: '按岁简化', rounded: '按岁舍入' };
  section.append(heading('大运与流年'), make('p', 'luck-mode', `起运方式：${modeLabels[data.yunMode] || modeLabels.year}`), make('p', 'luck-start', `出生后约 ${data.offset.years} 年 ${data.offset.months} 个月 ${data.offset.days} 天起运`));
  const list = make('div', 'luck-list');
  for (const item of data.luck) {
    const card = make('details', 'luck-item');
    const summary = make('summary');
    summary.append(make('strong', '', item.ganzhi), make('span', '', `${item.startAge} 岁起 · ${item.startYear} 年`)); card.append(summary);
    const years = make('div', 'annual-list');
    for (const year of item.years) years.append(make('div', '', `${year.year} ${year.ganzhi}`));
    card.append(years); list.append(card);
  }
  section.append(list); return section;
}
function renderSimple(data) {
  const fragment = document.createDocumentFragment();
  fragment.append(renderPillarStrip(data));
  const summary = make('div', 'simple-summary');
  summary.append(make('span', '', '起运'), make('strong', '', `${data.offset.years}年${data.offset.months}个月${data.offset.days}天`));
  fragment.append(summary, renderLuck(data)); return fragment;
}
function renderFullscreen(data) {
  const fragment = document.createDocumentFragment();
  const card = make('section', 'full-card');
  card.append(make('p', 'full-date', `${data.solar.toYmd()} ${String(data.solar.getHour()).padStart(2, '0')}:${String(data.solar.getMinute()).padStart(2, '0')}`), renderPillarStrip(data, true));
  fragment.append(card, renderLuck(data)); return fragment;
}
function renderAnalysis(data) {
  const fragment = document.createDocumentFragment();
  const insight = make('section', 'analysis-summary');
  insight.append(heading('命盘信息'), make('p', '', `日主：${data.pillars[2].ganzhi.slice(0, 1)} · 四柱：${data.pillars.map(p => p.ganzhi).join(' ')}`));
  const tags = make('div', 'analysis-tags');
  if (shown('show-extras')) for (const [label, content] of data.extras) tags.append(make('span', '', `${label}：${content}`));
  if (tags.childElementCount) insight.append(tags);
  fragment.append(insight, renderTraditional(data)); return fragment;
}
function renderMode(data, mode) {
  modeOutput.replaceChildren();
  for (const tab of document.querySelectorAll('[data-mode]')) tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
  const titles = { traditional: '传统排盘', fullscreen: '全屏排盘', simple: '精简排盘', analysis: '分析排盘' };
  document.getElementById('result-title').textContent = titles[mode];
  if (mode === 'traditional') modeOutput.append(renderTraditional(data));
  else if (mode === 'fullscreen') modeOutput.append(renderFullscreen(data));
  else if (mode === 'analysis') modeOutput.append(renderAnalysis(data));
  else modeOutput.append(renderSimple(data));
}
function render(data) {
  const title = data.name ? `${data.name} · ` : '';
  document.getElementById('result-date').textContent = `${title}${data.solar.toYmd()} ${String(data.solar.getHour()).padStart(2, '0')}:${String(data.solar.getMinute()).padStart(2, '0')} · 农历${data.lunar.toString()}`;
  latestData = data; renderMode(data, displayMode.value); result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('use-now').addEventListener('click', () => {
  const now = beijingNow();
  calendarType.value = 'solar';
  document.getElementById('leap').checked = false;
  document.getElementById('leap-wrap').classList.add('hidden');
  for (const [id, part] of Object.entries(now)) document.getElementById(id).value = part;
  nowStatus.textContent = `已填入北京时间：${now.year}-${now.month}-${now.day} ${now.hour}:${now.minute}`;
  nowStatus.hidden = false;
});

form.addEventListener('submit', event => {
  event.preventDefault(); error.hidden = true;
  try { render(calculate()); }
  catch (exception) { result.hidden = true; error.textContent = exception instanceof Error ? exception.message : '排盘失败，请检查输入。'; error.hidden = false; }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
