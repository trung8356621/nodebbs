'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ============= 共享内容组件 =============
function ConfirmPopoverContent(pbnArgument0) {
  const pbnT = usePbnTranslations();
  const {
    title = pbnT("m1270"),
    description,
    confirmText = pbnT("m1271"),
    cancelText = pbnT("m486"),
    variant = 'default',
    loading = false,
    onConfirm,
    onCancel
  } = pbnArgument0;
  const isDestructive = variant === 'destructive';
  return <div className="space-y-3">
      {/* 标题区域 */}
      <div className="flex items-start gap-3">
        {isDestructive && <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>}
        <div className="space-y-1 flex-1">
          <h4 className="font-medium text-sm leading-none">{title}</h4>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>

      {/* 按钮区域 */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={loading} className="h-8" autoFocus>
          {cancelText}
        </Button>
        <Button variant={isDestructive ? 'destructive' : 'default'} size="sm" onClick={onConfirm} disabled={loading} className="h-8 gap-1.5">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {confirmText}
        </Button>
      </div>
    </div>;
}

// ============= 全局状态管理（类似 sonner toast） =============
let listeners = [];
let memoryState = {
  open: false,
  position: {
    x: 0,
    y: 0
  },
  options: {},
  resolve: null
};
function dispatch(action) {
  memoryState = {
    ...memoryState,
    ...action
  };
  listeners.forEach(listener => listener(memoryState));
}
function subscribe(listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

/**
 * 查找持久存在的触发元素（自动检测回退机制）
 * 支持 Radix UI 的 DropdownMenu、Popover 等组件
 * 当从这些组件的菜单项触发时，会自动找到对应的触发器按钮
 */
function findPersistentTrigger(element) {
  if (!element) return null;

  // 检测 Radix Popper（DropdownMenu、Popover 等）
  const popperContent = element.closest('[data-radix-popper-content-wrapper]');
  if (popperContent) {
    // 方法1：通过 aria-controls 找到触发器
    const popperId = popperContent.querySelector('[data-radix-menu-content]')?.id;
    if (popperId) {
      const trigger = document.querySelector(`[aria-controls="${popperId}"]`);
      if (trigger) return trigger;
    }

    // 方法2：查找当前打开状态的触发器
    const openTrigger = document.querySelector('[data-state="open"][aria-haspopup="menu"]');
    if (openTrigger) return openTrigger;
  }

  // 未检测到特殊场景，返回原元素
  return element;
}

/**
 * confirm - 函数式确认弹出层
 *
 * @param {Event|null} event - 触发事件，用于定位弹出层
 * @param {Object} options - 配置选项
 * @param {HTMLElement} options.anchorElement - 可选，明确指定锚点元素（优先级最高）
 * @param {string} options.title - 标题
 * @param {string} options.description - 描述
 * @param {string} options.confirmText - 确认按钮文本
 * @param {string} options.cancelText - 取消按钮文本
 * @param {'default'|'destructive'} options.variant - 样式变体
 *
 * @example
 * // 基础用法（自动定位）
 * const confirmed = await confirm(e, { title: '确认删除' });
 *
 * @example
 * // 指定锚点元素（推荐用于动态卸载的场景）
 * const buttonRef = useRef(null);
 * const confirmed = await confirm(e, {
 *   anchorElement: buttonRef.current,
 *   title: '确认删除',
 * });
 */
export function confirm(event, options = {}) {
  let x = 0,
    y = 0;
  let anchorElement = null;

  // 优先级：anchorElement > 自动检测持久元素 > event.currentTarget
  if (options.anchorElement && options.anchorElement instanceof HTMLElement) {
    anchorElement = options.anchorElement;
  } else {
    anchorElement = findPersistentTrigger(event?.currentTarget);
  }
  if (anchorElement) {
    const rect = anchorElement.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top;
  } else if (event?.clientX !== undefined) {
    x = event.clientX;
    y = event.clientY;
  }
  return new Promise(resolve => {
    dispatch({
      open: true,
      position: {
        x,
        y
      },
      triggerElement: anchorElement,
      options,
      resolve
    });
  });
}

// ============= Portal 组件（放在 layout 中渲染弹出层） =============
import { useRef } from 'react';
export function ConfirmPopoverPortal() {
  const [state, setState] = useState(memoryState);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [safePosition, setSafePosition] = useState({
    x: 0,
    y: 0
  });
  const popoverRef = useRef(null);
  useEffect(() => {
    setMounted(true);
    return subscribe(setState);
  }, []);

  // 计算位置的函数
  const calculateAndSetPosition = useCallback(() => {
    if (!state.open || !popoverRef.current) return;
    let x, y;
    const popoverWidth = popoverRef.current.offsetWidth || 288;
    const popoverHeight = popoverRef.current.offsetHeight || 120;
    const padding = 16; // 边缘安全距离

    // 优先使用触发元素的实时位置
    if (state.triggerElement && state.triggerElement.isConnected) {
      const rect = state.triggerElement.getBoundingClientRect();
      // 增加有效性校验：元素被隐藏时 rect 宽高为 0
      if (rect.width > 0 && rect.height > 0) {
        x = rect.left + rect.width / 2;
        y = rect.top;
      } else {
        // 元素被隐藏，回退到初始位置
        x = state.position.x;
        y = state.position.y;
      }
    } else {
      // 回退到存储的初始位置
      x = state.position.x;
      y = state.position.y;
    }

    // 水平边界检测
    const minX = popoverWidth / 2 + padding;
    const maxX = window.innerWidth - popoverWidth / 2 - padding;
    x = Math.max(minX, Math.min(maxX, x));

    // 垂直边界检测：如果上方空间不足，显示在下方
    const spaceAbove = y - padding;
    const showBelow = spaceAbove < popoverHeight;
    setSafePosition({
      x,
      y,
      showBelow,
      popoverHeight
    });
  }, [state.open, state.position, state.triggerElement]);

  // 当状态变化时触发计算
  useEffect(() => {
    calculateAndSetPosition();
  }, [calculateAndSetPosition]);

  // 焦点管理：实现真正的 focus trap 循环
  useEffect(() => {
    if (!state.open || !popoverRef.current) return;
    const popoverElement = popoverRef.current;

    // 初始聚焦到取消按钮
    const cancelButton = popoverElement.querySelector('button');
    if (cancelButton) {
      cancelButton.focus();
    }

    // Tab 循环焦点陷阱
    const handleKeyDown = e => {
      if (e.key !== 'Tab') return;
      const focusable = popoverElement.querySelectorAll('button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        // Shift+Tab 从第一个元素跳到最后一个
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        // Tab 从最后一个元素跳到第一个
        e.preventDefault();
        first.focus();
      }
    };

    // 监听焦点变化，当焦点移出 popover 时抢回焦点
    // 仅在焦点移到 body 直接子元素或非 popover 内部时才抢回
    const handleFocusIn = e => {
      if (!popoverElement.contains(e.target)) {
        // 检查是否是用户主动点击外部（此时应该关闭 popover 而非抢回焦点）
        // 如果焦点移到了 body 或其他非交互元素，才抢回焦点
        const cancelButton = popoverElement.querySelector('button');
        if (cancelButton) {
          cancelButton.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
    };
  }, [state.open]);

  // 监听滚动和 resizing 事件来更新位置
  useEffect(() => {
    if (state.open && state.triggerElement) {
      window.addEventListener('scroll', calculateAndSetPosition, true);
      window.addEventListener('resize', calculateAndSetPosition);

      // Request animation frame for smooth updates
      let animationFrameId;
      const tick = () => {
        calculateAndSetPosition();
        animationFrameId = requestAnimationFrame(tick);
      };
      // animationFrameId = requestAnimationFrame(tick); // Optional: if scroll events aren't frequent enough

      return () => {
        window.removeEventListener('scroll', calculateAndSetPosition, true);
        window.removeEventListener('resize', calculateAndSetPosition);
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      };
    }
  }, [state.open, state.triggerElement, calculateAndSetPosition]);
  const handleConfirm = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (state.options.onConfirm) {
        await state.options.onConfirm();
      }
      state.resolve?.(true);
      dispatch({
        open: false
      });
    } catch (error) {
      console.error('ConfirmPopover onConfirm error:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, state]);
  const handleCancel = useCallback(() => {
    if (loading) return;
    state.resolve?.(false);
    dispatch({
      open: false
    });
  }, [loading, state]);
  const handleKeyDown = useCallback(e => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape' && !loading) {
      e.preventDefault();
      handleCancel();
    }
  }, [handleConfirm, handleCancel, loading]);
  const handleBackdropClick = useCallback(e => {
    if (e.target === e.currentTarget && !loading) {
      handleCancel();
    }
  }, [handleCancel, loading]);
  if (!mounted || !state.open) return null;

  // 使用计算好的 showBelow 值（基于 popoverHeight 动态计算）
  const showBelow = safePosition.showBelow ?? false;
  return createPortal(<div className="fixed inset-0 z-50" onClick={handleBackdropClick} onKeyDown={handleKeyDown}>
      <div ref={popoverRef} className={cn("absolute bg-popover text-popover-foreground rounded-md border p-4 shadow-lg w-72", state.options?.className)} style={{
      left: safePosition.x,
      top: showBelow ? safePosition.y + 8 : safePosition.y,
      transform: showBelow ? 'translate(-50%, 0)' : 'translate(-50%, calc(-100% - 8px))'
    }} onClick={e => e.stopPropagation()}>
        <ConfirmPopoverContent {...state.options} loading={loading} onConfirm={handleConfirm} onCancel={handleCancel} />
      </div>
    </div>, document.body);
}

// ============= 组件式 API =============
/**
 * ConfirmPopover - 确认弹出层组件（组件式）
 *
 * @example
 * <ConfirmPopover title="确认删除" onConfirm={handleDelete}>
 *   <Button>删除</Button>
 * </ConfirmPopover>
 */
export function ConfirmPopover({
  title,
  description,
  confirmText,
  cancelText,
  variant = 'default',
  onConfirm,
  children,
  disabled = false,
  align = 'center',
  side = 'top',
  sideOffset = 8,
  className
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleConfirm = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm?.();
      setOpen(false);
    } catch (error) {
      console.error('ConfirmPopover onConfirm error:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, onConfirm]);
  const handleCancel = useCallback(() => {
    if (loading) return;
    setOpen(false);
  }, [loading]);
  return <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent align={align} side={side} sideOffset={sideOffset} className={cn('w-72 p-4', className)}>
        <ConfirmPopoverContent title={title} description={description} confirmText={confirmText} cancelText={cancelText} variant={variant} loading={loading} onConfirm={handleConfirm} onCancel={handleCancel} />
      </PopoverContent>
    </Popover>;
}
export default ConfirmPopover;
