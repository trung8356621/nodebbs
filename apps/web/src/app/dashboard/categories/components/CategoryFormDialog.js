import { usePbnTranslations } from "@/i18n/useTranslations";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FormDialog } from '@/components/common/FormDialog';
import CategorySelector from '@/modules/forum/components/topic/CategorySelector';
export function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  selectedCategory,
  formData,
  setFormData,
  onSubmit,
  submitting
}) {
  const pbnT = usePbnTranslations();
  return <FormDialog open={open} onOpenChange={onOpenChange} title={mode === 'create' ? pbnT("m205") : pbnT("m206")} description={mode === 'create' ? pbnT("m207") : pbnT("m208")} submitText={mode === 'create' ? pbnT("m209") : pbnT("m210")} onSubmit={onSubmit} loading={submitting}>
      <div className='space-y-4 py-4'>
        <div className='space-y-2'>
          <Label htmlFor='name'>{pbnT("m211")}</Label>
          <Input id='name' value={formData.name} onChange={e => setFormData({
          ...formData,
          name: e.target.value
        })} placeholder={pbnT("m212")} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='slug'>
            Slug{mode === 'create' ? pbnT("m213") : ''}
          </Label>
          <Input id='slug' value={formData.slug} onChange={e => setFormData({
          ...formData,
          slug: e.target.value
        })} placeholder={mode === 'create' ? pbnT("m214") : ''} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='parentId'>{pbnT("m215")}</Label>
          <CategorySelector value={formData.parentId} onChange={value => setFormData({
          ...formData,
          parentId: value
        })} placeholder={pbnT("m216")} excludeId={selectedCategory?.id} />
          <p className='text-xs text-muted-foreground mt-1'>{pbnT("m217")}</p>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='description'>{pbnT("m218")}</Label>
          <Textarea id='description' value={formData.description} onChange={e => setFormData({
          ...formData,
          description: e.target.value
        })} placeholder={pbnT("m219")} rows={3} />
        </div>
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='color'>{pbnT("m220")}</Label>
            <Input id='color' type='color' value={formData.color} onChange={e => setFormData({
            ...formData,
            color: e.target.value
          })} />
          </div>
        </div>
        <div className='flex items-center justify-between space-x-2 rounded-lg border border-border p-4'>
          <div className='space-y-0.5'>
            <Label htmlFor='isFeatured' className='text-base'>{pbnT("m221")}</Label>
            <p className='text-sm text-muted-foreground'>{pbnT("m222")}</p>
          </div>
          <Switch id='isFeatured' checked={formData.isFeatured} onCheckedChange={checked => setFormData({
          ...formData,
          isFeatured: checked
        })} />
        </div>
        <div className='flex items-center justify-between space-x-2 rounded-lg border border-border p-4'>
          <div className='space-y-0.5'>
            <Label htmlFor='isPrivate' className='text-base'>{pbnT("m223")}</Label>
            <p className='text-sm text-muted-foreground'>{pbnT("m224")}</p>
          </div>
          <Switch id='isPrivate' checked={formData.isPrivate} onCheckedChange={checked => setFormData({
          ...formData,
          isPrivate: checked
        })} />
        </div>
      </div>
    </FormDialog>;
}
