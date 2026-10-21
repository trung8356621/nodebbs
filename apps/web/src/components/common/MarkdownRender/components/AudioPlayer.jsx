import { usePbnTranslations } from "@/i18n/useTranslations";
/**
 * 音频播放组件
 * 支持普通音频和网易云音乐嵌入
 */
export default function AudioPlayer({
  src,
  ...props
}) {
  const pbnT = usePbnTranslations();
  // 处理网易云音乐
  // 匹配: https://music.163.com/#/song?id=123456 或 https://music.163.com/song?id=123456
  const neteaseMatch = src?.match(/music\.163\.com\/.*[?&]id=(\d+)/);
  if (neteaseMatch) {
    return <div className="my-2" style={{
      width: props.width || '100%'
    }}>
        <iframe border="0" width="100%" height="86" src={`https://music.163.com/outchain/player?type=2&id=${neteaseMatch[1]}&auto=0&height=66`} title="Netease Cloud Music" sandbox="allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups" referrerPolicy="no-referrer" loading="lazy" />
      </div>;
  }

  // 默认音频标签
  return <audio controls className="w-full my-2" src={src} {...props}>{pbnT("m1369")}</audio>;
}
