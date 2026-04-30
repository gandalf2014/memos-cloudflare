// CORS配置 - credentials 模式需要具体 origin
export function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 创建JSON响应
export function createResponse(data, status = 200, extraHeaders = {}) {
  const origin = extraHeaders['Access-Control-Allow-Origin'] || '*';
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      ...extraHeaders 
    }
  });
}

// 创建CORS预检响应
export function handleCors() {
  return new Response(null, { headers: corsHeaders });
}

// 创建错误响应
export function createErrorResponse(message, status = 500) {
  return createResponse({ error: message }, status);
}

// 创建成功响应
export function createSuccessResponse(data, status = 200) {
  return createResponse(data, status);
}
