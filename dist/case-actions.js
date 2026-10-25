/* Case operations shared by the page and future assistant integrations. Birth inputs remain the source of truth. */
window.CaseActions = (() => {
  const aliases = {
    name: ['name', '姓名', '名称'], gender: ['gender', '性别'], calendar: ['calendar', '历法'],
    birth: ['birth', '出生时间', '出生日期', '日期时间'], year: ['year', '年'], month: ['month', '月'],
    day: ['day', '日'], hour: ['hour', '时'], minute: ['minute', '分'], leap: ['leap', '闰月'],
    summerTime: ['summerTime', '夏令时'], ziRule: ['ziRule', '子时换日'], yunMode: ['yunMode', '起运方式'],
    location: ['location', '出生地点', '出生地', '地址'],
  };
  let pending = null;

  function field(row, key) {
    const entry = aliases[key].find(alias => row[alias] != null);
    return entry == null ? undefined : row[entry];
  }
  function flag(value) {
    return value === true || value === 1 || ['1', 'true', '是', '有', '开启', '闰'].includes(String(value).trim().toLowerCase());
  }
  function parseBirth(value) {
    const text = String(value || '').trim();
    let match = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\s+(\d{1,2})[:时](\d{1,2})分?$/);
    if (!match) match = text.match(/^(\d{4})(\d{2})(\d{2})[.\s]?(\d{2})(\d{2})$/);
    if (!match) throw new Error('出生时间请写成 2003-05-16 07:20，或分别填写年、月、日、时、分');
    return { year: match[1], month: match[2], day: match[3], hour: match[4], minute: match[5] };
  }
  function normalize(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('这一行不是案例资料');
    const birth = field(row, 'birth') ? parseBirth(field(row, 'birth')) : {};
    const genderText = String(field(row, 'gender') ?? '').trim().toLowerCase();
    const gender = ['男', 'male', 'm', '1'].includes(genderText) ? '1'
      : ['女', 'female', 'f', '0'].includes(genderText) ? '0' : null;
    if (gender == null) throw new Error('性别请填写男或女');
    const calendarText = String(field(row, 'calendar') ?? '公历').trim().toLowerCase();
    const calendar = ['公历', '阳历', 'solar'].includes(calendarText) ? 'solar'
      : ['农历', '阴历', 'lunar'].includes(calendarText) ? 'lunar' : null;
    if (!calendar) throw new Error('历法请填写公历或农历');
    const monthText = String(field(row, 'month') ?? birth.month ?? '').trim();
    const parts = {};
    for (const key of ['year', 'month', 'day', 'hour', 'minute']) {
      const source = key === 'month' ? monthText.replace(/^闰/, '') : field(row, key) ?? birth[key];
      const number = Number(source);
      if (source == null || source === '' || !Number.isInteger(number)) throw new Error(`缺少或无效的${{year:'年',month:'月',day:'日',hour:'时',minute:'分'}[key]}`);
      parts[key] = String(number);
    }
    const ziRule = String(field(row, 'ziRule') ?? '23').trim();
    if (!['23', '24'].includes(ziRule)) throw new Error('子时换日只能是23或24');
    const yunMode = String(field(row, 'yunMode') ?? 'year').trim();
    if (!['year', 'cumulative', 'simple', 'rounded'].includes(yunMode)) throw new Error('起运方式无效');
    const name = String(field(row, 'name') ?? '').trim().slice(0, 80);
    return { name, gender, calendar, ...parts, leap: monthText.startsWith('闰') || flag(field(row, 'leap')),
      summerTime: flag(field(row, 'summerTime')), ziRule, yunMode,
      location: String(field(row, 'location') ?? '').trim().slice(0, 120) };
  }
  function signature(input) {
    const normalized = normalize(input);
    return JSON.stringify(normalized);
  }
  function recordFrom(data, previous = null) {
    const input = normalize(data.input);
    const now = Date.now();
    const record = { id: previous?.id || `case:${signature(input)}`, schemaVersion: 1,
      createdAt: previous?.createdAt || now, updatedAt: now, input,
      display: { name: input.name || '未命名案例', gender: Number(input.gender),
        solar: `${data.inputSolar.toYmd()} ${String(data.inputSolar.getHour()).padStart(2, '0')}:${String(data.inputSolar.getMinute()).padStart(2, '0')}`,
        location: input.location, pillars: data.pillars.map(pillar => pillar.ganzhi) } };
    if (previous?.notes) record.notes = previous.notes;
    return record;
  }
  function csvRows(text) {
    const rows = []; let row = []; let cell = ''; let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); if (row.some(value => value.trim())) rows.push(row);
        row = []; cell = '';
      } else cell += char;
    }
    if (quoted) throw new Error('CSV 引号没有闭合');
    row.push(cell); if (row.some(value => value.trim())) rows.push(row);
    if (rows.length < 2) throw new Error('CSV 需要标题行和至少一条案例');
    const [header, ...values] = rows;
    return values.map(cells => Object.fromEntries(header.map((name, i) => [name.trim(), cells[i] ?? ''])));
  }
  function parse(source) {
    const text = String(source).replace(/^\uFEFF/, '').trim();
    if (!text) throw new Error('请先粘贴资料或选择文件');
    if (text[0] === '[' || text[0] === '{') {
      let parsed;
      try { parsed = JSON.parse(text); } catch (_) { throw new Error('JSON 格式有误'); }
      const rows = Array.isArray(parsed) ? parsed : parsed.cases;
      if (!Array.isArray(rows)) throw new Error('JSON 请使用案例数组，或包含 cases 数组');
      return rows;
    }
    return csvRows(text);
  }
  async function previewImport(source) {
    pending = null;
    const rows = parse(source);
    if (rows.length > 500) throw new Error('单次最多导入500条，请分批处理');
    const existing = new Map((await CaseStore.list()).map(record => [signature(record.input), record]));
    const seen = new Set(); const details = []; const prepared = [];
    for (let index = 0; index < rows.length; index++) {
      try {
        const input = normalize(rows[index]);
        const key = signature(input);
        const label = input.name || `${input.year}-${input.month}-${input.day}`;
        if (existing.has(key) || seen.has(key)) {
          details.push({ row: index + 1, label, status: 'duplicate', message: '已存在或本批重复' });
          continue;
        }
        const data = calculate(input);
        seen.add(key);
        prepared.push(recordFrom(data));
        details.push({ row: index + 1, label, status: 'new', message: data.pillars.map(p => p.ganzhi).join(' ') });
      } catch (error) {
        details.push({ row: index + 1, label: String(field(rows[index] || {}, 'name') || '未命名'), status: 'error', message: error.message });
      }
    }
    pending = { kind: 'import', records: prepared };
    return { total: rows.length, added: prepared.length,
      duplicate: details.filter(item => item.status === 'duplicate').length,
      error: details.filter(item => item.status === 'error').length, details };
  }
  async function commitImport() {
    if (!pending || pending.kind !== 'import') throw new Error('请先预览导入资料');
    const records = pending.records; pending = null;
    return CaseStore.putMany(records);
  }
  async function saveCalculated(data) {
    const existing = (await CaseStore.list()).find(record => signature(record.input) === signature(data.input));
    const record = recordFrom(data, existing);
    await CaseStore.put(record);
    return record;
  }
  async function findByInput(input) {
    const key = signature(input);
    return (await CaseStore.list()).find(record => signature(record.input) === key) || null;
  }
  async function saveAnalysis(id, { summary = '', body = '' } = {}) {
    const existing = await CaseStore.get(id);
    if (!existing) throw new Error('案例不存在，请重新打开后再保存');
    const synopsis = String(summary ?? '');
    const text = String(body ?? '');
    if (synopsis.length > 50000 || text.length > 50000) throw new Error('单项分析内容最多 50000 个字符');
    const record = { ...existing, notes: { ...existing.notes, summary: synopsis, body: text, updatedAt: Date.now() }, updatedAt: Date.now() };
    await CaseStore.put(record);
    return record;
  }
  async function saveNote(id, body) {
    const existing = await CaseStore.get(id);
    if (!existing) throw new Error('案例不存在，请重新打开后再保存');
    return saveAnalysis(id, { summary: existing.notes?.summary || '', body });
  }
  async function update(id, changes) {
    const existing = await CaseStore.get(id);
    if (!existing) throw new Error('案例不存在');
    const input = normalize({ ...existing.input, ...changes });
    const duplicate = (await CaseStore.list()).find(record => record.id !== id && signature(record.input) === signature(input));
    if (duplicate) throw new Error('修改后的资料与另一个案例重复');
    const record = recordFrom(calculate(input), existing);
    await CaseStore.put(record);
    return record;
  }
  async function remove(id) {
    const existing = await CaseStore.get(id);
    if (!existing) throw new Error('案例不存在');
    await CaseStore.remove(id);
    return existing;
  }
  async function removeMany(ids) {
    const uniqueIds = [...new Set(ids.map(String).filter(Boolean))];
    if (!uniqueIds.length) throw new Error('请先选择要删除的案例');
    const records = await Promise.all(uniqueIds.map(id => CaseStore.get(id)));
    if (records.some(record => !record)) throw new Error('所选案例已发生变化，请刷新后重试');
    await CaseStore.removeMany(uniqueIds);
    return records;
  }
  async function exportBackup() {
    return JSON.stringify({ format: 'bazi-case-backup', version: 1, exportedAt: new Date().toISOString(), cases: await CaseStore.list() }, null, 2);
  }
  async function exportResearch(records) {
    const source = records || await CaseStore.list();
    const cases = source.map(record => ({
      name: record.display.name, gender: record.display.gender === 1 ? '男' : '女',
      birth: record.input, solar: record.display.solar, location: record.display.location || '',
      pillars: record.display.pillars, summary: record.notes?.summary || '', note: record.notes?.body || '', noteUpdatedAt: record.notes?.updatedAt || null,
    }));
    return JSON.stringify({ format: 'bazi-research-cases', version: 2, exportedAt: new Date().toISOString(), cases }, null, 2);
  }
  async function previewRestore(source) {
    pending = null;
    let backup;
    try { backup = JSON.parse(String(source).replace(/^\uFEFF/, '')); }
    catch (_) { throw new Error('备份文件不是有效的 JSON'); }
    const researchFormat = backup?.format === 'bazi-research-cases' && [1, 2].includes(backup.version) && Array.isArray(backup.cases);
    const backupFormat = backup?.format === 'bazi-case-backup' && backup.version === 1 && Array.isArray(backup.cases);
    if (!researchFormat && !backupFormat) throw new Error('文件格式或版本不受支持');
    if (backup.cases.length > 5000) throw new Error('备份最多支持5000条案例');
    const existingRecords = await CaseStore.list();
    const existing = new Map(existingRecords.map(record => [signature(record.input), record]));
    const reservedIds = new Set(existingRecords.map(record => record.id));
    const seen = new Set(); const details = []; const records = []; const updates = new Map();
    for (let index = 0; index < backup.cases.length; index++) {
      const sourceRecord = backup.cases[index];
      try {
        if (!sourceRecord || typeof sourceRecord !== 'object' || !(sourceRecord.input || sourceRecord.birth)) throw new Error('缺少出生资料');
        const input = normalize(sourceRecord.input || sourceRecord.birth);
        const key = signature(input);
        const label = input.name || `${input.year}-${input.month}-${input.day}`;
        if (existing.has(key) || seen.has(key)) {
          const local = existing.get(key);
          const incomingNote = sourceRecord.notes?.body ?? sourceRecord.note;
          const incomingSummary = sourceRecord.notes?.summary ?? sourceRecord.summary;
          if (local && ((incomingNote != null && String(incomingNote) !== (local.notes?.body || ''))
            || (incomingSummary != null && String(incomingSummary) !== (local.notes?.summary || '')))) {
            if (String(incomingNote ?? '').length > 50000 || String(incomingSummary ?? '').length > 50000) throw new Error('分析内容超过50000个字符');
            updates.set(local.id, { ...local, notes: {
              ...local.notes, body: incomingNote == null ? local.notes?.body || '' : String(incomingNote),
              summary: incomingSummary == null ? local.notes?.summary || '' : String(incomingSummary),
              updatedAt: Number(sourceRecord.notes?.updatedAt || sourceRecord.noteUpdatedAt || Date.now()),
            }, updatedAt: Date.now() });
            details.push({ row: index + 1, label, status: 'conflict', id: local.id, message: '本机与文件的分析内容不同，可选择用文件内容覆盖' });
          } else details.push({ row: index + 1, label, status: 'duplicate', message: '案例已存在，保留本机内容' });
          continue;
        }
        const record = recordFrom(calculate(input));
        const noteBody = sourceRecord.notes?.body ?? sourceRecord.note ?? '';
        const noteSummary = sourceRecord.notes?.summary ?? sourceRecord.summary ?? '';
        if (String(noteBody).length > 50000 || String(noteSummary).length > 50000) throw new Error('分析内容超过50000个字符');
        if (noteBody || noteSummary) record.notes = { summary: String(noteSummary), body: String(noteBody), updatedAt: Number(sourceRecord.notes?.updatedAt || sourceRecord.noteUpdatedAt || Date.now()) };
        if (typeof sourceRecord.id === 'string' && sourceRecord.id && !reservedIds.has(sourceRecord.id)) record.id = sourceRecord.id;
        else if (reservedIds.has(record.id)) record.id = `case:restore:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`}`;
        if (Number.isFinite(sourceRecord.createdAt)) record.createdAt = sourceRecord.createdAt;
        if (Number.isFinite(sourceRecord.updatedAt)) record.updatedAt = sourceRecord.updatedAt;
        records.push(record); seen.add(key); reservedIds.add(record.id);
        details.push({ row: index + 1, label, status: 'new', message: `${record.display.pillars.join(' ')}${record.notes?.body || record.notes?.summary ? ' · 含分析' : ''}` });
      } catch (error) {
        details.push({ row: index + 1, label: `第${index + 1}条`, status: 'error', message: error.message || '出生资料无效' });
      }
    }
    pending = { kind: 'restore', records, updates, selectedUpdates: new Set() };
    return { total: backup.cases.length, added: records.length,
      duplicate: details.filter(item => item.status === 'duplicate').length,
      conflicts: details.filter(item => item.status === 'conflict').length,
      error: details.filter(item => item.status === 'error').length, details };
  }
  function selectRestoreUpdate(id, selected) {
    if (!pending || pending.kind !== 'restore' || !pending.updates.has(id)) throw new Error('该案例没有可应用的分析修改');
    if (selected) pending.selectedUpdates.add(id); else pending.selectedUpdates.delete(id);
    return pending.records.length + pending.selectedUpdates.size;
  }
  async function commitRestore() {
    if (!pending || pending.kind !== 'restore') throw new Error('请先预览备份');
    const records = [...pending.records, ...[...pending.selectedUpdates].map(id => pending.updates.get(id))]; pending = null;
    return CaseStore.putMany(records);
  }
  async function search(filter = {}) {
    const text = String(filter.text || '').trim().toLowerCase();
    const gender = filter.gender == null || filter.gender === '' ? null : String(filter.gender);
    const pillar = String(filter.pillar || '').trim();
    const from = String(filter.from || '').trim();
    const to = String(filter.to || '').trim();
    return (await CaseStore.list()).filter(record => {
      const display = record.display;
      const searchable = `${display.name} ${display.solar} ${display.location || ''} ${display.pillars.join(' ')} ${record.notes?.summary || ''} ${record.notes?.body || ''}`.toLowerCase();
      return (!text || searchable.includes(text)) && (gender == null || String(display.gender) === gender)
        && (!pillar || display.pillars.some(item => item.includes(pillar)))
        && (!from || display.solar.slice(0, 10) >= from) && (!to || display.solar.slice(0, 10) <= to);
    });
  }
  return { normalize, search, previewImport, commitImport, previewRestore, selectRestoreUpdate, commitRestore, exportBackup, exportResearch, saveCalculated, findByInput, saveAnalysis, saveNote, update, remove, removeMany };
})();
