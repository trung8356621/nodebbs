import { NextResponse } from 'next/server';
import { headersForApiProxy } from './lib/proxy-forwarded-headers.js';

// Next.js 16 uses proxy.ts instead of middleware.ts
export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const hosts = process.env.FORUM_ALLOWED_HOSTS?.split(',');
  if (hosts && !hosts.includes(request.headers.get('host')?.toLowerCase())) {
    return new NextResponse('Unknown forum host', { status: 421 });
  }

  // 获取运行时环境变量
  // 在 Docker 环境中，这会读取 docker-compose 传入的 SERVER_API_URL (e.g., http://api:7100)
  const apiUrl = process.env.SERVER_API_URL || 'http://localhost:7100';

  // Proxy API + OPS inbound callbacks (/ops/v1/forum/*) to Fastify.
  // OPS uses the forum public origin + /ops/... — without this rewrite, Next returns 404 HTML.
  const topicMatch = pathname.match(/^\/topic\/([^/]+)\/?$/);
  if (topicMatch) {
    const missing = await topicIsNotPublic(apiUrl, topicMatch[1], request.headers.get('cookie'));
    if (missing) {
      const notFoundUrl = request.nextUrl.clone();
      notFoundUrl.pathname = '/not-found-render';
      notFoundUrl.search = '';
      return NextResponse.rewrite(notFoundUrl);
    }
  }

  if (
    pathname.startsWith('/api')
    || pathname.startsWith('/ops')
    || pathname.startsWith('/uploads')
    || pathname.startsWith('/docs/json')
  ) {
    // 构建目标 URL
    const destinationUrl = new URL(pathname, apiUrl);
    destinationUrl.search = request.nextUrl.search;
    
    // console.log(`[Proxy] ${pathname} -> ${destinationUrl.toString()}`);
    // console.log(`[Proxy] DEBUG: SERVER_API_URL=${apiUrl}, Proxy Target=${destinationUrl.toString()}`);

    return NextResponse.rewrite(destinationUrl, {
      request: { headers: headersForApiProxy(request.headers) },
    });
  }
  
  return NextResponse.next();
}

/**
 * API 404 means the topic is missing or not public for this cookie.
 * 5xx and timeouts stay on the topic route so the page can surface a real error.
 * @param {string} apiUrl
 * @param {string} id
 * @param {string | null} cookie
 */
async function topicIsNotPublic(apiUrl, id, cookie) {
  try {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    const response = await fetch(new URL(`/api/topics/${encodeURIComponent(id)}`, apiUrl), {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    await response.body?.cancel();
    return response.status === 404;
  } catch {
    return false;
  }
}

export const config = {
  // 匹配需要代理的路径
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/api/:path*',
    '/ops/:path*',
    '/uploads/:path*',
    '/docs/json',
  ],
};
