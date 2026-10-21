'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { PageHeader } from '@/components/common/PageHeader';
import UserAvatar from '@/components/user/UserAvatar';
import { confirm } from '@/components/common/ConfirmPopover';
import ImagePreview from '@/components/common/ImagePreview';
import { Trash2, ExternalLink, Download, Eye, Image, FileText, Film, Music, HardDrive, Cloud } from 'lucide-react';
import { filesApi } from '@/lib/api';
import { toast } from 'sonner';
import Time from '@/components/common/Time';
import { usePermission } from '@/hooks/usePermission';
import { getImageUrl } from '@/utils/image';

// 文件大小格式化
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 根据 MIME 类型获取图标
function getFileIcon(mimetype) {
  if (mimetype?.startsWith('image/')) return Image;
  if (mimetype?.startsWith('video/')) return Film;
  if (mimetype?.startsWith('audio/')) return Music;
  return FileText;
}

// 分类标签颜色
const categoryColors = {
  avatars: 'bg-blue-100 text-blue-800',
  topics: 'bg-green-100 text-green-800',
  attachments: 'bg-teal-100 text-teal-800',
  assets: 'bg-gray-100 text-gray-800',
  badges: 'bg-yellow-100 text-yellow-800',
  items: 'bg-purple-100 text-purple-800',
  frames: 'bg-pink-100 text-pink-800',
  emojis: 'bg-orange-100 text-orange-800'
};

// 话题附件不走公开的 /uploads 路径（受下载策略保护），后台只能经鉴权路由取内容
function isPrivateFile(file) {
  return file.category === 'attachments';
}

// 可内联预览的 MIME 白名单，必须与后端 routes/files/index.js 的 INLINE_SAFE_MIMES 一致。
// 不含 image/svg+xml：SVG 可携带脚本，后端不会内联下发，前端也就不该渲染 <img>。
const INLINE_PREVIEWABLE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'];
function canPreviewInline(file) {
  return INLINE_PREVIEWABLE_MIMES.includes(file.mimetype);
}

/**
 * 取文件的可访问地址
 * @param {object} file
 * @param {{ download?: boolean, modifiers?: string }} options
 *        modifiers 仅对公开文件有效（IPX 只处理 /uploads 下的公开路径）
 */
function getFileAccessUrl(file, {
  download = false,
  modifiers = ''
} = {}) {
  // 公开文件的直链没有 Content-Disposition，浏览器只会内联打开，
  // 与「查看」毫无区别。要真正触发下载就得走后台 raw 路由（它会带 attachment 头）
  if (download) {
    return `/api/files/${file.id}/raw?disposition=attachment`;
  }
  if (isPrivateFile(file)) {
    return `/api/files/${file.id}/raw`;
  }
  return modifiers ? getImageUrl(file.url, modifiers) : file.url;
}
export default function FilesManagement() {
  const pbnT = usePbnTranslations();
  const {
    hasPermission
  } = usePermission();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const limit = 20;
  useEffect(() => {
    if (page === 1) {
      fetchFiles();
    } else {
      setPage(1);
    }
  }, [debouncedSearch, categoryFilter]);
  useEffect(() => {
    fetchFiles();
  }, [page]);
  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      const data = await filesApi.getList(params);
      setFiles(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error("Could not load files:", err);
      toast.error(pbnT("m241"));
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteClick = async (e, file) => {
    const confirmed = await confirm(e, {
      title: pbnT("m242"),
      description: <>{pbnT("m243")}{file.originalName || file.filename}{pbnT("m244")}<br />
          <span className="text-destructive">{pbnT("m245")}</span>
        </>,
      confirmText: pbnT("m246"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await filesApi.delete(file.id);
      toast.success(pbnT("m247"));
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setTotal(prev => prev - 1);
    } catch (err) {
      console.error("Could not delete:", err);
      toast.error(err.message || pbnT("m249"));
    } finally {
      setSubmitting(false);
    }
  };
  const columns = [{
    key: 'preview',
    label: pbnT("m250"),
    width: 'w-20',
    render: (_, file) => {
      // 私有附件：不铺缩略图。拿不到 IPX 缩图只能铺原图，既费带宽，
      // 又会在后端拒绝内联的类型（如 SVG）上渲出一个永远加载不出来的 <img>。
      // 改为按类型给动作按钮。
      if (isPrivateFile(file)) {
        const Icon = getFileIcon(file.mimetype);
        return <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded border flex items-center justify-center bg-muted shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              {canPreviewInline(file) ? <Button variant="outline" size="sm" onClick={() => {
            setPreviewUrl(getFileAccessUrl(file));
            setPreviewOpen(true);
          }}>
                  <Eye className="w-3.5 h-3.5" />{pbnT("m250")}</Button> : <Button variant="outline" size="sm" onClick={() => window.open(getFileAccessUrl(file, {
            download: true
          }), '_blank')}>
                  <Download className="w-3.5 h-3.5" />{pbnT("m251")}</Button>}
            </div>;
      }
      const isImage = file.mimetype?.startsWith('image/');
      if (isImage) {
        const fullUrl = getFileAccessUrl(file);
        return <div className="w-24 h-24 rounded border overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity" onClick={() => {
          setPreviewUrl(fullUrl);
          setPreviewOpen(true);
        }}>
              <img src={getFileAccessUrl(file, {
            modifiers: 'embed,f_webp,s_200x200'
          })} alt={file.originalName || file.filename} className="w-full h-full object-cover" loading="lazy" />
            </div>;
      }
      const Icon = getFileIcon(file.mimetype);
      return <div className="w-12 h-12 rounded border flex items-center justify-center bg-muted">
            <Icon className="w-6 h-6 text-muted-foreground" />
          </div>;
    }
  }, {
    key: 'filename',
    label: pbnT("m252"),
    render: (_, file) => <div className="max-w-50">
          <div className="font-medium text-sm truncate" title={file.originalName || file.filename}>
            {file.originalName || file.filename}
          </div>
          {file.width && file.height && <div className="text-xs text-muted-foreground">
              {file.width} × {file.height}
            </div>}
        </div>
  }, {
    key: 'category',
    label: pbnT("m44"),
    width: 'w-25',
    render: value => <Badge variant="secondary" className={categoryColors[value] || ''}>
          {value}
        </Badge>
  }, {
    key: 'size',
    label: pbnT("m253"),
    width: 'w-25',
    render: value => <span className="text-sm text-muted-foreground">
          {formatFileSize(value)}
        </span>
  }, {
    key: 'provider',
    label: pbnT("m254"),
    width: 'w-25',
    render: value => {
      const provider = value || 'local';
      const isLocal = provider === 'local';
      const Icon = isLocal ? HardDrive : Cloud;
      return <Badge variant="outline" className={`gap-1 ${isLocal ? 'border-slate-300 text-slate-600' : 'border-sky-300 text-sky-700'}`}>
            <Icon className="w-3 h-3" />
            {provider}
          </Badge>;
    }
  }, {
    key: 'user',
    label: pbnT("m255"),
    width: 'w-[150px]',
    render: user => user ? <div className="flex items-center gap-2">
          <UserAvatar url={user.avatar} name={user.name || user.username} size="xs" />
          <span className="text-sm">{user.username}</span>
        </div> : <span className="text-sm text-muted-foreground">-</span>
  }, {
    key: 'createdAt',
    label: pbnT("m256"),
    width: 'w-30',
    render: value => <span className="text-xs text-muted-foreground">
          <Time date={value} />
        </span>
  }, {
    key: 'actions',
    label: pbnT("m234"),
    align: 'right',
    sticky: 'right',
    render: (_, file) => <ActionMenu items={[{
      label: pbnT("m257"),
      icon: ExternalLink,
      onClick: () => window.open(getFileAccessUrl(file), '_blank'),
      // 私有附件里后端拒绝内联的类型（SVG/压缩包/文档等），新开页只会触发下载，
      // 再给一个「查看」是误导，直接隐藏
      hidden: isPrivateFile(file) && !canPreviewInline(file)
    }, {
      label: pbnT("m251"),
      icon: Download,
      onClick: () => window.open(getFileAccessUrl(file, {
        download: true
      }), '_blank')
    }, {
      separator: true
    }, {
      label: pbnT("m110"),
      icon: Trash2,
      variant: 'destructive',
      onClick: e => handleDeleteClick(e, file),
      hidden: !hasPermission('dashboard.files')
    }]} />
  }];
  return <div className="space-y-6">
      <PageHeader title={pbnT("m258")} description={pbnT("m259")} />

      <DataTable columns={columns} data={files} loading={loading} search={{
      value: search,
      onChange: value => setSearch(value),
      placeholder: pbnT("m260")
    }} filter={{
      value: categoryFilter,
      onChange: setCategoryFilter,
      options: [{
        value: 'all',
        label: pbnT("m238")
      }, {
        value: 'avatars',
        label: pbnT("m261")
      }, {
        value: 'topics',
        label: pbnT("m68")
      }, {
        value: 'attachments',
        label: pbnT("m262")
      }, {
        value: 'assets',
        label: pbnT("m263")
      }, {
        value: 'badges',
        label: pbnT("m264")
      }, {
        value: 'items',
        label: pbnT("m265")
      }, {
        value: 'frames',
        label: pbnT("m266")
      }, {
        value: 'emojis',
        label: pbnT("m267")
      }]
    }} pagination={{
      page,
      total,
      limit,
      onPageChange: setPage
    }} emptyMessage={pbnT("m268")} />

      <ImagePreview open={previewOpen} onOpenChange={setPreviewOpen} images={[previewUrl]} />
    </div>;
}
