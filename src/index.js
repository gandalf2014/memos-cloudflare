// Utility functions
function createResponse(data, status = 200, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
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

function validateTagName(name) {
  if (typeof name !== 'string') {
    throw new Error('Tag name must be a string');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Tag name cannot be empty');
  }
  if (trimmed.length > 50) {
    throw new Error('Tag name too long (max 50 characters)');
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

    // GET /api/memos - List memos with filters, search, pagination
    if (url.pathname === '/api/memos' && request.method === 'GET') {
      try {
        const date = url.searchParams.get('date');
        const search = url.searchParams.get('search');
        const tag = url.searchParams.get('tag');
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
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
            return createResponse({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400, corsHeaders);
          }
          // 使用与数据库存储格式匹配的本地时间格式
          const startDate = date + ' 00:00:00';
          const endDate = date + ' 23:59:59';
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
        
        // Get total count
        let countQuery = `
          SELECT COUNT(DISTINCT m.id) as total
          FROM memos m
          LEFT JOIN memo_tags mt ON m.id = mt.memo_id
          LEFT JOIN tags t ON mt.tag_id = t.id
          WHERE m.deleted_at IS NULL
        `;
        const countParams = [];
        
        if (date) {
          const startDate = date + ' 00:00:00';
          const endDate = date + ' 23:59:59';
          countQuery += ` AND m.created_at >= ? AND m.created_at <= ?`;
          countParams.push(startDate, endDate);
        }
        
        if (search) {
          countQuery += ` AND m.content LIKE ?`;
          countParams.push(`%${search}%`);
        }
        
        if (tag) {
          countQuery += ` AND t.name = ?`;
          countParams.push(tag);
        }
        
        const { results: countResults } = await env.DB.prepare(countQuery).bind(...countParams).all();
        const total = countResults[0]?.total || 0;
        
        // Get all tags for memos in one query using GROUP_CONCAT
        if (results.length > 0) {
          const memoIds = results.map(m => m.id);
          const placeholders = memoIds.map(() => '?').join(',');
          const { results: tagResults } = await env.DB.prepare(
            `SELECT mt.memo_id, t.id, t.name 
             FROM memo_tags mt 
             JOIN tags t ON mt.tag_id = t.id 
             WHERE mt.memo_id IN (${placeholders})`
          ).bind(...memoIds).all();
          
          // Group tags by memo_id
          const tagsByMemo = {};
          for (const tag of tagResults) {
            if (!tagsByMemo[tag.memo_id]) {
              tagsByMemo[tag.memo_id] = [];
            }
            tagsByMemo[tag.memo_id].push({ id: tag.id, name: tag.name });
          }
          
          // Attach tags to memos
          for (const memo of results) {
            memo.tags = tagsByMemo[memo.id] || [];
          }
        }
        
        return createResponse({
          memos: results,
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

    // POST /api/memos - Create new memo
    if (url.pathname === '/api/memos' && request.method === 'POST') {
      try {
        let body;
        try {
          const text = await request.text();
          body = JSON.parse(text);
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
          const { results: idResult } = await env.DB.prepare(
            'SELECT id FROM memos ORDER BY created_at DESC LIMIT 1'
          ).all();
          const memoId = idResult[0].id;
          
          // Handle tags
          if (body.tags && Array.isArray(body.tags)) {
            for (const tagName of body.tags) {
              const trimmedTag = validateTagName(tagName);
              // Insert tag if not exists
              await env.DB.prepare(
                `INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)`
              ).bind(trimmedTag, now).run();
              
              // Get tag id
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
            `SELECT m.id, m.content, m.created_at as createdAt, m.updated_at as updatedAt, GROUP_CONCAT(t.name) as tags
             FROM memos m
             LEFT JOIN memo_tags mt ON m.id = mt.memo_id
             LEFT JOIN tags t ON mt.tag_id = t.id
             WHERE m.id = ?
             GROUP BY m.id`
          ).bind(memoId).all();
          
          const memo = results[0];
          memo.tags = memo.tags ? memo.tags.split(',') : [];
          
          return createResponse({ memo }, 201, corsHeaders);
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
          const text = await request.text();
          body = JSON.parse(text);
        } catch {
          return createResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
        }

        if (!body || typeof body !== 'object') {
          return createResponse({ error: 'Request body must be an object' }, 400, corsHeaders);
        }

        const content = validateContent(body.content);
        const now = new Date().toISOString();
        
        const { success } = await env.DB.prepare(
          'UPDATE memos SET content = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL'
        ).bind(content, now, id).run();
        
        if (success) {
          // Update tags if provided
          if (body.tags && Array.isArray(body.tags)) {
            // Remove existing tags
            await env.DB.prepare(`DELETE FROM memo_tags WHERE memo_id = ?`).bind(id).run();
            
            // Add new tags
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
            `SELECT m.id, m.content, m.created_at as createdAt, m.updated_at as updatedAt, GROUP_CONCAT(t.name) as tags
             FROM memos m
             LEFT JOIN memo_tags mt ON m.id = mt.memo_id
             LEFT JOIN tags t ON mt.tag_id = t.id
             WHERE m.id = ?
             GROUP BY m.id`
          ).bind(id).all();
          
          if (results.length === 0) {
            return createResponse({ error: 'Memo not found' }, 404, corsHeaders);
          }
          
          const memo = results[0];
          memo.tags = memo.tags ? memo.tags.split(',') : [];
          
          return createResponse({ memo }, 200, corsHeaders);
        } else {
          return createResponse({ error: 'Failed to update memo' }, 500, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }

    // DELETE /api/memos/:id - Soft delete memo
    if (url.pathname.startsWith('/api/memos/') && request.method === 'DELETE') {
      try {
        const id = url.pathname.split('/').pop();
        validateId(id);
        
        const now = new Date().toISOString();
        const { success } = await env.DB.prepare(
          'UPDATE memos SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
        ).bind(now, id).run();
        
        if (success) {
          return createResponse({ success: true, message: 'Memo deleted' }, 200, corsHeaders);
        } else {
          return createResponse({ error: 'Memo not found' }, 404, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }

    // GET /api/tags - List all tags
    if (url.pathname === '/api/tags' && request.method === 'GET') {
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

    // DELETE /api/tags/:id - Delete tag
    if (url.pathname.startsWith('/api/tags/') && request.method === 'DELETE') {
      try {
        const id = url.pathname.split('/').pop();
        validateId(id);
        
        const { success } = await env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
        
        if (success) {
          return createResponse({ success: true, message: 'Tag deleted' }, 200, corsHeaders);
        } else {
          return createResponse({ error: 'Tag not found' }, 404, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 400, corsHeaders);
      }
    }

    // POST /api/tags - Create tag
    if (url.pathname === '/api/tags' && request.method === 'POST') {
      try {
        let body;
        try {
          body = await request.json();
        } catch {
          return createResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
        }

        if (!body || !body.name) {
          return createResponse({ error: 'Tag name is required' }, 400, corsHeaders);
        }

        const name = validateTagName(body.name);
        const now = new Date().toISOString();
        
        const { success } = await env.DB.prepare(
          'INSERT INTO tags (name, created_at) VALUES (?, ?)'
        ).bind(name, now).run();
        
        if (success) {
          const { results } = await env.DB.prepare(
            'SELECT * FROM tags ORDER BY created_at DESC LIMIT 1'
          ).all();
          return createResponse({ tag: results[0] }, 201, corsHeaders);
        } else {
          return createResponse({ error: 'Tag already exists' }, 409, corsHeaders);
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
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
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
    .memo-content { font-size: 16px; line-height: 1.6; color: #333; white-space: pre-wrap; word-break: break-all; overflow-wrap: break-word; max-width: 100%; margin-top: 20px; }
    .memo-time { font-size: 12px; color: #999; margin-top: 10px; }
    .memo-actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 4px; }
    .icon-btn { background: none; border: none; cursor: pointer; padding: 6px; border-radius: 4px; transition: background 0.2s; display: flex; align-items: center; justify-content: center; }
    .icon-btn:hover { background: #f0f0f0; }
    .icon-btn svg { display: block; }
    .memo-actions-edit { top: auto; bottom: 10px; }
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
    .dark-theme .memo { background: #1e1e1e; color: #f5f5f5; border: 1px solid #444; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .dark-theme .memo-content { color: #f5f5f5; }
    .dark-theme .memo-time { color: #aaa; }
    .dark-theme .calendar-day { background: #2a2a2a; color: #f5f5f5; }
    .dark-theme .calendar-day:hover { background: #3a3a3a; }
    .dark-theme .calendar-day.other-month { color: #666; }
    .dark-theme .calendar-day-header { color: #aaa; }
    .dark-theme .filter-info { background: #2a2a2a; color: #f5f5f5; }
    .dark-theme .tag { background: #3a3a3a; color: #f5f5f5; }
    .dark-theme .tag:hover { background: #4a4a4a; }
    .dark-theme .tags-title { color: #f5f5f5; }
    .dark-theme .add-tag-form input { background: #2e2e2e; color: #f5f5f5; border-color: #555; }
    .dark-theme .pagination button { background: #2e2e2e; color: #f5f5f5; border-color: #555; }
    .dark-theme .pagination button:hover:not(:disabled) { background: #3a3a3a; }
    .dark-theme .pagination-info { color: #aaa; }
    .dark-theme .icon-btn { color: #f5f5f5; }
    .dark-theme h1 { color: #f5f5f5; }
    .dark-theme .calendar-month { color: #f5f5f5; }
    .dark-theme .icon-edit { color: #28a745; }
    .dark-theme .icon-delete { color: #dc3545; }
    .dark-theme .icon-save { color: #007bff; }
    .dark-theme .icon-cancel { color: #6c757d; }
    .dark-theme .icon-btn:hover { background: #3a3a3a; }
    .dark-theme .memo-actions-edit { top: auto; bottom: 10px; }
  </style>
</head>
<body class="dark-theme">
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
      
      <div class="tags-area">
        <div class="tags-title">🏷️ 标签</div>
        <div class="tags-list" id="tagsList"></div>
        <div class="add-tag-form">
          <input type="text" id="newTagInput" placeholder="新标签..." maxlength="50">
          <button onclick="addTag()">添加</button>
        </div>
      </div>
      
      <div id="filterInfo"></div>
    </div>
    <div class="main">
      <h1>📝 Memos</h1>
      <div class="input-area">
        <textarea id="memoInput" placeholder="写下你的想法..."></textarea>
        <div style="margin-top: 10px;">
          <input type="text" id="tagsInput" placeholder="标签（用逗号分隔）..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;">
        </div>
        <button class="btn" id="addBtn" onclick="addMemo()">添加 Memo</button>
        <button class="btn btn-search" id="searchBtn" onclick="toggleSearch()">🔍</button>
        <button class="btn btn-theme" id="themeToggle" onclick="toggleTheme()">☀️</button>
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
          const dateDisplay = date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日";
          filterInfo.innerHTML = '<div class="filter-info"><span>📅 ' + dateDisplay + '</span><button class="clear-filter" onclick="clearFilter()">清除</button></div>';
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
        .then(function(res) { 
          if (!res.ok) {
            throw new Error('HTTP error! status: ' + res.status);
          }
          return res.json(); 
        })
        .then(function(data) {
          allMemos = data.memos || [];
          renderCalendar();
          if (!isSearching && !selectedDate && !selectedTag) {
            renderMemos(data.memos);
          }
          renderPagination(data.pagination);
        })
        .catch(function(error) {
          console.error('加载失败:', error);
          document.getElementById("memosList").innerHTML = '<p style="text-align:center;color:#dc3545;">加载失败，请刷新重试</p>';
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
        const tagsHtml = memo.tags && memo.tags.length > 0 ? '<div class="memo-tags" style="margin-top: 10px;">' + memo.tags.map(function(t) { var tagName = typeof t === 'object' ? t.name : t; return '<span class="tag" onclick="filterByTag(' + String.fromCharCode(39) + escapeHtml(tagName) + String.fromCharCode(39) + ')" style="margin-right: 4px;">' + escapeHtml(tagName) + '</span>'; }).join('') + '</div>' : '';
        
        if (editingId === memo.id) {
          const currentTags = memo.tags ? memo.tags.map(function(t) { return typeof t === 'object' ? t.name : t; }).join(', ') : '';
          var editHtml = '<div class="memo" id="memo-' + memo.id + '">';
          editHtml += '<textarea id="edit-' + memo.id + '" style="width:100%;height:300px;border:2px solid #007bff;border-radius:8px;padding:10px;font-size:16px;resize:vertical;background:#2e2e2e;color:#f5f5f5;">' + escapeHtml(memo.content) + '</textarea>';
          editHtml += '<input type="text" id="edit-tags-' + memo.id + '" value="' + escapeHtml(currentTags) + '" placeholder="标签（用逗号分隔）..." style="width:100%;margin-top:8px;padding:8px;border:2px solid #555;border-radius:8px;font-size:14px;background:#2e2e2e;color:#f5f5f5;">';
          editHtml += '<div class="memo-time">' + new Date(memo.createdAt).toLocaleString("zh-CN") + '</div>';
          editHtml += '<div class="memo-actions memo-actions-edit">';
          editHtml += '<button class="icon-btn icon-save" onclick="saveEdit(' + memo.id + ')" title="保存">';
          editHtml += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">';
          editHtml += '<path d="M20 6L9 17l-5-5" />';
          editHtml += '</svg></button>';
          editHtml += '<button class="icon-btn icon-cancel" onclick="cancelEdit()" title="取消">';
          editHtml += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">';
          editHtml += '<circle cx="12" cy="12" r="10" opacity="0.2" fill="currentColor" />';
          editHtml += '<path d="M15 9l-6 6M9 9l6 6" />';
          editHtml += '</svg></button>';
          editHtml += '</div></div>';
          html += editHtml;
        } else {
          let content = escapeHtml(memo.content);
          if (currentSearchKeyword) {
            const regex = new RegExp('(' + escapeHtml(currentSearchKeyword) + ')', 'gi');
            content = content.replace(regex, '<span class="highlight">$1</span>');
          }
          var viewHtml = '<div class="memo" id="memo-' + memo.id + '">';
          viewHtml += '<div class="memo-content">' + content + '</div>';
          viewHtml += tagsHtml;
          viewHtml += '<div class="memo-time">' + new Date(memo.createdAt).toLocaleString("zh-CN") + '</div>';
          viewHtml += '<div class="memo-actions">';
          viewHtml += '<button class="icon-btn icon-edit" onclick="startEdit(' + memo.id + ')" title="编辑">';
          viewHtml += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">';
          viewHtml += '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />';
          viewHtml += '</svg></button>';
          viewHtml += '<button class="icon-btn icon-delete" onclick="deleteMemo(' + memo.id + ')" title="删除">';
          viewHtml += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">';
          viewHtml += '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />';
          viewHtml += '<line x1="10" y1="11" x2="10" y2="17" />';
          viewHtml += '<line x1="14" y1="11" x2="14" y2="17" />';
          viewHtml += '</svg></button>';
          viewHtml += '</div></div>';
          html += viewHtml;
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
      html += '<button onclick="goToPage(' + (pagination.page - 1) + ')" ' + (pagination.page === 1 ? 'disabled' : '') + '>上一页</button>';
      
      for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === 1 || i === pagination.totalPages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
          html += '<button onclick="goToPage(' + i + ')" ' + (i === pagination.page ? 'class="active"' : '') + '>' + i + '</button>';
        } else if (i === pagination.page - 3 || i === pagination.page + 3) {
          html += '<span style="padding: 8px;">...</span>';
        }
      }
      
      html += '<button onclick="goToPage(' + (pagination.page + 1) + ')" ' + (pagination.page === pagination.totalPages ? 'disabled' : '') + '>下一页</button>';
      html += '</div>';
      html += '<div class="pagination-info">第 ' + pagination.page + ' 页，共 ' + pagination.totalPages + ' 页 (' + pagination.total + ' 条)</div>';
      
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
      if (!content) return alert("请输入内容");
      
      const tagsValue = tagsInput.value.trim();
      const tags = tagsValue ? tagsValue.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t; }) : [];

      fetch("/api/memos", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ content: content, tags: tags })
      }).then(function(res) {
        if (!res.ok) {
          throw new Error('HTTP error! status: ' + res.status);
        }
        input.value = "";
        tagsInput.value = "";
        loadMemos();
        loadTags();
      }).catch(function(error) {
        console.error('添加失败:', error);
        alert('添加失败，请重试');
      });
    }

    function deleteMemo(id) {
      if (!confirm("确定要删除这个 memo 吗？")) return;
      fetch("/api/memos/" + id, { method: "DELETE" }).then(function() {
        loadMemos();
        loadTags();
      });
    }

    renderCalendar();
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
      if (!content) return alert("内容不能为空");
      
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
        input.placeholder = "输入关键词搜索...";
        addBtn.textContent = "搜索";
        addBtn.onclick = searchMemos;
        searchBtn.textContent = "✕";
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
      if (!keyword) return alert("请输入搜索关键词");
      
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
          document.getElementById("filterInfo").innerHTML = '<div class="filter-info"><span>🔍 搜索: ' + escapeHtml(keyword) + ' (' + data.pagination.total + '条)</span><button class="clear-filter" onclick="clearSearch()">清除</button></div>';
        })
        .catch(function(err) {
          console.error("搜索失败:", err);
          alert("搜索时出现错误，请稍后重试");
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

      input.placeholder = "写下你的想法...";
      addBtn.textContent = "添加 Memo";
      addBtn.onclick = addMemo;
      searchBtn.textContent = "🔍";
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
        btn.textContent = '☀️';
      } else {
        btn.textContent = '🌙';
      }
    }

    // Tags functions
    function loadTags() {
      fetch("/api/tags")
        .then(function(res) { 
          if (!res.ok) {
            throw new Error('HTTP error! status: ' + res.status);
          }
          return res.json(); 
        })
        .then(function(data) {
          const container = document.getElementById("tagsList");
          if (!data.tags || data.tags.length === 0) {
            container.innerHTML = '<span style="color:#999;font-size:12px;">暂无标签</span>';
            return;
          }
          let html = "";
          data.tags.forEach(function(tag) {
            const isActive = selectedTag === tag.name;
            html += '<span class="tag' + (isActive ? ' active' : '') + '" onclick="filterByTag(' + String.fromCharCode(39) + escapeHtml(tag.name) + String.fromCharCode(39) + ')">' + escapeHtml(tag.name) + '<span class="tag-delete" onclick="event.stopPropagation();deleteTag(' + tag.id + ')">×</span></span>';
          });
          container.innerHTML = html;
        })
        .catch(function(error) {
          console.error('加载标签失败:', error);
          document.getElementById("tagsList").innerHTML = '<span style="color:#dc3545;font-size:12px;">加载失败</span>';
        });
    }

    function addTag() {
      const input = document.getElementById("newTagInput");
      const name = input.value.trim();
      if (!name) return alert("请输入标签名称");
      
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
            alert(data.error || "创建标签失败");
          });
        }
      });
    }

    function deleteTag(id) {
      if (!confirm("确定要删除这个标签吗？")) return;
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
          document.getElementById("filterInfo").innerHTML = '<div class="filter-info"><span>🏷️ ' + escapeHtml(tagName) + ' (' + data.pagination.total + '条)</span><button class="clear-filter" onclick="clearFilter()">清除</button></div>';
        });
    }

    // Enter key for adding tags
    document.getElementById("newTagInput").addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        addTag();
      }
    });
  </script>
</body>
</html>`;
}
