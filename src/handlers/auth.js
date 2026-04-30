import { createResponse, createErrorResponse, getCorsHeaders } from '../utils/response.js';
import { generateToken, createSession, verifyPassword as checkPassword } from '../utils/auth.js';

// Simple hash function (for demo - in production use bcrypt or similar)
function simpleHash(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// POST /api/auth/verify - 验证密码并设置 cookie
export async function verifyPassword(request, env) {
  try {
    const origin = request.headers.get('Origin') || '*';
    const corsHeaders = getCorsHeaders(origin);

    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    const correctPassword = env.AUTH_PASSWORD || 'memos123';

    if (body.password === correctPassword) {
      // 生成随机 token
      const token = generateToken(32);

      // 创建 session 存储到数据库
      const expiresAt = await createSession(env, token);

      // 构建响应
      const response = createResponse({
        success: true,
        token: token,
        user: { id: 1, username: 'admin', isAdmin: true }
      }, 200, corsHeaders);

      // 判断是否 HTTPS - HTTPS 用 SameSite=None; Secure，HTTP 用 SameSite=Lax
      const url = new URL(request.url);
      const isHttps = url.protocol === 'https:';
      const cookieAttr = isHttps
        ? `memos_token=${token}; Path=/; HttpOnly; SameSite=None; Secure`
        : `memos_token=${token}; Path=/; HttpOnly; SameSite=Lax`;

      response.headers.set('Set-Cookie', cookieAttr);

      return response;
    } else {
      return createResponse({ success: false, error: '口令错误' }, 401, corsHeaders);
    }
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}

// POST /api/auth/logout - 登出
export async function logout(request, env) {
  try {
    // 从 cookie 或 header 获取 token
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/memos_token=([^;]+)/);
    const token = match ? match[1] : null;
    
    // 删除 session
    if (token) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    }
    
    const response = createResponse({ success: true, message: 'Logged out' }, 200);
    
    // 清除 cookie
    response.headers.set('Set-Cookie', 'memos_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    
    return response;
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}

// POST /api/auth/register - 注册新用户
export async function registerUser(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    if (!body || !body.username || !body.password) {
      return createErrorResponse('Username and password are required', 400);
    }

    const username = body.username.trim();
    const password = body.password;

    if (username.length < 3 || username.length > 50) {
      return createErrorResponse('Username must be 3-50 characters', 400);
    }

    if (password.length < 6) {
      return createErrorResponse('Password must be at least 6 characters', 400);
    }

    const passwordHash = simpleHash(password);
    const now = new Date().toISOString();

    // Check if username already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existing) {
      return createErrorResponse('Username already exists', 409);
    }

    // Check if this is the first user (make them admin)
    const { results: userCount } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).all();
    const isFirstUser = userCount[0]?.count === 0;

    const { success } = await env.DB.prepare(
      'INSERT INTO users (username, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(username, passwordHash, isFirstUser ? 1 : 0, now, now).run();

    if (success) {
      const { results } = await env.DB.prepare(
        'SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 1'
      ).all();

      return createResponse({
        user: {
          id: results[0].id,
          username: results[0].username,
          isAdmin: results[0].is_admin === 1
        },
        message: 'User registered successfully'
      }, 201);
    } else {
      return createErrorResponse('Failed to register user', 500);
    }
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}

// POST /api/auth/login - 用户登录
export async function loginUser(request, env) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('Invalid JSON body', 400);
    }

    if (!body || !body.username || !body.password) {
      return createErrorResponse('Username and password are required', 400);
    }

    const username = body.username.trim();
    const passwordHash = simpleHash(body.password);

    const user = await env.DB.prepare(
      'SELECT id, username, password_hash, is_admin FROM users WHERE username = ?'
    ).bind(username).first();

    if (!user) {
      return createResponse({ success: false, error: 'Invalid username or password' }, 401);
    }

    if (user.password_hash !== passwordHash) {
      return createResponse({ success: false, error: 'Invalid username or password' }, 401);
    }

    // 生成 token 并创建 session
    const token = generateToken(32);
    await createSession(env, token);
    
    const response = createResponse({
      success: true,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin === 1
      }
    }, 200);
    
    // 设置 cookie
    response.headers.set('Set-Cookie', `memos_token=${token}; Path=/; HttpOnly; SameSite=Strict`);
    
    return response;
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}
