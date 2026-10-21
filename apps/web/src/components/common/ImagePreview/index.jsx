'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ImageViewer from './ImageViewer';
const DEFAULT_OVERLAY_OPACITY = 0.9;
function ImagePreview({
  open,
  onOpenChange,
  images,
  initialIndex = 0,
  overlayBaseOpacity = DEFAULT_OVERLAY_OPACITY,
  onIndexChange,
  showNavButtons = false
}) {
  const pbnT = usePbnTranslations();
  const normalizedImages = useMemo(() => {
    if (!images || images.length === 0) return [];
    return images.map(item => {
      if (!item) return null;
      if (typeof item === 'string') {
        return {
          src: item,
          alt: ''
        };
      }
      return {
        src: item.src,
        alt: item.alt || ''
      };
    }).filter(item => item && item.src);
  }, [images]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [overlayOpacity, setOverlayOpacity] = useState(overlayBaseOpacity);
  const total = normalizedImages.length;
  const currentImage = normalizedImages[activeIndex] || normalizedImages[0];
  const canPrev = total > 1 && activeIndex > 0;
  const canNext = total > 1 && activeIndex < total - 1;
  const setIndex = useCallback(nextIndex => {
    setActiveIndex(nextIndex);
    onIndexChange?.(nextIndex);
  }, [onIndexChange]);
  const handlePrev = useCallback(() => {
    if (!canPrev) return;
    setIndex(Math.max(activeIndex - 1, 0));
  }, [activeIndex, canPrev, setIndex]);
  const handleNext = useCallback(() => {
    if (!canNext) return;
    setIndex(Math.min(activeIndex + 1, total - 1));
  }, [activeIndex, canNext, setIndex, total]);
  const handleOverlayOpacityChange = useCallback(value => {
    setOverlayOpacity(value);
  }, []);
  useEffect(() => {
    if (!open) return;
    const nextIndex = Math.min(Math.max(initialIndex, 0), Math.max(total - 1, 0));
    setActiveIndex(nextIndex);
  }, [open, initialIndex, total]);
  useEffect(() => {
    if (open) {
      setOverlayOpacity(overlayBaseOpacity);
    }
  }, [open, activeIndex, overlayBaseOpacity]);
  useEffect(() => {
    if (!open || total <= 1) return;
    const handleKeyDown = e => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      }
      if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, total, handlePrev, handleNext]);
  if (!currentImage) {
    return null;
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay style={{
        backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`
      }} />
        <DialogPrimitive.Content data-slot="dialog-content" className="fixed top-1/2 left-1/2 z-50 h-dvh w-screen max-h-dvh! max-w-[100vw]! -translate-x-1/2 -translate-y-1/2 bg-transparent p-0 shadow-none border-0 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
          <div className="relative w-full h-full flex items-center justify-center group">
            {/* 顶部按钮区域 */}
            <div className="absolute top-0 left-0 right-0 p-3 flex justify-end items-start z-50 pointer-events-none">
              {/* 操作区：右上角组合 */}
              <div className="flex items-center gap-3">
                {/* 新窗口打开 */}
                <a href={currentImage.src} target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-colors pointer-events-auto" aria-label={pbnT("m1303")} onClick={e => e.stopPropagation()}>
                  <ExternalLink className="w-5 h-5" />
                </a>

                {/* 关闭按钮 */}
                <button onClick={() => onOpenChange?.(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-colors pointer-events-auto" aria-label={pbnT("m446")}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 上一张/下一张 */}
            {showNavButtons && total > 1 && <>
                {canPrev && <button onClick={e => {
              e.stopPropagation();
              handlePrev();
            }} className="absolute left-4 top-1/2 z-50 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-all sm:opacity-0 sm:group-hover:opacity-100 pointer-events-auto" aria-label={pbnT("m1304")}>
                    <ChevronLeft className="w-6 h-6" />
                  </button>}
                {canNext && <button onClick={e => {
              e.stopPropagation();
              handleNext();
            }} className="absolute right-4 top-1/2 z-50 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-all sm:opacity-0 sm:group-hover:opacity-100 pointer-events-auto" aria-label={pbnT("m1305")}>
                    <ChevronRight className="w-6 h-6" />
                  </button>}
              </>}

            {/* 图片容器 - 处理交互 */}
            <ImageViewer key={currentImage.src} src={currentImage.src} alt={currentImage.alt} onClose={() => onOpenChange?.(false)} overlayBaseOpacity={overlayBaseOpacity} onOverlayOpacityChange={handleOverlayOpacityChange} />
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>;
}
export default ImagePreview;
