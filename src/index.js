import { getHtml, getLoginHtml } from './handlers/html.js';
import { verifyPassword, logout } from './handlers/auth.js';
import { isLoggedIn, getAuthToken } from './utils/auth.js';
import { getCorsHeaders } from './utils/response.js';

// Utility functions
function createResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}

function createErrorResponse(message, status = 400) {
  return createResponse({ error: message }, status);
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
    const origin = request.headers.get('Origin') || '*';
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ========== 认证相关路由（不需要登录）==========

    // POST /api/auth/verify - 验证密码并设置 cookie
    if (url.pathname === '/api/auth/verify' && request.method === 'POST') {
      return verifyPassword(request, env);
    }

    // POST /api/auth/logout - 登出
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      return logout(request, env);
    }

    // GET /api/auth/status - 检查登录状态（用于调试）
    if (url.pathname === '/api/auth/status' && request.method === 'GET') {
      const token = getAuthToken(request);
      const cookieHeader = request.headers.get('Cookie') || '';
      return createResponse({
        hasToken: !!token,
        tokenValue: token ? token.substring(0, 8) + '...' : null,
        cookieHeader: cookieHeader,
        isLoggedIn: await isLoggedIn(request, env)
      });
    }
    
    // ========== 静态资源（不需要登录）==========
    
    // GET /manifest.json
    if (url.pathname === '/manifest.json' && request.method === 'GET') {
      const manifest = {
        name: 'Memos',
        short_name: 'Memos',
        description: 'A simple memo application',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f0f1a',
        theme_color: '#6366f1',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📝</text></svg>',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      };
      return new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ========== 页面请求：检查登录状态 ==========
    
    // GET / - 主页
    if (url.pathname === '/' || url.pathname === '') {
      const loggedIn = await isLoggedIn(request, env);
      
      if (!loggedIn) {
        // 未登录：返回登录页面（不包含任何 memo 数据）
        return new Response(getLoginHtml(), {
          headers: { 
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Content-Type-Options': 'nosniff'
          }
        });
      }
      
      // 已登录：返回完整页面
      return new Response(getHtml(), {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }
    
    // ========== 以下所有 API 路由都需要登录 ==========
    
    const loggedIn = await isLoggedIn(request, env);
    
    if (!loggedIn) {
      return createErrorResponse('Unauthorized', 401);
    }
    
    // ========== Memos API ==========
    
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

        if (date) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return createErrorResponse('Invalid date format. Use YYYY-MM-DD', 400);
          }
          query += ` AND date(m.created_at) = ?`;
          params.push(date);
        }

        if (search) {
          query += ` AND m.content LIKE ?`;
          params.push(`%${search}%`);
        }

        if (tag) {
          query += ` AND t.name = ?`;
          params.push(tag);
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

        // Get tags for memos
        if (results.length > 0) {
          const memoIds = results.map(m => m.id);
          const placeholders = memoIds.map(() => '?').join(',');
          const { results: tagResults } = await env.DB.prepare(
            `SELECT mt.memo_id, t.id, t.name 
             FROM memo_tags mt 
             JOIN tags t ON mt.tag_id = t.id 
             WHERE mt.memo_id IN (${placeholders})`
          ).bind(...memoIds).all();

          const tagsByMemo = {};
          for (const tag of tagResults) {
            if (!tagsByMemo[tag.memo_id]) {
              tagsByMemo[tag.memo_id] = [];
            }
            tagsByMemo[tag.memo_id].push({ id: tag.id, name: tag.name });
          }

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
        });
      } catch (error) {
        return createErrorResponse(error.message, 500);
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
          return createErrorResponse('Invalid JSON body', 400);
        }

        if (!body || typeof body !== 'object') {
          return createErrorResponse('Request body must be an object', 400);
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
            `SELECT m.id, m.content, m.created_at as createdAt, m.updated_at as updatedAt
             FROM memos m WHERE m.id = ?`
          ).bind(memoId).all();

          const memo = results[0];
          memo.tags = body.tags || [];

          return createResponse({ memo }, 201);
        } else {
          return createErrorResponse('Failed to create memo', 500);
        }
      } catch (error) {
        return createErrorResponse(error.message, 400);
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
          return createErrorResponse('Invalid JSON body', 400);
        }

        if (!body || typeof body !== 'object') {
          return createErrorResponse('Request body must be an object', 400);
        }

        const content = validateContent(body.content);
        const now = new Date().toISOString();

        const { success } = await env.DB.prepare(
          'UPDATE memos SET content = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL'
        ).bind(content, now, id).run();

        if (success) {
          // Update tags if provided
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
            `SELECT id, content, created_at as createdAt, updated_at as updatedAt FROM memos WHERE id = ?`
          ).bind(id).all();

          if (results.length === 0) {
            return createErrorResponse('Memo not found', 404);
          }

          const memo = results[0];
          memo.tags = body.tags || [];

          return createResponse({ memo });
        } else {
          return createErrorResponse('Failed to update memo', 500);
        }
      } catch (error) {
        return createErrorResponse(error.message, 400);
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
          return createResponse({ success: true, message: 'Memo deleted' });
        } else {
          return createErrorResponse('Memo not found', 404);
        }
      } catch (error) {
        return createErrorResponse(error.message, 400);
      }
    }

    // ========== Tags API ==========
    
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

        return createResponse({ tags: results });
      } catch (error) {
        return createErrorResponse(error.message, 500);
      }
    }

    // DELETE /api/tags/:id - Delete tag
    if (url.pathname.startsWith('/api/tags/') && request.method === 'DELETE') {
      try {
        const id = url.pathname.split('/').pop();
        validateId(id);

        const { success } = await env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();

        if (success) {
          return createResponse({ success: true, message: 'Tag deleted' });
        } else {
          return createErrorResponse('Tag not found', 404);
        }
      } catch (error) {
        return createErrorResponse(error.message, 400);
      }
    }

    // POST /api/tags - Create tag
    if (url.pathname === '/api/tags' && request.method === 'POST') {
      try {
        let body;
        try {
          body = await request.json();
        } catch {
          return createErrorResponse('Invalid JSON body', 400);
        }

        if (!body || !body.name) {
          return createErrorResponse('Tag name is required', 400);
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
          return createResponse({ tag: results[0] }, 201);
        } else {
          return createErrorResponse('Tag already exists', 409);
        }
      } catch (error) {
        return createErrorResponse(error.message, 400);
      }
    }

    // ========== Stats API ==========

    // GET /api/stats - Dashboard statistics
    if (url.pathname === '/api/stats' && request.method === 'GET') {
      try {
        const { results: totalResult } = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM memos WHERE deleted_at IS NULL'
        ).all();

        const { results: tagsResult } = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM tags'
        ).all();

        const { results: favoritesResult } = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM memos WHERE deleted_at IS NULL AND is_favorite = 1'
        ).all();

        const { results: archivedResult } = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM memos WHERE deleted_at IS NULL AND is_archived = 1'
        ).all();

        const { results: topTags } = await env.DB.prepare(
          `SELECT t.name, COUNT(mt.memo_id) as count
           FROM tags t
           LEFT JOIN memo_tags mt ON t.id = mt.tag_id
           GROUP BY t.id
           ORDER BY count DESC
           LIMIT 10`
        ).all();

        const { results: monthResult } = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM memos
           WHERE deleted_at IS NULL AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
        ).all();

        return createResponse({
          totalMemos: totalResult[0]?.count || 0,
          totalTags: tagsResult[0]?.count || 0,
          favoritesCount: favoritesResult[0]?.count || 0,
          archivedCount: archivedResult[0]?.count || 0,
          monthMemos: monthResult[0]?.count || 0,
          topTags: topTags || []
        });
      } catch (error) {
        return createErrorResponse(error.message, 500);
      }
    }

    // ========== Export API ==========
    
    // GET /api/export - Export all memos
    if (url.pathname === '/api/export' && request.method === 'GET') {
      try {
        const format = url.searchParams.get('format') || 'json';
        
        const { results } = await env.DB.prepare(
          `SELECT m.id, m.content, m.created_at, m.updated_at
           FROM memos m
           WHERE m.deleted_at IS NULL
           ORDER BY m.created_at DESC`
        ).all();
        
        if (format === 'csv') {
          const csv = 'id,content,created_at,updated_at\n' + 
            results.map(m => 
              `${m.id},"${m.content.replace(/"/g, '""')}",${m.created_at},${m.updated_at}`
            ).join('\n');
          return new Response(csv, {
            headers: { 
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="memos.csv"'
            }
          });
        }
        
        return new Response(JSON.stringify(results, null, 2), {
          headers: { 
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': 'attachment; filename="memos.json"'
          }
        });
      } catch (error) {
        return createErrorResponse(error.message, 500);
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
