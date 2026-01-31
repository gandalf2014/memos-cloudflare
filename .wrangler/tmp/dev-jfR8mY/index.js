var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-gkf27X/checked-fetch.js
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

// .wrangler/tmp/bundle-gkf27X/strip-cf-connecting-ip-header.js
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
function validateTagName(name) {
  if (typeof name !== "string") {
    throw new Error("Tag name must be a string");
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("Tag name cannot be empty");
  }
  if (trimmed.length > 50) {
    throw new Error("Tag name too long (max 50 characters)");
  }
  return trimmed;
}
__name(validateTagName, "validateTagName");
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
        const search = url.searchParams.get("search");
        const tag = url.searchParams.get("tag");
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const limit = parseInt(url.searchParams.get("limit") || "20", 10);
        const offset = (page - 1) * limit;
        let query = `
          SELECT DISTINCT m.id, m.content, m.created_at as createdAt, m.updated_at as updatedAt
          FROM memos m
          LEFT JOIN memo_tags mt ON m.id = mt.memo_id
          LEFT JOIN tags t ON mt.tag_id = t.id
          WHERE m.deleted_at IS NULL
        `;
        const params = [];
        let paramIndex = 0;
        if (date) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return createResponse({ error: "Invalid date format. Use YYYY-MM-DD" }, 400, corsHeaders);
          }
          const startDate = date + "T00:00:00.000Z";
          const endDate = date + "T23:59:59.999Z";
          query += ` AND m.created_at >= ? AND m.created_at <= ?`;
          params.push(startDate, endDate);
          paramIndex += 2;
        }
        if (search) {
          query += ` AND m.content LIKE ?`;
          params.push(`%${search}%`);
          paramIndex += 1;
        }
        if (tag) {
          query += ` AND t.name = ?`;
          params.push(tag);
          paramIndex += 1;
        }
        query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        const { results } = await env.DB.prepare(query).bind(...params).all();
        let countQuery = `
          SELECT COUNT(DISTINCT m.id) as total
          FROM memos m
          LEFT JOIN memo_tags mt ON m.id = mt.memo_id
          LEFT JOIN tags t ON mt.tag_id = t.id
          WHERE m.deleted_at IS NULL
        `;
        const countParams = [];
        let countParamIndex = 0;
        if (date) {
          const startDate = date + "T00:00:00.000Z";
          const endDate = date + "T23:59:59.999Z";
          countQuery += ` AND m.created_at >= ? AND m.created_at <= ?`;
          countParams.push(startDate, endDate);
          countParamIndex += 2;
        }
        if (search) {
          countQuery += ` AND m.content LIKE ?`;
          countParams.push(`%${search}%`);
          countParamIndex += 1;
        }
        if (tag) {
          countQuery += ` AND t.name = ?`;
          countParams.push(tag);
          countParamIndex += 1;
        }
        const { results: countResults } = await env.DB.prepare(countQuery).bind(...countParams).all();
        const total = countResults[0]?.total || 0;
        const memosWithTags = await Promise.all(results.map(async (memo) => {
          const { results: tagResults } = await env.DB.prepare(
            `SELECT t.id, t.name FROM tags t JOIN memo_tags mt ON t.id = mt.tag_id WHERE mt.memo_id = ?`
          ).bind(memo.id).all();
          return { ...memo, tags: tagResults };
        }));
        return createResponse({
          memos: memosWithTags,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }, 200, corsHeaders);
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
          const { results: idResult } = await env.DB.prepare(
            "SELECT id FROM memos ORDER BY created_at DESC LIMIT 1"
          ).all();
          const memoId = idResult[0].id;
          if (body.tags && Array.isArray(body.tags)) {
            for (const tagName of body.tags) {
              const trimmedTag = validateTagName(tagName);
              await env.DB.prepare(
                `INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)`
              ).bind(trimmedTag, now).run();
              const { results: tagResult } = await env.DB.prepare(
                `SELECT id FROM tags WHERE name = ?`
              ).bind(trimmedTag).all();
              if (tagResult.length > 0) {
                await env.DB.prepare(
                  `INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)`
                ).bind(memoId, tagResult[0].id).run();
              }
            }
          }
          const { results } = await env.DB.prepare(
            `SELECT m.*, GROUP_CONCAT(t.name) as tags
             FROM memos m
             LEFT JOIN memo_tags mt ON m.id = mt.memo_id
             LEFT JOIN tags t ON mt.tag_id = t.id
             WHERE m.id = ?
             GROUP BY m.id`
          ).bind(memoId).all();
          const memo = results[0];
          memo.tags = memo.tags ? memo.tags.split(",") : [];
          return createResponse({ memo }, 201, corsHeaders);
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
          "UPDATE memos SET content = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL"
        ).bind(content, now, id).run();
        if (success) {
          if (body.tags && Array.isArray(body.tags)) {
            await env.DB.prepare(`DELETE FROM memo_tags WHERE memo_id = ?`).bind(id).run();
            for (const tagName of body.tags) {
              const trimmedTag = validateTagName(tagName);
              await env.DB.prepare(
                `INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)`
              ).bind(trimmedTag, now).run();
              const { results: tagResult } = await env.DB.prepare(
                `SELECT id FROM tags WHERE name = ?`
              ).bind(trimmedTag).all();
              if (tagResult.length > 0) {
                await env.DB.prepare(
                  `INSERT OR IGNORE INTO memo_tags (memo_id, tag_id) VALUES (?, ?)`
                ).bind(id, tagResult[0].id).run();
              }
            }
          }
          const { results } = await env.DB.prepare(
            `SELECT m.*, GROUP_CONCAT(t.name) as tags
             FROM memos m
             LEFT JOIN memo_tags mt ON m.id = mt.memo_id
             LEFT JOIN tags t ON mt.tag_id = t.id
             WHERE m.id = ?
             GROUP BY m.id`
          ).bind(id).all();
          if (results.length === 0) {
            return createResponse({ error: "Memo not found" }, 404, corsHeaders);
          }
          const memo = results[0];
          memo.tags = memo.tags ? memo.tags.split(",") : [];
          return createResponse({ memo }, 200, corsHeaders);
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
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const { success } = await env.DB.prepare(
          "UPDATE memos SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL"
        ).bind(now, id).run();
        if (success) {
          return createResponse({ success: true, message: "Memo deleted" }, 200, corsHeaders);
        } else {
          return createResponse({ error: "Memo not found" }, 404, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }
    if (url.pathname === "/api/tags" && request.method === "GET") {
      try {
        const { results } = await env.DB.prepare(
          `SELECT t.*, COUNT(mt.memo_id) as memo_count
           FROM tags t
           LEFT JOIN memo_tags mt ON t.id = mt.tag_id
           GROUP BY t.id
           ORDER BY t.name`
        ).all();
        return createResponse({ tags: results }, 200, corsHeaders);
      } catch (error) {
        return createResponse({ error: error.message }, 500, corsHeaders);
      }
    }
    if (url.pathname.startsWith("/api/tags/") && request.method === "DELETE") {
      try {
        const id = url.pathname.split("/").pop();
        validateId(id);
        const { success } = await env.DB.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
        if (success) {
          return createResponse({ success: true, message: "Tag deleted" }, 200, corsHeaders);
        } else {
          return createResponse({ error: "Tag not found" }, 404, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }
    if (url.pathname === "/api/tags" && request.method === "POST") {
      try {
        let body;
        try {
          body = await request.json();
        } catch {
          return createResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
        }
        if (!body || !body.name) {
          return createResponse({ error: "Tag name is required" }, 400, corsHeaders);
        }
        const name = validateTagName(body.name);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const { success } = await env.DB.prepare(
          "INSERT INTO tags (name, created_at) VALUES (?, ?)"
        ).bind(name, now).run();
        if (success) {
          const { results } = await env.DB.prepare(
            "SELECT * FROM tags ORDER BY created_at DESC LIMIT 1"
          ).all();
          return createResponse({ tag: results[0] }, 201, corsHeaders);
        } else {
          return createResponse({ error: "Tag already exists" }, 409, corsHeaders);
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
    .filter-info { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px 15px; background: #e7f3ff; border-radius: 8px; flex-wrap: wrap; }
    .filter-info span { color: #007bff; font-weight: 500; }
    .clear-filter { background: none; border: none; color: #dc3545; cursor: pointer; font-size: 14px; }
    .clear-filter:hover { text-decoration: underline; }
    .sidebar-title { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 20px; text-align: center; }
    @media (max-width: 768px) {
      .layout { flex-direction: column; }
      .sidebar { width: 100%; height: auto; position: relative; box-shadow: none; border-bottom: 1px solid #eee; }
    }

    /* Tags styles */
    .tags-area { margin-bottom: 20px; }
    .tags-title { font-size: 14px; font-weight: bold; color: #333; margin-bottom: 10px; }
    .tags-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { background: #e9ecef; color: #495057; padding: 4px 10px; border-radius: 20px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
    .tag:hover { background: #dee2e6; }
    .tag.active { background: #007bff; color: white; }
    .tag-delete { margin-left: 4px; opacity: 0.6; }
    .tag-delete:hover { opacity: 1; }
    .add-tag-form { display: flex; gap: 6px; margin-top: 10px; }
    .add-tag-form input { flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; }
    .add-tag-form button { padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }

    /* Pagination styles */
    .pagination { display: flex; justify-content: center; gap: 8px; margin-top: 20px; padding: 20px; }
    .pagination button { padding: 8px 14px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
    .pagination button:hover:not(:disabled) { background: #f0f0f0; }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination button.active { background: #007bff; color: white; border-color: #007bff; }
    .pagination-info { text-align: center; color: #666; font-size: 14px; margin-top: 10px; }

    /* Search highlight */
    .highlight { background: #fff3cd; padding: 0 2px; border-radius: 2px; }

    /* Dark theme styles */
    .dark-theme { background: #1e1e1e; color: #f5f5f5; }
    .dark-theme .layout, .dark-theme .sidebar, .dark-theme .main, .dark-theme .input-area, .dark-theme .memo, .dark-theme .calendar-day, .dark-theme .filter-info, .dark-theme .sidebar-title, .dark-theme .btn, .dark-theme .btn-search, .dark-theme .btn-theme { background: #1e1e1e; color: #f5f5f5; }
    .dark-theme textarea { background: #2e2e2e; color: #f5f5f5; border-color: #555; }
    .dark-theme .btn, .dark-theme .btn-search, .dark-theme .btn-theme { background: #3a3a3a; color: #f5f5f5; }
    .dark-theme .memo { background: #000000; color: #ffffff; border: 1px solid #777777; box-shadow: 0 0 8px rgba(255,255,255,0.5); }
    .dark-theme .memo-content { color: #ffffff; }
    .dark-theme .memo-time { color: #ffffff; }
    .dark-theme .calendar-day { background: #2a2a2a; color: #e0e0e0; }
    .dark-theme .filter-info { background: #2a2a2a; color: #e0e0e0; }
    .dark-theme .tag { background: #3a3a3a; color: #e0e0e0; }
    .dark-theme .tag:hover { background: #4a4a4a; }
    .dark-theme .add-tag-form input { background: #2e2e2e; color: #f5f5f5; border-color: #555; }
    .dark-theme .pagination button { background: #2e2e2e; color: #f5f5f5; border-color: #555; }
    .dark-theme .pagination button:hover:not(:disabled) { background: #3a3a3a; }
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
      
      <div class="tags-area">
        <div class="tags-title">\u{1F3F7}\uFE0F \u6807\u7B7E</div>
        <div class="tags-list" id="tagsList"></div>
        <div class="add-tag-form">
          <input type="text" id="newTagInput" placeholder="\u65B0\u6807\u7B7E..." maxlength="50">
          <button onclick="addTag()">\u6DFB\u52A0</button>
        </div>
      </div>
      
      <div id="filterInfo"></div>
    </div>
    <div class="main">
      <h1>\u{1F4DD} Memos</h1>
      <div class="input-area">
        <textarea id="memoInput" placeholder="\u5199\u4E0B\u4F60\u7684\u60F3\u6CD5..."></textarea>
        <div style="margin-top: 10px;">
          <input type="text" id="tagsInput" placeholder="\u6807\u7B7E\uFF08\u7528\u9017\u53F7\u5206\u9694\uFF09..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;">
        </div>
        <button class="btn" id="addBtn" onclick="addMemo()">\u6DFB\u52A0 Memo</button>
        <button class="btn btn-search" id="searchBtn" onclick="toggleSearch()">\u{1F50D}</button>
        <button class="btn btn-theme" id="themeToggle" onclick="toggleTheme()">\u{1F319}</button>
      </div>
      <div class="memos-list" id="memosList"></div>
      <div id="pagination"></div>
    </div>
  </div>
  <script>
    let editingId = null;
    let currentMonth = new Date();
    let selectedDate = null;
    let selectedTag = null;
    let allMemos = [];
    let refreshInterval = null;
    let isSearching = false;
    let searchMode = false;
    let currentPage = 1;
    let totalPages = 1;
    let currentSearchKeyword = '';

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
      selectedTag = null;
      currentPage = 1;
      renderCalendar();
      filterByDate(selectedDate);
    }

    function filterByDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = year + '-' + month + '-' + day;
      
      fetch("/api/memos?date=" + dateStr + "&page=" + currentPage)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          renderMemos(data.memos);
          renderPagination(data.pagination);
          const filterInfo = document.getElementById("filterInfo");
          const dateDisplay = date.getFullYear() + "\u5E74" + (date.getMonth() + 1) + "\u6708" + date.getDate() + "\u65E5";
          filterInfo.innerHTML = '<div class="filter-info"><span>\u{1F4C5} ' + dateDisplay + '</span><button class="clear-filter" onclick="clearFilter()">\u6E05\u9664</button></div>';
        });
    }

    function clearFilter() {
      selectedDate = null;
      selectedTag = null;
      currentPage = 1;
      renderCalendar();
      document.getElementById("filterInfo").innerHTML = "";
      loadMemos();
    }

    function loadMemos() {
      let url = "/api/memos?page=" + currentPage;
      if (selectedDate) {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        url = "/api/memos?date=" + year + '-' + month + '-' + day + "&page=" + currentPage;
      } else if (selectedTag) {
        url = "/api/memos?tag=" + encodeURIComponent(selectedTag) + "&page=" + currentPage;
      }
      
      fetch(url)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          allMemos = data.memos;
          renderCalendar();
          if (!isSearching && !selectedDate && !selectedTag) {
            renderMemos(data.memos);
          }
          renderPagination(data.pagination);
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
        const tagsHtml = memo.tags && memo.tags.length > 0 
          ? '<div class="memo-tags" style="margin-top: 10px;">' + memo.tags.map(function(t) {
              return '<span class="tag" onclick="filterByTag('' + escapeHtml(t) + '')" style="margin-right: 4px;">' + escapeHtml(t) + '</span>';
            }).join('') + '</div>'
          : '';
        
        if (editingId === memo.id) {
          const currentTags = memo.tags ? memo.tags.join(', ') : '';
          html = html + '<div class="memo" id="memo-' + memo.id + '"><textarea id="edit-' + memo.id + '" style="width:100%;height:80px;border:2px solid #007bff;border-radius:8px;padding:10px;font-size:16px;resize:vertical;">' + escapeHtml(memo.content) + '</textarea><input type="text" id="edit-tags-' + memo.id + '" value="' + escapeHtml(currentTags) + '" placeholder="\u6807\u7B7E\uFF08\u7528\u9017\u53F7\u5206\u9694\uFF09..." style="width:100%;margin-top:8px;padding:8px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;"><div class="memo-time">' + new Date(memo.createdAt).toLocaleString("zh-CN") + '</div>' + tagsHtml + '<div class="memo-actions"><button class="icon-btn icon-save" onclick="saveEdit(' + memo.id + ')" title="\u4FDD\u5B58">\u2713</button><button class="icon-btn icon-cancel" onclick="cancelEdit()" title="\u53D6\u6D88">\u2715</button></div></div>';
        } else {
          let content = memo.content;
          if (currentSearchKeyword) {
            const regex = new RegExp('(' + currentSearchKeyword + ')', 'gi');
            content = content.replace(regex, '<span class="highlight">$1</span>');
          }
          html = html + '<div class="memo" id="memo-' + memo.id + '"><div class="memo-content">' + content + '</div>' + tagsHtml + '<div class="memo-time">' + new Date(memo.createdAt).toLocaleString("zh-CN") + '</div><div class="memo-actions"><button class="icon-btn icon-edit" onclick="startEdit(' + memo.id + ')" title="\u7F16\u8F91">\u270E</button><button class="icon-btn icon-delete" onclick="deleteMemo(' + memo.id + ')" title="\u5220\u9664">\u2715</button></div></div>';
        }
      });
      container.innerHTML = html;
    }

    function renderPagination(pagination) {
      if (!pagination || pagination.totalPages <= 1) {
        document.getElementById("pagination").innerHTML = '';
        return;
      }
      
      let html = '<div class="pagination">';
      html += '<button onclick="goToPage(' + (pagination.page - 1) + ')" ' + (pagination.page === 1 ? 'disabled' : '') + '>\u4E0A\u4E00\u9875</button>';
      
      for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === 1 || i === pagination.totalPages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
          html += '<button onclick="goToPage(' + i + ')" ' + (i === pagination.page ? 'class="active"' : '') + '>' + i + '</button>';
        } else if (i === pagination.page - 3 || i === pagination.page + 3) {
          html += '<span style="padding: 8px;">...</span>';
        }
      }
      
      html += '<button onclick="goToPage(' + (pagination.page + 1) + ')" ' + (pagination.page === pagination.totalPages ? 'disabled' : '') + '>\u4E0B\u4E00\u9875</button>';
      html += '</div>';
      html += '<div class="pagination-info">\u7B2C ' + pagination.page + ' \u9875\uFF0C\u5171 ' + pagination.totalPages + ' \u9875 (' + pagination.total + ' \u6761)</div>';
      
      document.getElementById("pagination").innerHTML = html;
    }

    function goToPage(page) {
      if (page < 1 || page > totalPages) return;
      currentPage = page;
      loadMemos();
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    function addMemo() {
      const input = document.getElementById("memoInput");
      const tagsInput = document.getElementById("tagsInput");
      const content = input.value.trim();
      if (!content) return alert("\u8BF7\u8F93\u5165\u5185\u5BB9");
      
      const tagsValue = tagsInput.value.trim();
      const tags = tagsValue ? tagsValue.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t; }) : [];

      fetch("/api/memos", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ content: content, tags: tags })
      }).then(function() {
        input.value = "";
        tagsInput.value = "";
        loadMemos();
        loadTags();
      });
    }

    function deleteMemo(id) {
      if (!confirm("\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u4E2A memo \u5417\uFF1F")) return;
      fetch("/api/memos/" + id, { method: "DELETE" }).then(function() {
        loadMemos();
        loadTags();
      });
    }

    loadMemos();
    loadTags();
    refreshInterval = setInterval(loadMemos, 30000);

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
      const tagsInput = document.getElementById("edit-tags-" + id);
      const content = textarea.value.trim();
      if (!content) return alert("\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
      
      const tagsValue = tagsInput ? tagsInput.value.trim() : '';
      const tags = tagsValue ? tagsValue.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t; }) : [];

      fetch("/api/memos/" + id, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ content: content, tags: tags })
      }).then(function() {
        editingId = null;
        loadMemos();
        loadTags();
        refreshInterval = setInterval(loadMemos, 30000);
      });
    }

    function cancelEdit() {
      editingId = null;
      loadMemos();
      refreshInterval = setInterval(loadMemos, 30000);
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
      const keyword = input.value.trim();
      if (!keyword) return alert("\u8BF7\u8F93\u5165\u641C\u7D22\u5173\u952E\u8BCD");
      
      currentSearchKeyword = keyword.toLowerCase();
      selectedDate = null;
      selectedTag = null;
      currentPage = 1;
      isSearching = true;
      searchMode = true;

      fetch("/api/memos?search=" + encodeURIComponent(keyword) + "&page=" + currentPage)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          allMemos = data.memos;
          renderCalendar();
          renderMemos(data.memos);
          renderPagination(data.pagination);
          document.getElementById("filterInfo").innerHTML = '<div class="filter-info"><span>\u{1F50D} \u641C\u7D22: ' + escapeHtml(keyword) + ' (' + data.pagination.total + '\u6761)</span><button class="clear-filter" onclick="clearSearch()">\u6E05\u9664</button></div>';
        })
        .catch(function(err) {
          console.error("\u641C\u7D22\u5931\u8D25:", err);
          alert("\u641C\u7D22\u65F6\u51FA\u73B0\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
          isSearching = false;
          searchMode = false;
        });
    }

    function clearSearch() {
      searchMode = false;
      isSearching = false;
      currentSearchKeyword = '';
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
        refreshInterval = setInterval(loadMemos, 30000);
      }
      loadMemos();
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

    // Tags functions
    function loadTags() {
      fetch("/api/tags")
        .then(function(res) { return res.json(); })
        .then(function(data) {
          const container = document.getElementById("tagsList");
          if (data.tags.length === 0) {
            container.innerHTML = '<span style="color:#999;font-size:12px;">\u6682\u65E0\u6807\u7B7E</span>';
            return;
          }
          let html = "";
          data.tags.forEach(function(tag) {
            const isActive = selectedTag === tag.name;
            html += '<span class="tag' + (isActive ? ' active' : '') + '" onclick="filterByTag('' + escapeHtml(tag.name) + '')">' + escapeHtml(tag.name) + '<span class="tag-delete" onclick="event.stopPropagation();deleteTag(' + tag.id + ')">\xD7</span></span>';
          });
          container.innerHTML = html;
        });
    }

    function addTag() {
      const input = document.getElementById("newTagInput");
      const name = input.value.trim();
      if (!name) return alert("\u8BF7\u8F93\u5165\u6807\u7B7E\u540D\u79F0");
      
      fetch("/api/tags", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name: name })
      }).then(function(res) {
        if (res.ok) {
          input.value = "";
          loadTags();
        } else {
          res.json().then(function(data) {
            alert(data.error || "\u521B\u5EFA\u6807\u7B7E\u5931\u8D25");
          });
        }
      });
    }

    function deleteTag(id) {
      if (!confirm("\u786E\u5B9A\u8981\u5220\u9664\u8FD9\u4E2A\u6807\u7B7E\u5417\uFF1F")) return;
      fetch("/api/tags/" + id, { method: "DELETE" }).then(function() {
        loadTags();
      });
    }

    function filterByTag(tagName) {
      selectedTag = tagName;
      selectedDate = null;
      currentPage = 1;
      currentSearchKeyword = '';
      
      fetch("/api/memos?tag=" + encodeURIComponent(tagName) + "&page=" + currentPage)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          allMemos = data.memos;
          renderCalendar();
          renderMemos(data.memos);
          renderPagination(data.pagination);
          loadTags();
          document.getElementById("filterInfo").innerHTML = '<div class="filter-info"><span>\u{1F3F7}\uFE0F ' + escapeHtml(tagName) + ' (' + data.pagination.total + '\u6761)</span><button class="clear-filter" onclick="clearFilter()">\u6E05\u9664</button></div>';
        });
    }

    // Enter key for adding tags
    document.getElementById("newTagInput").addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        addTag();
      }
    });
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

// .wrangler/tmp/bundle-gkf27X/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-gkf27X/middleware-loader.entry.ts
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
