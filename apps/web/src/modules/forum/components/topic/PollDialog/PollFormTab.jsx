'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 20;
const DURATION_PRESETS = (pbnT = pbnRuntimeT) => [{
  label: pbnT("m840"),
  value: ''
}, {
  label: pbnT("m852"),
  value: '1'
}, {
  label: pbnT("m853"),
  value: '3'
}, {
  label: pbnT("m854"),
  value: '7'
}, {
  label: pbnT("m855"),
  value: '30'
}];

/**
 * @param {object} props
 * @param {object|null} props.editingDraft - null = 新建；否则预填编辑
 * @param {(pollId:number, wasEditing:boolean)=>void} props.onSubmitted
 * @param {()=>void} props.onCancelEdit
 */
export default function PollFormTab({
  editingDraft,
  onSubmitted,
  onCancelEdit
}) {
  const pbnT = usePbnTranslations();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [selectionType, setSelectionType] = useState('single');
  const [maxChoices, setMaxChoices] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [durationDays, setDurationDays] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEditing = editingDraft != null;
  useEffect(() => {
    if (editingDraft) {
      setQuestion(editingDraft.question || '');
      setOptions(Array.isArray(editingDraft.options) && editingDraft.options.length >= MIN_OPTIONS ? editingDraft.options.map(o => typeof o === 'string' ? o : o.text) : ['', '']);
      setSelectionType(editingDraft.selectionType || 'single');
      setMaxChoices(editingDraft.maxChoices != null ? String(editingDraft.maxChoices) : '');
      setIsAnonymous(!!editingDraft.isAnonymous);
      setDurationDays('');
    } else {
      setQuestion('');
      setOptions(['', '']);
      setSelectionType('single');
      setMaxChoices('');
      setIsAnonymous(true);
      setDurationDays('');
    }
  }, [editingDraft]);
  const updateOption = (idx, value) => {
    setOptions(prev => prev.map((o, i) => i === idx ? value : o));
  };
  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions(prev => [...prev, '']);
  };
  const removeOption = idx => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };
  const handleSubmit = async e => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map(o => o.trim()).filter(Boolean);
    if (!trimmedQuestion) {
      toast.error(pbnT("m2302"));
      return;
    }
    if (trimmedOptions.length < MIN_OPTIONS) {
      toast.error(pbnT("m2303", {
        arg0: MIN_OPTIONS
      }));
      return;
    }
    if (trimmedOptions.length > MAX_OPTIONS) {
      toast.error(pbnT("m2304", {
        arg0: MAX_OPTIONS
      }));
      return;
    }
    let parsedMaxChoices = null;
    if (selectionType === 'multiple') {
      if (maxChoices !== '') {
        const n = Number(maxChoices);
        if (!Number.isInteger(n) || n < 1 || n > trimmedOptions.length) {
          toast.error(pbnT("m2305"));
          return;
        }
        parsedMaxChoices = n;
      }
    }
    let closedAt;
    if (durationDays === '') {
      closedAt = isEditing ? editingDraft.closedAt ?? null : null;
    } else {
      const days = Number(durationDays);
      closedAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
    }
    const body = {
      question: trimmedQuestion,
      options: trimmedOptions,
      selectionType,
      maxChoices: parsedMaxChoices,
      isAnonymous,
      closedAt
    };
    setSubmitting(true);
    try {
      const url = isEditing ? `/api/polls/${editingDraft.id}` : '/api/polls';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || (isEditing ? pbnT("m495") : pbnT("m2306")));
        return;
      }
      if (isEditing) {
        toast.success(pbnT("m2270"));
      }
      onSubmitted?.(isEditing ? editingDraft.id : data.id, isEditing);
    } catch (err) {
      toast.error(pbnT("m1362"));
    } finally {
      setSubmitting(false);
    }
  };
  return <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="poll-question">{pbnT("m2307")}</Label>
        <Input id="poll-question" value={question} onChange={e => setQuestion(e.target.value)} placeholder={pbnT("m2308")} maxLength={500} />
      </div>

      <div className="space-y-2">
        <Label>{pbnT("m2309")}{options.length}/{MAX_OPTIONS}）</Label>
        <div className="space-y-2">
          {options.map((opt, idx) => <div key={idx} className="flex items-center gap-2">
              <Input value={opt} onChange={e => updateOption(idx, e.target.value)} placeholder={pbnT("m2310", {
            arg0: idx + 1
          })} maxLength={500} />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(idx)} disabled={options.length <= MIN_OPTIONS} title={pbnT("m2311")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>)}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={options.length >= MAX_OPTIONS}>
          <Plus className="h-4 w-4" />{pbnT("m2312")}</Button>
      </div>

      <div className="space-y-2">
        <Label>{pbnT("m406")}</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="poll-selection-type" value="single" checked={selectionType === 'single'} onChange={() => setSelectionType('single')} className="h-4 w-4" />
            <span>{pbnT("m2294")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="poll-selection-type" value="multiple" checked={selectionType === 'multiple'} onChange={() => setSelectionType('multiple')} className="h-4 w-4" />
            <span>{pbnT("m2295")}</span>
          </label>
        </div>
      </div>

      {selectionType === 'multiple' && <div className="space-y-2">
          <Label htmlFor="poll-max-choices">{pbnT("m2313")}</Label>
          <Input id="poll-max-choices" type="number" min={1} max={options.length} value={maxChoices} onChange={e => setMaxChoices(e.target.value)} placeholder={`1-${options.length}`} />
        </div>}

      <div className="space-y-2">
        <Label htmlFor="poll-duration">{pbnT("m2284")}{" "}{isEditing && pbnT("m2314")}
        </Label>
        <select id="poll-duration" value={durationDays} onChange={e => setDurationDays(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm">
          {DURATION_PRESETS(pbnT).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="poll-anonymous" checked={isAnonymous} onCheckedChange={v => setIsAnonymous(v === true)} />
        <Label htmlFor="poll-anonymous" className="cursor-pointer">{pbnT("m2315")}</Label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {isEditing && <Button type="button" variant="outline" onClick={onCancelEdit} disabled={submitting}>{pbnT("m2242")}</Button>}
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? pbnT("m114") : pbnT("m2316")}
        </Button>
      </div>
    </form>;
}
