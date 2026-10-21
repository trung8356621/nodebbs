'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { GripVertical, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 可拖拽的分类卡片组件
 */
function SortableItem({
  category
}) {
  const pbnT = usePbnTranslations();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: category.id
  });

  // 手动构建 transform 样式，替代 @dnd-kit/utilities 的 CSS.Transform
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition
  };
  return <div ref={setNodeRef} style={style} className={cn('flex items-center gap-3 p-4 bg-card border border-border rounded-lg', 'transition-shadow', isDragging && 'shadow-lg opacity-90 z-50')}>
      {/* 拖拽手柄 */}
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none" aria-label={pbnT("m225")}>
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* 分类颜色标识 */}
      <div className="w-4 h-4 rounded shrink-0" style={{
      backgroundColor: category.color || '#3B82F6'
    }} />


      {/* 分类名称和私有标识 */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="font-medium truncate">{category.name}</span>
        {category.isPrivate && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" title={pbnT("m223")} />}
      </div>

      {/* 话题数 */}
      <span className="text-sm text-muted-foreground shrink-0">
        {category.topicCount || 0}{" "}{pbnT("m68")}</span>

      {/* 当前排序位置 */}
      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded shrink-0">
        #{category.position ?? '-'}
      </span>
    </div>;
}

/**
 * 精选分类可拖拽排序组件
 * @param {Object} props
 * @param {Array} props.categories - 精选分类列表（已按 position 排序）
 * @param {Function} props.onReorder - 排序完成回调，参数为新排序后的分类 ID 数组
 * @param {boolean} props.loading - 是否正在保存
 */
export default function FeaturedCategorySortable({
  categories,
  onReorder,
  loading = false
}) {
  const pbnT = usePbnTranslations();
  const [items, setItems] = useState(categories);

  // 使用 useEffect 同步外部 categories 变化，避免在渲染期间调用 setState
  useEffect(() => {
    setItems(categories);
  }, [categories]);

  // 配置传感器：支持鼠标/触摸拖拽和键盘操作
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8 // 拖拽触发距离，避免误触
    }
  }), useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  }));

  // 处理拖拽结束
  const handleDragEnd = event => {
    const {
      active,
      over
    } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);

      // 先更新本地状态
      setItems(newItems);

      // 使用 setTimeout 延迟调用回调，避免在渲染期间触发父组件 setState
      setTimeout(() => {
        const newOrder = newItems.map(item => item.id);
        onReorder?.(newOrder);
      }, 0);
    }
  };
  if (categories.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">
        <p>{pbnT("m226")}</p>
        <p className="text-sm mt-2">{pbnT("m227")}</p>
      </div>;
  }
  return <div className="space-y-4">
      {/* 提示信息 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>{pbnT("m228")}</p>
        {loading && <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{pbnT("m229")}</span>
          </div>}
      </div>

      {/* 可拖拽列表 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(category => <SortableItem key={category.id} category={category} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>;
}
