# Memos UI 全面升级设计文档

> HUD 空间站风格 - 分层渐进改造方案

## 概述

### 目标

将 Memos 应用的 UI 升级为 **HUD 空间站风格**，解决以下问题：
- 视觉层次不清
- 动画效果问题
- 组件细节粗糙
- 响应式体验差

### 设计原则

1. **科技感优先**：HUD（Heads-Up Display）界面风格，干净、功能导向
2. **分层渐进**：保持可用性，逐层改造
3. **克制动画**：动画服务于功能，不过度装饰
4. **响应式优先**：所有设计考虑多屏幕适配

### 改造顺序

```
背景层 → 卡片系统 → 侧边栏 → 交互反馈 → 动画系统
```

---

## HTML 结构变更

> **注意**：以下 HTML 结构需要在 `src/handlers/html.js` 的 `getHtml()` 函数中添加。

### 背景元素

在 `<body>` 开头添加：

```html
<!-- 扫描线 -->
<div class="scan-line"></div>

<!-- 角落装饰（四角） -->
<div class="corner-decoration top-left"></div>
<div class="corner-decoration top-right"></div>
<div class="corner-decoration bottom-left"></div>
<div class="corner-decoration bottom-right"></div>
```

### 卡片结构

将现有 `.memo` 结构改为：

```html
<div class="memo" data-id="${memo.id}">
  <!-- HUD 边框装饰（CSS 伪元素实现，无需添加 HTML） -->

  <!-- 状态栏 -->
  <div class="memo-status">
    <span class="status-light"></span>
    <span class="memo-time">${formatTime(memo.created_at)}</span>
    <div class="memo-tags">${tagsHtml}</div>
    <span class="memo-type">${getTypeBadge(content)}</span>
  </div>

  <!-- 主内容 -->
  <div class="memo-content">${parseMarkdown(content)}</div>

  <!-- 操作栏 -->
  <div class="memo-actions">
    <button class="icon-btn" onclick="copyMemo(${memo.id})" title="复制">📋</button>
    <button class="icon-btn" onclick="editMemo(${memo.id})" title="编辑">✏️</button>
    <button class="icon-btn" onclick="deleteMemo(${memo.id})" title="删除">🗑️</button>
  </div>
</div>
```

### 侧边栏标题

```html
<div class="sidebar-header">
  <span class="status-light"></span>
  <h1>MEMOS</h1>
  <button class="settings-btn" title="设置">⚙️</button>
</div>
```

---

## 第一层：背景系统

### 设计目标

建立 HUD 空间站的视觉基调，营造科技感和层次感。

### 元素规格

| 元素 | 实现方案 |
|------|----------|
| **主背景** | `#0f0f1a` 深紫黑，保持现有基调 |
| **网格层** | 45° 斜线网格，1px 细线，3-5% 透明度 |
| **扫描线** | 水平扫描线动画，8 秒周期，缓慢移动 |
| **角落装饰** | 四角 HUD 括号装饰 `「」`风格 |

> **注意**：粒子效果暂不纳入本次改造范围，保持现有实现不变。

### CSS 实现

```css
/* 网格背景 */
body {
  background-image:
    linear-gradient(45deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* 扫描线 */
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

/* 角落装饰 */
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
.corner-decoration.bottom-right {
  bottom: 20px; right: 20px;
  border-left: none; border-top: none;
}
```

### 颜色扩展（含亮色主题）

```css
:root {
  /* HUD 辅助色 */
  --hud-warning: #fbbf24;  /* 金黄 - 高亮和标记 */
  --hud-data: #22d3ee;     /* 青蓝 - 数值和状态 */
  --hud-success: #34d399;  /* 绿色 - 成功状态 */

  /* 动画变量（新命名，避免与现有冲突） */
  --hud-transition-fast: 0.15s ease-out;
  --hud-transition-normal: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --hud-transition-slow: 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  --hud-animation-scan: 8s linear infinite;
  --hud-animation-pulse: 2s ease-in-out infinite;
}

/* 亮色主题适配 */
body.light-theme {
  --hud-warning: #f59e0b;
  --hud-data: #06b6d4;
  --hud-success: #10b981;
}

/* 扫描线 - 亮色主题 */
body.light-theme .scan-line {
  background: linear-gradient(90deg, transparent, rgba(79, 70, 229, 0.3), transparent);
}

/* 角落装饰 - 亮色主题 */
body.light-theme .corner-decoration {
  border-color: var(--accent-blue);
  opacity: 0.2;
}

/* 卡片 HUD 边框 - 亮色主题 */
body.light-theme .memo::before,
body.light-theme .memo::after {
  border-color: var(--accent-blue);
  opacity: 0.3;
}
```

---

## 第二层：卡片系统

### 设计目标

解决视觉层次不清的问题，建立清晰的信息层级和 HUD 风格边界。

### 卡片结构

```
┌──────────────────────────────────────┐  ← HUD 角标装饰
│ ◉ 2024-03-28  #工作  #想法  [MD]    │  ← 状态栏
│──────────────────────────────────────│  ← 分隔线
│                                      │
│  卡片内容区域                        │  ← 主内容
│                                      │
│──────────────────────────────────────│  ← 分隔线
│                    [编辑] [删除] [复制] │  ← 操作栏
└──────────────────────────────────────┘
```

### 视觉权重分级

| 级别 | 边框 | 阴影 | 适用场景 |
|------|------|------|----------|
| **普通** | 1px 低透明边框 | 微弱阴影 | 默认状态 |
| **重要** | 2px 主题色边框 + 左侧亮条 | 中等阴影 | 含代码/长文 |
| **高亮** | 发光边框 + 扫描光效 | 强阴影 | 悬停/选中 |

### CSS 实现

```css
/* 卡片基础样式 */
.memo {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  transition: all var(--transition-normal);
}

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

/* 状态栏 */
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

/* 操作栏 */
.memo-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--glass-border);
  margin-top: 16px;
}

/* 重要卡片 */
.memo.important {
  border-left: 3px solid var(--accent-blue);
  box-shadow: var(--shadow-md);
}

/* 高亮/悬停状态 */
.memo:hover,
.memo.highlighted {
  transform: translateY(-4px);
  box-shadow: var(--shadow-glow);
  border-color: var(--accent-blue);
}
```

---

## 第三层：侧边栏设计

### 设计目标

建立 HUD 风格的导航和信息面板，增强组件精致度。

### 布局结构

```
╔══════════════════════════════════╗
║  ◉ MEMOS                    ⚙⚙⚙  ║  ← 标题 + 状态灯
╠══════════════════════════════════╣
║  🔍 搜索...                      ║  ← 搜索框
╠══════════════════════════════════╣
║  ◀ 2024年3月 ▶                  ║  ← 日历导航
║  [日历网格]                      ║
╠══════════════════════════════════╣
║  标签                            ║  ← 区块标题
║  [斜角标签列表]                  ║
╚══════════════════════════════════╝
```

### CSS 实现

```css
/* 状态指示灯 */
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

/* 斜角标签 */
.tag {
  clip-path: polygon(12% 0, 100% 0, 88% 100%, 0 100%);
  padding: 6px 18px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
  border-radius: 0;
  transition: all var(--transition-fast);
}

.tag:hover {
  background: var(--accent-blue);
  color: white;
}

.tag.active {
  background: var(--accent-gradient);
  color: white;
}

/* 计数徽章 */
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

/* 分隔线 */
.divider {
  height: 1px;
  background: linear-gradient(90deg,
    transparent, var(--glass-border), transparent);
  margin: 16px 0;
}

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
```

### 响应式策略

```css
/* 中等屏幕：可折叠 */
@media (max-width: 1200px) {
  .sidebar {
    width: 60px;
    overflow: hidden;
  }
  .sidebar:hover {
    width: 300px;
  }
  .sidebar .section-title,
  .sidebar .tag-text {
    display: none;
  }
  .sidebar:hover .section-title,
  .sidebar:hover .tag-text {
    display: block;
  }
}

/* 小屏幕：底部导航 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -100%;
    width: 280px;
    height: 100vh;
    z-index: 1000;
    transition: left var(--transition-normal);
  }
  .sidebar.open {
    left: 0;
  }
  .mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    border-top: 1px solid var(--glass-border);
    padding: 12px 20px;
    z-index: 999;
    justify-content: space-around;
  }
}
```

---

## 第四层：交互反馈设计

### 设计目标

建立 HUD 风格的交互反馈系统，让每次操作都有清晰的视觉响应。

### 按钮状态系统

```css
/* 默认状态 */
.btn {
  position: relative;
  background: var(--accent-gradient);
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  overflow: hidden;
}

/* 悬停状态 */
.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}

/* 按下状态 */
.btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
}

/* 禁用状态 */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 加载状态 */
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
}

/* 悬停光效 */
.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg,
    transparent, rgba(255,255,255,0.2), transparent);
  transform: translateX(-100%);
  transition: transform 0.5s;
}
.btn:hover::before {
  transform: translateX(100%);
}
```

### Toast 通知系统

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

.toast.success { border-left: 3px solid var(--success); }
.toast.warning { border-left: 3px solid var(--warning); }
.toast.error { border-left: 3px solid var(--error); }
```

### 骨架屏加载

```css
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
```

### 确认对话框

```css
.modal-overlay {
  position: fixed;
  inset: 0;
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
  transform: scale(0.9) translateY(20px);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-overlay.active .modal-container {
  transform: scale(1) translateY(0);
}

.modal-btn-danger {
  background: var(--error);
  color: white;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}
```

---

## 第五层：动画系统

### 设计目标

建立统一、流畅的 HUD 风格动画，增强科技感但不干扰阅读。

### 动画原则

1. **克制**：动画服务于功能，不过度装饰
2. **快速**：交互反馈 < 200ms，页面过渡 < 400ms
3. **物理感**：使用 ease-out 曲线，模拟自然减速
4. **可关闭**：提供 `prefers-reduced-motion` 支持

### 时长规范

| 类型 | 场景 | 时长 | 缓动函数 |
|------|------|------|----------|
| **微交互** | hover、click、focus | 150-200ms | `ease-out` |
| **状态切换** | 展开/折叠、切换标签 | 250-350ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| **入场动画** | 卡片加载、弹窗出现 | 300-400ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| **背景效果** | 扫描线、粒子、呼吸灯 | 3-8s | `ease-in-out` 循环 |

### CSS 变量集中管理

```css
:root {
  /* 使用新命名避免与现有变量冲突 */
  --hud-transition-fast: 0.15s ease-out;
  --hud-transition-normal: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  --hud-transition-slow: 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  --hud-animation-scan: 8s linear infinite;
  --hud-animation-pulse: 2s ease-in-out infinite;
}
```

> **迁移说明**：新动画变量使用 `--hud-*` 前缀，与现有 `--transition-*` 变量并存。实施时可选择：
> 1. 渐进式：新组件使用新变量，旧组件保持不变
> 2. 统一式：全局替换为新变量后删除旧变量

### 核心动画定义

```css
/* 卡片入场 */
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

/* 卡片入场动画 - 使用 CSS 变量实现可扩展交错延迟 */
.memo {
  --stagger-delay: 0ms;
  animation: memoEnter var(--hud-transition-slow) calc(var(--stagger-delay) * 50ms) backwards;
}

/* JavaScript 在渲染时动态设置 stagger-delay：
 * document.querySelectorAll('.memo').forEach((memo, i) => {
 *   memo.style.setProperty('--stagger-delay', i);
 * });
 * 或使用 IntersectionObserver 实现滚动时的交错入场
 */

/* 扫描线 - 使用第一层定义的 @keyframes scan */
.scan-line {
  animation: scan var(--hud-animation-scan);
}

/* 状态指示灯 - 使用第三层定义的 @keyframes pulse */
.status-light {
  animation: pulse var(--hud-animation-pulse);
}

/* 数字跳动 */
@keyframes countPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* 加载旋转 */
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 性能优化

```css
/* 仅对动画元素使用 will-change */
.memo,
.btn,
.modal-container,
.scan-line {
  will-change: transform, opacity;
}

/* 避免动画导致重排 */
.memo {
  contain: layout style paint;
}
```

### 无障碍支持

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 迁移说明

### 现有类名冲突处理

以下类名在现有代码中已存在，实施时需要更新：

| 类名 | 当前用途 | 改造策略 |
|------|----------|----------|
| `.memo` | 卡片容器 | 直接更新样式，保留 HTML 结构基础 |
| `.tag` | 标签胶囊 | 更新为斜角样式，HTML 结构不变 |
| `.toast` | 通知组件 | 增强样式，添加类型修饰符 |
| `.mobile-nav` | 移动端导航 | 保持响应式逻辑，优化样式 |
| `.modal-overlay` | 弹窗遮罩 | 增强动画效果 |
| `.btn` | 按钮 | 添加状态系统，增强交互 |

### CSS 变量迁移

```css
/* 旧变量 → 新变量（可选统一） */
--transition-fast   → --hud-transition-fast
--transition-normal → --hud-transition-normal
--transition-slow   → --hud-transition-slow
```

### 渐进实施建议

1. **先添加后删除**：新增 CSS 在现有样式之后，确保覆盖
2. **逐个组件验证**：每完成一层，测试所有交互
3. **保留回滚点**：每个阶段完成后创建 git tag

---

## 实施计划

### 阶段一：基础设施（背景层 + CSS 变量）

1. 更新 CSS 变量定义
2. 添加网格背景
3. 添加扫描线效果
4. 添加角落装饰

### 阶段二：卡片系统

1. 更新卡片 HTML 结构
2. 实现状态栏和操作栏
3. 添加 HUD 边框装饰
4. 实现视觉权重分级

### 阶段三：侧边栏

1. 重构侧边栏布局
2. 实现状态指示灯
3. 更新标签样式（斜角 + 徽章）
4. 优化日历组件

### 阶段四：交互反馈

1. 完善按钮状态系统
2. 实现 Toast 通知
3. 添加骨架屏加载
4. 更新确认对话框

### 阶段五：动画系统

1. 定义动画 CSS 变量
2. 实现入场动画
3. 添加微交互动画
4. 添加无障碍支持

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 新旧风格混搭期间不协调 | 按阶段发布，每阶段完成后整体协调 |
| 动画性能影响 | 使用 transform/opacity，启用 GPU 加速 |
| 响应式适配遗漏 | 每阶段测试三种屏幕尺寸 |
| 无障碍问题 | 提供减少动画选项，确保键盘导航 |

---

## 验收标准

- [ ] 所有五层改造完成
- [ ] 三种屏幕尺寸（桌面/平板/手机）测试通过
- [ ] 动画流畅度 60fps
- [ ] 无障碍测试通过
- [ ] 用户验收满意