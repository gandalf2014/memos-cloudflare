import { createResponse, createErrorResponse } from '../utils/response.js';
import { validateId } from '../utils/validation.js';

// Generate share token
function generateShareToken() {
  return Array.from({ length: 32 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
  ).join('');
}

// In-memory store for share links (in production, use D1)
const shareStore = new Map();

// POST /api/share - 创建分享链接
export async function createShare(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    if (!body || !body.memoId) {
      return createErrorResponse('Memo ID is required', 400);
    }

    const memoId = validateId(body.memoId);
    const password = body.password || null;
    const expiresIn = body.expiresIn || 7; // days, default 7
    const expiresAt = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString();

    // Check if memo exists
    const memo = await env.DB.prepare(
      'SELECT id, content FROM memos WHERE id = ? AND deleted_at IS NULL'
    ).bind(memoId).first();

    if (!memo) {
      return createErrorResponse('Memo not found', 404);
    }

    // Generate share token
    const shareToken = generateShareToken();
    const shareId = `share_${Date.now()}`;

    // Store share info
    shareStore.set(shareId, {
      memoId,
      token: shareToken,
      password: password ? simpleHash(password) : null,
      expiresAt,
      createdAt: new Date().toISOString(),
      accessCount: 0
    });

    // Add share metadata to database
    const { success } = await env.DB.prepare(
      'UPDATE memos SET updated_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), memoId).run();

    return createResponse({
      shareId,
      token: shareToken,
      url: `/share/${shareToken}`,
      expiresAt
    }, 201);
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}

// Simple hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// GET /api/share/:token - 获取分享的 memo
export async function getShare(request, env, token) {
  try {
    // Find share by token
    let shareData = null;
    for (const [shareId, data] of shareStore) {
      if (data.token === token) {
        shareData = data;
        break;
      }
    }

    if (!shareData) {
      return createErrorResponse('Share link not found', 404);
    }

    // Check if expired
    if (new Date(shareData.expiresAt) < new Date()) {
      return createErrorResponse('Share link has expired', 410);
    }

    // Get memo
    const memo = await env.DB.prepare(
      `SELECT m.id, m.content, m.created_at as createdAt, m.updated_at as updatedAt,
              GROUP_CONCAT(t.name) as tags
       FROM memos m
       LEFT JOIN memo_tags mt ON m.id = mt.memo_id
       LEFT JOIN tags t ON mt.tag_id = t.id
       WHERE m.id = ? AND m.deleted_at IS NULL
       GROUP BY m.id`
    ).bind(shareData.memoId).first();

    if (!memo) {
      return createErrorResponse('Memo not found', 404);
    }

    // Update access count
    shareData.accessCount++;

    // Handle password protected shares
    const url = new URL(request.url);
    const providedPassword = url.searchParams.get('password');

    if (shareData.password && shareData.password !== simpleHash(providedPassword || '')) {
      return createResponse({ requiresPassword: true }, 401);
    }

    memo.tags = memo.tags ? memo.tags.split(',') : [];

    return createResponse({
      memo,
      expiresAt: shareData.expiresAt,
      accessCount: shareData.accessCount
    }, 200);
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}

// DELETE /api/share/:id - 删除分享链接
export async function deleteShare(request, env, shareId) {
  try {
    if (shareStore.has(shareId)) {
      shareStore.delete(shareId);
      return createResponse({ success: true, message: 'Share link deleted' }, 200);
    }
    return createErrorResponse('Share link not found', 404);
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}