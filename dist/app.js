/* global Solar, Lunar, LunarUtil */
const form = document.getElementById('chart-form');
const error = document.getElementById('error');
const result = document.getElementById('result');
const calendarType = document.getElementById('calendar-type');
const modeOutput = document.getElementById('mode-output');
const nowStatus = document.getElementById('now-status');
let latestData = null;
let activeMode = 'traditional';
let selectedLuckIndex = null;
let selectedYearIndex = null;
let showTaiYuan = false;
let homeNowData = null;
const birthSheet = document.getElementById('birth-sheet');
const fourSheet = document.getElementById('four-sheet');
const displaySheet = document.getElementById('display-sheet');

function showScreen(name) {
  for (const screen of document.querySelectorAll('.app-screen')) screen.hidden = screen.id !== `${name}-screen`;
  for (const button of document.querySelectorAll('[data-nav]')) {
    if (button.dataset.nav === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}
function updateBirthSummary() {
  const ids = ['year', 'month', 'day', 'hour', 'minute'];
  const [year, month, day, hour, minute] = ids.map(id => document.getElementById(id).value.padStart(2, '0'));
  document.getElementById('birth-summary').textContent = `${calendarType.value === 'lunar' ? '农历 ' : ''}${year}-${month}-${day} ${hour}:${minute}`;
}
function syncCalendarButtons() {
  for (const button of document.querySelectorAll('[data-calendar]')) button.setAttribute('aria-pressed', String(button.dataset.calendar === calendarType.value));
  document.getElementById('leap-wrap').classList.toggle('hidden', calendarType.value !== 'lunar');
  updateBirthSummary();
}
function switchCalendar(next) {
  if (next === calendarType.value) return;
  try {
    const y = number('year'), m = number('month'), d = number('day'), h = number('hour'), minute = number('minute');
    if (next === 'lunar' && validDate(y, m, d)) {
      const lunar = Solar.fromYmdHms(y, m, d, h, minute, 0).getLunar();
      document.getElementById('year').value = lunar.getYear();
      document.getElementById('month').value = Math.abs(lunar.getMonth());
      document.getElementById('day').value = lunar.getDay();
      document.getElementById('leap').checked = lunar.getMonth() < 0;
    } else if (next === 'solar') {
      const lunarMonth = document.getElementById('leap').checked ? -m : m;
      const solar = Lunar.fromYmdHms(y, lunarMonth, d, h, minute, 0).getSolar();
      document.getElementById('year').value = solar.getYear();
      document.getElementById('month').value = solar.getMonth();
      document.getElementById('day').value = solar.getDay();
      document.getElementById('leap').checked = false;
    }
  } catch (_) { /* Keep the entered values available for correction in the date sheet. */ }
  calendarType.value = next;
  syncCalendarButtons();
}

document.querySelector('.bottom-nav').addEventListener('click', event => {
  const button = event.target.closest('[data-nav]');
  if (button) showScreen(button.dataset.nav);
});
document.querySelector('.entry-choice-row').addEventListener('click', event => {
  const sex = event.target.closest('[data-gender]');
  if (sex) {
    document.getElementById('gender').value = sex.dataset.gender;
    for (const button of document.querySelectorAll('[data-gender]')) button.setAttribute('aria-pressed', String(button === sex));
  }
  const calendar = event.target.closest('[data-calendar]');
  if (calendar?.dataset.calendar === 'four') { fourSheet.showModal(); return; }
  if (calendar) switchCalendar(calendar.dataset.calendar);
});
document.getElementById('birth-trigger').addEventListener('click', () => birthSheet.showModal());
document.getElementById('birth-close').addEventListener('click', () => { updateBirthSummary(); birthSheet.close(); });
document.getElementById('birth-confirm').addEventListener('click', () => {
  const dateError = document.getElementById('date-error');
  try { calculate(); dateError.hidden = true; updateBirthSummary(); birthSheet.close(); }
  catch (exception) { dateError.textContent = exception.message; dateError.hidden = false; }
});
document.getElementById('four-close').addEventListener('click', () => fourSheet.close());
document.getElementById('display-trigger').addEventListener('click', () => displaySheet.showModal());
document.getElementById('display-close').addEventListener('click', () => displaySheet.close());

calendarType.addEventListener('change', syncCalendarButtons);
document.querySelector('.mode-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (!button || !latestData) return;
  activeMode = button.dataset.mode;
  renderMode(latestData, button.dataset.mode);
});
document.querySelector('.display-settings').addEventListener('change', () => { if (latestData) renderMode(latestData, activeMode); });
modeOutput.addEventListener('click', event => {
  const toggle = event.target.closest('[data-taiyuan-toggle]');
  if (toggle) {
    showTaiYuan = !showTaiYuan;
    renderMode(latestData, activeMode);
    modeOutput.querySelector('[data-taiyuan-toggle]')?.focus({ preventScroll: true });
    return;
  }
  const luck = event.target.closest('[data-luck-index]');
  if (luck) {
    selectedLuckIndex = Number(luck.dataset.luckIndex);
    selectedYearIndex = null;
    renderMode(latestData, activeMode);
    modeOutput.querySelector(`[data-luck-index="${selectedLuckIndex}"]`)?.focus({ preventScroll: true });
    return;
  }
  const year = event.target.closest('[data-year-index]');
  if (year) {
    selectedYearIndex = Number(year.dataset.yearIndex);
    renderMode(latestData, activeMode);
    modeOutput.querySelector(`[data-year-index="${selectedYearIndex}"]`)?.focus({ preventScroll: true });
  }
});

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
function startOffset(yun, solar) {
  const birth = solarMillis(solar) + 1000;
  const jie = ApkTerms.getJie(birth, yun.isForward());
  const elapsed = Math.floor(Math.abs(jie.time - birth) / 720000);
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
    const result = daYun.map((item, index) => {
      const startYear = index === 0 ? birthPillarYear : item.getStartYear();
      const annualItems = index === 0 ? [] : item.getLiuNian();
      const minorItems = item.getXiaoYun(index === 0 ? Math.max(0, daYun[1].getStartYear() - birthPillarYear) : annualItems.length);
      const years = index === 0
        ? Array.from({ length: Math.max(0, daYun[1].getStartYear() - birthPillarYear) }, (_, i) => {
          const year = birthPillarYear + i;
          const ganzhi = Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar().getYearInGanZhi();
          return { year, ganzhi, xiaoyun: minorItems[i]?.getGanZhi() || '' };
        })
        : annualItems.map((annual, i) => ({ year: annual.getYear(), ganzhi: annual.getGanZhi(), xiaoyun: minorItems[i]?.getGanZhi() || '' }));
      return {
        ganzhi: item.getGanZhi() || '运前',
        startAge: index === 0 ? 1 : startYear - birthPillarYear + 1,
        startYear,
        years,
      };
    });
    if (result[0]?.ganzhi === '运前' && result[0].years.length === 0 && result[1]?.startYear === birthPillarYear) {
      result.shift();
    }
    return result;
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
  ApkTerms.correctPillars(lunar, eight, solarMillis(solar));
  const names = ['年柱', '月柱', '日柱', '时柱'];
  const keys = ['Year', 'Month', 'Day', 'Time'];
  const pillars = keys.map((key, i) => ({
    name: names[i], ganzhi: eight[`get${key}`](), nayin: eight[`get${key}NaYin`](),
    shishen: key === 'Day' ? '日干' : eight[`get${key}ShiShenGan`](),
    hiddenStems: eight[`get${key}HideGan`](), hiddenGods: eight[`get${key}ShiShenZhi`](),
    stage: eight[`get${key}DiShi`](), empty: eight[`get${key}XunKong`](),
  }));
  const shenSha = ApkShenSha.calculate(pillars, document.getElementById('zi-rule').value === '23' ? 1 : 2, number('gender'));
  const gates = ApkShenSha.calculateGates(pillars, document.getElementById('zi-rule').value === '23' ? 1 : 2);
  const yun = eight.getYun(number('gender'));
  const offset = startOffset(yun, solar);
  const solarYearGanZhi = Solar.fromYmdHms(solar.getYear(), 7, 1, 12, 0, 0).getLunar().getYearInGanZhiExact();
  const birthPillarYear = lunar.getYearInGanZhiExact() === solarYearGanZhi ? solar.getYear() : solar.getYear() - 1;
  const yunMode = value('yun-mode');
  const luck = buildLuck(yun, solar, birthPillarYear, offset, yunMode);
  const priorJie = ApkTerms.getJie(solarMillis(solar) + 1000, false);
  const daysAfterJie = Math.floor((solarMillis(solar) + 1000 - priorJie.time) / 86400000) + 1;
  const extras = [
    ['节气', `出生于${priorJie.name}后第 ${daysAfterJie} 日`],
    ['胎元', `${eight.getTaiYuan()} · ${eight.getTaiYuanNaYin()}`],
    ['命宫', `${eight.getMingGong()} · ${eight.getMingGongNaYin()}`],
    ['身宫', `${eight.getShenGong()} · ${eight.getShenGongNaYin()}`],
  ];
  return { solar, lunar, pillars, shenSha, gates, offset, luck, yunMode, extras, priorJie, daysAfterJie, taiYuan: eight.getTaiYuan(), sect: eight.getSect(), gender: number('gender'), name: value('chart-name') };
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
function elementClass(character) {
  if ('甲乙寅卯'.includes(character)) return 'wood';
  if ('丙丁巳午'.includes(character)) return 'fire';
  if ('戊己辰戌丑未'.includes(character)) return 'earth';
  if ('庚辛申酉'.includes(character)) return 'metal';
  if ('壬癸亥子'.includes(character)) return 'water';
  return '';
}
function colored(character, className = '') { return make('span', `${className} element-${elementClass(character)}`, character); }
function phaseFor(stem, branch) {
  const stemIndex = LunarUtil.GAN.indexOf(stem) - 1;
  const branchIndex = LunarUtil.ZHI.indexOf(branch) - 1;
  if (stemIndex < 0 || branchIndex < 0) return '';
  const offset = LunarUtil.CHANG_SHENG_OFFSET[stem];
  const index = ((offset + (stemIndex % 2 === 0 ? branchIndex : -branchIndex)) % 12 + 12) % 12;
  return LunarUtil.CHANG_SHENG[index];
}
function derivedPillar(data, name, ganzhi) {
  if (!ganzhi || ganzhi === '运前') return { name, placeholder: true };
  const [stem, branch] = ganzhi;
  const dayStem = data.pillars[2].ganzhi[0];
  const hiddenStems = LunarUtil.ZHI_HIDE_GAN[branch] || [];
  const pillar = {
    name, ganzhi, nayin: LunarUtil.NAYIN[ganzhi] || '',
    shishen: LunarUtil.SHI_SHEN[dayStem + stem] || '',
    hiddenStems, hiddenGods: hiddenStems.map(hidden => LunarUtil.SHI_SHEN[dayStem + hidden] || ''),
    stage: phaseFor(dayStem, branch), empty: LunarUtil.getXunKong(ganzhi),
  };
  pillar.shenSha = ApkShenSha.calculate([...data.pillars, pillar], data.sect, data.gender)[4] || [];
  return pillar;
}
function activeLuck(data) {
  const periods = data.luck.slice(0, 11);
  const period = selectedLuckIndex == null ? null : periods[selectedLuckIndex];
  const annual = period && selectedYearIndex != null ? period.years[selectedYearIndex] : null;
  return { periods, period, annual };
}
function chartColumns(data) {
  const { period, annual } = activeLuck(data);
  const columns = data.pillars.map((pillar, index) => ({ ...pillar, shenSha: data.shenSha[index] }));
  if (showTaiYuan) columns.unshift(derivedPillar(data, '胎元', data.taiYuan));
  columns.push(derivedPillar(data, '大运', period?.ganzhi));
  columns.push(derivedPillar(data, '流年', annual?.ganzhi));
  return columns;
}
function renderChartCell(pillar, kind) {
  const cell = make('td', `chart-cell cell-${kind}${pillar.placeholder ? ' blank-period' : ''}`);
  if (pillar.placeholder) return cell;
  if (kind === 'stem' || kind === 'branch') {
    cell.append(colored(pillar.ganzhi[kind === 'stem' ? 0 : 1], 'big-character'));
  } else if (kind === 'hidden') {
    pillar.hiddenStems.forEach((stem, index) => {
      const line = make('span', 'hidden-line');
      line.append(colored(stem), make('span', 'hidden-god', pillar.hiddenGods[index]));
      cell.append(line);
    });
  } else if (kind === 'self') {
    cell.textContent = phaseFor(pillar.ganzhi[0], pillar.ganzhi[1]);
  } else if (kind === 'sha') {
    for (const name of pillar.shenSha || []) cell.append(make('span', 'sha-line', name));
  } else {
    const values = { god: pillar.shishen, nayin: pillar.nayin, stage: pillar.stage, empty: pillar.empty };
    cell.textContent = values[kind] || '';
  }
  return cell;
}
function renderElementSeason(data) {
  const monthBranch = data.pillars[1].ganzhi[1];
  const ruling = '寅卯'.includes(monthBranch) ? ['木', '火', '水', '金', '土']
    : '巳午'.includes(monthBranch) ? ['火', '土', '木', '水', '金']
    : '申酉'.includes(monthBranch) ? ['金', '水', '土', '火', '木']
    : '亥子'.includes(monthBranch) ? ['水', '木', '金', '土', '火']
    : ['土', '金', '火', '木', '水'];
  const colors = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
  const bar = make('div', 'element-season');
  bar.setAttribute('aria-label', '五行旺相休囚死');
  ruling.forEach((element, index) => bar.append(make('span', `season-${colors[element]}`, `${element}${'旺相休囚死'[index]}`)));
  return bar;
}
function renderTraditional(data) {
  const fragment = document.createDocumentFragment();
  const toolbar = make('div', 'chart-toolbar');
  const taiToggle = make('button', 'taiyuan-toggle', `胎元 ${showTaiYuan ? '开' : '关'}`);
  taiToggle.type = 'button'; taiToggle.dataset.taiyuanToggle = ''; taiToggle.setAttribute('aria-pressed', String(showTaiYuan));
  toolbar.append(taiToggle); fragment.append(toolbar);
  const viewport = make('div', 'matrix-scroll');
  viewport.setAttribute('role', 'region'); viewport.setAttribute('aria-label', '原局与选中大运流年');
  const table = make('table', `pillar-matrix traditional-matrix${showTaiYuan ? ' with-taiyuan' : ''}`);
  const columns = chartColumns(data);
  const head = make('thead');
  const headRow = make('tr');
  headRow.append(make('th', 'row-label', '日期'));
  for (const pillar of columns) headRow.append(make('th', 'pillar-heading', pillar.name));
  head.append(headRow); table.append(head);
  const rows = [['主星', 'god'], ['天干', 'stem'], ['地支', 'branch']];
  if (shown('show-hidden')) rows.push(['藏气', 'hidden']);
  if (shown('show-nayin')) rows.push(['纳音', 'nayin']);
  if (shown('show-stage')) rows.push(['星运', 'stage'], ['自坐', 'self']);
  if (shown('show-empty')) rows.push(['空亡', 'empty']);
  if (shown('show-shensha')) rows.push(['神煞', 'sha']);
  const body = make('tbody');
  for (const [label, kind] of rows) {
    const row = make('tr', `chart-row row-${kind}`); row.append(make('th', 'row-label', label));
    for (const pillar of columns) row.append(renderChartCell(pillar, kind));
    body.append(row);
  }
  table.append(body); viewport.append(table); fragment.append(viewport);
  fragment.append(renderElementSeason(data), renderInteractiveLuck(data));
  if (shown('show-gates') && data.gates?.length) {
    const gateSection = make('section', 'extra-section'); gateSection.append(heading('关卡'));
    const gateList = make('div', 'traditional-extra');
    const gateItem = make('div', 'extra-item'); gateItem.append(make('span', '', '关卡'), make('strong', '', data.gates.join('、')));
    gateList.append(gateItem); gateSection.append(gateList); fragment.append(gateSection);
  }
  return fragment;
}
function renderExtras(data) {
  const section = make('section', 'extra-section'); section.append(heading('附加排盘数据'));
  const list = make('div', 'traditional-extra');
  for (const [label, content] of data.extras) {
    const item = make('div', 'extra-item'); item.append(make('span', '', label), make('strong', '', content)); list.append(item);
  }
  section.append(list); return section;
}
function shortGod(name) {
  return ({ 比肩: '比', 劫财: '劫', 食神: '食', 伤官: '伤', 偏财: '才', 正财: '财', 七杀: '杀', 正官: '官', 偏印: '枭', 正印: '印' })[name] || '';
}
function periodGlyphs(tile, ganzhi, dayStem) {
  const [stem, branch] = ganzhi;
  const stemLine = make('span', 'period-glyph-line');
  stemLine.append(colored(stem, 'period-glyph'), make('small', 'period-god', shortGod(LunarUtil.SHI_SHEN[dayStem + stem])));
  const mainStem = LunarUtil.ZHI_HIDE_GAN[branch]?.[0];
  const branchLine = make('span', 'period-glyph-line');
  branchLine.append(colored(branch, 'period-glyph'), make('small', 'period-god', shortGod(LunarUtil.SHI_SHEN[dayStem + mainStem])));
  tile.append(stemLine, branchLine);
}
function renderInteractiveLuck(data) {
  const section = make('section', 'interactive-luck');
  const { periods, period } = activeLuck(data);
  const dayStem = data.pillars[2].ganzhi[0];
  section.append(make('p', 'jiaoyun-line', `交运：出生后约 ${data.offset.years} 年 ${data.offset.months} 个月 ${data.offset.days} 天起运`));
  const choices = make('div', 'period-choices dayun-choices');
  choices.style.gridTemplateColumns = `repeat(${periods.length}, minmax(0, 1fr))`;
  choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', '选择大运');
  periods.forEach((item, index) => {
    const tile = make('button', 'period-tile'); tile.type = 'button'; tile.dataset.luckIndex = String(index);
    tile.setAttribute('aria-pressed', String(index === selectedLuckIndex));
    tile.setAttribute('aria-label', item.ganzhi === '运前' ? `${item.startYear}年 交运前` : `${item.startYear}年 ${item.startAge}岁 大运${item.ganzhi}`);
    tile.append(make('span', 'period-year', String(item.startYear)), make('span', 'period-age', `${item.startAge}岁`));
    if (item.ganzhi === '运前') {
      tile.append(make('span', 'preluck-label', '运前'));
    } else {
      periodGlyphs(tile, item.ganzhi, dayStem);
      tile.append(make('span', 'period-foot', phaseFor(dayStem, item.ganzhi[1])));
    }
    choices.append(tile);
  });
  section.append(choices);
  if (period) {
    const hasXiaoYun = period.years.some(item => item.xiaoyun);
    const heading = make('p', 'period-caption', `${hasXiaoYun ? '流年 / 小运' : '流年'}（${period.startAge}岁起）`);
    const years = make('div', 'period-choices year-choices');
    years.style.gridTemplateColumns = `repeat(${period.years.length}, minmax(0, 1fr))`;
    years.setAttribute('role', 'group'); years.setAttribute('aria-label', '选择流年');
    period.years.forEach((item, index) => {
      const tile = make('button', 'period-tile'); tile.type = 'button'; tile.dataset.yearIndex = String(index);
      tile.setAttribute('aria-pressed', String(index === selectedYearIndex));
      tile.setAttribute('aria-label', `${item.year}年 流年${item.ganzhi}`);
      tile.append(make('span', 'period-year', String(item.year)));
      periodGlyphs(tile, item.ganzhi, dayStem);
      tile.append(make('span', 'period-foot', item.xiaoyun || ''));
      years.append(tile);
    });
    section.append(heading, years);
  }
  return section;
}
function renderLuck(data) {
  const section = make('section', 'luck-section');
  const modeLabels = { year: '按年（原版默认）', cumulative: '按岁累加', simple: '按岁简化', rounded: '按岁舍入' };
  section.append(heading('大运与流年'), make('p', 'luck-start', `出生后约 ${data.offset.years} 年 ${data.offset.months} 个月 ${data.offset.days} 天起运 · ${modeLabels[data.yunMode] || modeLabels.year}`));
  const list = make('div', 'luck-list');
  list.style.gridTemplateColumns = `repeat(${data.luck.length}, minmax(0, 1fr))`;
  for (const item of data.luck) {
    const card = make('article', 'luck-item'); card.setAttribute('role', 'listitem');
    const header = make('header', 'luck-head');
    header.append(make('span', 'luck-label', item.ganzhi === '运前' ? '交运前' : '大运'), make('strong', '', item.ganzhi), make('span', 'luck-start-age', `${item.startAge}岁起`), make('span', 'luck-start-year', String(item.startYear))); card.append(header);
    const years = make('div', 'annual-list');
    for (const year of item.years) {
      const row = make('div', 'annual-year');
      row.append(make('span', '', String(year.year)), make('strong', '', year.ganzhi));
      years.append(row);
    }
    card.append(years); list.append(card);
  }
  list.setAttribute('role', 'list');
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
  return renderTraditional(data);
}
function renderMode(data, mode) {
  modeOutput.replaceChildren();
  for (const tab of document.querySelectorAll('[data-mode]')) tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
  const titles = { traditional: '传统排盘', fullscreen: '全盘', simple: '精简排盘' };
  document.getElementById('result-title').textContent = titles[mode];
  if (mode === 'traditional') modeOutput.append(renderTraditional(data));
  else if (mode === 'fullscreen') modeOutput.append(renderFullscreen(data));
  else modeOutput.append(renderSimple(data));
}
function render(data) {
  const solarTime = `${data.solar.toYmd()} ${String(data.solar.getHour()).padStart(2, '0')}:${String(data.solar.getMinute()).padStart(2, '0')}`;
  const jie = new Date(data.priorJie.time);
  const jieTime = `${jie.getUTCFullYear()}年${String(jie.getUTCMonth() + 1).padStart(2, '0')}月${String(jie.getUTCDate()).padStart(2, '0')}日 ${String(jie.getUTCHours()).padStart(2, '0')}:${String(jie.getUTCMinutes()).padStart(2, '0')}`;
  document.getElementById('result-qian-kun').textContent = data.gender === 1 ? '乾' : '坤';
  document.getElementById('result-lunar').textContent = `农历：${data.lunar.toString()}`;
  document.getElementById('result-date').textContent = `阳历：${solarTime}`;
  document.getElementById('term-prior').textContent = `${data.priorJie.name}：${jieTime}`;
  document.getElementById('term-birth').textContent = `出生：${solarTime}（${data.priorJie.name}后第 ${data.daysAfterJie} 天）`;
  selectedLuckIndex = null; selectedYearIndex = null;
  latestData = data; renderMode(data, activeMode); result.hidden = false;
  showScreen('chart');
}

document.getElementById('edit-birth').addEventListener('click', () => {
  showScreen('home');
  document.getElementById('chart-name').focus({ preventScroll: true });
});

document.getElementById('use-now').addEventListener('click', () => {
  const now = beijingNow();
  calendarType.value = 'solar'; syncCalendarButtons();
  document.getElementById('leap').checked = false;
  document.getElementById('leap-wrap').classList.add('hidden');
  for (const [id, part] of Object.entries(now)) document.getElementById(id).value = part;
  updateBirthSummary();
  nowStatus.textContent = `已填入北京时间：${now.year}-${now.month}-${now.day} ${now.hour}:${now.minute}`;
  nowStatus.hidden = false;
});

document.getElementById('instant-chart').addEventListener('click', () => { if (homeNowData) render(homeNowData); });

function initializeHomeNow() {
  const now = beijingNow();
  for (const [id, part] of Object.entries(now)) document.getElementById(id).value = part;
  updateBirthSummary();
  try {
    homeNowData = calculate();
    const box = document.getElementById('instant-pillars');
    for (const pillar of homeNowData.pillars) {
      const column = make('span', 'instant-pillar');
      column.append(make('span', '', pillar.ganzhi[0]), make('span', '', pillar.ganzhi[1]));
      box.append(column);
    }
    document.getElementById('instant-lunar').textContent = `农历：${homeNowData.lunar.toString()}`;
    document.getElementById('instant-solar').textContent = `公历：${homeNowData.solar.toYmd()} ${now.hour}:${now.minute}`;
    document.getElementById('instant-hour').textContent = `${homeNowData.pillars[3].ganzhi[1]}时 ${now.hour}:${now.minute}`;
  } catch (exception) {
    document.getElementById('instant-lunar').textContent = '当前时刻排盘暂不可用';
    document.getElementById('instant-chart').disabled = true;
  }
}
initializeHomeNow();

form.addEventListener('submit', event => {
  event.preventDefault(); error.hidden = true;
  try { render(calculate()); }
  catch (exception) { result.hidden = true; error.textContent = exception instanceof Error ? exception.message : '排盘失败，请检查输入。'; error.hidden = false; }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
