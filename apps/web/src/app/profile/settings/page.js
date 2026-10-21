'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { User, Lock, Shield } from 'lucide-react';

// 导入 Tab 组件（各自内部管理状态）
import { ProfileTab } from './components/ProfileTab';
import { PrivacyTab } from './components/PrivacyTab';
import { SecurityTab } from './components/SecurityTab';

/**
 * 设置页面
 * 简洁入口，各 Tab 内部自管理状态
 */
export default function SettingsPage() {
  const pbnT = usePbnTranslations();
  // 受控 tab：无密码用户在「关联账号」里点「去设置密码」需要跳到安全设置
  const [activeTab, setActiveTab] = useState('profile');
  return <div>
      <PageHeader title={pbnT("m1171")} description={pbnT("m1172")} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className='space-y-6'>
        <TabsList className='grid grid-cols-3'>
          <TabsTrigger value='profile'>
            <User className='h-4 w-4' />{pbnT("m1112")}</TabsTrigger>
          <TabsTrigger value='privacy'>
            <Shield className='h-4 w-4' />{pbnT("m1173")}</TabsTrigger>
          <TabsTrigger value='security'>
            <Lock className='h-4 w-4' />{pbnT("m1174")}</TabsTrigger>
        </TabsList>

        <TabsContent value='profile'>
          <ProfileTab onGoToSecurity={() => setActiveTab('security')} />
        </TabsContent>

        <TabsContent value='privacy'>
          <PrivacyTab />
        </TabsContent>

        <TabsContent value='security'>
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>;
}
