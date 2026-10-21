'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { emojiApi } from '@/lib/api';
const EmojiContext = createContext(null);
export function EmojiProvider({
  children
}) {
  const [groups, setGroups] = useState([]);
  const [emojiMap, setEmojiMap] = useState({});
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  const fetchPromiseRef = useRef(null);
  const fetchEmojis = useCallback(() => {
    // 已加载或正在加载则跳过
    if (fetchedRef.current || fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }
    setLoading(true);
    fetchPromiseRef.current = emojiApi.getAll().then(data => {
      setGroups(data);

      // 构建 groupSlug/code -> emoji 映射
      const map = {};
      data.forEach(group => {
        if (group.emojis) {
          group.emojis.forEach(emoji => {
            const fullKey = `${group.slug}/${emoji.code}`;
            map[fullKey] = {
              ...emoji,
              groupSlug: group.slug,
              groupName: group.name,
              groupSize: group.size
            };
          });
        }
      });
      setEmojiMap(map);
      fetchedRef.current = true;
    }).catch(err => {
      console.error("Could not load emoji:", err);
      fetchPromiseRef.current = null; // 失败后允许重试
    }).finally(() => {
      setLoading(false);
    });
    return fetchPromiseRef.current;
  }, []);

  // 获取表情：支持完整语法 (group/code) 和短语法 (code)
  const getEmoji = useCallback(identifier => {
    if (!identifier) return null;

    // 完整语法：直接查找
    if (identifier.includes('/')) {
      return emojiMap[identifier] || null;
    }

    // 短语法：遍历查找第一个匹配的 code
    for (const key in emojiMap) {
      const emoji = emojiMap[key];
      if (emoji.code === identifier) {
        return emoji;
      }
    }
    return null;
  }, [emojiMap]);
  const value = useMemo(() => ({
    groups,
    getEmoji,
    loading,
    ensureLoaded: fetchEmojis
  }), [groups, getEmoji, loading, fetchEmojis]);
  return <EmojiContext.Provider value={value}>
      {children}
    </EmojiContext.Provider>;
}
export const useEmoji = () => {
  const context = useContext(EmojiContext);
  if (!context) {
    throw new Error('useEmoji must be used within an EmojiProvider');
  }

  // 懒加载：首次调用 useEmoji 时才触发数据请求
  useEffect(() => {
    context.ensureLoaded();
  }, [context.ensureLoaded]);
  return context;
};
