'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { uploadApi } from '@/lib/api';
import { formatFileSize } from '@/utils/format';
import { getAttachmentIcon } from '@/utils/attachment';
import PolicyFields from './PolicyFields';
const EMPTY_POLICY = {
  policy: 'none',
  pointsCost: 0,
  allowedRoleIds: []
};

// 并发上传上限，与图片上传的滑动窗口保持一致
const MAX_CONCURRENCY = 3;

// 单个附件组的文件数上限，须与后端 MAX_FILES_PER_ATTACHMENT 一致
// （apps/api/src/modules/forum/services/attachmentService.js）
const MAX_FILES = 20;

/**
 * 取后端错误里可读的那一条。
 * 自定义错误是 { error: '中文说明' }；Fastify 的 schema 校验错误则是
 * { error: 'Bad Request', message: 'body/fileIds must NOT have more than 20 items' }，
 * 后者的 error 只是 HTTP 状态短语，直接弹出来用户完全不知道要改什么。
 */
function pickErrorText(data, fallback) {
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  return fallback;
}

/**
 * 「上传」Tab：上传一个或多个文件 → 登记为**一个**附件组；
 * editingDraft 存在时改为编辑该组的元信息与策略。
 *
 * 一个附件组在正文里对应一条 ::attachment{id="N"}，组内文件共用同一套下载策略。
 * 需要不同策略就分多次插入。
 *
 * 上传与登记刻意分两步（对齐 /api/upload 的既有能力）：
 * 文件先逐个落 files 表，再由 POST /api/attachments 一次性登记成组，
 * 这样直传（预签名）场景也无需改动上传链路。
 *
 * @param {object} props
 * @param {object|null} props.editingDraft
 * @param {(attachmentId:number, wasEditing:boolean)=>void} props.onSubmitted
 * @param {()=>void} props.onCancelEdit
 */
export default function UploadTab({
  editingDraft,
  onSubmitted,
  onCancelEdit
}) {
  const pbnT = usePbnTranslations();
  const [uploadedFiles, setUploadedFiles] = useState([]); // [{ id, originalName, size, mimetype }]
  const [uploadingCount, setUploadingCount] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [policyValue, setPolicyValue] = useState(EMPTY_POLICY);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const isEditing = !!editingDraft;
  const uploading = uploadingCount > 0;

  // 进入/退出编辑态时同步表单
  useEffect(() => {
    if (editingDraft) {
      // 回填用户填过的标题；没填过就留空，让服务端继续按文件数/文件名兜底
      setTitle(editingDraft.customTitle || '');
      setDescription(editingDraft.description || '');
      setPolicyValue({
        policy: editingDraft.policy || 'none',
        pointsCost: editingDraft.pointsCost || 0,
        allowedRoleIds: editingDraft.allowedRoleIds || []
      });
      setUploadedFiles([]);
    } else {
      resetForm();
    }
  }, [editingDraft]);
  const resetForm = () => {
    setUploadedFiles([]);
    setTitle('');
    setDescription('');
    setPolicyValue(EMPTY_POLICY);
    if (inputRef.current) inputRef.current.value = '';
  };
  const handleFileChange = async e => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    // input 立刻清空，这样连续两次选同一个文件也能触发 change
    if (inputRef.current) inputRef.current.value = '';

    // 超出上限的部分不能传：传上去也会被 POST /api/attachments 的 schema 拒掉，
    // 结果是整批白传、占着存储等孤儿回收，用户还只看到一句校验错误。
    // 算上 uploadingCount，避免上传途中再选一批把总数顶超
    const room = MAX_FILES - uploadedFiles.length - uploadingCount;
    if (room <= 0) {
      toast.error(pbnT("m2220", {
        arg0: MAX_FILES
      }));
      return;
    }
    const accepted = picked.slice(0, room);
    if (accepted.length < picked.length) {
      toast.error(pbnT("m2221", {
        arg0: MAX_FILES,
        arg1: picked.length - accepted.length
      }));
    }
    setUploadingCount(n => n + accepted.length);

    // 滑动窗口并发：完成一个补一个，避免大批量时一次性打满
    const queue = [...accepted];
    const worker = async () => {
      while (queue.length > 0) {
        const file = queue.shift();
        if (!file) break;
        try {
          const res = await uploadApi(pbnT).upload(file, 'attachments');
          setUploadedFiles(prev => [...prev, res]);
        } catch (err) {
          toast.error(`${file.name}：${err.message || pbnT("m2198")}`);
        } finally {
          setUploadingCount(n => Math.max(0, n - 1));
        }
      }
    };
    await Promise.all(Array.from({
      length: Math.min(accepted.length, MAX_CONCURRENCY)
    }, worker));
  };

  // 移除必须同步删服务端：文件已落 files 表与存储，只从 state 里摘掉的话
  // 它既进不了任何附件组、又因 /uploads/attachments/ 被拦截而不可达，纯占空间
  const removeFile = async fileId => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    try {
      const res = await fetch(`/api/attachments/files/${fileId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || pbnT("m2222"));
      }
    } catch {
      toast.error(pbnT("m2222"));
    }
  };
  const validate = () => {
    if (!isEditing && uploadedFiles.length === 0) {
      toast.error(pbnT("m2223"));
      return false;
    }
    if (policyValue.policy === 'points' && !(policyValue.pointsCost > 0)) {
      toast.error(pbnT("m2224"));
      return false;
    }
    if (policyValue.policy === 'role' && policyValue.allowedRoleIds.length === 0) {
      toast.error(pbnT("m2225"));
      return false;
    }
    return true;
  };

  /** 组级元信息 + 策略的公共字段 */
  const buildBody = () => ({
    title: title.trim() || null,
    description: description.trim() || null,
    policy: policyValue.policy,
    pointsCost: policyValue.policy === 'points' ? policyValue.pointsCost : 0,
    allowedRoleIds: policyValue.policy === 'role' ? policyValue.allowedRoleIds : null
  });
  const handleSaveEdit = async () => {
    const res = await fetch(`/api/attachments/${editingDraft.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildBody())
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(pickErrorText(data, pbnT("m495")));
      return;
    }
    toast.success(pbnT("m2226"));
    onSubmitted?.(editingDraft.id, true);
  };
  const handleCreate = async () => {
    // 一次请求把整批文件登记成一个附件组
    const res = await fetch('/api/attachments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...buildBody(),
        fileIds: uploadedFiles.map(f => f.id)
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(pickErrorText(data, pbnT("m2227")));
      return;
    }
    onSubmitted?.(data.id, false);
    resetForm();
  };
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isEditing) {
        await handleSaveEdit();
      } else {
        await handleCreate();
      }
    } catch {
      toast.error(pbnT("m1362"));
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="pt-4 space-y-4">
      {!isEditing && <div className="space-y-1.5">
          <Label className="text-sm">{pbnT("m2228")}</Label>

          {uploadedFiles.length > 0 && <div className="space-y-1.5">
              {uploadedFiles.map(f => {
          const FileIcon = getAttachmentIcon(f.mimetype, f.originalName);
          return <div key={f.id} className="flex items-center gap-2 border border-border rounded-lg p-2.5">
                    <FileIcon className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{f.originalName}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(f.size)}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(f.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>;
        })}
            </div>}

          <Button type="button" variant="outline" className={uploadedFiles.length > 0 ? 'w-full border-dashed' : 'w-full h-20 border-dashed'} onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <>
                <Loader2 className="h-4 w-4 animate-spin" />{pbnT("m2229")}{uploadingCount}{pbnT("m2230")}</> : <>
                <Upload className="h-4 w-4" />
                {uploadedFiles.length > 0 ? pbnT("m2231") : pbnT("m2232")}
              </>}
          </Button>

          <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          <p className="text-xs text-muted-foreground">{pbnT("m2233")}{" "}{uploadedFiles.length > 1 && pbnT("m2234")}
          </p>
        </div>}

      {isEditing && <div className="border border-border rounded-lg p-3 space-y-1">
          <div className="text-sm">
            {editingDraft.fileCount}{" "}{pbnT("m2235")}{formatFileSize(editingDraft.totalSize)}
          </div>
          <div className="text-xs text-muted-foreground">{pbnT("m2236")}</div>
        </div>}

      <div className="space-y-1.5">
        <Label className="text-sm">{pbnT("m2237")}</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={uploadedFiles.length > 1 || editingDraft?.fileCount > 1 ? pbnT("m2238") : pbnT("m2239")} maxLength={255} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">{pbnT("m2240")}</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={pbnT("m2241")} rows={2} maxLength={2000} />
      </div>

      <PolicyFields value={policyValue} onChange={setPolicyValue} disabled={submitting} />

      <div className="flex justify-end gap-2 pt-2">
        {isEditing && <Button type="button" variant="outline" onClick={onCancelEdit}>{pbnT("m2242")}</Button>}
        <Button type="button" onClick={handleSubmit} disabled={submitting || uploading}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? pbnT("m2243") : uploadedFiles.length > 1 ? pbnT("m2244", {
          arg0: uploadedFiles.length
        }) : pbnT("m1315")}
        </Button>
      </div>
    </div>;
}
