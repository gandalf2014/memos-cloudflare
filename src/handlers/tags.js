import { createResponse, createErrorResponse } from '../utils/response.js';
import { validateId, validateTagName } from '../utils/validation.js';

// GET /api/tags - 获取所有标签
export async function listTags(request, env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT t.*, COUNT(mt.memo_id) as memo_count
       FROM tags t
       LEFT JOIN memo_tags mt ON t.id = mt.tag_id
       GROUP BY t.id
       ORDER BY t.name`
    ).all();

    return createResponse({ tags: results }, 200);
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}

// POST /api/tags - 创建标签
export async function createTag(request, env) {
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

// DELETE /api/tags/:id - 删除标签
export async function deleteTag(request, env, id) {
  try {
    validateId(id);

    const { success } = await env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();

    if (success) {
      return createResponse({ success: true, message: 'Tag deleted' }, 200);
    } else {
      return createErrorResponse('Tag not found', 404);
    }
  } catch (error) {
    return createErrorResponse(error.message, 400);
  }
}
