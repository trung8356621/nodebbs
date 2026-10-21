'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { RolesTab } from './components/RolesTab';
import { PermissionsTab } from './components/PermissionsTab';
export default function RolesManagementPage() {
  const pbnT = usePbnTranslations();
  const [activeTab, setActiveTab] = useState('roles');
  return <div className="space-y-6">
      <PageHeader title={pbnT("m549")} description={pbnT("m550")} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="roles">{pbnT("m551")}</TabsTrigger>
          <TabsTrigger value="permissions">{pbnT("m552")}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {activeTab === 'roles' ? <RolesTab /> : <PermissionsTab />}
        </TabsContent>
      </Tabs>
    </div>;
}
