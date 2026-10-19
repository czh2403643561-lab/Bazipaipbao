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
  classList: { toggle() {} }, addEventListener() {}, setAttribute() {}, append() {}, replaceChildren() {}, scrollIntoView() {} });
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
for (const file of ['app.js', 'case-actions.js']) vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), context, { filename: file });

(async () => {
  const source = '姓名,性别,出生时间,历法\n小明,男,2003-05-16 07:20,公历\n小明,男,2003-05-16 07:20,公历\n无效,女,2003-02-30 08:00,公历';
  const preview = await context.CaseActions.previewImport(source);
  assert.deepEqual([preview.total, preview.added, preview.duplicate, preview.error], [3, 1, 1, 1]);
  assert.equal(records.size, 0, 'preview must not write cases');
  assert.equal(await context.CaseActions.commitImport(), 1);
  assert.equal(records.size, 1);
  const saved = [...records.values()][0];
  assert.equal(saved.display.pillars.length, 4);
  assert.equal((await context.CaseActions.search({ gender: '1', pillar: saved.display.pillars[0] })).length, 1);
  const again = await context.CaseActions.previewImport('[{"姓名":"小明","性别":"男","出生时间":"2003-05-16 07:20"}]');
  assert.equal(again.duplicate, 1);
  assert.equal(again.added, 0);
  const lunar = await context.CaseActions.previewImport('[{"姓名":"农历样例","性别":"女","历法":"农历","年":2003,"月":4,"日":16,"时":7,"分":20}]');
  assert.equal(lunar.added, 1);
  await context.CaseActions.commitImport();
  assert.equal((await context.CaseActions.search({ gender: '0', from: '2003-05-01', to: '2003-05-31' })).length, 1);
  const edited = await context.CaseActions.update(saved.id, { name: '小明（已核对）' });
  assert.equal(edited.display.name, '小明（已核对）');
  assert.equal(edited.id, saved.id);
  const backup = await context.CaseActions.exportBackup();
  const backupData = JSON.parse(backup);
  assert.equal(backupData.format, 'bazi-case-backup');
  records.clear();
  const restore = await context.CaseActions.previewRestore(backup);
  assert.equal(restore.added, 2);
  assert.equal(records.size, 0, 'restore preview must not write cases');
  assert.equal(await context.CaseActions.commitRestore(), 2);
  assert.equal(records.size, 2);
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
