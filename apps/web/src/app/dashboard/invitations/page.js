'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { InvitationList } from './components/InvitationList';
import { InvitationRules } from './components/InvitationRules';
export default function AdminInvitationsPage() {
  const pbnT = usePbnTranslations();
  return <div className="space-y-6">
      <PageHeader title={pbnT("m346")} description={pbnT("m347")} />

      <Tabs defaultValue="codes" className="gap-4">
        <TabsList className="">
          <TabsTrigger value="codes">{pbnT("m348")}</TabsTrigger>
          <TabsTrigger value="rules">{pbnT("m349")}</TabsTrigger>
        </TabsList>

        <TabsContent value="codes" className="space-y-6">
          <InvitationList />
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
            <InvitationRules />
        </TabsContent>
      </Tabs>
    </div>;
}
