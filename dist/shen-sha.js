/* Source-derived first-pass subset of the original APK's four-pillar Shen Sha. */
(() => {
  const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  const yes = (map, key, value) => map[key] === value;
  const inMap = (map, key, value) => (map[key] || '').includes(value);

  function calculate(pillars, sect = 1) {
    const stems = pillars.map(p => p.ganzhi[0]);
    const branches = pillars.map(p => p.ganzhi[1]);
    const [yearStem, , dayStem] = stems;
    const [yearBranch, monthBranch, dayBranch] = branches;

    const taiJi = {甲:'子午',乙:'子午',丙:'卯酉',丁:'卯酉',戊:'辰戌丑未',己:'辰戌丑未',庚:'寅亥',辛:'寅亥',壬:'巳申',癸:'巳申'};
    const tianYi = {甲:'丑未',戊:'丑未',乙:'子申',己:'子申',丙:'亥酉',丁:'亥酉',壬:'卯巳',癸:'卯巳',庚:'寅午',辛:'寅午'};
    const wenChang = {甲:'巳',乙:'午',丙:'申',丁:'酉',戊:'申',己:'酉',庚:'亥',辛:'子',壬:'寅',癸:'卯'};
    const fuXing = {甲:'寅子',丙:'寅子',乙:'卯丑',癸:'卯丑',戊:'申',己:'未',丁:'亥',庚:'午',辛:'巳',壬:'辰'};
    const guoYin = {甲:'戌',乙:'亥',丙:'丑',丁:'寅',戊:'丑',己:'寅',庚:'辰',辛:'巳',壬:'未',癸:'申'};
    const huaGai = {子:'辰',丑:'丑',寅:'戌',卯:'未',辰:'辰',巳:'丑',午:'戌',未:'未',申:'辰',酉:'丑',戌:'戌',亥:'未'};
    const taoHua = {子:'酉',丑:'午',寅:'卯',卯:'子',辰:'酉',巳:'午',午:'卯',未:'子',申:'酉',酉:'午',戌:'卯',亥:'子'};
    const piTou = {子:'辰',丑:'卯',寅:'寅',卯:'丑',辰:'戌',巳:'亥',午:'戌',未:'酉',申:'申',酉:'未',戌:'午',亥:'巳'};
    const diaoKe = {子:'戌',丑:'亥',寅:'子',卯:'丑',辰:'寅',巳:'卯',午:'辰',未:'巳',申:'午',酉:'未',戌:'申',亥:'酉'};
    const guaSu = {子:'戌',丑:'戌',寅:'丑',卯:'丑',辰:'丑',巳:'辰',午:'辰',未:'辰',申:'未',酉:'未',戌:'未',亥:'戌'};
    const jinKui = {子:'子',辰:'子',申:'子',寅:'午',午:'午',戌:'午',亥:'卯',卯:'卯',未:'卯',巳:'酉',酉:'酉',丑:'酉'};
    const yueDe = {子:'壬',辰:'壬',申:'壬',亥:'甲',卯:'甲',未:'甲',寅:'丙',午:'丙',戌:'丙',巳:'庚',酉:'庚',丑:'庚'};
    const tianDeStem = {寅:'丁',辰:'壬',巳:'辛',未:'甲',申:'癸',戌:'丙',亥:'乙',丑:'庚'};
    const tianDeBranch = {卯:'申',午:'亥',酉:'寅',子:'巳'};
    const yuanChenForward = Object.fromEntries([...BRANCHES].map((b, i) => [b, BRANCHES[(i + 7) % 12]]));
    const yuanChenReverse = Object.fromEntries([...BRANCHES].map((b, i) => [b, BRANCHES[(i + 5) % 12]]));

    return pillars.map((pillar, index) => {
      const stem = stems[index], branch = branches[index], ganzhi = pillar.ganzhi;
      const names = [];
      const hasStem = (table, target) => [yearStem, dayStem].some(s => inMap(table, s, target));
      const hasBranch = (table, target) => [yearBranch, dayBranch].some(b => yes(table, b, target));

      if (hasStem(taiJi, branch)) names.push('太极');
      if (hasStem(tianYi, branch)) names.push('天乙');
      if (hasStem(fuXing, branch)) names.push('福星');
      if (hasStem(guoYin, branch)) names.push('国印');
      if (yes(yueDe, monthBranch, stem)) names.push('月德');
      if (yes(tianDeStem, monthBranch, stem) || yes(tianDeBranch, monthBranch, branch)) names.push('天德');
      if (hasStem(wenChang, branch)) names.push('文昌');
      if ((index === 2 || index === 3) && ['乙丑','己巳','癸酉'].includes(ganzhi)) names.push('金神');
      if (yes(jinKui, yearBranch, branch)) names.push('金匮');
      if (((index >= 1 && index <= 3) && yes(huaGai, yearBranch, branch)) || ((index === 0 || index === 1 || index === 3) && yes(huaGai, dayBranch, branch))) names.push('华盖');

      // The APK's default method 2 checks year and day branches against each target pillar.
      if (hasBranch(taoHua, branch)) names.push('桃花');
      if (yes(piTou, yearBranch, branch)) names.push('披头');
      if (yes(diaoKe, yearBranch, branch)) names.push('吊客');
      if (yes(guaSu, yearBranch, branch)) names.push('寡宿');
      const forward = sect === 1;
      const yuanMap = forward ? yuanChenForward : yuanChenReverse;
      if (yes(yuanMap, yearBranch, branch)) names.push('元辰');

      // The original default method 2 for 驿马 tests the year and day trines.
      const yiMa = {申子辰:'寅',亥卯未:'巳',寅午戌:'申',巳酉丑:'亥'};
      if (Object.entries(yiMa).some(([group, target]) =>
        (group.includes(yearBranch) || group.includes(dayBranch)) && target === branch)) names.push('驿马');
      return names;
    });
  }

  window.ApkShenSha = { calculate, implementedDefaultNames: ['太极','天乙','福星','国印','月德','天德','文昌','金神','金匮','华盖','桃花','披头','吊客','寡宿','元辰','驿马'] };
})();
