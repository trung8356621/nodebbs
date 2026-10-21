import createNextIntlPlugin from 'next-intl/plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.FORUM_NEXT_DIST || '.next',
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // 匹配所有域名
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  // 启用 standalone 输出模式，用于 Docker 部署
  output: 'standalone',
  // 代理逻辑已迁移至 src/proxy.js，以支持 Docker 运行时环境变量动态注入

  // 增加中间件请求体大小限制，支持大文件上传
  experimental: {
    proxyClientMaxBodySize: '100mb',
    // Next.js 默认已优化 lucide-react / date-fns 等，这里补齐项目在用但不在默认列表的 barrel 包
    optimizePackageImports: [
      'framer-motion',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
    ],
  }
};

export default createNextIntlPlugin('./src/i18n/request.js')(nextConfig);
