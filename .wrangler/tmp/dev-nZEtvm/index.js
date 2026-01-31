var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-qlBemK/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-qlBemK/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.js
function createResponse(data, status = 200, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
__name(createResponse, "createResponse");
function validateId(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId) || numId <= 0) {
    throw new Error("Invalid ID");
  }
  return numId;
}
__name(validateId, "validateId");
function validateContent(content) {
  if (typeof content !== "string") {
    throw new Error("Content must be a string");
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error("Content cannot be empty");
  }
  if (trimmed.length > 1e4) {
    throw new Error("Content too long (max 10000 characters)");
  }
  return trimmed;
}
__name(validateContent, "validateContent");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (url.pathname === "/api/memos" && request.method === "GET") {
      try {
        const date = url.searchParams.get("date");
        let query = "SELECT id, content, created_at as createdAt, updated_at as updatedAt FROM memos";
        const params = [];
        if (date) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return createResponse({ error: "Invalid date format. Use YYYY-MM-DD" }, 400, corsHeaders);
          }
          const startDate = date + "T00:00:00.000Z";
          const endDate = date + "T23:59:59.999Z";
          query += " WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC";
          params.push(startDate, endDate);
        } else {
          query += " ORDER BY created_at DESC";
        }
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return createResponse({ memos: results }, 200, corsHeaders);
      } catch (error) {
        return createResponse({ error: error.message }, 500, corsHeaders);
      }
    }
    if (url.pathname === "/api/memos" && request.method === "POST") {
      try {
        let body;
        try {
          body = await request.json();
        } catch {
          return createResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
        }
        if (!body || typeof body !== "object") {
          return createResponse({ error: "Request body must be an object" }, 400, corsHeaders);
        }
        const content = validateContent(body.content);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const { success } = await env.DB.prepare(
          "INSERT INTO memos (content, created_at, updated_at) VALUES (?, ?, ?)"
        ).bind(content, now, now).run();
        if (success) {
          const { results } = await env.DB.prepare(
            "SELECT id, content, created_at as createdAt, updated_at as updatedAt FROM memos ORDER BY created_at DESC LIMIT 1"
          ).all();
          return createResponse({ memo: results[0] }, 201, corsHeaders);
        } else {
          return createResponse({ error: "Failed to create memo" }, 500, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }
    if (url.pathname.startsWith("/api/memos/") && request.method === "PUT") {
      try {
        const id = url.pathname.split("/").pop();
        validateId(id);
        let body;
        try {
          body = await request.json();
        } catch {
          return createResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
        }
        if (!body || typeof body !== "object") {
          return createResponse({ error: "Request body must be an object" }, 400, corsHeaders);
        }
        const content = validateContent(body.content);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const { success } = await env.DB.prepare(
          "UPDATE memos SET content = ?, updated_at = ? WHERE id = ?"
        ).bind(content, now, id).run();
        if (success) {
          const { results } = await env.DB.prepare(
            "SELECT id, content, created_at as createdAt, updated_at as updatedAt FROM memos WHERE id = ?"
          ).bind(id).all();
          if (results.length === 0) {
            return createResponse({ error: "Memo not found" }, 404, corsHeaders);
          }
          return createResponse({ memo: results[0] }, 200, corsHeaders);
        } else {
          return createResponse({ error: "Failed to update memo" }, 500, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }
    if (url.pathname.startsWith("/api/memos/") && request.method === "DELETE") {
      try {
        const id = url.pathname.split("/").pop();
        validateId(id);
        const { success } = await env.DB.prepare(
          "DELETE FROM memos WHERE id = ?"
        ).bind(id).run();
        if (success) {
          return createResponse({ success: true, message: "Memo deleted" }, 200, corsHeaders);
        } else {
          return createResponse({ error: "Memo not found" }, 404, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(getHtml(), {
        headers: { "Content-Type": "text/html" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};
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

/* \u589E\u5F3A\u5BF9\u6BD4\u5EA6 */
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

/* \u8FDB\u4E00\u6B65\u63D0\u5347\u5BF9\u6BD4\u5EA6 */
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
      <div class="sidebar-title">\u{1F4C5} \u65E5\u5386</div>
      <div class="calendar-area">
        <div class="calendar-header">
          <button class="calendar-nav" onclick="changeMonth(-1)">\u25C0</button>
          <span class="calendar-month" id="calendarMonth"></span>
          <button class="calendar-nav" onclick="changeMonth(1)">\u25B6</button>
        </div>
        <div class="calendar-grid" id="calendarGrid"></div>
      </div>
      <div id="filterInfo"></div>
    </div>
    <div class="main">
      <h1>\u{1F4DD} Memos</h1>
      <div class="input-area">
        <textarea id="memoInput" placeholder="\u5199\u4E0B\u4F60\u7684\u60F3\u6CD5..."></textarea>
        <button class="btn" id="addBtn" onclick="addMemo()">\u6DFB\u52A0 Memo</button>
        <button class="btn btn-search" id="searchBtn" onclick="toggleSearch()">\u{1F50D}</button>
        <button class="btn btn-theme" id="themeToggle" onclick="toggleTheme()">\u{1F319}</button>
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

    const monthNames = ["\u4E00\u6708", "\u4E8C\u6708", "\u4E09\u6708", "\u56DB\u6708", "\u4E94\u6708", "\u516D\u6708", "\u4E03\u6708", "\u516B\u6708", "\u4E5D\u6708", "\u5341\u6708", "\u5341\u4E00\u6708", "\u5341\u4E8C\u6708"];
    const dayNames = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"];

    function renderCalendar() {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      document.getElementById("calendarMonth").textContent = year + "\u5E74 " + monthNames[month];

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
      // \u4F7F\u7528\u672C\u5730\u65E5\u671F\u683C\u5F0F\uFF0C\u907F\u514D\u65F6\u533A\u95EE\u9898
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = year + '-' + month + '-' + day;
      fetch("/api/memos?date=" + dateStr)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          renderMemos(data.memos);
          const filterInfo = document.getElementById("filterInfo");
          const dateDisplay = date.getFullYear() + "\u5E74" + (date.getMonth() + 1) + "\u6708" + date.getDate() + "\u65E5";
          filterInfo.innerHTML = '<div class="filter-info"><span>\u{1F4C5} ' + dateDisplay + '</span><button class="clear-filter" onclick="clearFilter()">\u6E05\u9664</button></div>';
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
          // \u5982\u679C\u6709\u9009\u4E2D\u65E5\u671F\uFF0C\u91CD\u65B0\u5E94\u7528\u65E5\u671F\u8FC7\u6EE4
          if (selectedDate && !isSearching) {
            filterByDate(selectedDate);
          }
        });
    }

    function renderMemos(memos) {
      const container = document.getElementById("memosList");
      if (memos.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#999;">\u6682\u65E0 memos</p>';
        return;
      }
      let html = "";
      memos.forEach(function(memo) {
        if (editingId === memo.id) {
          html = html + '<div class="memo" id="memo-' + memo.id + '"><textarea id="edit-' + memo.id + '" style="width:100%;height:80px;border:2px solid #007bff;border-radius:8px;padding:10px;font-size:16px;resize:vertical;">' + escapeHtml(memo.content) + '</textarea><div class="memo-time">' + new Date(memo.createdAt).toLocaleString("zh-CN") + '</div><div class="memo-actions"><button class="icon-btn icon-save" onclick="saveEdit(' + memo.id + ')" title="\u4FDD\u5B58">\u2713</button><button class="icon-btn icon-cancel" onclick="cancelEdit()" title="\u53D6\u6D88">\u2715</button></div></div>';
        } else {
          html = html + '<div class="memo" id="memo-' + memo.id + '"><div class="memo-content">' + escapeHtml(memo.content) + '</div><div class="memo-time">' + new Date(memo.createdAt).toLocaleString("zh-CN") + '</div><div class="memo-actions"><button class="icon-btn icon-edit" onclick="startEdit(' + memo.id + ')" title="\u7F16\u8F91">\u270E</button><button class="icon-btn icon-delete" onclick="deleteMemo(' + memo.id + ')" title="\u5220\u9664">\u2715</button></div></div>';
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
      if (!content) return alert("\u8BF7\u8F93\u5165\u5185\u5BB9");

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
      if (!confirm("\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u4E2A memo \u5417\uFF1F")) return;
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
      if (!content) return alert("\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");

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
        input.placeholder = "\u8F93\u5165\u5173\u952E\u8BCD\u641C\u7D22...";
        addBtn.textContent = "\u641C\u7D22";
        addBtn.onclick = searchMemos;
        searchBtn.textContent = "\u2715";
        searchBtn.style.background = "#6c757d";
        input.value = "";
        input.focus();
        // \u4E0D\u518D\u8FD9\u91CC\u8BBE\u7F6E isSearching\uFF0C\u8BA9 loadMemos \u7EE7\u7EED\u6E32\u67D3
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
  if (!keyword) return alert("\u8BF7\u8F93\u5165\u641C\u7D22\u5173\u952E\u8BCD");

  // \u6807\u8BB0\u4E3A\u641C\u7D22\u72B6\u6001\uFF0C\u9632\u6B62 loadMemos \u91CD\u65B0\u6E32\u67D3
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
      console.error("\u641C\u7D22\u5931\u8D25:", err);
      alert("\u641C\u7D22\u65F6\u51FA\u73B0\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
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
      document.getElementById("filterInfo").innerHTML = '<div class="filter-info"><span>\u{1F50D} \u641C\u7D22: ' + keyword + ' (' + filtered.length + '\u6761)</span><button class="clear-filter" onclick="clearSearch()">\u6E05\u9664</button></div>';
    }

    function clearSearch() {
      searchMode = false;
      isSearching = false;
      const input = document.getElementById("memoInput");
      const addBtn = document.getElementById("addBtn");
      const searchBtn = document.getElementById("searchBtn");

      input.placeholder = "\u5199\u4E0B\u4F60\u7684\u60F3\u6CD5...";
      addBtn.textContent = "\u6DFB\u52A0 Memo";
      addBtn.onclick = addMemo;
      searchBtn.textContent = "\u{1F50D}";
      searchBtn.style.background = "#28a745";
      input.value = "";
      document.getElementById("filterInfo").innerHTML = "";

      if (!refreshInterval) {
        refreshInterval = setInterval(loadMemos, 3000);
      }
      // \u5982\u679C\u6709\u9009\u4E2D\u65E5\u671F\uFF0C\u5E94\u7528\u65E5\u671F\u8FC7\u6EE4\uFF1B\u5426\u5219\u52A0\u8F7D\u6240\u6709 memos
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
        btn.textContent = '\u2600\uFE0F';
      } else {
        btn.textContent = '\u{1F319}';
      }
    }
  <\/script>
</body>
</html>`;
}
__name(getHtml, "getHtml");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-qlBemK/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-qlBemK/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
