const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const dist = path.resolve(__dirname, '..', 'dist');
const { Solar, Lunar } = require(path.join(dist, 'lunar.js'));
require(path.join(dist, 'apk-terms-data.js'));
require(path.join(dist, 'apk-terms.js'));
global.window = global;
require(path.join(dist, 'shen-sha.js'));

const fields = {};
const element = () => ({ value: '', checked: false, hidden: false, textContent: '',
  options: [], classList: { toggle() {} }, addEventListener() {}, setAttribute() {}, append(item) { this.options.push(item); }, replaceChildren() { this.options = []; }, scrollIntoView() {} });
const document = { getElementById(id) { return fields[id] ||= element(); }, querySelector() { return element(); },
  querySelectorAll() { return []; }, createElement() { return element(); }, createDocumentFragment() { return element(); } };
const records = new Map();
const CaseStore = { async list() { return [...records.values()]; }, async get(id) { return records.get(id); },
  async put(record) { records.set(record.id, record); },
  async putMany(batch) { for (const record of batch) records.set(record.id, record); return batch.length; },
  async remove(id) { records.delete(id); },
  async removeMany(ids) { for (const id of new Set(ids)) records.delete(id); return new Set(ids).size; } };
const context = { Solar, Lunar, ApkTerms: global.ApkTerms, ApkShenSha: global.ApkShenSha,
  CaseStore, document, navigator: {}, location: { protocol: 'file:' }, Intl, Date, Math, Number, String, Array, Object, Error, console };
context.window = context;
vm.createContext(context);
vm.runInNewContext(fs.readFileSync(path.join(dist, 'region-data.js'), 'utf8'), { window: context });
assert(context.RegionData.some(province => province.name === '北京市' && province.cities[0].areas.includes('朝阳区')));
assert(context.RegionData.some(province => province.name === '浙江省' && province.cities.some(city => city.name === '杭州市' && city.areas.includes('西湖区'))));
for (const file of ['app.js', 'case-actions.js']) vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), context, { filename: file });

(async () => {
  const source = '姓名,性别,出生时间,历法\n小明,男,2003-05-16 07:20,公历\n小明,男,2003-05-16 07:20,公历\n无效,女,2003-02-30 08:00,公历';
  const preview = await context.CaseActions.previewImport(source);
  assert.equal(context.siQuanStem('戌', 12), '丁', '戌月寒露后第12日由丁司权');
  assert.equal(context.siQuanStem('戌', 9), '辛');
  assert.equal(context.siQuanStem('戌', 13), '戊');
  assert.equal(context.siQuanStem('戌', 31), '戊', '节气间隔超过表格30日时延续本气');
  const siquanChart = context.calculate({ name: '', gender: '1', calendar: 'solar', year: '2018', month: '10', day: '20', hour: '0', minute: '0', leap: false, summerTime: false, ziRule: '23', yunMode: 'year', location: '' });
  assert.equal(siquanChart.pillars[1].ganzhi[1], '戌');
  assert.equal(siquanChart.daysAfterJie, 12);
  assert.equal(context.siQuanStem(siquanChart.pillars[1].ganzhi[1], siquanChart.daysAfterJie), '丁');
  const currentBirthChart = context.calculate({ name: '', gender: '1', calendar: 'solar', year: '2026', month: '10', day: '19', hour: '17', minute: '16', leap: false, summerTime: false, ziRule: '23', yunMode: 'year', location: '' });
  const currentSelection = context.currentLuckSelection(currentBirthChart.luck, 2026);
  assert.notEqual(currentSelection.luckIndex, null, '新排盘默认选中当前大运或明确的运前');
  assert.equal(currentBirthChart.luck[currentSelection.luckIndex].years[currentSelection.yearIndex]?.year, 2026, '新排盘默认选中当前流年');
  const selection = context.currentLuckSelection([
    { ganzhi: '运前', years: [{ year: 2026 }] },
    { ganzhi: '甲子', years: [{ year: 2027 }] },
  ], 2026);
  assert.equal(selection.luckIndex, 0, '交运前选中运前列');
  assert.equal(selection.yearIndex, 0, '交运前仍选中当前流年');
  const activeSelection = context.currentLuckSelection([
    { ganzhi: '运前', years: [{ year: 2025 }] },
    { ganzhi: '甲子', years: [{ year: 2026 }, { year: 2027 }] },
  ], 2026);
  assert.equal(activeSelection.luckIndex, 1, '起运后的年份选中对应大运');
  assert.equal(activeSelection.yearIndex, 0, '起运后同时选中对应流年');
  assert.deepEqual([preview.total, preview.added, preview.duplicate, preview.error], [3, 1, 1, 1]);
  assert.equal(records.size, 0, 'preview must not write cases');
  assert.equal(await context.CaseActions.commitImport(), 1);
  assert.equal(records.size, 1);
  const saved = [...records.values()][0];
  assert.equal(saved.display.pillars.length, 4);
  assert.equal((await context.CaseActions.search({ gender: '1', pillar: saved.display.pillars[0] })).length, 1);
  const noteSaved = await context.CaseActions.saveNote(saved.id, '研究记录：留意大运交接');
  assert.equal(noteSaved.notes.body, '研究记录：留意大运交接');
  assert.equal((await context.CaseActions.search({ text: '大运交接' })).length, 1, 'case search includes notes');
  const research = JSON.parse(await context.CaseActions.exportResearch([noteSaved]));
  assert.equal(research.format, 'bazi-research-cases');
  assert.equal(research.cases[0].note, '研究记录：留意大运交接');
  const again = await context.CaseActions.previewImport('[{"姓名":"小明","性别":"男","出生时间":"2003-05-16 07:20"}]');
  assert.equal(again.duplicate, 1);
  assert.equal(again.added, 0);
  const lunar = await context.CaseActions.previewImport('[{"姓名":"农历样例","性别":"女","历法":"农历","年":2003,"月":4,"日":16,"时":7,"分":20,"出生地点":"浙江省 · 杭州市 · 西湖区"}]');
  assert.equal(lunar.added, 1);
  await context.CaseActions.commitImport();
  const locationCase = [...records.values()].find(record => record.display.name === '农历样例');
  assert.equal(locationCase.input.location, '浙江省 · 杭州市 · 西湖区');
  assert.equal(locationCase.display.location, locationCase.input.location);
  assert.equal((await context.CaseActions.search({ text: '西湖区' })).length, 1, '案例列表可按出生地搜索');
  assert.equal((await context.CaseActions.search({ gender: '0', from: '2003-05-01', to: '2003-05-31' })).length, 1);
  const edited = await context.CaseActions.update(saved.id, { name: '小明（已核对）' });
  assert.equal(edited.display.name, '小明（已核对）');
  assert.equal(edited.id, saved.id);
  assert.equal(edited.notes.body, '研究记录：留意大运交接', 'editing birth details must preserve notes');
  const changedResearch = JSON.parse(await context.CaseActions.exportResearch([edited]));
  changedResearch.cases[0].note = '外部整理后的笔记';
  const conflict = await context.CaseActions.previewRestore(JSON.stringify(changedResearch));
  assert.equal(conflict.conflicts, 1, 'existing case with a changed note requires a choice');
  assert.equal(context.CaseActions.selectRestoreUpdate(saved.id, true), 1);
  assert.equal(await context.CaseActions.commitRestore(), 1);
  assert.equal((await context.CaseActions.findByInput(edited.input)).notes.body, '外部整理后的笔记');
  const backup = await context.CaseActions.exportBackup();
  const backupData = JSON.parse(backup);
  assert.equal(backupData.format, 'bazi-case-backup');
  records.clear();
  const researchRestore = await context.CaseActions.previewRestore(JSON.stringify(research));
  assert.equal(researchRestore.added, 1, 'research export can be imported back');
  assert.equal(await context.CaseActions.commitRestore(), 1);
  assert.equal([...records.values()][0].notes.body, '研究记录：留意大运交接');
  records.clear();
  const restore = await context.CaseActions.previewRestore(backup);
  assert.equal(restore.added, 2);
  assert.equal(records.size, 0, 'restore preview must not write cases');
  assert.equal(await context.CaseActions.commitRestore(), 2);
  assert.equal(records.size, 2);
  assert.equal([...records.values()].find(record => record.display.name === '小明（已核对）').notes.body, '外部整理后的笔记', 'backup restore preserves notes');
  assert.equal((await context.CaseActions.previewRestore(backup)).duplicate, 2);
  const restored = [...records.values()].find(record => record.display.name === '小明（已核对）');
  assert.equal(restored.display.pillars.length, 4);
  assert.equal((await context.CaseActions.remove(restored.id)).id, restored.id);
  assert.equal(records.size, 1);
  const remaining = [...records.values()][0];
  const removed = await context.CaseActions.removeMany([remaining.id, remaining.id]);
  assert.equal(removed.length, 1, 'batch removal deduplicates selected ids');
  assert.equal(records.size, 0, 'batch removal deletes selected records');
  await assert.rejects(context.CaseActions.removeMany([]), /请先选择/);
  console.log('案例批量预览、查重、保存、筛选、修改、备份恢复和删除：通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
