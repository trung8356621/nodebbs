'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
const DURATION_PRESETS = (pbnT = pbnRuntimeT) => [{
  label: pbnT("m850"),
  hours: 1
}, {
  label: pbnT("m851"),
  hours: 6
}, {
  label: pbnT("m852"),
  hours: 24
}, {
  label: pbnT("m853"),
  hours: 24 * 3
}, {
  label: pbnT("m854"),
  hours: 24 * 7
}, {
  label: pbnT("m855"),
  hours: 24 * 30
}];
function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @param {object} props
 * @param {object|null} props.editingDraft
 * @param {(lotteryId:number, wasEditing:boolean)=>void} props.onSubmitted
 * @param {()=>void} props.onCancelEdit
 */
export default function LotteryFormTab({
  editingDraft,
  onSubmitted,
  onCancelEdit
}) {
  const pbnT = usePbnTranslations();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [winnersCount, setWinnersCount] = useState('1');
  const [pointsPerWinner, setPointsPerWinner] = useState('0');
  const [prizeMode, setPrizeMode] = useState('shared'); // 'shared' | 'per-winner'
  const [prizeDescription, setPrizeDescription] = useState('');
  const [prizeItemsText, setPrizeItemsText] = useState('');
  const [minAccountDays, setMinAccountDays] = useState('0');
  const [requireReply, setRequireReply] = useState(false);
  const [drawAt, setDrawAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState(null);
  const isEditing = editingDraft != null;
  useEffect(() => {
    if (editingDraft) {
      setTitle(editingDraft.title || '');
      setDescription(editingDraft.description || '');
      setWinnersCount(String(editingDraft.winnersCount ?? 1));
      setPointsPerWinner(String(editingDraft.pointsPerWinner ?? 0));
      const hasPrizeItems = Array.isArray(editingDraft.prizeItems) && editingDraft.prizeItems.length > 0;
      setPrizeMode(hasPrizeItems ? 'per-winner' : 'shared');
      setPrizeDescription(editingDraft.prizeDescription || '');
      setPrizeItemsText(hasPrizeItems ? editingDraft.prizeItems.join('\n') : '');
      setMinAccountDays(String(editingDraft.minAccountDays ?? 0));
      setRequireReply(!!editingDraft.requireReply);
      setDrawAt(toDatetimeLocalValue(editingDraft.drawAt));
    } else {
      setTitle('');
      setDescription('');
      setWinnersCount('1');
      setPointsPerWinner('0');
      setPrizeMode('shared');
      setPrizeDescription('');
      setPrizeItemsText('');
      setMinAccountDays('0');
      setRequireReply(false);
      setDrawAt('');
    }
  }, [editingDraft]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ledger/balance').then(res => res.ok ? res.json() : null).then(d => {
      if (cancelled || !d) return;
      setBalance(Number(d.balance) || 0);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const winners = Number.parseInt(winnersCount, 10);
  const points = Number.parseInt(pointsPerWinner, 10);
  const totalFreeze = Number.isFinite(winners) && Number.isFinite(points) ? Math.max(0, winners) * Math.max(0, points) : 0;
  const oldFrozen = editingDraft?.frozenPoints ?? 0;
  const delta = totalFreeze - oldFrozen;
  const insufficient = balance != null && delta > 0 && delta > balance;
  const setPresetDrawAt = hours => {
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    setDrawAt(toDatetimeLocalValue(target.toISOString()));
  };
  const handleSubmit = async e => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error(pbnT("m2261"));
      return;
    }
    if (!Number.isInteger(winners) || winners < 1 || winners > 1000) {
      toast.error(pbnT("m2262"));
      return;
    }
    if (!Number.isInteger(points) || points < 0) {
      toast.error(pbnT("m2263"));
      return;
    }
    if (!drawAt) {
      toast.error(pbnT("m2264"));
      return;
    }
    const drawDate = new Date(drawAt);
    if (Number.isNaN(drawDate.getTime()) || drawDate.getTime() <= Date.now()) {
      toast.error(pbnT("m2265"));
      return;
    }
    if (insufficient) {
      toast.error(pbnT("m2266"));
      return;
    }

    // 逐项奖品模式：拆行 → 过滤空行 → 校验数量
    let prizeItemsPayload = null;
    if (prizeMode === 'per-winner') {
      const items = prizeItemsText.split('\n').map(s => s.trim()).filter(Boolean);
      if (items.length !== winners) {
        toast.error(pbnT("m2267", {
          arg0: items.length,
          arg1: winners
        }));
        return;
      }
      if (items.some(s => s.length > 500)) {
        toast.error(pbnT("m2268"));
        return;
      }
      prizeItemsPayload = items;
    }
    const body = {
      title: trimmedTitle,
      description: description.trim() || null,
      winnersCount: winners,
      pointsPerWinner: points,
      prizeDescription: prizeMode === 'shared' ? prizeDescription.trim() || null : null,
      prizeItems: prizeItemsPayload,
      minAccountDays: Number.parseInt(minAccountDays, 10) || 0,
      requireReply,
      drawAt: drawDate.toISOString()
    };
    setSubmitting(true);
    try {
      const url = isEditing ? `/api/lotteries/${editingDraft.id}` : '/api/lotteries';
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
        toast.error(data?.error || (isEditing ? pbnT("m495") : pbnT("m2269")));
        return;
      }
      if (isEditing) toast.success(pbnT("m2270"));
      onSubmitted?.(isEditing ? editingDraft.id : data.id, isEditing);
    } catch {
      toast.error(pbnT("m1362"));
    } finally {
      setSubmitting(false);
    }
  };
  return <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      {/* 余额 / 冻结提示 */}
      <div className={`text-xs px-3 py-2 rounded-md border ${insufficient ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-border bg-muted/40 text-muted-foreground'}`}>{pbnT("m2271")}<span className="font-medium text-foreground">{winners || 0} × {points || 0} = {totalFreeze}</span>{pbnT("m2249")}{isEditing && oldFrozen > 0 && <>{pbnT("m2272")}{oldFrozen}，{delta >= 0 ? pbnT("m2273", {
          arg0: delta
        }) : pbnT("m2274", {
          arg0: -delta
        })}）</>}
        {balance != null && <>{pbnT("m2275")}<span className="font-medium text-foreground">{balance}</span></>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="lot-title">{pbnT("m830")}</Label>
        <Input id="lot-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={pbnT("m2276")} maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lot-desc">{pbnT("m2277")}</Label>
        <Textarea id="lot-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder={pbnT("m2278")} maxLength={2000} rows={3} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="lot-winners">{pbnT("m1386")}</Label>
          <Input id="lot-winners" type="number" min={1} max={1000} value={winnersCount} onChange={e => setWinnersCount(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lot-points">{pbnT("m2279")}</Label>
          <Input id="lot-points" type="number" min={0} value={pointsPerWinner} onChange={e => setPointsPerWinner(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{pbnT("m2280")}</Label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="lot-prize-mode" value="shared" checked={prizeMode === 'shared'} onChange={() => setPrizeMode('shared')} className="h-4 w-4" />
            <span>{pbnT("m2281")}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="lot-prize-mode" value="per-winner" checked={prizeMode === 'per-winner'} onChange={() => setPrizeMode('per-winner')} className="h-4 w-4" />
            <span>{pbnT("m2282")}</span>
          </label>
        </div>
        {prizeMode === 'shared' ? <Textarea id="lot-prize" value={prizeDescription} onChange={e => setPrizeDescription(e.target.value)} placeholder={pbnT("m2283")} maxLength={1000} rows={2} /> : <PrizeItemsInput value={prizeItemsText} onChange={setPrizeItemsText} winnersCount={winners} />}
      </div>

      <div className="space-y-2">
        <Label>{pbnT("m2284")}</Label>
        <div className="flex flex-wrap gap-1">
          {DURATION_PRESETS(pbnT).map(p => <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => setPresetDrawAt(p.hours)}>
              {p.label}
            </Button>)}
        </div>
        <Input type="datetime-local" value={drawAt} onChange={e => setDrawAt(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="lot-account-days">{pbnT("m2285")}</Label>
          <Input id="lot-account-days" type="number" min={0} value={minAccountDays} onChange={e => setMinAccountDays(e.target.value)} placeholder={pbnT("m2286")} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer h-9">
            <Checkbox id="lot-require-reply" checked={requireReply} onCheckedChange={v => setRequireReply(v === true)} />
            <span className="text-sm">{pbnT("m2287")}</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {isEditing && <Button type="button" variant="outline" onClick={onCancelEdit} disabled={submitting}>{pbnT("m2242")}</Button>}
        <Button type="submit" disabled={submitting || insufficient}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? pbnT("m114") : pbnT("m2288")}
        </Button>
      </div>
    </form>;
}
function PrizeItemsInput({
  value,
  onChange,
  winnersCount
}) {
  const pbnT = usePbnTranslations();
  const items = value.split('\n').map(s => s.trim()).filter(Boolean);
  const count = items.length;
  const target = Number.isFinite(winnersCount) && winnersCount > 0 ? winnersCount : 0;
  const matched = count === target;
  return <div className="space-y-1">
      <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={pbnT("m2289")} rows={5} />
      <div className={`text-xs ${matched ? 'text-muted-foreground' : 'text-destructive'}`}>{pbnT("m2290")}{" "}{count}{" "}{pbnT("m2291")}{" "}{target}{" "}{pbnT("m1276")}{" "}{!matched && count > 0 && pbnT("m2292")}
      </div>
    </div>;
}
