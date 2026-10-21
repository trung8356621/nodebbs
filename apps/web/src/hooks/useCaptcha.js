'use client';

import { useState, useEffect } from 'react';
import { captchaConfigApi } from '@/lib/api';

/**
 * CAPTCHA 配置 Hook
 * 获取当前启用的 CAPTCHA 配置
 */
export function useCaptchaConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let mounted = true;
    const fetchConfig = async () => {
      try {
        const data = await captchaConfigApi.getConfig();
        if (mounted) {
          setConfig(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
          console.error("[useCaptchaConfig] Could not load configuration:", err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    fetchConfig();
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * 检查指定场景是否需要验证
   */
  const isRequired = scene => {
    if (!config || !config.enabled) return false;
    return config.enabledScenes?.[scene] === true;
  };
  return {
    config,
    loading,
    error,
    isRequired,
    enabled: config?.enabled || false
  };
}
export default useCaptchaConfig;
