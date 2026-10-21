'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { badgesApi } from '@/extensions/badges/api';
import { toast } from 'sonner';
import { SearchSelect } from '@/components/common/SearchSelect';
import { FormDialog } from '@/components/common/FormDialog';
import { userApi } from '@/lib/api';
export function BadgeAssignmentDialog({
  open,
  onOpenChange,
  badgeList = []
}) {
  const pbnT = usePbnTranslations();
  const [mode, setMode] = useState('grant'); // 'grant' or 'revoke'
  const [selectedUser, setSelectedUser] = useState(null);
  const [badgeId, setBadgeId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    if (!selectedUser || !badgeId) {
      toast.error(pbnT("m1661"));
      return;
    }
    setLoading(true);
    try {
      if (mode === 'grant') {
        await badgesApi.admin.grant({
          userId: selectedUser.id,
          badgeId: parseInt(badgeId),
          reason
        });
        toast.success(pbnT("m1662", {
          arg0: selectedUser.username,
          arg1: badgeId
        }));
      } else {
        await badgesApi.admin.revoke({
          userId: selectedUser.id,
          badgeId: parseInt(badgeId)
        });
        toast.success(pbnT("m1663", {
          arg0: selectedUser.username,
          arg1: badgeId
        }));
      }
      onOpenChange(false);
      // Reset form
      setSelectedUser(null);
      setBadgeId('');
      setReason('');
    } catch (error) {
      console.error('Operation failed:', error);
      toast.error(error.message || pbnT("m568"));
    } finally {
      setLoading(false);
    }
  };
  return <FormDialog open={open} onOpenChange={onOpenChange} title={pbnT("m1664")} description={pbnT("m1665")} submitText={mode === 'grant' ? pbnT("m1666") : pbnT("m1667")} onSubmit={handleSubmit} loading={loading}>
      <Tabs value={mode} onValueChange={setMode} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="grant">{pbnT("m1668")}</TabsTrigger>
          <TabsTrigger value="revoke">{pbnT("m1669")}</TabsTrigger>
        </TabsList>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <SearchSelect value={selectedUser} onChange={setSelectedUser} searchFn={async query => {
            const data = await userApi.getList({
              search: query,
              limit: 10
            });
            return data.items || [];
          }} transformData={user => ({
            id: user.id,
            label: user.name || user.username,
            description: user.username
          })} label={pbnT("m1670")} placeholder={pbnT("m1671")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="badgeId">{pbnT("m1672")}</Label>
            <Select value={badgeId} onValueChange={setBadgeId} required>
              <SelectTrigger>
                <SelectValue placeholder={pbnT("m1673")} />
              </SelectTrigger>
              <SelectContent className="max-h-75">
                {badgeList.map(badge => <SelectItem key={badge.id} value={String(badge.id)}>
                    <div className="flex items-center gap-2">
                       {badge.iconUrl && <img src={badge.iconUrl} className="w-4 h-4 object-contain" alt="" />}
                       <span>{badge.name} (ID: {badge.id})</span>
                    </div>
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="grant" className="mt-0">
            <div className="grid gap-2">
              <Label htmlFor="reason">{pbnT("m1674")}</Label>
              <Input id="reason" placeholder={pbnT("m1675")} value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </TabsContent>
          
          <TabsContent value="revoke" className="mt-0">
             <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{pbnT("m1676")}</div>
          </TabsContent>
        </div>
      </Tabs>
    </FormDialog>;
}
