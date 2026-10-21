import { usePbnTranslations } from "@/i18n/useTranslations";
import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from 'sonner';
import { FormDialog } from '@/components/common/FormDialog';
import { ImageUpload } from '@/components/common/ImageUpload';
import { useDefaultCurrencyName } from '@/extensions/ledger/contexts/LedgerContext';
export function BadgeFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit
}) {
  const pbnT = usePbnTranslations();
  const currencyName = useDefaultCurrencyName();
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: {
      errors
    }
  } = useForm({
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      iconUrl: '',
      category: 'general',
      unlockCondition: '{}',
      displayOrder: 0,
      isActive: true
    }
  });

  // 解析条件的辅助函数
  const parseCondition = jsonStr => {
    try {
      const parsed = JSON.parse(jsonStr || '{}');
      return {
        type: parsed.type || 'manual',
        threshold: parsed.threshold || 0
      };
    } catch {
      return {
        type: 'manual',
        threshold: 0
      };
    }
  };

  // 解析元数据的辅助函数
  const parseMetadata = jsonStr => {
    try {
      return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr || {};
    } catch {
      return {};
    }
  };
  useEffect(() => {
    if (open && mode === 'edit' && initialData) {
      const parsedCondition = parseCondition(initialData.unlockCondition);
      const parsedMetadata = parseMetadata(initialData.metadata);
      const effects = parsedMetadata.effects || {};
      reset({
        name: initialData.name,
        slug: initialData.slug,
        description: initialData.description || '',
        iconUrl: initialData.iconUrl,
        category: initialData.category || 'general',
        unlockCondition: initialData.unlockCondition || '{}',
        // UI 辅助字段 - 条件
        _conditionType: parsedCondition.type,
        _threshold: parsedCondition.threshold,
        // UI 辅助字段 - 特效
        _effectCheckInBonus: effects.checkInBonus || 0,
        _effectCheckInBonusPercent: effects.checkInBonusPercent || 0,
        _effectReplyCostReduction: effects.replyCostReductionPercent || 0,
        displayOrder: initialData.displayOrder || 0,
        isActive: initialData.isActive !== false
      });
    } else if (open && mode === 'create') {
      reset({
        name: '',
        slug: '',
        description: '',
        iconUrl: '',
        category: 'general',
        unlockCondition: '{"type": "manual"}',
        _conditionType: 'manual',
        _threshold: 0,
        // UI 辅助字段 - 特效
        _effectCheckInBonus: 0,
        _effectCheckInBonusPercent: 0,
        _effectReplyCostReduction: 0,
        displayOrder: 0,
        isActive: true
      });
    }
  }, [open, mode, initialData, reset]);
  const onFormSubmit = async data => {
    try {
      // 从 UI 字段构建 JSON (Condition)
      const conditionObj = {
        type: data._conditionType
      };
      if (data._conditionType !== 'manual') {
        conditionObj.threshold = Number(data._threshold);
      }

      // 构建 Metadata (Effects)
      let currentMetadata = {};
      if (mode === 'edit' && initialData && initialData.metadata) {
        currentMetadata = parseMetadata(initialData.metadata);
      }
      const effects = {};
      if (data._effectCheckInBonus > 0) effects.checkInBonus = data._effectCheckInBonus;
      if (data._effectCheckInBonusPercent > 0) effects.checkInBonusPercent = data._effectCheckInBonusPercent;
      if (data._effectReplyCostReduction > 0) effects.replyCostReductionPercent = data._effectReplyCostReduction;
      const metadataObj = {
        ...currentMetadata,
        effects: Object.keys(effects).length > 0 ? effects : undefined
      };
      const finalData = {
        ...data,
        unlockCondition: JSON.stringify(conditionObj),
        metadata: JSON.stringify(metadataObj)
      };

      // 移除辅助字段
      delete finalData._conditionType;
      delete finalData._threshold;
      delete finalData._effectCheckInBonus;
      delete finalData._effectCheckInBonusPercent;
      delete finalData._effectReplyCostReduction;
      await onSubmit(finalData);
    } catch (error) {
      // handled by parent
      console.error("Form submit error", error);
    }
  };

  // 监听条件类型以有条件地显示阈值
  const conditionType = watch('_conditionType') || 'manual';
  return <FormDialog open={open} onOpenChange={onOpenChange} title={mode === 'create' ? pbnT("m1677") : pbnT("m1678")} maxWidth="md:max-w-3xl" submitText={mode === 'create' ? pbnT("m209") : pbnT("m210")} onSubmit={handleSubmit(onFormSubmit)}>
        <form className="space-y-6 p-1">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">{pbnT("m1679")}</h4>
            <div className="gap-4 grid grid-cols-1 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="name">{pbnT("m230")}</Label>
                <Input id="name" placeholder={pbnT("m1680")} {...register('name', {
              required: pbnT("m1681")
            })} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">{pbnT("m1682")}</Label>
                <Input id="slug" placeholder={pbnT("m1683")} {...register('slug', {
              required: pbnT("m1684")
            })} />
                {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
              </div>

               <div className="space-y-2">
                <Label htmlFor="category">{pbnT("m44")}</Label>
                <Controller name="category" control={control} render={({
              field
            }) => <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder={pbnT("m1685")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">{pbnT("m1686")}</SelectItem>
                        <SelectItem value="achievement">{pbnT("m1687")}</SelectItem>
                        <SelectItem value="event">{pbnT("m1688")}</SelectItem>
                        <SelectItem value="manual">{pbnT("m1689")}</SelectItem>
                      </SelectContent>
                    </Select>} />
              </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="iconUrl">{pbnT("m1690")}</Label>
                <Controller name="iconUrl" control={control} rules={{
            required: pbnT("m1691")
          }} render={({
            field
          }) => <div className="space-y-2">
                      <ImageUpload value={field.value} onChange={field.onChange} category="badges" placeholder={pbnT("m1692")} />
                      <Input id="iconUrl" placeholder={pbnT("m1693")} value={field.value} onChange={field.onChange} className="text-xs h-8" />
                    </div>} />
                {errors.iconUrl && <p className="text-sm text-destructive">{errors.iconUrl.message}</p>}
              </div>

            <div className="space-y-2">
              <Label htmlFor="description">{pbnT("m218")}</Label>
              <Textarea id="description" placeholder={pbnT("m1694")} className="resize-none h-20" {...register('description')} />
            </div>
          </div>

          {/* 解锁条件 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">{pbnT("m1695")}</h4>
            <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <div className="space-y-2">
                  <Label htmlFor="_conditionType" className="text-xs">{pbnT("m1696")}</Label>
                  <Controller name="_conditionType" control={control} render={({
                field
              }) => <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder={pbnT("m718")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">{pbnT("m1697")}</SelectItem>
                          <SelectItem value="post_count">{pbnT("m1698")}</SelectItem>
                          <SelectItem value="topic_count">{pbnT("m1699")}</SelectItem>
                          <SelectItem value="like_received_count">{pbnT("m1700")}</SelectItem>
                          <SelectItem value="checkin_streak">{pbnT("m1701")}</SelectItem>
                          <SelectItem value="registration_days">{pbnT("m1702")}</SelectItem>
                        </SelectContent>
                      </Select>} />
                </div>

                {watch('_conditionType') !== 'manual' && <div className="space-y-2">
                    <Label htmlFor="_threshold" className="text-xs">{pbnT("m1703")}</Label>
                    <Input id="_threshold" type="number" className="bg-background" placeholder={pbnT("m1704")} {...register('_threshold', {
                required: watch('_conditionType') !== 'manual' ? pbnT("m1705") : false,
                valueAsNumber: true
              })} />
                  </div>}
              </div>
              
               {watch('_conditionType') !== 'manual' && <div className="text-xs text-muted-foreground font-mono bg-background p-2 rounded border truncate">{pbnT("m1706")}{" "}{JSON.stringify({
              type: watch('_conditionType') || 'manual',
              threshold: Number(watch('_threshold') || 0)
            })}
                  </div>}
            </div>
          </div>

          {/* 被动效果 */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">{pbnT("m1707")}</h4>
            <div className="space-y-4 rounded-md border p-4 bg-muted/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="_effectCheckInBonus">{pbnT("m1708")}{" "}{currencyName}</Label>
                  <div className="flex items-center gap-2">
                    <Input id="_effectCheckInBonus" type="number" placeholder="5" {...register('_effectCheckInBonus', {
                  valueAsNumber: true
                })} />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{pbnT("m338")}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{pbnT("m1709")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="_effectCheckInBonusPercent">{pbnT("m1710")}{" "}{currencyName}{" "}{pbnT("m1711")}</Label>
                  <div className="flex items-center gap-2">
                    <Input id="_effectCheckInBonusPercent" type="number" placeholder="10" {...register('_effectCheckInBonusPercent', {
                  valueAsNumber: true
                })} />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">%</span>
                  </div>
                   <p className="text-[10px] text-muted-foreground">{pbnT("m1712")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="_effectReplyCostReduction">{pbnT("m1713")}</Label>
                   <div className="flex items-center gap-2">
                    <Input id="_effectReplyCostReduction" type="number" placeholder="50" max="100" {...register('_effectReplyCostReduction', {
                  valueAsNumber: true,
                  max: 100
                })} />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{pbnT("m1714")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 其他设置 */}
          <div className="space-y-4">
             <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">{pbnT("m1715")}</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayOrder">{pbnT("m1716")}</Label>
                <Input id="displayOrder" type="number" {...register('displayOrder', {
              valueAsNumber: true
            })} />
                <p className="text-[10px] text-muted-foreground">{pbnT("m1717")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isActive">{pbnT("m1718")}</Label>
                <div className="flex h-10 items-center justify-between rounded-md border px-3 shadow-sm bg-background/50">
                  <span className="text-sm text-muted-foreground">{pbnT("m1719")}</span>
                  <Controller name="isActive" control={control} render={({
                field
              }) => <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />} />
                </div>
              </div>
            </div>
          </div>
        </form>
    </FormDialog>;
}
