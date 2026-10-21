import { usePbnTranslations } from "@/i18n/useTranslations";
import React, { useRef } from 'react';
import { Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 上传按钮组件
export const UploadButton = ({
  onUpload,
  onClosePopover
}) => {
  const pbnT = usePbnTranslations();
  const fileInputRef = useRef(null);
  const handleFileChange = async e => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (onUpload) {
      try {
        // 关闭 Popover
        if (onClosePopover) onClosePopover();

        // 直接传递 FileList 或数组给 onUpload，由其内部统一处理批量逻辑
        // 注意：onUpload 是异步的，但我们不需要在这里等待其完成，
        // 因为 UI 反馈是通过编辑器内的占位符来展示的
        onUpload(files);
      } catch (error) {
        console.error('Upload error in toolbar:', error);
      } finally {
        // 重置 input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };
  return <>
      <div className="relative flex items-center py-1">
        <div className="grow border-t border-border"></div>
        <span className="shrink-0 mx-2 text-xs text-muted-foreground">{pbnT("m1334")}</span>
        <div className="grow border-t border-border"></div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
      <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
        <UploadIcon className="h-3 w-3" />{pbnT("m1335")}</Button>
    </>;
};
