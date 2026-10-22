'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/common/FormDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Lock, Flag, Edit, MoreHorizontal, Bell, Bookmark, Loader2, Pin, Trash2 } from 'lucide-react';
import ReportDialog from '@/components/common/ReportDialog';
import TopicForm from '@/modules/forum/components/topic/TopicForm';
import { useTopicActions } from '@/modules/forum/hooks/topic/useTopicActions';
import { confirm } from '@/components/common/ConfirmPopover';

/**
 * 话题操作按钮组件（侧边栏样式）
 * 包含订阅/收藏按钮 + 更多操作菜单（编辑/置顶/关闭/删除/举报）
 */
export default function TopicActions() {
  const pbnT = usePbnTranslations();
  const {
    topic,
    isAuthenticated,
    actionLoading,
    isEditDialogOpen,
    setIsEditDialogOpen,
    editLoading,
    handleEditTopic,
    reportDialogOpen,
    setReportDialogOpen,
    canPin,
    canClose,
    canEdit,
    canDelete,
    toggleBookmark,
    toggleSubscribe,
    toggleTopicStatus,
    togglePinTopic,
    deleteTopic
  } = useTopicActions();
  return <>
      <div className='flex gap-2'>
        <Button variant='outline' size='sm' className={`flex-1 ${topic.isSubscribed ? 'bg-primary/10 border-primary text-primary' : ''}`} onClick={toggleSubscribe} disabled={actionLoading.subscribe || !isAuthenticated} title={topic.isSubscribed ? pbnT("m98") : pbnT("m99")}>
          {actionLoading.subscribe ? <Loader2 className='h-4 w-4 animate-spin' /> : <Bell className={`h-4 w-4 ${topic.isSubscribed ? 'fill-current' : ''}`} />}
          <span className='text-xs'>{topic.isSubscribed ? pbnT("m100") : pbnT("m101")}</span>
        </Button>

        <Button variant='outline' size='sm' className={`flex-1 ${topic.isBookmarked ? 'text-yellow-600' : ''}`} onClick={toggleBookmark} disabled={actionLoading.bookmark || !isAuthenticated} title={topic.isBookmarked ? pbnT("m102") : pbnT("m103")}>
          {actionLoading.bookmark ? <Loader2 className='h-4 w-4 animate-spin' /> : <Bookmark className={`h-4 w-4 ${topic.isBookmarked ? 'fill-current' : ''}`} />}
          <span className='text-xs'>{topic.isBookmarked ? pbnT("m102") : pbnT("m104")}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm' className='flex-1' disabled={!isAuthenticated}>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-48'>
            {canEdit && <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <Edit className='h-4 w-4' />{pbnT("m105")}</DropdownMenuItem>}
            {canPin && <DropdownMenuItem onClick={togglePinTopic}>
                <Pin className={`h-4 w-4 ${topic.adminPinned ? 'fill-current' : ''}`} />
                {topic.adminPinned ? pbnT("m106") : pbnT("m107")}
              </DropdownMenuItem>}
            {canClose && <DropdownMenuItem onClick={toggleTopicStatus}>
                <Lock className='h-4 w-4' />
                {topic.isClosed ? pbnT("m92") : pbnT("m93")}
              </DropdownMenuItem>}
            {canDelete && <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className='text-destructive focus:text-destructive' onClick={async e => {
              const confirmed = await confirm(e, {
                title: pbnT("m108"),
                description: pbnT("m109"),
                confirmText: pbnT("m110"),
                variant: 'destructive'
              });
              if (confirmed) {
                deleteTopic();
              }
            }}>
                  <Trash2 className='h-4 w-4' />{pbnT("m111")}</DropdownMenuItem>
              </>}
            {(canEdit || canPin || canClose || canDelete) && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setReportDialogOpen(true)}>
              <Flag className='h-4 w-4' />{pbnT("m112")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 编辑话题对话框 */}
      <FormDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} title={pbnT("m105")} description={pbnT("m113")} maxWidth="sm:max-w-[95vw] lg:max-w-7xl" footer={null}>
          <TopicForm initialData={{
        id: topic.id,
        title: topic.title,
        content: topic.content,
        categoryId: topic.categoryId,
        tags: topic.tags?.map(tag => tag.name) || []
      }} onSubmit={handleEditTopic} onCancel={() => setIsEditDialogOpen(false)} isSubmitting={editLoading} submitButtonText={pbnT("m114")} isEditMode={true} stickyTop='lg:top-4' />
      </FormDialog>

      {/* 举报对话框 */}
      <ReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} reportType='topic' targetId={topic.id} targetTitle={topic.title} />
    </>;
}
