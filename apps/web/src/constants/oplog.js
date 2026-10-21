import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
/**
 * 操作日志常量 — 中文映射 & 样式
 */

/** 目标类型中文映射 */
export const TARGET_TYPE_LABELS = (pbnT = pbnRuntimeT) => ({
  topic: pbnT("m68"),
  post: pbnT("m69"),
  user: pbnT("m70"),
  report: pbnT("m1477")
});

/**
 * 用户自操作：描述已自含宾语，不拼接目标类型
 * 同时用于判断是否隐藏 targetInfo
 */
export const SELF_ACTION_LABELS = (pbnT = pbnRuntimeT) => ({
  username_change: pbnT("m1550"),
  email_bind: pbnT("m1551"),
  phone_bind: pbnT("m1552"),
  email_change: pbnT("m1553"),
  phone_change: pbnT("m1554"),
  request_deletion: pbnT("m1555"),
  oauth_link: pbnT("m1556"),
  oauth_unlink: pbnT("m1557")
});

/** 管理/审核操作动词，渲染时拼接「了 + 目标类型」 */
export const ACTION_VERB_LABELS = (pbnT = pbnRuntimeT) => ({
  approve: pbnT("m374"),
  reject: pbnT("m375"),
  restore: pbnT("m305"),
  resubmit: pbnT("m1558"),
  edit_resubmit: pbnT("m1559"),
  ban: pbnT("m1560"),
  unban: pbnT("m1561"),
  anonymize: pbnT("m907"),
  report_resolve: pbnT("m1562"),
  report_dismiss: pbnT("m1563")
});

/** action → 颜色 class */
export const ACTION_COLORS = {
  approve: 'text-green-600',
  reject: 'text-red-600',
  restore: 'text-blue-600',
  resubmit: 'text-blue-600',
  edit_resubmit: 'text-blue-600',
  ban: 'text-red-600',
  unban: 'text-green-600',
  username_change: 'text-yellow-600',
  email_bind: 'text-blue-600',
  phone_bind: 'text-blue-600',
  email_change: 'text-yellow-600',
  phone_change: 'text-yellow-600',
  request_deletion: 'text-red-600',
  anonymize: 'text-red-600',
  report_resolve: 'text-green-600',
  report_dismiss: 'text-yellow-600',
  oauth_link: 'text-blue-600',
  oauth_unlink: 'text-yellow-600'
};

/** 筛选下拉选项 */
export const ACTION_FILTER_OPTIONS = (pbnT = pbnRuntimeT) => [{
  value: 'all',
  label: pbnT("m307")
}, {
  value: 'approve',
  label: pbnT("m374")
}, {
  value: 'reject',
  label: pbnT("m375")
}, {
  value: 'ban',
  label: pbnT("m1560")
}, {
  value: 'unban',
  label: pbnT("m1561")
}, {
  value: 'username_change',
  label: pbnT("m1162")
}, {
  value: 'email_bind',
  label: pbnT("m1143")
}, {
  value: 'phone_bind',
  label: pbnT("m1041")
}, {
  value: 'email_change',
  label: pbnT("m1564")
}, {
  value: 'phone_change',
  label: pbnT("m1087")
}, {
  value: 'request_deletion',
  label: pbnT("m1565")
}, {
  value: 'restore',
  label: pbnT("m305")
}, {
  value: 'anonymize',
  label: pbnT("m907")
}, {
  value: 'resubmit',
  label: pbnT("m1558")
}, {
  value: 'edit_resubmit',
  label: pbnT("m1559")
}, {
  value: 'report_resolve',
  label: pbnT("m457")
}, {
  value: 'report_dismiss',
  label: pbnT("m458")
}, {
  value: 'oauth_link',
  label: pbnT("m1566")
}, {
  value: 'oauth_unlink',
  label: pbnT("m1567")
}];

/**
 * 根据 action + targetType 生成操作描述
 */
export function getActionDescription(action, targetType, pbnT = pbnRuntimeT) {
  const selfText = SELF_ACTION_LABELS(pbnT)[action];
  if (selfText) return selfText;
  const targetLabel = TARGET_TYPE_LABELS(pbnT)[targetType] || targetType;
  const verb = ACTION_VERB_LABELS(pbnT)[action] || action;
  return pbnT("m1568", {
    arg0: verb,
    arg1: targetLabel
  });
}

/**
 * 判断是否为用户自操作（用于隐藏冗余 targetInfo）
 */
export function isSelfAction(action, pbnT = pbnRuntimeT) {
  return action in SELF_ACTION_LABELS(pbnT);
}
