import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
/**
 * 主题配置文件 - 单一数据源
 * 在 ThemeContext 和 layout 中共享，确保配置一致性
 */

export const THEMES = (pbnT = pbnRuntimeT) => [{
  value: 'default',
  label: pbnT("m534"),
  class: '',
  color: 'oklch(0.208 0.042 265.755)'
}, {
  value: 'sunrise',
  label: pbnT("m1546"),
  class: 'sunrise',
  color: 'oklch(0.62 0.24 12)'
}, {
  value: 'iceblue',
  label: pbnT("m1547"),
  class: 'iceblue',
  color: 'oklch(0.56 0.18 250)'
}, {
  value: 'nord',
  label: 'Nord',
  class: 'nord',
  color: 'oklch(0.594 0.077 254.03)'
}];
export const FONT_SIZES = (pbnT = pbnRuntimeT) => [{
  value: 'compact',
  label: pbnT("m1548"),
  class: 'font-scale-compact'
}, {
  value: 'normal',
  label: pbnT("m832"),
  class: 'font-scale-normal'
}, {
  value: 'comfortable',
  label: pbnT("m1549"),
  class: 'font-scale-comfortable'
}];

// 默认值
export const DEFAULT_THEME = 'default';
export const DEFAULT_FONT_SIZE = 'normal';

// localStorage 键名
export const STORAGE_KEYS = {
  THEME_STYLE: 'theme-style',
  FONT_SIZE: 'font-size'
};
