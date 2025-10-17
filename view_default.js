/*
 * @Description: 历史修改记录热力图 - 支持多种统计模式
 * @Usage: 
 * ```dataviewjs
 * // 默认模式：基于 data.json 的文件修改统计
 * await dv.view('/Plugin_Dir/Dataview/Heatmap/view')
 * 
 * // cday 模式：笔记创建日期统计
 * await dv.view('/Plugin_Dir/Dataview/Heatmap/view', {type: 'cday'})
 * 
 * // mday 模式：笔记修改日期统计（实时）
 * await dv.view('/Plugin_Dir/Dataview/Heatmap/view', {type: 'mday'})
 * 

 * ```
 * 
 * 功能说明：
 * 1. 默认模式（无参数）：优先从 data.json 读取历史数据
 * 2. 其他模式：实时从 Dataview 统计数据
 * 3. 每次页面加载时自动更新今天的数据（默认模式）
 */

/** ============ 配置区域 ============ */
const CONFIG = {
  // 数据文件路径（相对于 vault 根目录）
  dataFile: "Plugin_Dir/Dataview/Heatmap/data.json",
  
  // 忽略的文件夹
  ignoreFolders: ['.obsidian', '.trash', '.git'],
  
  // 是否开启调试模式
  debug: false
};

/** ============ 获取输入参数 ============ */
const getInput = (key, defaultVal) => {
  return input && input[key] ? input[key] : defaultVal;
};

// 获取统计模式
const statMode = getInput('type', 'default');

/** ============ 工具函数 ============ */

/**
 * 获取今天的日期字符串 YYYY-MM-DD (北京时间)
 */
const getTodayString = () => {
  const now = new Date();
  const beijingDateStr = now.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [year, month, day] = beijingDateStr.split('/');
  return `${year}-${month}-${day}`;
};

/**
 * 格式化日期对象为字符串 YYYY-MM-DD (北京时间)
 */
const formatDate = (date) => {
  const beijingDateStr = date.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [year, month, day] = beijingDateStr.split('/');
  return `${year}-${month}-${day}`;
};

/**
 * 获取当前时间戳字符串 (北京时间)
 */
const getCurrentTimestamp = () => {
  const now = new Date();
  const beijingTimeStr = now.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const [datePart, timePart] = beijingTimeStr.split(' ');
  const [year, month, day] = datePart.split('/');
  return `${year}-${month}-${day} ${timePart}`;
};

/**
 * 检查文件路径是否应该被忽略
 */
const shouldIgnore = (path) => {
  return CONFIG.ignoreFolders.some(folder => path.startsWith(folder));
};

/** ============ Dataview 统计模式 ============ */

/**
 * 获取所有笔记
 */
const getAllNotes = () => {
  return dv.pages().filter(p => p.file.ext === 'md');
};

/**
 * 代表的价值单纯 +1
 */
const addOne = () => 1;

/**
 * Dataview 统计方法配置
 */
const dataviewMethods = {
  cday: {
    name: '笔记创建日期',
    source: getAllNotes(),
    getDate: p => dv.func.dateformat(p.file.cday, 'yyyy-MM-dd'),
    getValue: addOne
  },
  mday: {
    name: '笔记修改日期',
    source: getAllNotes(),
    getDate: p => dv.func.dateformat(p.file.mday, 'yyyy-MM-dd'),
    getValue: addOne
  }
};

/**
 * 使用 Dataview 统计数据
 */
const getDataviewStats = (mode) => {
  const method = dataviewMethods[mode];
  if (!method) {
    console.warn(`未知的统计模式: ${mode}，使用 cday 模式`);
    return getDataviewStats('cday');
  }
  
  const data = {};
  method.source.forEach(p => {
    try {
      const dateStr = method.getDate(p);
      if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return;
      
      const val = method.getValue(p);
      data[dateStr] = data[dateStr] ? data[dateStr] + val : val;
    } catch (e) {
      // 忽略格式错误的数据
    }
  });
  
  if (CONFIG.debug) {
    console.log(`${method.name} 统计完成:`, {
      总天数: Object.keys(data).length,
      总计数: Object.values(data).reduce((a, b) => a + b, 0)
    });
  }
  
  return data;
};

/** ============ data.json 模式（默认） ============ */

/**
 * 读取历史数据文件
 */
const readDataFile = async () => {
  try {
    const file = app.vault.getAbstractFileByPath(CONFIG.dataFile);
    if (!file) {
      if (CONFIG.debug) console.log('数据文件不存在');
      return null;
    }
    
    const content = await app.vault.read(file);
    const data = JSON.parse(content);
    
    if (!data.dailyEdits) data.dailyEdits = {};
    if (!data.version) data.version = 4;
    
    for (const [date, count] of Object.entries(data.dailyEdits)) {
      if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
        console.warn(`数据异常: ${date} = ${count}，已重置为 0`);
        data.dailyEdits[date] = 0;
      }
    }
    
    return data;
  } catch (e) {
    console.warn('读取数据文件失败:', e);
    return null;
  }
};

/**
 * 写入数据文件
 */
const writeDataFile = async (data) => {
  try {
    const dirPath = CONFIG.dataFile.substring(0, CONFIG.dataFile.lastIndexOf('/'));
    const adapter = app.vault.adapter;
    
    if (dirPath && !(await adapter.exists(dirPath))) {
      await adapter.mkdir(dirPath);
    }
    
    const sortedDailyEdits = {};
    const sortedKeys = Object.keys(data.dailyEdits).sort((a, b) => b.localeCompare(a));
    for (const key of sortedKeys) {
      sortedDailyEdits[key] = data.dailyEdits[key];
    }
    data.dailyEdits = sortedDailyEdits;
    data.lastUpdate = getCurrentTimestamp();
    
    const content = JSON.stringify(data, null, 2);
    const file = app.vault.getAbstractFileByPath(CONFIG.dataFile);
    
    if (file) {
      await app.vault.modify(file, content);
    } else {
      await app.vault.create(CONFIG.dataFile, content);
    }
    
    if (CONFIG.debug) console.log('数据文件已保存:', data.lastUpdate);
    return true;
  } catch (e) {
    console.error('写入数据文件失败:', e);
    return false;
  }
};

/**
 * 全量扫描所有文件并构建历史记录
 */
const fullScanAllFiles = async () => {
  if (CONFIG.debug) console.log('开始全量扫描（统计所有 .md 文件）...');
  
  const data = { 
    dailyEdits: {},
    lastFullScan: getTodayString(),
    version: 4
  };
  
  const files = app.vault.getMarkdownFiles();
  const dailyFileSets = {};
  
  for (const file of files) {
    if (shouldIgnore(file.path)) continue;
    
    const modDate = new Date(file.stat.mtime);
    const modDateStr = formatDate(modDate);
    
    if (!dailyFileSets[modDateStr]) {
      dailyFileSets[modDateStr] = new Set();
    }
    dailyFileSets[modDateStr].add(file.path);
  }
  
  for (const [date, fileSet] of Object.entries(dailyFileSets)) {
    data.dailyEdits[date] = fileSet.size;
  }
  
  if (CONFIG.debug) {
    const totalDays = Object.keys(data.dailyEdits).length;
    const totalEdits = Object.values(data.dailyEdits).reduce((a, b) => a + b, 0);
    console.log(`全量扫描完成: ${totalDays} 天，共 ${totalEdits} 次文件修改`);
  }
  
  return data;
};

/**
 * 增量更新：只更新今天的数据
 */
const updateTodayData = async (data) => {
  const today = getTodayString();
  
  if (CONFIG.debug) console.log(`更新今天 ${today} 的数据...`);
  
  const files = app.vault.getMarkdownFiles();
  const todayFiles = new Set();
  
  for (const file of files) {
    if (shouldIgnore(file.path)) continue;
    
    const modDate = new Date(file.stat.mtime);
    const modDateStr = formatDate(modDate);
    
    if (modDateStr === today) {
      todayFiles.add(file.path);
    }
  }
  
  const oldCount = data.dailyEdits[today] || 0;
  const newCount = todayFiles.size;
  
  data.dailyEdits[today] = newCount;
  
  if (oldCount !== newCount) {
    await writeDataFile(data);
    if (CONFIG.debug) console.log(`✓ 今天数据已更新: ${oldCount} → ${newCount} 个文件`);
    return true;
  }
  
  if (CONFIG.debug) console.log(`今天数据无变化: ${newCount} 个文件`);
  return false;
};

/**
 * 加载默认模式数据
 */
const loadDefaultModeData = async () => {
  let data = await readDataFile();
  
  if (!data) {
    if (CONFIG.debug) console.log('data.json 不存在，执行全量扫描');
    data = await fullScanAllFiles();
    await writeDataFile(data);
  } else {
    await updateTodayData(data);
  }
  
  return data.dailyEdits;
};

/** ============ 热力图渲染 ============ */

/**
 * 创建本地日期对象
 */
const createLocalDate = (year, month, day) => {
  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * 从日期对象获取 YYYY-MM-DD 字符串
 */
const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 等级计算方法（固定阈值，与旧版本一致）
 */
const levelGetter = (count) => {
  return count < 5 ? count : 5;
};

/**
 * 追加一天的代码
 */
const addDay = (code, className, tipLabel) => {
  return code + `<div class="${className.join(' ')}" ${tipLabel}>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAADElEQVQImWP4//8/AAX+Av5Y8mosOAAAAAElFTkSuQmCC">
      </div>`;
};

/**
 * 生成热力图 HTML
 */
const generateHeatmap = (heatData) => {
  const today = createLocalDate(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );
  
  const daylong = 24 * 60 * 60 * 1000;
  const todayWeekday = today.getDay();
  const daysToGoBack = todayWeekday + 52 * 7;
  const startDay = new Date(today.getTime() - daysToGoBack * daylong);
  
  let code = `
<style>
.dms-heatmap {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  width: 100%;
  overflow: hidden;
}
.dms-heatmap-weekrow {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  flex-grow: 1;
  min-width: 18px;
  position: relative;
  padding-top: 28px;
}
.dms-heatmap-month {
  position: absolute;
  top: 0;
  line-height: 28px;
  font-size: 14px;
}
.dms-heatmap-day {
  border: 1px solid rgba(128, 128, 128, .08);
  background-color: rgba(128, 128, 128, .05);
  border-radius: 3px;
  margin: 0 1px 1px 0;
  box-sizing: border-box;
  cursor: pointer;
  position: relative;
}
.dms-heatmap-day:hover::before {
  position: absolute;
  content: ' ';
  background: #333336;
  box-shadow: 0 -2px 6px rgba(0, 0, 0, .1);
  z-index: 10;
  width: 12px;
  height: 12px;
  top: -16px;
  left: 50%;
  transform: translate(-50%, 0) rotate(45deg);
}
.dms-heatmap-day:hover::after {
  position: absolute;
  content: attr(aria-label);
  background: #333336;
  border-radius: 3px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, .1);
  z-index: 10;
  white-space: nowrap;
  color: #CCCCCE;
  font-size: 12px;
  line-height: 12px;
  padding: 3px 6px;
  top: -24px;
  left: 50%;
  transform: translate(-50%, 0)
}

.dms-heatmap-weekrow:nth-last-child(1) .dms-heatmap-day:hover::before,
.dms-heatmap-weekrow:nth-last-child(2) .dms-heatmap-day:hover::before {
  left: 80%;
  transform: translate(-80%, 0) rotate(45deg);
}
.dms-heatmap-weekrow:nth-last-child(1) .dms-heatmap-day:hover::after,
.dms-heatmap-weekrow:nth-last-child(2) .dms-heatmap-day:hover::after {
  left: 80%;
  transform: translate(-80%, 0);
}

.dms-heatmap-day.dms-heatmap-future-day {
  opacity: 0;
}
.dms-heatmap-day > img {
  position: relative;
  border: none;
  background: none;
  width: 100%;
  display: block;
  opacity: 0;
  z-index: -100;
}
.dms-heatmap-level-0 { background-color: rgba(128, 128, 128, .05); }
.dms-heatmap-level-1 { background-color: hsl(120, 60%, 80%, .5); }
.dms-heatmap-level-2 { background-color: hsl(120, 60%, 70%, .5); }
.dms-heatmap-level-3 { background-color: hsl(120, 60%, 60%, .5); }
.dms-heatmap-level-4 { background-color: hsl(120, 60%, 50%, .5); }
.dms-heatmap-level-5 { background-color: hsl(120, 60%, 40%, .5); }

.dms-heatmap-weekday-mark {
  border: 1px solid rgba(128, 128, 128, 0);
  background: none;
}

.dms-heatmap-weekday-0 { background-color: hsl(10, 100%, 60%, .3); }
.dms-heatmap-weekday-3 { background-color: hsl(200, 100%, 60%, .3); }
.dms-heatmap-weekday-6 { background-color: hsl(200, 100%, 60%, .3); }

.dms-heatmap-mark-show {
  width: 100%;
  flex-grow: 0;
  text-align: right;
  font-size: 12px;
  line-height: 2em;
}
.dms-heatmap-level-mark {
  display: inline-block;
  width: 12px;
  height: 12px;
}

@media screen and (max-width: 480px) {
  .dms-heatmap-weekrow {
    min-width: 32px;
  }
}
</style>
<div class="dms-heatmap">`;

  let dayCount = 0;
  
  for (let weekIndex = 0; weekIndex < 53; weekIndex++) {
    const weekStartTime = startDay.getTime() + dayCount * daylong;
    if (weekStartTime > today.getTime()) break;
    
    code += `<div class="dms-heatmap-weekrow">`;
    
    for (let d = 0; d < 7; d++) {
      const theDay = new Date(startDay.getTime() + dayCount * daylong);
      const theDayStr = formatLocalDate(theDay);
      
      if (theDay.getDate() === 1) {
        const monthStr = String(theDay.getMonth() + 1).padStart(2, '0');
        code += `<div class="dms-heatmap-month">${monthStr}</div>`;
      }
      
      const dataValue = heatData[theDayStr] || 0;
      const level = levelGetter(dataValue);
      
      const className = [
        'dms-heatmap-day',
        `dms-heatmap-level-${level}`
      ];
      
      const isFuture = theDay.getTime() > today.getTime();
      if (isFuture) {
        className.push('dms-heatmap-future-day');
      }
      
      const tipLabel = !isFuture 
        ? `aria-label="${dataValue > 0 ? dataValue + ' ' : ''}${theDayStr}"` 
        : '';
      
      code = addDay(code, className, tipLabel);
      dayCount++;
    }
    
    code += `</div>`;
  }
  
  code += `<div class="dms-heatmap-weekrow">`;
  const weekname = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let d = 0; d < 7; d++) {
    const className = [
      'dms-heatmap-day',
      'dms-heatmap-weekday-mark',
      `dms-heatmap-weekday-${d}`
    ];
    const tipLabel = `aria-label="${weekname[d]}"`;
    code = addDay(code, className, tipLabel);
  }
  code += `</div>`;
  
  code += `</div>`;
  
  code += `<div class="dms-heatmap-mark-show">Less `;
  for (let d = 0; d < 6; d++) {
    const className = [
      'dms-heatmap-day',
      'dms-heatmap-level-mark',
      `dms-heatmap-level-${d}`
    ];
    const tipLabel = `aria-label="level-${d}"`; 
    code = addDay(code, className, tipLabel);
  }
  code += ` More</div>`;
  
  return code;
};

/** ============ 主程序 ============ */

try {
  let heatData;
  let modeName = '';
  
  // 根据模式选择数据源
  if (statMode === 'default') {
    heatData = await loadDefaultModeData();
    modeName = '文件修改记录（data.json）';
  } else if (dataviewMethods[statMode]) {
    heatData = getDataviewStats(statMode);
    modeName = dataviewMethods[statMode].name;
  } else {
    console.warn(`未知模式: ${statMode}，使用默认模式`);
    heatData = await loadDefaultModeData();
    modeName = '文件修改记录（data.json）';
  }
  
  // 生成热力图 HTML
  const heatmapHtml = generateHeatmap(heatData);
  
  // 渲染到页面
  const root = dv.el('div', '', { cls: "dms-heatmap-container" });
  const rootShadow = root.attachShadow({ mode: 'open' });
  rootShadow.innerHTML = heatmapHtml;
  
  if (CONFIG.debug) {
    console.log(`热力图渲染完成 [${modeName}]`);
    console.log('数据统计:', {
      模式: statMode,
      总天数: Object.keys(heatData).length,
      总计数: Object.values(heatData).reduce((a, b) => a + b, 0),
      今日: heatData[getTodayString()] || 0,
      当前北京时间: getCurrentTimestamp()
    });
  }
  
} catch (error) {
  console.error('热力图生成失败:', error);
  dv.paragraph(`❌ 热力图生成失败: ${error.message}`);
}
