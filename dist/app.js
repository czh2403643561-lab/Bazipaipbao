/* global Solar, Lunar, LunarUtil, LunarYear */
const form = document.getElementById('chart-form');
const error = document.getElementById('error');
const result = document.getElementById('result');
const calendarType = document.getElementById('calendar-type');
const modeOutput = document.getElementById('mode-output');
const nowStatus = document.getElementById('now-status');
let latestData = null;
let favoriteEpoch = 0;
let activeAnalysisCaseId = null;
let savedAnalysisSnapshot = { summary: '', body: '' };
let analysisSaveTimer = null;
let analysisSavePromise = Promise.resolve();
let analysisLoadEpoch = 0;
let editingCaseId = null;
let activeMode = 'traditional';
let selectedLuckIndex = null;
let selectedYearIndex = null;
let showTaiYuan = false;
let homeNowData = null;
let fourSelections = [];
let fourYearRecords = [];
let fourOptions = [];
let selectedFourCandidate = null;
let fourEditIndex = 0;
let fourPhase = 'stem';
let fourPendingStem = '';
let fourRecordZiRule = null;
const SIQUAN_RULES = {
  子: [['壬', 10], ['癸', 20]], 丑: [['癸', 9], ['辛', 3], ['己', 18]],
  寅: [['戊', 7], ['丙', 7], ['甲', 16]], 卯: [['甲', 10], ['乙', 20]],
  辰: [['乙', 9], ['癸', 3], ['戊', 18]], 巳: [['戊', 5], ['庚', 9], ['丙', 16]],
  午: [['丙', 10], ['己', 9], ['丁', 11]], 未: [['丁', 9], ['乙', 3], ['己', 18]],
  申: [['戊', 10], ['壬', 3], ['庚', 17]], 酉: [['庚', 10], ['辛', 20]],
  戌: [['辛', 9], ['丁', 3], ['戊', 18]], 亥: [['戊', 7], ['甲', 5], ['壬', 18]],
};
function siQuanStem(monthBranch, dayAfterJie) {
  let elapsed = 0;
  const sections = SIQUAN_RULES[monthBranch] || [];
  for (const [stem, days] of sections) {
    if (dayAfterJie > elapsed && dayAfterJie <= elapsed + days) return stem;
    elapsed += days;
  }
  return dayAfterJie > elapsed && sections.length ? sections[sections.length - 1][0] : '';
}
const autoSave = document.getElementById('auto-save');
try { autoSave.checked = localStorage.getItem('bazi-auto-save') === '1'; } catch (_) { /* Private browsing can deny storage. */ }
const birthSheet = document.getElementById('birth-sheet');
const fourSheet = document.getElementById('four-sheet');
const displaySheet = document.getElementById('display-sheet');

function showScreen(name) {
  if (name !== 'chart' && analysisChanged()) saveOpenAnalysis().catch(exception => {
    document.getElementById('analysis-status').textContent = `保存失败：${exception.message || '请重试'}`;
  });
  for (const screen of document.querySelectorAll('.app-screen')) screen.hidden = screen.id !== `${name}-screen`;
  for (const button of document.querySelectorAll('[data-nav]')) {
    if (button.dataset.nav === name || (name === 'chart' && button.dataset.nav === 'home')) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
  if (name === 'cases') refreshCases();
}
function updateBirthSummary() {
  const ids = ['year', 'month', 'day', 'hour', 'minute'];
  const [year, month, day, hour, minute] = ids.map(id => document.getElementById(id).value.padStart(2, '0'));
  if (calendarType.value === 'lunar') {
    const monthName = document.getElementById('leap').checked ? `闰${lunarMonths[Number(month) - 1]}` : lunarMonths[Number(month) - 1];
    document.getElementById('birth-summary').textContent = `农历 ${year}年${monthName || `${month}月`}${lunarDayName(day)} ${hour}:${minute}`;
  } else document.getElementById('birth-summary').textContent = `${year}-${month}-${day} ${hour}:${minute}`;
}
function setBirthLocation(location) {
  const value = String(location || '').trim();
  document.getElementById('birth-location').value = value;
  document.getElementById('birth-place-summary').textContent = value || '未知地 · 北京时间';
}
function renderRegionOptions(select, options, selected = '') {
  select.replaceChildren();
  for (const option of options) {
    const node = document.createElement('option'); node.value = option.value; node.textContent = option.label;
    select.append(node);
  }
  if (selected && [...select.options].some(option => option.value === selected)) select.value = selected;
}
function regionPathText(province, city, area) { return [province, city, area].filter(Boolean).join(' · '); }
function initializeBirthPlace() {
  const provinces = window.RegionData || [];
  if (!provinces.length) return;
  const provinceSelect = document.getElementById('region-province');
  const citySelect = document.getElementById('region-city');
  const areaSelect = document.getElementById('region-area');
  const sheet = document.getElementById('birth-place-sheet');
  const search = document.getElementById('region-search');
  const results = document.getElementById('region-results');
  const fillCities = (provinceName, chosenCity = '', chosenArea = '') => {
    const province = provinces.find(item => item.name === provinceName) || provinces[0];
    const cities = province?.cities || [];
    renderRegionOptions(citySelect, cities.map(city => ({ value: city.name, label: city.name })), chosenCity);
    const city = cities.find(item => item.name === citySelect.value) || cities[0];
    renderRegionOptions(areaSelect, (city?.areas || []).map(area => ({ value: area, label: area })), chosenArea);
  };
  const fillProvinces = (provinceName = '北京市', cityName = '', areaName = '') => {
    renderRegionOptions(provinceSelect, provinces.map(item => ({ value: item.name, label: item.name })), provinceName);
    fillCities(provinceSelect.value, cityName, areaName);
  };
  fillProvinces();
  provinceSelect.addEventListener('change', () => fillCities(provinceSelect.value));
  citySelect.addEventListener('change', () => fillCities(provinceSelect.value, citySelect.value));
  document.getElementById('birth-place-trigger').addEventListener('click', () => {
    const current = document.getElementById('birth-location').value;
    const found = provinces.flatMap(province => province.cities.flatMap(city => city.areas.map(area => ({ province, city, area }))))
      .find(path => regionPathText(path.province.name, path.city.name, path.area) === current);
    fillProvinces(found?.province.name || '北京市', found?.city.name || '', found?.area || '');
    search.value = ''; results.replaceChildren(); results.hidden = true; sheet.showModal();
  });
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase(); results.replaceChildren();
    if (!query) { results.hidden = true; return; }
    const matches = [];
    for (const province of provinces) for (const city of province.cities) for (const area of city.areas) {
      const label = regionPathText(province.name, city.name, area);
      if (label.toLowerCase().includes(query)) matches.push({ province, city, area, label });
    }
    for (const match of matches.slice(0, 24)) {
      const button = make('button', 'region-result', match.label); button.type = 'button';
      button.addEventListener('click', () => { fillProvinces(match.province.name, match.city.name, match.area); results.hidden = true; search.value = match.label; });
      results.append(button);
    }
    results.hidden = matches.length === 0;
  });
  document.getElementById('birth-place-close').addEventListener('click', () => sheet.close());
  document.getElementById('birth-place-clear').addEventListener('click', () => { setBirthLocation(''); sheet.close(); });
  document.getElementById('birth-place-confirm').addEventListener('click', () => {
    setBirthLocation(regionPathText(provinceSelect.value, citySelect.value, areaSelect.value)); sheet.close();
  });
}
const lunarMonths = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
function lunarDayName(day) {
  const n = Number(day); const digits = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (n === 10) return '初十'; if (n === 20) return '二十'; if (n === 30) return '三十';
  return `${n < 10 ? '初' : n < 20 ? '十' : n < 30 ? '廿' : '三'}${digits[(n - 1) % 10]}`;
}
function renderWheel(type, options, selected) {
  const wheel = document.querySelector(`[data-wheel="${type}"]`);
  wheel.replaceChildren(); wheel.dataset.selected = String(selected);
  wheel.append(make('span', 'wheel-spacer'));
  for (const option of options) {
    const button = make('button', 'wheel-option', option.label);
    button.type = 'button'; button.dataset.value = String(option.value);
    button.setAttribute('aria-pressed', String(String(option.value) === String(selected)));
    wheel.append(button);
  }
  wheel.append(make('span', 'wheel-spacer'));
  wheel.onscroll = () => {
    clearTimeout(wheel._scrollTimer);
    wheel._scrollTimer = setTimeout(() => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(wheel.scrollTop / 36)));
    const option = options[index]; if (!option) return;
    if (wheel.dataset.selected === String(option.value)) return;
    wheel.dataset.selected = String(option.value);
    for (const button of wheel.querySelectorAll('.wheel-option')) button.setAttribute('aria-pressed', String(button.dataset.value === String(option.value)));
    if (type === 'year') { document.getElementById('year').value = option.value; updateLunarMonthWheel(); }
    if (type === 'month') { document.getElementById('month').value = Math.abs(option.value); document.getElementById('leap').checked = Number(option.value) < 0; }
    if (type === 'day') document.getElementById('day').value = option.value;
    if (type === 'hour') document.getElementById('hour').value = option.value;
    if (type === 'minute') document.getElementById('minute').value = option.value;
    if (type === 'month') updateLunarDayWheel();
    updateBirthSummary();
    }, 90);
  };
  const index = options.findIndex(option => String(option.value) === String(selected));
  wheel.scrollTop = Math.max(0, index) * 36;
}
function updateLunarDayWheel() {
  const y = Number(document.getElementById('year').value) || 2000;
  const m = Number(document.getElementById('month').value) || 1;
  const leap = document.getElementById('leap').checked;
  const signedMonth = leap ? -m : m;
  const month = LunarYear.fromYear(y).getMonth(signedMonth);
  const count = month ? month.getDayCount() : 30;
  const day = Math.min(Number(document.getElementById('day').value) || 1, count);
  document.getElementById('day').value = day;
  renderWheel('day', Array.from({ length: count }, (_, i) => ({ value: i + 1, label: lunarDayName(i + 1) })), day);
}
function updateLunarWheels() {
  const y = Number(document.getElementById('year').value) || 2000;
  const years = Array.from({ length: 299 }, (_, i) => 1801 + i).map(value => ({ value, label: String(value) }));
  renderWheel('year', years, y);
  updateLunarMonthWheel();
  renderWheel('hour', Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2, '0') })), Number(document.getElementById('hour').value) || 0);
  renderWheel('minute', Array.from({ length: 60 }, (_, i) => ({ value: i, label: String(i).padStart(2, '0') })), Number(document.getElementById('minute').value) || 0);
}
function updateLunarMonthWheel() {
  const y = Number(document.getElementById('year').value) || 2000;
  const months = LunarYear.fromYear(y).getMonths().map(month => {
    const value = month.getMonth(); const name = lunarMonths[Math.abs(value) - 1] || '腊月';
    return { value, label: value < 0 ? `闰${name}` : name };
  });
  const currentMonth = document.getElementById('leap').checked ? -Number(document.getElementById('month').value) : Number(document.getElementById('month').value);
  const selectedMonth = months.some(month => month.value === currentMonth) ? currentMonth : Number(document.getElementById('month').value) || 1;
  if (selectedMonth < 0) document.getElementById('leap').checked = true;
  else document.getElementById('leap').checked = false;
  renderWheel('month', months, selectedMonth);
  updateLunarDayWheel();
}
function syncBirthPanel() {
  const lunar = calendarType.value === 'lunar';
  document.getElementById('solar-input-panel').hidden = lunar;
  document.querySelector('.date-fields').hidden = lunar;
  document.getElementById('lunar-wheel-panel').hidden = !lunar;
  if (lunar) updateLunarWheels();
  updateBirthSummary();
}
function syncCalendarButtons() {
  for (const button of document.querySelectorAll('[data-calendar]')) button.setAttribute('aria-pressed', String(button.dataset.calendar === calendarType.value));
  syncBirthPanel();
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
  if (calendar?.dataset.calendar === 'four') {
    if (fourSelections.length && fourRecordZiRule !== document.getElementById('zi-rule').value) reconcileFourPillars(0);
    renderFourInput(); fourSheet.showModal(); return;
  }
  if (calendar) switchCalendar(calendar.dataset.calendar);
});
document.getElementById('birth-trigger').addEventListener('click', () => { syncBirthPanel(); birthSheet.showModal(); if (calendarType.value === 'lunar') requestAnimationFrame(updateLunarWheels); });
document.getElementById('birth-close').addEventListener('click', () => { updateBirthSummary(); birthSheet.close(); });
document.getElementById('birth-confirm').addEventListener('click', () => {
  const dateError = document.getElementById('date-error');
  try { calculate(); dateError.hidden = true; updateBirthSummary(); birthSheet.close(); }
  catch (exception) { dateError.textContent = exception.message; dateError.hidden = false; }
});
document.getElementById('four-confirm').addEventListener('click', confirmFourPillars);
document.getElementById('four-close').addEventListener('click', () => fourSheet.close());
document.getElementById('four-clear').addEventListener('click', clearFourPillars);
document.getElementById('four-options').addEventListener('click', event => {
  const option = event.target.closest('[data-four-value]'); if (!option) return;
  selectFourPillar(option.dataset.fourValue);
});
document.getElementById('four-candidate-list').addEventListener('click', event => {
  const option = event.target.closest('[data-candidate-index]'); if (!option) return;
  selectedFourCandidate = fourOptions[Number(option.dataset.candidateIndex)]; renderFourInput();
});
document.getElementById('four-slots').addEventListener('click', event => {
  const slot = event.target.closest('[data-four-slot]'); if (!slot) return;
  editFourPillar(Number(slot.dataset.fourSlot), event.target.closest('[data-four-part]')?.dataset.fourPart);
});
document.getElementById('shortcut-confirm').addEventListener('click', fillSolarShortcut);
document.getElementById('birth-shortcut').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); fillSolarShortcut(); } });
document.getElementById('summer-help').addEventListener('click', () => { const hint = document.getElementById('summer-hint'); hint.hidden = !hint.hidden; });
document.querySelectorAll('.lunar-wheel').forEach(wheel => wheel.addEventListener('click', event => {
  const option = event.target.closest('.wheel-option'); if (!option) return;
  const index = [...wheel.querySelectorAll('.wheel-option')].indexOf(option); wheel.scrollTo({ top: index * 36, behavior: 'smooth' });
}));
document.getElementById('display-trigger').addEventListener('click', () => displaySheet.showModal());
document.getElementById('display-close').addEventListener('click', () => displaySheet.close());

calendarType.addEventListener('change', syncCalendarButtons);
document.querySelector('.mode-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (!button || !latestData) return;
  activeMode = button.dataset.mode;
  renderMode(latestData, button.dataset.mode);
  if (activeMode === 'analysis') loadAnalysis(latestData);
  else if (analysisChanged()) saveOpenAnalysis().catch(exception => {
    document.getElementById('analysis-status').textContent = `保存失败：${exception.message || '请重试'}`;
  });
});
document.querySelector('.display-settings').addEventListener('change', () => { if (latestData) renderMode(latestData, activeMode); });
document.getElementById('taiyuan-toggle').addEventListener('click', event => {
  if (!latestData) return;
  showTaiYuan = !showTaiYuan;
  renderMode(latestData, activeMode);
  event.currentTarget.focus({ preventScroll: true });
});
modeOutput.addEventListener('click', event => {
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
function fillSolarShortcut() {
  const errorNode = document.getElementById('date-error');
  const digits = document.getElementById('birth-shortcut').value.trim().replace(/\D/g, '');
  if (!/^\d{12}$/.test(digits)) { errorNode.textContent = '请输入 12 位出生时间，例如 20030506.0720。'; errorNode.hidden = false; return; }
  const values = { year: digits.slice(0, 4), month: digits.slice(4, 6), day: digits.slice(6, 8), hour: digits.slice(8, 10), minute: digits.slice(10, 12) };
  for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
  calendarType.value = 'solar'; document.getElementById('leap').checked = false; syncCalendarButtons();
  try { calculate(); errorNode.hidden = true; updateBirthSummary(); }
  catch (error) { errorNode.textContent = error.message; errorNode.hidden = false; }
}
function chinaSummerTime(solar) {
  const ranges = { 1986: [5, 4, 9, 14], 1987: [4, 12, 9, 13], 1988: [4, 10, 9, 11], 1989: [4, 16, 9, 17], 1990: [4, 15, 9, 16], 1991: [4, 14, 9, 15] };
  const range = ranges[solar.getYear()]; if (!range) return false;
  const value = (((solar.getMonth() * 32 + solar.getDay()) * 24 + solar.getHour()) * 60 + solar.getMinute());
  const start = (((range[0] * 32 + range[1]) * 24 + 3) * 60);
  const end = (((range[2] * 32 + range[3]) * 24 + 3) * 60);
  return value >= start && value < end;
}
function solarFromMillis(millis) {
  const date = new Date(millis);
  return Solar.fromYmdHms(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), 0);
}
function fourPillarsAt(y, m, d, h, minute = 30) {
  const solar = Solar.fromYmdHms(y, m, d, h, minute, 0), lunar = solar.getLunar(), eight = lunar.getEightChar();
  eight.setSect(document.getElementById('zi-rule').value === '23' ? 1 : 2);
  ApkTerms.correctPillars(lunar, eight, solarMillis(solar));
  return ['Year', 'Month', 'Day', 'Time'].map(key => eight[`get${key}`]());
}
function unique(list) { return [...new Set(list)]; }
function buildFourYearRecords(yearPillar) {
  const minYear = 1801, maxYear = 2099, candidateYears = [];
  for (let y = minYear; y <= maxYear; y++) if (fourPillarsAt(y, 7, 1, 12)[0] === yearPillar) candidateYears.push(y);
  const records = [], seen = new Set(), termProbes = new Map();
  for (const baseYear of candidateYears) for (const calendarYear of [baseYear, Math.min(maxYear, baseYear + 1)]) {
    for (const term of ApkTerms.termsForCalendarYear(calendarYear).filter(item => item.index % 2 === 1)) {
      const at = new Date(term.time), key = `${at.getUTCFullYear()}-${at.getUTCMonth() + 1}-${at.getUTCDate()}`;
      if (at.getUTCFullYear() < minYear || at.getUTCFullYear() > maxYear) continue;
      if (!termProbes.has(key)) termProbes.set(key, []);
      const minute = at.getUTCMinutes();
      termProbes.get(key).push([at.getUTCHours(), minute], [at.getUTCHours(), minute + 1]);
    }
  }
  for (const baseYear of candidateYears) {
    for (let y = baseYear; y <= Math.min(maxYear, baseYear + 1); y++) {
      const days = new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
      for (let doy = 0; doy < days; doy++) {
        const date = new Date(Date.UTC(y, 0, 1 + doy));
        const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate();
        const dateKey = `${year}-${month}-${day}`;
        const probes = [...[[0, 30], [12, 30], [23, 30]], ...(termProbes.get(dateKey) || [])];
        const probeKeys = new Set();
        for (const [hourRaw, minuteRaw] of probes) {
          const time = new Date(Date.UTC(year, month - 1, day, hourRaw, minuteRaw));
          const hour = time.getUTCHours(), minute = time.getUTCMinutes();
          const probeKey = `${hour}:${minute}`; if (probeKeys.has(probeKey)) continue; probeKeys.add(probeKey);
          const pillars = fourPillarsAt(year, month, day, hour, minute);
          if (pillars[0] !== yearPillar) continue;
          const key = `${year}-${month}-${day}-${hour}-${pillars[1]}-${pillars[2]}`;
          if (seen.has(key)) continue;
          seen.add(key); records.push({ year, month, day, hour, minute, pillars });
        }
      }
    }
  }
  return records;
}
const fourStems = '甲乙丙丁戊己庚辛壬癸';
const fourBranches = '子丑寅卯辰巳午未申酉戌亥';
function allGanzhi() {
  return Array.from({ length: 60 }, (_, index) => `${fourStems[index % 10]}${fourBranches[index % 12]}`);
}
function fourMonthPillars(yearStem) {
  const first = { 甲: 2, 己: 2, 乙: 4, 庚: 4, 丙: 6, 辛: 6, 丁: 8, 壬: 8, 戊: 0, 癸: 0 }[yearStem];
  return Array.from({ length: 12 }, (_, i) => `${fourStems[(first + i) % 10]}${fourBranches[(i + 2) % 12]}`);
}
function fourTimePillars(dayStem) {
  const first = { 甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4, 辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8 }[dayStem];
  const pillars = Array.from({ length: 12 }, (_, i) => `${fourStems[(first + i) % 10]}${fourBranches[i]}`);
  if (document.getElementById('zi-rule').value === '24') {
    const nextStem = fourStems[(fourStems.indexOf(dayStem) + 1) % 10];
    const lateZiStem = { 甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊', 丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬' }[nextStem];
    if (!pillars.includes(`${lateZiStem}子`)) pillars.push(`${lateZiStem}子`);
  }
  return pillars;
}
function fourMonthChoices() {
  const available = new Set(fourYearRecords.map(record => record.pillars[1]));
  return fourMonthPillars(fourSelections[0][0]).filter(pillar => available.has(pillar));
}
function fourDayChoices() {
  return unique(fourYearRecords.filter(record => record.pillars[1] === fourSelections[1]).map(record => record.pillars[2]));
}
function fourHourCandidates(dayPillar, monthPillar, yearPillar, targetHour = null) {
  const dates = unique(fourYearRecords.filter(record => record.pillars[0] === yearPillar && record.pillars[1] === monthPillar && record.pillars[2] === dayPillar).map(record => `${record.year}-${record.month}-${record.day}`));
  const hours = targetHour ? [targetHour] : fourTimePillars(dayPillar[0]);
  const candidates = new Map(), termCache = new Map();
  for (const key of dates) {
    const [y, m, d] = key.split('-').map(Number);
    if (!termCache.has(y)) termCache.set(y, ApkTerms.termsForCalendarYear(y).filter(term => term.index % 2 === 1));
    for (const pillar of hours) {
      const branchIndex = fourBranches.indexOf(pillar[1]);
      const probes = pillar[1] === '子' ? [[0, 0], [23, 0]] : [[branchIndex * 2, 0]];
      for (const term of termCache.get(y)) {
        const at = new Date(term.time);
        if (at.getUTCFullYear() !== y || at.getUTCMonth() + 1 !== m || at.getUTCDate() !== d) continue;
        for (const delta of [-60000, 60000]) {
          const near = new Date(at.getTime() + delta);
          if (near.getUTCFullYear() === y && near.getUTCMonth() + 1 === m && near.getUTCDate() === d) probes.push([near.getUTCHours(), near.getUTCMinutes()]);
        }
      }
      for (const [hour, minute] of probes) {
        const actual = fourPillarsAt(y, m, d, hour, minute);
        if (actual[0] !== yearPillar || actual[1] !== monthPillar || actual[2] !== dayPillar || actual[3] !== pillar) continue;
        const interval = pillar[1] === '子' ? new Date(Date.UTC(y, m - 1, d, hour === 0 ? -1 : 23)) : new Date(Date.UTC(y, m - 1, d, branchIndex * 2 - 1));
        const intervalKey = `${interval.toISOString()}-${pillar}`;
        const next = { year: y, month: m, day: d, hour, minute, pillars: actual };
        const previous = candidates.get(intervalKey);
        if (!previous || (previous.minute !== 0 && minute === 0) || (pillar[1] === '子' && previous.hour === 23 && hour === 0)) candidates.set(intervalKey, next);
      }
    }
  }
  return [...candidates.values()].sort((a, b) => Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute) - Date.UTC(a.year, a.month - 1, a.day, a.hour, a.minute));
}
function fourTimeChoices() {
  const available = new Set(fourHourCandidates(fourSelections[2], fourSelections[1], fourSelections[0]).map(candidate => candidate.pillars[3]));
  return fourTimePillars(fourSelections[2][0]).filter(pillar => available.has(pillar));
}
function reconcileFourPillars(changedIndex) {
  if (changedIndex === 0) {
    fourYearRecords = buildFourYearRecords(fourSelections[0]);
    fourRecordZiRule = document.getElementById('zi-rule').value;
  }
  if (fourSelections[1] && !fourMonthChoices().includes(fourSelections[1])) fourSelections.length = 1;
  if (fourSelections[2] && !fourDayChoices().includes(fourSelections[2])) fourSelections.length = 2;
  if (fourSelections[3] && !fourTimeChoices().includes(fourSelections[3])) fourSelections.length = 3;
  fourOptions = fourSelections.length === 4 ? fourHourCandidates(fourSelections[2], fourSelections[1], fourSelections[0], fourSelections[3]) : [];
  selectedFourCandidate = null;
  fourEditIndex = fourSelections.length;
  fourPhase = fourEditIndex === 0 || fourEditIndex === 2 ? 'stem' : 'pair';
  fourPendingStem = '';
}
function editFourPillar(index, part) {
  if (index > fourSelections.length || index > 0 && !fourSelections[index - 1]) return;
  fourEditIndex = index;
  fourPhase = index === 0 || index === 2 ? part === 'branch' && fourSelections[index] ? 'branch' : 'stem' : 'pair';
  fourPendingStem = fourPhase === 'branch' ? fourSelections[index][0] : '';
  document.getElementById('four-error').hidden = true;
  renderFourInput();
}
function renderFourInput() {
  const slots = document.getElementById('four-slots'); slots.replaceChildren();
  const labels = ['年柱', '月柱', '日柱', '时柱'];
  for (let i = 0; i < 4; i++) {
    const pillar = i === fourEditIndex && fourPhase === 'branch' ? fourPendingStem : fourSelections[i] || '';
    const button = make('button', `four-slot${pillar ? ' filled' : ''}${i === fourEditIndex ? ' active' : ''}`);
    button.type = 'button'; button.dataset.fourSlot = String(i); button.setAttribute('aria-label', `${labels[i]}${pillar || '待选择'}，点击修改`);
    for (const [part, char] of [['stem', pillar[0]], ['branch', pillar[1]]]) {
      const orb = make('span', `four-orb${char ? ' chosen' : ''}${i === fourEditIndex && (fourPhase === part || fourPhase === 'pair') ? ' picking' : ''}`);
      orb.dataset.fourPart = part;
      if (char) orb.append(colored(char));
      button.append(orb);
    }
    slots.append(button);
  }
  const options = document.getElementById('four-options'), panel = document.getElementById('four-candidates');
  const finished = fourEditIndex === 4 && fourSelections.length === 4;
  options.hidden = finished; panel.hidden = !finished; options.replaceChildren();
  let choices = [];
  if (!finished) {
    if (fourPhase === 'stem') choices = [...fourStems];
    else if (fourPhase === 'branch') {
      const available = fourEditIndex === 0 ? allGanzhi() : fourDayChoices();
      choices = unique(available.filter(pillar => pillar[0] === fourPendingStem).map(pillar => pillar[1]));
    } else if (fourEditIndex === 1) choices = fourMonthChoices();
    else if (fourEditIndex === 3) choices = fourTimeChoices();
    options.dataset.layout = fourPhase === 'branch' ? 'branches' : 'grid';
    for (const value of choices) {
      const button = make('button', 'four-option'); button.type = 'button'; button.dataset.fourValue = value;
      for (const character of value) button.append(colored(character));
      options.append(button);
    }
  }
  if (finished) {
    const list = document.getElementById('four-candidate-list'); list.replaceChildren();
    fourOptions.forEach((candidate, index) => {
      const solar = Solar.fromYmdHms(candidate.year, candidate.month, candidate.day, candidate.hour, candidate.minute, 0);
      const lunar = solar.getLunar(), lunarMonth = lunar.getMonth();
      const button = make('button', `four-candidate${candidate === selectedFourCandidate ? ' selected' : ''}`);
      button.type = 'button'; button.dataset.candidateIndex = String(index);
      button.append(make('span', 'four-candidate-solar', `阳历：${candidate.year}-${String(candidate.month).padStart(2, '0')}-${String(candidate.day).padStart(2, '0')} ${String(candidate.hour).padStart(2, '0')}:${String(candidate.minute).padStart(2, '0')}`));
      button.append(make('span', 'four-candidate-lunar', `阴历：${lunar.getYear()}年${lunarMonth < 0 ? '闰' : ''}${lunarMonths[Math.abs(lunarMonth) - 1]}${lunarDayName(lunar.getDay())} ${candidate.pillars[3][1]}时`));
      list.append(button);
    });
    document.getElementById('four-hint').textContent = fourOptions.length ? `找到 ${fourOptions.length} 个对应日期；点击其中一项后确定。` : '没有对应日期，请修改四柱。';
  } else {
    document.getElementById('four-hint').textContent = fourPhase === 'branch' ? `选择${fourEditIndex === 0 ? '年柱' : '日柱'}地支` : ['选择年柱天干', '选择月柱，一次点选完整干支', '选择日柱天干', '选择时柱，一次点选完整干支'][fourEditIndex];
  }
  document.getElementById('four-confirm').disabled = !finished || !selectedFourCandidate;
}
function clearFourPillars() {
  fourSelections = []; fourYearRecords = []; fourOptions = []; selectedFourCandidate = null;
  fourEditIndex = 0; fourPhase = 'stem'; fourPendingStem = ''; fourRecordZiRule = null;
  document.getElementById('four-error').hidden = true; renderFourInput();
}
function selectFourPillar(value) {
  if (!value || fourEditIndex > 3) return;
  if (fourPhase === 'stem') {
    fourPendingStem = value; fourPhase = 'branch'; renderFourInput(); return;
  }
  fourSelections[fourEditIndex] = fourPhase === 'branch' ? `${fourPendingStem}${value}` : value;
  reconcileFourPillars(fourEditIndex);
  document.getElementById('four-error').hidden = true; renderFourInput();
}
function confirmFourPillars() {
  if (!selectedFourCandidate) return;
  const c = selectedFourCandidate;
  calendarType.value = 'solar';
  for (const [id, value] of Object.entries({ year: c.year, month: c.month, day: c.day, hour: c.hour, minute: c.minute })) document.getElementById(id).value = value;
  document.getElementById('summer-time').checked = false; syncCalendarButtons();
  try {
    const data = calculate();
    if (data.pillars.some((pillar, index) => pillar.ganzhi !== fourSelections[index])) throw new Error('候选时间与四柱不一致，请重新选择。');
    fourSheet.close(); render(data);
  } catch (exception) { document.getElementById('four-error').textContent = exception.message; document.getElementById('four-error').hidden = false; }
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

function calculate(input = currentCaseInput()) {
  const y = Number(input.year), m = Number(input.month), d = Number(input.day);
  const h = Number(input.hour), minute = Number(input.minute);
  if (![y, m, d, h, minute].every(Number.isInteger) || y < 1801 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || minute < 0 || minute > 59) throw new Error('请填写 1801—2099 年内的完整出生时间。');
  let solar;
  if (input.calendar === 'lunar') {
    const lunarMonth = input.leap ? -m : m;
    const lunar = Lunar.fromYmdHms(y, lunarMonth, d, h, minute, 0);
    if (lunar.getYear() !== y || lunar.getMonth() !== lunarMonth || lunar.getDay() !== d) throw new Error('农历日期不存在，请检查是否为闰月。');
    solar = lunar.getSolar();
  } else {
    if (!validDate(y, m, d)) throw new Error('公历日期不存在，请检查年月日。');
    solar = Solar.fromYmdHms(y, m, d, h, minute, 0);
  }
  const inputSolar = solar;
  const summerTime = Boolean(input.summerTime);
  if (summerTime) {
    if (!chinaSummerTime(solar)) throw new Error('此时间不在排盘宝支持的夏令时阶段（中国大陆 1986—1991 年），请关闭夏令时或核对出生资料。');
    solar = solarFromMillis(solarMillis(solar) - 3600000);
  }
  const lunar = solar.getLunar();
  const eight = lunar.getEightChar();
  eight.setSect(input.ziRule === '23' ? 1 : 2);
  ApkTerms.correctPillars(lunar, eight, solarMillis(solar));
  const names = ['年柱', '月柱', '日柱', '时柱'];
  const keys = ['Year', 'Month', 'Day', 'Time'];
  const pillars = keys.map((key, i) => ({
    name: names[i], ganzhi: eight[`get${key}`](), nayin: eight[`get${key}NaYin`](),
    shishen: key === 'Day' ? '日干' : eight[`get${key}ShiShenGan`](),
    hiddenStems: eight[`get${key}HideGan`](), hiddenGods: eight[`get${key}ShiShenZhi`](),
    stage: eight[`get${key}DiShi`](), empty: eight[`get${key}XunKong`](),
  }));
  const shenSha = ApkShenSha.calculate(pillars, input.ziRule === '23' ? 1 : 2, Number(input.gender), { solarMillis: solarMillis(solar), lunarMonth: lunar.getMonth() });
  const gates = ApkShenSha.calculateGates(pillars, input.ziRule === '23' ? 1 : 2, Number(input.gender));
  const yun = eight.getYun(Number(input.gender));
  const offset = startOffset(yun, solar);
  const solarYearGanZhi = Solar.fromYmdHms(solar.getYear(), 7, 1, 12, 0, 0).getLunar().getYearInGanZhiExact();
  const birthPillarYear = lunar.getYearInGanZhiExact() === solarYearGanZhi ? solar.getYear() : solar.getYear() - 1;
  const yunMode = input.yunMode;
  const luck = buildLuck(yun, solar, birthPillarYear, offset, yunMode);
  const priorJie = ApkTerms.getJie(solarMillis(solar) + 1000, false);
  const daysAfterJie = Math.floor((solarMillis(solar) + 1000 - priorJie.time) / 86400000) + 1;
  const extras = [
    ['节气', `出生于${priorJie.name}后第 ${daysAfterJie} 日`],
    ['胎元', `${eight.getTaiYuan()} · ${eight.getTaiYuanNaYin()}`],
    ['命宫', `${eight.getMingGong()} · ${eight.getMingGongNaYin()}`],
    ['身宫', `${eight.getShenGong()} · ${eight.getShenGongNaYin()}`],
  ];
  return { solar, inputSolar, summerTime, lunar, pillars, shenSha, gates, offset, luck, yunMode, extras, priorJie, daysAfterJie, taiYuan: eight.getTaiYuan(), sect: eight.getSect(), gender: Number(input.gender), name: input.name, input };
}
function currentLuckSelection(luck, currentYear) {
  let luckIndex = luck.slice(0, 11).findIndex(period => period.years.some(item => item.year === currentYear));
  if (luckIndex < 0) luckIndex = luck.slice(0, 11).findIndex(period => period.ganzhi === '运前');
  const yearIndex = luckIndex < 0 ? -1 : luck[luckIndex].years.findIndex(item => item.year === currentYear);
  return { luckIndex: luckIndex < 0 ? null : luckIndex, yearIndex: yearIndex < 0 ? null : yearIndex };
}

function heading(text, className = 'block-title') { return make('h3', className, text); }
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
  if (!ganzhi || ganzhi === '运前') return { name, placeholder: true, placeholderText: name === '大运' && ganzhi === '运前' ? '交运前' : '' };
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
  if (pillar.placeholder) {
    if (kind === 'stem' && pillar.placeholderText) cell.append(make('span', 'preluck-cell', pillar.placeholderText));
    return cell;
  }
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
function renderAnalysis(data) {
  const fragment = document.createDocumentFragment();
  const identity = make('div', 'analysis-identity');
  identity.append(make('strong', '', data.name || '未命名案例'),
    make('span', '', data.gender === 1 ? '男' : '女'),
    make('span', '', `${data.inputSolar.toYmd()} ${String(data.inputSolar.getHour()).padStart(2, '0')}:${String(data.inputSolar.getMinute()).padStart(2, '0')}`));
  fragment.append(identity);
  const viewport = make('div', 'matrix-scroll analysis-chart');
  viewport.setAttribute('role', 'region'); viewport.setAttribute('aria-label', '四柱及十神藏干');
  const table = make('table', 'pillar-matrix traditional-matrix analysis-matrix');
  const head = make('thead'); const headRow = make('tr');
  headRow.append(make('th', 'row-label', '四柱'));
  for (const pillar of data.pillars) headRow.append(make('th', 'pillar-heading', pillar.name));
  head.append(headRow); table.append(head);
  const body = make('tbody');
  for (const [label, kind] of [['主星', 'god'], ['天干', 'stem'], ['地支', 'branch'], ['藏气', 'hidden']]) {
    const row = make('tr', `chart-row row-${kind}`); row.append(make('th', 'row-label', label));
    for (const pillar of data.pillars) row.append(renderChartCell(pillar, kind));
    body.append(row);
  }
  table.append(body); viewport.append(table); fragment.append(viewport);
  return fragment;
}
function renderMode(data, mode) {
  if (mode !== 'traditional' && mode !== 'analysis') mode = 'traditional';
  activeMode = mode;
  modeOutput.replaceChildren();
  for (const tab of document.querySelectorAll('[data-mode]')) tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
  const taiToggle = document.getElementById('taiyuan-toggle');
  taiToggle.hidden = mode === 'analysis';
  taiToggle.textContent = `胎元 ${showTaiYuan ? '开' : '关'}`;
  taiToggle.setAttribute('aria-pressed', String(showTaiYuan));
  const titles = { traditional: '传统排盘', analysis: '案例分析' };
  document.getElementById('result-title').textContent = titles[mode];
  document.getElementById('analysis-panel').hidden = mode !== 'analysis';
  if (mode === 'traditional') modeOutput.append(renderTraditional(data));
  else modeOutput.append(renderAnalysis(data));
}
function render(data) {
  const solarTime = `${data.solar.toYmd()} ${String(data.solar.getHour()).padStart(2, '0')}:${String(data.solar.getMinute()).padStart(2, '0')}`;
  const solarTimeChinese = `${data.solar.getYear()}年${String(data.solar.getMonth()).padStart(2, '0')}月${String(data.solar.getDay()).padStart(2, '0')}日 ${String(data.solar.getHour()).padStart(2, '0')}:${String(data.solar.getMinute()).padStart(2, '0')}`;
  const jie = new Date(data.priorJie.time);
  const jieTime = `${jie.getUTCFullYear()}年${String(jie.getUTCMonth() + 1).padStart(2, '0')}月${String(jie.getUTCDate()).padStart(2, '0')}日 ${String(jie.getUTCHours()).padStart(2, '0')}:${String(jie.getUTCMinutes()).padStart(2, '0')}`;
  document.getElementById('result-qian-kun').textContent = data.gender === 1 ? '乾' : '坤';
  document.getElementById('result-lunar').textContent = `农历：${data.lunar.toString()}`;
  const inputSolarTime = `${data.inputSolar.toYmd()} ${String(data.inputSolar.getHour()).padStart(2, '0')}:${String(data.inputSolar.getMinute()).padStart(2, '0')}`;
  document.getElementById('result-date').textContent = `阳历：${solarTime}${data.summerTime ? `（夏令时校正，原输入 ${inputSolarTime}）` : ''}`;
  document.getElementById('term-prior').textContent = `${data.priorJie.name}：${jieTime}`;
  document.getElementById('term-birth').textContent = `出生：${solarTimeChinese}${data.summerTime ? '（夏令时校正后）' : ''}（${data.priorJie.name}后第 ${data.daysAfterJie} 天）`;
  const monthBranch = data.pillars[1].ganzhi[1];
  const commandStem = siQuanStem(monthBranch, data.daysAfterJie);
  const ruling = document.getElementById('term-ruling'); ruling.replaceChildren();
  if (commandStem) ruling.append(document.createTextNode('司权：'), colored(commandStem, 'siquan-stem'));
  else ruling.textContent = '司权：未能匹配月令分金';
  document.getElementById('term-location').textContent = `出生地：${data.input.location || '未知地 · 北京时间'}`;
  const currentYear = Number(beijingNow().year);
  const selection = currentLuckSelection(data.luck, currentYear);
  selectedLuckIndex = selection.luckIndex;
  selectedYearIndex = selection.yearIndex;
  latestData = data; renderMode(data, activeMode); result.hidden = false;
  if (activeMode === 'analysis') loadAnalysis(data);
  syncFavoriteButton(data);
  document.getElementById('chart-empty').hidden = true;
  document.getElementById('current-chart-hint').textContent = `${data.name || '未命名'} · ${solarTime}`;
  showScreen('chart');
  const feedback = document.getElementById('case-save-feedback');
  feedback.hidden = true;
  if (autoSave.checked && !openingSavedCase && !editingCaseId) saveCurrentCase(data)
    .then(() => { feedback.textContent = '已保存到本机案例'; feedback.hidden = false; syncFavoriteButton(data); })
    .catch(error => { showCaseSaveError(error); feedback.textContent = '案例保存失败，请检查本机储存权限'; feedback.hidden = false; });
}

let openingSavedCase = false;
function currentCaseInput() {
  const input = { name: value('chart-name'), gender: value('gender'), calendar: value('calendar-type'),
    year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute'),
    leap: document.getElementById('leap').checked, summerTime: document.getElementById('summer-time').checked,
    ziRule: value('zi-rule'), yunMode: value('yun-mode'), location: value('birth-location') };
  return input;
}
function showCaseSaveError(error) {
  const message = document.getElementById('cases-error');
  message.textContent = `${error.message || '保存失败'}。请检查浏览器是否允许本地储存。`;
  message.hidden = false;
}
async function saveCurrentCase(data) {
  return CaseActions.saveCalculated(data);
}
async function syncFavoriteButton(data = latestData) {
  const button = document.getElementById('case-favorite');
  const epoch = ++favoriteEpoch;
  if (!data) { button.disabled = true; button.textContent = '☆'; button.setAttribute('aria-pressed', 'false'); return; }
  button.disabled = true;
  try {
    const record = await CaseActions.findByInput(data.input);
    if (epoch !== favoriteEpoch || latestData !== data) return;
    button.dataset.caseId = record?.id || '';
    button.textContent = record ? '★' : '☆';
    button.setAttribute('aria-pressed', String(Boolean(record)));
    button.setAttribute('aria-label', record ? '已收藏，点击查看分析' : '收藏当前排盘');
    button.title = record ? '已收藏，点击查看分析' : '收藏当前排盘';
  } catch (_) { button.dataset.caseId = ''; button.textContent = '☆'; }
  finally { if (epoch === favoriteEpoch) button.disabled = false; }
}

function analysisChanged() {
  return Boolean(activeAnalysisCaseId && (document.getElementById('analysis-summary').value !== savedAnalysisSnapshot.summary
    || document.getElementById('analysis-body').value !== savedAnalysisSnapshot.body));
}
async function loadAnalysis(data) {
  if (!data) return;
  const epoch = ++analysisLoadEpoch;
  const status = document.getElementById('analysis-status');
  const controls = ['analysis-summary', 'analysis-body', 'analysis-save', 'analysis-next'].map(id => document.getElementById(id));
  controls.forEach(control => { control.disabled = true; });
  try {
    clearTimeout(analysisSaveTimer); analysisSaveTimer = null;
    status.textContent = analysisChanged() ? '正在保存上一盘…' : '正在读取分析…';
    if (analysisChanged()) await saveOpenAnalysis();
    if (epoch !== analysisLoadEpoch || latestData !== data || activeMode !== 'analysis') return;
    status.textContent = '正在读取分析…';
    const record = await CaseActions.findByInput(data.input) || await CaseActions.saveCalculated(data);
    if (epoch !== analysisLoadEpoch || latestData !== data || activeMode !== 'analysis') return;
    activeAnalysisCaseId = record.id;
    savedAnalysisSnapshot = { summary: record.notes?.summary || '', body: record.notes?.body || '' };
    document.getElementById('analysis-summary').value = savedAnalysisSnapshot.summary;
    document.getElementById('analysis-body').value = savedAnalysisSnapshot.body;
    status.textContent = record.notes?.updatedAt
      ? `上次保存：${new Date(record.notes.updatedAt).toLocaleString('zh-CN')}` : '分析内容保存在此设备';
    syncFavoriteButton(data);
  } catch (exception) {
    if (epoch === analysisLoadEpoch && latestData === data) {
      activeMode = 'traditional'; renderMode(data, activeMode);
      const feedback = document.getElementById('case-save-feedback');
      feedback.textContent = `分析未打开：${exception.message || '请重试'}`; feedback.hidden = false;
    }
  } finally { if (epoch === analysisLoadEpoch) controls.forEach(control => { control.disabled = false; }); }
}
async function saveOpenAnalysis() {
  if (!activeAnalysisCaseId) throw new Error('请先选择案例');
  clearTimeout(analysisSaveTimer); analysisSaveTimer = null;
  const id = activeAnalysisCaseId;
  const values = { summary: document.getElementById('analysis-summary').value, body: document.getElementById('analysis-body').value };
  const status = document.getElementById('analysis-status'); status.textContent = '正在保存…';
  analysisSavePromise = analysisSavePromise.catch(() => {}).then(() => CaseActions.saveAnalysis(id, values));
  const record = await analysisSavePromise;
  if (activeAnalysisCaseId === id) {
    savedAnalysisSnapshot = values;
    status.textContent = analysisChanged() ? '正在编辑…' : `已保存：${new Date(record.notes.updatedAt).toLocaleString('zh-CN')}`;
  }
  await refreshCases();
  return record;
}
document.getElementById('case-favorite').addEventListener('click', async () => {
  if (!latestData) return;
  const button = document.getElementById('case-favorite'); button.disabled = true;
  try {
    const existing = await CaseActions.findByInput(latestData.input);
    if (existing) { activeMode = 'analysis'; renderMode(latestData, activeMode); await loadAnalysis(latestData); return; }
    const record = await CaseActions.saveCalculated(latestData);
    button.dataset.caseId = record.id; button.textContent = '★'; button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', '已收藏，点击查看分析'); button.title = '已收藏，点击查看分析';
    const feedback = document.getElementById('case-save-feedback'); feedback.textContent = '已收藏到本机案例'; feedback.hidden = false;
  } catch (exception) { showCaseSaveError(exception); }
  finally { button.disabled = false; }
});
for (const field of ['analysis-summary', 'analysis-body']) document.getElementById(field).addEventListener('input', () => {
  const status = document.getElementById('analysis-status'); status.textContent = '正在编辑…';
  clearTimeout(analysisSaveTimer);
  analysisSaveTimer = setTimeout(() => saveOpenAnalysis().catch(exception => {
    status.textContent = `自动保存失败：${exception.message || '请手动保存'}`;
  }), 900);
});
document.getElementById('analysis-save').addEventListener('click', async () => {
  try { await saveOpenAnalysis(); } catch (exception) { document.getElementById('analysis-status').textContent = `保存失败：${exception.message || '请重试'}`; }
});
document.getElementById('analysis-next').addEventListener('click', async () => {
  try {
    await saveOpenAnalysis();
    editingCaseId = null; document.getElementById('chart-submit').textContent = '开始排盘';
    document.getElementById('cancel-case-edit').hidden = true;
    document.getElementById('chart-name').value = '';
    showScreen('home');
    const yearInput = document.getElementById('year'); yearInput.focus({ preventScroll: true }); yearInput.select?.();
  } catch (exception) { document.getElementById('analysis-status').textContent = `保存失败，暂未离开：${exception.message || '请重试'}`; }
});
let caseDeleteMode = false;
const selectedCaseIds = new Set();
function syncCaseDeleteControls() {
  const count = selectedCaseIds.size;
  document.getElementById('cases-screen').classList.toggle('case-delete-mode', caseDeleteMode);
  document.getElementById('case-delete-mode').hidden = caseDeleteMode;
  document.getElementById('case-delete-cancel').hidden = !caseDeleteMode;
  const confirm = document.getElementById('case-delete-confirm');
  confirm.hidden = !caseDeleteMode;
  confirm.disabled = count === 0;
  confirm.textContent = `删除所选（${count}）`;
}
function clearCaseSelection() { selectedCaseIds.clear(); }
async function refreshCases() {
  const list = document.getElementById('cases-list');
  const empty = document.getElementById('cases-empty');
  const query = document.getElementById('case-search-input').value.trim();
  list.replaceChildren();
  try {
    const records = await CaseActions.search({ text: query, gender: document.getElementById('case-gender-filter').value,
      pillar: document.getElementById('case-pillar-filter').value });
    empty.hidden = records.length > 0;
    empty.textContent = query || document.getElementById('case-gender-filter').value || document.getElementById('case-pillar-filter').value
      ? '没有找到符合条件的案例' : '还没有收藏的案例\n打开首页“保存”，排盘后会自动收录';
    for (const item of records) {
      const row = make('div', 'case-row'); row.dataset.caseId = item.id; row.tabIndex = 0; row.setAttribute('role', 'listitem'); row.setAttribute('aria-label', `打开${item.display.name}的排盘`);
      const selector = make('button', 'case-selector'); selector.type = 'button'; selector.dataset.caseSelect = 'true';
      selector.setAttribute('aria-label', `选择${item.display.name}`); selector.setAttribute('aria-pressed', String(selectedCaseIds.has(item.id)));
      const details = make('div', 'case-details');
      const nameLine = make('span', 'case-name-line');
      nameLine.append(make('strong', '', item.display.name), make('span', 'case-gender', item.display.gender === 1 ? '男' : '女'));
      const edit = make('button', 'case-edit-icon'); edit.type = 'button'; edit.dataset.caseEdit = 'true';
      edit.setAttribute('aria-label', `编辑${item.display.name}`);
      edit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M13 3v6h6"/><path d="M8 13h3M8 17h2"/><path d="m14 16 5-5 2 2-5 5-3 1Z"/></svg>';
      const analysis = make('button', `case-analysis-link${item.notes?.body || item.notes?.summary ? ' has-analysis' : ''}`, '分析');
      analysis.type = 'button'; analysis.dataset.caseAnalysis = 'true'; analysis.setAttribute('aria-label', `打开${item.display.name}的分析`);
      nameLine.append(edit, analysis);
      details.append(nameLine, make('small', '', item.display.solar));
      const location = item.input.location || item.display.location;
      if (location) details.append(make('small', 'case-location', location));
      const pillars = make('span', 'case-pillars');
      for (const part of [0, 1]) {
        const line = make('span', 'case-pillar-line');
        item.display.pillars.forEach(pillar => line.append(colored(pillar[part])));
        pillars.append(line);
      }
      row.append(selector, details, pillars);
      const synopsis = (item.notes?.summary || item.notes?.body || '').trim().replace(/\s+/g, ' ');
      if (synopsis) {
        const preview = make('small', 'case-summary', synopsis);
        preview.title = synopsis;
        row.append(preview);
      }
      list.append(row);
    }
    syncCaseDeleteControls();
    document.getElementById('cases-error').hidden = true;
  } catch (error) { showCaseSaveError(error); empty.hidden = false; }
}
for (const [id, type] of [['case-search-input', 'input'], ['case-gender-filter', 'change'], ['case-pillar-filter', 'input']]) {
  document.getElementById(id).addEventListener(type, () => { clearCaseSelection(); refreshCases(); });
}
document.getElementById('case-delete-mode').addEventListener('click', () => { caseDeleteMode = true; clearCaseSelection(); refreshCases(); });
document.getElementById('case-delete-cancel').addEventListener('click', () => { caseDeleteMode = false; clearCaseSelection(); refreshCases(); });
const caseDeleteSheet = document.getElementById('case-delete-sheet');
document.getElementById('case-delete-close').addEventListener('click', () => caseDeleteSheet.close());
document.getElementById('case-delete-dismiss').addEventListener('click', () => caseDeleteSheet.close());
document.getElementById('case-delete-confirm').addEventListener('click', async () => {
  if (!selectedCaseIds.size) return;
  const selected = await Promise.all([...selectedCaseIds].map(id => CaseStore.get(id)));
  const names = selected.filter(Boolean).map(record => record.display.name);
  document.getElementById('case-delete-summary').textContent = `确定删除 ${names.length} 个案例吗？${names.length ? `（${names.slice(0, 3).join('、')}${names.length > 3 ? '等' : ''}）` : ''} 删除后无法恢复。`;
  caseDeleteSheet.showModal();
});
document.getElementById('case-delete-commit').addEventListener('click', async () => {
  const commit = document.getElementById('case-delete-commit'); commit.disabled = true;
  try {
    await CaseActions.removeMany([...selectedCaseIds]);
    caseDeleteSheet.close(); caseDeleteMode = false; clearCaseSelection(); await refreshCases();
  } catch (error) { caseDeleteSheet.close(); showCaseSaveError(error); }
  finally { commit.disabled = false; }
});
const caseImportSheet = document.getElementById('case-import-sheet');
const caseImportText = document.getElementById('case-import-text');
const caseImportStatus = document.getElementById('case-import-status');
const caseImportConfirm = document.getElementById('case-import-confirm');
function resetCaseImportPreview() {
  caseImportConfirm.disabled = true;
  caseImportStatus.textContent = '';
  document.getElementById('case-import-preview').replaceChildren();
}
document.getElementById('case-import-open').addEventListener('click', () => {
  resetCaseImportPreview(); caseImportSheet.showModal();
});
document.getElementById('case-import-close').addEventListener('click', () => caseImportSheet.close());
caseImportText.addEventListener('input', resetCaseImportPreview);
document.getElementById('case-import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try { caseImportText.value = await file.text(); resetCaseImportPreview(); }
  catch (_) { caseImportStatus.textContent = '读取文件失败，请粘贴内容重试'; }
});
document.getElementById('case-import-preview-button').addEventListener('click', async () => {
  resetCaseImportPreview();
  try {
    const preview = await CaseActions.previewImport(caseImportText.value);
    caseImportStatus.textContent = `共 ${preview.total} 条：可新增 ${preview.added} 条，重复 ${preview.duplicate} 条，错误 ${preview.error} 条`;
    caseImportConfirm.disabled = preview.added === 0;
    const box = document.getElementById('case-import-preview');
    for (const item of preview.details) {
      const row = make('div', `case-import-row ${item.status}`);
      row.append(make('strong', '', `${item.row}. ${item.label}`), make('span', '', item.message));
      box.append(row);
    }
  } catch (exception) { caseImportStatus.textContent = exception.message || '无法读取案例资料'; }
});
caseImportConfirm.addEventListener('click', async () => {
  caseImportConfirm.disabled = true;
  try {
    const count = await CaseActions.commitImport();
    caseImportStatus.textContent = `已导入 ${count} 条案例，保存在此设备`;
    await refreshCases();
  } catch (exception) { caseImportStatus.textContent = exception.message || '导入失败'; }
});
const caseRestoreSheet = document.getElementById('case-restore-sheet');
const caseBackupFile = document.getElementById('case-backup-file');
const caseRestoreStatus = document.getElementById('case-restore-status');
const caseRestoreConfirm = document.getElementById('case-restore-confirm');
document.getElementById('case-research-export').addEventListener('click', async () => {
  try {
    const records = await CaseActions.search({ text: document.getElementById('case-search-input').value,
      gender: document.getElementById('case-gender-filter').value, pillar: document.getElementById('case-pillar-filter').value });
    if (!records.length) { showCaseSaveError(new Error('当前没有可导出的案例')); return; }
    const payload = await CaseActions.exportResearch(records);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `八字分析资料-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById('cases-error').hidden = true;
  } catch (exception) { showCaseSaveError(exception); }
});
document.getElementById('case-backup-export').addEventListener('click', async () => {
  try {
    const backup = await CaseActions.exportBackup();
    const url = URL.createObjectURL(new Blob([backup], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `八字案例备份-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById('cases-error').hidden = true;
  } catch (exception) { showCaseSaveError(exception); }
});
document.getElementById('case-backup-restore-open').addEventListener('click', () => caseBackupFile.click());
document.getElementById('case-restore-close').addEventListener('click', () => caseRestoreSheet.close());
caseBackupFile.addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  caseRestoreConfirm.disabled = true; caseRestoreStatus.textContent = '正在检查备份…';
  document.getElementById('case-restore-preview').replaceChildren();
  caseRestoreSheet.showModal();
  try {
    const preview = await CaseActions.previewRestore(await file.text());
    caseRestoreStatus.textContent = `共 ${preview.total} 条：新增 ${preview.added} 条，重复 ${preview.duplicate} 条，分析冲突 ${preview.conflicts || 0} 条，错误 ${preview.error} 条`;
    caseRestoreConfirm.disabled = preview.added === 0;
    const box = document.getElementById('case-restore-preview');
    for (const item of preview.details) {
      const row = make('div', `case-import-row ${item.status}`);
      row.append(make('strong', '', `${item.row}. ${item.label}`), make('span', '', item.message));
      if (item.status === 'conflict') {
        const label = make('label', 'case-restore-choice');
        const choice = make('input'); choice.type = 'checkbox'; choice.setAttribute('aria-label', `用文件中的分析覆盖${item.label}的本机分析`);
        choice.addEventListener('change', () => {
          const writes = CaseActions.selectRestoreUpdate(item.id, choice.checked);
          caseRestoreConfirm.disabled = writes === 0;
        });
        label.append(choice, document.createTextNode('用文件分析覆盖本机分析')); row.append(label);
      }
      box.append(row);
    }
  } catch (exception) { caseRestoreStatus.textContent = exception.message || '无法读取备份'; }
  finally { caseBackupFile.value = ''; }
});
caseRestoreConfirm.addEventListener('click', async () => {
  caseRestoreConfirm.disabled = true;
  try {
    const count = await CaseActions.commitRestore();
    caseRestoreStatus.textContent = `已新增或更新 ${count} 条案例`;
    await refreshCases();
  } catch (exception) { caseRestoreStatus.textContent = exception.message || '恢复失败'; }
});
async function useSavedCase(id, edit = false, analysis = false) {
  try {
    const record = await CaseStore.get(id); if (!record) return;
    const input = record.input;
    for (const field of ['name', 'gender', 'calendar', 'year', 'month', 'day', 'hour', 'minute', 'ziRule', 'yunMode']) {
      const ids = { name: 'chart-name', calendar: 'calendar-type', ziRule: 'zi-rule', yunMode: 'yun-mode' };
      document.getElementById(ids[field] || field).value = input[field];
    }
    document.getElementById('leap').checked = input.leap;
    document.getElementById('summer-time').checked = input.summerTime;
    setBirthLocation(input.location || '');
    for (const button of document.querySelectorAll('[data-gender]')) button.setAttribute('aria-pressed', String(button.dataset.gender === input.gender));
    syncCalendarButtons(); updateBirthSummary();
    if (edit) {
      editingCaseId = record.id;
      document.getElementById('chart-submit').textContent = '保存案例修改';
      document.getElementById('cancel-case-edit').hidden = false;
      showScreen('home');
      document.getElementById('chart-name').focus({ preventScroll: true });
      return;
    }
    activeMode = analysis ? 'analysis' : 'traditional';
    openingSavedCase = true; render(calculate());
  } catch (error) { showCaseSaveError(error); }
  finally { openingSavedCase = false; }
}
document.getElementById('cases-list').addEventListener('click', event => {
  const row = event.target.closest('[data-case-id]'); if (!row) return;
  if (caseDeleteMode) {
    if (event.target.closest('[data-case-edit]')) return;
    const id = row.dataset.caseId;
    if (selectedCaseIds.has(id)) selectedCaseIds.delete(id); else selectedCaseIds.add(id);
    row.querySelector('[data-case-select]').setAttribute('aria-pressed', String(selectedCaseIds.has(id)));
    syncCaseDeleteControls(); return;
  }
  if (event.target.closest('[data-case-edit]')) { useSavedCase(row.dataset.caseId, true); return; }
  if (event.target.closest('[data-case-analysis]')) { useSavedCase(row.dataset.caseId, false, true); return; }
  useSavedCase(row.dataset.caseId);
});
document.getElementById('cases-list').addEventListener('keydown', event => {
  if ((event.key !== 'Enter' && event.key !== ' ') || !event.target.matches('.case-row')) return;
  const row = event.target;
  event.preventDefault();
  if (caseDeleteMode) row.click(); else useSavedCase(row.dataset.caseId);
});
autoSave.addEventListener('change', () => {
  try { localStorage.setItem('bazi-auto-save', autoSave.checked ? '1' : '0'); }
  catch (_) { showCaseSaveError(new Error('保存开关无法记住')); }
});
document.getElementById('current-chart').addEventListener('click', () => showScreen('chart'));

document.getElementById('edit-birth').addEventListener('click', () => {
  showScreen('home');
  document.getElementById('chart-name').focus({ preventScroll: true });
});

document.getElementById('use-now').addEventListener('click', () => {
  const now = beijingNow();
  calendarType.value = 'solar'; syncCalendarButtons();
  document.getElementById('leap').checked = false;
  document.getElementById('summer-time').checked = false;
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
initializeBirthPlace();

form.addEventListener('submit', event => {
  event.preventDefault(); error.hidden = true;
  try {
    const data = calculate(); render(data);
    if (editingCaseId) {
      const id = editingCaseId;
      CaseActions.update(id, currentCaseInput()).then(() => {
        editingCaseId = null;
        document.getElementById('chart-submit').textContent = '开始排盘';
        document.getElementById('cancel-case-edit').hidden = true;
        document.getElementById('case-save-feedback').textContent = '案例已更新';
        document.getElementById('case-save-feedback').hidden = false;
        refreshCases(); syncFavoriteButton(latestData);
      }).catch(exception => {
        const feedback = document.getElementById('case-save-feedback');
        feedback.textContent = `案例未保存：${exception.message || '更新失败'}`; feedback.hidden = false;
      });
    }
  }
  catch (exception) { result.hidden = true; error.textContent = exception instanceof Error ? exception.message : '排盘失败，请检查输入。'; error.hidden = false; }
});
document.getElementById('cancel-case-edit').addEventListener('click', () => {
  editingCaseId = null;
  document.getElementById('chart-submit').textContent = '开始排盘';
  document.getElementById('cancel-case-edit').hidden = true;
  showScreen('cases');
});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
