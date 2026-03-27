import { createResponse, createErrorResponse } from '../utils/response.js';
import { validateId, validateContent, validateTagName, parseJsonBody } from '../utils/validation.js';

// GET /api/memos - 获取所有memos（支持筛选、搜索、分页）
export async function listMemos(request, env) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const search = url.searchParams.get('search');
    const tag = url.searchParams.get('tag');
    const tags = url.searchParams.get('tags'); // comma-separated
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const isFavorite = url.searchParams.get('favorite');
    const isArchived = url.searchParams.get('archived');

    let query = `
      SELECT DISTINCT m.id, m.content, m.created_at as createdAt, m.updated_at as updatedAt,
             m.is_favorite as isFavorite, m.is_archived as isArchived
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

    // Date range filter
    if (startDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return createErrorResponse('Invalid startDate format. Use YYYY-MM-DD', 400);
      }
      query += ` AND date(m.created_at) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return createErrorResponse('Invalid endDate format. Use YYYY-MM-DD', 400);
      }
      query += ` AND date(m.created_at) <= ?`;
      params.push(endDate);
    }

    if (search) {
      query += ` AND m.content LIKE ?`;
      params.push(`%${search}%`);
    }

    if (tag) {
      query += ` AND t.name = ?`;
      params.push(tag);
    }

    // Multiple tags filter
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
      if (tagList.length > 0) {
        query += ` AND t.name IN (${tagList.map(() => '?').join(',')})`;
        params.push(...tagList);
      }
    }

    // Favorites filter
    if (isFavorite !== null && isFavorite !== undefined) {
      query += ` AND m.is_favorite = ?`;
      params.push(isFavorite === 'true' || isFavorite === '1' ? 1 : 0);
    }

    // Archive filter
    if (isArchived !== null && isArchived !== undefined) {
      query += ` AND m.is_archived = ?`;
      params.push(isArchived === 'true' || isArchived === '1' ? 1 : 0);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await env.DB.prepare(query).bind(...params).all();

    // 获取总数
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

    // 获取所有标签
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
    }, 200);
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}

// POST /api/memos - 创建新memo
export async function createMemo(request, env) {
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

      // 处理标签
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
        `SELECT m.id, m.content, m.created_at as createdAt, m.updated_at as updatedAt, GROUP_CONCAT(t.name) as tags
         FROM memos m
         LEFT JOIN memo_tags mt ON m.id = mt.memo_id
         LEFT JOIN tags t ON mt.tag_id = t.id
         WHERE m.id = ?
         GROUP BY m.id`
      ).bind(memoId).all();

      const memo = results[0];
      memo.tags = memo.tags ? memo.tags.split(',') : [];

      return createResponse({ memo }, 201);
    } else {
      return createErrorResponse('Failed to create memo', 500);
    }
  } catch (error) {
    return createErrorResponse(error.message, 400);
  }
}

// PUT /api/memos/:id - 更新memo
export async function updateMemo(request, env, id) {
  try {
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
      // 更新标签
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
        `SELECT m.id, m.content, m.created_at as createdAt, m.updated_at as updatedAt, GROUP_CONCAT(t.name) as tags
         FROM memos m
         LEFT JOIN memo_tags mt ON m.id = mt.memo_id
         LEFT JOIN tags t ON mt.tag_id = t.id
         WHERE m.id = ?
         GROUP BY m.id`
      ).bind(id).all();

      if (results.length === 0) {
        return createErrorResponse('Memo not found', 404);
      }

      const memo = results[0];
      memo.tags = memo.tags ? memo.tags.split(',') : [];

      return createResponse({ memo }, 200);
    } else {
      return createErrorResponse('Failed to update memo', 500);
    }
  } catch (error) {
    return createErrorResponse(error.message, 400);
  }
}

// DELETE /api/memos/:id - 软删除memo
export async function deleteMemo(request, env, id) {
  try {
    validateId(id);

    const now = new Date().toISOString();
    const { success } = await env.DB.prepare(
      'UPDATE memos SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
    ).bind(now, id).run();

    if (success) {
      return createResponse({ success: true, message: 'Memo deleted' }, 200);
    } else {
      return createErrorResponse('Memo not found', 404);
    }
  } catch (error) {
    return createErrorResponse(error.message, 400);
  }
}

// POST /api/memos/import - 批量导入 memos
export async function importMemos(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    if (!body || !body.memos || !Array.isArray(body.memos)) {
      return createErrorResponse('Invalid import format. Expected { memos: [...] }', 400);
    }

    const memos = body.memos;
    const mode = body.mode || 'merge'; // 'merge' or 'replace'
    const now = new Date().toISOString();
    let importedCount = 0;

    // 如果是替换模式，先删除所有现有 memos
    if (mode === 'replace') {
      await env.DB.prepare('UPDATE memos SET deleted_at = ?').bind(now).run();
    }

    for (const memo of memos) {
      const content = validateContent(memo.content);
      if (!content) continue;

      const { success } = await env.DB.prepare(
        'INSERT INTO memos (content, created_at, updated_at) VALUES (?, ?, ?)'
      ).bind(content, now, now).run();

      if (success) {
        importedCount++;

        // 获取刚插入的 memo ID
        const { results: idResult } = await env.DB.prepare(
          'SELECT id FROM memos ORDER BY created_at DESC LIMIT 1'
        ).all();
        const memoId = idResult[0]?.id;

        // 处理标签
        if (memoId && memo.tags && Array.isArray(memo.tags)) {
          for (const tagName of memo.tags) {
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
      }
    }

    return createResponse({
      success: true,
      imported: importedCount,
      message: `Successfully imported ${importedCount} memos`
    }, 200);
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}

// PATCH /api/memos/:id/favorite - 切换收藏状态
export async function toggleFavorite(request, env, id) {
  try {
    validateId(id);

    const memo = await env.DB.prepare(
      'SELECT is_favorite FROM memos WHERE id = ? AND deleted_at IS NULL'
    ).bind(id).first();

    if (!memo) {
      return createErrorResponse('Memo not found', 404);
    }

    const newFavorite = memo.is_favorite === 1 ? 0 : 1;
    const { success } = await env.DB.prepare(
      'UPDATE memos SET is_favorite = ?, updated_at = ? WHERE id = ?'
    ).bind(newFavorite, new Date().toISOString(), id).run();

    if (success) {
      return createResponse({ success: true, isFavorite: newFavorite === 1 }, 200);
    } else {
      return createErrorResponse('Failed to update favorite', 500);
    }
  } catch (error) {
    return createErrorResponse(error.message, 400);
  }
}

// PATCH /api/memos/:id/archive - 切换归档状态
export async function toggleArchive(request, env, id) {
  try {
    validateId(id);

    const memo = await env.DB.prepare(
      'SELECT is_archived FROM memos WHERE id = ? AND deleted_at IS NULL'
    ).bind(id).first();

    if (!memo) {
      return createErrorResponse('Memo not found', 404);
    }

    const newArchived = memo.is_archived === 1 ? 0 : 1;
    const { success } = await env.DB.prepare(
      'UPDATE memos SET is_archived = ?, updated_at = ? WHERE id = ?'
    ).bind(newArchived, new Date().toISOString(), id).run();

    if (success) {
      return createResponse({ success: true, isArchived: newArchived === 1 }, 200);
    } else {
      return createErrorResponse('Failed to update archive', 500);
    }
  } catch (error) {
    return createErrorResponse(error.message, 400);
  }
}

// GET /api/stats - 获取统计数据
export async function getStats(request, env) {
  try {
    // Total memos count
    const { results: totalResult } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM memos WHERE deleted_at IS NULL'
    ).all();

    // Total tags count
    const { results: tagsResult } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM tags'
    ).all();

    // Favorites count
    const { results: favoritesResult } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM memos WHERE deleted_at IS NULL AND is_favorite = 1'
    ).all();

    // Archived count
    const { results: archivedResult } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM memos WHERE deleted_at IS NULL AND is_archived = 1'
    ).all();

    // Top tags
    const { results: topTags } = await env.DB.prepare(
      `SELECT t.name, COUNT(mt.memo_id) as count
       FROM tags t
       LEFT JOIN memo_tags mt ON t.id = mt.tag_id
       GROUP BY t.id
       ORDER BY count DESC
       LIMIT 10`
    ).all();

    // Memos by day (last 7 days)
    const { results: memosByDay } = await env.DB.prepare(
      `SELECT date(created_at) as date, COUNT(*) as count
       FROM memos
       WHERE deleted_at IS NULL AND created_at >= datetime('now', '-7 days')
       GROUP BY date(created_at)
       ORDER BY date`
    ).all();

    // This month memos count
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
      topTags: topTags || [],
      memosByDay: memosByDay || []
    }, 200);
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}
