// ID验证
export function validateId(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId) || numId <= 0) {
    throw new Error('Invalid ID');
  }
  return numId;
}

// 内容验证
export function validateContent(content) {
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

// 标签名验证
export function validateTagName(name) {
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

// 解析JSON请求体
export async function parseJsonBody(request) {
  try {
    const text = await request.text();
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON body');
  }
}
