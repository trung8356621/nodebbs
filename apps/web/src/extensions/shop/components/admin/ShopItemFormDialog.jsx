import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { ITEM_TYPES, getItemTypeLabel } from '../../utils/itemTypes';
import { badgesApi } from '@/extensions/badges/api';
import { ledgerApi } from '@/extensions/ledger/api';
import { DEFAULT_CURRENCY_CODE } from '@/extensions/ledger/constants';
import UserAvatar from '@/components/user/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { FormDialog } from '@/components/common/FormDialog';
import { ImageUpload } from '@/components/common/ImageUpload';
import CopyButton from '@/components/common/CopyButton';

// 头像框元数据示例
const CSS_FRAME_EXAMPLE = JSON.stringify({
  border: "2px solid gold",
  shadow: "0 0 10px gold",
  animation: "glow"
}, null, 2);
const IMAGE_FRAME_EXAMPLE = JSON.stringify({
  type: "image",
  imageUrl: "/uploads/frames/xxx.png",
  scale: 1.35,
  xOffset: "0px",
  yOffset: "0px",
  rotation: 0,
  opacity: 1,
  blendMode: "normal"
}, null, 2);

/**
 * 创建/编辑商品的表单对话框
 * @param {Object} props
 * @param {boolean} props.open - 对话框打开状态
 * @param {Function} props.onOpenChange - 打开状态改变时的回调
 * @param {'create'|'edit'} props.mode - 表单模式
 * @param {Object} props.initialData - 编辑模式下的初始表单数据
 * @param {Function} props.onSubmit - 表单提交时的回调
 * @param {boolean} props.submitting - 提交进行中
 */
export function ShopItemFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  submitting
}) {
  const pbnT = usePbnTranslations();
  const [formData, setFormData] = useState({
    type: ITEM_TYPES.AVATAR_FRAME,
    consumeType: 'non_consumable',
    name: '',
    description: '',
    price: 0,
    imageUrl: '',
    stock: null,
    maxOwn: null,
    displayOrder: 0,
    isActive: true,
    metadata: '',
    currencyCode: DEFAULT_CURRENCY_CODE
  });
  const {
    user
  } = useAuth();
  const [currencies, setCurrencies] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loadingBadges, setLoadingBadges] = useState(false);

  // 当类型为勋章时获取勋章列表
  useEffect(() => {
    if (open && formData.type === 'badge') {
      fetchBadges();
    }
  }, [open, formData.type]);
  const fetchBadges = async () => {
    try {
      setLoadingBadges(true);
      const data = await badgesApi.getAll();
      setBadges(data.items || []);
    } catch (error) {
      console.error('Failed to fetch badges:', error);
    } finally {
      setLoadingBadges(false);
    }
  };
  const handleBadgeSelect = badgeId => {
    const badge = badges.find(b => b.id.toString() === badgeId.toString());
    if (badge) {
      setFormData(prev => ({
        ...prev,
        name: badge.name,
        description: badge.description || '',
        imageUrl: badge.iconUrl,
        metadata: JSON.stringify({
          badgeId: badge.id
        })
      }));
    }
  };

  // Fetch currencies on mount/open
  useEffect(() => {
    if (open) {
      ledgerApi.getCurrencies().then(items => {
        setCurrencies(items.filter(c => c.isActive));
      }).catch(console.error);
    }
  }, [open]);
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        type: initialData.type,
        consumeType: initialData.consumeType || 'non_consumable',
        name: initialData.name,
        description: initialData.description || '',
        price: initialData.price,
        currencyCode: initialData.currencyCode || DEFAULT_CURRENCY_CODE,
        imageUrl: initialData.imageUrl || '',
        stock: initialData.stock,
        maxOwn: initialData.maxOwn,
        displayOrder: initialData.displayOrder || 0,
        isActive: initialData.isActive,
        metadata: initialData.metadata || ''
      });
    } else if (mode === 'create') {
      setFormData({
        type: ITEM_TYPES.AVATAR_FRAME,
        consumeType: 'non_consumable',
        name: '',
        description: '',
        price: 0,
        currencyCode: DEFAULT_CURRENCY_CODE,
        imageUrl: '',
        stock: null,
        maxOwn: null,
        displayOrder: 0,
        isActive: true,
        metadata: ''
      });
    }
  }, [mode, initialData, open]);
  const handleSubmit = () => {
    if (!formData.name.trim()) {
      return;
    }
    onSubmit(formData);
  };
  return <FormDialog open={open} onOpenChange={onOpenChange} title={mode === 'create' ? pbnT("m1940") : pbnT("m1941")} description={mode === 'create' ? pbnT("m1942") : pbnT("m1943")} maxWidth="sm:max-w-2xl" submitText={mode === 'create' ? pbnT("m209") : pbnT("m877")} loading={submitting} onSubmit={handleSubmit} disabled={!formData.name.trim()}>
        <div className="space-y-4 py-4">
          {/* 商品类型 */}
          <div className="space-y-2">
            <Label htmlFor="type">{pbnT("m1944")}</Label>
            <Select value={formData.type} onValueChange={value => setFormData(prev => ({
          ...prev,
          type: value
        }))}>
              <SelectTrigger>
                <SelectValue placeholder={pbnT("m1945")} />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ITEM_TYPES).map(type => <SelectItem key={type} value={type}>
                    {getItemTypeLabel(type, pbnT)}
                  </SelectItem>)}
                {!Object.values(ITEM_TYPES).includes('badge') && <SelectItem value="badge">{pbnT("m264")}</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* 消耗类型 - 暂时隐藏，待消耗品业务逻辑实现后启用 */}
          {/* <div className="space-y-2">
            <Label htmlFor="consumeType">消耗类型</Label>
            <Select
              value={formData.consumeType}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, consumeType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择消耗类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="non_consumable">非消耗品（只能拥有一个）</SelectItem>
                <SelectItem value="consumable">消耗品（可重复购买、使用即消）</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.consumeType === 'non_consumable' && '用户只能拥有一个，如头像框、勋章'}
              {formData.consumeType === 'consumable' && '用户可重复购买，使用后数量减少，如改名卡、置顶卡'}
            </p>
           </div> */}

          {/* 头像框预览 */}
          {formData.type === ITEM_TYPES.AVATAR_FRAME && <div className="flex items-center gap-4 p-4 bg-background rounded-lg border">
              <div className="flex-1 space-y-1">
                <Label>{pbnT("m1946")}</Label>
                <p className="text-xs text-muted-foreground">{pbnT("m1947")}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                   <UserAvatar name={user?.name || user?.username || 'Preview'} size="lg" url={user?.avatar} frameMetadata={formData.metadata || null} />
                   <span className="text-xs text-muted-foreground">{pbnT("m1948")}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <UserAvatar name={user?.name || user?.username || 'Preview'} size="md" url={user?.avatar} frameMetadata={formData.metadata || null} />
                   <span className="text-xs text-muted-foreground">{pbnT("m1949")}</span>
                </div>
              </div>
            </div>}

          {/* 勋章选择器（仅限勋章类型） */}
          {formData.type === 'badge' && <div className="space-y-2 p-4 bg-muted rounded-lg border">
              <Label>{pbnT("m1950")}</Label>
              <Select value={(() => {
          try {
            const meta = formData.metadata ? JSON.parse(formData.metadata) : {};
            return meta.badgeId ? String(meta.badgeId) : undefined;
          } catch (e) {
            return undefined;
          }
        })()} onValueChange={handleBadgeSelect}>
                <SelectTrigger className='bg-background'>
                  <SelectValue placeholder={pbnT("m1951")} />
                </SelectTrigger>
                <SelectContent>
                   {loadingBadges ? <div className="p-2 text-center text-sm text-muted-foreground">{pbnT("m71")}</div> : badges.length > 0 ? badges.map(badge => <SelectItem key={badge.id} value={badge.id.toString()}>
                               <div className="flex items-center gap-2">
                                   <img src={badge.iconUrl} className="w-4 h-4 object-contain" alt="" />
                                   <span>{badge.name}</span>
                               </div>
                           </SelectItem>) : <div className="p-2 text-center text-sm text-muted-foreground">{pbnT("m1952")}</div>}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{pbnT("m1953")}</p>
            </div>}

          {/* 名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">{pbnT("m1954")}</Label>
            <Input id="name" value={formData.name} onChange={e => setFormData(prev => ({
          ...prev,
          name: e.target.value
        }))} placeholder={pbnT("m1955")} />
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">{pbnT("m1956")}</Label>
            <Textarea id="description" value={formData.description} onChange={e => setFormData(prev => ({
          ...prev,
          description: e.target.value
        }))} placeholder={pbnT("m1957")} rows={3} className="resize-none" />
          </div>

          {/* 数值网格 */}
          <div className="grid grid-cols-3 gap-4">
            {/* 价格与货币 */}
            <div className="col-span-1 space-y-2">
              <Label htmlFor="price">{pbnT("m1958")}</Label>
              <Input id="price" type="number" min="0" value={formData.price} onChange={e => setFormData(prev => ({
            ...prev,
            price: e.target.value
          }))} placeholder="0" />
            </div>

             <div className="col-span-1 space-y-2">
              <Label htmlFor="currency">{pbnT("m1827")}</Label>
              <Select value={formData.currencyCode} onValueChange={value => setFormData(prev => ({
            ...prev,
            currencyCode: value
          }))}>
                <SelectTrigger>
                  <SelectValue placeholder={pbnT("m1825")} />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(currency => <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 库存 */}
            <div className="space-y-2">
              <Label htmlFor="stock">{pbnT("m1959")}</Label>
              <Input id="stock" type="number" min="0" value={formData.stock === null ? '' : formData.stock} onChange={e => setFormData(prev => ({
            ...prev,
            stock: e.target.value === '' ? null : e.target.value
          }))} placeholder={pbnT("m1960")} />
            </div>

            {/* 持有上限（消耗品时显示） */}
            {formData.consumeType !== 'non_consumable' && <div className="space-y-2">
                <Label htmlFor="maxOwn">{pbnT("m1961")}</Label>
                <Input id="maxOwn" type="number" min="1" value={formData.maxOwn === null ? '' : formData.maxOwn} onChange={e => setFormData(prev => ({
            ...prev,
            maxOwn: e.target.value === '' ? null : e.target.value
          }))} placeholder={pbnT("m1960")} />
              </div>}

            {/* 显示顺序 */}
            <div className="space-y-2">
              <Label htmlFor="displayOrder">{pbnT("m1962")}</Label>
              <Input id="displayOrder" type="number" value={formData.displayOrder} onChange={e => setFormData(prev => ({
            ...prev,
            displayOrder: e.target.value
          }))} placeholder="0" />
            </div>
          </div>

          {/* 图片上传 */}
          <div className="space-y-2">
            <Label htmlFor="imageUrl">{pbnT("m1963")}</Label>
            <ImageUpload value={formData.imageUrl} onChange={url => setFormData(prev => ({
          ...prev,
          imageUrl: url
        }))} category={formData.type === ITEM_TYPES.AVATAR_FRAME ? 'frames' : 'items'} placeholder={pbnT("m1964")} />
            <div className="flex gap-2">
              <Input id="imageUrl" value={formData.imageUrl} onChange={e => setFormData(prev => ({
            ...prev,
            imageUrl: e.target.value
          }))} placeholder={pbnT("m1965")} className="text-xs h-8" />
            </div>
          </div>

          {/* 元数据 */}
          <div className="space-y-2">
            <Label htmlFor="metadata">{pbnT("m1966")}</Label>
            <Textarea id="metadata" value={formData.metadata} onChange={e => setFormData(prev => ({
          ...prev,
          metadata: e.target.value
        }))} placeholder={pbnT("m1967")} rows={4} className="font-mono text-xs resize-none field-sizing-fixed" />
            {formData.type === ITEM_TYPES.AVATAR_FRAME && <div className="flex items-center gap-2 flex-wrap">
                <CopyButton value={CSS_FRAME_EXAMPLE} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  {({
              copied
            }) => copied ? pbnT("m154") : pbnT("m1968")}
                </CopyButton>
                <CopyButton value={IMAGE_FRAME_EXAMPLE} variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  {({
              copied
            }) => copied ? pbnT("m154") : pbnT("m1969")}
                </CopyButton>
                <span className="text-xs text-muted-foreground">{pbnT("m1970")}</span>
              </div>}
          </div>

          {/* 是否上架 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">{pbnT("m1971")}</Label>
              <p className="text-xs text-muted-foreground">{pbnT("m1972")}</p>
            </div>
            <Switch id="isActive" checked={formData.isActive} onCheckedChange={checked => setFormData(prev => ({
          ...prev,
          isActive: checked
        }))} />
          </div>
        </div>
    </FormDialog>;
}
