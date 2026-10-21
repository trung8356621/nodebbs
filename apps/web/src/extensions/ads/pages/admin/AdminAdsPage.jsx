'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { useState, useEffect } from 'react';
import { confirm } from '@/components/common/ConfirmPopover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/common/DatePicker';
import { DataTable } from '@/components/common/DataTable';
import { ActionMenu } from '@/components/common/ActionMenu';
import { FormDialog } from '@/components/common/FormDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { Pager } from '@/components/common/Pagination';
import { Plus, Edit, Trash2, LayoutGrid, Image, Code, FileCode, Eye, MousePointer } from 'lucide-react';
import { adsApi } from '@/lib/api';
import { toast } from 'sonner';

// 广告类型配置
const AD_TYPES = (pbnT = pbnRuntimeT) => ({
  image: {
    label: pbnT("m1573"),
    icon: Image,
    color: 'bg-blue-100 text-blue-800'
  },
  html: {
    label: pbnT("m1574"),
    icon: Code,
    color: 'bg-green-100 text-green-800'
  },
  script: {
    label: pbnT("m1575"),
    icon: FileCode,
    color: 'bg-purple-100 text-purple-800'
  }
});
export default function AdminAdsPage() {
  const pbnT = usePbnTranslations();
  const [activeTab, setActiveTab] = useState('ads');

  // 广告位状态
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [slotDialogMode, setSlotDialogMode] = useState('create');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotSubmitting, setSlotSubmitting] = useState(false);
  const [slotFormData, setSlotFormData] = useState({
    name: '',
    code: '',
    description: '',
    width: '',
    height: '',
    maxAds: 1,
    isActive: true
  });

  // 广告状态
  const [ads, setAds] = useState([]);
  const [adsTotal, setAdsTotal] = useState(0);
  const [adsLoading, setAdsLoading] = useState(true);
  const [adsPage, setAdsPage] = useState(1);
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [adDialogMode, setAdDialogMode] = useState('create');
  const [selectedAd, setSelectedAd] = useState(null);
  const [adSubmitting, setAdSubmitting] = useState(false);
  const [adFormData, setAdFormData] = useState({
    slotId: '',
    title: '',
    type: 'image',
    content: '',
    linkUrl: '',
    targetBlank: true,
    priority: 0,
    startAt: null,
    endAt: null,
    isActive: true,
    remark: ''
  });
  const limit = 20;

  // 获取广告位列表
  const fetchSlots = async () => {
    setSlotsLoading(true);
    try {
      const data = await adsApi.admin.slots.getAll();
      setSlots(data);
    } catch (err) {
      console.error("Could not load ad slots:", err);
      toast.error(err.message || pbnT("m1577"));
    } finally {
      setSlotsLoading(false);
    }
  };

  // 获取广告列表
  const fetchAds = async () => {
    setAdsLoading(true);
    try {
      const data = await adsApi.admin.getAds({
        page: adsPage,
        limit
      });
      setAds(data.items);
      setAdsTotal(data.total);
    } catch (err) {
      console.error("Could not load ads:", err);
      toast.error(err.message || pbnT("m1579"));
    } finally {
      setAdsLoading(false);
    }
  };
  useEffect(() => {
    fetchSlots();
  }, []);
  useEffect(() => {
    fetchAds();
  }, [adsPage]);

  // ============ 广告位操作 ============
  const openCreateSlotDialog = () => {
    setSlotDialogMode('create');
    setSelectedSlot(null);
    setSlotFormData({
      name: '',
      code: '',
      description: '',
      width: '',
      height: '',
      maxAds: 1,
      isActive: true
    });
    setShowSlotDialog(true);
  };
  const openEditSlotDialog = slot => {
    setSlotDialogMode('edit');
    setSelectedSlot(slot);
    setSlotFormData({
      name: slot.name,
      code: slot.code,
      description: slot.description || '',
      width: slot.width || '',
      height: slot.height || '',
      maxAds: slot.maxAds || 1,
      isActive: slot.isActive
    });
    setShowSlotDialog(true);
  };
  const handleSlotSubmit = async () => {
    if (!slotFormData.name.trim()) {
      toast.error(pbnT("m1580"));
      return;
    }
    if (!slotFormData.code.trim()) {
      toast.error(pbnT("m1581"));
      return;
    }
    setSlotSubmitting(true);
    try {
      const submitData = {
        ...slotFormData,
        width: slotFormData.width ? parseInt(slotFormData.width) : null,
        height: slotFormData.height ? parseInt(slotFormData.height) : null,
        maxAds: parseInt(slotFormData.maxAds) || 1
      };
      if (slotDialogMode === 'create') {
        await adsApi.admin.slots.create(submitData);
        toast.success(pbnT("m1582"));
      } else {
        await adsApi.admin.slots.update(selectedSlot.id, submitData);
        toast.success(pbnT("m1583"));
      }
      setShowSlotDialog(false);
      fetchSlots();
    } catch (err) {
      console.error(`Could not ${slotDialogMode === 'create' ? "Create" : "Update"} ad slot:`, err);
      toast.error(err.message || pbnT("m568"));
    } finally {
      setSlotSubmitting(false);
    }
  };
  const handleDeleteSlot = async (e, slot) => {
    const confirmed = await confirm(e, {
      title: pbnT("m246"),
      description: pbnT("m1585", {
        arg0: slot.name
      }),
      confirmText: pbnT("m110"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    try {
      await adsApi.admin.slots.delete(slot.id);
      toast.success(pbnT("m1586"));
      fetchSlots();
    } catch (err) {
      console.error("Could not delete ad slot:", err);
      toast.error(err.message || pbnT("m249"));
    }
  };
  const handleToggleSlotStatus = async slot => {
    const newStatus = !slot.isActive;

    // Optimistic update
    setSlots(prev => prev.map(item => item.id === slot.id ? {
      ...item,
      isActive: newStatus,
      _updating: true
    } : item));
    try {
      await adsApi.admin.slots.update(slot.id, {
        isActive: newStatus
      });
      toast.success(newStatus ? pbnT("m1588") : pbnT("m1589"));

      // Confirm update (clear loading state)
      setSlots(prev => prev.map(item => item.id === slot.id ? {
        ...item,
        isActive: newStatus,
        _updating: false
      } : item));
    } catch (err) {
      console.error("Could not update ad slot status:", err);
      toast.error(err.message || pbnT("m1591"));
      // Revert on failure
      setSlots(prev => prev.map(item => item.id === slot.id ? {
        ...item,
        isActive: !newStatus,
        _updating: false
      } : item));
    }
  };

  // ============ 广告操作 ============
  const openCreateAdDialog = () => {
    setAdDialogMode('create');
    setSelectedAd(null);
    setAdFormData({
      slotId: slots.length > 0 ? slots[0].id.toString() : '',
      title: '',
      type: 'image',
      content: '',
      linkUrl: '',
      targetBlank: true,
      priority: 0,
      startAt: null,
      endAt: null,
      isActive: true,
      remark: ''
    });
    setShowAdDialog(true);
  };
  const openEditAdDialog = ad => {
    setAdDialogMode('edit');
    setSelectedAd(ad);
    setAdFormData({
      slotId: ad.slotId.toString(),
      title: ad.title,
      type: ad.type,
      content: ad.content || '',
      linkUrl: ad.linkUrl || '',
      targetBlank: ad.targetBlank,
      priority: ad.priority || 0,
      startAt: ad.startAt ? new Date(ad.startAt) : null,
      endAt: ad.endAt ? new Date(ad.endAt) : null,
      isActive: ad.isActive,
      remark: ad.remark || ''
    });
    setShowAdDialog(true);
  };
  const handleAdSubmit = async () => {
    if (!adFormData.slotId) {
      toast.error(pbnT("m1592"));
      return;
    }
    if (!adFormData.title.trim()) {
      toast.error(pbnT("m1593"));
      return;
    }
    setAdSubmitting(true);
    try {
      const submitData = {
        ...adFormData,
        slotId: parseInt(adFormData.slotId),
        priority: parseInt(adFormData.priority) || 0,
        startAt: adFormData.startAt ? adFormData.startAt.toISOString() : null,
        endAt: adFormData.endAt ? adFormData.endAt.toISOString() : null
      };
      if (adDialogMode === 'create') {
        await adsApi.admin.createAd(submitData);
        toast.success(pbnT("m1594"));
      } else {
        await adsApi.admin.updateAd(selectedAd.id, submitData);
        toast.success(pbnT("m1595"));
      }
      setShowAdDialog(false);
      fetchAds();
    } catch (err) {
      console.error(`Could not ${adDialogMode === 'create' ? "Create" : "Update"} ad:`, err);
      toast.error(err.message || pbnT("m568"));
    } finally {
      setAdSubmitting(false);
    }
  };
  const handleDeleteAd = async (e, ad) => {
    const confirmed = await confirm(e, {
      title: pbnT("m246"),
      description: pbnT("m1597", {
        arg0: ad.title
      }),
      confirmText: pbnT("m110"),
      variant: 'destructive'
    });
    if (!confirmed) return;
    try {
      await adsApi.admin.deleteAd(ad.id);
      toast.success(pbnT("m1598"));
      fetchAds();
    } catch (err) {
      console.error("Could not delete ad:", err);
      toast.error(err.message || pbnT("m249"));
    }
  };
  const handleToggleAdStatus = async ad => {
    const newStatus = !ad.isActive;

    // Optimistic update
    setAds(prev => prev.map(item => item.id === ad.id ? {
      ...item,
      isActive: newStatus,
      _updating: true
    } : item));
    try {
      await adsApi.admin.updateAd(ad.id, {
        isActive: newStatus
      });
      toast.success(newStatus ? pbnT("m1600") : pbnT("m1601"));

      // Confirm update
      setAds(prev => prev.map(item => item.id === ad.id ? {
        ...item,
        isActive: newStatus,
        _updating: false
      } : item));
    } catch (err) {
      console.error("Could not update ad status:", err);
      toast.error(err.message || pbnT("m1591"));
      // Revert on failure
      setAds(prev => prev.map(item => item.id === ad.id ? {
        ...item,
        isActive: !newStatus,
        _updating: false
      } : item));
    }
  };

  // 格式化日期
  const formatDate = dateStr => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString(pbnT.locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  return <div className="space-y-6">
      <PageHeader title={pbnT("m1507")} description={pbnT("m1603")} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ads" className="gap-2">{pbnT("m1604")}{adsTotal > 0 && <Badge variant="secondary">{adsTotal}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="slots" className="gap-2">{pbnT("m1605")}{slots.length > 0 && <Badge variant="secondary">{slots.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* 广告列表 Tab */}
        <TabsContent value="ads" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateAdDialog} disabled={slots.length === 0}>
              <Plus className="h-4 w-4" />{pbnT("m1606")}</Button>
          </div>

          {slots.length === 0 && !slotsLoading && <div className="text-center py-8 text-muted-foreground">{pbnT("m1607")}</div>}

          <DataTable columns={[{
          key: 'title',
          label: pbnT("m1608"),
          render: (_, ad) => <div className="flex flex-col gap-1">
                    <span className="font-medium">{ad.title}</span>
                    {ad.slot && <span className="text-xs text-muted-foreground">
                        {ad.slot.name}
                      </span>}
                  </div>
        }, {
          key: 'type',
          label: pbnT("m406"),
          width: 'w-25',
          render: type => {
            const config = AD_TYPES(pbnT)[type];
            const Icon = config?.icon || Image;
            return <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${config?.color || 'bg-gray-100 text-gray-800'}`}>
                      <Icon className="h-3 w-3" />
                      {config?.label || type}
                    </span>;
          }
        }, {
          key: 'isActive',
          label: pbnT("m298"),
          width: 'w-20',
          render: (isActive, ad) => <Badge variant={isActive ? 'default' : 'secondary'} className={`cursor-pointer hover:opacity-80 transition-opacity ${ad._updating ? 'opacity-50 pointer-events-none' : ''}`} onClick={e => {
            e.stopPropagation();
            handleToggleAdStatus(ad);
          }}>
                    {isActive ? pbnT("m1609") : pbnT("m304")}
                  </Badge>
        }, {
          key: 'stats',
          label: pbnT("m1610"),
          width: 'w-35',
          render: (_, ad) => <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {ad.impressions || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MousePointer className="h-3.5 w-3.5" />
                      {ad.clicks || 0}
                    </span>
                  </div>
        }, {
          key: 'schedule',
          label: pbnT("m1611"),
          render: (_, ad) => <div className="text-sm text-muted-foreground">
                    {ad.startAt || ad.endAt ? <>
                        <div>{formatDate(ad.startAt)}{" "}{pbnT("m1612")}</div>
                        <div>{formatDate(ad.endAt)}{" "}{pbnT("m1613")}</div>
                      </> : <span>{pbnT("m1614")}</span>}
                  </div>
        }, {
          key: 'actions',
          label: pbnT("m234"),
          align: 'right',
          sticky: 'right',
          render: (_, ad) => <ActionMenu mode="inline" items={[{
            label: pbnT("m235"),
            icon: Edit,
            onClick: () => openEditAdDialog(ad)
          }, {
            label: pbnT("m110"),
            icon: Trash2,
            variant: 'destructive',
            onClick: e => handleDeleteAd(e, ad)
          }]} />
        }]} data={ads} loading={adsLoading} emptyMessage={pbnT("m1615")} />

          {adsTotal > limit && <Pager page={adsPage} total={adsTotal} pageSize={limit} onPageChange={setAdsPage} />}
        </TabsContent>

        {/* 广告位管理 Tab */}
        <TabsContent value="slots" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateSlotDialog}>
              <Plus className="h-4 w-4" />{pbnT("m1616")}</Button>
          </div>

          <DataTable columns={[{
          key: 'name',
          label: pbnT("m230"),
          render: (_, slot) => <div className="flex flex-col gap-1">
                    <span className="font-medium">{slot.name}</span>
                    <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {slot.code}
                    </code>
                  </div>
        }, {
          key: 'size',
          label: pbnT("m1617"),
          width: 'w-30',
          render: (_, slot) => <span className="text-sm text-muted-foreground">
                    {slot.width && slot.height ? `${slot.width} × ${slot.height}` : '-'}
                  </span>
        }, {
          key: 'maxAds',
          label: pbnT("m1618"),
          width: 'w-25',
          render: value => value || 1
        }, {
          key: 'isActive',
          label: pbnT("m298"),
          width: 'w-20',
          render: (isActive, slot) => <Badge variant={isActive ? 'default' : 'secondary'} className={`cursor-pointer hover:opacity-80 transition-opacity ${slot._updating ? 'opacity-50 pointer-events-none' : ''}`} onClick={e => {
            e.stopPropagation();
            handleToggleSlotStatus(slot);
          }}>
                    {isActive ? pbnT("m1609") : pbnT("m304")}
                  </Badge>
        }, {
          key: 'description',
          label: pbnT("m218"),
          render: value => <span className="text-sm text-muted-foreground truncate max-w-50 block">
                    {value || '-'}
                  </span>
        }, {
          key: 'actions',
          label: pbnT("m234"),
          align: 'right',
          sticky: 'right',
          render: (_, slot) => <ActionMenu mode="inline" items={[{
            label: pbnT("m235"),
            icon: Edit,
            onClick: () => openEditSlotDialog(slot)
          }, {
            label: pbnT("m110"),
            icon: Trash2,
            variant: 'destructive',
            onClick: e => handleDeleteSlot(e, slot)
          }]} />
        }]} data={slots} loading={slotsLoading} emptyMessage={pbnT("m1619")} />
        </TabsContent>
      </Tabs>

      {/* 广告位表单对话框 */}
      <FormDialog open={showSlotDialog} onOpenChange={setShowSlotDialog} title={slotDialogMode === 'create' ? pbnT("m1620") : pbnT("m1621")} description={slotDialogMode === 'create' ? pbnT("m1622") : pbnT("m1623")} submitText={slotDialogMode === 'create' ? pbnT("m209") : pbnT("m210")} onSubmit={handleSlotSubmit} loading={slotSubmitting}>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="slotName">{pbnT("m1624")}</Label>
            <Input id="slotName" value={slotFormData.name} onChange={e => setSlotFormData({
            ...slotFormData,
            name: e.target.value
          })} placeholder={pbnT("m1625")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slotCode">{pbnT("m1626")}</Label>
            <Input id="slotCode" value={slotFormData.code} onChange={e => setSlotFormData({
            ...slotFormData,
            code: e.target.value
          })} placeholder={pbnT("m1627")} disabled={slotDialogMode === 'edit'} />
            <p className="text-xs text-muted-foreground">{pbnT("m1628")}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slotWidth">{pbnT("m1629")}</Label>
              <Input id="slotWidth" type="number" value={slotFormData.width} onChange={e => setSlotFormData({
              ...slotFormData,
              width: e.target.value
            })} placeholder={pbnT("m1630")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slotHeight">{pbnT("m1631")}</Label>
              <Input id="slotHeight" type="number" value={slotFormData.height} onChange={e => setSlotFormData({
              ...slotFormData,
              height: e.target.value
            })} placeholder={pbnT("m1632")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxAds">{pbnT("m1618")}</Label>
            <Input id="maxAds" type="number" min="1" value={slotFormData.maxAds} onChange={e => setSlotFormData({
            ...slotFormData,
            maxAds: e.target.value
          })} />
            <p className="text-xs text-muted-foreground">{pbnT("m1633")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slotDescription">{pbnT("m218")}</Label>
            <Textarea id="slotDescription" value={slotFormData.description} onChange={e => setSlotFormData({
            ...slotFormData,
            description: e.target.value
          })} placeholder={pbnT("m1634")} rows={2} />
          </div>

          <div className="flex items-center justify-between space-x-2 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="slotIsActive" className="text-base">{pbnT("m1635")}</Label>
              <p className="text-sm text-muted-foreground">{pbnT("m1636")}</p>
            </div>
            <Switch id="slotIsActive" checked={slotFormData.isActive} onCheckedChange={checked => setSlotFormData({
            ...slotFormData,
            isActive: checked
          })} />
          </div>
        </div>
      </FormDialog>

      {/* 广告表单对话框 */}
      <FormDialog open={showAdDialog} onOpenChange={setShowAdDialog} title={adDialogMode === 'create' ? pbnT("m1637") : pbnT("m1638")} description={adDialogMode === 'create' ? pbnT("m1639") : pbnT("m1640")} submitText={adDialogMode === 'create' ? pbnT("m209") : pbnT("m210")} onSubmit={handleAdSubmit} loading={adSubmitting}>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="creativeSlotId">{pbnT("m1641")}</Label>
            <Select value={adFormData.slotId} onValueChange={value => setAdFormData({
            ...adFormData,
            slotId: value
          })}>
              <SelectTrigger>
                <SelectValue placeholder={pbnT("m1642")} />
              </SelectTrigger>
              <SelectContent>
                {slots.map(slot => <SelectItem key={slot.id} value={slot.id.toString()}>
                    {slot.name} ({slot.code})
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="creativeTitle">{pbnT("m1643")}</Label>
            <Input id="creativeTitle" value={adFormData.title} onChange={e => setAdFormData({
            ...adFormData,
            title: e.target.value
          })} placeholder={pbnT("m1644")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="creativeType">{pbnT("m1645")}</Label>
            <Select value={adFormData.type} onValueChange={value => setAdFormData({
            ...adFormData,
            type: value
          })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AD_TYPES(pbnT)).map(([key, config]) => {
                const Icon = config.icon;
                return <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>;
              })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="creativeContent">
              {adFormData.type === 'image' ? pbnT("m1646") : adFormData.type === 'html' ? pbnT("m1647") : pbnT("m1648")}
            </Label>
            {adFormData.type === 'image' ? <Input id="creativeContent" value={adFormData.content} onChange={e => setAdFormData({
            ...adFormData,
            content: e.target.value
          })} placeholder="https://example.com/ad-banner.jpg" /> : <Textarea id="creativeContent" value={adFormData.content} onChange={e => setAdFormData({
            ...adFormData,
            content: e.target.value
          })} placeholder={adFormData.type === 'html' ? '<div>...</div>' : '<script>...</script>'} rows={4} className="font-mono text-sm" />}
          </div>

          {adFormData.type === 'image' && <div className="space-y-2">
              <Label htmlFor="creativeLinkUrl">{pbnT("m1649")}</Label>
              <Input id="creativeLinkUrl" value={adFormData.linkUrl} onChange={e => setAdFormData({
            ...adFormData,
            linkUrl: e.target.value
          })} placeholder="https://example.com" />
            </div>}

          <div className="space-y-2">
            <Label htmlFor="creativePriority">{pbnT("m532")}</Label>
            <Input id="creativePriority" type="number" value={adFormData.priority} onChange={e => setAdFormData({
            ...adFormData,
            priority: e.target.value
          })} />
            <p className="text-xs text-muted-foreground">{pbnT("m1650")}</p>
          </div>

          <div className="flex items-center justify-between space-x-2 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isLongTerm" className="text-base">{pbnT("m1614")}</Label>
              <p className="text-sm text-muted-foreground">{pbnT("m1651")}</p>
            </div>
            <Switch id="isLongTerm" checked={!adFormData.startAt && !adFormData.endAt} onCheckedChange={checked => {
            if (checked) {
              setAdFormData({
                ...adFormData,
                startAt: null,
                endAt: null
              });
            } else {
              const nextMonth = new Date();
              nextMonth.setDate(nextMonth.getDate() + 30);
              setAdFormData({
                ...adFormData,
                startAt: new Date(),
                endAt: nextMonth
              });
            }
          }} />
          </div>

          {(adFormData.startAt || adFormData.endAt) && <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creativeStartAt">{pbnT("m1652")}</Label>
                <DatePicker id="creativeStartAt" value={adFormData.startAt} onChange={date => setAdFormData({
              ...adFormData,
              startAt: date
            })} placeholder={pbnT("m1653")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creativeEndAt">{pbnT("m1654")}</Label>
                <DatePicker id="creativeEndAt" value={adFormData.endAt} onChange={date => setAdFormData({
              ...adFormData,
              endAt: date
            })} placeholder={pbnT("m1655")} />
              </div>
            </div>}

          <div className="space-y-2">
            <Label htmlFor="creativeRemark">{pbnT("m301")}</Label>
            <Textarea id="creativeRemark" value={adFormData.remark} onChange={e => setAdFormData({
            ...adFormData,
            remark: e.target.value
          })} placeholder={pbnT("m1656")} rows={2} />
          </div>

          {adFormData.type === 'image' && <div className="flex items-center justify-between space-x-2 rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="creativeTargetBlank" className="text-base">{pbnT("m1657")}</Label>
                <p className="text-sm text-muted-foreground">{pbnT("m1658")}</p>
              </div>
              <Switch id="creativeTargetBlank" checked={adFormData.targetBlank} onCheckedChange={checked => setAdFormData({
            ...adFormData,
            targetBlank: checked
          })} />
            </div>}

          <div className="flex items-center justify-between space-x-2 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="creativeIsActive" className="text-base">{pbnT("m1659")}</Label>
              <p className="text-sm text-muted-foreground">{pbnT("m1660")}</p>
            </div>
            <Switch id="creativeIsActive" checked={adFormData.isActive} onCheckedChange={checked => setAdFormData({
            ...adFormData,
            isActive: checked
          })} />
          </div>
        </div>
      </FormDialog>
    </div>;
}
