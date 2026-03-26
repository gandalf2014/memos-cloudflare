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

    // POST /api/auth/verify - Verify password
    if (url.pathname === '/api/auth/verify' && request.method === 'POST') {
      try {
        let body;
        try {
          body = await request.json();
        } catch {
          return createResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
        }

        const correctPassword = env.AUTH_PASSWORD || 'memos123';

        if (body.password === correctPassword) {
          // 浣跨敤绠€鍗曠殑闅忔満瀛楃涓蹭綔涓?token
          const token = Array.from({ length: 32 }, () =>
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
          ).join('');
          return createResponse({
            success: true,
            token: token
          }, 200, corsHeaders);
        } else {
          return createResponse({ success: false, error: 'Incorrect password' }, 401, corsHeaders);
        }
      } catch (error) {
        return createResponse({ error: error.message }, 500, corsHeaders);
      }
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
          // 浣跨敤 SQLite date() 鍑芥暟鎻愬彇鏃ユ湡閮ㄥ垎杩涜姣旇緝
          query += ` AND date(m.created_at) = ?`;
          params.push(date);
          paramIndex += 1;
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
          countQuery += ` AND date(m.created_at) = ?`;
          countParams.push(date);
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
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
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
  <title>备忘录</title>
  
  <!-- Phosphor Icons -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css">
  
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    /* CSS Custom Properties */
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
    }

    /* Light Theme Variables */
    body.light-theme {
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-tertiary: #f1f5f9;
      --glass-bg: rgba(255, 255, 255, 0.7);
      --glass-border: rgba(148, 163, 184, 0.2);
      --glass-highlight: rgba(255, 255, 255, 0.5);
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --accent-blue: #4f46e5;
      --accent-purple: #7c3aed;
      --accent-glow: rgba(79, 70, 229, 0.3);
      --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08);
      --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.12);
      --shadow-glow: 0 0 30px rgba(79, 70, 229, 0.2);
    }

    body.light-theme::before {
      opacity: 0.5;
    }

    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box;
    }
    
    html {
      scroll-behavior: smooth;
    }
    
    body {
      font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      color: var(--text-primary);
      line-height: 1.6;
      overflow-x: hidden;
      scroll-behavior: smooth;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Animated background gradient */
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(99, 102, 241, 0.05) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
      animation: gradientShift 20s ease infinite;
    }
    
    @keyframes gradientShift {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }
    
    .layout { 
      display: flex; 
      min-height: 100vh;
      position: relative;
      z-index: 1;
    }

    /* Sidebar toggle button */
    .sidebar-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      cursor: pointer;
      color: var(--text-primary);
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .sidebar-toggle:hover {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
    }

    .sidebar-toggle i {
      font-size: 16px;
    }

    /* Floating Panel Toggle */
    .float-panel-toggle {
      position: fixed;
      top: 20px;
      left: 20px;
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
      transition: all 0.3s ease;
      z-index: 1001;
    }

    .float-panel-toggle:hover {
      background: var(--accent-blue);
      color: white;
      transform: scale(1.1);
    }

    /* Floating Panel */
    .float-panel {
      position: fixed;
      top: 0;
      left: -320px;
      width: 300px;
      height: 100vh;
      background: var(--glass-bg);
      backdrop-filter: blur(30px);
      border-right: 1px solid var(--glass-border);
      z-index: 1002;
      transition: left 0.3s ease;
      overflow-y: auto;
      box-shadow: 4px 0 30px rgba(0, 0, 0, 0.2);
    }

    .float-panel.active {
      left: 0;
    }

    .float-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px;
      border-bottom: 1px solid var(--glass-border);
      position: sticky;
      top: 0;
      background: var(--glass-bg);
      z-index: 1;
    }

    .float-panel-header span {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .float-panel-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 8px;
      border-radius: var(--radius-sm);
      transition: all 0.2s;
    }

    .float-panel-close:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .float-panel-content {
      padding: 16px;
    }

    .panel-section {
      margin-bottom: 20px;
    }

    .panel-section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .panel-section-title i {
      font-size: 16px;
      color: var(--accent-blue);
    }

    .calendar-compact {
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      padding: 12px;
    }

    .main-content {
      width: 100%;
      min-height: 100vh;
    }

    .main {
      flex: 1;
      padding: 24px 32px 100px;
      min-width: 0;
      max-width: 1200px;
      margin: 0 auto;
    }

    .main-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .main-actions {
      display: flex;
      gap: 12px;
    }

    /* Header with gradient text */
    h1 { 
      text-align: center; 
      margin-bottom: 40px;
      font-size: 2.5rem;
      font-weight: 700;
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.02em;
    }
    
    /* Glass input area */
    .input-area { 
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      padding: 28px; 
      border-radius: var(--radius-xl); 
      box-shadow: var(--shadow-md);
      margin-bottom: 32px; 
      position: sticky; 
      top: 20px; 
      z-index: 100;
      transition: var(--transition-normal);
    }
    
    .input-area:hover {
      box-shadow: var(--shadow-glow);
      border-color: var(--accent-blue);
    }
    
    textarea { 
      width: 100%; 
      min-height: 120px; 
      border: 2px solid var(--glass-border); 
      border-radius: var(--radius-md); 
      padding: 16px; 
      font-size: 16px; 
      resize: vertical; 
      transition: var(--transition-fast);
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-family: inherit;
      line-height: 1.6;
    }
    
    textarea:focus { 
      outline: none; 
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    
    textarea::placeholder {
      color: var(--text-muted);
    }
    
    /* Modern buttons */
    .btn { 
      background: var(--accent-gradient);
      color: white; 
      border: none; 
      padding: 14px 28px; 
      border-radius: var(--radius-md); 
      cursor: pointer; 
      font-size: 15px;
      font-weight: 500;
      margin-top: 16px; 
      transition: var(--transition-fast);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
    }
    
    .btn:hover { 
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }
    
    .btn:active {
      transform: translateY(0) scale(0.98);
      box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
    }
    
    .btn-search { 
      background: var(--bg-tertiary);
      color: var(--text-primary);
      margin-left: 12px;
      box-shadow: var(--shadow-sm);
    }
    
    .btn-search:hover { 
      background: var(--accent-blue);
    }
    
    .btn-theme {
      background: var(--bg-tertiary);
      margin-left: 12px;
      box-shadow: var(--shadow-sm);
    }
    
    .btn-theme:hover {
      background: var(--accent-purple);
    }
    
    .btn-search i,
    .btn-theme i {
      color: var(--text-primary);
      font-size: 20px;
    }
    
    .btn-search:hover i,
    .btn-theme:hover i {
      color: white;
    }
    
    .btn-search:hover {
      color: white;
    }
    
    /* Masonry waterfall layout for memos */
    .memos-list { 
      column-count: 3;
      column-gap: 24px;
      animation: slideIn 0.6s ease-out;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Glass memo cards - Masonry layout */
    .memo {
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      padding: 24px;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      transition: var(--transition-normal);
      position: relative;
      overflow: hidden;
      animation: cardAppear 0.5s ease-out backwards;
      break-inside: avoid;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .memo:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
      border-color: var(--accent-blue);
    }
    
    @keyframes cardAppear {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    
    .memo:hover { 
      transform: translateY(-4px);
      box-shadow: var(--shadow-glow);
      border-color: var(--accent-blue);
    }
    
    .memo::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--accent-gradient);
      opacity: 0;
      transition: var(--transition-fast);
    }
    
    .memo:hover::before {
      opacity: 1;
    }
    
    .memo-content { 
      font-size: 15px; 
      line-height: 1.7; 
      color: var(--text-primary);
      white-space: pre-wrap; 
      word-break: break-word;
      overflow-wrap: break-word;
      margin-top: 16px;
    }
    
    .memo-time { 
      font-size: 13px; 
      color: var(--text-muted); 
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .memo-time::before {
      font-family: 'Phosphor';
      content: '\\f2d3';
      font-size: 14px;
    }
    
    /* Floating action buttons */
    .memo-actions { 
      position: absolute; 
      top: 16px; 
      right: 16px; 
      display: flex; 
      gap: 8px;
      opacity: 0;
      transform: translateY(-10px);
      transition: var(--transition-fast);
    }
    
    .memo:hover .memo-actions {
      opacity: 1;
      transform: translateY(0);
    }
    
    .icon-btn {
      background: var(--bg-secondary);
      border: 1px solid var(--glass-border);
      cursor: pointer;
      padding: 10px;
      border-radius: var(--radius-md);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .icon-btn:hover {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .icon-btn:active {
      transform: scale(0.95);
    }

    .icon-btn i {
      font-size: 18px;
    }
    
    .memo-actions-edit { 
      position: static;
      opacity: 1;
      transform: none;
      margin-top: 16px;
      justify-content: flex-end;
    }
    
    /* Calendar glass styling */
    .calendar-area {
      margin-bottom: 20px;
      background: transparent;
      padding: 12px;
    }

    .calendar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .calendar-nav {
      background: var(--bg-tertiary);
      border: 1px solid var(--glass-border);
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 14px;
      color: var(--text-secondary);
      transition: var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .calendar-nav:hover {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
      transform: scale(1.05);
    }

    .calendar-month {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: 0.5px;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
      text-align: center;
    }
    
    .calendar-day-header {
      font-size: 12px;
      color: var(--text-muted);
      padding: 8px 0;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .calendar-day {
      padding: 6px 2px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
      color: var(--text-secondary);
      position: relative;
    }

    .calendar-day:hover {
      background: var(--glass-highlight);
      color: var(--text-primary);
      transform: scale(1.1);
    }

    .calendar-day.selected {
      background: var(--accent-gradient);
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      transform: scale(1.05);
    }

    .calendar-day.has-memo {
      position: relative;
      color: var(--accent-blue);
      font-weight: 600;
    }

    .calendar-day.has-memo::after {
      content: '';
      position: absolute;
      bottom: 4px;
      left: 50%;
      transform: translateX(-50%);
      width: 5px;
      height: 5px;
      background: var(--accent-blue);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--accent-blue);
      animation: pulse-dot 2s ease-in-out infinite;
    }

    .calendar-day.other-month {
      color: var(--text-muted);
      opacity: 0.4;
    }

    .calendar-day.today {
      border: 2px solid var(--accent-blue);
      color: var(--accent-blue);
      font-weight: 700;
      background: rgba(99, 102, 241, 0.1);
    }
    
    /* Filter info */
    .filter-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding: 16px 20px;
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      animation: slideIn 0.3s ease-out;
    }

    .filter-info span {
      color: var(--accent-blue);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .filter-info span::before {
      font-family: 'Phosphor';
      font-size: 18px;
    }

    .filter-info span[data-type="date"]::before {
      content: '\\f2d3';
    }

    .filter-info span[data-type="tag"]::before {
      content: '\\f31f';
    }

    .filter-info span[data-type="search"]::before {
      content: '\\f1e3';
    }

    .clear-filter {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--error);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: var(--radius-md);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .clear-filter:hover {
      background: var(--error);
      color: white;
      transform: scale(1.05);
    }

    .clear-filter::before {
      font-family: 'Phosphor';
      content: '\\f1b0';
    }
    
    .sidebar-title { 
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .sidebar-title::before {
      font-family: 'Phosphor';
      font-size: 18px;
    }
    
    /* Tags styling */
    .tags-area { 
      margin-bottom: 24px;
    }
    
    .tags-title { 
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .tags-title::before {
      font-family: 'Phosphor';
      content: '\\f31f';
      font-size: 18px;
    }
    
    .tags-list { 
      display: flex; 
      flex-wrap: wrap; 
      gap: 8px;
    }
    
    .tag { 
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      cursor: pointer;
      transition: var(--transition-fast);
      border: 1px solid var(--glass-border);
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
      line-height: 1;
      transition: var(--transition-fast);
    }
    
    .tag-delete:hover { 
      opacity: 1;
      transform: scale(1.2);
    }
    
    .add-tag-form {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      margin-bottom: 12px;
    }

    .add-tag-form input {
      flex: 1;
      padding: 8px 10px;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      font-size: 12px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      transition: var(--transition-fast);
    }
    
    .add-tag-form input:focus {
      outline: none;
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 2px var(--accent-glow);
    }
    
    .add-tag-form input::placeholder {
      color: var(--text-muted);
    }
    
    .add-tag-form button { 
      padding: 10px 16px;
      background: var(--success);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: var(--transition-fast);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .add-tag-form button::before {
      font-family: 'Phosphor';
      content: '\\f13d';
    }
    
    .add-tag-form button:hover {
      background: #16a34a;
      transform: translateY(-1px);
    }
    
    /* Modern pagination */
    .pagination { 
      display: flex; 
      justify-content: center; 
      gap: 8px; 
      margin-top: 40px; 
      padding: 24px;
    }
    
    .pagination button { 
      padding: 10px 16px;
      border: 1px solid var(--glass-border);
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: var(--transition-fast);
      font-weight: 500;
      min-width: 40px;
    }
    
    .pagination button:hover:not(:disabled) { 
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-color: var(--accent-blue);
      transform: translateY(-1px);
    }
    
    .pagination button:disabled { 
      opacity: 0.4;
      cursor: not-allowed;
    }
    
    .pagination button.active { 
      background: var(--accent-gradient);
      color: white;
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }
    
    .pagination-info {
      text-align: center;
      color: var(--text-muted);
      font-size: 14px;
      margin-top: 12px;
    }

    /* Scroll to top button */
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
      transition: all 0.3s ease;
      opacity: 0;
      visibility: hidden;
      z-index: 1000;
    }

    .scroll-top-btn.visible {
      opacity: 1;
      visibility: visible;
    }

    .scroll-top-btn:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lg);
      background: var(--accent-blue);
      color: white;
    }
    
    /* Search highlight */
    .highlight { 
      background: rgba(99, 102, 241, 0.3);
      padding: 2px 4px;
      border-radius: 4px;
      color: var(--accent-blue);
      font-weight: 500;
    }
    
    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }

    .empty-state-icon {
      font-size: 64px;
      margin-bottom: 20px;
      opacity: 0.4;
      animation: float 3s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    .empty-state-text {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .empty-state-hint {
      font-size: 14px;
      opacity: 0.7;
      margin-top: 12px;
    }
    
    /* Loading state */
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 60px;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--glass-border);
      border-top-color: var(--accent-blue);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Skeleton loading for memos */
    .skeleton {
      background: linear-gradient(90deg, var(--glass-bg) 25%, var(--glass-highlight) 50%, var(--glass-bg) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius-md);
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .skeleton-memo {
      height: 150px;
      margin-bottom: 24px;
      border-radius: var(--radius-lg);
    }

    .skeleton-memo:nth-child(2) { height: 180px; animation-delay: 0.1s; }
    .skeleton-memo:nth-child(3) { height: 120px; animation-delay: 0.2s; }
    .skeleton-memo:nth-child(4) { height: 200px; animation-delay: 0.3s; }
    .skeleton-memo:nth-child(5) { height: 140px; animation-delay: 0.4s; }
    
    /* Memo tags inside cards */
    .memo-tags {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .memo-tags .tag {
      font-size: 12px;
      padding: 4px 10px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      color: var(--accent-blue);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .memo-tags .tag:hover {
      background: var(--accent-blue);
      color: white;
      transform: scale(1.05);
    }
    
    /* Responsive design */
    @media (max-width: 1200px) {
      .memos-list {
        column-count: 2;
        column-gap: 20px;
      }
    }
    
    @media (max-width: 768px) {
      .layout { 
        flex-direction: column;
      }
      
      .sidebar { 
        width: 100%; 
        height: auto; 
        position: relative;
        border-right: none;
        border-bottom: 1px solid var(--glass-border);
        padding: 20px;
      }
      
      .main {
        padding: 20px;
      }
      
      h1 {
        font-size: 1.8rem;
        margin-bottom: 24px;
      }
      
      .memos-list {
        column-count: 1;
        column-gap: 16px;
      }
      
      .input-area {
        padding: 20px;
        position: relative;
        top: 0;
      }
      
      .calendar-area {
        margin-bottom: 20px;
      }
    }
    
    @media (max-width: 480px) {
      .main {
        padding: 16px;
        padding-bottom: 100px;
      }

      .memo {
        padding: 20px;
      }

      .memo-actions {
        opacity: 1;
        transform: none;
        position: static;
        margin-top: 12px;
        justify-content: flex-end;
      }

      h1 {
        font-size: 1.5rem;
      }

      .input-area {
        padding: 16px;
      }

      textarea {
        min-height: 100px;
        font-size: 15px;
      }

      .btn {
        padding: 12px 20px;
        font-size: 14px;
      }

      /* Better touch targets on mobile */
      .icon-btn {
        min-width: 40px;
        min-height: 40px;
      }

      .calendar-day {
        padding: 12px 4px;
        font-size: 14px;
      }

      .search-box {
        padding: 8px 8px 8px 12px;
      }

      .toast {
        min-width: calc(100vw - 40px);
        max-width: calc(100vw - 40px);
        right: 20px;
        left: 20px;
      }

      .toast-container {
        right: 10px;
        left: 10px;
      }
    }
    
    /* Mobile Bottom Navigation */
    .mobile-nav {
      display: none;
    }

    @media (max-width: 768px) {
      .mobile-nav {
        display: flex;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--glass-bg);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-top: 1px solid var(--glass-border);
        padding: 12px 20px;
        padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        z-index: 999;
        justify-content: space-around;
        align-items: center;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
      }

      .mobile-nav-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        padding: 8px 16px;
        border-radius: var(--radius-md);
        transition: all 0.2s;
        min-width: 60px;
      }

      .mobile-nav-btn i {
        font-size: 24px;
      }

      .mobile-nav-btn.active {
        color: var(--accent-blue);
        background: rgba(99, 102, 241, 0.15);
      }

      .mobile-nav-btn:active {
        transform: scale(0.95);
        background: rgba(99, 102, 241, 0.2);
      }

      /* Add padding to main for bottom nav */
      .main {
        padding-bottom: 100px;
      }
      
      /* Mobile sidebar toggle */
      .sidebar {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 80px;
        z-index: 100;
        height: calc(100vh - 80px);
        overflow-y: auto;
        animation: slideUp 0.3s ease-out;
      }
      
      .sidebar.show {
        display: block;
      }
      
      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      /* FAB button */
      .fab-btn {
        display: flex;
        position: fixed;
        bottom: 32px;
        right: 32px;
        width: 64px;
        height: 64px;
        background: var(--accent-gradient);
        border: none;
        border-radius: 50%;
        color: white;
        font-size: 28px;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 8px 32px rgba(99, 102, 241, 0.5);
        z-index: 998;
        transition: all 0.3s ease;
        animation: fabPulse 2s ease-in-out infinite;
      }

      @keyframes fabPulse {
        0%, 100% { box-shadow: 0 8px 32px rgba(99, 102, 241, 0.5); }
        50% { box-shadow: 0 8px 40px rgba(99, 102, 241, 0.7); }
      }

      .fab-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 12px 40px rgba(99, 102, 241, 0.6);
        animation: none;
      }

      .fab-btn:active {
        transform: scale(0.95);
      }

      .fab-btn.fab-secondary {
        width: 48px;
        height: 48px;
        font-size: 20px;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        color: var(--text-primary);
        box-shadow: var(--shadow-md);
      }

      .fab-btn.fab-secondary:hover {
        background: var(--accent-blue);
        color: white;
        border-color: var(--accent-blue);
      }

      /* Touch-friendly buttons */
      .btn, .icon-btn, .memo-action-btn, .calendar-day {
        min-height: 44px;
        min-width: 44px;
      }
      
      /* Mobile input optimization */
      .input-area {
        position: relative;
      }
      
      textarea, .login-input {
        font-size: 16px; /* Prevent zoom on iOS */
      }
      
      /* Mobile login overlay */
      .login-container {
        padding: 32px 24px;
      }
      
      .login-title {
        font-size: 24px;
      }
    }
    
    /* Hide mobile elements on desktop */
    @media (min-width: 769px) {
      .mobile-nav,
      .fab-btn {
        display: none !important;
      }
    }
    
    /* Custom scrollbar for the whole page */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }
    
    ::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: var(--accent-blue);
    }

    /* Modern Modal Dialog */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
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
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 28px;
      max-width: 420px;
      width: 90%;
      box-shadow: var(--shadow-lg), 0 0 60px rgba(0, 0, 0, 0.4);
      transform: scale(0.9) translateY(20px);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .modal-overlay.active .modal-container {
      transform: scale(1) translateY(0);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
      width: 100%;
    }

    .modal-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
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

    .modal-body {
      margin-bottom: 24px;
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
    }

    .modal-btn {
      padding: 12px 24px;
      border-radius: var(--radius-md);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .modal-btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border: 1px solid var(--glass-border);
    }

    .modal-btn-secondary:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-color: var(--text-secondary);
    }

    .modal-btn-danger {
      background: var(--error);
      color: white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .modal-btn-danger:hover {
      background: #dc2626;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }

    .modal-btn-primary {
      background: var(--accent-gradient);
      color: white;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .modal-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      border-radius: var(--radius-sm);
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-close:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .modal-close i {
      font-size: 20px;
    }

    /* Login Overlay */
    .login-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-primary);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .login-overlay.hidden {
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.5s ease;
    }

    .login-container {
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      padding: 48px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: var(--shadow-lg), 0 0 60px rgba(99, 102, 241, 0.2);
      animation: loginAppear 0.6s ease-out;
    }

    @keyframes loginAppear {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(30px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .login-icon {
      margin-bottom: 24px;
      display: inline-block;
      animation: iconFloat 3s ease-in-out infinite;
      color: var(--accent-blue);
    }

    .login-icon i {
      font-size: 56px;
    }

    @keyframes iconFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    .login-title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .login-subtitle {
      color: var(--text-secondary);
      margin-bottom: 32px;
      font-size: 15px;
    }

    .login-input-group {
      position: relative;
      margin-bottom: 24px;
    }

    .login-input {
      width: 100%;
      padding: 16px 20px;
      font-size: 16px;
      background: var(--bg-secondary);
      border: 2px solid var(--glass-border);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      transition: all 0.3s ease;
      text-align: center;
      letter-spacing: 2px;
    }

    .login-input:focus {
      outline: none;
      border-color: var(--accent-blue);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
    }

    .login-input::placeholder {
      color: var(--text-muted);
      letter-spacing: normal;
    }

    .login-btn {
      width: 100%;
      padding: 16px;
      font-size: 16px;
      font-weight: 600;
      background: var(--accent-gradient);
      color: white;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    }

    .login-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.5);
    }

    .login-btn:active {
      transform: translateY(0);
    }

    .login-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .login-error {
      color: var(--error);
      font-size: 14px;
      margin-top: 16px;
      display: none;
      animation: shake 0.5s ease;
    }

    .login-error.show {
      display: block;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }

    .login-hint {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 24px;
    }

    /* Toast Notifications */
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
      transition: all 0.3s ease;
    }

    .toast.hide {
      animation: toastSlideOut 0.3s ease forwards;
    }

    @keyframes toastSlideIn {
      from {
        transform: translateX(120%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes toastSlideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .toast-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .toast-content {
      flex: 1;
    }

    .toast-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary);
      margin-bottom: 4px;
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
      transition: all 0.2s ease;
    }

    .toast-action:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .toast.success { border-left: 3px solid var(--success); }
    .toast.error { border-left: 3px solid var(--error); }
    .toast.warning { border-left: 3px solid var(--warning); }
    .toast.info { border-left: 3px solid var(--accent-blue); }

    /* Markdown Styles */
    .memo-content.markdown {
      line-height: 1.8;
    }

    .memo-content.markdown h1,
    .memo-content.markdown h2,
    .memo-content.markdown h3,
    .memo-content.markdown h4 {
      margin-top: 16px;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .memo-content.markdown h1 { font-size: 1.5em; }
    .memo-content.markdown h2 { font-size: 1.3em; }
    .memo-content.markdown h3 { font-size: 1.1em; }

    .memo-content.markdown p {
      margin-bottom: 12px;
    }

    .memo-content.markdown ul,
    .memo-content.markdown ol {
      margin-left: 20px;
      margin-bottom: 12px;
    }

    .memo-content.markdown li {
      margin-bottom: 4px;
    }

    .memo-content.markdown code {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }

    .memo-content.markdown pre {
      background: var(--bg-tertiary);
      padding: 12px;
      border-radius: var(--radius-sm);
      overflow-x: auto;
      margin-bottom: 12px;
    }

    .memo-content.markdown pre code {
      background: none;
      padding: 0;
    }

    .memo-content.markdown blockquote {
      border-left: 3px solid var(--accent-blue);
      padding-left: 12px;
      margin-left: 0;
      margin-bottom: 12px;
      color: var(--text-secondary);
    }

    .memo-content.markdown a {
      color: var(--accent-blue);
      text-decoration: none;
    }

    .memo-content.markdown a:hover {
      text-decoration: underline;
    }

    .memo-content.markdown strong {
      font-weight: 600;
    }

    .memo-content.markdown em {
      font-style: italic;
    }

    .memo-content.markdown hr {
      border: none;
      border-top: 1px solid var(--glass-border);
      margin: 16px 0;
    }

    /* Search Area */
    .search-area {
      margin-bottom: 16px;
      animation: slideIn 0.2s ease;
    }

    .search-box {
      display: flex;
      align-items: center;
      background: var(--bg-secondary);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      padding: 4px 4px 4px 12px;
      transition: all 0.3s ease;
    }

    .search-box:focus-within {
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 2px var(--accent-glow);
    }

    .search-input {
      border: none;
      background: transparent;
      flex: 1;
      padding: 8px 0;
      color: var(--text-primary);
      outline: none;
      font-size: 14px;
      min-width: 0;
    }
    
    .search-input::placeholder {
      color: var(--text-muted);
    }

    .search-action-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 8px;
      cursor: pointer;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .search-action-btn:hover {
      background: var(--bg-tertiary);
      color: var(--accent-blue);
    }

    .export-area {
      display: flex;
      align-items: center;
    }

    /* Keyboard shortcut hint */
    .shortcut-hint {
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      padding: 16px 20px;
      font-size: 13px;
      color: var(--text-muted);
      z-index: 100;
      opacity: 0;
      transition: all 0.3s ease;
      box-shadow: var(--shadow-md);
      display: flex;
      gap: 20px;
    }

    .shortcut-hint.show {
      opacity: 1;
      transform: translateY(0);
    }

    .shortcut-hint div {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    kbd {
      background: var(--bg-tertiary);
      padding: 4px 8px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid var(--glass-border);
      box-shadow: 0 2px 0 var(--glass-border);
      color: var(--text-primary);
    }
  </style>
</head>
<body>
  <!-- Login Overlay -->
  <div id="loginOverlay" class="login-overlay">
    <div class="login-container">
      <div class="login-icon"><i class="ph ph-lock-key" style="font-size: 48px;"></i></div>
      <h1 class="login-title">访问受限</h1>
      <p class="login-subtitle">请输入口令继续访问</p>
      <div class="login-input-group">
        <input type="password" id="loginInput" class="login-input" placeholder="在此输入口令..." maxlength="50">
      </div>
      <button id="loginBtn" class="login-btn" onclick="doLogin()">
        <i class="ph ph-sign-in"></i>
        进入系统
      </button>
      <div id="loginError" class="login-error">口令错误，请重试</div>
      <p class="login-hint"><i class="ph ph-lightbulb"></i> 提示：默认口令为 gandalf</p>
    </div>
  </div>

  <div class="layout">
    <!-- Floating Panel Toggle -->
    <button class="float-panel-toggle" onclick="toggleFloatPanel()" title="侧边栏">
      <i class="ph ph-sidebar" id="floatPanelIcon"></i>
    </button>

    <!-- Floating Panel (hidden by default) -->
    <div class="float-panel" id="floatPanel">
      <div class="float-panel-header">
        <span><i class="ph ph-gear"></i> 设置</span>
        <button class="float-panel-close" onclick="toggleFloatPanel()">
          <i class="ph ph-x"></i>
        </button>
      </div>
      <div class="float-panel-content">
        <div class="panel-section">
          <div class="panel-section-title"><i class="ph ph-calendar-blank"></i> 日历</div>
          <div class="calendar-compact">
            <div class="calendar-header">
              <button class="calendar-nav" onclick="changeMonth(-1)"><i class="ph ph-caret-left"></i></button>
              <span class="calendar-month" id="calendarMonth"></span>
              <button class="calendar-nav" onclick="changeMonth(1)"><i class="ph ph-caret-right"></i></button>
            </div>
            <div class="calendar-grid" id="calendarGrid"></div>
          </div>
        </div>
        <div class="panel-section">
          <div class="panel-section-title"><i class="ph ph-tag"></i> 标签</div>
          <div class="tags-list" id="tagsList"></div>
        </div>
      </div>
    </div>

    <div class="main-content">
      
      <div id="filterInfo"></div>
      
      <!-- Search Bar -->
      <div class="search-area" id="searchArea" style="display: none;">
        <div class="search-box">
          <input type="text" id="searchInput" class="search-input" placeholder="搜索 memos...">
          <button class="search-action-btn" onclick="searchMemos()" title="搜索">
            <i class="ph ph-magnifying-glass"></i>
          </button>
          <button class="search-action-btn" onclick="clearSearch()" title="清除">
            <i class="ph ph-x"></i>
          </button>
        </div>
      </div>
      
      <!-- Export Button Area -->
      <div class="export-area" id="exportArea" style="display: none;">
        <button class="btn" style="background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px; padding: 8px 16px;" onclick="exportData()">
          <i class="ph ph-download-simple"></i> 导出数据
        </button>
        <button class="btn btn-search" id="searchToggleBtn" onclick="toggleSearchBar()" style="margin-left: 8px;">
          <i class="ph ph-magnifying-glass"></i> 搜索
        </button>
      </div>
    </div>
    </div>
    <div class="main-content">
    <div class="main">
      <div class="main-header">
        <h1><i class="ph ph-notebook"></i> 备忘录</h1>
        <div class="main-actions">
          <button class="btn btn-theme" id="themeToggle" onclick="toggleTheme()">
            <i class="ph ph-sun"></i>
          </button>
        </div>
      </div>
      <div class="memos-list" id="memosList"></div>
      <div id="pagination"></div>
      <button class="scroll-top-btn" id="scrollTopBtn" onclick="scrollToTop()" title="返回顶部">
        <i class="ph ph-arrow-up"></i>
      </button>
    </div>
  </div>
  
  <!-- Toast Notification -->
  <div id="toastContainer" class="toast-container"></div>
  
  <!-- Keyboard Shortcut Hint -->
  <div id="shortcutHint" class="shortcut-hint">
    <div><kbd>Ctrl</kbd> + <kbd>/</kbd> 帮助</div>
    <div><kbd>Ctrl</kbd> + <kbd>N</kbd> 新建</div>
    <div><kbd>Ctrl</kbd> + <kbd>F</kbd> 搜索</div>
    <div><kbd>Esc</kbd> 关闭</div>
  </div>
  
  <!-- Custom Modal Dialog -->
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

  <!-- Input Modal -->
  <div id="inputModal" class="modal-overlay" style="display: none;">
    <div class="modal-container" style="max-width: 500px;">
      <div class="modal-header">
        <div class="modal-header-left">
          <i class="ph ph-pencil-simple modal-icon" style="color: var(--accent-blue);"></i>
          <h3 class="modal-title">添加备忘录</h3>
        </div>
        <button class="modal-close" onclick="toggleInputArea()">
          <i class="ph ph-x"></i>
        </button>
      </div>
      <div class="modal-body">
        <textarea id="modalMemoInput" placeholder="写下你的想法..." style="width: 100%; min-height: 150px; border: 2px solid var(--glass-border); border-radius: var(--radius-md); padding: 16px; font-size: 15px; resize: vertical; background: var(--bg-secondary); color: var(--text-primary); font-family: inherit; line-height: 1.6;"></textarea>
        <input type="text" id="modalTagsInput" placeholder="标签（逗号分隔）..." style="width: 100%; margin-top: 12px; padding: 12px 16px; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); font-size: 14px; background: var(--bg-secondary); color: var(--text-primary);">
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" onclick="toggleInputArea()">取消</button>
        <button class="modal-btn modal-btn-primary" onclick="addMemoFromModal()">
          <i class="ph ph-plus-circle"></i> 添加
        </button>
      </div>
    </div>
  </div>
  
  <script>
    // Check login status on page load
    (function() {
      var isLoggedIn = sessionStorage.getItem('memos_logged_in');
      if (isLoggedIn === 'true') {
        document.getElementById('loginOverlay').classList.add('hidden');
      }
    })();

    // Login function
    window.doLogin = function() {
      var input = document.getElementById('loginInput');
      var btn = document.getElementById('loginBtn');
      var error = document.getElementById('loginError');
      var password = input.value.trim();
      
      if (!password) {
        error.textContent = '请输入口令';
        error.classList.add('show');
        input.focus();
        return;
      }
      
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 1s linear infinite;"></span> 验证中...';
      
      fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success) {
          sessionStorage.setItem('memos_logged_in', 'true');
          sessionStorage.setItem('memos_token', data.token);
          document.getElementById('loginOverlay').classList.add('hidden');
          input.value = '';
        } else {
          error.textContent = data.error || '口令错误';
          error.classList.add('show');
          input.value = '';
          input.focus();
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-sign-in"></i> 进入系统';
      })
      .catch(function(err) {
        error.textContent = '验证失败，请重试';
        error.classList.add('show');
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-sign-in"></i> 进入系统';
      });
    }

    // Enter key to login
    document.getElementById('loginInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        window.doLogin();
      }
    });

    let editingId = null;
    let currentMonth = new Date();
    let selectedDate = null;
    let selectedTag = null;
    let allMemos = [];
    let isSearching = false;
    let searchMode = false;
    let currentPage = 1;
    let totalPages = 1;
    let currentSearchKeyword = '';

    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
      
      showLoading();
      fetch("/api/memos?date=" + dateStr + "&page=" + currentPage)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          renderMemos(data.memos);
          renderPagination(data.pagination);
          const filterInfo = document.getElementById("filterInfo");
          const dateDisplay = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          filterInfo.innerHTML = '<div class="filter-info"><span data-type="date">' + dateDisplay + '</span><button class="clear-filter" onclick="clearFilter()">清除</button></div>';
        })
        .catch(function(error) {
          console.error('Filter error:', error);
        });
    }

    function clearFilter() {
      selectedDate = null;
      selectedTag = null;
      currentPage = 1;
      currentSearchKeyword = '';
      renderCalendar();
      document.getElementById("filterInfo").innerHTML = "";
      loadMemos();
    }

    function showLoading() {
      document.getElementById("memosList").innerHTML = '<div class="skeleton-memo skeleton"></div><div class="skeleton-memo skeleton"></div><div class="skeleton-memo skeleton"></div><div class="skeleton-memo skeleton"></div><div class="skeleton-memo skeleton"></div>';
    }

    function showEmpty() {
      document.getElementById("memosList").innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="ph ph-notebook" style="font-size: 64px;"></i></div><div class="empty-state-text">暂无 memo</div><div class="empty-state-hint">在上方输入框写下你的想法</div></div>';
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
          // Don't re-render memos if in edit mode to avoid losing edits
          if (!isSearching && !selectedDate && !selectedTag && !editingId) {
            renderMemos(data.memos);
          }
          renderPagination(data.pagination);
        })
        .catch(function(error) {
          console.error('Loading failed:', error);
          document.getElementById("memosList").innerHTML = '<div class="empty-state"><div class="empty-state-text" style="color: var(--error);">Failed to load memos</div></div>';
        });
    }

    function renderMemos(memos) {
      const container = document.getElementById("memosList");
      if (memos.length === 0) {
        showEmpty();
        return;
      }
      let html = "";
      memos.forEach(function(memo, index) {
        const tagsHtml = memo.tags && memo.tags.length > 0 ? '<div class="memo-tags">' + memo.tags.map(function(t) { var tagName = typeof t === 'object' ? t.name : t; return '<span class="tag" onclick="filterByTag(' + String.fromCharCode(39) + escapeHtml(tagName) + String.fromCharCode(39) + ')">' + escapeHtml(tagName) + '</span>'; }).join('') + '</div>' : '';
        
        if (editingId === memo.id) {
          const currentTags = memo.tags ? memo.tags.map(function(t) { return typeof t === 'object' ? t.name : t; }).join(', ') : '';
          var editHtml = '<div class="memo" id="memo-' + memo.id + '" style="animation-delay: ' + (index * 0.05) + 's">';
          editHtml += '<textarea id="edit-' + memo.id + '" style="width:100%;min-height:200px;border:2px solid var(--accent-blue);border-radius:var(--radius-md);padding:12px;font-size:15px;resize:vertical;background:var(--bg-secondary);color:var(--text-primary);font-family:inherit;">' + escapeHtml(memo.content) + '</textarea>';
          editHtml += '<input type="text" id="edit-tags-' + memo.id + '" value="' + escapeHtml(currentTags) + '" placeholder="标签（逗号分隔）..." style="width:100%;margin-top:10px;padding:10px 12px;border:1px solid var(--glass-border);border-radius:var(--radius-sm);font-size:13px;background:var(--bg-secondary);color:var(--text-primary);">';
          editHtml += '<div class="memo-time"><i class="ph ph-clock"></i> ' + new Date(memo.createdAt).toLocaleString("en-US") + '</div>';
          editHtml += '<div class="memo-actions memo-actions-edit">';
          editHtml += '<button class="icon-btn icon-save" onclick="saveEdit(' + memo.id + ')" title="保存">';
          editHtml += '<i class="ph ph-check"></i>';
          editHtml += '</button>';
          editHtml += '<button class="icon-btn icon-cancel" onclick="cancelEdit()" title="取消">';
          editHtml += '<i class="ph ph-x"></i>';
          editHtml += '</button>';
          editHtml += '</div></div>';
          html += editHtml;
        } else {
          // Use Markdown parser for content
          let content = parseMarkdown(memo.content);
          
          // Highlight search keyword if in search mode
          if (currentSearchKeyword) {
            content = content.replace(
              new RegExp('(' + escapeHtml(currentSearchKeyword) + ')', 'gi'),
              '<span class="highlight">$1</span>'
            );
          }
          
          var viewHtml = '<div class="memo" id="memo-' + memo.id + '" style="animation-delay: ' + (index * 0.05) + 's">';
          viewHtml += '<div class="memo-content markdown">' + content + '</div>';
          viewHtml += tagsHtml;
          viewHtml += '<div class="memo-time"><i class="ph ph-clock"></i> ' + new Date(memo.createdAt).toLocaleString("en-US") + '</div>';
          viewHtml += '<div class="memo-actions">';
          viewHtml += '<button class="icon-btn icon-edit" onclick="startEdit(' + memo.id + ')" title="编辑">';
          viewHtml += '<i class="ph ph-pencil-simple"></i>';
          viewHtml += '</button>';
          viewHtml += '<button class="icon-btn icon-delete" onclick="deleteMemo(' + memo.id + ')" title="删除">';
          viewHtml += '<i class="ph ph-trash"></i>';
          viewHtml += '</button>';
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
      html += '<button onclick="goToPage(' + (pagination.page - 1) + ')" ' + (pagination.page === 1 ? 'disabled' : '') + '><i class="ph ph-caret-left"></i></button>';
      
      for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === 1 || i === pagination.totalPages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
          html += '<button onclick="goToPage(' + i + ')" ' + (i === pagination.page ? 'class="active"' : '') + '>' + i + '</button>';
        } else if (i === pagination.page - 3 || i === pagination.page + 3) {
          html += '<span style="padding: 8px;color:var(--text-muted);">...</span>';
        }
      }
      
      html += '<button onclick="goToPage(' + (pagination.page + 1) + ')" ' + (pagination.page === pagination.totalPages ? 'disabled' : '') + '><i class="ph ph-caret-right"></i></button>';
      html += '</div>';
      html += '<div class="pagination-info">Page ' + pagination.page + ' of ' + pagination.totalPages + ' (' + pagination.total + ' items)</div>';
      
      document.getElementById("pagination").innerHTML = html;
    }

    function goToPage(page) {
      if (page < 1 || page > totalPages) return;
      currentPage = page;
      showLoading();
      loadMemos();
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    window.addMemo = async function() {
      const input = document.getElementById("memoInput");
      const tagsInput = document.getElementById("tagsInput");
      const content = input.value.trim();
      if (!content) {
        await showModal("请输入 Memo 内容", "提示", false);
        return;
      }
      
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
      }).catch(async function(error) {
        console.error('Add failed:', error);
        await showModal('添加 Memo 失败，请重试', '错误', true);
      });
    }

    // Store deleted memo for undo
    let lastDeletedMemo = null;
    let undoTimeout = null;

    window.deleteMemo = async function(id) {
      // Find the memo before deleting
      const memoToDelete = allMemos.find(function(m) { return m.id === id; });
      
      const confirmed = await showModal("确定要删除这条 memo 吗？", "删除确认", true);
      if (!confirmed) return;
      
      fetch("/api/memos/" + id, { method: "DELETE" }).then(function() {
        // Store deleted memo info for undo
        lastDeletedMemo = memoToDelete;
        
        loadMemos();
        loadTags();
        
        // Show undo toast
        showToast({
          title: '已删除',
          message: 'Memo 已成功删除',
          type: 'success',
          action: {
            text: '撤销',
            callback: undoDelete
          },
          duration: 5000
        });
        
        // Clear undo after 5 seconds
        if (undoTimeout) clearTimeout(undoTimeout);
        undoTimeout = setTimeout(function() {
          lastDeletedMemo = null;
        }, 5000);
      });
    }
    
    window.undoDelete = async function() {
      if (!lastDeletedMemo) return;
      
      // Recreate the memo
      fetch("/api/memos", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ 
          content: lastDeletedMemo.content, 
          tags: lastDeletedMemo.tags ? lastDeletedMemo.tags.map(function(t) { return typeof t === 'object' ? t.name : t; }) : []
        })
      }).then(function() {
        showToast({
          title: '已撤销',
          message: 'Memo 已恢复',
          type: 'success',
          duration: 3000
        });
        lastDeletedMemo = null;
        if (undoTimeout) clearTimeout(undoTimeout);
        loadMemos();
        loadTags();
      });
    }

    renderCalendar();
    loadMemos();
    loadTags();
    initTheme();

    window.startEdit = function(id) {
      editingId = id;
      // Directly render to show the edit interface
      renderMemos(allMemos);
      
      setTimeout(function() {
        const textarea = document.getElementById("edit-" + id);
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      }, 50);
    }

    window.saveEdit = function(id) {
      const textarea = document.getElementById("edit-" + id);
      const tagsInput = document.getElementById("edit-tags-" + id);
      const content = textarea.value.trim();
      if (!content) return alert("Content cannot be empty");
      
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
      });
    }

    window.cancelEdit = function() {
      editingId = null;
      loadMemos();
    }

    function toggleFloatPanel() {
      const panel = document.getElementById('floatPanel');
      const icon = document.getElementById('floatPanelIcon');
      panel.classList.toggle('active');
      if (panel.classList.contains('active')) {
        icon.classList.remove('ph-sidebar');
        icon.classList.add('ph-x');
      } else {
        icon.classList.remove('ph-x');
        icon.classList.add('ph-sidebar');
      }
    }

    function toggleInputArea() {
      const modal = document.getElementById('inputModal');
      const icon = document.getElementById('toggleInputIcon');
      const isHidden = modal.style.display === 'none' || modal.style.display === '';
      if (isHidden) {
        modal.style.display = 'flex';
        document.getElementById('modalMemoInput').focus();
        icon.classList.remove('ph-pencil-simple');
        icon.classList.add('ph-eye-slash');
      } else {
        modal.style.display = 'none';
        // Clear the inputs
        document.getElementById('modalMemoInput').value = '';
        document.getElementById('modalTagsInput').value = '';
        icon.classList.remove('ph-eye-slash');
        icon.classList.add('ph-pencil-simple');
      }
    }

    function addMemoFromModal() {
      const content = document.getElementById('modalMemoInput').value.trim();
      const tagsInput = document.getElementById('modalTagsInput').value.trim();
      const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

      if (!content) {
        showToast({
          title: '提示',
          message: '请输入内容',
          type: 'warning'
        });
        return;
      }

      fetch('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, tags })
      })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.memo || data.success) {
            showToast({
              title: '成功',
              message: '备忘录已添加',
              type: 'success'
            });
            toggleInputArea();
            loadMemos();
            loadTags();
          } else {
            showToast({
              title: '错误',
              message: data.error || '添加失败',
              type: 'error'
            });
          }
        })
        .catch(function(error) {
          showToast({
            title: '错误',
            message: '添加失败',
            type: 'error'
          });
        });
    }

    function toggleTheme() {
      const body = document.body;
      const btn = document.getElementById('themeToggle');
      const icon = btn.querySelector('i');
      
      if (body.classList.contains('light-theme')) {
        // 鍒囨崲鍒版繁鑹蹭富棰?
        body.classList.remove('light-theme');
        icon.classList.remove('ph-moon');
        icon.classList.add('ph-sun');
        localStorage.setItem('theme', 'dark');
      } else {
        // 鍒囨崲鍒版祬鑹蹭富棰?
        body.classList.add('light-theme');
        icon.classList.remove('ph-sun');
        icon.classList.add('ph-moon');
        localStorage.setItem('theme', 'light');
      }
    }

    // Mobile functions
    function showMobileInput() {
      const input = document.getElementById('memoInput');
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    }

    function toggleMobileSidebar() {
      const sidebar = document.querySelector('.sidebar');
      sidebar.classList.toggle('show');
    }

    function switchMobileTab(tab) {
      // Update active state
      document.querySelectorAll('.mobile-nav-btn').forEach(function(btn) {
        btn.classList.remove('active');
      });
      event.currentTarget.classList.add('active');
      
      // Hide sidebar when switching to memos
      if (tab === 'memos') {
        document.querySelector('.sidebar').classList.remove('show');
      }
    }

    function toggleMobileSearch() {
      toggleSearchBar();
      if (document.getElementById('searchArea').style.display !== 'none') {
        document.getElementById('searchInput').focus();
      }
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
      const sidebar = document.querySelector('.sidebar');
      const mobileNav = document.querySelector('.mobile-nav');
      const isClickInsideSidebar = sidebar.contains(e.target);
      const isClickInsideNav = mobileNav.contains(e.target);
      
      if (window.innerWidth <= 768 && sidebar.classList.contains('show') && !isClickInsideSidebar && !isClickInsideNav) {
        sidebar.classList.remove('show');
      }
    });

    // Custom Modal Dialog functions
    let modalResolve = null;
    
    function showModal(message, title, isDanger) {
      if (typeof title === 'undefined') title = "确认操作";
      if (typeof isDanger === 'undefined') isDanger = true;
      return new Promise(function(resolve) {
        modalResolve = resolve;
        var modal = document.getElementById("customModal");
        var messageEl = document.getElementById("modalMessage");
        var titleEl = document.querySelector(".modal-title");
        var iconEl = document.querySelector(".modal-icon");
        var confirmBtn = document.getElementById("modalConfirm");
        
        messageEl.textContent = message;
        titleEl.textContent = title;
        
        // Set icon based on danger level
        if (isDanger) {
          iconEl.className = "ph ph-warning-circle modal-icon";
          iconEl.style.color = "var(--warning)";
          confirmBtn.className = "modal-btn modal-btn-danger";
        } else {
          iconEl.className = "ph ph-question modal-icon";
          iconEl.style.color = "var(--accent-blue)";
          confirmBtn.className = "modal-btn";
          confirmBtn.style.background = "var(--accent-gradient)";
          confirmBtn.style.color = "white";
        }
        
        modal.style.display = "flex";
        // Trigger reflow
        modal.offsetHeight;
        modal.classList.add("active");
      });
    }
    
    function hideModal() {
      var modal = document.getElementById("customModal");
      modal.classList.remove("active");
      setTimeout(function() {
        modal.style.display = "none";
      }, 300);
    }
    
    // Modal event listeners
    document.getElementById("modalCancel").addEventListener("click", function() {
      hideModal();
      if (modalResolve) modalResolve(false);
    });
    
    document.getElementById("modalConfirm").addEventListener("click", function() {
      hideModal();
      if (modalResolve) modalResolve(true);
    });
    
    document.getElementById("customModal").addEventListener("click", function(e) {
      if (e.target.id === "customModal") {
        hideModal();
        if (modalResolve) modalResolve(false);
      }
    });

    // 初始化主题
    function initTheme() {
      const savedTheme = localStorage.getItem('theme');
      const btn = document.getElementById('themeToggle');
      const icon = btn.querySelector('i');
      
      if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        icon.classList.remove('ph-sun');
        icon.classList.add('ph-moon');
      }
    }

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
            container.innerHTML = '<span style="color:var(--text-muted);font-size:13px;"><i class="ph ph-info" style="margin-right:4px;"></i>暂无标签</span>';
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
          console.error('Failed to load tags:', error);
          document.getElementById("tagsList").innerHTML = '<span style="color:var(--error);font-size:12px;">Failed to load</span>';
        });
    }

    async function addTag() {
      const input = document.getElementById("newTagInput");
      const name = input.value.trim();
      if (!name) {
        await showModal("请输入标签名称", "提示", false);
        return;
      }
      
      fetch("/api/tags", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name: name })
      }).then(function(res) {
        if (res.ok) {
          input.value = "";
          loadTags();
        } else {
          res.json().then(async function(data) {
            await showModal(data.error || "创建标签失败", "错误", true);
          });
        }
      });
    }

    async function deleteTag(id) {
      const confirmed = await showModal("确定要删除这个标签吗？", "删除确认", true);
      if (!confirmed) return;
      fetch("/api/tags/" + id, { method: "DELETE" }).then(function() {
        loadTags();
      });
    }

    function filterByTag(tagName) {
      selectedTag = tagName;
      selectedDate = null;
      currentPage = 1;
      currentSearchKeyword = '';
      
      showLoading();
      fetch("/api/memos?tag=" + encodeURIComponent(tagName) + "&page=" + currentPage)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          allMemos = data.memos;
          renderCalendar();
          renderMemos(data.memos);
          renderPagination(data.pagination);
          loadTags();
          document.getElementById("filterInfo").innerHTML = '<div class="filter-info"><span data-type="tag">' + escapeHtml(tagName) + ' (' + data.pagination.total + ')</span><button class="clear-filter" onclick="clearFilter()">Clear</button></div>';
        })
        .catch(function(error) {
          console.error('Tag filter error:', error);
        });
    }

    // Enter key for adding tags
    document.getElementById("newTagInput").addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        addTag();
      }
    });

    // Toast notification function
    function showToast(options) {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = 'toast ' + (options.type || 'info');
      
      const iconMap = {
        success: 'ph-check-circle',
        error: 'ph-x-circle',
        warning: 'ph-warning',
        info: 'ph-info'
      };
      
      var iconClass = iconMap[options.type] || iconMap.info;
      var actionHtml = '';
      if (options.action) {
        actionHtml = '<button class="toast-action" onclick="undoDelete()">' + escapeHtml(options.action.text) + '</button>';
      }
      
      toast.innerHTML = '<i class="ph ' + iconClass + ' toast-icon"></i>' +
        '<div class="toast-content">' +
          '<div class="toast-title">' + escapeHtml(options.title) + '</div>' +
          '<div class="toast-message">' + escapeHtml(options.message) + '</div>' +
        '</div>' + actionHtml;
      
      container.appendChild(toast);
      
      // Auto remove
      setTimeout(function() {
        toast.classList.add('hide');
        setTimeout(function() { toast.remove(); }, 300);
      }, options.duration || 3000);
    }

    // Simple Markdown parser
    function parseMarkdown(text) {
      if (!text) return '';
      
      var html = escapeHtml(text);
      var parts = [];
      var inCode = false;
      var current = '';
      
      // Parse inline code first (avoid using backticks in character class)
      for (var i = 0; i < html.length; i++) {
        if (html.charAt(i) === String.fromCharCode(96) && (i === 0 || html.charAt(i-1) !== '\\\\')) {
          if (inCode) {
            parts.push('<code>' + current + '</code>');
            current = '';
          } else {
            parts.push(current);
            current = '';
          }
          inCode = !inCode;
        } else {
          current += html[i];
        }
      }
      parts.push(current);
      html = parts.join('');
      
      // Headers
      html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
      html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
      html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
      
      // Bold and Italic
      html = html.replace(/\\*\\*\\*(.*?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
      html = html.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
      html = html.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
      html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
      html = html.replace(/_(.*?)_/g, '<em>$1</em>');
      
      // Code blocks - process triple backticks (use String.fromCharCode to avoid template literal issues)
      var tick = String.fromCharCode(96);
      var codeBlockStart = html.indexOf(tick + tick + tick);
      while (codeBlockStart !== -1) {
        var codeBlockEnd = html.indexOf(tick + tick + tick, codeBlockStart + 3);
        if (codeBlockEnd === -1) break;
        var before = html.substring(0, codeBlockStart);
        var code = html.substring(codeBlockStart + 3, codeBlockEnd);
        var after = html.substring(codeBlockEnd + 3);
        html = before + '<pre><code>' + code + '</code></pre>' + after;
        codeBlockStart = html.indexOf(tick + tick + tick, codeBlockStart + 1);
      }
      
      // Links
      html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      
      // Lists
      html = html.replace(/^\\* (.*$)/gim, '<li>$1</li>');
      html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
      html = html.replace(/^\\d+\\. (.*$)/gim, '<li>$1</li>');
      html = html.replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>');
      html = html.replace(/<\\/ul>\\s*<ul>/g, '');
      
      // Blockquotes
      html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
      
      // Horizontal rule
      html = html.replace(/^---$/gim, '<hr>');
      
      // Line breaks
      html = html.replace(/\\n/g, '<br>');
      
      return html;
    }

    // New search bar toggle function
    function toggleSearchBar() {
      const searchArea = document.getElementById('searchArea');
      const toggleBtn = document.getElementById('searchToggleBtn');
      const isVisible = searchArea.style.display !== 'none';
      
      if (isVisible) {
        searchArea.style.display = 'none';
        toggleBtn.style.display = 'inline-flex';
        clearSearch();
      } else {
        searchArea.style.display = 'block';
        toggleBtn.style.display = 'none';
        document.getElementById('searchInput').focus();
      }
    }

    // Modified search function
    function searchMemos() {
      const input = document.getElementById('searchInput');
      const keyword = input.value.trim();
      if (!keyword) return;
      
      currentSearchKeyword = keyword.toLowerCase();
      selectedDate = null;
      selectedTag = null;
      currentPage = 1;
      isSearching = true;
      searchMode = true;

      showLoading();
      fetch("/api/memos?search=" + encodeURIComponent(keyword) + "&page=" + currentPage)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          allMemos = data.memos;
          renderCalendar();
          renderMemos(data.memos);
          renderPagination(data.pagination);
          document.getElementById("filterInfo").innerHTML = '<div class="filter-info"><span data-type="search">搜索: ' + escapeHtml(keyword) + ' (' + data.pagination.total + ')</span><button class="clear-filter" onclick="clearSearch()">清除</button></div>';
        })
        .catch(function(err) {
          console.error("Search failed:", err);
          showToast({
            title: '搜索失败',
            message: '搜索时出现错误，请重试',
            type: 'error',
            duration: 3000
          });
          isSearching = false;
          searchMode = false;
        });
    }

    // Modified clear search
    function clearSearch() {
      searchMode = false;
      isSearching = false;
      currentSearchKeyword = '';
      
      document.getElementById('searchArea').style.display = 'none';
      document.getElementById('searchToggleBtn').style.display = 'inline-flex';
      document.getElementById('searchInput').value = '';
      document.getElementById("filterInfo").innerHTML = "";

      loadMemos();
    }

    // Export data function
    function exportData() {
      fetch('/api/memos?limit=10000')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var exportObj = {
            memos: data.memos,
            exportDate: new Date().toISOString(),
            version: '1.0'
          };
          
          var blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'memos-backup-' + new Date().toISOString().split('T')[0] + '.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          showToast({
            title: '导出成功',
            message: '已导出 ' + data.memos.length + ' 条 memo',
            type: 'success',
            duration: 3000
          });
        })
        .catch(function(err) {
          console.error('Export failed:', err);
          showToast({
            title: '导出失败',
            message: '导出数据时出现错误',
            type: 'error',
            duration: 3000
          });
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      // Show shortcut hint when Ctrl/Cmd is pressed
      if (e.ctrlKey || e.metaKey) {
        document.getElementById('shortcutHint').classList.add('show');
      }
      
      // Ctrl/Cmd + N - New memo
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('memoInput').focus();
      }
      
      // Ctrl/Cmd + F - Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        toggleSearchBar();
      }
      
      // Ctrl/Cmd + / - Show help
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        showToast({
          title: '快捷键',
          message: 'Ctrl+N: 新建 | Ctrl+F: 搜索 | Esc: 关闭',
          type: 'info',
          duration: 5000
        });
      }
      
      // Esc - Close search or cancel edit
      if (e.key === 'Escape') {
        if (searchMode) {
          clearSearch();
        } else if (editingId) {
          cancelEdit();
        } else if (document.getElementById('searchArea').style.display !== 'none') {
          clearSearch();
        }
      }
    });

    // Hide shortcut hint when Ctrl/Cmd is released
    document.addEventListener('keyup', function(e) {
      if (e.key === 'Control' || e.key === 'Meta') {
        setTimeout(function() {
          document.getElementById('shortcutHint').classList.remove('show');
        }, 1000);
      }
    });

    // Enter key for search input
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchMemos();
      }
    });

    // Scroll to top button
    window.scrollToTop = function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Show/hide scroll to top button
    window.addEventListener('scroll', function() {
      const btn = document.getElementById('scrollTopBtn');
      if (window.scrollY > 300) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    });
  </script>
  
  <!-- Floating Action Buttons -->
  <button class="fab-btn fab-secondary" onclick="toggleSearchBar()" title="搜索" style="bottom: 110px;">
    <i class="ph ph-magnifying-glass"></i>
  </button>
  <button class="fab-btn fab-secondary" onclick="exportData()" title="导出数据" style="bottom: 180px;">
    <i class="ph ph-download-simple"></i>
  </button>
  <button class="fab-btn" onclick="toggleInputArea()" title="添加备忘录">
    <i class="ph ph-plus"></i>
  </button>
  
  <!-- Mobile Bottom Navigation -->
  <nav class="mobile-nav">
    <button class="mobile-nav-btn active" onclick="switchMobileTab('memos')">
      <i class="ph ph-notebook"></i>
      <span>备忘录</span>
    </button>
    <button class="mobile-nav-btn" onclick="toggleMobileSidebar()">
      <i class="ph ph-calendar-blank"></i>
      <span>日历</span>
    </button>
    <button class="mobile-nav-btn" onclick="toggleMobileSidebar()">
      <i class="ph ph-tag"></i>
      <span>标签</span>
    </button>
    <button class="mobile-nav-btn" onclick="toggleMobileSearch()">
      <i class="ph ph-magnifying-glass"></i>
      <span>搜索</span>
    </button>
  </nav>
</body>
</html>`;
}
