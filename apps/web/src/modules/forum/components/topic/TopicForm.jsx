'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CategorySelector from '@/modules/forum/components/topic/CategorySelector';
import TagSelect from '@/modules/forum/components/topic/TagSelect';
import { AlertCircle, Loader2, Folder, Tag, Info, Send } from 'lucide-react';
import { useTopicForm } from '@/modules/forum/hooks/topic/useTopicForm';
import { usePermission } from '@/hooks/usePermission';
const MarkdownEditor = dynamic(() => import('@/components/common/MarkdownEditor'), {
  ssr: false
});

// 话题编辑器工具栏（比默认多一个"回复可见"按钮）
const TOPIC_TOOLBAR = ['heading', '|', 'bold', 'italic', 'strike', '|', 'code', 'quote', 'codeBlock', '|', 'bulletList', 'orderedList', 'checklist', '|', 'horizontalRule', '|', 'link', 'image', 'video', 'audio', 'table', 'protected', 'poll', 'lottery', 'attachment', 'emoji'];

/**
 * 话题表单组件 - 用于创建和编辑话题
 * 纯 UI 组件，消费 useTopicForm Hook
 */
export default function TopicForm(pbnArgument0) {
  const pbnT = usePbnTranslations();
  const {
    initialData = {},
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitButtonText = pbnT("m54"),
    isEditMode = false,
    stickyTop = 'lg:top-20'
  } = pbnArgument0;
  // 使用 Hook 管理表单逻辑
  const {
    formData,
    errors,
    handleSubmit,
    updateField,
    isFormValid
  } = useTopicForm({
    initialData,
    onSubmit
  });

  // 权限检查
  const {
    hasPermission
  } = usePermission();
  const canUseTags = hasPermission('tag.read');
  const canCreateTag = hasPermission('tag.create');
  const canUpload = hasPermission('upload.topics');
  return <form onSubmit={handleSubmit}>
      <div className='flex flex-col lg:flex-row gap-6'>
        {/* 主内容区 */}
        <div className='flex-1 space-y-4'>
          {/* 标题输入 */}
          <div className='space-y-2'>
            <label htmlFor='title' className='block text-sm font-semibold'>{pbnT("m830")}</label>
            <Input id='title' type='text' value={formData.title} onChange={e => updateField('title', e.target.value)} className='text-base' placeholder={pbnT("m2341")} maxLength={100} aria-invalid={!!errors.title} autoFocus={!isEditMode} />
            {errors.title && <p className='text-sm text-destructive flex items-center gap-1'>
                <AlertCircle className='h-3 w-3' />
                <span>{errors.title}</span>
              </p>}
          </div>

          {/* 内容输入 */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <label htmlFor='content' className='text-sm font-semibold'>{pbnT("m353")}</label>
            </div>

            <MarkdownEditor value={formData.content} onChange={value => updateField('content', value)} placeholder={pbnT("m2342")} className={errors.content ? 'border-destructive' : ''} toolbar={TOPIC_TOOLBAR} uploadType="topics" topicId={isEditMode ? initialData?.id : undefined} />

            {errors.content && <p className='text-sm text-destructive flex items-center gap-1'>
                <AlertCircle className='h-3 w-3' />
                <span>{errors.content}</span>
              </p>}
            <p className='text-xs text-muted-foreground'>{pbnT("m2343")}{" "}{canUpload ? pbnT("m2344") : ''}
            </p>
          </div>
        </div>

        {/* 右侧边栏 */}
        <div className='w-full lg:w-80 shrink-0'>
          <aside className={`lg:sticky ${stickyTop} flex flex-col gap-6`}>
            {/* 分类与标签分组区块 */}
            <div className='flex flex-col gap-4 p-5 card-base'>
              {/* 分类选择 */}
              <div className='space-y-3'>
                <div className='flex items-center gap-2 text-sm font-medium text-foreground/80'>
                  <Folder className='w-4 h-4 text-primary/70' />
                  <h3>{pbnT("m44")}</h3>
                </div>
                <CategorySelector value={formData.categoryId} onChange={value => updateField('categoryId', value)} placeholder={pbnT("m2345")} featuredFirst className='w-full' />
                {errors.category && <p className='text-xs text-destructive flex items-center gap-1'>
                    <AlertCircle className='h-3 w-3' />
                    <span>{errors.category}</span>
                  </p>}
              </div>

              {/* 分割线 */}
              {canUseTags && <div className='h-px w-full bg-border/50' />}

              {/* 标签 */}
              {canUseTags && <div className='space-y-3'>
                  <div className='flex items-center justify-between text-sm font-medium text-foreground/80'>
                    <div className='flex items-center gap-2'>
                      <Tag className='w-4 h-4 text-primary/70' />
                      <h3>{pbnT("m824")}</h3>
                    </div>
                    <span className='text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full'>
                      {formData.tags.length}/5
                    </span>
                  </div>
                  <TagSelect value={formData.tags} onChange={tags => updateField('tags', tags)} maxTags={5} canCreateTag={canCreateTag} />
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    {canCreateTag ? pbnT("m2346") : pbnT("m2347")}
                  </p>
                </div>}
            </div>

            {/* 提交按钮区域 */}
            <div className='flex flex-col items-center gap-4 pt-2'>
              <Button type='submit' size='lg' className='w-full' disabled={!isFormValid || isSubmitting}>
                {isSubmitting ? <>
                    <Loader2 className='h-5 w-5 animate-spin mr-2' />
                    {isEditMode ? pbnT("m229") : pbnT("m2348")}
                  </> : <>
                    <Send className='h-4 w-4 mr-2' />
                    <span className='font-semibold'>{submitButtonText}</span>
                  </>}
              </Button>
              <Button type='button' variant='link' className='text-xs text-muted-foreground hover:text-destructive h-auto p-0 inline-block mt-1' disabled={isSubmitting} onClick={onCancel}>{pbnT("m486")}{" "}{isEditMode ? pbnT("m235") : pbnT("m2349")}
              </Button>
            </div>

            {/* 提示区块 */}
            <div className='p-5 rounded-lg border border-primary/10 bg-primary/5'>
              <div className='flex items-center gap-2 mb-3 text-sm font-medium text-primary'>
                <Info className='w-4 h-4' />
                <h3>{isEditMode ? pbnT("m2350") : pbnT("m2351")}</h3>
              </div>
              <ul className='space-y-2.5 text-xs text-muted-foreground/90'>
                <li className='flex items-start gap-2'>
                  <span className='w-1 h-1 rounded-full bg-primary/50 mt-1.5 shrink-0' />
                  <span>{pbnT("m2352")}</span>
                </li>
                <li className='flex items-start gap-2'>
                  <span className='w-1 h-1 rounded-full bg-primary/50 mt-1.5 shrink-0' />
                  <span>{pbnT("m2353")}</span>
                </li>
                <li className='flex items-start gap-2'>
                  <span className='w-1 h-1 rounded-full bg-primary/50 mt-1.5 shrink-0' />
                  <span>{pbnT("m2354")}</span>
                </li>
                <li className='flex items-start gap-2'>
                  <span className='w-1 h-1 rounded-full bg-primary/50 mt-1.5 shrink-0' />
                  <span>{pbnT("m2355")}</span>
                </li>
                {canUpload && <li className='flex items-start gap-2'>
                    <span className='w-1 h-1 rounded-full bg-primary/50 mt-1.5 shrink-0' />
                    <span>{pbnT("m2356")}</span>
                  </li>}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </form>;
}
