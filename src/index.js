// Utility functions
import { getHtml } from './handlers/html.js';

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
