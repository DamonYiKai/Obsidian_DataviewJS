/**
 * ╭─────────────────────────────────────────────────────────────────────────╮
 * │                            Obsidian Termynal                            │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ 为 Obsidian DataviewJS 提供的动画终端                                   │
 * │ 基于 Ines Montani 的 Termynal.js (https://github.com/ines/termynal)     │
 * ╰─────────────────────────────────────────────────────────────────────────╯
 * 
 * @version     0.1.1
 * @author      MATrsx 
 * @requires    Obsidian DataviewJS
 * @license     MIT
 */

// 默认配置对象，包含所有可用选项
const DEFAULT_CONFIG = {
    title: 'Terminal',                  // 终端窗口标题
    theme: 'macos',                     // 视觉主题（macos, windows, ubuntu, light）
    startDelay: 600,                    // 动画开始前的延迟（毫秒）
    typeDelay: 90,                      // 每个字符打字间的延迟（毫秒）
    lineDelay: 1500,                    // 行与行之间的延迟（毫秒）
    cursor: '▋',                       // 光标字符
    autoStart: true,                    // 自动开始动画
    loop: false,                        // 动画结束后循环播放
    highlightSyntax: false,             // 启用语法高亮
    resizable: false,                   // 允许终端调整大小
    controlButtons: {
        speed: true,        // 速度切换按钮
        pause: true,        // 暂停/继续按钮  
        restart: true,      // 重启按钮
        copy: false,        // 复制内容按钮
        fullscreen: false   // 全屏切换按钮
    },
    defaultPrompt: '$',                 // 默认提示符字符
    defaultPromptColor: '#a2a2a2',      // 默认提示符颜色
    height: 'auto',                     // 终端高度
    width: '100%',                      // 终端宽度
    lazyLoading: false,                 // 切换延迟加载
    intersectionThreshold: 0.1,         // Intersection Observer 的阈值
    rootMargin: '50px',                 // Intersection Observer 的边距
    lines: []                           // 要动画显示的行对象数组
};

// 使用 WeakMap 的实例注册表，提供更好的性能和内存管理
const instanceRegistry = new WeakMap();

/**
 * 全局样式管理器 - 确保样式每页只初始化一次
 * 管理 CSS 注入，提高多终端实例的性能
 */
class TermynalStyleManager {
    static initialized = false;
    
    /**
     * 全局初始化样式一次
     */
    static initializeStyles() {
        if (this.initialized) return;
        
        const styleId = 'obsidian-termynal-styles-enhanced';
        if (document.getElementById(styleId)) {
            this.initialized = true;
            return;
        }
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* CSS Custom Properties (Design Tokens) */
            :root {
                --terminal-font-family: 'Roboto Mono', 'Fira Mono', Consolas, Menlo, Monaco, 'Courier New', Courier, monospace;
                --terminal-border-radius: 8px;
                --terminal-padding: 20px;
                --terminal-line-height: 1.8;
                --terminal-font-size: 14px;
                --terminal-min-height: 200px;
                --terminal-box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                --terminal-transition: all 0.2s ease;
                --terminal-button-padding: 4px 8px;
                --terminal-button-radius: 4px;
            }

            /* Main Terminal Container */
            .obsidian-termynal {
                /* Color Scheme - Default (Dark Theme) */
                --color-bg: #252a33;
                --color-text: #eee;
                --color-text-subtle: #a2a2a2;
                --color-accent: #61dafb;
                --color-error: #ff6b6b;
                --color-warning: #f4c025;
                --color-success: #51cf66;
                --color-comment: #4a968f;
                
                /* Layout */
                max-width: 100%;
                overflow-x: auto;
                background: var(--color-bg);
                color: var(--color-text);
                font-size: var(--terminal-font-size);
                font-family: var(--terminal-font-family);
                border-radius: var(--terminal-border-radius);
                padding: 75px var(--terminal-padding) var(--terminal-padding);
                position: relative;
                box-sizing: border-box;
                margin: 1em 0;
                min-height: var(--terminal-min-height);
                box-shadow: var(--terminal-box-shadow);
            }

            /* Theme Variations */
            .obsidian-termynal[data-theme="light"] {
                --color-bg: #ffffff;
                --color-text: #333333;
                --color-text-subtle: #666666;
                border: 1px solid #e0e0e0;
            }

            .obsidian-termynal[data-theme="ubuntu"] {
                --color-bg: #300a24;
                --color-text: #ffffff;
                --color-accent: #e95420;
            }

            /* Window Decorations - Base Styles */
            .obsidian-termynal::before {
                position: absolute;
                top: 15px;
                left: 15px;
                display: inline-block;
            }

            /* macOS Style Window Controls */
            .obsidian-termynal[data-ty-macos]::before {
                content: '';
                width: 15px;
                height: 15px;
                border-radius: 50%;
                background: #d9515d;
                box-shadow: 25px 0 0 #f4c025, 50px 0 0 #3ec930;
            }

            /* Windows Style Window Controls */
            .obsidian-termynal[data-ty-windows]::before {
                content: '➖ ⬜ ❌';
                top: 8px;
                right: 12px;
                left: auto;
                width: auto;
                height: 32px;
                background: linear-gradient(to right, #666 0%, #666 66%, #dc3545 66%, #dc3545 100%);
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
                font-size: 12px;
                line-height: 32px;
                letter-spacing: 8px;
            }

            /* Ubuntu Style Window Controls */
            .obsidian-termynal[data-ty-ubuntu]::before {
                content: '●';
                top: 5px;
                color: var(--color-accent);
                font-size: 20px;
            }

            /* Terminal Title Bar */
            .obsidian-termynal::after {
                content: attr(data-ty-title);
                position: absolute;
                color: var(--color-text-subtle);
                top: 12px;
                left: 0;
                width: 100%;
                text-align: center;
            }

            /* Control Buttons Container */
            .termynal-controls {
                position: absolute;
                top: 35px;
                right: 10px;
                display: flex;
                gap: 10px;
            }

            .obsidian-termynal[data-ty-windows] .termynal-controls,
            .obsidian-termynal[data-ty-macos] .termynal-controls,
            .obsidian-termynal[data-ty-ubuntu] .termynal-controls {
                top: 45px;
            }

            /* Button Styling - Common Styles */
            button[data-terminal-control],
            .termynal-start-button {
                color: #aebbff;
                background: none !important;
                border: none;
                padding: var(--terminal-button-padding) !important;
                cursor: pointer;
                box-shadow: none !important;
                border-radius: var(--terminal-button-radius);
                font-size: 11px;
                transition: var(--terminal-transition);
            }

            /* Control Button Hover Effects */
            button[data-terminal-control]:hover {
                color: #fff;
                background: rgba(255,255,255,0.1) !important;
            }

            /* Start Button Specific Styles */

            .termynal-start-button {
                display: block;
                margin: 20px auto;
                font-family: inherit;
                font-size: 14px;
                border-radius: 6px;
            }

            .termynal-start-button:hover {
                transform: translateY(-2px);
            }

            /* Progress Information Display */
            .termynal-progress-info {
                position: absolute;
                bottom: 10px;
                right: 15px;
                font-size: 11px;
                color: var(--color-text-subtle);
                display: flex;
                gap: 15px;
            }

            /* Terminal Lines - Base Styles */
            .termynal-line {
                display: block;
                line-height: var(--terminal-line-height);
                white-space: pre-wrap;
                word-wrap: break-word;
                flex: 1;
            }

            .termynal-line::before {
                content: '';
                display: inline-block;
                vertical-align: middle;
            }

            .termynal-line[data-ty="input"]::before,
            .termynal-line[data-ty-prompt]::before {
                margin-right: 0.75em;
                color: var(--color-text-subtle);
            }

            .termynal-line[data-ty-prompt-color]::before {
                color: var(--prompt-color) !important;
            }

            .termynal-line[data-ty="input"]::before {
                content: '$';
            }

            .termynal-line[data-ty-prompt]::before {
                content: attr(data-ty-prompt);
            }

            /* Zeilen-Typen */
            .termynal-line[data-ty="output"] { color: var(--color-text); }
            .termynal-line[data-ty="comment"] { color: var(--color-comment); font-style: italic; }
            .termynal-line[data-ty="error"] { color: var(--color-error); }
            .termynal-line[data-ty="warning"] { color: var(--color-warning); }
            .termynal-line[data-ty="success"] { color: var(--color-success); }

            /* Syntax Highlighting Colors */
            .keyword { color: #ff79c6; font-weight: bold; }
            .string { color: #f1fa8c; }
            .comment { color: #6272a4; font-style: italic; }
            .number { color: #bd93f9; }

            /* Animated Cursor */
            .termynal-cursor::after {
                content: '▋';
                font-family: monospace;
                margin-left: 0.2em;
                animation: termynal-blink 1s infinite;
                color: var(--color-accent);
            }

            /* Cursor Blink Animation */
            @keyframes termynal-blink {
                50% { opacity: 0; }
            }

            /* 通知消息s */
            .termynal-notification {
                position: absolute;
                bottom: 50px;
                right: 15px;
                background: var(--color-success);
                color: var(--color-bg);
                padding: 8px 12px;
                border-radius: var(--terminal-button-radius);
                font-size: 12px;
                animation: slideInOut 3s ease-in-out;
            }

            /* Notification Slide Animation */
            @keyframes slideInOut {
                0%, 100% { opacity: 0; transform: translateX(100%); }
                10%, 90% { opacity: 1; transform: translateX(0); }
            }

            /* Fullscreen Mode */
            .obsidian-termynal:fullscreen {
                padding: 100px 40px 40px;
                font-size: 16px;
            }

            /* Lazy Loading Components */
            .termynal-lazy-placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: var(--terminal-min-height);
                background: var(--color-bg);
                border-radius: var(--terminal-border-radius);
                border: 2px dashed var(--color-text-subtle);
                opacity: 0.8;
                transition: all 0.3s ease;
            }

            .termynal-lazy-placeholder:hover {
                opacity: 1;
                border-color: var(--color-accent);
            }

            /* Lazy Loading Content */
            .termynal-lazy-content {
                text-align: center;
                color: var(--color-text-subtle);
            }

            /* Lazy Loading Icon */
            .termynal-lazy-icon {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.6;
                animation: termynal-lazy-pulse 2s infinite;
            }

            /* Lazy Loading Text */
            .termynal-lazy-text {
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 8px;
                color: var(--color-text);
            }

            /* Lazy Loading Info Text */
            .termynal-lazy-info {
                font-size: 12px;
                opacity: 0.7;
            }

            /* Lazy Loading Indicator */

            .termynal-lazy-loading {
                position: absolute;
                top: 10px;
                right: 10px;
                background: var(--color-accent);
                color: var(--color-bg);
                padding: var(--terminal-button-padding);
                border-radius: var(--terminal-button-radius);
                font-size: 10px;
                animation: termynal-lazy-fade 2s ease-in-out;
            }

            /* Keyframe Animations */
            @keyframes termynal-lazy-pulse {
                0%, 100% { transform: scale(1); opacity: 0.6; }
                50% { transform: scale(1.05); opacity: 0.8; }
            }

            @keyframes termynal-lazy-fade {
                0% { opacity: 0; transform: translateY(-10px); }
                50% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }

            /* Responsive Design - Mobile Styles */
            @media (max-width: 768px) {
                .termynal-lazy-icon {
                    font-size: 32px;
                    margin-bottom: 12px;
                }
                
                .termynal-lazy-text {
                    font-size: 14px;
                }
                
                .termynal-lazy-info {
                    font-size: 11px;
                }
                
                .obsidian-termynal {
                    font-size: 12px;
                    padding: 60px 15px 15px;
                }
                
                .termynal-controls {
                    flex-direction: column;
                    gap: 5px;
                }
                
                .termynal-progress-info {
                    flex-direction: column;
                    gap: 5px;
                }
            }
        `;
        
        document.head.appendChild(style);
        this.initialized = true;
    }
}

/**
 * Event Manager - handles all event-related functionality
 * Provides both internal 事件系统 and external API for event handling
 */
class TermynalEventManager {
    constructor(termynal) {
        this.termynal = termynal;
        this.listeners = new Map();         // Internal event listeners
        this.eventListeners = new Map();    // External API event listeners
    }

    /**
     * 向所有已注册的监听器发射事件
     * @param {string} event - 事件名称
     * @param {Object} data - Event data
     */
    emit(event, data = {}) {
        // Emit for internal event listeners
        if (this.listeners && this.listeners.has(event)) {
            const eventListeners = this.listeners.get(event);
            if (Array.isArray(eventListeners)) {
                eventListeners.forEach(callback => {
                    try {
                        callback(data);
                    } catch (err) {
                        console.error(`Error in event listener for ${event}:`, err);
                    }
                });
            }
        }

        // Emit for external event listeners (on/off API)
        if (this.eventListeners && this.eventListeners.has(event)) {
            const callbacks = this.eventListeners.get(event);
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`Error in external event listener for ${event}:`, err);
                }
            });
        }
    }
    
    /**
     * Register an external event listener
     * @param {string} event - 事件名称
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    /**
     * Remove an external event listener
     * @param {string} event - 事件名称
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
            if (this.eventListeners.get(event).size === 0) {
                this.eventListeners.delete(event);
            }
        }
    }

    /**
     * Remove all external event listeners
     */
    removeAllListeners() {
        this.eventListeners.clear();
    }
    
    /**
     * Handle control button clicks
     * @param {string} controlType - Type of control (speed, pause, restart, etc.)
     */
    handleControlClick(controlType) {
        const handlers = {
            'speed': () => this.termynal.toggleSpeed(),
            'pause': () => this.termynal.togglePause(),
            'restart': () => this.termynal.restart(),
            'copy': () => this.termynal.copyContent(),
            'fullscreen': () => this.termynal.toggleFullscreen()
        };
        
        handlers[controlType]?.();
    }
    
    /**
     * Clean up all event listeners and references
     */
    destroy() {
        this.listeners.forEach((handler, event) => {
            this.termynal.container.removeEventListener(event, handler);
        });
        this.listeners.clear();
        this.eventListeners.clear();
    }
}

/**
 * Timer Manager - robust timer management with cleanup capabilities
 * Prevents memory leaks and provides centralized timer control
 */
class TimerManager {
    constructor() {
        this.timeouts = new Set();      // Active setTimeout references
        this.intervals = new Map();     // Active setInterval references
    }
    
    /**
     * Create a timeout with automatic cleanup tracking
     * @param {Function} fn - Function to execute
     * @param {number} delay - 延迟（毫秒）
     * @returns {Promise} Promise that resolves when timeout completes
     */
    setTimeout(fn, delay) {
        return new Promise(resolve => {
            const timeout = setTimeout(() => {
                this.timeouts.delete(timeout);
                fn();
                resolve();
            }, delay);
            this.timeouts.add(timeout);
        });
    }
    
    /**
     * Create a timer (alias for setInterval with ID tracking)
     * @param {Function} fn - Function to execute
     * @param {number} delay - Interval delay
     * @param {string} id - Timer identifier
     * @returns {number} 间隔 ID
     */
    setTimer(fn, delay, id) {
        if (this.intervals.has(id)) {
            clearInterval(this.intervals.get(id));
        }
        const interval = setInterval(fn, delay);
        this.intervals.set(id, interval);
        return interval;
    }
    
    /**
     * Create an interval with ID tracking
     * @param {Function} fn - Function to execute
     * @param {number} delay - Interval delay
     * @param {string} id - Timer identifier
     * @returns {number} 间隔 ID
     */
    setInterval(fn, delay, id) {
        if (this.intervals.has(id)) {
            clearInterval(this.intervals.get(id));
        }
        const interval = setInterval(fn, delay);
        this.intervals.set(id, interval);
        return interval;
    }
    
    /**
     * Clear all active timers and intervals
     */
    clearAll() {
        // 清除所有超时
        this.timeouts.forEach(id => {
            try {
                clearTimeout(id);
            } catch (e) {
                console.warn('Failed to clear timeout:', e);
            }
        });
        this.timeouts.clear();
        
        // 清除所有间隔
        this.intervals.forEach((interval, key) => {
            try {
                clearInterval(interval);
            } catch (e) {
                console.warn(`Failed to clear interval ${key}:`, e);
            }
        });
        this.intervals.clear();
    }

    /**
     * 获取活动计时器数量以进行性能监控
     * @returns {number} 活动计时器数量
     */
    getActiveCount() {
        return this.timeouts.size + this.intervals.size;
    }
}

/**
 * DOM 缓存 - 优化的 DOM 元素缓存以提高性能
 * 通过缓存频繁访问的元素减少重复的 DOM 查询
 */
class DOMCache {
    constructor(container) {
        this.container = container;
        this.cache = new Map();
    }
    
    /**
     * 使用缓存获取单个元素
     * @param {string} selector - CSS 选择器
     * @returns {Element|null} 缓存的或新找到的元素
     */
    get(selector) {
        if (!this.cache.has(selector)) {
            this.cache.set(selector, this.container.querySelector(selector));
        }
        return this.cache.get(selector);
    }
    
    /**
     * 使用缓存获取所有匹配选择器的元素
     * @param {string} selector - CSS 选择器
     * @returns {NodeList} 缓存的或新找到的元素s
     */
    getAll(selector) {
        const cacheKey = `all:${selector}`;
        if (!this.cache.has(cacheKey)) {
            this.cache.set(cacheKey, this.container.querySelectorAll(selector));
        }
        return this.cache.get(cacheKey);
    }
    
    /**
     * 手动缓存元素
     * @param {string} key - 缓存键
     * @param {Element} element - 要缓存的元素
     */
    set(key, element) {
        this.cache.set(key, element);
    }
    
    /**
     * 使缓存条目失效
     * @param {string|null} selector - 要使失效的特定选择器，或 null 表示全部
     */
    invalidate(selector = null) {
        if (selector) {
            this.cache.delete(selector);
            this.cache.delete(`all:${selector}`);
        } else {
            this.cache.clear();
        }
    }

    /**
     * 获取缓存大小以进行性能监控
     * @returns {number} 缓存条目数量
     */
    getCacheSize() {
        return this.cache.size;
    }
}

/**
 * 模块化渲染器 - 处理所有 DOM 渲染和 UI 更新
 * 将渲染逻辑与动画逻辑分离以提高可维护性
 */
class TermynalRenderer {
    constructor(termynal) {
        this.termynal = termynal;
        this.domCache = termynal.domCache;
        this.events = termynal.events;
    }

    /**
     * Render the start button for manual animation triggering
     */
    renderStartButton() {
        if (this.termynal.config.autoStart) return;

        const btn = this.termynal.$('button', {
            className: 'termynal-start-button',
            innerHTML: '▶ Start Terminal Animation',
            onclick: e => { 
                e.preventDefault(); 
                btn.remove(); 
                this.termynal.start(); 
            }
        });
        this.termynal.container.appendChild(btn);
    }

    /**
     * Render interactive controls for the terminal
     * If the activeButtons array is empty, this function does nothing
     */
    renderControls() {
        const existingControls = this.domCache.get('.termynal-controls');
        if (existingControls) existingControls.remove();

        const controlsContainer = this.termynal.$('div', { 
            className: 'termynal-controls' 
        });

        const buttonConfigs = this.getButtonConfigs();
        const activeButtons = this.getActiveButtons(buttonConfigs);

        if (activeButtons.length === 0) return;

        activeButtons.forEach(({ key, config }) => {
            const button = this.createControlButton(key, config);
            if (button) {
                controlsContainer.appendChild(button);
                this.termynal.elements.set(key, button);
            }
        });

        this.termynal.container.appendChild(controlsContainer);
        this.domCache.set('.termynal-controls', controlsContainer);
    }

    /**
     * Returns a configuration object for control buttons in the terminal.
     * Each key in the object represents a control button and maps to an
     * object containing the button's text, title, and action.
     *
     * - `speed`: Toggles the animation speed.
     * - `pause`: Pauses or resumes the animation.
     * - `restart`: Restarts the animation.
     * - `copy`: Copies the terminal content.
     * - `fullscreen`: Toggles fullscreen mode.
     *
     * @returns {Object} Configuration object for terminal control buttons.
     */
    getButtonConfigs() {
        return {
            speed: {
                text: 'fast →',
                title: 'Toggle animation speed',
                action: () => this.termynal.toggleSpeed()
            },
            pause: {
                text: 'pause ⏸',
                title: 'Pause/恢复动画',
                action: () => this.termynal.togglePause()
            },
            restart: {
                text: 'restart ↻',
                title: 'Restart animation',
                action: () => this.termynal.restart()
            },
            copy: {
                text: 'copy ⎘',
                title: 'Copy terminal content',
                action: () => this.termynal.copyContent()
            },
            fullscreen: {
                text: 'fullscreen ⛶',
                title: 'Toggle fullscreen',
                action: () => this.termynal.toggleFullscreen()
            }
        };
    }

    /**
     * Returns an array of active control buttons. Each button is an object
     * with two properties: 'key' and 'config'. 'key' is a string identifier
     * for the button and 'config' is the configuration object for the button
     * from the 'buttonConfigs' parameter.
     *
     * Only buttons with 'enabled' set to true in the 'controlButtons'
     * configuration will be included in the returned array.
     *
     * @param {Object<string, { text: string, title: string, action: () => void }>} buttonConfigs
     * @return {Array<{ key: string, config: { text: string, title: string, action: () => void } }>}
     */
    getActiveButtons(buttonConfigs) {
        return Object.entries(this.termynal.config.controlButtons)
            .filter(([key, enabled]) => enabled && buttonConfigs[key])
            .map(([key]) => ({ key, config: buttonConfigs[key] }));
    }

    /**
     * Creates a control button element for the terminal.
     * @param {string} key - Identifier for the control button.
     * @param {Object} config - Configuration object for the button.
     * @param {string} config.text - Text content of the button.
     * @param {string} config.title - Tooltip text for the button.
     * @param {Function} config.action - Function to execute on button click.
     * @returns {Element} The created button element.
     */
    createControlButton(key, config) {
        const button = this.termynal.$('button', {
            textContent: config.text,
            title: config.title,
            'data-terminal-control': key,
            onclick: config.action
        });
        
        return button;
    }

    /**
     * 渲染进度信息显示
     */
    renderProgressInfo() {
        const info = this.termynal.$('div', {
            className: 'termynal-progress-info',
            innerHTML: `<span class="current-line">Line: 1/${this.termynal.config.lines.length}</span><span class="elapsed-time">Time: 00:00</span>`
        });
        
        this.termynal.container.appendChild(info);
        this.termynal.elements.set('progressInfo', info);
        this.domCache.set('.termynal-progress-info', info);
        
        // Start progress timer
        this.termynal.timers.setTimer(() => {
            if (this.termynal.state.isRunning && !this.termynal.state.isPaused) {
                const timeSpan = info.querySelector('.elapsed-time');
                if (timeSpan) timeSpan.textContent = `Time: ${this.termynal.formatTime(this.termynal.getElapsed())}`;
            }
        }, 1000, 'progress');
    }

    /**
     * 创建具有适当属性的行元素
     * @param {Object} lineData - 行配置对象
     * @returns {HTMLElement} 创建的行元素
     */
    createLine(lineData) {
        const line = this.termynal.$('div', { 
            className: 'termynal-line', 
            'data-ty': lineData.type 
        });
        
        // 为输入行设置提示符属性
        if (lineData.type === 'input' || lineData.defaultPrompt) {
            const prompt = lineData.prompt || this.termynal.config.defaultPrompt;
            const color = lineData.promptColor || this.termynal.config.defaultPromptColor;
            if (prompt) line.setAttribute('data-ty-prompt', prompt);
            if (color) {
                line.setAttribute('data-ty-prompt-color', color);
                line.style.setProperty('--prompt-color', color);
            }
        }
        
        // 如果指定，添加自定义 CSS 类
        if (lineData.class) line.classList.add(lineData.class);
        return line;
    }

    /**
     * 更新进度信息显示
     */
    updateProgressInfo() {
        const info = this.domCache.get('.termynal-progress-info');
        if (!info) return;
        
        const currentLineSpan = info.querySelector('.current-line');
        const timeSpan = info.querySelector('.elapsed-time');
        
        if (currentLineSpan) {
            currentLineSpan.textContent = `Line: ${this.termynal.state.currentLine + 1}/${this.termynal.config.lines.length}`;
        }
        
        if (timeSpan && this.termynal.state.isRunning) {
            timeSpan.textContent = `Time: ${this.termynal.formatTime(this.termynal.getElapsed())}`;
        }
    }

    /**
     * 更新控制按钮的文本
     * @param {string} buttonId - 按钮标识符
     * @param {string} newText - 新按钮文本
     */
    updateButton(key, newText) {
        const button = this.termynal.elements.get(key);
        if (button) {
            button.textContent = newText;
        }
    }

    /**
     * 将所有控制按钮重置为默认文本
     */
    resetButtons() {
        const buttonConfigs = this.getButtonConfigs();
        
        // 重置速度按钮
        if (this.termynal.elements.has('speed')) {
            this.updateButton('speed', buttonConfigs.speed.text);
        }
        
        // 重置暂停按钮
        if (this.termynal.elements.has('pause')) {
            this.updateButton('pause', buttonConfigs.pause.text);
        }
        
        // 全屏按钮文本根据状态更新
        if (this.termynal.elements.has('fullscreen')) {
            const isFullscreen = document.fullscreenElement;
            this.updateButton('fullscreen', isFullscreen ? 'exit ⛶' : 'fullscreen ⛶');
        }
    }

    /**
     * 显示临时通知消息
     * @param {string} message - 通知消息
     */
    showNotification(message) {
        const notification = this.termynal.$('div', {
            className: 'termynal-notification',
            textContent: message
        });
        
        this.termynal.container.appendChild(notification);
        
        // Remove notification after 3 seconds
        this.termynal.timers.setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * Ensure UI elements are rendered once (idempotent)
     */
    renderOnce() {
        if (!this.domCache.get('.termynal-controls')) {
            this.renderControls();
        }
        
        if (!this.domCache.get('.termynal-progress-info')) {
            this.renderProgressInfo();
        }
    }
}

/**
 * 模块化动画器 - 处理所有动画逻辑
 * 将动画逻辑与渲染和状态管理分离
 */
class TermynalAnimator {
    constructor(termynal) {
        this.termynal = termynal;
        this.outputTypes = new Set(['output', 'comment', 'warning', 'success', 'error']);
    }

    /**
     * 逐字符动画打字文本
     * @param {HTMLElement} line - 要打字输入的行元素
     * @param {string} text - 要打字的文本
     * @param {number} customDelay - 自定义打字延迟覆盖
     */
    async typeText(line, text, customDelay) {
        line.classList.add('termynal-cursor');
        this.termynal.container.appendChild(line);
        
        // 使用数组缓冲区优化字符串创建
        const chars = [...text];
        const buffer = [];
        
        for (let i = 0; i < chars.length; i++) {
            const delay = this.termynal.timing.typeDelay === 0 ? 0 : customDelay ?? this.termynal.timing.typeDelay;
            if (!this.termynal.state.isRunning) break;
            await this.termynal.waitPause();
            await this.termynal.wait(delay);
            
            buffer.push(chars[i]);
            line.textContent = buffer.join('');
        }
        
        line.classList.remove('termynal-cursor');
    }

    /**
     * 使用淡入效果立即显示文本
     * @param {HTMLElement} line - 要显示文本的行元素
     * @param {string} text - 要显示的文本
     */
    async revealText(line, text) {
        this.termynal.container.appendChild(line);
        
        // 如果启用且文本包含代码块，则应用语法高亮
        if (this.termynal.config.highlightSyntax && text.includes('```')) {
            line.innerHTML = this.highlightSyntax(text);
        } else {
            line.textContent = text;
        }
        
        // 使用 CSS 类而不是内联样式以获得更好的性能
        line.classList.add('termynal-fade-in');
        await this.termynal.wait(50);
        line.classList.add('termynal-fade-in-complete');
    }

    /**
     * 动画进度指示器（旋转器、点、进度条）
     * @param {HTMLElement} line - 用于进度动画的行元素
     * @param {Object} lineData - 带有动画设置的行配置
     */
    async animateProgress(line, lineData) {
        line.textContent = '';
        this.termynal.container.appendChild(line);
        
        const animations = {
            // 旋转进度指示器
            spinner: async () => {
                const chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
                const duration = lineData.duration || 3000;
                const start = Date.now();
                let i = 0;
                
                while (Date.now() - start < duration && this.termynal.state.isRunning) {
                    await this.termynal.waitPause();
                    line.textContent = `${chars[i % chars.length]} ${lineData.text || 'Loading...'}`;
                    i++;
                    await this.termynal.wait(this.termynal.timing.typeDelay);
                }
                line.textContent = `✓ ${lineData.text || 'Loading...'} completed!`;
            },
            
            // 动画点（加载中...、加载中....等）
            dots: async () => {
                const maxDots = lineData.maxDots || 3;
                const cycles = lineData.cycles || 3;
                
                for (let cycle = 0; cycle < cycles; cycle++) {
                    for (let dots = 0; dots <= maxDots; dots++) {
                        if (!this.termynal.state.isRunning) break;
                        await this.termynal.waitPause();
                        line.textContent = `${lineData.text || 'Loading'}${'.'.repeat(dots)}`;
                        await this.termynal.wait(Math.max(100, this.termynal.timing.typeDelay * 5));
                    }
                }
            },
            
            // 进度条动画
            bar: async () => {
                const length = lineData.length || 40;
                const completeChar = lineData.completeChar || '█';
                const incompleteChar = lineData.incompleteChar || '░';
                const maxPercent = lineData.percent || 100;
                
                for (let i = 1; i <= length; i++) {
                    if (!this.termynal.state.isRunning) break;
                    await this.termynal.waitPause();
                    await this.termynal.wait(this.termynal.timing.typeDelay);
                    
                    const percent = Math.round(i / length * 100);
                    const progress = completeChar.repeat(i);
                    const remaining = incompleteChar.repeat(length - i);
                    line.textContent = `[${progress}${remaining}] ${percent}%`;
                    
                    if (percent >= maxPercent) break;
                }
            }
        };
        
        // 执行指定的动画样式或默认使用进度条
        await (animations[lineData.style] || animations.bar)();
    }


    /**
     * 渲染图片元素
     * 支持在线 URL 和 Obsidian wiki-link 格式
     * @param {HTMLElement} line - 要渲染图片的行元素
     * @param {Object} lineData - 包含图片信息的行数据
     * @returns {Promise} 图片渲染完成时解析的 Promise
     */
    async renderImage(line, lineData) {
        return new Promise((resolve) => {
            // 解析图片源
            let imgSrc = lineData.src || lineData.text || '';
            let imgAlt = lineData.alt || 'Image';
            let imgWidth = lineData.width || 'auto';
            let imgHeight = lineData.height || 'auto';
            
            // 处理 Obsidian wiki-link 格式: ![[image.png]] or ![[image.png|200x200]]
            const wikiLinkMatch = imgSrc.match(/!\[\[([^\]|]+)(?:\|(\d+)(?:x(\d+))?)?\]\]/);
            if (wikiLinkMatch) {
                const filename = wikiLinkMatch[1];
                const width = wikiLinkMatch[2];
                const height = wikiLinkMatch[3];
                
                // 在 Obsidian 中，尝试解析仓库路径
                if (typeof app !== 'undefined' && app.vault) {
                    const file = app.vault.getAbstractFileByPath(filename) || 
                                app.metadataCache.getFirstLinkpathDest(filename, '');
                    if (file) {
                        imgSrc = app.vault.getResourcePath(file);
                    }
                }
                
                if (width) imgWidth = width + 'px';
                if (height) imgHeight = height + 'px';
            }
            
            // 使用原生 DOM 方法创建图片容器
            const imgContainer = document.createElement('div');
            imgContainer.className = 'termynal-image-container';
            
            // 创建图片元素
            const img = document.createElement('img');
            img.src = imgSrc;
            img.alt = imgAlt;
            img.className = 'termynal-image';
            
            // 应用尺寸
            if (imgWidth !== 'auto') img.style.width = imgWidth;
            if (imgHeight !== 'auto') img.style.height = imgHeight;
            
            // 处理图片加载
            img.onload = () => {
                line.appendChild(imgContainer);
                imgContainer.appendChild(img);
                this.termynal.container.appendChild(line);
                resolve();
            };
            
            // 处理图片错误
            img.onerror = () => {
                const errorText = document.createElement('span');
                errorText.textContent = `[Image load error: ${imgSrc}]`;
                errorText.className = 'termynal-image-error';
                line.appendChild(errorText);
                this.termynal.container.appendChild(line);
                resolve();
            };
            
            // 如果没有 src，立即显示错误
            if (!imgSrc || imgSrc === '![[]]') {
                const errorText = document.createElement('span');
                errorText.textContent = '[No image source specified]';
                errorText.className = 'termynal-image-error';
                line.appendChild(errorText);
                this.termynal.container.appendChild(line);
                resolve();
            }
        });
    }
    /**
     * 代码块的基本语法高亮
     * @param {string} text - 要高亮的文本
     * @returns {string} 带语法高亮的 HTML
     */
    highlightSyntax(text) {
        const patterns = [
            [/\b(function|const|let|var|if|else|for|while|return)\b/g, 'keyword'],
            [/(['"])((?:\\.|(?!\1)[^\\])*?)\1/g, 'string'],
            [/\/\/.*$/gm, 'comment'],
            [/\b\d+\b/g, 'number']
        ];
        return patterns.reduce((acc, [regex, cls]) => acc.replace(regex, `<span class="${cls}">$&</span>`), text);
    }

    /**
     * Optimized batch collection with O(n) complexity
     * Collects consecutive output lines for batch processing
     * @param {number} startIndex - Starting index in line queue
     * @param {Array} lineQueue - Queue of lines to process
     * @returns {Array} Batch of lines to process together
     */
    collectOutputBatch(startIndex, lineQueue) {
        const batch = [];
        
        for (let i = startIndex; i < lineQueue.length; i++) {
            const lineData = lineQueue[i];
            const lineId = `${this.termynal.instanceId}_line_${lineData.originalIndex}`;
            
            // Early exit for already processed lines
            if (this.termynal.state.processedLines.has(lineId)) {
                if (batch.length === 0) continue;
                break;
            }
            
            // O(1) lookup using Set
            if (!this.outputTypes.has(lineData.type)) break;
            
            batch.push({ lineData, index: i });
            if (lineData.lineDelay !== undefined) break;
        }
        
        return batch;
    }
}


/**
 * Lazy Loading Manager - manages the lazy loading of the terminal
 * Handles visibility checks and initialization
 */
class LazyLoadingManager {
    /**
     * Constructor for the LazyLoadingManager class
     * @param {ObsidianTermynal} termynal - The ObsidianTermynal instance this manager belongs to
     */
    constructor(termynal) {
        this.termynal = termynal;
        this.observer = null;
        this.isVisible = false;
        this.hasInitialized = false;
        this.pendingStart = false;
    }

    /**
     * Initialize the lazy loading manager
     * This method will create an IntersectionObserver and set up the placeholder element
     */
    init() {
        if (!this.termynal.config.lazyLoading) return;

        this.observer = new IntersectionObserver(
            this.handleIntersection.bind(this),
            {
                threshold: this.termynal.config.intersectionThreshold,
                rootMargin: this.termynal.config.rootMargin
            }
        );

        this.observer.observe(this.termynal.container);
        this.setupPlaceholder();
    }

    /**
     * Setup the placeholder element for the lazy loaded terminal
     * This element will be shown until the terminal is initialized
     */
    setupPlaceholder() {
        const placeholder = this.termynal.$('div', {
            className: 'termynal-lazy-placeholder',
            innerHTML: `
                <div class="termynal-lazy-content">
                    <div class="termynal-lazy-icon">📺</div>
                    <div class="termynal-lazy-text">Terminal is loading...</div>
                    <div class="termynal-lazy-info">${this.termynal.config.lines.length} lines loaded</div>
                </div>
            `
        });

        this.termynal.container.appendChild(placeholder);
        this.termynal.domCache.set('placeholder', placeholder);
    }

    /**
     * Handle intersection event
     * This method will initialize the terminal if it is visible and not already initialized
     * @param {IntersectionObserverEntry[]} entries - IntersectionObserver entries
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !this.hasInitialized) {
                this.isVisible = true;
                this.initializeTerminal();
            }
        });
    }

    /**
     * Initialize the terminal
     * This method will remove the placeholder element and initialize the terminal
     * @returns {Promise<void>}
     */
    async initializeTerminal() {
        if (this.hasInitialized) return;

        this.hasInitialized = true;
        
        const placeholder = this.termynal.domCache.get('placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        this.termynal.setupContainer();
        
        this.termynal.emit('lazyLoaded', {
            linesCount: this.termynal.config.lines.length,
            timestamp: Date.now()
        });

        if (this.termynal.config.autoStart) {
            if (this.pendingStart) {
                await this.termynal.start();
                this.pendingStart = false;
            } else {
                this.termynal.start();
            }
        } else {
            this.termynal.renderer.renderStartButton();
        }
    }

    /**
     * Schedule the start of the terminal
     * This method will start the terminal if it is initialized or schedule the start
     * if it is not initialized yet
     * @returns {Promise<void>}
     */
    scheduleStart() {
        if (this.hasInitialized) {
            return this.termynal.start();
        } else {
            this.pendingStart = true;
            return Promise.resolve();
        }
    }

    /**
     * Check if the terminal is ready
     * @returns {boolean}
     */
    isReady() {
        return this.hasInitialized;
    }

    /**
     * Destroy the lazy loading manager
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

/**
 * Main Obsidian Termynal Class - orchestrates all components
 * Provides the primary API and coordinates between all subsystems
 */
class ObsidianTermynal {
    constructor(options) {
        this.container = dv.container;
        this.config = { ...DEFAULT_CONFIG, ...options };
        if (options && options.controlButtons) {
            this.config.controlButtons = { 
                ...DEFAULT_CONFIG.controlButtons, 
                ...options.controlButtons 
            };
        }

        this.instanceId = this.generateInstanceId();
        
        // Prevent duplicate initialization
        if (this.isAlreadyInitialized()) return;
        
        // Initialize elements Map BEFORE other classes that depend on it
        this.elements = new Map();
        
        // Initialize all subsystem components
        this.timers = new TimerManager();
        this.domCache = new DOMCache(this.container);
        this.events = new TermynalEventManager(this);
        this.renderer = new TermynalRenderer(this);
        this.animator = new TermynalAnimator(this);
        this.lazyManager = new LazyLoadingManager(this);
        
        // Initialize animation state
        this.state = { 
            isRunning: false,              // Is animation currently running
            isPaused: false,               // Is animation paused
            currentLine: 0,                // Current line being processed
            startTime: 0,                  // Animation start timestamp
            pausedTime: 0,                 // Total time spent paused
            pauseStart: 0,                 // When current pause started
            restarting: false,             // Is animation restarting
            processedLines: new Set(),     // Set of already processed line IDs
            lineQueue: this.generateLineQueue(),  // Queue of lines to process
            isLazyLoaded: false            // Is the terminal lazy loaded
        };
        
        // Initialize timing configuration with original values backup
        this.timing = { 
            ...this.config, 
            original: { 
                startDelay: this.config.startDelay, 
                typeDelay: this.config.typeDelay, 
                lineDelay: this.config.lineDelay 
            } 
        };
        
        // Memoization cache for line queue generation
        this._lineQueueCache = null;
        this._lineQueueHash = null;
        
        this.markAsInitialized();
        this.init();
    }

    /**
     * Initialize the terminal instance by setting up styles and container.
    /**
     * 初始化 ObsidianTermynal 实例.
     * 如果启用了延迟加载，初始化延迟加载管理器;
     * 否则，进行标准设置，如果启用了自动启动则开始动画.
     */
    init() {
        TermynalStyleManager.initializeStyles();
        
        // 清理同一容器中的任何现有实例（用于 Dataview 自动刷新）
        this.cleanupExistingInstance();
        
        if (this.config.lazyLoading) {
            this.lazyManager.init();
        } else {
            this.setupContainer();
            this.config.autoStart ? this.start() : this.renderer.renderStartButton();
        }
    }
    
    /**
     * 清理同一容器中的任何现有终端实例
     * 防止 Dataview 刷新时发生冲突
     */
    cleanupExistingInstance() {
        // 检查容器是否已有 termynal 实例
        const existingGlobalId = this.container.getAttribute('data-termynal-global-id');
        if (existingGlobalId && window.termynalInstances.has(existingGlobalId)) {
            const existingInstance = window.termynalInstances.get(existingGlobalId);
            console.log(`[Termynal] Cleaning up existing instance: ${existingGlobalId}`);
            
            // 销毁现有实例
            if (existingInstance && typeof existingInstance.destroy === 'function') {
                existingInstance.destroy();
            }
            
            // 从全局注册表中移除
            window.termynalInstances.delete(existingGlobalId);
        }
        
        // 同时检查 WeakMap 注册表
        if (instanceRegistry.has(this.container)) {
            instanceRegistry.delete(this.container);
        }
    }


    /**
     * 根据配置生成唯一的实例 ID
     * @returns {string} 唯一实例标识符
     */
    generateInstanceId() {
        const configStr = JSON.stringify({ 
            lines: this.config.lines, 
            title: this.config.title, 
            theme: this.config.theme 
        });
        let hash = 0;
        for (let i = 0; i < configStr.length; i++) {
            hash = ((hash << 5) - hash) + configStr.charCodeAt(i);
            hash = hash & hash;
        }
        return `termynal_${Math.abs(hash).toString(36).slice(0, 8)}`;
    }

    /**
     * 使用 WeakMap 检查实例是否已初始化
     * @returns {boolean} 如果已初始化则返回 true
     */
    isAlreadyInitialized() {
        return instanceRegistry.has(this.container);
    }

    /**
     * 在注册表中标记此实例为已初始化
     */
    markAsInitialized() {
        instanceRegistry.set(this.container, {
            id: this.instanceId,
            timestamp: Date.now()
        });
    }

    /**
     * 使用适当的属性和样式设置容器元素
     */
    setupContainer() {
        if (this.container.hasAttribute('data-termynal-setup')) return;
        
        this.container.innerHTML = '';
        this.container.className = 'obsidian-termynal';
        
        // 设置终端属性
        const attrs = {
            'data-termynal': '', 
            'data-ty-title': this.config.title, 
            'data-theme': this.config.theme,
            [`data-ty-${this.config.theme}`]: '', 
            'data-termynal-setup': 'true'
        };

        // 添加延迟加载属性
        if (this.config.lazyLoading) {
            attrs['data-lazy-loading'] = 'true';
        }

        Object.entries(attrs).forEach(([k, v]) => this.container.setAttribute(k, v));
        
        // 应用自定义样式
        const styles = {};
        if (this.config.height !== 'auto') styles.height = this.config.height;
        if (this.config.width !== '100%') styles.width = this.config.width;
        if (this.config.resizable) { 
            styles.resize = 'both'; 
            styles.overflow = 'auto'; 
        }
        Object.assign(this.container.style, styles);
    }

    /**
     * 生成记忆化的行队列以提高性能
     * @returns {Array} 带有原始索引的行对象数组
     */
    generateLineQueue() {
        const configHash = this.getConfigHash();
        if (!this._lineQueueCache || this._lineQueueHash !== configHash) {
            this._lineQueueCache = this.config.lines.map((line, index) => ({ 
                ...line, 
                originalIndex: index 
            }));
            this._lineQueueHash = configHash;
        }
        return [...this._lineQueueCache];
    }

    /**
     * 为当前配置生成哈希以检测更改
     * 用于行队列生成的记忆化
     * @returns {string} 表示当前行配置的哈希字符串
     */
    getConfigHash() {
        return JSON.stringify(this.config.lines.map(line => ({ 
            type: line.type, 
            text: line.text, 
            originalIndex: line.originalIndex 
        })));
    }

    /**
     * 创建具有指定属性的 DOM 元素
     * 用于高效创建 DOM 元素的实用方法
     * @param {string} tag - HTML 标签名
     * @param {Object} attrs - 包含属性和特性的对象
     * @returns {HTMLElement} 创建的 DOM 元素
     */
    $(tag, attrs = {}) {
        const el = document.createElement(tag);
        
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'innerHTML') {
                el.innerHTML = value;
            } else if (key === 'textContent') {
                el.textContent = value;
            } else if (key.startsWith('on') && typeof value === 'function') {
                // 处理事件监听器
                el.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key.startsWith('data-')) {
                // 处理数据属性
                el.setAttribute(key, value);
            } else {
                // 处理其他属性
                el.setAttribute(key, value);
            }
        });
        
        return el;
    }

    /**
     * 创建一个在指定毫秒后解析的 promise
     * 使用计时器管理器进行适当的清理
     * @param {number} ms - 等待的毫秒数
     * @returns {Promise} 延迟后解析的 Promise
     */
    wait(ms) {
        return new Promise(resolve => {
            this.timers.setTimeout(resolve, ms);
        });
    }

    /**
     * Waits while the animation is paused
     * Continuously checks pause state and waits in small intervals
     * @returns {Promise} 动画不再暂停时解析的 Promise
     */
    async waitPause() {
        while (this.state.isPaused && this.state.isRunning) {
            await this.wait(100);
        }
    }

    /**
     * Calculates elapsed time since animation start, excluding paused time
     * @returns {number} Elapsed time in seconds
     */
    getElapsed() {
        if (!this.state.startTime) return 0;
        const now = Date.now();
        const pausedTime = this.state.isPaused ? 
            this.state.pausedTime + (now - this.state.pauseStart) : 
            this.state.pausedTime;
        return Math.floor((now - this.state.startTime - pausedTime) / 1000);
    }

    /**
     * Formats seconds into MM:SS format
     * @param {number} s - Seconds to format
     * @returns {string} 格式化的时间字符串 (MM:SS)
     */
    formatTime(s) {
        return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    }

    /**
     * Starts the terminal animation
     * Initializes state, removes start button, and begins processing lines
     * @returns {Promise} Promise that resolves when animation completes
     */
    async start() {
        // Lazy loading check
        if (this.config.lazyLoading && !this.lazyManager.isReady()) {
            return this.lazyManager.scheduleStart();
        }

        // Prevent multiple simultaneous starts
        if (this.state.isRunning && !this.state.restarting) return;

        // Clean up start button if present
        const startBtn = this.domCache.get('.termynal-start-button');
        if (startBtn) startBtn.remove();
        
        // Emit start event for external listeners
        this.emit('start', { config: this.config });
        
        // Initialize animation state
        Object.assign(this.state, { 
            isRunning: true, 
            isPaused: false, 
            currentLine: 0, 
            startTime: Date.now(), 
            pausedTime: 0, 
            restarting: false,
            isLazyLoaded: this.config.lazyLoading
        });
        
        try {
            // Wait for initial delay before starting
            await this.wait(this.timing.startDelay);
            await this.processLines();
            
            // Animation completed successfully
            this.state.isRunning = false;
            this.emit('complete', { 
                totalLines: this.config.lines.length, 
                duration: this.getElapsed()
            });
            
            // Handle looping if enabled
            if (this.config.loop && !this.state.restarting) {
                await this.wait(2000);
                this.restart();
            }
        } catch (error) {
            // Handle animation errors gracefully
            console.error('Animation error:', error);
            this.emit('error', { error, currentLine: this.state.currentLine });
            this.state.isRunning = false;
        }
    }

    /**
     * Processes all lines in the animation queue
     * Handles batching of output lines for better performance
     * @returns {Promise} Promise that resolves when all lines are processed
     */
    async processLines() {
        // Sort lines by original index to maintain order
        this.state.lineQueue.sort((a, b) => a.originalIndex - b.originalIndex);
        
        let i = 0;
        while (i < this.state.lineQueue.length && this.state.isRunning) {
            // Ensure renderer is ready (render controls once)
            if (this.renderer && typeof this.renderer.renderOnce === 'function') {
                this.renderer.renderOnce();
            }
            
            const lineData = this.state.lineQueue[i];
            const lineId = `${this.instanceId}_line_${lineData.originalIndex}`;
            
            // Skip already processed lines
            if (this.state.processedLines.has(lineId) || 
                this.domCache.get(`[data-line-id="${lineId}"]`)) {
                this.state.processedLines.add(lineId);
                i++;
                continue;
            }
            
            // Wait if animation is paused
            await this.waitPause();
            
            // Use batch processing for output-type lines for better performance
            const outputTypes = new Set(['output', 'comment', 'warning', 'success', 'error']);
            if (outputTypes.has(lineData.type)) {
                const batch = this.collectOutputBatch(i);
                await this.processBatch(batch);
                i += batch.length;
            } else {
                // Process individual line (input, progress, etc.)
                this.state.currentLine = lineData.originalIndex;
                
                // Update progress display safely
                if (this.renderer && typeof this.renderer.updateProgressInfo === 'function') {
                    this.renderer.updateProgressInfo();
                }
                
                const line = this.renderer.createLine(lineData);
                line.setAttribute('data-line-id', lineId);
                
                await this.processLine(line, lineData);
                this.state.processedLines.add(lineId);
                
                // Apply line delay
                const delay = this.getLineDelay(lineData, i);
                if (delay > 0) await this.wait(delay);
                i++;
            }
        }
    }

    /**
     * Collects consecutive output lines for batch processing
     * Optimized with O(n) complexity using Set for type checking
     * @param {number} startIndex - Starting index in the line queue
     * @returns {Array} Array of line objects to process as a batch
     */
    collectOutputBatch(startIndex) {
        const outputTypes = new Set(['output', 'comment', 'warning', 'success', 'error']);
        const batch = [];
        
        for (let i = startIndex; i < this.state.lineQueue.length; i++) {
            const lineData = this.state.lineQueue[i];
            const lineId = `${this.instanceId}_line_${lineData.originalIndex}`;
            
            // Skip already processed lines, but continue if batch is empty
            if (this.state.processedLines.has(lineId)) {
                if (batch.length === 0) continue;
                break;
            }
            
            // Stop batching if line type is not output-type
            if (!outputTypes.has(lineData.type)) break;
            
            batch.push({ lineData, index: i });
            
            // Stop batching if line has custom delay
            if (lineData.lineDelay !== undefined) break;
        }
        
        return batch;
    }

    /**
     * Processes a batch of output lines simultaneously
     * Improves performance by parallel processing of similar line types
     * @param {Array} batch - Array of line objects to process
     * @returns {Promise} Promise that resolves when batch is processed
     */
    async processBatch(batch) {
        if (batch.length === 0) return;
        
        // Update current line to first line in batch
        this.state.currentLine = batch[0].lineData.originalIndex;
        
        // Update progress display safely
        if (this.renderer && typeof this.renderer.updateProgressInfo === 'function') {
            this.renderer.updateProgressInfo();
        }
        
        // Create DOM elements for all lines in batch
        const lineElements = batch.map(({ lineData }) => {
            const lineId = `${this.instanceId}_line_${lineData.originalIndex}`;
            const line = this.renderer.createLine(lineData);
            line.setAttribute('data-line-id', lineId);
            return { line, lineData, lineId };
        });
        
        // Process all batch elements in parallel
        await Promise.all(lineElements.map(({ line, lineData }) => 
            this.processLine(line, lineData)
        ));
        
        // Mark all lines as processed
        lineElements.forEach(({ lineId }) => this.state.processedLines.add(lineId));
        
        // Update current line to last line in batch
        this.state.currentLine = batch[batch.length - 1].lineData.originalIndex;
        
        // Update progress display safely
        if (this.renderer && typeof this.renderer.updateProgressInfo === 'function') {
            this.renderer.updateProgressInfo();
        }
        
        // Apply delay after batch processing
        const lastLineData = batch[batch.length - 1].lineData;
        const lastIndex = batch[batch.length - 1].index;
        const delay = lastLineData.lineDelay !== undefined ? 
            lastLineData.lineDelay : 
            this.getLineDelay(lastLineData, lastIndex);
        
        if (delay > 0) await this.wait(delay);
    }

    /**
     * Calculates the delay to apply after a line
     * Uses custom line delay if specified, otherwise uses default logic
     * @param {Object} lineData - Line data object
     * @param {number} i - 当前行索引
     * @returns {number} 延迟（毫秒）
     */
    getLineDelay(lineData, i) {
        // Use custom delay if specified
        if (lineData.lineDelay !== undefined) return lineData.lineDelay;
        
        // No delay between consecutive output lines
        if (i < this.config.lines.length - 1) {
            const next = this.config.lines[i + 1];
            if (lineData.type === 'output' && next.type === 'output') return 0;
        }
        
        // Use default line delay
        return this.timing.lineDelay;
    }

    /**
     * Processes a single line with error handling
     * Delegates to appropriate animator method based on line type
     * @param {HTMLElement} line - DOM element for the line
     * @param {Object} lineData - Line configuration data
     * @returns {Promise} Promise that resolves when line processing completes
     */
    async processLine(line, lineData) {
        try {
            // 发射行开始事件
            this.emit('lineStart', { line: lineData, index: this.state.currentLine });
            
            // 为不同的行类型定义处理器
            const processors = {
                input: () => this.animator.typeText(line, lineData.text, lineData.typeDelay),
                progress: () => this.animator.animateProgress(line, lineData),
                output: () => this.animator.revealText(line, lineData.text),
                image: () => this.animator.renderImage(line, lineData)
            };
            
            // 使用适当的处理器或默认使用输出
            const processor = processors[lineData.type] || processors.output;
            await processor();
            
            // 发射行完成事件
            this.emit('lineComplete', { line: lineData, index: this.state.currentLine });
        } catch (error) {
            // 优雅地处理错误
            console.error(`Error processing line ${this.state.currentLine}:`, error);
            this.emit('lineError', { line: lineData, index: this.state.currentLine, error });
            
            // 后备方案：立即显示文本
            line.textContent = lineData.text || '[Error rendering line]';
            this.container.appendChild(line);
        }
    }

    /**
     * 在快速和正常动画速度之间切换
     * 快速模式将延迟设置为最小值以立即显示
     */
    toggleSpeed() {
        const isFast = this.timing.typeDelay === 0;
        Object.assign(this.timing, isFast ? 
            this.timing.original : 
            { typeDelay: 0, lineDelay: 100, startDelay: 0 }
        );
        this.renderer.updateButton('speed', isFast ? 'fast →' : 'normal →');
    }

    /**
     * 切换动画的暂停状态
     * 跟踪暂停时间以准确计算已用时间
     */
    togglePause() {
        if (this.state.isPaused) {
            // 恢复：将暂停时长添加到总暂停时间
            this.state.pausedTime += Date.now() - this.state.pauseStart;
            this.state.isPaused = false;
            this.emit('resume', { currentLine: this.state.currentLine });
        } else {
            // 暂停：记录暂停开始时间
            this.state.pauseStart = Date.now();
            this.state.isPaused = true;
            this.emit('pause', { currentLine: this.state.currentLine });
        }
        this.renderer.updateButton('pause', this.state.isPaused ? 'play ▶' : 'pause ⏸');
    }

    /**
     * 将终端内容复制到剪贴板
     * 为输入行格式化内容并添加适当的前缀
     * @returns {Promise} 复制操作完成时解析的 Promise
     */
    async copyContent() {
        const lines = [...this.domCache.getAll('.termynal-line')];
        const content = lines.map(line => {
            const type = line.getAttribute('data-ty');
            const text = line.textContent;
            return type === 'input' ? `$ ${text}` : text;
        }).join('\n');
        
        try {
            await navigator.clipboard.writeText(content);
            this.renderer.showNotification('Content copied to clipboard!');
        } catch (err) {
            console.error('Copy failed:', err);
        }
    }

    /**
     * 切换终端的全屏模式
     * 如果当前不在全屏模式则进入，否则退出
     */
    toggleFullscreen() {
        const el = document.fullscreenElement ? document : this.container;
        const action = document.fullscreenElement ? 'exitFullscreen' : 'requestFullscreen';
        el[action]().then(() => {
            if (this.elements.has('fullscreen')) {
                const isFullscreen = document.fullscreenElement;
                this.renderer.updateButton('fullscreen', isFullscreen ? 'exit ⛶' : 'fullscreen ⛶');
            }
        }).catch(err => console.error('Fullscreen error:', err));
    }

    /**
     * 从头重新开始动画
     * 清除所有状态并重置为初始配置
     */
    restart() {
        // Prevent multiple simultaneous restarts
        if (this.state.restarting) return;
        
        // Set restart state and stop current animation
        this.state.restarting = true;
        this.state.isRunning = false;
        this.state.isPaused = false;
        
        // Clear all active timers
        this.timers.clearAll();
        
        // Reset timing to original values
        Object.assign(this.timing, this.timing.original);
        
        // Use timer manager for delayed restart to ensure clean state
        this.timers.setTimeout(() => {
            this.clear();
            this.renderer.resetButtons();
            this.state.processedLines.clear();
            this.state.lineQueue = this.generateLineQueue();
            this.state.restarting = false;
            this.start();
        }, 200);
    }

    /**
     * Clears all rendered lines and resets display state
     * Removes DOM elements and updates progress information
     */
    clear() {
        this.domCache.getAll('.termynal-line').forEach(line => line.remove());
        this.state.currentLine = 0;
        this.state.processedLines.clear();
        this.renderer.updateProgressInfo();
        this.domCache.invalidate();
    }

    // ==================== 公共 API 方法 ====================

    /**
     * Pauses the animation if currently running
     */
    pause() { 
        if (!this.state.isPaused && this.state.isRunning) { 
            this.togglePause(); 
        }
    }
    
    /**
     * Resumes the animation if currently paused
     */
    resume() { 
        if (this.state.isPaused && this.state.isRunning) { 
            this.togglePause(); 
        }
    }
    
    /**
     * Stops the animation and clears all timers
     * Emits stop event for external listeners
     */
    stop() {
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.timers.clearAll();
        this.renderer.resetButtons();
        this.emit('stop', { currentLine: this.state.currentLine });
    }

    /**
     * Emits an event to all registered listeners
     * @param {string} event - 事件名称
     * @param {Object} data - Event data to pass to listeners
     */
    emit(event, data = {}) {
        this.events.emit(event, data);
    }

    /**
     * Comprehensive cleanup method for instance destruction
     * Clears timers, removes DOM elements, and cleans up references
     * @returns {boolean} True if destruction was successful
     */
    destroy() {
        // Clear all active timers
        this.timers.clearAll();
        this.state.isRunning = false;

        // Destroy lazy loading manager
        if (this.lazyManager) {
            this.lazyManager.destroy();
        }
        
        // Remove DOM observer if present
        if (this.domCache && this.domCache.observer) {
            this.domCache.observer.disconnect();
        }
        
        // Remove global reference
        if (window.termynalInstances) {
            window.termynalInstances.delete(this.instanceId);
        }
        
        // 移除事件监听器s
        if (this.events) {
            this.events.removeAllListeners();
        }
        
        // Remove from instance registry
        instanceRegistry.delete(this.container);
        
        // Clean up DOM elements and attributes
        if (this.container) {
            this.container.innerHTML = '';
            this.container.removeAttribute('data-termynal-instance');
            this.container.removeAttribute('data-termynal-global-id');
            this.container.removeAttribute('data-lazy-loading');
        }
        
        return true;
    }

    /**
     * Returns a comprehensive public API for external interaction
     * Provides methods for control, configuration, and monitoring
     * @returns {Object} Public API object with all available methods
     */
    getAPI() {
        return {
            // ==================== CONTROL METHODS ====================
            
            /** Start the animation */
            start: () => this.start(),
            
            /** Pause the animation */
            pause: () => this.pause(),
            
            /** Resume the animation */
            resume: () => this.resume(),
            
            /** Restart the animation from beginning */
            restart: () => this.restart(),
            
            /** Stop the animation */
            stop: () => this.stop(),
            
            /** Clear all displayed lines */
            clear: () => this.clear(),
            
            // ==================== SPEED CONTROL ====================
            
            /** Toggle between fast and normal speed */
            toggleSpeed: () => this.toggleSpeed(),
            
            /**
             * Set animation speed
             * @param {boolean} fast - True for fast mode, false for normal
             */
            setSpeed: (fast) => {
                const isFast = this.timing.typeDelay === 0;
                if (fast && !isFast) this.toggleSpeed();
                else if (!fast && isFast) this.toggleSpeed();
            },

            // ==================== CONTROL BUTTONS ====================

            /**
             * Sets the configuration for control buttons and re-renders the controls.
             * Merges the existing control button configuration with the provided
             * button configuration, updating any existing buttons or adding new ones.
             *
             * @param {Object} buttonConfig - An object where each key is a button
             * name and the value is a boolean indicating if the button should be
             * enabled.
             */
            setControlButtons: (buttonConfig) => {
                this.config.controlButtons = { 
                    ...this.config.controlButtons, 
                    ...buttonConfig 
                };
                this.renderer.renderControls();
            },

            /** Get current control buttons configuration */
            getControlButtons: () => ({ ...this.config.controlButtons }),

            /**
             * Enable a control button
             * @param {string} buttonName - Name of the button to enable
             */
            enableButton: (buttonName) => {
                if (this.config.controlButtons.hasOwnProperty(buttonName)) {
                    this.config.controlButtons[buttonName] = true;
                    this.renderer.renderControls();
                }
            },

            /**
             * Disable a control button
             * @param {string} buttonName - Name of the button to disable
             */
            disableButton: (buttonName) => {
                if (this.config.controlButtons.hasOwnProperty(buttonName)) {
                    this.config.controlButtons[buttonName] = false;
                    this.renderer.renderControls();
                }
            },

            /**
             * Toggles the enabled state of a control button.
             * If the button is currently enabled, it will be disabled, and vice versa.
             * @param {string} buttonName - Name of the button to toggle
             */
            toggleButton: (buttonName) => {
                if (this.config.controlButtons.hasOwnProperty(buttonName)) {
                    this.config.controlButtons[buttonName] = !this.config.controlButtons[buttonName];
                    this.renderer.renderControls();
                }
            },
            
            // ==================== STATUS METHODS ====================
            
            /** 检查动画是否正在运行 */
            isRunning: () => this.state.isRunning,
            
            /** Check if animation is currently paused */
            isPaused: () => this.state.isPaused,
            
            /** 获取当前行索引 */
            getCurrentLine: () => this.state.currentLine,
            
            /** 获取总行数 */
            getTotalLines: () => this.config.lines.length,
            
            /**
             * Get detailed progress information
             * @returns {Object} Progress object with current, total, and percentage
             */
            getProgress: () => ({
                current: this.state.currentLine + 1,
                total: this.config.lines.length,
                percentage: Math.round((this.state.currentLine + 1) / this.config.lines.length * 100)
            }),
            
            // ==================== CONFIGURATION ====================
            
            /** Get current configuration */
            getConfig: () => ({ ...this.config }),
            
            /**
             * Update a configuration value
             * @param {string} key - Configuration key to update
             * @param {*} value - New value for the configuration key
             * @returns {Object} Updated 用于链式调用的 API 对象
             */
            updateConfig: (key, value) => {
                if (this.config[key] !== undefined) this.config[key] = value;
                if (this.timing[key] !== undefined) this.timing[key] = value;
                return this.getAPI();
            },

            // ==================== LAZY LOADING ====================

            /** 检查是否启用延迟加载 */
            isLazyLoaded: () => this.config.lazyLoading,

            /** Check if lazy loading is ready */
            isLazyReady: () => this.lazyManager ? this.lazyManager.isReady() : true,

            /** Force lazy loading and initialize the terminal */
            forceLazyLoad: () => {
                if (this.lazyManager && !this.lazyManager.isReady()) {
                    return this.lazyManager.initializeTerminal();
                }
                return Promise.resolve();
            },

            /** 获取延迟加载信息 */
            getLazyLoadingInfo: () => ({
                enabled: this.config.lazyLoading,
                ready: this.lazyManager ? this.lazyManager.isReady() : true,
                threshold: this.config.intersectionThreshold,
                rootMargin: this.config.rootMargin,
                linesCount: this.config.lines.length
            }),
            
            // ==================== 行管理 ====================
            
            /**
             * 向动画添加单行
             * @param {Object} line - 要添加的行对象
             * @param {number} index - 插入位置（-1 表示末尾）
             * @returns {Object} 用于链式调用的 API 对象
             */
            addLine: (line, index = -1) => {
                if (index === -1) {
                    this.config.lines.push(line);
                } else {
                    this.config.lines.splice(index, 0, line);
                }
                this._lineQueueCache = null; // 使缓存失效
                this.state.lineQueue = this.generateLineQueue();
                return this.getAPI();
            },
            
            /**
             * 向动画添加多行
             * @param {Array} lines - 要添加的行对象数组
             * @param {number} index - 插入位置（-1 表示末尾）
             * @returns {Object} 用于链式调用的 API 对象
             */
            addLines: (lines, index = -1) => {
                if (index === -1) {
                    this.config.lines.push(...lines);
                } else {
                    this.config.lines.splice(index, 0, ...lines);
                }
                this._lineQueueCache = null; // 使缓存失效
                this.state.lineQueue = this.generateLineQueue();
                return this.getAPI();
            },
            
            /**
             * 按索引删除行
             * @param {number} index - 要删除的行的索引
             * @returns {Object} 用于链式调用的 API 对象
             */
            removeLine: (index) => {
                if (index >= 0 && index < this.config.lines.length) {
                    this.config.lines.splice(index, 1);
                    this._lineQueueCache = null; // 使缓存失效
                    this.state.lineQueue = this.generateLineQueue();
                }
                return this.getAPI();
            },
            
            /**
             * 更新现有行
             * @param {number} index - 要更新的行的索引
             * @param {Object} newLine - 新行数据（与现有数据合并）
             * @returns {Object} 用于链式调用的 API 对象
             */
            updateLine: (index, newLine) => {
                if (index >= 0 && index < this.config.lines.length) {
                    this.config.lines[index] = { ...this.config.lines[index], ...newLine };
                    this._lineQueueCache = null; // 使缓存失效
                    this.state.lineQueue = this.generateLineQueue();
                }
                return this.getAPI();
            },
            
            /** 获取所有行的副本 */
            getLines: () => [...this.config.lines],
            
            // ==================== 事件系统 ====================
            
            /**
             * 添加事件监听器
             * @param {string} event - 事件名称
             * @param {Function} callback - 事件处理函数
             */
            on: (event, callback) => this.events.on(event, callback),
            
            /**
             * 移除事件监听器
             * @param {string} event - 事件名称
             * @param {Function} callback - 事件处理函数 to remove
             */
            off: (event, callback) => this.events.off(event, callback),
            
            // ==================== 实用方法 ====================
            
            /** 销毁实例并清理资源 */
            destroy: () => this.destroy(),
            
            /** 获取容器 DOM 元素 */
            getElement: () => this.container,
            
            // ==================== 高级控制 ====================
            
            /**
             * 跳到特定行索引
             * @param {number} lineIndex - 要跳到的行索引
             * @returns {Object} 用于链式调用的 API 对象
             */
            skipToLine: (lineIndex) => {
                if (lineIndex >= 0 && lineIndex < this.config.lines.length) {
                    this.state.currentLine = lineIndex;
                    this.renderer.updateProgressInfo();
                }
                return this.getAPI();
            },
            
            // ==================== 时间控制 ====================
            
            /**
             * 设置时间配置
             * @param {Object} timing - 时间配置对象
             * @returns {Object} 用于链式调用的 API 对象
             */
            setTiming: (timing) => {
                Object.assign(this.timing, timing);
                if (timing.typeDelay !== undefined) this.timing.original.typeDelay = timing.typeDelay;
                if (timing.lineDelay !== undefined) this.timing.original.lineDelay = timing.lineDelay;
                if (timing.startDelay !== undefined) this.timing.original.startDelay = timing.startDelay;
                return this.getAPI();
            },
            
            /** 获取当前时间配置 */
            getTiming: () => ({ ...this.timing }),
            
            // ==================== 性能监控 ====================
            
            /**
             * 获取性能和调试信息
             * @returns {Object} 性能指标对象
             */
            getPerformanceInfo: () => ({
                activeTimers: this.timers.getActiveCount(),
                cacheSize: this.domCache.getCacheSize(),
                processedLines: this.state.processedLines.size,
                instanceId: this.instanceId,
                lazyLoading: this.config.lazyLoading,
                lazyReady: this.lazyManager ? this.lazyManager.isReady() : true
            })
        };
    }
}

// ==================== 全局 API 管理 ====================

// 如果不存在则初始化全局实例映射
if (!window.termynalInstances) {
    window.termynalInstances = new Map();
}

// 创建优化的终端实例
const terminalInstance = new ObsidianTermynal(input);
const api = terminalInstance.getAPI();

// 全局存储 API 以供外部访问
const globalId = terminalInstance.instanceId;
window.termynalInstances.set(globalId, api);
terminalInstance.container.setAttribute('data-termynal-global-id', globalId);

/**
 * 用于更轻松访问 API 的全局辅助函数
 * @param {string} containerId - 用于查找特定实例的容器 ID
 * @returns {Object|undefined} Termynal API 对象，如果未找到则为 undefined
 */
window.getTermynalAPI = function(containerId) {
    if (containerId) {
        // 通过全局 ID 查找容器
        const container = document.querySelector(`[data-termynal-global-id="${containerId}"]`);
        if (container) {
            const globalId = container.getAttribute('data-termynal-global-id');
            return window.termynalInstances.get(globalId);
        }
    }
    
    // 后备方案：返回最近的实例
    const instances = Array.from(window.termynalInstances.values());
    return instances[instances.length - 1];
}