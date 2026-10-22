'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import { topicApi } from '@/lib/api';
import { toast } from 'sonner';
import TopicForm from '@/modules/forum/components/topic/TopicForm';
import RequireAuth from '@/components/auth/RequireAuth';
export default function CreateTopicContent() {
  const pbnT = usePbnTranslations();
  const router = useRouter();
  const params=useSearchParams();const categoryId=Number(params.get('categoryId'));
  const initialData=Number.isSafeInteger(categoryId)&&categoryId>0?{categoryId}:{};
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async formData => {
    setSubmitting(true);
    try {
      const response = await topicApi.create({
        title: formData.title,
        content: formData.content,
        categoryId: formData.categoryId,
        tags: formData.tags
      });
      if (response.requiresApproval) {
        toast.success(response.message || pbnT("m48"));
        router.push('/profile/topics');
      } else {
        toast.success(response.message || pbnT("m49"));
        router.push(`/topic/${response.topic?.id}`);
      }
    } catch (err) {
      console.error("Could not publish topic:", err);
      toast.error(err.message || pbnT("m51"));
    } finally {
      setSubmitting(false);
    }
  };
  const handleCancel = () => {
    router.push('/');
  };
  return <RequireAuth>
      <div className='container mx-auto px-4 py-6'>
        {/* 页面标题 */}
        <div className='mb-4'>
          <h1 className='text-2xl font-semibold mb-2'>{pbnT("m52")}</h1>
          <p className='text-sm text-muted-foreground'>{pbnT("m53")}</p>
        </div>

        <TopicForm initialData={initialData} onSubmit={handleSubmit} onCancel={handleCancel} isSubmitting={submitting} submitButtonText={pbnT("m54")} />
      </div>
    </RequireAuth>;
}
