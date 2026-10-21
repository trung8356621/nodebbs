import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
/**
 * 商品类型映射和工具函数
 */

export const ITEM_TYPES = {
  AVATAR_FRAME: 'avatar_frame',
  BADGE: 'badge',
  CUSTOM: 'custom'
};
export const ITEM_TYPE_LABELS = (pbnT = pbnRuntimeT) => ({
  [ITEM_TYPES.AVATAR_FRAME]: pbnT("m266"),
  [ITEM_TYPES.BADGE]: pbnT("m264"),
  [ITEM_TYPES.CUSTOM]: pbnT("m505")
});

/**
 * 获取商品类型的标签
 * @param {string} type - 商品类型键值
 * @returns {string} 可读标签
 */
export function getItemTypeLabel(type, pbnT = pbnRuntimeT) {
  return ITEM_TYPE_LABELS(pbnT)[type] || type;
}

/**
 * 获取所有可筛选的商品类型选项
 * @param {boolean} includeAll - 是否包含“全部”选项
 * @returns {Array} {value, label} 对象数组
 */
export function getItemTypeOptions(includeAll = true, pbnT = pbnRuntimeT) {
  const options = Object.entries(ITEM_TYPE_LABELS(pbnT)).map(([value, label]) => ({
    value,
    label
  }));
  if (includeAll) {
    return [{
      value: 'all',
      label: pbnT("m307")
    }, ...options];
  }
  return options;
}

/**
 * 检查商品是否过期
 * @param {string|null} expiresAt - ISO 日期字符串或 null
 * @returns {boolean}
 */
export function isItemExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}
