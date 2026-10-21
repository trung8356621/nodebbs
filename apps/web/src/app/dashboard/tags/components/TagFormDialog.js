import { usePbnTranslations } from "@/i18n/useTranslations";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormDialog } from '@/components/common/FormDialog';
export function TagFormDialog({
  open,
  onOpenChange,
  isEdit,
  formData,
  setFormData,
  onSubmit,
  submitting
}) {
  const pbnT = usePbnTranslations();
  return <FormDialog open={open} onOpenChange={onOpenChange} title={isEdit ? pbnT("m817") : pbnT("m818")} description={isEdit ? pbnT("m819") : pbnT("m820")} submitText={isEdit ? pbnT("m210") : pbnT("m209")} onSubmit={onSubmit} loading={submitting}>
      <div className='space-y-4 py-4'>
        <div className='space-y-2'>
          <Label htmlFor='name'>{pbnT("m821")}</Label>
          <Input id='name' value={formData.name} onChange={e => setFormData({
          ...formData,
          name: e.target.value
        })} placeholder={pbnT("m822")} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='slug'>
            Slug{isEdit ? '' : pbnT("m213")}
          </Label>
          <Input id='slug' value={formData.slug || ''} onChange={e => setFormData({
          ...formData,
          slug: e.target.value
        })} placeholder={pbnT("m214")} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='description'>{pbnT("m218")}</Label>
          <Textarea id='description' value={formData.description} onChange={e => setFormData({
          ...formData,
          description: e.target.value
        })} placeholder={pbnT("m823")} rows={3} />
        </div>
      </div>
    </FormDialog>;
}
