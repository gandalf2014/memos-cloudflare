// Utility functions
function createResponse(data, status = 200, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function validateId(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId) || numId <= 0) {
    throw new Error('Invalid ID');
  }
  return numId;
}

function validateContent(content) {
  if (typeof content !== 'string') {
    throw new Error('Content must be a string');
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error('Content cannot be empty');
  }
  if (trimmed.length > 10000) {
    throw new Error('Content too long (max 10000 characters)');
  }
  return trimmed;
}

function sanitizeForHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /api/memos - List memos with optional date filter
    if (url.pathname === '/api/memos' && request.method === 'GET') {
      try {
        const date = url.searchParams.get('date');
        let query = 'SELECT id, content, created_at as createdAt, updated_at as updatedAt FROM memos';
        const params = [];
        
        if (date) {
          // Validate date format (YYYY-MM-DD)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return createResponse({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400, corsHeaders);
          }
          const startDate = date + 'T00:00:00.000Z';
          const endDate = date + 'T23:59:59.999Z';
          query += ' WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC';
          params.push(startDate, endDate);
        } else {
          query += ' ORDER BY created_at DESC';
        }
        
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return createResponse({ memos: results }, 200, corsHeaders);
      } catch (error) {
        return createResponse({ error: error.message }, 500, corsHeaders);
      }
    }

    // POST /api/memos - Create new memo
    if (url.pathname === '/api/memos' && request.method === 'POST') {
      try {
        let body;
        try {
          body = await request.json();
        } catch {
          return createResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
        }

        if (!body || typeof body !== 'object') {
          return createResponse({ error: 'Request body must be an object' }, 400, corsHeaders);
        }

        const content = validateContent(body.content);
        const now = new Date().toISOString();
        
        const { success } = await env.DB.prepare(
          'INSERT INTO memos (content, created_at, updated_at) VALUES (?, ?, ?)'
        ).bind(content, now, now).run();
        
        if (success) {
          const { results } = await env.DB.prepare(
            'SELECT id, content, created_at as createdAt, updated_at as updatedAt FROM memos ORDER BY created_at DESC LIMIT 1'
          ).all();
          return createResponse({ memo: results[0] }, 201, corsHeaders);
        } else {
          return createResponse({ error: 'Failed to create memo' }, 500, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }

    // PUT /api/memos/:id - Update memo
    if (url.pathname.startsWith('/api/memos/') && request.method === 'PUT') {
      try {
        const id = url.pathname.split('/').pop();
        validateId(id);

        let body;
        try {
          body = await request.json();
        } catch {
          return createResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
        }

        if (!body || typeof body !== 'object') {
          return createResponse({ error: 'Request body must be an object' }, 400, corsHeaders);
        }

        const content = validateContent(body.content);
        const now = new Date().toISOString();
        
        const { success } = await env.DB.prepare(
          'UPDATE memos SET content = ?, updated_at = ? WHERE id = ?'
        ).bind(content, now, id).run();
        
        if (success) {
          const { results } = await env.DB.prepare(
            'SELECT id, content, created_at as createdAt, updated_at as updatedAt FROM memos WHERE id = ?'
          ).bind(id).all();
          
          if (results.length === 0) {
            return createResponse({ error: 'Memo not found' }, 404, corsHeaders);
          }
          
          return createResponse({ memo: results[0] }, 200, corsHeaders);
        } else {
          return createResponse({ error: 'Failed to update memo' }, 500, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }

    // DELETE /api/memos/:id - Delete memo
    if (url.pathname.startsWith('/api/memos/') && request.method === 'DELETE') {
      try {
        const id = url.pathname.split('/').pop();
        validateId(id);
        
        const { success } = await env.DB.prepare(
          'DELETE FROM memos WHERE id = ?'
        ).bind(id).run();
        
        if (success) {
          return createResponse({ success: true, message: 'Memo deleted' }, 200, corsHeaders);
        } else {
          return createResponse({ error: 'Memo not found' }, 404, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }

    // GET / - Serve HTML
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(getHtml(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}

function getHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Memos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 280px; flex-shrink: 0; background: white; padding: 20px; box-shadow: 2px 0 8px rgba(0,0,0,0.1); position: sticky; top: 0; height: 100vh; overflow-y: auto; }
    .main { flex: 1; padding: 20px; min-width: 0; }
    h1 { text-align: center; color: #333; margin-bottom: 30px; }
    .input-area { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; position: sticky; top: 0; z-index: 10; }
    textarea { width: 100%; height: 100px; border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px; font-size: 16px; resize: vertical; transition: border-color 0.3s; }
    textarea:focus { outline: none; border-color: #007bff; }
    .btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; margin-top: 10px; transition: background 0.3s; }
    .btn:hover { background: #0056b3; }
    .btn-search { background: #28a745; margin-left: 10px; }
    .btn-search:hover { background: #1e7e34; }
    .btn-icon { padding: 12px 16px; font-size: 18px; }
    .memos-list { column-count: 3; column-gap: 15px; }
    @media (max-width: 900px) { .memos-list { column-count: 2; } }
    @media (max-width: 600px) { .memos-list { column-count: 1; } }
    .memo { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; break-inside: avoid; margin-bottom: 15px; position: relative; }
    .memo:hover { transform: translateY(-2px); }
    .memo-content { font-size: 16px; line-height: 1.6; color: #333; white-space: pre-wrap; margin-top: 20px; }
    .memo-time { font-size: 12px; color: #999; margin-top: 10px; }
    .memo-actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 4px; }
    .icon-btn { background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 14px; transition: background 0.2s; }
    .icon-btn:hover { background: #f0f0f0; }
    .icon-edit { color: #28a745; }
    .icon-delete { color: #dc3545; }
    .icon-save { color: #007bff; }
    .icon-cancel { color: #6c757d; }
    .calendar-area { margin-bottom: 20px; }
    .calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
    .calendar-nav { background: #f0f0f0; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .calendar-nav:hover { background: #e0e0e0; }
    .calendar-month { font-size: 16px; font-weight: bold; color: #333; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
    .calendar-day-header { font-size: 11px; color: #999; padding: 6px 0; }
    .calendar-day { padding: 8px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
    .calendar-day:hover { background: #f0f0f0; }
    .calendar-day.selected { background: #007bff; color: white; }
    .calendar-day.has-memo { position: relative; }
    .calendar-day.has-memo::after { content: ''; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); width: 5px; height: 5px; background: #28a745; border-radius: 50%; }
    .calendar-day.other-month { color: #ccc; }
    .calendar-day.today { border: 2px solid #007bff; }
    .filter-info { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px 15px; background: #e7f3ff; border-radius: 8px; }
    .filter-info span { color: #007bff; font-weight: 500; }
    .clear-filter { background: none; border: none; color: #dc3545; cursor: pointer; font-size: 14px; }
    .clear-filter:hover { text-decoration: underline; }
    .sidebar-title { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 20px; text-align: center; }
    @media (max-width: 768px) {
      .layout { flex-direction: column; }
      .sidebar { width: 100%; height: auto; position: relative; box-shadow: none; border-bottom: 1px solid #eee; }
    }

/* Dark theme styles */
.dark-theme {
  background: #1e1e1e;
  color: #f5f5f5;
}
.dark-theme .layout,
.dark-theme .sidebar,
.dark-theme .main,
.dark-theme .input-area,
.dark-theme .memo,
.dark-theme .calendar-day,
.dark-theme .filter-info,
.dark-theme .sidebar-title,
.dark-theme .btn,
.dark-theme .btn-search,
.dark-theme .btn-theme {
  background: #1e1e1e;
  color: #f5f5f5;
}

/* 增强对比度 */
.dark-theme textarea {
  background: #2e2e2e;
  color: #f5f5f5;
  border-color: #555;
}
.dark-theme .btn,
.dark-theme .btn-search,
.dark-theme .btn-theme {
  background: #3a3a3a;
  color: #f5f5f5;
}

/* 进一步提升对比度 */
  .dark-theme .memo {
    background: #000000;
    color: #ffffff;
    border: 1px solid #777777;
    box-shadow: 0 0 8px rgba(255,255,255,0.5);
  }

  /* Memo content text color for dark theme */
  .dark-theme .memo-content {
    color: #ffffff;
  }

/* Increase contrast for memo time in dark mode */
.dark-theme .memo-time {
  color: #ffffff;
}
.dark-theme .calendar-day {
  background: #2a2a2a;
  color: #e0e0e0;
}
.dark-theme .filter-info {
  background: #2a2a2a;
  color: #e0e0e0;
}
  </style>
</head>
<body>
  <div class="layout">
    <div class="sidebar">
      <div class="sidebar-title">📅 日历</div>
      <div class="calendar-area">
        <div class="calendar-header">
          <button class="calendar-nav" onclick="changeMonth(-1)">◀</button>
          <span class="calendar-month" id="calendarMonth"></span>
          <button class="calendar-nav" onclick="changeMonth(1)">▶</button>
        </div>
        <div class="calendar-grid" id="calendarGrid"></div>
      </div>
      <div id="filterInfo"></div>
    </div>
    <div class="main">
      <h1>📝 Memos</h1>
      <div class="input-area">
        <textarea id="memoInput" placeholder="写下你的想法..."></textarea>
        <button class="btn" id="addBtn" onclick="addMemo()">添加 Memo</button>
        <button class="btn btn-search" id="searchBtn" onclick="toggleSearch()">🔍</button>
        <button class="btn btn-theme" id="themeToggle" onclick="toggleTheme()">🌙</button>
      </div>
      <div class="memos-list" id="memosList"></div>
    </div>
  </div>
  <script>
    let editingId = null;
    let currentMonth = new Date();
    let selectedDate = null;
    let allMemos = [];
    let refreshInterval = null;
    let isSearching = false;
    let searchMode = false;

    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

    function renderCalendar() {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      document.getElementById("calendarMonth").textContent = year + "年 " + monthNames[month];

      const datesWithMemo = {};
      allMemos.forEach(function(memo) {
        const date = new Date(memo.createdAt);
        if (date.getFullYear() === year && date.getMonth() === month) {
          datesWithMemo[date.getDate()] = true;
        }
      });

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay();
      const daysInMonth = lastDay.getDate();

      const today = new Date();
      const todayDate = today.getDate();
      const todayMonth = today.getMonth();
      const todayYear = today.getFullYear();

      let html = "";
      for (let i = 0; i < dayNames.length; i++) {
        html = html + '<div class="calendar-day-header">' + dayNames[i] + '</div>';
      }

      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let j = startDay - 1; j >= 0; j--) {
        const d = prevMonthLastDay - j;
        html = html + '<div class="calendar-day other-month">' + d + '</div>';
      }

      for (let k = 1; k <= daysInMonth; k++) {
        const isToday = (year === todayYear && month === todayMonth && k === todayDate);
        const isSelected = (selectedDate && year === selectedDate.getFullYear() && month === selectedDate.getMonth() && k === selectedDate.getDate());
        const hasMemo = datesWithMemo[k];
        let classes = "calendar-day";
        if (isToday) classes = classes + " today";
        if (isSelected) classes = classes + " selected";
        if (hasMemo) classes = classes + " has-memo";
        html = html + '<div class="' + classes + '" onclick="selectDate(' + year + ', ' + month + ', ' + k + ')">' + k + '</div>';
      }

      const totalCells = startDay + daysInMonth;
      const remainingCells = 42 - totalCells;
      for (let m = 1; m <= remainingCells; m++) {
        html = html + '<div class="calendar-day other-month">' + m + '</div>';
      }

      document.getElementById("calendarGrid").innerHTML = html;
    }

    function changeMonth(delta) {
      currentMonth.setMonth(currentMonth.getMonth() + delta);
      renderCalendar();
    }

    function selectDate(year, month, day) {
      selectedDate = new Date(year, month, day);
      renderCalendar();
      filterByDate(selectedDate);
    }

    function filterByDate(date) {
      // 使用本地日期格式，避免时区问题
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = year + '-' + month + '-' + day;
      fetch("/api/memos?date=" + dateStr)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          renderMemos(data.memos);
          const filterInfo = document.getElementById("filterInfo");
          const dateDisplay = date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日";
          filterInfo.innerHTML = '<div class="filter-info"><span>📅 ' + dateDisplay + '</span><button class="clear-filter" onclick="clearFilter()">清除</button></div>';
        });
    }

    function clearFilter() {
      selectedDate = null;
      renderCalendar();
      document.getElementById("filterInfo").innerHTML = "";
      loadMemos();
    }

    function loadMemos() {
      fetch("/api/memos")
        .then(function(res) { return res.json(); })
        .then(function(data) {
          allMemos = data.memos;
          renderCalendar();
          if (!isSearching && !selectedDate) {
            renderMemos(data.memos);
          }
          // 如果有选中日期，重新应用日期过滤
          if (selectedDate && !isSearching) {
            filterByDate(selectedDate);
          }
        });
    }

    function renderMemos(memos) {
      const container = document.getElementById("memosList");
      if (memos.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">暂无 memos</p>';
        return;
      }
      let html = "";
      memos.forEach(function(memo) {
        if (editingId === memo.id) {
          html = html + '<div class="memo" id="memo-' + memo.id + '"><textarea id="edit-' + memo.id + '" style="width:100%;height:80px;border:2px solid #007bff;border-radius:8px;padding:10px;font-size:16px;resize:vertical;">' + escapeHtml(memo.content) + '</textarea><div class="memo-time">' + new Date(memo.createdAt).toLocaleString("zh-CN") + '</div><div class="memo-actions"><button class="icon-btn icon-save" onclick="saveEdit(' + memo.id + ')" title="保存">✓</button><button class="icon-btn icon-cancel" onclick="cancelEdit()" title="取消">✕</button></div></div>';
        } else {
          html = html + '<div class="memo" id="memo-' + memo.id + '"><div class="memo-content">' + escapeHtml(memo.content) + '</div><div class="memo-time">' + new Date(memo.createdAt).toLocaleString("zh-CN") + '</div><div class="memo-actions"><button class="icon-btn icon-edit" onclick="startEdit(' + memo.id + ')" title="编辑">✎</button><button class="icon-btn icon-delete" onclick="deleteMemo(' + memo.id + ')" title="删除">✕</button></div></div>';
        }
      });
      container.innerHTML = html;
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    function addMemo() {
      const input = document.getElementById("memoInput");
      const content = input.value.trim();
      if (!content) return alert("请输入内容");

      fetch("/api/memos", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ content: content })
      }).then(function() {
        input.value = "";
        loadMemos();
      });
    }

    function deleteMemo(id) {
      if (!confirm("确定要删除这个 memo 吗？")) return;
      fetch("/api/memos/" + id, { method: "DELETE" }).then(loadMemos);
    }

    loadMemos();
    refreshInterval = setInterval(loadMemos, 3000);

    function startEdit(id) {
      editingId = id;
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      loadMemos();
      setTimeout(function() {
        const textarea = document.getElementById("edit-" + id);
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      }, 50);
    }

    function saveEdit(id) {
      const textarea = document.getElementById("edit-" + id);
      const content = textarea.value.trim();
      if (!content) return alert("内容不能为空");

      fetch("/api/memos/" + id, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ content: content })
      }).then(function() {
        editingId = null;
        loadMemos();
        refreshInterval = setInterval(loadMemos, 3000);
      });
    }

    function cancelEdit() {
      editingId = null;
      loadMemos();
      refreshInterval = setInterval(loadMemos, 3000);
    }

    function toggleSearch() {
      const input = document.getElementById("memoInput");
      const addBtn = document.getElementById("addBtn");
      const searchBtn = document.getElementById("searchBtn");

      searchMode = !searchMode;

      if (searchMode) {
        input.placeholder = "输入关键词搜索...";
        addBtn.textContent = "搜索";
        addBtn.onclick = searchMemos;
        searchBtn.textContent = "✕";
        searchBtn.style.background = "#6c757d";
        input.value = "";
        input.focus();
        // 不再这里设置 isSearching，让 loadMemos 继续渲染
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      } else {
        clearSearch();
      }
    }

function searchMemos() {
  const input = document.getElementById("memoInput");
  const keyword = input.value.trim().toLowerCase();
  if (!keyword) return alert("请输入搜索关键词");

  // 标记为搜索状态，防止 loadMemos 重新渲染
  isSearching = true;
  searchMode = true;

  fetch("/api/memos")
    .then(function(res) { return res.json(); })
    .then(function(data) {
      allMemos = data.memos;
      renderCalendar();
      doSearch(keyword);
    })
    .catch(function(err) {
      console.error("搜索失败:", err);
      alert("搜索时出现错误，请稍后重试");
      isSearching = false;
      searchMode = false;
    });
}

    function doSearch(keyword) {
      const filtered = allMemos.filter(function(memo) {
        return memo.content.toLowerCase().indexOf(keyword) !== -1;
      });

      isSearching = true;
      renderMemos(filtered);
      document.getElementById("filterInfo").innerHTML = '<div class="filter-info"><span>🔍 搜索: ' + keyword + ' (' + filtered.length + '条)</span><button class="clear-filter" onclick="clearSearch()">清除</button></div>';
    }

    function clearSearch() {
      searchMode = false;
      isSearching = false;
      const input = document.getElementById("memoInput");
      const addBtn = document.getElementById("addBtn");
      const searchBtn = document.getElementById("searchBtn");

      input.placeholder = "写下你的想法...";
      addBtn.textContent = "添加 Memo";
      addBtn.onclick = addMemo;
      searchBtn.textContent = "🔍";
      searchBtn.style.background = "#28a745";
      input.value = "";
      document.getElementById("filterInfo").innerHTML = "";

      if (!refreshInterval) {
        refreshInterval = setInterval(loadMemos, 3000);
      }
      // 如果有选中日期，应用日期过滤；否则加载所有 memos
      if (selectedDate) {
        filterByDate(selectedDate);
      } else {
        loadMemos();
      }
    }

    function toggleTheme() {
      document.body.classList.toggle('dark-theme');
      const btn = document.getElementById('themeToggle');
      if (document.body.classList.contains('dark-theme')) {
        btn.textContent = '☀️';
      } else {
        btn.textContent = '🌙';
      }
    }
  </script>
</body>
</html>`;
}
