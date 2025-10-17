/**
 * ============================================================================
 * HeatmapRadarCombined.js —— 热力图 + 雷达图组合视图(优化版)
 * ============================================================================
 * 使用说明:
 * ```dataviewjs
 * await dv.view("Matrix", {
 *   heatmap: {
 *     type: "mday"  // 必填:'cday' | 'mday' | 'created' | 'updated' | 'name' | 'task'
 *   },
 *   radar: {
 *     categories: [  // 必填:雷达图分类配置
 *       { 
 *         name: "Red Team", 
 *         tags: ["RedTeam", "Offensive"],  // 可选
 *         folders: ["渗透测试笔记"],        // 可选
 *         color: "#ef4444" 
 *       },
 *       { 
 *         name: "Code Review", 
 *         folders: ["渗透测试笔记/代码审计"],  // 子文件夹优先级更高
 *         color: "#8b5cf6" 
 *       },
 *       { 
 *         name: "Blue Team", 
 *         tags: ["Defensive", "日志"],
 *         folders: ["安全运营"],
 *         color: "#10b981" 
 *       }
 *     ]
 *   }
 * })
 * ```
 * 
 * 文件夹配置规则:
 * - folders: 字符串数组,支持相对路径(从库根目录开始)
 * - 子文件夹优先:如果某个子文件夹被其他角配置,则从父文件夹统计中排除
 * - 文件夹和标签可以同时配置,也可以二选一
 * - 统计结果会自动去重(同一文件不会被重复计数)
 * 
 * 可选参数(会覆盖下方CONFIG中的默认值):
 * - radar.size: 雷达图大小(默认 200)
 * - radar.radius: 雷达图半径(默认 100)
 * - radar.showLabels: 是否显示标签(默认 false)
 * - radar.levels: 网格层数(默认 5)
 * - radar.fontSize: 字体大小(默认 12)
 * ============================================================================
 */

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║                     配置区域 - 固定配置项(不常修改)                   ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */

const CONFIG = {
  
  /* ===== 雷达图视觉配置 ===== */
  radar: {
    size: 205,           // 图表大小(像素;推荐范围 150-300)
    radius: 100,         // 半径(像素;推荐为 size 的一半左右)
    showLabels: false,   // 是否显示维度标签(true/false)
    levels: 5,           // 网格层数(推荐 3-7)
    fontSize: 12         // 字体大小(像素)
  },
  
  /* ===== 默认颜色池 ===== */
  defaultColors: [
    "#ef4444", "#f59e0b", "#10b981", "#3b82f6", 
    "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
  ]
};

/* ╔═══════════════════════════════════════════════════════════════════════╗
   ║                    主程序代码 - 请勿修改                              ║
   ╚═══════════════════════════════════════════════════════════════════════╝ */

// --- 获取用户输入配置 ---
const cfg = input ?? {};

// ⚠️ 必填参数检查
if (!cfg.heatmap || !cfg.heatmap.type) {
  throw new Error("⌧ 缺少必填参数:heatmap.type(热力图数据类型),请在调用时传入,例如:heatmap: { type: 'mday' }");
}

if (!cfg.radar || !Array.isArray(cfg.radar.categories) || cfg.radar.categories.length === 0) {
  throw new Error("⌧ 缺少必填参数:radar.categories(雷达图分类配置),请在调用时传入至少一个分类");
}

// --- 配置验证 ---
const categories = cfg.radar.categories;
categories.forEach((cat, index) => {
  if (!cat.name) {
    throw new Error(`⌧ 分类 [${index}] 缺少 name 属性`);
  }
  
  if (!cat.tags && !cat.folders) {
    console.warn(`⚠️ 角度 "${cat.name}" 既没有配置 tags 也没有配置 folders,将不会统计到任何文件`);
  }
  
  if (cat.folders && !Array.isArray(cat.folders)) {
    throw new Error(`⌧ 角度 "${cat.name}" 的 folders 必须是数组`);
  }
  
  if (cat.tags && !Array.isArray(cat.tags)) {
    throw new Error(`⌧ 角度 "${cat.name}" 的 tags 必须是数组`);
  }
});

// --- 合并配置 ---
const heatmapCfg = cfg.heatmap;
const radarCfg = { ...CONFIG.radar, ...(cfg.radar ?? {}) };

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

// --- 热力图数据处理 ---
const allNotes = dv.pages().filter(p => p.file.ext === 'md');
const addOne = () => 1;

const defaultMethods = {
  cday: {
    source: allNotes,
    getDate: p => dv.func.dateformat(p.file.cday, 'yyyy-MM-dd'),
    getValue: addOne
  },
  mday: {
    source: allNotes,
    getDate: p => dv.func.dateformat(p.file.mday, 'yyyy-MM-dd'),
    getValue: addOne
  },
  created: {
    source: allNotes,
    getDate: p => String(p.file.frontmatter.created).replace(/\s.*$/, ''),
    getValue: addOne
  },
  updated: {
    source: allNotes,
    getDate: p => String(p.file.frontmatter.updated).replace(/\s.*$/, ''),
    getValue: addOne
  },
  name: {
    source: allNotes,
    getDate: p => p.file.name,
    getValue: addOne
  },
  task: {
    source: dv.pages().file.tasks.filter(t => t.completed),
    getDate: t => dv.func.dateformat(t.completion, 'yyyy-MM-dd'),
    getValue: addOne
  }
};

const getHeatInput = (key, defaultVal) => {
  return heatmapCfg && heatmapCfg[key] !== undefined ? heatmapCfg[key] : defaultVal;
};

const dataGetter = () => {
  const type = getHeatInput('type', 'cday');
  const method = defaultMethods[type] ?? defaultMethods['cday'];
  const source = getHeatInput('source', method.source);
  const getDate = getHeatInput('getDate', method.getDate);
  const getValue = getHeatInput('getValue', method.getValue);
  const data = {};
  source.forEach(p => {
    const md = getDate(p);
    const val = getValue(p);
    data[md] = data[md] ? data[md] + val : val;
  });
  return data;
};

const levelGetter = getHeatInput('levelGetter', count => count < 5 ? count : 5);
const heatData = getHeatInput('heatData', dataGetter());

// --- 热力图渲染(修改为两年)---
const today = new Date();
const daylong = 24 * 60 * 60 * 1000;
const startDay = today - (today.getDay() + 104 * 7) * daylong;  // 改为 104 周(2年)

const dbNum = num => (num > 9 ? String(num) : '0' + num);

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

for (let weekIndex = 0; weekIndex < 105; weekIndex++) {  // 改为 105 周
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
    const future = dayCount > 729 && (theDay - today) >= daylong - 1;  // 改为 730 天(2年)
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
  .sort((a, b) => b.depth - a.depth);  // 深度大的优先(子文件夹优先)

// --- 构建文件归属关系(每个文件只属于一个最深的文件夹) ---
const fileOwnership = new Map();  // filePath -> categoryName

sortedFolders.forEach(({ folder, category }) => {
  const pagesInFolder = dv.pages(`"${folder}"`).filter(p => p.file.ext === 'md');
  
  // 调试信息
  if (pagesInFolder.length === 0) {
    console.warn(`⚠️ 文件夹 "${folder}" 中没有找到 md 文件(角度: ${category})`);
  }
  
  pagesInFolder.forEach(page => {
    const pagePath = normalizePath(page.file.path);
    
    // 只有当文件未被更深的文件夹占用时,才分配给当前文件夹
    if (!fileOwnership.has(pagePath)) {
      fileOwnership.set(pagePath, category);
    }
  });
});

// --- 统计数据(优化版) ---
const radarData = categories.map((cat, index) => {
  const countedPages = new Set();
  const folderFiles = new Set();  // 专门记录来自文件夹的文件
  const tagFiles = new Set();     // 专门记录来自标签的文件
  
  // === 1. 处理文件夹配置(使用预处理的归属关系) ===
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
  
  // === 3. 计算显示数量(确保 文件夹数 + 标签数 = 总数) ===
  const totalCount = countedPages.size;
  const folderCount = folderFiles.size;
  const tagCount = tagFiles.size;
  
  // 计算重复数量(仅作为额外信息显示)
  let overlapCount = 0;
  for (const filePath of tagFiles) {
    if (folderFiles.has(filePath)) {
      overlapCount++;
    }
  }
  
  // 显示的文件夹数量和标签数量要确保相加等于总数
  // 如果只有文件夹或只有标签,直接显示
  // 如果两者都有,按比例分配
  let displayFolderCount = folderCount;
  let displayTagCount = tagCount;
  
  if (folderCount > 0 && tagCount > 0) {
    // 两者都有时,需要调整使其相加等于总数
    const sum = folderCount + tagCount - overlapCount;
    if (sum === totalCount) {
      // 如果已经相等,直接使用去重后的值
      displayFolderCount = folderCount - overlapCount;
      displayTagCount = totalCount - displayFolderCount;
    } else {
      // 按比例分配
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
      fromFolders: displayFolderCount,    // 显示的文件夹数量
      fromTags: displayTagCount,          // 显示的标签数量
      overlap: overlapCount,              // 重复数量(仅供参考)
      total: countedPages.size            // 总数(displayFolderCount + displayTagCount)
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
    
    // 构建统计详情: 使用 Lucide 图标
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