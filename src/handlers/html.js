// 获取HTML页面
export function getHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0a0a12">
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📝</text></svg>">
  
  <!-- Resource Hints: Preconnect for faster DNS + TLS handshake -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net">
  
  <!-- Resource Hints: DNS-prefetch (fallback for older browsers) -->
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.gstatic.com">
  <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
  
  <!-- Phosphor Icons CSS (non-blocking) -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css" media="print" onload="this.media='all'">
  
  <!-- Optimized Google Fonts: reduced weights (400, 500, 600 only) -->
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;600&display=swap" rel="stylesheet">
  
  <!-- Critical CSS (inline for faster FCP) -->
  <style>
${getCriticalStyles()}
  </style>
  
  <!-- Non-critical CSS (async load, still inline) -->
  <style media="print" onload="this.media='all'">
${getNonCriticalStyles()}
  </style>
</head>
<body>
  <!-- HUD 扫描线 -->
  <div class="scan-line"></div>

  <!-- HUD 角落装饰 -->
  <div class="corner-decoration top-left"></div>
  <div class="corner-decoration top-right"></div>
  <div class="corner-decoration bottom-left"></div>
  <div class="corner-decoration bottom-right"></div>

  <div id="loginOverlay" class="login-overlay">
    <div class="login-container">
      <div class="login-icon">🔒</div>
      <h1 class="login-title">访问受限</h1>
      <p class="login-subtitle">请输入口令继续访问 Memos</p>
      <div class="login-input-group">
        <input type="password" id="loginInput" class="login-input" placeholder="在此输入口令..." maxlength="50">
      </div>
      <button id="loginBtn" class="login-btn" onclick="doLogin()">
        <i class="ph ph-sign-in"></i> 进入系统
      </button>
      <div id="loginError" class="login-error">口令错误，请重试</div>
      <p class="login-hint">💡 提示：默认口令为 memos123</p>
    </div>
  </div>

  <div class="layout">
    <div class="sidebar">
      <div class="sidebar-header">
        <span class="status-light"></span>
        <h1 style="font-size: 1.5rem; margin: 0;">MEMOS</h1>
      </div>
      <div class="divider"></div>
      <div class="section-title"><i class="ph ph-calendar-blank"></i> 日历</div>
      <div class="calendar-area">
        <div class="calendar-header">
          <button class="calendar-nav" onclick="changeMonth(-1)"><i class="ph ph-caret-left"></i></button>
          <span class="calendar-month" id="calendarMonth"></span>
          <button class="calendar-nav" onclick="changeMonth(1)"><i class="ph ph-caret-right"></i></button>
        </div>
        <div class="calendar-grid" id="calendarGrid"></div>
      </div>
      
      <div class="tags-area">
        <div class="section-title"><i class="ph ph-tag"></i> 标签</div>
        <div class="tags-list" id="tagsList"></div>
        <div class="add-tag-form">
          <input type="text" id="newTagInput" placeholder="添加新标签..." maxlength="50">
          <button onclick="addTag()"><i class="ph ph-plus"></i></button>
        </div>
      </div>
      
      <div id="filterInfo"></div>
      
      <div class="search-area" id="searchArea" style="display: none;">
        <div class="search-box">
          <input type="text" id="searchInput" class="search-input" placeholder="搜索 memos...">
          <button class="search-action-btn" onclick="searchMemos()" title="搜索"><i class="ph ph-magnifying-glass"></i></button>
          <button class="search-action-btn" onclick="clearSearch()" title="清除"><i class="ph ph-x"></i></button>
        </div>
      </div>

      <div class="export-area" style="margin-bottom: 16px;">
        <div style="display: inline-flex; gap: 8px;">
          <button class="btn" style="background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px; padding: 8px 16px;" onclick="exportData('json')">
            <i class="ph ph-download-simple"></i> 导出 JSON
          </button>
          <button class="btn" style="background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px; padding: 8px 16px;" onclick="exportData('csv')">
            <i class="ph ph-file-csv"></i> 导出 CSV
          </button>
          <button class="btn" style="background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px; padding: 8px 16px;" onclick="document.getElementById('importFileInput').click()">
            <i class="ph ph-upload-simple"></i> 导入
          </button>
          <input type="file" id="importFileInput" accept=".json,.csv" style="display: none;" onchange="importData(this)">
        </div>
        <button id="searchToggleBtn" onclick="toggleSearchBar()" style="background: #1e1e3f; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; margin-left: 8px;">
          <i class="ph ph-magnifying-glass"></i> 搜索
        </button>
      </div>
    </div>
    
    <div class="main">
      <div class="main-header">
        <h1><i class="ph ph-notebook"></i> Memos</h1>
        <div class="main-actions">
          <button onclick="showMobileInput()" title="快速新建" style="background: #22c55e; width: 44px; height: 44px; min-width: 44px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 20px; color: white; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); transition: transform 0.2s ease; flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/></svg>
          </button>
          <button id="themeToggle" onclick="toggleTheme()" style="background: #1e1e3f; width: 44px; height: 44px; min-width: 44px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; border: none; cursor: pointer; transition: transform 0.2s ease; flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" id="sunIcon"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0L4.59 18.01a.996.996 0 000 1.41c.39.39 1.03.39 1.41 0l1.05-1.06z"/></svg>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" id="moonIcon" style="display: none;"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>
          </button>
        </div>
      </div>
      <div class="input-area">
        <textarea id="memoInput" placeholder="Write your thoughts..."></textarea>
        <div style="margin-top: 12px;">
          <input type="text" id="tagsInput" placeholder="Tags (comma separated)...">
        </div>
        <button class="btn" id="addBtn" onclick="addMemo()">
          <i class="ph ph-plus-circle"></i> Add Memo
        </button>
      </div>
      <div class="memos-list" id="memosList"></div>
      <div id="pagination"></div>
    </div>
  </div>
  
  <div id="toastContainer" class="toast-container"></div>
  
  <!-- 滚动到顶部按钮 -->
  <button class="scroll-top-btn" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="回到顶部">
    <i class="ph ph-arrow-up"></i>
  </button>
  
  <div id="shortcutHint" class="shortcut-hint" style="opacity: 0; pointer-events: none;">
    <div><kbd>Ctrl</kbd> + <kbd>/</kbd> 帮助</div>
    <div><kbd>Ctrl</kbd> + <kbd>N</kbd> 新建</div>
    <div><kbd>Ctrl</kbd> + <kbd>F</kbd> 搜索</div>
    <div><kbd>Esc</kbd> 关闭</div>
  </div>
  
  <div id="customModal" class="modal-overlay" style="display: none;">
    <div class="modal-container">
      <div class="modal-header">
        <i class="ph ph-warning-circle modal-icon"></i>
        <h3 class="modal-title">确认操作</h3>
      </div>
      <div class="modal-body">
        <p class="modal-message" id="modalMessage">确定要执行此操作吗？</p>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" id="modalCancel">取消</button>
        <button class="modal-btn modal-btn-danger" id="modalConfirm">确认</button>
      </div>
    </div>
  </div>
  
  <script>
${getClientSideScript()}
  </script>

  <nav class="mobile-nav">
    <button class="mobile-nav-btn active" onclick="switchMobileTab('memos')">
      <i class="ph ph-notebook"></i><span>Memos</span>
    </button>
    <button class="mobile-nav-btn" onclick="toggleMobileSidebar()">
      <i class="ph ph-calendar-blank"></i><span>日历</span>
    </button>
    <button class="mobile-nav-btn" onclick="toggleMobileSidebar()">
      <i class="ph ph-tag"></i><span>标签</span>
    </button>
    <button class="mobile-nav-btn" onclick="toggleMobileSearch()">
      <i class="ph ph-magnifying-glass"></i><span>搜索</span>
    </button>
  </nav>
</body>
</html>`;
}

// 关键 CSS：首屏渲染必需
function getCriticalStyles() {
  return `/* Critical CSS for First Contentful Paint */
:root {
  --bg-primary: #0f0f1a;
  --bg-secondary: #16162a;
  --bg-tertiary: #1e1e3f;
  --glass-bg: rgba(30, 30, 63, 0.6);
  --glass-border: rgba(255, 255, 255, 0.08);
  --text-primary: #ffffff;
  --text-secondary: #a0a0b8;
  --accent-blue: #6366f1;
  --success: #22c55e;
  --error: #ef4444;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
}

body.light-theme {
  --bg-primary: #f8fafc;
  --bg-secondary: #ffffff;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --accent-blue: #4f46e5;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif; background: var(--bg-primary); min-height: 100vh; color: var(--text-primary); }

.layout { display: flex; min-height: 100vh; }
.sidebar { width: 300px; background: var(--glass-bg); backdrop-filter: blur(20px); border-right: 1px solid var(--glass-border); padding: 24px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.main { flex: 1; padding: 32px; max-width: 1400px; margin: 0 auto; }
.main-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; }
h1 { font-size: 2.5rem; font-weight: 700; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

.login-overlay { position: fixed; inset: 0; background: var(--bg-primary); z-index: 10000; display: flex; align-items: center; justify-content: center; }
.login-overlay.hidden { opacity: 0; pointer-events: none; }
.login-container { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: 16px; padding: 48px; max-width: 420px; text-align: center; }
.login-title { font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.login-input { width: 100%; padding: 16px 20px; font-size: 16px; background: var(--bg-secondary); border: 2px solid var(--glass-border); border-radius: 12px; color: var(--text-primary); }
.login-btn { width: 100%; padding: 16px; font-size: 16px; font-weight: 600; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border: none; border-radius: 12px; cursor: pointer; margin-top: 16px; }

.input-area { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); padding: 28px; border-radius: 24px; margin-bottom: 32px; position: sticky; top: 20px; z-index: 100; }
textarea { width: 100%; min-height: 120px; border: 2px solid var(--glass-border); border-radius: 12px; padding: 16px; font-size: 16px; background: var(--bg-secondary); color: var(--text-primary); font-family: inherit; }

.memo { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); padding: 24px; border-radius: 16px; margin-bottom: 24px; }
.memo-content { font-size: 15px; line-height: 1.7; color: var(--text-primary); white-space: pre-wrap; }
.memo-time { font-size: 13px; color: var(--text-secondary); margin-top: 16px; }

/* Skeleton for fast loading perception */
.skeleton { background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 8px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skeleton-card { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; margin-bottom: 24px; }
.skeleton-title { height: 16px; width: 60%; margin-bottom: 12px; }
.skeleton-text { height: 14px; width: 100%; margin-bottom: 8px; }

/* Essential buttons */
.btn { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border: none; padding: 14px 28px; border-radius: 12px; cursor: pointer; font-size: 15px; font-weight: 500; margin-top: 16px; }
.btn:hover { transform: translateY(-2px); }
`;
}

// 非关键 CSS：延迟加载
function getNonCriticalStyles() {
  return `/* Non-critical CSS (loaded async) */
:root {
  --accent-purple: #8b5cf6;
  --accent-glow: rgba(99, 102, 241, 0.4);
  --hud-warning: #fbbf24;
  --hud-data: #22d3ee;
  --hud-success: #34d399;
  --hud-transition-fast: 0.15s ease-out;
}

/* Animations */
.scan-line { position: fixed; height: 2px; width: 100%; background: linear-gradient(90deg, transparent, var(--accent-glow), transparent); animation: scan 8s linear infinite; pointer-events: none; z-index: 9999; will-change: transform, opacity; }
@keyframes scan { 0% { transform: translateY(-2px); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }

.corner-decoration { position: fixed; width: 60px; height: 60px; border: 2px solid var(--accent-blue); opacity: 0.3; pointer-events: none; }
.corner-decoration.top-left { top: 20px; left: 20px; border-right: none; border-bottom: none; }
.corner-decoration.top-right { top: 20px; right: 20px; border-left: none; border-bottom: none; }
.corner-decoration.bottom-left { bottom: 20px; left: 20px; border-right: none; border-top: none; }
.corner-decoration.bottom-right { bottom: 20px; right: 20px; border-left: none; border-top: none; }

.status-light { width: 8px; height: 8px; background: var(--success); border-radius: 50%; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 var(--accent-glow); } 50% { opacity: 0.6; box-shadow: 0 0 10px 5px var(--accent-glow); } }

/* HUD bracket borders */
.memo::before, .memo::after { content: ''; position: absolute; width: 20px; height: 20px; border: 2px solid var(--accent-blue); opacity: 0.5; }
.memo::before { top: 0; left: 0; border-right: none; border-bottom: none; }
.memo::after { bottom: 0; right: 0; border-left: none; border-top: none; }

/* Detailed styles */
.calendar-area { margin-bottom: 32px; background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: 16px; padding: 20px; }
.calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.calendar-nav { background: var(--bg-tertiary); border: 1px solid var(--glass-border); padding: 10px 14px; border-radius: 8px; cursor: pointer; }
.calendar-nav:hover { background: var(--accent-blue); color: white; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
.calendar-day { padding: 10px 6px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.2s ease; }
.calendar-day.selected { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; }
.calendar-day.has-memo { color: var(--accent-blue); font-weight: 500; }
.calendar-day.has-memo::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background: var(--accent-blue); border-radius: 50%; }

.tags-list { display: flex; flex-wrap: wrap; gap: 8px; }
.tag { background: var(--bg-tertiary); color: var(--text-secondary); padding: 6px 14px; border-radius: 20px; font-size: 13px; cursor: pointer; border: 1px solid var(--glass-border); }
.tag:hover { background: var(--accent-blue); color: white; border-color: var(--accent-blue); }
.tag.active { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; }

.pagination { display: flex; justify-content: center; gap: 8px; margin-top: 40px; padding: 24px; }
.pagination button { padding: 10px 16px; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text-secondary); border-radius: 8px; cursor: pointer; }
.pagination button.active { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; }

.memo-actions { position: absolute; top: 16px; right: 16px; display: flex; gap: 8px; opacity: 0; transform: translateY(-10px); transition: all 0.2s ease; }
.memo:hover .memo-actions { opacity: 1; transform: translateY(0); }
.icon-btn { background: var(--bg-secondary); border: 1px solid var(--glass-border); cursor: pointer; padding: 10px; border-radius: 8px; }
.icon-btn:hover { background: var(--accent-blue); color: white; }

/* Responsive */
@media (max-width: 768px) {
  .layout { flex-direction: column; }
  .sidebar { width: 100%; height: auto; position: relative; border-right: none; border-bottom: 1px solid var(--glass-border); padding: 20px; }
  .main { padding: 20px; }
  h1 { font-size: 1.8rem; margin-bottom: 24px; }
  .input-area { position: relative; top: 0; padding: 20px; }
  .mobile-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: var(--glass-bg); backdrop-filter: blur(20px); border-top: 1px solid var(--glass-border); padding: 12px 20px; z-index: 999; justify-content: space-around; }
}

@media (prefers-reduced-motion: reduce) {
  .scan-line, .status-light { animation: none !important; }
}
`;
}

function getStyles() {
  return `/* CSS Variables */
:root {
  --bg-primary: #0f0f1a;
  --bg-secondary: #16162a;
  --bg-tertiary: #1e1e3f;
  --glass-bg: rgba(30, 30, 63, 0.6);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-highlight: rgba(255, 255, 255, 0.05);
  --text-primary: #ffffff;
  --text-secondary: #a0a0b8;
  --text-muted: #6b6b8a;
  --accent-blue: #6366f1;
  --accent-purple: #8b5cf6;
  --accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  --accent-glow: rgba(99, 102, 241, 0.4);
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3);
  --shadow-glow: 0 0 30px rgba(99, 102, 241, 0.3);
  --transition-fast: 0.2s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.4s ease;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* HUD 辅助色 */
  --hud-warning: #fbbf24;
  --hud-data: #22d3ee;
  --hud-success: #34d399;

  /* HUD 动画变量 */
  --hud-transition-fast: 0.15s ease-out;
  --hud-transition-normal: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --hud-transition-slow: 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  --hud-animation-scan: 8s linear infinite;
  --hud-animation-pulse: 2s ease-in-out infinite;
}

body.light-theme {
  --bg-primary: #f8fafc;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f1f5f9;
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(148, 163, 184, 0.2);
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --accent-blue: #4f46e5;
  --accent-purple: #7c3aed;
  --hud-warning: #f59e0b;
  --hud-data: #06b6d4;
  --hud-success: #10b981;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: var(--bg-primary); background-image: linear-gradient(45deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px); background-size: 40px 40px; min-height: 100vh; color: var(--text-primary); line-height: 1.6; }

.layout { display: flex; min-height: 100vh; }
.sidebar { width: 300px; flex-shrink: 0; background: var(--glass-bg); backdrop-filter: blur(20px); border-right: 1px solid var(--glass-border); padding: 24px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.main { flex: 1; padding: 32px; max-width: 1400px; margin: 0 auto; }
.main-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; }
.main-actions { display: flex; align-items: center; gap: 12px; }
h1 { text-align: center; font-size: 2.5rem; font-weight: 700; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }

.input-area { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); padding: 28px; border-radius: var(--radius-xl); margin-bottom: 32px; position: sticky; top: 20px; z-index: 100; }
textarea { width: 100%; min-height: 120px; border: 2px solid var(--glass-border); border-radius: var(--radius-md); padding: 16px; font-size: 16px; resize: vertical; background: var(--bg-secondary); color: var(--text-primary); font-family: inherit; }
textarea:focus { outline: none; border-color: var(--accent-blue); box-shadow: 0 0 0 3px var(--accent-glow); }
#tagsInput { width: 100%; padding: 12px 16px; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); font-size: 14px; background: var(--bg-secondary); color: var(--text-primary); margin-top: 12px; }

.btn { background: var(--accent-gradient); color: white; border: none; padding: 14px 28px; border-radius: var(--radius-md); cursor: pointer; font-size: 15px; font-weight: 500; margin-top: 16px; transition: var(--transition-fast); display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3); }
.btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4); }

.memo { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); padding: 24px; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); transition: var(--transition-normal); position: relative; overflow: hidden; break-inside: avoid; margin-bottom: 24px; }
.memo:hover { transform: translateY(-4px); box-shadow: var(--shadow-glow); border-color: var(--accent-blue); }
.memo-content { font-size: 15px; line-height: 1.7; color: var(--text-primary); white-space: pre-wrap; word-break: break-word; margin-top: 16px; }
.memo-time { font-size: 13px; color: var(--text-muted); margin-top: 16px; display: flex; align-items: center; gap: 6px; }
.memo-actions { position: absolute; top: 16px; right: 16px; display: flex; gap: 8px; opacity: 0; transform: translateY(-10px); transition: var(--transition-fast); }
.memo:hover .memo-actions { opacity: 1; transform: translateY(0); }
.icon-btn { background: var(--bg-secondary); border: 1px solid var(--glass-border); cursor: pointer; padding: 10px; border-radius: var(--radius-sm); transition: var(--transition-fast); display: flex; align-items: center; justify-content: center; color: var(--text-secondary); }
.icon-btn:hover { background: var(--accent-blue); color: white; border-color: var(--accent-blue); transform: scale(1.1); }

.calendar-area { margin-bottom: 32px; background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: 20px; }
.calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.calendar-nav { background: var(--bg-tertiary); border: 1px solid var(--glass-border); padding: 10px 14px; border-radius: var(--radius-sm); cursor: pointer; font-size: 14px; color: var(--text-secondary); transition: var(--transition-fast); }
.calendar-nav:hover { background: var(--accent-blue); color: white; }
.calendar-month { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
.calendar-day-header { font-size: 12px; color: var(--text-muted); padding: 8px 0; font-weight: 500; }
.calendar-day { padding: 10px 6px; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; transition: var(--transition-fast); color: var(--text-secondary); position: relative; }
.calendar-day:hover { background: var(--glass-highlight); color: var(--text-primary); }
.calendar-day.selected { background: var(--accent-gradient); color: white; font-weight: 500; }
.calendar-day.has-memo { color: var(--accent-blue); font-weight: 500; }
.calendar-day.has-memo::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background: var(--accent-blue); border-radius: 50%; }
.calendar-day.other-month { color: var(--text-muted); opacity: 0.5; }
.calendar-day.today { border: 2px solid var(--accent-blue); color: var(--accent-blue); font-weight: 600; }

.sidebar-title { font-size: 14px; font-weight: 600; color: var(--text-muted); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px; }
.tags-list { display: flex; flex-wrap: wrap; gap: 8px; }
.tag { background: var(--bg-tertiary); color: var(--text-secondary); padding: 6px 14px; border-radius: 20px; font-size: 13px; cursor: pointer; transition: var(--transition-fast); border: 1px solid var(--glass-border); display: inline-flex; align-items: center; gap: 6px; }
.tag:hover { background: var(--accent-blue); color: white; border-color: var(--accent-blue); transform: translateY(-1px); }
.tag.active { background: var(--accent-gradient); color: white; border-color: transparent; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
.tag-delete { opacity: 0.6; font-size: 16px; margin-left: 4px; }
.tag-delete:hover { opacity: 1; transform: scale(1.2); }

.add-tag-form { display: flex; gap: 8px; margin-top: 12px; }
.add-tag-form input { flex: 1; padding: 10px 14px; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); font-size: 13px; background: var(--bg-secondary); color: var(--text-primary); }
.add-tag-form button { padding: 10px 16px; background: var(--success); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; }

.pagination { display: flex; justify-content: center; gap: 8px; margin-top: 40px; padding: 24px; }
.pagination button { padding: 10px 16px; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text-secondary); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition-fast); font-weight: 500; min-width: 40px; }
.pagination button:hover:not(:disabled) { background: var(--bg-tertiary); color: var(--text-primary); border-color: var(--accent-blue); }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination button.active { background: var(--accent-gradient); color: white; }

.search-area { margin-bottom: 16px; }
.search-box { display: flex; align-items: center; background: var(--bg-secondary); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 4px 4px 4px 12px; }
.search-box:focus-within { border-color: var(--accent-blue); box-shadow: 0 0 0 2px var(--accent-glow); }
.search-input { border: none; background: transparent; flex: 1; padding: 8px 0; color: var(--text-primary); outline: none; font-size: 14px; }
.search-action-btn { background: transparent; border: none; color: var(--text-muted); padding: 8px; cursor: pointer; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.search-action-btn:hover { background: var(--bg-tertiary); color: var(--accent-blue); }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; opacity: 0; transition: opacity 0.3s ease; }
.modal-overlay.active { opacity: 1; }
.modal-container { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: 28px; max-width: 420px; width: 90%; box-shadow: var(--shadow-md); transform: scale(0.9) translateY(20px); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-overlay.active .modal-container { transform: scale(1) translateY(0); }
.modal-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.modal-icon { font-size: 28px; color: var(--warning); }
.modal-title { font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 0; }
.modal-message { font-size: 15px; color: var(--text-secondary); line-height: 1.6; margin: 0; }
.modal-footer { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
.modal-btn { padding: 12px 24px; border-radius: var(--radius-md); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; border: none; }
.modal-btn-secondary { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--glass-border); }
.modal-btn-danger { background: var(--error); color: white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

.login-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--bg-primary); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.login-overlay.hidden { opacity: 0; pointer-events: none; transition: opacity 0.5s ease; }
.login-container { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: 48px; max-width: 420px; width: 100%; text-align: center; box-shadow: var(--shadow-md), 0 0 60px rgba(99, 102, 241, 0.2); animation: loginAppear 0.6s ease-out; }
@keyframes loginAppear { from { opacity: 0; transform: scale(0.9) translateY(30px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.login-icon { font-size: 64px; margin-bottom: 24px; animation: iconFloat 3s ease-in-out infinite; }
@keyframes iconFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.login-title { font-size: 28px; font-weight: 700; margin-bottom: 8px; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.login-subtitle { color: var(--text-secondary); margin-bottom: 32px; font-size: 15px; }
.login-input-group { margin-bottom: 16px; }
.login-input { width: 100%; padding: 16px 20px; font-size: 16px; background: var(--bg-secondary); border: 2px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); transition: all 0.3s ease; text-align: center; letter-spacing: 2px; }
.login-input:focus { outline: none; border-color: var(--accent-blue); box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
.login-btn { width: 100%; padding: 16px; font-size: 16px; font-weight: 600; background: var(--accent-gradient); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4); }
.login-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5); }
.login-error { color: var(--error); font-size: 14px; margin-top: 16px; display: none; animation: shake 0.5s ease; }
.login-error.show { display: block; }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
.login-hint { color: var(--text-muted); font-size: 13px; margin-top: 24px; }

.toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; }
.toast { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 16px 20px; min-width: 280px; max-width: 400px; box-shadow: var(--shadow-md); display: flex; align-items: center; gap: 12px; animation: toastSlideIn 0.3s ease; }
@keyframes toastSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.toast-icon { font-size: 24px; flex-shrink: 0; }
.toast-title { font-weight: 600; font-size: 14px; color: var(--text-primary); }
.toast-message { font-size: 13px; color: var(--text-secondary); }
.toast-action { background: var(--accent-gradient); color: white; border: none; padding: 6px 12px; border-radius: var(--radius-sm); font-size: 12px; cursor: pointer; font-weight: 500; margin-left: 12px; }

.shortcut-hint { position: fixed; bottom: 20px; left: 20px; background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 12px 16px; font-size: 12px; color: var(--text-muted); z-index: 100; transition: opacity 0.3s ease; }
.shortcut-hint kbd { background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-family: monospace; border: 1px solid var(--glass-border); margin: 0 2px; }

.mobile-nav { display: none; }

@media (max-width: 1200px) { .memos-list { column-count: 2; } }
@media (max-width: 768px) {
  .layout { flex-direction: column; }
  .sidebar { width: 100%; height: auto; position: relative; border-right: none; border-bottom: 1px solid var(--glass-border); padding: 20px; }
  .main { padding: 20px; }
  h1 { font-size: 1.8rem; margin-bottom: 24px; }
  .memos-list { column-count: 1; }
  .input-area { position: relative; top: 0; padding: 20px; }
  
  .mobile-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: var(--glass-bg); backdrop-filter: blur(20px); border-top: 1px solid var(--glass-border); padding: 12px 20px; z-index: 999; justify-content: space-around; align-items: center; }
  .mobile-nav-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; color: var(--text-secondary); font-size: 12px; cursor: pointer; padding: 8px 16px; border-radius: var(--radius-md); transition: all 0.2s; min-width: 60px; }
  .mobile-nav-btn i { font-size: 24px; }
  .mobile-nav-btn.active { color: var(--accent-blue); background: rgba(99, 102, 241, 0.1); }

  .main-actions button:first-child { position: fixed; bottom: 100px; right: 20px; width: 56px; height: 56px; font-size: 24px; z-index: 998; }
  .main { padding-bottom: 100px; }

  /* Markdown Styles */
  .memo-content strong { font-weight: 700; color: var(--text-primary); }
  .memo-content em { font-style: italic; color: var(--text-secondary); }
  .memo-content del { text-decoration: line-through; color: var(--text-muted); }
  .memo-content a { color: var(--accent-blue); text-decoration: none; }
  .memo-content a:hover { text-decoration: underline; }
  .memo-content .md-image { max-width: 100%; height: auto; border-radius: var(--radius-sm); margin: 8px 0; }
  .memo-content pre { background: var(--bg-tertiary); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); padding: 16px; overflow-x: auto; margin: 12px 0; }
  .memo-content code.inline { background: var(--bg-tertiary); padding: 2px 8px; border-radius: 4px; font-family: 'Fira Code', 'Consolas', monospace; font-size: 0.9em; color: var(--accent-purple); }
  .memo-content pre code { display: block; font-family: 'Fira Code', 'Consolas', monospace; font-size: 13px; line-height: 1.5; color: var(--text-primary); white-space: pre; }
  .memo-content blockquote { border-left: 3px solid var(--accent-blue); padding-left: 16px; margin: 12px 0; color: var(--text-secondary); font-style: italic; background: var(--glass-highlight); padding: 12px 16px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
  .memo-content h1, .memo-content h2, .memo-content h3 { margin: 16px 0 8px; font-weight: 600; color: var(--text-primary); }
  .memo-content h1 { font-size: 1.5em; }
  .memo-content h2 { font-size: 1.3em; }
  .memo-content h3 { font-size: 1.1em; }
  .memo-content ul, .memo-content ol { padding-left: 24px; margin: 8px 0; }
  .memo-content li { margin: 4px 0; }
  .memo-content hr { border: none; border-top: 1px solid var(--glass-border); margin: 16px 0; }
  .memo-content .highlight { background: var(--warning); color: #000; padding: 2px 4px; border-radius: 2px; }

  body.light-theme .memo-content pre { background: #f1f5f9; }
  body.light-theme .memo-content code.inline { background: #e2e8f0; }
  body.light-theme .memo-content blockquote { background: #f1f5f9; }

  /* ===== HUD 扫描线 ===== */
  .scan-line {
    position: fixed;
    height: 2px;
    width: 100%;
    background: linear-gradient(90deg, transparent, var(--accent-glow), transparent);
    animation: scan 8s linear infinite;
    pointer-events: none;
    z-index: 9999;
    will-change: transform, opacity;
  }

  @keyframes scan {
    0% { transform: translateY(-2px); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(100vh); opacity: 0; }
  }

  body.light-theme .scan-line {
    background: linear-gradient(90deg, transparent, rgba(79, 70, 229, 0.3), transparent);
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .scan-line { display: none; }
  }

  /* ===== HUD 角落装饰 ===== */
  .corner-decoration {
    position: fixed;
    width: 60px;
    height: 60px;
    border: 2px solid var(--accent-blue);
    opacity: 0.3;
    pointer-events: none;
  }
  .corner-decoration.top-left { top: 20px; left: 20px; border-right: none; border-bottom: none; }
  .corner-decoration.top-right { top: 20px; right: 20px; border-left: none; border-bottom: none; }
  .corner-decoration.bottom-left { bottom: 20px; left: 20px; border-right: none; border-top: none; }
  .corner-decoration.bottom-right { bottom: 20px; right: 20px; border-left: none; border-top: none; }
  body.light-theme .corner-decoration { border-color: var(--accent-blue); opacity: 0.2; }

  /* ===== HUD 括号边框 ===== */
  .memo::before,
  .memo::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    border: 2px solid var(--accent-blue);
    opacity: 0.5;
  }
  .memo::before { top: 0; left: 0; border-right: none; border-bottom: none; }
  .memo::after { bottom: 0; right: 0; border-left: none; border-top: none; }
  .memo.important { border-left: 3px solid var(--accent-blue); box-shadow: var(--shadow-md); }
  .memo.highlighted { transform: translateY(-4px); box-shadow: var(--shadow-glow); border-color: var(--accent-blue); }
  body.light-theme .memo::before, body.light-theme .memo::after { border-color: var(--accent-blue); opacity: 0.3; }

  /* ===== 卡片状态栏 ===== */
  .memo-status { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--text-muted); padding-bottom: 12px; border-bottom: 1px solid var(--glass-border); margin-bottom: 16px; }
  .memo-time { display: flex; align-items: center; gap: 4px; }
  .memo-tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .memo-type { margin-left: auto; font-size: 10px; padding: 2px 6px; background: var(--bg-tertiary); border-radius: 4px; color: var(--text-muted); }

  /* ===== HUD 状态指示灯 ===== */
  .status-light { width: 8px; height: 8px; background: var(--success); border-radius: 50%; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 var(--accent-glow); } 50% { opacity: 0.6; box-shadow: 0 0 10px 5px var(--accent-glow); } }

  /* ===== 斜角标签 ===== */
  .tag { clip-path: polygon(12% 0, 100% 0, 88% 100%, 0 100%); padding: 6px 18px; background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--glass-border); border-radius: 0; font-size: 13px; cursor: pointer; transition: all var(--transition-fast); display: inline-flex; align-items: center; gap: 6px; }
  .tag:hover { background: var(--accent-blue); color: white; border-color: var(--accent-blue); transform: translateY(-1px); }
  .tag.active { background: var(--accent-gradient); color: white; border-color: transparent; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
  .tag-delete { opacity: 0.6; font-size: 16px; margin-left: 4px; }
  .tag-delete:hover { opacity: 1; transform: scale(1.2); }
  .tag-count { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; background: var(--bg-secondary); border-radius: 10px; font-size: 11px; font-weight: 600; margin-left: 8px; }

  /* ===== 区块标题 ===== */
  .section-title { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .section-title::before { content: ''; width: 3px; height: 12px; background: var(--accent-gradient); border-radius: 2px; }
  .divider { height: 1px; background: linear-gradient(90deg, transparent, var(--glass-border), transparent); margin: 16px 0; }

  /* ===== 按钮状态系统 ===== */
  .btn { position: relative; background: var(--accent-gradient); color: white; border: none; padding: 14px 28px; border-radius: var(--radius-md); cursor: pointer; font-size: 15px; font-weight: 500; margin-top: 16px; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3); overflow: hidden; }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4); }
  .btn:active { transform: translateY(0) scale(0.98); box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); transform: translateX(-100%); transition: transform 0.5s; }
  .btn:hover::before { transform: translateX(100%); }
  .btn.loading { pointer-events: none; color: transparent; }
  .btn.loading::after { content: ''; position: absolute; width: 20px; height: 20px; border: 2px solid transparent; border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; left: 50%; top: 50%; margin-left: -10px; margin-top: -10px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ===== Toast 通知 ===== */
  .toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; }
  .toast { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 16px 20px; min-width: 280px; max-width: 400px; box-shadow: var(--shadow-md); display: flex; align-items: center; gap: 12px; animation: toastSlideIn 0.3s ease; }
  @keyframes toastSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .toast-icon { font-size: 24px; flex-shrink: 0; }
  .toast-title { font-weight: 600; font-size: 14px; color: var(--text-primary); }
  .toast-message { font-size: 13px; color: var(--text-secondary); }
  .toast-action { background: var(--accent-gradient); color: white; border: none; padding: 6px 12px; border-radius: var(--radius-sm); font-size: 12px; cursor: pointer; font-weight: 500; margin-left: 12px; }
  .toast.success { border-left: 3px solid var(--success); }
  .toast.warning { border-left: 3px solid var(--warning); }
  .toast.error { border-left: 3px solid var(--error); }
  .toast.info { border-left: 3px solid var(--hud-data); }

  /* ===== 骨架屏 ===== */
  .skeleton { background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-sm); }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .skeleton-card { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 24px; break-inside: avoid; }
  .skeleton-title { height: 16px; width: 60%; margin-bottom: 12px; }
  .skeleton-text { height: 14px; width: 100%; margin-bottom: 8px; }
  .skeleton-text:last-child { width: 80%; margin-bottom: 0; }
  
  /* 骨架卡片动画延迟 */
  .skeleton-card:nth-child(1) .skeleton { animation-delay: 0s; }
  .skeleton-card:nth-child(2) .skeleton { animation-delay: 0.05s; }
  .skeleton-card:nth-child(3) .skeleton { animation-delay: 0.1s; }
  .skeleton-card:nth-child(4) .skeleton { animation-delay: 0.15s; }
  .skeleton-card:nth-child(5) .skeleton { animation-delay: 0.2s; }
  
  /* 图片 blur placeholder */
  .md-image-wrapper { position: relative; overflow: hidden; }
  .md-image-wrapper blur-placeholder { position: absolute; inset: 0; }
  .md-image { max-width: 100%; height: auto; border-radius: var(--radius-sm); display: block; }

  /* ===== Modal 对话框 ===== */
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; opacity: 0; transition: opacity 0.3s ease; }
  .modal-overlay.active { opacity: 1; }
  .modal-container { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: 28px; max-width: 420px; width: 90%; box-shadow: var(--shadow-md); transform: scale(0.9) translateY(20px); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .modal-overlay.active .modal-container { transform: scale(1) translateY(0); }
  .modal-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .modal-icon { font-size: 28px; color: var(--warning); }
  .modal-title { font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 0; }
  .modal-message { font-size: 15px; color: var(--text-secondary); line-height: 1.6; margin: 0; }
  .modal-footer { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
  .modal-btn { padding: 12px 24px; border-radius: var(--radius-md); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; border: none; }
  .modal-btn-secondary { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--glass-border); }
  .modal-btn-secondary:hover { background: var(--bg-secondary); color: var(--text-primary); }
  .modal-btn-danger { background: var(--error); color: white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
  .modal-btn-danger:hover { box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4); transform: translateY(-1px); }

  /* ===== 卡片入场动画 ===== */
  @keyframes memoEnter { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .memo { --stagger-delay: 0; animation: memoEnter var(--hud-transition-slow) calc(var(--stagger-delay) * 50ms) backwards; }

  /* ===== 侧边栏标题 ===== */
  .sidebar-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .sidebar-header h1 { font-size: 1.5rem; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

  /* ===== 性能优化 ===== */
  .memo, .btn, .modal-container, .scan-line { will-change: transform, opacity; }
  .memo { contain: layout style paint; }
  .skeleton-card { contain: layout style; }
  
  /* 滚动到顶部按钮 */
  .scroll-top-btn {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    box-shadow: var(--shadow-md);
    transition: opacity 0.3s ease, transform 0.2s ease;
    opacity: 0;
    visibility: hidden;
    z-index: 1000;
  }
  .scroll-top-btn.visible { opacity: 1; visibility: visible; }
  .scroll-top-btn:hover { transform: translateY(-3px); background: var(--accent-blue); color: white; }
  .scroll-top-btn:active { transform: scale(0.95); }

  /* ===== 无障碍：减少动画 ===== */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
    .scan-line, .status-light { animation: none !important; }
  }
`;

function getClientSideScript() {
  // Markdown 解析缓存 - 性能优化
  const mdCache = new Map();
  const MAX_CACHE_SIZE = 100;

  // 快速检测 Markdown 语法（避免不必要的解析）
  function hasMarkdown(text) {
    if (!text || text.length < 3) return false;
    // 快速检测：检查常见 MD 标记，避免正则开销
    return text.includes('**') || text.includes('__') ||
           text.includes('`') || text.includes('~~') ||
           text.includes('##') || /^> /.test(text) ||
           (text.includes('[') && text.includes(']('));
  }

  // 轻量级 Markdown 解析器（带缓存）
  function parseMarkdown(text) {
    if (!text) return '';
    const cacheKey = text.length > 500 ? text.substring(0, 100) + text.length : text;

    // 检查缓存
    if (mdCache.has(cacheKey)) return mdCache.get(cacheKey);

    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="inline">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(m, t, u) {
        try { var p = new URL(u, location.origin);
          if(p.protocol==='http:'||p.protocol==='https:'||p.protocol==='mailto:')
            return '<a href="'+p.href+'" target="_blank" rel="noopener noreferrer">'+t+'</a>';
        } catch(e) {}
        return t;
      })
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(m, a, u) {
        try { var p = new URL(u, location.origin);
          if(p.protocol==='http:'||p.protocol==='https:')
            return '<div class="md-image-wrapper" style="position:relative;overflow:hidden;border-radius:var(--radius-sm);margin:8px 0;"><img src="'+p.href+'" alt="'+a+'" class="md-image" loading="lazy" decoding="async" style="opacity:0;transition:opacity 0.3s ease;" onload="this.style.opacity=\'1\';this.parentElement.querySelector(\'blur-placeholder\')?.remove();" onerror="this.style.opacity=\'1\';"><blur-placeholder style="position:absolute;inset:0;background:linear-gradient(90deg,var(--bg-tertiary),var(--bg-secondary),var(--bg-tertiary));background-size:200%100%;animation:shimmer 1.5s infinite;border-radius:var(--radius-sm);"></blur-placeholder></div>';
        } catch(e) {}
        return '';
      })
      .replace(/^&gt;\s*(.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\n/g, '<br>');

    // 合并连续的 <li> 为 <ul> - 性能优化版本
    const lines = html.split('<br>');
    let inList = false, result = [];
    for (let line of lines) {
      if (line.startsWith('<li>')) {
        if (!inList) { result.push('<ul>'); inList = true; }
        result.push(line);
      } else {
        if (inList) { result.push('</ul>'); inList = false; }
        result.push(line);
      }
    }
    if (inList) result.push('</ul>');
    html = result.join('').replace(/<\/blockquote><br><blockquote>/g, '<br>');

    // 缓存管理：限制缓存大小避免内存泄漏
    if (mdCache.size >= MAX_CACHE_SIZE) {
      const firstKey = mdCache.keys().next().value;
      mdCache.delete(firstKey);
    }
    mdCache.set(cacheKey, html);

    return html;
  }

  return `var editingId=null,currentMonth=new Date(),selectedDate=null,selectedTag=null,allMemos=[],refreshInterval=null,currentPage=1,currentSearchKeyword="",lastDeletedMemo=null,undoTimeout=null,modalResolve=null;
var monthNames=["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
var dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
(function(){if("true"===sessionStorage.getItem("memos_logged_in"))document.getElementById("loginOverlay").classList.add("hidden")})();
window.doLogin=function(){var e=document.getElementById("loginInput"),t=document.getElementById("loginBtn"),n=document.getElementById("loginError"),o=e.value.trim();if(!o)return n.textContent="请输入口令",n.classList.add("show"),void e.focus();t.disabled=!0,t.innerHTML='<span style="display:inline-block;width:20px;height:20px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 1s linear infinite;margin-right:8px;"></span> 验证中...';fetch("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:o})}).then(function(e){return e.json()}).then(function(i){i.success?(sessionStorage.setItem("memos_logged_in","true"),sessionStorage.setItem("memos_token",i.token),document.getElementById("loginOverlay").classList.add("hidden"),e.value=""):(n.textContent=i.error||"口令错误",n.classList.add("show"),e.value="",e.focus()),t.disabled=!1,t.innerHTML='<i class="ph ph-sign-in"></i> 进入系统'}).catch(function(){n.textContent="验证失败，请重试",n.classList.add("show"),t.disabled=!1,t.innerHTML='<i class="ph ph-sign-in"></i> 进入系统'})};
document.getElementById("loginInput").addEventListener("keypress",function(e){"Enter"===e.key&&window.doLogin()});
function renderCalendar(){var e=currentMonth.getFullYear(),t=currentMonth.getMonth();document.getElementById("calendarMonth").textContent=e+"年 "+monthNames[t];var n={};allMemos.forEach(function(o){var i=new Date(o.createdAt);i.getFullYear()===e&&i.getMonth()===t&&(n[i.getDate()]=!0)});var o=new Date(e,t,1),i=new Date(e,t+1,0),a=o.getDay(),d=i.getDate(),s=new Date,l="";for(var r=0;r<dayNames.length;r++)l+='<div class="calendar-day-header">'+dayNames[r]+"</div>";var c=new Date(e,t,0).getDate();for(var u=a-1;u>=0;u--)l+='<div class="calendar-day other-month">'+(c-u)+"</div>";for(var m=1;m<=d;m++){var g=e===s.getFullYear()&&t===s.getMonth()&&m===s.getDate(),p=selectedDate&&e===selectedDate.getFullYear()&&t===selectedDate.getMonth()&&m===selectedDate.getDate(),h=n[m],v="calendar-day";g&&(v+=" today"),p&&(v+=" selected"),h&&(v+=" has-memo"),l+='<div class="'+v+'" onclick="selectDate('+e+", "+t+", "+m+')">'+m+"</div>"}var f=a+d,y=42-f;for(var b=1;b<=y;b++)l+='<div class="calendar-day other-month">'+b+"</div>";document.getElementById("calendarGrid").innerHTML=l}
window.changeMonth=function(e){currentMonth.setMonth(currentMonth.getMonth()+e),renderCalendar()};
window.selectDate=function(e,t,n){selectedDate=new Date(e,t,n),selectedTag=null,currentPage=1,renderCalendar(),filterByDate(selectedDate)};
function filterByDate(e){var t=e.getFullYear(),n=String(e.getMonth()+1).padStart(2,"0"),o=String(e.getDate()).padStart(2,"0"),i=t+"-"+n+"-"+o;showLoading(),fetch("/api/memos?date="+i+"&page="+currentPage).then(function(e){return e.json()}).then(function(t){renderMemos(t.memos),renderPagination(t.pagination);var n=e.toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric"});document.getElementById("filterInfo").innerHTML='<div class="filter-info"><span>'+n+'</span><button class="clear-filter" onclick="clearFilter()">清除</button></div>'})}
window.clearFilter=function(){selectedDate=null,selectedTag=null,currentPage=1,currentSearchKeyword="",renderCalendar(),document.getElementById("filterInfo").innerHTML="",loadMemos()};
function showLoading(){document.getElementById("memosList").innerHTML='<div class="skeleton-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div></div><div class="skeleton-card"><div class="skeleton skeleton-title" style="width:45%"></div><div class="skeleton skeleton-text" style="width:90%"></div><div class="skeleton skeleton-text"></div></div><div class="skeleton-card"><div class="skeleton skeleton-title" style="width:70%"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text" style="width:75%"></div><div class="skeleton skeleton-text"></div></div><div class="skeleton-card"><div class="skeleton skeleton-title" style="width:55%"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text" style="width:85%"></div></div><div class="skeleton-card"><div class="skeleton skeleton-title" style="width:65%"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text" style="width:60%"></div></div>'}
function showEmpty(){document.getElementById("memosList").innerHTML='<div class="empty-state"><div class="empty-state-icon"><i class="ph ph-notebook" style="font-size: 64px;"></i></div><div class="empty-state-text">暂无 memo</div></div>'}
function loadMemos(){var e="/api/memos?page="+currentPage;if(selectedDate){var t=selectedDate.getFullYear(),n=String(selectedDate.getMonth()+1).padStart(2,"0"),o=String(selectedDate.getDate()).padStart(2,"0");e="/api/memos?date="+t+"-"+n+"-"+o+"&page="+currentPage}else selectedTag&&(e="/api/memos?tag="+encodeURIComponent(selectedTag)+"&page="+currentPage);reportPerf('load-memos-start');fetch(e).then(function(e){return e.json()}).then(function(e){allMemos=e.memos||[],renderCalendar(),editingId||renderMemos(e.memos),renderPagination(e.pagination),checkVirtualScroll(e.pagination?.total||0),reportPerf('load-memos-complete')}).catch(function(){document.getElementById("memosList").innerHTML='<div class="empty-state"><div class="empty-state-text" style="color: var(--error);">加载失败</div></div>'})}
function renderMemos(e){var t=document.getElementById("memosList");if(!e||0===e.length)return showEmpty(),void 0;var n="";e.forEach(function(e){var o=e.tags&&e.tags.length>0?'<div class="memo-tags">'+e.tags.map(function(e){var t="object"==typeof e?e.name:e;return'<span class="tag" onclick="event.stopPropagation();filterByTag('+"'"+t+"'"+')">'+t+"</span>"}).join("")+"</div>":"";if(editingId===e.id){var i=e.tags?e.tags.map(function(e){return"object"==typeof e?e.name:e}).join(", "):"";n+='<div class="memo" id="memo-'+e.id+'"><textarea id="edit-'+e.id+'" style="width:100%;min-height:200px;border:2px solid var(--accent-blue);border-radius:var(--radius-md);padding:12px;font-size:15px;background:var(--bg-secondary);color:var(--text-primary);">'+escapeHtml(e.content)+'</textarea><input type="text" id="edit-tags-'+e.id+'" value="'+escapeHtml(i)+'" placeholder="Tags..." style="width:100%;margin-top:10px;padding:10px 12px;border:1px solid var(--glass-border);border-radius:var(--radius-sm);font-size:13px;background:var(--bg-secondary);color:var(--text-primary);"><div class="memo-time"><i class="ph ph-clock"></i> '+new Date(e.createdAt).toLocaleString("zh-CN")+'</div><div class="memo-actions"><button class="icon-btn" onclick="saveEdit('+e.id+')" title="Save"><i class="ph ph-check"></i></button><button class="icon-btn" onclick="cancelEdit()" title="Cancel"><i class="ph ph-x"></i></button></div></div>'}else{var a=hasMarkdown(e.content)?parseMarkdown(e.content):escapeHtml(e.content);currentSearchKeyword&&(a=a.replace(new RegExp("("+escapeHtml(currentSearchKeyword)+")","gi"),'<span class="highlight">$1</span>')),n+='<div class="memo" id="memo-'+e.id+'"><div class="memo-content">'+a+"</div>"+o+'<div class="memo-time"><i class="ph ph-clock"></i> '+new Date(e.createdAt).toLocaleString("zh-CN")+'</div><div class="memo-actions"><button class="icon-btn" onclick="startEdit('+e.id+')" title="Edit"><i class="ph ph-pencil-simple"></i></button><button class="icon-btn" onclick="deleteMemo('+e.id+')" title="Delete"><i class="ph ph-trash"></i></button></div></div>'}}),t.innerHTML=n}
function renderPagination(e){if(!e||e.totalPages<=1)return document.getElementById("pagination").innerHTML="",void 0;var t='<div class="pagination">';t+='<button onclick="goToPage('+(e.page-1)+')" '+(1===e.page?"disabled":"")+'><i class="ph ph-caret-left"></i></button>';for(var n=1;n<=e.totalPages;n++)1===n||n===e.totalPages||n>=e.page-2&&n<=e.page+2?t+='<button onclick="goToPage('+n+')" '+(n===e.page?'class="active"':"")+">"+n+"</button>":(n===e.page-3||n===e.page+3)&&(t+='<span style="padding: 8px;color:var(--text-muted);">...</span>');t+='<button onclick="goToPage('+(e.page+1)+')" '+(e.page===e.totalPages?"disabled":"")+'><i class="ph ph-caret-right"></i></button>',t+="</div>",t+='<div class="pagination-info">第 '+e.page+" 页，共 "+e.totalPages+" 页 ("+e.total+" 条)</div>",document.getElementById("pagination").innerHTML=t}
window.goToPage=function(e){if(!(e<1))currentPage=e,showLoading(),loadMemos()};
function escapeHtml(e){var t=document.createElement("div");return t.textContent=e,t.innerHTML}
window.addMemo=async function(){var e=document.getElementById("memoInput"),t=document.getElementById("tagsInput"),n=e.value.trim();if(!n)return await showModal("请输入 Memo 内容","提示",!1),void 0;var o=t.value.trim(),i=o?o.split(",").map(function(e){return e.trim()}).filter(function(e){return e}):[];fetch("/api/memos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:n,tags:i})}).then(function(t){if(!t.ok)throw new Error("Failed");e.value="",t.value="",loadMemos(),loadTags()}).catch(async function(){await showModal("添加失败，请重试","错误",!0)})};
window.deleteMemo=async function(e){var t=allMemos.find(function(t){return t.id===e});if(await showModal("确定要删除这条 memo 吗？","删除确认",!0))fetch("/api/memos/"+e,{method:"DELETE"}).then(function(){lastDeletedMemo=t,loadMemos(),loadTags(),showToast({title:"已删除",message:"Memo 已成功删除",type:"success",action:{text:"撤销"},duration:5e3}),undoTimeout&&clearTimeout(undoTimeout),undoTimeout=setTimeout(function(){lastDeletedMemo=null},5e3)})};
window.undoDelete=async function(){if(lastDeletedMemo)fetch("/api/memos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:lastDeletedMemo.content,tags:lastDeletedMemo.tags?lastDeletedMemo.tags.map(function(e){return"object"==typeof e?e.name:e}):[]})}).then(function(){showToast({title:"已撤销",message:"Memo 已恢复",type:"success",duration:3e3}),lastDeletedMemo=null,undoTimeout&&clearTimeout(undoTimeout),loadMemos(),loadTags()})};
window.startEdit=function(e){editingId=e,refreshInterval&&(clearInterval(refreshInterval),refreshInterval=null),renderMemos(allMemos),setTimeout(function(){var t=document.getElementById("edit-"+e);t&&(t.focus(),t.setSelectionRange(t.value.length,t.value.length))},50)};
window.saveEdit=function(e){var t=document.getElementById("edit-"+e),n=document.getElementById("edit-tags-"+e),o=t.value.trim();if(!o)return alert("内容不能为空");var i=n?n.value.trim():"",a=i?i.split(",").map(function(e){return e.trim()}).filter(function(e){return e}):[];fetch("/api/memos/"+e,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:o,tags:a})}).then(function(){editingId=null,loadMemos(),loadTags(),refreshInterval=setInterval(loadMemos,3e4)})};
window.cancelEdit=function(){editingId=null,loadMemos(),refreshInterval||(refreshInterval=setInterval(loadMemos,3e4))};
function loadTags(){fetch("/api/tags").then(function(e){return e.json()}).then(function(e){var t=document.getElementById("tagsList");if(!e.tags||0===e.tags.length)return t.innerHTML='<span style="color:var(--text-muted);font-size:13px;">暂无标签</span>',void 0;var n="";e.tags.forEach(function(e){var t=selectedTag===e.name;n+='<span class="tag'+(t?" active":"")+'" onclick="filterByTag('+"'"+e.name+"'"+')">'+e.name+'<span class="tag-delete" onclick="event.stopPropagation();deleteTag('+e.id+')">×</span></span>'}),t.innerHTML=n}).catch(function(){document.getElementById("tagsList").innerHTML='<span style="color:var(--error);font-size:12px;">加载失败</span>'})}
window.addTag=async function(){var e=document.getElementById("newTagInput"),t=e.value.trim();if(!t)return await showModal("请输入标签名称","提示",!1),void 0;fetch("/api/tags",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:t})}).then(function(t){t.ok?(e.value="",loadTags()):t.json().then(async function(e){await showModal(e.error||"创建标签失败","错误",!0)})})};
window.deleteTag=async function(e){if(await showModal("确定要删除这个标签吗？","删除确认",!0))fetch("/api/tags/"+e,{method:"DELETE"}).then(function(){loadTags()})};
window.filterByTag=function(e){selectedTag=e,selectedDate=null,currentPage=1,currentSearchKeyword="",showLoading(),fetch("/api/memos?tag="+encodeURIComponent(e)+"&page="+currentPage).then(function(e){return e.json()}).then(function(t){allMemos=t.memos,renderCalendar(),renderMemos(t.memos),renderPagination(t.pagination),loadTags(),document.getElementById("filterInfo").innerHTML='<div class="filter-info"><span>'+e+" ("+t.pagination.total+')</span><button class="clear-filter" onclick="clearFilter()">清除</button></div>'})};
document.getElementById("newTagInput").addEventListener("keypress",function(e){"Enter"===e.key&&addTag()});
window.toggleTheme=function(){var e=document.body,t=document.getElementById("sunIcon"),n=document.getElementById("moonIcon");e.classList.contains("light-theme")?(e.classList.remove("light-theme"),t.style.display="block",n.style.display="none",localStorage.setItem("theme","dark")):(e.classList.add("light-theme"),t.style.display="none",n.style.display="block",localStorage.setItem("theme","light"))};
function initTheme(){if("light"===localStorage.getItem("theme")){document.body.classList.add("light-theme");var e=document.getElementById("sunIcon"),t=document.getElementById("moonIcon");e.style.display="none",t.style.display="block"}}
window.toggleSearchBar=function(){var e=document.getElementById("searchArea"),t=document.getElementById("searchToggleBtn"),n="none"!==e.style.display;n?(e.style.display="none",t.style.display="inline-flex",clearSearch()):(e.style.display="block",t.style.display="none",document.getElementById("searchInput").focus(),refreshInterval&&(clearInterval(refreshInterval),refreshInterval=null))};
window.searchMemos=function(){var e=document.getElementById("searchInput"),t=e.value.trim();if(!t)return;currentSearchKeyword=t.toLowerCase(),selectedDate=null,selectedTag=null,currentPage=1,showLoading(),fetch("/api/memos?search="+encodeURIComponent(t)+"&page="+currentPage).then(function(e){return e.json()}).then(function(e){allMemos=e.memos,renderCalendar(),renderMemos(e.memos),renderPagination(e.pagination),document.getElementById("filterInfo").innerHTML='<div class="filter-info"><span>搜索: '+t+" ("+e.pagination.total+')</span><button class="clear-filter" onclick="clearSearch()">清除</button></div>'})};
window.clearSearch=function(){currentSearchKeyword="",document.getElementById("searchArea").style.display="none",document.getElementById("searchToggleBtn").style.display="inline-flex",document.getElementById("searchInput").value="",document.getElementById("filterInfo").innerHTML="",refreshInterval||editingId||(refreshInterval=setInterval(loadMemos,3e4)),loadMemos()};
window.exportData=function(){fetch("/api/memos?limit=10000").then(function(e){return e.json()}).then(function(e){var t={memos:e.memos,exportDate:(new Date).toISOString(),version:"1.0"},n=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),o=URL.createObjectURL(n),i=document.createElement("a");i.href=o,i.download="memos-backup-"+(new Date).toISOString().split("T")[0]+".json",document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(o),showToast({title:"导出成功",message:"已导出 "+e.memos.length+" 条 memo",type:"success",duration:3e3})}).catch(function(){showToast({title:"导出失败",message:"导出数据时出现错误",type:"error",duration:3e3})})};
function showToast(e){var t=document.getElementById("toastContainer"),n=document.createElement("div");n.className="toast "+(e.type||"info"),n.style.cssText="background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: 12px; padding: 16px 20px; min-width: 280px; max-width: 400px; box-shadow: var(--shadow-md); display: flex; align-items: center; gap: 12px; animation: toastSlideIn 0.3s ease;";var o={success:"ph-check-circle",error:"ph-x-circle",warning:"ph-warning",info:"ph-info"}[e.type]||"ph-info",i="";e.action&&(i='<button onclick="undoDelete()" style="background: var(--accent-gradient); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; font-weight: 500; margin-left: 12px;">'+e.action.text+"</button>"),n.innerHTML='<i class="ph '+o+'" style="font-size: 24px;"></i><div style="flex: 1;"><div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">'+e.title+'</div><div style="font-size: 13px; color: var(--text-secondary);">'+e.message+"</div></div>"+i,t.appendChild(n),setTimeout(function(){n.style.opacity="0",n.style.transform="translateX(100%)",setTimeout(function(){n.remove()},300)},e.duration||3e3)}
window.showModal=function(e,t,n){void 0===t&&(t="确认操作"),void 0===n&&(n=!0);return new Promise(function(o){modalResolve=o;var i=document.getElementById("customModal"),a=document.getElementById("modalMessage"),d=document.querySelector(".modal-title"),s=document.querySelector(".modal-icon"),l=document.getElementById("modalConfirm");a.textContent=e,d.textContent=t,n?(s.className="ph ph-warning-circle modal-icon",s.style.color="var(--warning)",l.className="modal-btn modal-btn-danger"):(s.className="ph ph-question modal-icon",s.style.color="var(--accent-blue)",l.className="modal-btn",l.style.cssText="background: var(--accent-gradient); color: white;"),i.style.display="flex",setTimeout(function(){i.classList.add("active")},10)})};
function hideModal(){var e=document.getElementById("customModal");e.classList.remove("active"),setTimeout(function(){e.style.display="none"},300)}
document.getElementById("modalCancel").addEventListener("click",function(){hideModal(),modalResolve&&modalResolve(!1)});
document.getElementById("modalConfirm").addEventListener("click",function(){hideModal(),modalResolve&&modalResolve(!0)});
document.getElementById("customModal").addEventListener("click",function(e){"customModal"===e.target.id&&(hideModal(),modalResolve&&modalResolve(!1))});
window.showMobileInput=function(){var e=document.getElementById("memoInput");e.scrollIntoView({behavior:"smooth",block:"center"}),e.focus()};
window.toggleMobileSidebar=function(){document.querySelector(".sidebar").classList.toggle("show")};
window.switchMobileTab=function(e){document.querySelectorAll(".mobile-nav-btn").forEach(function(e){e.classList.remove("active")}),event.currentTarget.classList.add("active"),"memos"===e&&document.querySelector(".sidebar").classList.remove("show")};
window.toggleMobileSearch=function(){toggleSearchBar(),"none"!==document.getElementById("searchArea").style.display&&document.getElementById("searchInput").focus()};
document.addEventListener("click",function(e){var t=document.querySelector(".sidebar"),n=document.querySelector(".mobile-nav");window.innerWidth<=768&&t.classList.contains("show")&&!t.contains(e.target)&&!n.contains(e.target)&&t.classList.remove("show")});
// 延迟注册快捷键监听 - 性能优化
setTimeout(function(){
  document.addEventListener("keydown",function(e){
    (e.ctrlKey||e.metaKey)&&(document.getElementById("shortcutHint").style.opacity="1"),
    (e.ctrlKey||e.metaKey)&&"n"===e.key&&(e.preventDefault(),document.getElementById("memoInput").focus()),
    (e.ctrlKey||e.metaKey)&&"f"===e.key&&(e.preventDefault(),toggleSearchBar()),
    "Escape"===e.key&&("none"!==document.getElementById("searchArea").style.display?clearSearch():editingId&&cancelEdit())
  });
  document.addEventListener("keyup",function(e){
    "Control"!==e.key&&"Meta"!==e.key||setTimeout(function(){document.getElementById("shortcutHint").style.opacity="0"},1e3)
  });
}, 1000); // 延迟 1 秒注册

document.getElementById("searchInput").addEventListener("keypress",function(e){"Enter"===e.key&&searchMemos()});

// 延迟注册 Service Worker - 性能优化
setTimeout(function(){
  if("serviceWorker"in navigator){
    navigator.serviceWorker.register("/sw.js").then(function(e){
      console.log("Service Worker registered:",e)
    }).catch(function(e){
      console.log("Service Worker registration failed:",e)
    })
  }
}, 2000); // 延迟 2 秒注册

// ===== Performance Monitoring =====
(function(){
  var perfMarks={};
  try{
    if(window.performance&&performance.mark){
      performance.mark('app-init-start');
      perfMarks.initStart=true;
    }
  }catch(e){}
  
  // 记录关键性能指标
  window.reportPerf=function(eventName){
    try{
      if(window.performance&&performance.mark&&performance.measure){
        performance.mark(eventName);
        if(perfMarks.initStart){
          performance.measure('app-init-duration','app-init-start',eventName);
          var measures=performance.getEntriesByName('app-init-duration');
          if(measures.length>0){
            console.log('[Perf] App init took:',Math.round(measures[0].duration),'ms');
          }
        }
      }
    }catch(e){}
  };
  
  // FCP/LCP 监控
  if(window.PerformanceObserver){
    try{
      var fcpObserver=new PerformanceObserver(function(list){
        var entries=list.getEntries();
        entries.forEach(function(entry){
          if(entry.name==='first-contentful-paint'){
            console.log('[Perf] FCP:',Math.round(entry.startTime),'ms');
          }
        });
      });
      fcpObserver.observe({type:'paint',buffered:true});
    }catch(e){}
    
    try{
      var lcpObserver=new PerformanceObserver(function(list){
        var entries=list.getEntries();
        var lastEntry=entries[entries.length-1];
        console.log('[Perf] LCP:',Math.round(lastEntry.startTime),'ms');
      });
      lcpObserver.observe({type:'largest-contentful-paint',buffered:true});
    }catch(e){}
  }
})();

// ===== Scroll Performance Optimization =====
var scrollDebounceTimer=null;
var scrollHandler=function(){
  var scrollTop=window.pageYOffset||document.documentElement.scrollTop;
  var scrollBtn=document.querySelector('.scroll-top-btn');
  if(scrollBtn){
    if(scrollTop>300){
      scrollBtn.classList.add('visible');
    }else{
      scrollBtn.classList.remove('visible');
    }
  }
};
var debouncedScrollHandler=function(){
  if(scrollDebounceTimer)clearTimeout(scrollDebounceTimer);
  scrollDebounceTimer=setTimeout(scrollHandler,100);
};

// 使用 passive 模式优化滚动性能
window.addEventListener('scroll',debouncedScrollHandler,{passive:true});

// ===== 请求 Idle 回调优化渲染 =====
var scheduleRender=function(callback){
  if(window.requestIdleCallback){
    requestIdleCallback(callback,{timeout:50});
  }else{
    setTimeout(callback,16);
  }
};

// ===== 虚拟滚动检测 =====
window.checkVirtualScroll=function(totalCount){
  var threshold=100;
  if(totalCount>threshold){
    console.log('[Perf] Large dataset detected:',totalCount,'items. Consider virtual scrolling.');
  }
};

// ===== Page Visibility API 优化自动刷新 =====
var isVisible = !document.hidden;

document.addEventListener('visibilitychange', function() {
  var wasVisible = isVisible;
  isVisible = !document.hidden;

  if (isVisible && !wasVisible) {
    // 页面变为可见时立即刷新
    loadMemos();
    // 恢复自动刷新
    if (!refreshInterval) {
      refreshInterval = setInterval(loadMemos, 30000);
    }
  } else if (!isVisible && wasVisible) {
    // 页面不可见时暂停自动刷新
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
});

// 初始化完成
reportPerf('app-init-complete');
renderCalendar();
loadMemos();
loadTags();
initTheme();

// 仅在页面可见时启动自动刷新
if (!document.hidden) {
  refreshInterval = setInterval(loadMemos, 30000);
}`;
}
