/**
 * ============================================================================
 * HeatmapRadarCombined.js — 热力图 + 雷达图组合视图(方案B完整版 + 哈希隐私保护)
 * ============================================================================
 * 版本: v7.0 - 添加 SHA-256 短哈希隐私保护
 * 更新: 2025-10-19
 * 
 * 使用说明:
 * ```dataviewjs
 * await dv.view("Matrix", {
 *   heatmap: {
 *     type: "default"  // 可选: 'default' | 'cday' | 'mday'
 *   },
 *   radar: {
 *     categories: [
 *       { 
 *         name: "Red Team", 
 *         tags: ["RedTeam", "Offensive"],
 *         folders: ["渗透测试笔记"],
 *         color: "#ef4444" 
 *       }
 *     ]
 *   }
 * })
 * ```
 * 
 * 🆕 v7.0 新特性 - SHA-256 短哈希模式:
 * - 使用 16 字符短哈希保护隐私
 * - data.json 中不再暴露文件路径
 * - 云同步完全安全
 * - 碰撞概率接近 0（2^64 空间）
 * - 支持哈希缓存，性能优秀
 * 
 * data.json 数据结构示例:
 * {
 *   "dailyEdits": {
 *     "2025-10-19": ["a3f5c8e2d1b4f9c7", "b8c3e9f1d7a2c5e8"]
 *   },
 *   "version": 7,
 *   "mode": "hash-based",
 *   "hashAlgorithm": "SHA-256-64bit",
 *   "lastUpdate": "2025-10-19 15:30:25"
 * }
 * ============================================================================
 */

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║                     配置区域 - 固定配置项(不常修改)                   ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */

const CONFIG = {
  
  /* ===== 🔒 隐私保护配置 ===== */
  useHashMode: true,              // 启用哈希模式
  hashAlgorithm: 'SHA-256-64bit', // 使用 SHA-256 前 8 字节（16 字符）
  enableHashCache: true,          // 启用哈希缓存提升性能
  
  /* ===== 雷达图视觉配置 ===== */
  radar: {
    size: 205,
    radius: 100,
    showLabels: false,
    levels: 5,
    fontSize: 12
  },
  
  /* ===== 默认颜色池 ===== */
  defaultColors: [
    "#ef4444", // 鲜红色
	"#f59e0b", // 琥珀色
	"#10b981", // 翡翠绿
	"#3b82f6", // 宝蓝色
	"#8b5cf6", // 紫罗兰
	"#ec4899", // 玫瑰粉
	"#06b6d4", // 青蓝色
	"#84cc16"  // 柠檬绿
  ],
  
  /* ===== data.json 模式配置 ===== */
  dataFile: "Plugin_Dir/Dataview/Skills Matrix/data.json",
  ignoreFolders: ['.obsidian', '.trash', '.git', 'Plugin_Dir/BRAT'],
  debug: false  // 改为 true 可查看详细日志
};

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║                    主程序代码 - 请勿修改                              ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */

// --- 获取用户输入配置 ---
const cfg = input ?? {};

// ⚠️ 必填参数检查
if (!cfg.radar || !Array.isArray(cfg.radar.categories) || cfg.radar.categories.length === 0) {
  throw new Error("❌ 缺少必填参数:radar.categories(雷达图分类配置),请在调用时传入至少一个分类");
}

// --- 配置验证 ---
const categories = cfg.radar.categories;
categories.forEach((cat, index) => {
  if (!cat.name) {
    throw new Error(`❌ 分类 [${index}] 缺少 name 属性`);
  }
  
  if (!cat.tags && !cat.folders) {
    console.warn(`⚠️ 角度 "${cat.name}" 既没有配置 tags 也没有配置 folders,将不会统计到任何文件`);
  }
  
  if (cat.folders && !Array.isArray(cat.folders)) {
    throw new Error(`❌ 角度 "${cat.name}" 的 folders 必须是数组`);
  }
  
  if (cat.tags && !Array.isArray(cat.tags)) {
    throw new Error(`❌ 角度 "${cat.name}" 的 tags 必须是数组`);
  }
});

// --- 合并配置 ---
const heatmapCfg = cfg.heatmap ?? {};
const radarCfg = { ...CONFIG.radar, ...(cfg.radar ?? {}) };

/* ==================== 🔒 哈希工具函数 ==================== */

// 哈希缓存
const hashCache = new Map();

/**
 * 🔒 生成文件路径的 SHA-256 短哈希（16字符）
 * @param {string} path - 文件路径
 * @returns {Promise<string>} 16字符的十六进制哈希值
 */
const hashPath = async (path) => {
  // 缓存检查
  if (CONFIG.enableHashCache && hashCache.has(path)) {
    return hashCache.get(path);
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(path);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  // 只取前8字节（16个十六进制字符）
  const shortHash = hashArray
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // 缓存结果
  if (CONFIG.enableHashCache) {
    hashCache.set(path, shortHash);
  }
  
  return shortHash;
};

/**
 * 🔒 验证字符串是否为哈希格式
 * @param {string} str - 待验证的字符串
 * @returns {boolean}
 */
const isHashFormat = (str) => {
  return /^[a-f0-9]{16}$/.test(str);
};

/* ==================== 工具函数 ==================== */

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

/**
 * 验证路径是否仍然存在
 */
const validatePath = (path) => {
  const file = app.vault.getAbstractFileByPath(path);
  return file !== null && file !== undefined;
};

/* ==================== 🆕 哈希记录模式 - data.json 操作 ==================== */

/**
 * 读取历史数据文件 (哈希数组格式)
 */
const readDataFile = async () => {
  try {
    const file = app.vault.getAbstractFileByPath(CONFIG.dataFile);
    if (!file) {
      if (CONFIG.debug) console.log('📂 数据文件不存在');
      return null;
    }
    
    const content = await app.vault.read(file);
    const data = JSON.parse(content);
    
    // 初始化数据结构
    if (!data.dailyEdits) data.dailyEdits = {};
    if (!data.version) data.version = 7;
    
    // 验证数据格式: 确保每个日期对应的是数组
    for (const [date, value] of Object.entries(data.dailyEdits)) {
      if (!Array.isArray(value)) {
        console.warn(`⚠️ 数据格式错误: ${date} 不是数组,已重置`);
        data.dailyEdits[date] = [];
      }
    }
    
    if (CONFIG.debug) {
      const totalDays = Object.keys(data.dailyEdits).length;
      const totalFiles = Object.values(data.dailyEdits).reduce((sum, arr) => sum + arr.length, 0);
      console.log(`📖 读取缓存: ${totalDays} 天, ${totalFiles} 条记录`);
    }
    
    return data;
  } catch (e) {
    console.warn('⚠️ 读取数据文件失败:', e);
    return null;
  }
};

/**
 * 写入数据文件 (哈希数组格式)
 */
const writeDataFile = async (data) => {
  try {
    const dirPath = CONFIG.dataFile.substring(0, CONFIG.dataFile.lastIndexOf('/'));
    const adapter = app.vault.adapter;
    
    if (dirPath && !(await adapter.exists(dirPath))) {
      await adapter.mkdir(dirPath);
    }
    
    // 按日期倒序排序
    const sortedDailyEdits = {};
    const sortedKeys = Object.keys(data.dailyEdits).sort((a, b) => b.localeCompare(a));
    for (const key of sortedKeys) {
      // 对每个日期的哈希数组也排序
      sortedDailyEdits[key] = [...data.dailyEdits[key]].sort();
    }
    data.dailyEdits = sortedDailyEdits;
    data.lastUpdate = getCurrentTimestamp();
    data.mode = CONFIG.useHashMode ? 'hash-based' : 'path-based';
    data.version = 7;
    if (CONFIG.useHashMode) {
      data.hashAlgorithm = CONFIG.hashAlgorithm;
    }
    
    const content = JSON.stringify(data, null, 2);
    const file = app.vault.getAbstractFileByPath(CONFIG.dataFile);
    
    if (file) {
      await app.vault.modify(file, content);
    } else {
      await app.vault.create(CONFIG.dataFile, content);
    }
    
    if (CONFIG.debug) {
      const totalFiles = Object.values(data.dailyEdits).reduce((sum, arr) => sum + arr.length, 0);
      const mode = CONFIG.useHashMode ? '哈希' : '路径';
      console.log(`✅ 数据已保存(${mode}模式): ${totalFiles} 条记录 (${data.lastUpdate})`);
    }
    return true;
  } catch (e) {
    console.error('❌ 写入数据文件失败:', e);
    return false;
  }
};

/**
 * 🆕 获取所有文件的修改日期映射 (哈希模式)
 */
const getAllFilesDateMap = async () => {
  const dateMap = {}; // { date: Set<hash> }
  const files = app.vault.getMarkdownFiles();
  
  for (const file of files) {
    if (shouldIgnore(file.path)) continue;
    
    const modDate = new Date(file.stat.mtime);
    const modDateStr = formatDate(modDate);
    
    if (!dateMap[modDateStr]) {
      dateMap[modDateStr] = new Set();
    }
    
    // 🔒 使用哈希而非原始路径
    if (CONFIG.useHashMode) {
      const hash = await hashPath(file.path);
      dateMap[modDateStr].add(hash);
    } else {
      dateMap[modDateStr].add(file.path);
    }
  }
  
  return dateMap;
};

/**
 * 🆕 增量检测：只记录今天修改过的文件（累加式）
 * 
 * 核心逻辑：
 * 1. 检查每个文件今天是否被修改过（通过 mtime 判断）
 * 2. 如果今天修改过，将其哈希添加到今天的记录中
 * 3. 不影响历史记录（昨天的记录永久保留）
 */
const getTodayModifiedFiles = async () => {
  const today = getTodayString();
  const todayStart = new Date(today + ' 00:00:00');
  const todayEnd = new Date(today + ' 23:59:59');
  
  const todayHashes = new Set();
  const files = app.vault.getMarkdownFiles();
  
  for (const file of files) {
    if (shouldIgnore(file.path)) continue;
    
    const mtime = new Date(file.stat.mtime);
    
    // 只统计今天修改的文件
    if (mtime >= todayStart && mtime <= todayEnd) {
      if (CONFIG.useHashMode) {
        const hash = await hashPath(file.path);
        todayHashes.add(hash);
      } else {
        todayHashes.add(file.path);
      }
    }
  }
  
  if (CONFIG.debug && todayHashes.size > 0) {
    console.log(`📝 今天修改了 ${todayHashes.size} 个文件`);
  }
  
  return todayHashes;
};

/**
 * 🆕 全量扫描所有文件并构建哈希记录
 */
const fullScanAllFiles = async () => {
  if (CONFIG.debug) console.log('🔍 开始全量扫描(哈希记录模式)...');
  
  const data = { 
    dailyEdits: {},
    lastFullScan: getTodayString(),
    version: 7,
    mode: CONFIG.useHashMode ? 'hash-based' : 'path-based',
    hashAlgorithm: CONFIG.useHashMode ? CONFIG.hashAlgorithm : undefined
  };
  
  const dateMap = await getAllFilesDateMap();
  
  // 转换 Set 为 Array
  for (const [date, hashSet] of Object.entries(dateMap)) {
    data.dailyEdits[date] = Array.from(hashSet);
  }
  
  if (CONFIG.debug) {
    const totalDays = Object.keys(data.dailyEdits).length;
    const totalFiles = Object.values(data.dailyEdits).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`✅ 全量扫描完成: ${totalDays} 天, ${totalFiles} 条记录`);
  }
  
  return data;
};

/**
 * 🆕 验证哈希是否对应存在的文件
 */
const validateHash = async (hash) => {
  const files = app.vault.getMarkdownFiles();
  
  for (const file of files) {
    if (shouldIgnore(file.path)) continue;
    const fileHash = await hashPath(file.path);
    if (fileHash === hash) {
      return true;
    }
  }
  
  return false;
};

/**
 * 🆕 验证路径或哈希（兼容模式）
 */
const validatePathOrHash = async (pathOrHash) => {
  // 判断是哈希还是路径
  if (CONFIG.useHashMode && isHashFormat(pathOrHash)) {
    return await validateHash(pathOrHash);
  } else {
    // 兼容旧版本的路径格式
    return validatePath(pathOrHash);
  }
};

/**
 * 🆕 智能合并策略: 使用 Set 去重 + 删除无效哈希
 */
const mergeDataSafely = async (localData, remoteData) => {
  const merged = { ...localData };
  
  // 获取所有日期
  const allDates = new Set([
    ...Object.keys(localData.dailyEdits || {}),
    ...Object.keys(remoteData.dailyEdits || {})
  ]);
  
  merged.dailyEdits = {};
  let removedCount = 0;
  
  for (const date of allDates) {
    const localItems = localData.dailyEdits?.[date] || [];
    const remoteItems = remoteData.dailyEdits?.[date] || [];
    
    // 使用 Set 自动去重
    const mergedItems = new Set([...localItems, ...remoteItems]);
    
    // ✅ 过滤掉已删除的文件
    const validItems = [];
    for (const item of mergedItems) {
      const isValid = await validatePathOrHash(item);
      if (isValid) {
        validItems.push(item);
      } else {
        removedCount++;
      }
    }
    
    // 只保留有文件的日期
    if (validItems.length > 0) {
      merged.dailyEdits[date] = validItems;
    }
  }
  
  if (CONFIG.debug) {
    const localTotal = Object.values(localData.dailyEdits || {}).reduce((s, a) => s + a.length, 0);
    const remoteTotal = Object.values(remoteData.dailyEdits || {}).reduce((s, a) => s + a.length, 0);
    const mergedTotal = Object.values(merged.dailyEdits).reduce((s, a) => s + a.length, 0);
    const mode = CONFIG.useHashMode ? '哈希' : '路径';
    console.log(`🔄 数据合并(${mode}模式): 本地=${localTotal}, 远程=${remoteTotal}, 合并后=${mergedTotal}, 已清理=${removedCount}`);
  }
  
  return merged;
};


/**
 * 🆕 哈希记录模式: 累加式数据维护（修复版）
 * 
 * 修复说明：
 * - 旧版本问题：使用 mtime 替换式扫描，导致历史记录丢失
 * - 新版本逻辑：只检测今天的增量修改，累加到历史记录中
 * - 多设备安全：合并时保留所有历史 + 今天的新增记录
 */
const loadHashBasedModeData = async () => {
  const today = getTodayString();
  
  // 1. 读取历史缓存数据
  let data = await readDataFile();
  
  if (!data) {
    // 首次运行：全量扫描建立初始数据
    if (CONFIG.debug) console.log('📂 data.json 不存在,执行全量扫描');
    data = await fullScanAllFiles();
    await writeDataFile(data);
  } else {
    // 2. 增量更新：只检测今天修改的文件
    const todayModified = await getTodayModifiedFiles();
    
    // 3. 多设备合并：读取可能被其他设备更新的远程数据
    const latestRemoteData = await readDataFile();
    
    if (latestRemoteData) {
      // 🔑 关键修复：保留远程的所有历史记录
      data = { ...latestRemoteData };
      
      // 确保数据结构完整
      if (!data.dailyEdits) data.dailyEdits = {};
      if (!data.dailyEdits[today]) data.dailyEdits[today] = [];
      
      // 4. 累加今天的本地修改（去重）
      const existingTodaySet = new Set(data.dailyEdits[today]);
      for (const hash of todayModified) {
        existingTodaySet.add(hash);
      }
      data.dailyEdits[today] = Array.from(existingTodaySet);
      
      if (CONFIG.debug) {
        const historyDays = Object.keys(data.dailyEdits).filter(d => d !== today).length;
        const historyFiles = Object.entries(data.dailyEdits)
          .filter(([d]) => d !== today)
          .reduce((sum, [, arr]) => sum + arr.length, 0);
        console.log(`📚 保留历史: ${historyDays} 天, ${historyFiles} 条记录`);
        console.log(`📝 今天新增: ${todayModified.size} 个文件`);
      }
    } else {
      // 读取失败的兜底：至少保存今天的数据
      if (!data.dailyEdits) data.dailyEdits = {};
      if (!data.dailyEdits[today]) data.dailyEdits[today] = [];
      
      const existingTodaySet = new Set(data.dailyEdits[today]);
      for (const hash of todayModified) {
        existingTodaySet.add(hash);
      }
      data.dailyEdits[today] = Array.from(existingTodaySet);
    }
  }
  
  // 5. 异步保存(不阻塞显示)
  (async () => {
    try {
      await writeDataFile(data);
      if (CONFIG.debug) console.log('💾 数据已更新');
    } catch (e) {
      console.warn('⚠️ 后台保存失败:', e);
    }
  })();
  
  // 6. 转换为数量格式供热力图使用
  const countData = {};
  for (const [date, hashes] of Object.entries(data.dailyEdits)) {
    countData[date] = hashes.length;
  }
  
  return countData;
};


/* ==================== Dataview 实时统计模式 ==================== */

/**
 * 获取所有笔记(应用忽略规则)
 */
const getAllNotes = () => {
  return dv.pages().filter(p => {
    if (p.file.ext !== 'md') return false;
    return !shouldIgnore(p.file.path);
  });
};

/**
 * cday 模式:笔记创建日期统计
 */
const getCdayData = () => {
  const data = {};
  const notes = getAllNotes();
  
  notes.forEach(p => {
    try {
      const dateStr = dv.func.dateformat(p.file.cday, 'yyyy-MM-dd');
      if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return;
      data[dateStr] = data[dateStr] ? data[dateStr] + 1 : 1;
    } catch (e) {
      // 忽略格式错误的数据
    }
  });
  
  if (CONFIG.debug) {
    console.log('📅 cday 统计完成:', {
      总天数: Object.keys(data).length,
      总计数: Object.values(data).reduce((a, b) => a + b, 0)
    });
  }
  
  return data;
};

/**
 * mday 模式:笔记修改日期统计
 */
const getMdayData = () => {
  const data = {};
  const notes = getAllNotes();
  
  notes.forEach(p => {
    try {
      const dateStr = dv.func.dateformat(p.file.mday, 'yyyy-MM-dd');
      if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return;
      data[dateStr] = data[dateStr] ? data[dateStr] + 1 : 1;
    } catch (e) {
      // 忽略格式错误的数据
    }
  });
  
  if (CONFIG.debug) {
    console.log('📝 mday 统计完成:', {
      总天数: Object.keys(data).length,
      总计数: Object.values(data).reduce((a, b) => a + b, 0)
    });
  }
  
  return data;
};

/* ==================== 热力图数据加载 ==================== */

/**
 * 根据配置加载热力图数据
 */
const loadHeatmapData = async () => {
  const type = (heatmapCfg.type || '').trim();
  
  // 📄 后台任务: 无论什么模式,都在后台维护 data.json (累加式记录)
  // 即使用户使用 cday/mday 模式,后台也会维护 default 模式的数据
  // 这样切换模式时不会丢失历史记录
  (async () => {
    try {
      const today = getTodayString();
      let data = await readDataFile();
      
      if (!data) {
        // 首次运行: 全量扫描
        if (CONFIG.debug) console.log('[后台] 初始化数据文件');
        data = await fullScanAllFiles();
        await writeDataFile(data);
      } else {
        // 🔑 后台也使用累加式更新
        const todayModified = await getTodayModifiedFiles();
        const latestRemoteData = await readDataFile();
        
        if (latestRemoteData) {
          // 保留所有历史记录
          data = { ...latestRemoteData };
          if (!data.dailyEdits) data.dailyEdits = {};
          if (!data.dailyEdits[today]) data.dailyEdits[today] = [];
          
          // 累加今天的修改
          const existingTodaySet = new Set(data.dailyEdits[today]);
          for (const hash of todayModified) {
            existingTodaySet.add(hash);
          }
          data.dailyEdits[today] = Array.from(existingTodaySet);
        } else {
          // 兜底逻辑
          if (!data.dailyEdits) data.dailyEdits = {};
          if (!data.dailyEdits[today]) data.dailyEdits[today] = [];
          const existingTodaySet = new Set(data.dailyEdits[today]);
          for (const hash of todayModified) {
            existingTodaySet.add(hash);
          }
          data.dailyEdits[today] = Array.from(existingTodaySet);
        }
        
        await writeDataFile(data);
        if (CONFIG.debug) console.log('[后台] data.json 已更新(累加式)');
      }
    } catch (e) {
      console.warn('[后台] 更新失败:', e);
    }
  })();
  
  // 📊 前台显示: 根据用户选择的模式返回数据
  if (!type || type === 'default') {
    if (CONFIG.debug) console.log('🔍 使用哈希记录模式 (绝对准确)');
    return await loadHashBasedModeData();
  } else if (type === 'cday') {
    if (CONFIG.debug) console.log('📅 使用 cday 模式 (笔记创建日期)');
    return getCdayData();
  } else if (type === 'mday') {
    if (CONFIG.debug) console.log('📝 使用 mday 模式 (笔记修改日期)');
    return getMdayData();
  } else {
    console.warn(`⚠️ 未知的热力图类型: ${type},使用哈希记录模式`);
    return await loadHashBasedModeData();
  }
};


/* ---------- 布局容器 ---------- */
const root = dv.el("div", "", {cls:"heatmap-radar-combined"});
Object.assign(root.style, {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "15px",
  padding: "10px 0 10px 10px",
  color: "#e2e8f0",
  fontFamily: "'JetBrains Mono',ui-monospace,Consolas",
  fontSize: "14px",
  overflow: "visible",
  width: "100%",
  boxSizing: "border-box"
});

/* ==================== 左侧:热力图 ==================== */
const heatmapWrap = document.createElement("div");
Object.assign(heatmapWrap.style, {
  flex: "1 1 auto",
  minWidth: "0",
  overflow: "visible",
  display: "flex",
  justifyContent: "flex-end",
  padding: "1px 1px"
});
root.appendChild(heatmapWrap);

// --- 加载热力图数据 ---
const heatData = await loadHeatmapData();

// --- 热力图渲染(2年) ---
const today = new Date();
const daylong = 24 * 60 * 60 * 1000;
const startDay = today - (today.getDay() + 104 * 7) * daylong;

const dbNum = num => (num > 9 ? String(num) : '0' + num);
const levelGetter = (count) => count < 5 ? count : 5;

let heatmapCode = `
<style>
.dms-heatmap {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  width: 100%;
  overflow: visible;
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
  top: -30px;
  left: 50%;
  transform: translate(-50%, 0);
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

const addDay = (className, tipLabel) => {
  heatmapCode += `<div class="${className.join(' ')}" ${tipLabel}>
    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC">
  </div>`;
};

for (let weekIndex = 0; weekIndex < 105; weekIndex++) {
  if (startDay + dayCount * daylong > today) break;
  heatmapCode += `<div class="dms-heatmap-weekrow">`;
  for (let d = 0; d < 7; d++) {
    const theDay = new Date(startDay + dayCount * daylong);
    const year = theDay.getFullYear();
    const month = dbNum(theDay.getMonth() + 1);
    const day = dbNum(theDay.getDate());
    const theDayStr = `${year}-${month}-${day}`;
    if (day === '01') heatmapCode += `<div class="dms-heatmap-month">${month}</div>`;
    const level = levelGetter(heatData[theDayStr] ?? 0);
    const className = ['dms-heatmap-day', 'dms-heatmap-level-' + level];
    const future = dayCount > 729 && (theDay - today) >= daylong - 1;
    if (future) className.push('dms-heatmap-future-day');
    const tipLabel = !future ? `aria-label="${(level ? heatData[theDayStr] + ' ' : '') + theDayStr}"` : '';
    addDay(className, tipLabel);
    dayCount++;
  }
  heatmapCode += `</div>`;
}

heatmapCode += `<div class="dms-heatmap-weekrow">`;
const weekname = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
for (let d = 0; d < 7; d++) {
  const className = ['dms-heatmap-day', 'dms-heatmap-weekday-mark', `dms-heatmap-weekday-${d}`];
  const tipLabel = `aria-label="${weekname[d]}"`;
  addDay(className, tipLabel);
}
heatmapCode += `</div></div>`;

heatmapCode += `<div class="dms-heatmap-mark-show">Low `;
for (let d = 0; d < 6; d++) {
  const className = ['dms-heatmap-day', 'dms-heatmap-level-mark', `dms-heatmap-level-${d}`];
  const tipLabel = `aria-label="level-${d}"`;
  addDay(className, tipLabel);
}
heatmapCode += ` High</div>`;

const heatmapContainer = document.createElement('div');
heatmapContainer.className = "dms-heatmap-container";
const heatmapShadow = heatmapContainer.attachShadow({mode: 'open'});
heatmapShadow.innerHTML = heatmapCode;
heatmapWrap.appendChild(heatmapContainer);

/* ==================== 右侧:雷达图(优化版) ==================== */
const radarWrap = document.createElement("div");
Object.assign(radarWrap.style, {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingRight: "0"
});
root.appendChild(radarWrap);

// --- 工具函数:路径标准化 ---
function normalizePath(path) {
  if (!path) return '';
  return path.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
}

// --- 工具函数:判断子文件夹关系 ---
function isSubFolder(childPath, parentPath) {
  const child = normalizePath(childPath);
  const parent = normalizePath(parentPath);
  
  if (!child || !parent || child === parent) return false;
  return child.startsWith(parent + '/');
}

// --- 性能优化:预处理文件夹配置(按深度排序) ---
const sortedFolders = categories
  .flatMap(cat => (cat.folders || []).map(f => ({
    folder: normalizePath(f),
    category: cat.name,
    depth: f.split('/').filter(s => s).length
  })))
  .sort((a, b) => b.depth - a.depth);

// --- 构建文件归属关系(每个文件只属于一个最深的文件夹) ---
const fileOwnership = new Map();

sortedFolders.forEach(({ folder, category }) => {
  const pagesInFolder = dv.pages(`"${folder}"`).filter(p => p.file.ext === 'md');
  
  if (pagesInFolder.length === 0) {
    console.warn(`⚠️ 文件夹 "${folder}" 中没有找到 md 文件(角度: ${category})`);
  }
  
  pagesInFolder.forEach(page => {
    const pagePath = normalizePath(page.file.path);
    
    if (!fileOwnership.has(pagePath)) {
      fileOwnership.set(pagePath, category);
    }
  });
});

// --- 统计数据(优化版) ---
const radarData = categories.map((cat, index) => {
  const countedPages = new Set();
  const folderFiles = new Set();
  const tagFiles = new Set();
  
  // === 1. 处理文件夹配置 ===
  for (const [filePath, owner] of fileOwnership.entries()) {
    if (owner === cat.name) {
      countedPages.add(filePath);
      folderFiles.add(filePath);
    }
  }
  
  // === 2. 处理标签配置 ===
  if (cat.tags && Array.isArray(cat.tags)) {
    cat.tags.forEach(tag => {
      const pages = dv.pages(`#${tag}`);
      pages.forEach(page => {
        const pagePath = normalizePath(page.file.path);
        countedPages.add(pagePath);
        tagFiles.add(pagePath);
      });
    });
  }
  
  // === 3. 计算显示数量 ===
  const totalCount = countedPages.size;
  const folderCount = folderFiles.size;
  const tagCount = tagFiles.size;
  
  let overlapCount = 0;
  for (const filePath of tagFiles) {
    if (folderFiles.has(filePath)) {
      overlapCount++;
    }
  }
  
  let displayFolderCount = folderCount;
  let displayTagCount = tagCount;
  
  if (folderCount > 0 && tagCount > 0) {
    const sum = folderCount + tagCount - overlapCount;
    if (sum === totalCount) {
      displayFolderCount = folderCount - overlapCount;
      displayTagCount = totalCount - displayFolderCount;
    } else {
      const ratio = folderCount / (folderCount + tagCount);
      displayFolderCount = Math.round(totalCount * ratio);
      displayTagCount = totalCount - displayFolderCount;
    }
  } else if (folderCount > 0) {
    displayFolderCount = totalCount;
    displayTagCount = 0;
  } else if (tagCount > 0) {
    displayFolderCount = 0;
    displayTagCount = totalCount;
  }
  
  return {
    dimension: cat.name,
    count: countedPages.size,
    tags: cat.tags || [],
    folders: cat.folders || [],
    color: cat.color || CONFIG.defaultColors[index % CONFIG.defaultColors.length],
    stats: {
      fromFolders: displayFolderCount,
      fromTags: displayTagCount,
      overlap: overlapCount,
      total: countedPages.size
    }
  };
});

const maxCount = Math.max(...radarData.map(d => d.count), 5);

const width = radarCfg.size ?? CONFIG.radar.size;
const height = width;
const centerX = width / 2;
const centerY = height / 2;
const radius = radarCfg.radius ?? CONFIG.radar.radius;
const levels = radarCfg.levels ?? CONFIG.radar.levels;
const fontSize = radarCfg.fontSize ?? CONFIG.radar.fontSize;
const showLabels = radarCfg.showLabels ?? CONFIG.radar.showLabels;

// --- 检测主题 ---
const isDarkTheme = document.body.classList.contains('theme-dark');
const textColor = isDarkTheme ? '#ffffff' : '#333333';
const gridColor = isDarkTheme ? '#d0d0d0' : '#999999';

// --- 计算点坐标 ---
function getPoint(index, value, total) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / maxCount) * radius;
  return {
    x: centerX + r * Math.cos(angle),
    y: centerY + r * Math.sin(angle)
  };
}

// --- 创建雷达图容器 ---
const radarContainer = document.createElement("div");
radarContainer.className = "radar-chart-container";
Object.assign(radarContainer.style, {
  position: "relative",
  width: `${width}px`,
  height: `${height}px`,
  margin: "0 auto"
});
radarWrap.appendChild(radarContainer);

// --- 创建SVG ---
const ns = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(ns, "svg");
svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
Object.assign(svg.style, {
  width: "100%",
  height: "100%",
  display: "block",
  background: "transparent"
});
radarContainer.appendChild(svg);

// --- 背景网格 ---
for (let i = 1; i <= levels; i++) {
  const points = [];
  for (let j = 0; j < radarData.length; j++) {
    const point = getPoint(j, maxCount * (i / levels), radarData.length);
    points.push(`${point.x},${point.y}`);
  }
  const polygon = document.createElementNS(ns, "polygon");
  polygon.setAttribute("points", points.join(' '));
  polygon.setAttribute("fill", "none");
  polygon.setAttribute("stroke", gridColor);
  polygon.setAttribute("stroke-width", "1");
  polygon.setAttribute("stroke-opacity", "0.3");
  svg.appendChild(polygon);
}

// --- 轴线 ---
for (let i = 0; i < radarData.length; i++) {
  const point = getPoint(i, maxCount, radarData.length);
  const line = document.createElementNS(ns, "line");
  line.setAttribute("x1", centerX);
  line.setAttribute("y1", centerY);
  line.setAttribute("x2", point.x);
  line.setAttribute("y2", point.y);
  line.setAttribute("stroke", gridColor);
  line.setAttribute("stroke-width", "1");
  line.setAttribute("stroke-opacity", "0.3");
  svg.appendChild(line);
}

// --- 数据多边形 ---
const polygonPoints = radarData.map((d, i) => getPoint(i, d.count, radarData.length));
const dataPolygon = document.createElementNS(ns, "polygon");
dataPolygon.setAttribute("points", polygonPoints.map(p => `${p.x},${p.y}`).join(' '));
dataPolygon.setAttribute("fill", "rgba(255, 152, 0, 0.25)");
dataPolygon.setAttribute("stroke", "#ff9800");
dataPolygon.setAttribute("stroke-width", "2.5");
svg.appendChild(dataPolygon);

// --- Lucide 图标 SVG 路径 ---
const lucideIcons = {
  folders: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M2 10h20"/>',
  tags: '<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/><path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l4.59-4.59a2.426 2.426 0 0 0 0-3.42z"/><circle cx="6.5" cy="9.5" r=".5" fill="currentColor"/>',
  repeat: '<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>'
};

// --- Tooltip ---
const tip = document.createElement("div");
Object.assign(tip.style, {
  position: "absolute",
  display: "none",
  pointerEvents: "none",
  zIndex: "1000",
  background: "rgba(51, 51, 54, 0.85)",
  color: "#CCCCCE",
  padding: "12px 16px",
  borderRadius: "8px",
  fontSize: `${Math.max(12, fontSize - 2)}px`,
  lineHeight: "1.6",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  backdropFilter: "blur(10px)",
  fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace",
  maxWidth: "280px",
  transition: "opacity 0.15s ease-out",
  opacity: "0"
});
radarContainer.appendChild(tip);

const placeTip = (evt) => {
  const rect = radarContainer.getBoundingClientRect();
  const clientX = evt.clientX ?? (evt.pageX - window.scrollX);
  const clientY = evt.clientY ?? (evt.pageY - window.scrollY);
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  
  requestAnimationFrame(() => {
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const offset = 15;
    const margin = 10;
    
    let left = x + offset;
    let top = y + offset;
    
    if (left + tw + margin > width) {
      left = x - tw - offset;
    }
    
    if (top + th + margin > height) {
      top = y - th - offset;
    }
    
    if (left < margin) {
      left = x + offset;
      if (left + tw + margin > width) {
        left = width - tw - margin;
      }
    }
    
    if (top < margin) {
      top = y + offset;
      if (top + th + margin > height) {
        top = height - th - margin;
      }
    }
    
    left = Math.max(margin, Math.min(left, width - tw - margin));
    top = Math.max(margin, Math.min(top, height - th - margin));
    
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });
};

// --- 标签(可选显示) ---
if (showLabels) {
  for (let i = 0; i < radarData.length; i++) {
    const t = radarData[i];
    const angle = (Math.PI * 2 * i) / radarData.length - Math.PI / 2;
    const labelDist = radius + 40;
    const labelX = centerX + labelDist * Math.cos(angle);
    const labelY = centerY + labelDist * Math.sin(angle);
    
    let anchor = 'middle';
    if (Math.abs(Math.cos(angle)) > 0.3) {
      anchor = Math.cos(angle) > 0 ? 'start' : 'end';
    }
    
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", labelX);
    label.setAttribute("y", labelY);
    label.setAttribute("text-anchor", anchor);
    label.setAttribute("font-size", fontSize);
    label.setAttribute("fill", textColor);
    label.setAttribute("font-weight", "600");
    label.textContent = t.dimension;
    svg.appendChild(label);
  }
}

// --- 交互 ---
const interactionArea = document.createElementNS(ns, "circle");
interactionArea.setAttribute("cx", centerX);
interactionArea.setAttribute("cy", centerY);
interactionArea.setAttribute("r", radius + 20);
interactionArea.setAttribute("fill", "transparent");
interactionArea.style.cursor = "pointer";
svg.appendChild(interactionArea);

let currentIndex = -1;

const updateTooltip = (e) => {
  const rect = radarContainer.getBoundingClientRect();
  const clientX = e.clientX ?? (e.pageX - window.scrollX);
  const clientY = e.clientY ?? (e.pageY - window.scrollY);
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;
  
  let minDist = Infinity;
  let closestIndex = -1;
  
  for (let i = 0; i < polygonPoints.length; i++) {
    const point = polygonPoints[i];
    const dist = Math.sqrt(
      Math.pow(mouseX - point.x, 2) + 
      Math.pow(mouseY - point.y, 2)
    );
    
    if (dist < minDist) {
      minDist = dist;
      closestIndex = i;
    }
  }
  
  if (closestIndex !== currentIndex && closestIndex !== -1) {
    currentIndex = closestIndex;
    const t = radarData[closestIndex];
    
    const statsHTML = t.stats ? `
      <div style="font-size:11px;color:#999;margin-top:8px;border-top:1px solid #444;padding-top:8px;display:flex;gap:12px;align-items:center;">
        <span style="display:flex;align-items:center;gap:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${lucideIcons.folders}
          </svg>
          ${t.stats.fromFolders}
        </span>
        <span style="display:flex;align-items:center;gap:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${lucideIcons.tags}
          </svg>
          ${t.stats.fromTags}
        </span>
        <span style="display:flex;align-items:center;gap:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${lucideIcons.repeat}
          </svg>
          ${t.stats.overlap}
        </span>
      </div>` : '';
    
    tip.innerHTML = `
      <div style="font-weight:600;font-size:${fontSize}px;margin-bottom:4px;white-space:nowrap;">
        ${t.dimension} <span style="color:${t.color};margin-left:8px;font-weight:700;">${t.count}</span>
      </div>
      ${statsHTML}
    `;
    
    if (tip.style.display !== "block") {
      tip.style.display = "block";
      tip.style.opacity = "1";
    }
  }
  
  placeTip(e);
};

const showTooltip = (e) => updateTooltip(e);

const hideTooltip = () => {
  currentIndex = -1;
  tip.style.opacity = "0";
  setTimeout(() => tip.style.display = "none", 150);
};

interactionArea.addEventListener("mouseenter", showTooltip);
interactionArea.addEventListener("mousemove", updateTooltip);
interactionArea.addEventListener("mouseleave", hideTooltip);
interactionArea.addEventListener("touchstart", (e) => {
  e.preventDefault();
  showTooltip(e.touches[0]);
}, {passive: false});
interactionArea.addEventListener("touchmove", (e) => updateTooltip(e.touches[0]), {passive: true});
interactionArea.addEventListener("touchend", hideTooltip, {passive: true});

// --- 样式 ---
const style = document.createElement("style");
style.textContent = `
.heatmap-radar-combined { 
  user-select: none; 
  overflow: visible !important;
  min-height: fit-content;
}
.radar-chart-container { 
  user-select: none; 
  overflow: visible !important;
}
.dms-heatmap-container {
  overflow: visible !important;
}
`;
root.appendChild(style);