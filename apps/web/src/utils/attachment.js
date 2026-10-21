import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { BadgeCheck, Coins, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText, FileVideo, File, Lock, MessageSquare, ShieldAlert } from 'lucide-react';

/**
 * 话题附件的展示层工具（纯函数 + 常量，无副作用）。
 * 放在底座 utils 下，供编辑器弹窗（modules）与 MarkdownRender 组件（components/common）共用。
 */

/** 下载策略元信息，顺序即表单里的展示顺序；首项为默认值 */
export const ATTACHMENT_POLICIES = (pbnT = pbnRuntimeT) => [{
  value: 'none',
  label: pbnT("m2470"),
  description: pbnT("m2471")
}, {
  value: 'login',
  label: pbnT("m2472"),
  description: pbnT("m2473")
}, {
  value: 'reply',
  label: pbnT("m2474"),
  description: pbnT("m2475")
}, {
  value: 'points',
  label: pbnT("m2476"),
  description: pbnT("m2477")
}, {
  value: 'role',
  label: pbnT("m2478"),
  description: pbnT("m2479")
}];
const POLICY_LABELS = (pbnT = pbnRuntimeT) => Object.fromEntries(ATTACHMENT_POLICIES(pbnT).map(p => [p.value, p.label]));

/**
 * 取策略的中文标签
 * @param {string} policy
 * @returns {string}
 */
export function getPolicyLabel(policy, pbnT = pbnRuntimeT) {
  return POLICY_LABELS(pbnT)[policy] || pbnT("m2480");
}

/** 各受限策略在附件卡片上的短标识（'none' 无需标识，故不在表内） */
const POLICY_BADGES = (pbnT = pbnRuntimeT) => ({
  login: {
    label: pbnT("m2481"),
    Icon: Lock
  },
  reply: {
    label: pbnT("m2482"),
    Icon: MessageSquare
  },
  role: {
    label: pbnT("m2483"),
    Icon: ShieldAlert
  }
});

/**
 * 取附件卡片上的策略标识。
 *
 * 有下载权的卡片右侧只剩一个「下载」按钮，若不给标识，免费附件、已购的积分附件、
 * 作者豁免的积分附件看起来完全一样。三者的区别正是这里要表达的：
 *   - 已购买        → 主色徽标，告诉购买者不用再付一次
 *   - N 积分        → 尚未购买（作者/版主视角），顺带把定价摆出来
 *   - 登录/回复/角色 → 说明该附件对他人是受限的
 *
 * @param {string} policy
 * @param {{ purchased?: boolean, pointsCost?: number }} [state]
 * @returns {{label: string, Icon: import('react').ComponentType, variant: string}|null}
 *          policy='none' 返回 null（无限制，无可标识）
 */
export function getPolicyBadge(policy, {
  purchased = false,
  pointsCost = 0
} = {}, pbnT = pbnRuntimeT) {
  if (policy === 'points') {
    return purchased ? {
      label: pbnT("m2484"),
      Icon: BadgeCheck,
      variant: 'default'
    } : {
      label: pbnT("m1387", {
        arg0: pointsCost
      }),
      Icon: Coins,
      variant: 'secondary'
    };
  }
  const meta = POLICY_BADGES(pbnT)[policy];
  return meta ? {
    ...meta,
    variant: 'secondary'
  } : null;
}

/**
 * 根据 MIME / 文件名挑一个 lucide 图标组件
 * @param {string} mimetype
 * @param {string} [filename]
 * @returns {import('react').ComponentType}
 */
export function getAttachmentIcon(mimetype = '', filename = '') {
  if (mimetype.startsWith('image/')) return FileImage;
  if (mimetype.startsWith('video/')) return FileVideo;
  if (mimetype.startsWith('audio/')) return FileAudio;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return FileArchive;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['json', 'xml', 'yml', 'yaml'].includes(ext)) return FileCode;
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return FileText;
  return File;
}

/**
 * 附件组内某个文件的下载地址。走 API 鉴权路由而非 /uploads 公开路径；
 * 站内认证是 httpOnly Cookie + 同源代理，故可直接用于 <a href>。
 * @param {number} attachmentId
 * @param {number} fileId
 * @returns {string}
 */
export function getAttachmentDownloadUrl(attachmentId, fileId) {
  return `/api/attachments/${attachmentId}/files/${fileId}/download`;
}
