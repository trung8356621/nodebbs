import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
// 客户端用户名「结构性」校验，仅用于注册表单的即时反馈：
// - 3~20 个字符
// - 仅允许小写字母、数字、下划线
// - 必须至少包含一个字母（禁止纯数字）
//
// 注：保留用户名（admin/root/...）属「权威校验」，由后端在提交时负责——
// 后端列表后台可配置且支持前缀通配（如 admin*），前端无法也不应复制这份规则，
// 否则会与后端漂移（例：admin2 前端放行、后端拒）。故此处不做保留词检查，
// 提交后由后端返回的错误信息兜底（useRegisterForm 已 surface err.message）。

const USERNAME_REGEX = /^(?=.*[a-z])[a-z0-9_]{3,20}$/;

/**
 * 规范化用户名（转小写并去除首尾空格）
 * @param {string} username 原始用户名
 * @returns {string} 规范化后的用户名
 */
export function normalizeUsername(username) {
  return (username || '').trim().toLowerCase();
}

/**
 * 客户端结构性校验（长度 + 字符集）。保留词 / 唯一性由后端权威校验。
 * @param {string} username 原始用户名
 * @returns {{ valid: boolean, error?: string }} 验证结果
 */
export function validateUsername(username, pbnT = pbnRuntimeT) {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3 || normalized.length > 20) {
    return {
      valid: false,
      error: pbnT("m2485")
    };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return {
      valid: false,
      error: pbnT("m2486")
    };
  }
  return {
    valid: true
  };
}
