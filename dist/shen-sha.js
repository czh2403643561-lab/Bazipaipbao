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
    const guChen = {子:'寅',丑:'寅',寅:'巳',卯:'巳',辰:'巳',巳:'申',午:'申',未:'申',申:'亥',酉:'亥',戌:'亥',亥:'寅'};
    const diaoKe = {子:'戌',丑:'亥',寅:'子',卯:'丑',辰:'寅',巳:'卯',午:'辰',未:'巳',申:'午',酉:'未',戌:'申',亥:'酉'};
    const guaSu = {子:'戌',丑:'戌',寅:'丑',卯:'丑',辰:'丑',巳:'辰',午:'辰',未:'辰',申:'未',酉:'未',戌:'未',亥:'戌'};
    const jinKui = {子:'子',辰:'子',申:'子',寅:'午',午:'午',戌:'午',亥:'卯',卯:'卯',未:'卯',巳:'酉',酉:'酉',丑:'酉'};
    const yueDe = {子:'壬',辰:'壬',申:'壬',亥:'甲',卯:'甲',未:'甲',寅:'丙',午:'丙',戌:'丙',巳:'庚',酉:'庚',丑:'庚'};
    const luShen = {甲:'寅',乙:'卯',丙:'巳',丁:'午',戊:'巳',己:'午',庚:'申',辛:'酉',壬:'亥',癸:'子'};
    const tianDeStem = {寅:'丁',辰:'壬',巳:'辛',未:'甲',申:'癸',戌:'丙',亥:'乙',丑:'庚'};
    const tianDeBranch = {卯:'申',午:'亥',酉:'寅',子:'巳'};
    const tianXi = {子:'酉',丑:'申',寅:'未',卯:'午',辰:'巳',巳:'辰',午:'卯',未:'寅',申:'丑',酉:'子',戌:'亥',亥:'戌'};
    const hongLuan = {子:'卯',卯:'子',丑:'寅',寅:'丑',辰:'亥',亥:'辰',巳:'戌',戌:'巳',午:'酉',酉:'午',申:'未',未:'申'};
    const tianYiMap = {子:'亥',丑:'子',寅:'丑',卯:'寅',辰:'卯',巳:'辰',午:'巳',未:'午',申:'未',酉:'申',戌:'酉',亥:'戌'};
    const yangRen = {甲:'卯',乙:'寅',丙:'午',丁:'巳',戊:'午',己:'巳',庚:'酉',辛:'申',壬:'子',癸:'亥'};
    const jieSha = {申:'巳',子:'巳',辰:'巳',亥:'申',卯:'申',未:'申',寅:'亥',午:'亥',戌:'亥',巳:'寅',酉:'寅',丑:'寅'};
    const zaiSha = {申:'午',子:'午',辰:'午',亥:'酉',卯:'酉',未:'酉',戌:'子',午:'子',寅:'子',巳:'卯',酉:'卯',丑:'卯'};
    const bingFu = {子:'亥',丑:'子',寅:'丑',卯:'寅',辰:'卯',巳:'辰',午:'巳',未:'午',申:'未',酉:'申',戌:'酉',亥:'戌'};
    const sangMen = {子:'寅',丑:'卯',寅:'辰',卯:'巳',辰:'午',巳:'未',午:'申',未:'酉',申:'戌',酉:'亥',戌:'子',亥:'丑'};
    const piMa = {子:'酉',丑:'戌',寅:'亥',卯:'子',辰:'丑',巳:'寅',午:'卯',未:'辰',申:'巳',酉:'午',戌:'未',亥:'申'};
    const liuE = {子:'卯',丑:'子',寅:'酉',卯:'午',辰:'卯',巳:'子',午:'酉',未:'午',申:'卯',酉:'子',戌:'酉',亥:'午'};
    const wangShen = {子:'亥',丑:'申',寅:'巳',卯:'寅',辰:'亥',巳:'申',午:'巳',未:'寅',申:'亥',酉:'申',戌:'巳',亥:'寅'};
    const hongYan = {甲:'午',乙:'申',丙:'寅',丁:'未',戊:'辰',己:'辰',庚:'戌',辛:'酉',壬:'子',癸:'申'};
    const liuXiaStem = {甲:'酉',乙:'戌',丙:'未',丁:'申',戊:'己',己:'午',庚:'辰',辛:'卯',壬:'亥',癸:'寅'};
    const guanFuPillars = new Set(['甲辰','乙亥','丙辰','丁酉','戊午','庚戌','庚寅','辛亥','壬寅','癸未']);
    const shiEDaBai = new Set(['甲辰','乙巳','壬申','丙申','丁亥','庚辰','戊戌','癸亥','辛巳','己丑']);
    const yinChaYangCuo = new Set(['丙子','丁丑','戊寅','辛卯','壬辰','癸巳','丙午','丁未','戊申','辛酉','壬戌','癸亥']);
    const baZhuan = new Set(['甲寅','乙卯','戊辰','戊戌','己未','庚申','辛酉','癸丑']);
    const yuanChenForward = Object.fromEntries([...BRANCHES].map((b, i) => [b, BRANCHES[(i + 7) % 12]]));
    const yuanChenReverse = Object.fromEntries([...BRANCHES].map((b, i) => [b, BRANCHES[(i + 5) % 12]]));
    const yiMa = {子:'寅',丑:'亥',寅:'申',卯:'巳',辰:'寅',巳:'亥',午:'申',未:'巳',申:'寅',酉:'亥',戌:'申',亥:'巳'};

    return pillars.map((pillar, index) => {
      const stem = stems[index], branch = branches[index], ganzhi = pillar.ganzhi;
      const names = [];
      const hasStem = (table, target) => [yearStem, dayStem].some(s => inMap(table, s, target));
      const hasBranch = (table, target) => [yearBranch, dayBranch].some(b => yes(table, b, target));

      if (yes(luShen, dayStem, branch)) names.push('禄神');
      if (hasStem(taiJi, branch)) names.push('太极');
      if (hasStem(tianYi, branch)) names.push('天乙');
      if (hasStem(fuXing, branch)) names.push('福星');
      if (hasStem(guoYin, branch)) names.push('国印');
      if (yes(yueDe, monthBranch, stem)) names.push('月德');
      if (yes(tianDeStem, monthBranch, stem) || yes(tianDeBranch, monthBranch, branch)) names.push('天德');
      if (yes(tianYiMap, monthBranch, branch)) names.push('天医');
      if (hasStem(wenChang, branch)) names.push('文昌');
      if (yes(yangRen, dayStem, branch)) names.push('阳刃');
      if ((index === 2 || index === 3) && ['乙丑','己巳','癸酉'].includes(ganzhi)) names.push('金神');
      if (yes(jinKui, yearBranch, branch)) names.push('金匮');
      if (((index >= 1 && index <= 3) && yes(huaGai, yearBranch, branch)) || ((index === 0 || index === 1 || index === 3) && yes(huaGai, dayBranch, branch))) names.push('华盖');

      // The APK's default method 2 checks year and day branches against each target pillar.
      if (hasBranch(taoHua, branch)) names.push('桃花');
      if (yes(jieSha, dayBranch, branch)) names.push('劫煞');
      if (yes(zaiSha, yearBranch, branch)) names.push('灾煞');
      if (yes(piTou, yearBranch, branch)) names.push('披头');
      if (yes(diaoKe, yearBranch, branch)) names.push('吊客');
      if (yes(guChen, yearBranch, branch)) names.push('孤辰');
      if (yes(guaSu, yearBranch, branch)) names.push('寡宿');
      if (yes(bingFu, yearBranch, branch)) names.push('病符');
      if (yes(sangMen, yearBranch, branch)) names.push('丧门');
      if (yes(piMa, yearBranch, branch)) names.push('披麻');
      if (yes(liuE, yearBranch, branch)) names.push('六厄');
      if (hasBranch(wangShen, branch)) names.push('亡神');
      if (index === 2 && shiEDaBai.has(ganzhi)) names.push('十恶大败');
      if (index === 2 && yinChaYangCuo.has(ganzhi)) names.push('阴差阳错');
      if (hasStem(hongYan, branch)) names.push('红艳');
      if (index === 2 && baZhuan.has(ganzhi)) names.push('八专');
      if (index === 2 && ['壬辰','庚戌','庚辰','戊戌'].includes(ganzhi)) names.push('魁罡');
      if ((index === 2 || index === 3) && guanFuPillars.has(ganzhi)) names.push('官符');
      if (index === 3 && yes(liuXiaStem, dayStem, stem)) names.push('流霞');
      const yangYear = '子寅辰午申戌'.includes(yearBranch);
      const forward = sect === 1 ? yangYear : !yangYear;
      const yuanMap = forward ? yuanChenForward : yuanChenReverse;
      if (yes(yuanMap, yearBranch, branch)) names.push('元辰');

      if (index === 2) {
        const forgiveness = {寅:['戊寅'],卯:['戊寅'],辰:['戊寅'],巳:['甲午'],午:['甲午'],未:['甲午'],申:['戊申'],酉:['戊申'],戌:['戊申'],亥:['甲子'],子:['甲子'],丑:['甲子']};
        if ((forgiveness[monthBranch] || []).includes(ganzhi)) names.push('天赦');
        if (['丙午','丁未','戊子','戊午','己丑','己未'].includes(ganzhi)) names.push('六秀');
      }
      if (yes({甲:'辰',乙:'巳',丙:'未',丁:'申',戊:'未',己:'申',庚:'戌',辛:'亥',壬:'丑',癸:'寅'}, dayStem, branch)) names.push('金舆');
      const yearNayinElement = pillars[0].nayin?.slice(-1);
      const xueTang = {木:'亥',火:'寅',土:'申',金:'巳',水:'申'};
      const ciGuan = {木:'寅',火:'巳',土:'亥',金:'申',水:'亥'};
      if (yes(xueTang, yearNayinElement, branch)) names.push('学堂');
      if (yes(ciGuan, yearNayinElement, branch)) names.push('词馆');

      const jiangXing = {申:'子',子:'子',辰:'子',寅:'午',午:'午',戌:'午',亥:'卯',卯:'卯',未:'卯',巳:'酉',酉:'酉',丑:'酉'};
      if (index === 3 && yes(jiangXing, dayBranch, branch)) names.push('将星');
      if (index !== 0 && (yes(tianXi, yearBranch, branch))) names.push('天喜');
      if (index !== 0 && (yes(hongLuan, yearBranch, branch))) names.push('红鸾');

      // The original default method 2 for 驿马 tests the year and day trines.
      if (yes(yiMa, yearBranch, branch) || yes(yiMa, dayBranch, branch)) names.push('驿马');
      return names;
    });
  }

  window.ApkShenSha = { calculate, implementedDefaultNames: ['禄神','国印','太极','天乙','天医','月德','天德','福星','天赦','文昌','学堂','词馆','金舆','六秀','金神','将星','金匮','华盖','驿马','天喜','红鸾','阳刃','劫煞','灾煞','元辰','流霞','官符','病符','吊客','丧门','披头','披麻','六厄','亡神','十恶大败','孤辰寡宿','阴差阳错','红艳','桃花','八专','魁罡'] };
})();
