import { usePbnTranslations } from "@/i18n/useTranslations";
/**
 * 视频播放组件
 * 支持普通视频和主流平台嵌入（YouTube、Bilibili、抖音）
 */
export default function VideoPlayer({
  src,
  title,
  width,
  height,
  ...rest
}) {
  const pbnT = usePbnTranslations();
  // 获取样式对象的辅助函数
  const getWrapperStyle = () => {
    const style = {
      maxWidth: '100%'
    };
    if (width) style.width = width;
    if (height) style.height = height;
    return style;
  };

  // 处理 YouTube
  const youtubeMatch = src?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (youtubeMatch) {
    return <div className="relative aspect-video my-4 rounded-lg overflow-hidden" style={getWrapperStyle()}>
        <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${youtubeMatch[1]}`} title={title || "YouTube video player"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute top-0 left-0"></iframe>
      </div>;
  }

  // 处理抖音视频
  // 匹配: https://www.douyin.com/video/7364265076712312127
  const douyinMatch = src?.match(/douyin\.com\/video\/(\d+)/);
  if (douyinMatch) {
    return <div className="relative aspect-video my-4 rounded-lg overflow-hidden" style={getWrapperStyle()}>
        <iframe width="100%" height="100%" src={`https://open.douyin.com/player/video?vid=${douyinMatch[1]}&autoplay=0`} title={title || "Douyin video player"} allowFullScreen className="absolute top-0 left-0" referrerPolicy="unsafe-url"></iframe>
      </div>;
  }

  // 处理 Bilibili
  const biliMatch = src?.match(/bilibili\.com\/video\/(BV[0-9a-zA-Z]+)/);
  if (biliMatch) {
    return <div className="relative aspect-video my-4 rounded-lg overflow-hidden" style={getWrapperStyle()}>
        <iframe width="100%" height="100%" src={`https://player.bilibili.com/player.html?bvid=${biliMatch[1]}&high_quality=1&danmaku=0`} title={title || "Bilibili video player"} allowFullScreen className="absolute top-0 left-0" sandbox="allow-top-navigation allow-same-origin allow-forms allow-scripts allow-popups"></iframe>
      </div>;
  }

  // 默认视频标签
  return <video controls className="max-w-full rounded-lg my-2 h-auto" style={{
    width: width || '100%'
  }} src={src} title={title} {...rest}>{pbnT("m1426")}</video>;
}
