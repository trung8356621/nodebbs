'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { adsApi } from '@/lib/api';
const AdsContext = createContext(null);

/**
 * 广告系统 Provider
 * @param {Object} props
 * @param {string[]} [props.preloadSlots] - 预加载的广告位代码列表
 * @param {React.ReactNode} props.children
 */
export function AdsProvider({
  preloadSlots = [],
  children
}) {
  // 存储各广告位的数据 { [slotCode]: { slot, ads, loading, error } }
  const [slotsData, setSlotsData] = useState({});
  // 已记录展示的广告 ID
  const impressionTracked = useRef(new Set());
  // 已请求过的广告位（防止重复请求）
  const requestedSlots = useRef(new Set());

  // 批量请求队列和定时器
  const batchQueue = useRef([]);
  const batchTimeout = useRef(null);

  /**
   * 处理批量请求队列
   */
  const processBatch = useCallback(async () => {
    // 取出队列中的所有项
    const queueItems = [...batchQueue.current];
    batchQueue.current = []; // 清空队列

    if (queueItems.length === 0) return;

    // 提取唯一的 slotCodes
    const uniqueSlotCodes = [...new Set(queueItems.map(item => item.code))];

    // 1. 批量设置加载状态 (触发一次重渲染)
    setSlotsData(prev => {
      const next = {
        ...prev
      };
      uniqueSlotCodes.forEach(code => {
        next[code] = {
          ...(next[code] || {}),
          loading: true,
          error: null
        };
      });
      return next;
    });
    try {
      // 2. 发起批量 API 请求
      const results = await adsApi.getAdsBySlots(uniqueSlotCodes);

      // 3. 批量更新成功状态 (触发一次重渲染)
      setSlotsData(prev => {
        const next = {
          ...prev
        };

        // 更新返回的数据
        Object.entries(results).forEach(([code, data]) => {
          next[code] = {
            ...(next[code] || {}),
            slot: data.slot,
            ads: data.ads || [],
            loading: false,
            error: null
          };
        });

        // 处理未返回数据的 slot (防御性处理)
        uniqueSlotCodes.forEach(code => {
          if (!results[code]) {
            next[code] = {
              ...(next[code] || {}),
              slot: null,
              ads: [],
              loading: false,
              error: null
            };
          }
        });
        return next;
      });

      // 4. Resolve 所有相关的 Promise
      queueItems.forEach(({
        code,
        resolve
      }) => {
        resolve(results[code] || {
          slot: null,
          ads: []
        });
      });
    } catch (error) {
      console.error("Could not load ads in bulk:", error);

      // 批量更新错误状态
      setSlotsData(prev => {
        const next = {
          ...prev
        };
        uniqueSlotCodes.forEach(code => {
          next[code] = {
            ...(next[code] || {}),
            loading: false,
            error
          };
        });
        return next;
      });

      // Reject 所有相关的 Promise
      queueItems.forEach(({
        reject
      }) => {
        reject(error);
      });
    }
  }, []);

  /**
   * 获取指定广告位的广告数据 (加入批量队列)
   */
  const fetchSlotAds = useCallback(slotCode => {
    return new Promise((resolve, reject) => {
      if (!slotCode) {
        resolve(null);
        return;
      }

      // 标记为已请求
      requestedSlots.current.add(slotCode);

      // 加入队列
      batchQueue.current.push({
        code: slotCode,
        resolve,
        reject
      });

      // 重置定时器 (防抖 50ms)
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
      batchTimeout.current = setTimeout(() => {
        processBatch();
      }, 50);
    });
  }, [processBatch]);

  /**
   * 记录广告点击
   */
  const recordClick = useCallback(adId => {
    if (adId) {
      adsApi.recordClick(adId).catch(() => {});
    }
  }, []);

  /**
   * 记录广告展示 (提供给组件调用)
   */
  const recordImpression = useCallback(adId => {
    if (adId) {
      adsApi.recordImpression(adId).catch(() => {});
    }
  }, []);

  /**
   * 刷新指定广告位
   */
  const refreshSlot = useCallback(slotCode => {
    // 强制刷新：先移除已请求标记
    if (requestedSlots.current.has(slotCode)) {
      requestedSlots.current.delete(slotCode);
    }
    return fetchSlotAds(slotCode);
  }, [fetchSlotAds]);

  /**
   * 刷新所有已加载的广告位
   */
  const refreshAll = useCallback(() => {
    const loadedSlots = Object.keys(slotsData);
    return Promise.all(loadedSlots.map(fetchSlotAds));
  }, [slotsData, fetchSlotAds]);

  // 预加载指定的广告位（仅在 mount 时执行一次）
  useEffect(() => {
    if (preloadSlots.length > 0) {
      preloadSlots.forEach(slotCode => {
        if (!requestedSlots.current.has(slotCode)) {
          fetchSlotAds(slotCode);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在 mount 时执行

  /**
   * 检查广告位是否已请求
   */
  const isSlotRequested = useCallback(slotCode => {
    return requestedSlots.current.has(slotCode);
  }, []);
  const value = {
    slotsData,
    fetchSlotAds,
    recordClick,
    recordImpression,
    refreshSlot,
    refreshAll,
    isSlotRequested
  };
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

/**
 * 获取广告系统上下文
 */
export function useAdsContext() {
  const context = useContext(AdsContext);
  if (!context) {
    throw new Error('useAdsContext must be used within an AdsProvider');
  }
  return context;
}

/**
 * 获取指定广告位的广告数据
 * @param {string} slotCode - 广告位代码
 * @returns {{ slot: Object|null, ads: Array, loading: boolean, error: Error|null, refresh: Function, recordClick: Function }}
 */
export function useAds(slotCode) {
  const {
    slotsData,
    fetchSlotAds,
    recordClick,
    recordImpression,
    refreshSlot,
    isSlotRequested
  } = useAdsContext();
  const slotData = slotsData[slotCode] || {
    slot: null,
    ads: [],
    loading: false,
    error: null
  };

  // 如果该广告位还没有数据，自动获取
  useEffect(() => {
    if (slotCode && !isSlotRequested(slotCode)) {
      fetchSlotAds(slotCode);
    }
  }, [slotCode, fetchSlotAds, isSlotRequested]);
  const refresh = useCallback(() => {
    return refreshSlot(slotCode);
  }, [refreshSlot, slotCode]);
  return {
    ...slotData,
    refresh,
    recordClick,
    recordImpression
  };
}
