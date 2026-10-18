/* global Solar, Lunar */
const form = document.getElementById('chart-form');
const error = document.getElementById('error');
const result = document.getElementById('result');
const calendarType = document.getElementById('calendar-type');
const simpleButton = document.getElementById('view-simple');
const detailButton = document.getElementById('view-detail');
function setView(detail) {
  document.getElementById('pillars').hidden = detail;
  document.getElementById('traditional').hidden = !detail;
  document.getElementById('traditional-extra').hidden = !detail;
  simpleButton.setAttribute('aria-pressed', String(!detail));
  detailButton.setAttribute('aria-pressed', String(detail));
}
simpleButton.addEventListener('click', () => setView(false));
detailButton.addEventListener('click', () => setView(true));
calendarType.addEventListener('change', () => document.getElementById('leap-wrap').classList.toggle('hidden', calendarType.value !== 'lunar'));

function number(id) { return Number(document.getElementById(id).value); }
function validDate(y, m, d) {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
function safeText(value) { return String(value == null ? '' : value); }
function solarMillis(solar) { return Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()); }

function startOffset(lunar, yun, solar) {
  const jie = yun.isForward() ? lunar.getNextJie().getSolar() : lunar.getPrevJie().getSolar();
  const elapsed = Math.floor(Math.abs(solarMillis(jie) - solarMillis(solar)) / 720000);
  return { years: Math.floor(elapsed / 360), months: Math.floor((elapsed % 360) / 30), days: elapsed % 30 };
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
    if (solar.getLunar().getYear() !== y || solar.getLunar().getMonth() !== lunarMonth || solar.getLunar().getDay() !== d) throw new Error('农历日期不存在，请检查是否为闰月。');
    if (solar.getYear() < 1901 || solar.getYear() > 2099) throw new Error('转换后的公历日期超出当前支持范围。');
  } else {
    if (!validDate(y, m, d)) throw new Error('公历日期不存在，请检查年月日。');
    solar = Solar.fromYmdHms(y, m, d, h, minute, 0);
  }
  const eight = solar.getLunar().getEightChar();
  eight.setSect(document.getElementById('zi-rule').value === '23' ? 1 : 2);
  const names = ['年柱', '月柱', '日柱', '时柱'];
  const keys = ['Year', 'Month', 'Day', 'Time'];
  const pillars = keys.map((key, i) => ({
    name: names[i],
    ganzhi: eight[`get${key}`](),
    nayin: eight[`get${key}NaYin`](),
    shishen: key === 'Day' ? '日主' : eight[`get${key}ShiShenGan`](),
    hiddenStems: eight[`get${key}HideGan`](),
    hiddenGods: eight[`get${key}ShiShenZhi`](),
    stage: eight[`get${key}DiShi`](),
    empty: eight[`get${key}XunKong`]()
  }));
  const lunar = solar.getLunar();
  const yun = eight.getYun(number('gender'));
  const offset = startOffset(lunar, yun, solar);
  const luck = yun.getDaYun(11).map(x => ({
    ganzhi: x.getGanZhi() || '运前', startAge: x.getStartAge(), startYear: x.getStartYear(),
    years: x.getLiuNian().map(annual => ({ year: annual.getYear(), ganzhi: annual.getGanZhi() }))
  }));
  const priorJie = lunar.getPrevJie();
  const daysAfterJie = Math.floor((Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay()) - Date.UTC(priorJie.getSolar().getYear(), priorJie.getSolar().getMonth() - 1, priorJie.getSolar().getDay())) / 86400000) + 1;
  const extras = [
    ['节气', `出生于${priorJie.getName()}后第 ${daysAfterJie} 日`],
    ['胎元', `${eight.getTaiYuan()} · ${eight.getTaiYuanNaYin()}`],
    ['命宫', `${eight.getMingGong()} · ${eight.getMingGongNaYin()}`],
    ['身宫', `${eight.getShenGong()} · ${eight.getShenGongNaYin()}`]
  ];
  return { solar, lunar, pillars, yun, offset, luck, extras };
}

function render(data) {
  document.getElementById('result-date').textContent = `${data.solar.toYmd()} ${String(data.solar.getHour()).padStart(2, '0')}:${String(data.solar.getMinute()).padStart(2, '0')} · 农历${data.lunar.toString()}`;
  const pillarContainer = document.getElementById('pillars');
  pillarContainer.replaceChildren();
  for (const pillar of data.pillars) {
    const card = document.createElement('div'); card.className = 'pillar';
    const label = document.createElement('div'); label.className = 'label'; label.textContent = pillar.name;
    const ganzhi = document.createElement('div'); ganzhi.className = 'ganzhi'; ganzhi.textContent = safeText(pillar.ganzhi);
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${safeText(pillar.shishen)} · ${safeText(pillar.nayin)}`;
    card.append(label, ganzhi, meta); pillarContainer.append(card);
  }
  const traditionalContainer = document.getElementById('traditional');
  traditionalContainer.replaceChildren();
  for (const pillar of data.pillars) {
    const card = document.createElement('article'); card.className = 'trad-card';
    const heading = document.createElement('h3'); heading.textContent = pillar.name;
    const value = document.createElement('strong'); value.className = 'trad-ganzhi'; value.textContent = safeText(pillar.ganzhi);
    card.append(heading, value);
    const rows = [
      ['天干十神', pillar.shishen],
      ['藏干', pillar.hiddenStems.map((stem, i) => `${stem} ${pillar.hiddenGods[i]}`).join(' · ')],
      ['纳音', pillar.nayin],
      ['长生', pillar.stage],
      ['旬空', pillar.empty]
    ];
    for (const [name, valueText] of rows) {
      const row = document.createElement('div'); row.className = 'trad-row';
      const label = document.createElement('span'); label.textContent = name;
      const content = document.createElement('span'); content.textContent = safeText(valueText);
      row.append(label, content); card.append(row);
    }
    traditionalContainer.append(card);
  }
  const extraContainer = document.getElementById('traditional-extra');
  extraContainer.replaceChildren();
  for (const [name, value] of data.extras) {
    const item = document.createElement('div'); item.className = 'extra-item';
    const label = document.createElement('span'); label.textContent = name;
    const content = document.createElement('strong'); content.textContent = value;
    item.append(label, content); extraContainer.append(item);
  }
  document.getElementById('luck-start').textContent = `出生后约 ${data.offset.years} 年 ${data.offset.months} 个月 ${data.offset.days} 天起运`;
  const luckContainer = document.getElementById('luck'); luckContainer.replaceChildren();
  for (const item of data.luck) {
    const card = document.createElement('details'); card.className = 'luck-item';
    const summary = document.createElement('summary');
    const title = document.createElement('strong'); title.textContent = item.ganzhi;
    const sub = document.createElement('span'); sub.textContent = `${item.startAge} 岁起 · ${item.startYear} 年`;
    summary.append(title, sub); card.append(summary);
    const years = document.createElement('div'); years.className = 'annual-list';
    for (const annual of item.years) {
      const year = document.createElement('div'); year.textContent = `${annual.year} ${annual.ganzhi}`; years.append(year);
    }
    card.append(years); luckContainer.append(card);
  }
  result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', event => {
  event.preventDefault(); error.hidden = true;
  try { render(calculate()); }
  catch (e) { result.hidden = true; error.textContent = e instanceof Error ? e.message : '排盘失败，请检查输入。'; error.hidden = false; }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
