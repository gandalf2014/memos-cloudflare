# HUD 空间站风格 UI 升级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Memos 应用的 UI 升级为 HUD 空间站风格，解决视觉层次、动画、组件细节和响应式问题。

**Architecture:** 分层渐进改造，按 背景层 → 卡片系统 → 侧边栏 → 交互反馈 → 动画系统 顺序实施，每层独立可验证。

**Tech Stack:** Cloudflare Workers, D1 SQLite, 原生 JavaScript, CSS (无构建工具)

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/handlers/html.js` | 所有 HTML、CSS、客户端 JS | 修改 |
| `docs/superpowers/specs/2026-03-28-hud-ui-upgrade-design.md` | 设计规范文档 | 参考 |

---

## Task 1: 添加 HUD CSS 变量

**Files:**
- Modify: `src/handlers/html.js:164-191` (CSS Variables 区域)

- [ ] **Step 1: 在 `:root` 中添加 HUD 变量**

在 `--radius-xl: 24px;` 之后添加：

```css
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
```

- [ ] **Step 2: 在 `body.light-theme` 中添加亮色主题 HUD 变量**

在 `--accent-purple: #7c3aed;` 之后添加：

```css
  --hud-warning: #f59e0b;
  --hud-data: #06b6d4;
  --hud-success: #10b981;
```

- [ ] **Step 3: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(css): 添加 HUD CSS 变量定义"
```

---

## Task 2: 添加网格背景

**Files:**
- Modify: `src/handlers/html.js:208` (body 样式)

- [ ] **Step 1: 更新 body 背景样式**

将：
```css
body { font-family: 'Inter', 'Noto Sans SC', sans-serif; background: var(--bg-primary); min-height: 100vh; color: var(--text-primary); line-height: 1.6; }
```

改为：
```css
body { font-family: 'Inter', 'Noto Sans SC', sans-serif; background: var(--bg-primary); background-image: linear-gradient(45deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px); background-size: 40px 40px; min-height: 100vh; color: var(--text-primary); line-height: 1.6; }
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(bg): 添加 45° 网格背景"
```

---

## Task 3: 添加扫描线 HTML 和 CSS

**Files:**
- Modify: `src/handlers/html.js:21` (body 开始后)
- Modify: `src/handlers/html.js` (CSS 区域末尾)

- [ ] **Step 1: 在 HTML 中添加扫描线元素**

在 `<body>` 后、`<div id="loginOverlay"` 前添加：

```html
  <!-- HUD 扫描线 -->
  <div class="scan-line"></div>
```

- [ ] **Step 2: 添加扫描线 CSS（在 getStyles 函数末尾）**

在 CSS 末尾（`</style>` 前）添加：

```css

/* ===== HUD 扫描线 ===== */
.scan-line {
  position: fixed;
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, transparent, var(--accent-glow), transparent);
  animation: scan 8s linear infinite;
  pointer-events: none;
  z-index: 9999;
}

@keyframes scan {
  0% { top: -2px; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}

body.light-theme .scan-line {
  background: linear-gradient(90deg, transparent, rgba(79, 70, 229, 0.3), transparent);
}
```

- [ ] **Step 3: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(hud): 添加扫描线效果"
```

---

## Task 4: 添加角落装饰 HTML 和 CSS

**Files:**
- Modify: `src/handlers/html.js:21` (body 开始后)
- Modify: `src/handlers/html.js` (CSS 区域)

- [ ] **Step 1: 在 HTML 中添加角落装饰元素**

在 `<div class="scan-line"></div>` 后添加：

```html

  <!-- HUD 角落装饰 -->
  <div class="corner-decoration top-left"></div>
  <div class="corner-decoration top-right"></div>
  <div class="corner-decoration bottom-left"></div>
  <div class="corner-decoration bottom-right"></div>
```

- [ ] **Step 2: 添加角落装饰 CSS**

在扫描线 CSS 后添加：

```css

/* ===== HUD 角落装饰 ===== */
.corner-decoration {
  position: fixed;
  width: 60px;
  height: 60px;
  border: 2px solid var(--accent-blue);
  opacity: 0.3;
  pointer-events: none;
}
.corner-decoration.top-left {
  top: 20px; left: 20px;
  border-right: none; border-bottom: none;
}
.corner-decoration.top-right {
  top: 20px; right: 20px;
  border-left: none; border-bottom: none;
}
.corner-decoration.bottom-left {
  bottom: 20px; left: 20px;
  border-right: none; border-top: none;
}
.corner-decoration.bottom-right {
  bottom: 20px; right: 20px;
  border-left: none; border-top: none;
}

body.light-theme .corner-decoration {
  border-color: var(--accent-blue);
  opacity: 0.2;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(hud): 添加四角 HUD 括号装饰"
```

---

## Task 5: 更新卡片 HUD 边框样式

**Files:**
- Modify: `src/handlers/html.js` (.memo 样式区域)

- [ ] **Step 1: 找到 .memo 样式并添加 HUD 边框**

找到 `.memo` 样式块（约 225 行），在 `.memo:hover` 之前添加：

```css

/* HUD 括号边框 */
.memo::before,
.memo::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid var(--accent-blue);
  opacity: 0.5;
}
.memo::before {
  top: 0; left: 0;
  border-right: none; border-bottom: none;
}
.memo::after {
  bottom: 0; right: 0;
  border-left: none; border-top: none;
}

/* 重要卡片 */
.memo.important {
  border-left: 3px solid var(--accent-blue);
  box-shadow: var(--shadow-md);
}

/* 高亮/悬停状态 */
.memo.highlighted {
  transform: translateY(-4px);
  box-shadow: var(--shadow-glow);
  border-color: var(--accent-blue);
}
```

- [ ] **Step 2: 添加亮色主题卡片边框**

在 `body.light-theme` 区域添加：

```css

body.light-theme .memo::before,
body.light-theme .memo::after {
  border-color: var(--accent-blue);
  opacity: 0.3;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(card): 添加卡片 HUD 括号边框"
```

---

## Task 6: 添加卡片状态栏样式

**Files:**
- Modify: `src/handlers/html.js` (CSS 区域)

- [ ] **Step 1: 添加状态栏和操作栏 CSS**

在卡片样式区域添加：

```css

/* 卡片状态栏 */
.memo-status {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-muted);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--glass-border);
  margin-bottom: 16px;
}

.memo-time {
  display: flex;
  align-items: center;
  gap: 4px;
}

.memo-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.memo-type {
  margin-left: auto;
  font-size: 10px;
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  color: var(--text-muted);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(card): 添加卡片状态栏样式"
```

---

## Task 7: 添加状态指示灯样式

**Files:**
- Modify: `src/handlers/html.js` (CSS 区域)

- [ ] **Step 1: 添加状态指示灯 CSS**

在 HUD 样式区域添加：

```css

/* ===== HUD 状态指示灯 ===== */
.status-light {
  width: 8px;
  height: 8px;
  background: var(--success);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 var(--accent-glow);
  }
  50% {
    opacity: 0.6;
    box-shadow: 0 0 10px 5px var(--accent-glow);
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(hud): 添加状态指示灯动画"
```

---

## Task 8: 更新标签为斜角样式

**Files:**
- Modify: `src/handlers/html.js` (.tag 样式区域)

- [ ] **Step 1: 更新 .tag 样式**

找到 `.tag` 样式（约 251 行），将现有样式替换为：

```css
.tag {
  clip-path: polygon(12% 0, 100% 0, 88% 100%, 0 100%);
  padding: 6px 18px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  border-radius: 0;
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tag:hover {
  background: var(--accent-blue);
  color: white;
  border-color: var(--accent-blue);
  transform: translateY(-1px);
}
.tag.active {
  background: var(--accent-gradient);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
.tag-delete {
  opacity: 0.6;
  font-size: 16px;
  margin-left: 4px;
}
.tag-delete:hover {
  opacity: 1;
  transform: scale(1.2);
}

/* 标签计数徽章 */
.tag-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--bg-secondary);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(tag): 更新标签为斜角 HUD 样式"
```

---

## Task 9: 添加区块标题样式

**Files:**
- Modify: `src/handlers/html.js` (CSS 区域)

- [ ] **Step 1: 添加区块标题和分隔线 CSS**

在侧边栏样式区域添加：

```css

/* 区块标题 */
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title::before {
  content: '';
  width: 3px;
  height: 12px;
  background: var(--accent-gradient);
  border-radius: 2px;
}

/* 分隔线 */
.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-border), transparent);
  margin: 16px 0;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(ui): 添加区块标题和分隔线样式"
```

---

## Task 10: 更新按钮状态系统

**Files:**
- Modify: `src/handlers/html.js` (.btn 样式区域)

- [ ] **Step 1: 更新 .btn 样式添加状态系统**

找到 `.btn` 样式（约 222 行），替换为：

```css
.btn {
  position: relative;
  background: var(--accent-gradient);
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  margin-top: 16px;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  overflow: hidden;
}
.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}
.btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 按钮悬停光效 */
.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transform: translateX(-100%);
  transition: transform 0.5s;
}
.btn:hover::before {
  transform: translateX(100%);
}

/* 按钮加载状态 */
.btn.loading {
  pointer-events: none;
  color: transparent;
}
.btn.loading::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  left: 50%;
  top: 50%;
  margin-left: -10px;
  margin-top: -10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(btn): 添加按钮多状态系统和悬停光效"
```

---

## Task 11: 更新 Toast 通知样式

**Files:**
- Modify: `src/handlers/html.js` (.toast 样式区域)

- [ ] **Step 1: 更新 Toast 样式添加类型修饰符**

找到 `.toast` 样式（约 306 行），替换为：

```css
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  min-width: 280px;
  max-width: 400px;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: 12px;
  animation: toastSlideIn 0.3s ease;
}

@keyframes toastSlideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.toast-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.toast-message {
  font-size: 13px;
  color: var(--text-secondary);
}

.toast-action {
  background: var(--accent-gradient);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  margin-left: 12px;
}

/* Toast 类型修饰符 */
.toast.success { border-left: 3px solid var(--success); }
.toast.warning { border-left: 3px solid var(--warning); }
.toast.error { border-left: 3px solid var(--error); }
.toast.info { border-left: 3px solid var(--hud-data); }
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(toast): 添加 Toast 类型修饰符和入场动画"
```

---

## Task 12: 添加骨架屏加载样式

**Files:**
- Modify: `src/handlers/html.js` (CSS 区域)

- [ ] **Step 1: 添加骨架屏 CSS**

在交互反馈区域添加：

```css

/* ===== 骨架屏加载 ===== */
.skeleton {
  background: linear-gradient(90deg,
    var(--bg-tertiary) 25%,
    var(--bg-secondary) 50%,
    var(--bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  margin-bottom: 24px;
}

.skeleton-title {
  height: 16px;
  width: 60%;
  margin-bottom: 12px;
}

.skeleton-text {
  height: 14px;
  width: 100%;
  margin-bottom: 8px;
}

.skeleton-text:last-child {
  width: 80%;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(ui): 添加骨架屏加载效果"
```

---

## Task 13: 更新确认对话框样式

**Files:**
- Modify: `src/handlers/html.js` (.modal-overlay 样式区域)

- [ ] **Step 1: 更新 Modal 样式增强动画**

找到 `.modal-overlay` 样式（约 274 行），替换为：

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.modal-overlay.active {
  opacity: 1;
}

.modal-container {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 28px;
  max-width: 420px;
  width: 90%;
  box-shadow: var(--shadow-md);
  transform: scale(0.9) translateY(20px);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-overlay.active .modal-container {
  transform: scale(1) translateY(0);
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.modal-icon {
  font-size: 28px;
  color: var(--warning);
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-message {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.modal-btn {
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.modal-btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.modal-btn-secondary:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-btn-danger {
  background: var(--error);
  color: white;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.modal-btn-danger:hover {
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
  transform: translateY(-1px);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(modal): 增强 Modal 对话框动画效果"
```

---

## Task 14: 添加卡片入场动画

**Files:**
- Modify: `src/handlers/html.js` (CSS 区域)

- [ ] **Step 1: 添加卡片入场动画 CSS**

在动画系统区域添加：

```css

/* ===== 卡片入场动画 ===== */
@keyframes memoEnter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.memo {
  --stagger-delay: 0;
  animation: memoEnter var(--hud-transition-slow) calc(var(--stagger-delay) * 50ms) backwards;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(anim): 添加卡片入场交错动画"
```

---

## Task 15: 添加无障碍动画支持

**Files:**
- Modify: `src/handlers/html.js` (CSS 区域末尾)

- [ ] **Step 1: 添加 prefers-reduced-motion 支持**

在 CSS 末尾（`</style>` 前）添加：

```css

/* ===== 无障碍：减少动画 ===== */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .scan-line,
  .status-light {
    animation: none !important;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(a11y): 添加 prefers-reduced-motion 无障碍支持"
```

---

## Task 16: 添加性能优化样式

**Files:**
- Modify: `src/handlers/html.js` (CSS 区域)

- [ ] **Step 1: 添加 will-change 和 contain 优化**

在性能优化区域添加：

```css

/* ===== 性能优化 ===== */
.memo,
.btn,
.modal-container,
.scan-line {
  will-change: transform, opacity;
}

.memo {
  contain: layout style paint;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/handlers/html.js
git commit -m "perf: 添加动画性能优化 will-change 和 contain"
```

---

## Task 17: 更新侧边栏标题 HTML

**Files:**
- Modify: `src/handlers/html.js:39` (sidebar 区域)

- [ ] **Step 1: 更新侧边栏标题 HTML**

将：
```html
    <div class="sidebar">
      <div class="sidebar-title"><i class="ph ph-calendar-blank"></i> 日历</div>
```

改为：
```html
    <div class="sidebar">
      <div class="sidebar-header">
        <span class="status-light"></span>
        <h1 style="font-size: 1.5rem; margin: 0;">MEMOS</h1>
      </div>
      <div class="divider"></div>
      <div class="section-title"><i class="ph ph-calendar-blank"></i> 日历</div>
```

- [ ] **Step 2: 添加侧边栏标题样式**

添加 CSS：

```css

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.sidebar-header h1 {
  font-size: 1.5rem;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/handlers/html.js
git commit -m "feat(sidebar): 更新侧边栏标题添加状态指示灯"
```

---

## Task 18: 最终验证和清理

**Files:**
- Modify: `src/handlers/html.js`

- [ ] **Step 1: 本地开发服务器测试**

```bash
npm run dev
```

验证项目：
- [ ] 页面加载正常
- [ ] 扫描线动画可见
- [ ] 四角装饰显示
- [ ] 卡片 HUD 边框正常
- [ ] 标签斜角样式生效
- [ ] 按钮悬停光效正常
- [ ] 暗色/亮色主题切换正常
- [ ] 移动端响应式正常

- [ ] **Step 2: 创建完成标签**

```bash
git tag -a v2.0.0-hud-ui -m "HUD 空间站风格 UI 升级完成"
git push origin main --tags
```

- [ ] **Step 3: 提交最终状态**

```bash
git add src/handlers/html.js
git commit -m "feat(ui): HUD 空间站风格 UI 升级完成

完成内容：
- 背景系统：网格背景、扫描线、角落装饰
- 卡片系统：HUD 边框、状态栏样式
- 侧边栏：状态指示灯、斜角标签、区块标题
- 交互反馈：按钮状态、Toast 类型、骨架屏、Modal 动画
- 动画系统：入场动画、无障碍支持、性能优化"
```

---

## 验收清单

- [ ] 所有 18 个 Task 完成
- [ ] 三种屏幕尺寸测试通过（桌面 > 1200px, 平板 768-1200px, 手机 < 768px）
- [ ] 暗色/亮色主题切换正常
- [ ] 动画流畅度满足要求
- [ ] 无障碍测试通过（prefers-reduced-motion 生效）
- [ ] 代码已提交并打标签