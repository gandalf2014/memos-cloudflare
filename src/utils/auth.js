// Auth utilities for cookie-based authentication

// Generate random token
export function generateToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Get token from request (cookie or header)
export function getAuthToken(request) {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookie
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/memos_token=([^;]+)/);
  if (match) {
    return match[1];
  }
  
  return null;
}

// Verify token and check if user is logged in
export async function isLoggedIn(request, env) {
  const token = getAuthToken(request);
  
  if (!token) {
    return false;
  }
  
  // Check if token is valid and not expired
  const validToken = await env.DB.prepare(
    "SELECT token FROM sessions WHERE token = ? AND expires_at > ?"
  ).bind(token, new Date().toISOString()).first();
  
  return !!validToken;
}

// Create session and store token (no user_id required for single-user mode)
export async function createSession(env, token) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  
  // Try to insert session with user_id = 1
  try {
    // First, ensure default user exists
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind('admin').first();
    
    let userId = existingUser?.id;
    
    if (!userId) {
      // Create default admin user (let id auto-increment)
      const result = await env.DB.prepare(
        'INSERT INTO users (username, password_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).bind('admin', '0', 1, now.toISOString(), now.toISOString()).run();
      
      // Get the inserted user id
      const newUser = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ?'
      ).bind('admin').first();
      userId = newUser?.id;
    }
    
    if (!userId) {
      console.error('Failed to get or create user');
      return expiresAt;
    }
    
    // Now create the session
    await env.DB.prepare(
      'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).bind(token, userId, expiresAt.toISOString(), now.toISOString()).run();
    
  } catch (e) {
    console.error('Failed to create session:', e);
  }
  
  return expiresAt;
}

// Clean up expired sessions (optional, can be called periodically)
export async function cleanupSessions(env) {
  await env.DB.prepare(
    'DELETE FROM sessions WHERE expires_at < datetime("now")'
  ).run();
}

// Verify password
export function verifyPassword(password, env) {
  const correctPassword = env.AUTH_PASSWORD || 'memos123';
  return password === correctPassword;
}

// Parse cookie string
export function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=');
    }
  });
  
  return cookies;
}
