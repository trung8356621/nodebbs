'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import React, { useEffect, useState } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy } from 'lucide-react';
import CopyButton from '@/components/common/CopyButton';

// 常用语言静态注册（命中多数代码块，零加载延迟）
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
const STATIC_LANGUAGES = {
  bash,
  sh: bash,
  shell: bash,
  'shell-session': bash,
  console: bash,
  javascript,
  js: javascript,
  typescript,
  ts: typescript,
  jsx,
  tsx,
  json,
  markdown,
  md: markdown
};
for (const [name, def] of Object.entries(STATIC_LANGUAGES)) {
  SyntaxHighlighter.registerLanguage(name, def);
}

// 冷门语言首次使用时异步加载，各自独立 chunk，显著减少编译时每路由参与的模块数
const LAZY_LOADERS = {
  css: () => import('react-syntax-highlighter/dist/esm/languages/prism/css'),
  diff: () => import('react-syntax-highlighter/dist/esm/languages/prism/diff'),
  docker: () => import('react-syntax-highlighter/dist/esm/languages/prism/docker'),
  dockerfile: () => import('react-syntax-highlighter/dist/esm/languages/prism/docker'),
  go: () => import('react-syntax-highlighter/dist/esm/languages/prism/go'),
  golang: () => import('react-syntax-highlighter/dist/esm/languages/prism/go'),
  java: () => import('react-syntax-highlighter/dist/esm/languages/prism/java'),
  markup: () => import('react-syntax-highlighter/dist/esm/languages/prism/markup'),
  html: () => import('react-syntax-highlighter/dist/esm/languages/prism/markup'),
  xml: () => import('react-syntax-highlighter/dist/esm/languages/prism/markup'),
  php: () => import('react-syntax-highlighter/dist/esm/languages/prism/php'),
  python: () => import('react-syntax-highlighter/dist/esm/languages/prism/python'),
  py: () => import('react-syntax-highlighter/dist/esm/languages/prism/python'),
  ruby: () => import('react-syntax-highlighter/dist/esm/languages/prism/ruby'),
  rb: () => import('react-syntax-highlighter/dist/esm/languages/prism/ruby'),
  rust: () => import('react-syntax-highlighter/dist/esm/languages/prism/rust'),
  rs: () => import('react-syntax-highlighter/dist/esm/languages/prism/rust'),
  sql: () => import('react-syntax-highlighter/dist/esm/languages/prism/sql'),
  toml: () => import('react-syntax-highlighter/dist/esm/languages/prism/toml'),
  yaml: () => import('react-syntax-highlighter/dist/esm/languages/prism/yaml'),
  yml: () => import('react-syntax-highlighter/dist/esm/languages/prism/yaml')
};
const loaded = new Set(Object.keys(STATIC_LANGUAGES));
export default function CodeBlock({
  language,
  code,
  ...rest
}) {
  const pbnT = usePbnTranslations();
  const [, force] = useState(0);
  useEffect(() => {
    if (!language || loaded.has(language)) return;
    const loader = LAZY_LOADERS[language];
    if (!loader) return;
    loader().then(mod => {
      SyntaxHighlighter.registerLanguage(language, mod.default);
      loaded.add(language);
      force(n => n + 1);
    }).catch(err => {
      console.warn(`[CodeBlock] failed to load language "${language}"`, err);
    });
  }, [language]);
  return <div className='relative group rounded-lg w-full max-w-full grid grid-cols-1 min-w-0'>
      <CopyButton value={code} variant='ghost' size='sm' className='absolute text-accent right-2 top-2 shrink opacity-0 group-hover:opacity-100 transition z-10'>
        {({
        copied
      }) => copied ? pbnT("m154") : <Copy className='w-4 h-4' />}
      </CopyButton>
      <SyntaxHighlighter {...rest} language={language} style={tomorrow} customStyle={{
      margin: 0,
      overflowX: 'auto',
      maxWidth: '100%'
    }} PreTag='div' className='rounded-xl border-[3px] border-border overflow-x-auto max-w-full min-w-0'>
        {code}
      </SyntaxHighlighter>
    </div>;
}
