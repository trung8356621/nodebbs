'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Loader2, Upload, LayoutGrid } from 'lucide-react';
import { emojiApi } from '@/lib/api';
import { toast } from 'sonner';
import EmojiListSortable from '../../components/EmojiListSortable';
import EmojiUpload from '../../components/EmojiUpload';
import { cn } from '@/lib/utils';
export default function EmojiDetailPage() {
  const pbnT = usePbnTranslations();
  const params = useParams();
  const router = useRouter();
  const groupId = parseInt(params.id);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reordering, setReordering] = useState(false);
  const fetchGroupData = useCallback(async () => {
    try {
      const data = await emojiApi.admin.getGroup(groupId);
      setGroup(data);
    } catch (err) {
      console.error("Could not load data:", err);
      if (err.message?.includes(pbnT("m1778"))) {
        toast.error(pbnT("m1779"));
        router.push('/dashboard/emojis');
      } else {
        toast.error(err.message || pbnT("m519"));
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);
  useEffect(() => {
    if (!isNaN(groupId)) {
      fetchGroupData();
    }
  }, [groupId, fetchGroupData]);

  // 手动刷新
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGroupData();
    setRefreshing(false);
  };

  // 删除表情（本地乐观更新）
  const handleDelete = async emoji => {
    try {
      await emojiApi.admin.deleteEmoji(emoji.id);
      toast.success(pbnT("m1780"));
      setGroup(prev => ({
        ...prev,
        emojis: prev.emojis.filter(e => e.id !== emoji.id)
      }));
    } catch (err) {
      toast.error(err.message || pbnT("m249"));
    }
  };

  // 拖拽排序（乐观更新，失败时回滚）
  const handleReorder = async newOrder => {
    const newEmojis = newOrder.map(id => group.emojis.find(e => e.id === id)).filter(Boolean);
    setGroup(prev => ({
      ...prev,
      emojis: newEmojis
    }));
    setReordering(true);
    try {
      const items = newOrder.map((id, index) => ({
        id,
        groupId,
        order: index
      }));
      await emojiApi.admin.batchReorder(items);
      toast.success(pbnT("m1781"));
    } catch (err) {
      toast.error(err.message || pbnT("m1782"));
      fetchGroupData();
    } finally {
      setReordering(false);
    }
  };

  // 初始加载
  if (loading) {
    return <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>;
  }
  if (!group) return null;
  return <div className="space-y-6">
      {/* 页头：返回、分组信息、刷新 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          <p className="text-muted-foreground">
            {group.emojis?.length || 0}{" "}{pbnT("m1783")}{group.slug}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />{pbnT("m1784")}</Button>
      </div>

      <div className="flex flex-col gap-8">
        {/* 上传区域 */}
        <div className="">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5" />{pbnT("m1785")}</h3>
          <EmojiUpload groupId={groupId} onUploadSuccess={fetchGroupData} />
        </div>

        {/* 表情列表 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />{pbnT("m1786")}<span className="text-sm font-normal text-muted-foreground ml-2">{pbnT("m1787")}{" "}{group.emojis?.length || 0}{" "}{pbnT("m1788")}</span>
            </h3>
            {reordering && <span className="text-sm text-muted-foreground animate-pulse">{pbnT("m1789")}</span>}
          </div>

          <div className="bg-muted/30 border rounded-lg p-6 min-h-50">
            <EmojiListSortable emojis={group.emojis || []} onReorder={handleReorder} onDelete={handleDelete} />
          </div>
        </div>
      </div>
    </div>;
}
