/* Case operations shared by the page and future assistant integrations. Birth inputs remain the source of truth. */
window.CaseActions = (() => {
  const aliases = {
    name: ['name', '姓名', '名称'], gender: ['gender', '性别'], calendar: ['calendar', '历法'],
    birth: ['birth', '出生时间', '出生日期', '日期时间'], year: ['year', '年'], month: ['month', '月'],
    day: ['day', '日'], hour: ['hour', '时'], minute: ['minute', '分'], leap: ['leap', '闰月'],
    summerTime: ['summerTime', '夏令时'], ziRule: ['ziRule', '子时换日'], yunMode: ['yunMode', '起运方式'],
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
      summerTime: flag(field(row, 'summerTime')), ziRule, yunMode };
  }
  function signature(input) {
    const normalized = normalize(input);
    return JSON.stringify(normalized);
  }
  function recordFrom(data, previous = null) {
    const input = normalize(data.input);
    const now = Date.now();
    return { id: previous?.id || `case:${signature(input)}`, schemaVersion: 1,
      createdAt: previous?.createdAt || now, updatedAt: now, input,
      display: { name: input.name || '未命名案例', gender: Number(input.gender),
        solar: `${data.inputSolar.toYmd()} ${String(data.inputSolar.getHour()).padStart(2, '0')}:${String(data.inputSolar.getMinute()).padStart(2, '0')}`,
        pillars: data.pillars.map(pillar => pillar.ganzhi) } };
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
    pending = prepared;
    return { total: rows.length, added: prepared.length,
      duplicate: details.filter(item => item.status === 'duplicate').length,
      error: details.filter(item => item.status === 'error').length, details };
  }
  async function commitImport() {
    if (!pending) throw new Error('请先预览导入资料');
    const records = pending; pending = null;
    return CaseStore.putMany(records);
  }
  async function saveCalculated(data) {
    const existing = (await CaseStore.list()).find(record => signature(record.input) === signature(data.input));
    const record = recordFrom(data, existing);
    await CaseStore.put(record);
    return record;
  }
  async function update(id, changes) {
    const existing = await CaseStore.get(id);
    if (!existing) throw new Error('案例不存在');
    const input = normalize({ ...existing.input, ...changes });
    const record = recordFrom(calculate(input), existing);
    await CaseStore.put(record);
    return record;
  }
  async function search(filter = {}) {
    const text = String(filter.text || '').trim().toLowerCase();
    const gender = filter.gender == null || filter.gender === '' ? null : String(filter.gender);
    const pillar = String(filter.pillar || '').trim();
    const from = String(filter.from || '').trim();
    const to = String(filter.to || '').trim();
    return (await CaseStore.list()).filter(record => {
      const display = record.display;
      const searchable = `${display.name} ${display.solar} ${display.pillars.join(' ')}`.toLowerCase();
      return (!text || searchable.includes(text)) && (gender == null || String(display.gender) === gender)
        && (!pillar || display.pillars.some(item => item.includes(pillar)))
        && (!from || display.solar.slice(0, 10) >= from) && (!to || display.solar.slice(0, 10) <= to);
    });
  }
  return { normalize, search, previewImport, commitImport, saveCalculated, update };
})();
