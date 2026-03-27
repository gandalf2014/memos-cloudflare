// CORS配置
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 创建JSON响应
export function createResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'application/json; charset=utf-8',
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
