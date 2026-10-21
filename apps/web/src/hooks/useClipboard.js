import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
export function useClipboard({
  timeout = 2000
} = {}) {
  const pbnT = usePbnTranslations();
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async text => {
    if (!text) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          const successful = document.execCommand('copy');
          if (!successful) throw new Error('Copy command failed');
        } catch (err) {
          console.error('Fallback copy failed', err);
          throw new Error(pbnT("m2191"));
        } finally {
          document.body.removeChild(textArea);
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
      return true;
    } catch (error) {
      console.error('Copy failed', error);
      setCopied(false);
      return false;
    }
  }, [timeout]);
  return {
    copy,
    copied
  };
}
