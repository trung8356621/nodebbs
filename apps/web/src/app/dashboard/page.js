'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { Users, FolderTree, FileText, MessageSquare } from 'lucide-react';
import { dashboardApi } from '@/lib/api';
export default function AdminDashboard() {
  const pbnT = usePbnTranslations();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCategories: 0,
    totalTopics: 0,
    totalPosts: 0
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchStats();
  }, []);
  const fetchStats = async () => {
    try {
      const data = await dashboardApi.getStats();
      setStats({
        totalUsers: data.totalUsers || 0,
        totalCategories: data.totalCategories || 0,
        totalTopics: data.totalTopics || 0,
        totalPosts: data.totalPosts || 0
      });
    } catch (err) {
      console.error("Could not load statistics:", err);
    } finally {
      setLoading(false);
    }
  };
  const statCards = [{
    title: pbnT("m389"),
    value: stats.totalUsers,
    icon: Users,
    color: 'text-blue-500'
  }, {
    title: pbnT("m390"),
    value: stats.totalCategories,
    icon: FolderTree,
    color: 'text-green-500'
  }, {
    title: pbnT("m391"),
    value: stats.totalTopics,
    icon: FileText,
    color: 'text-purple-500'
  }, {
    title: pbnT("m392"),
    value: stats.totalPosts,
    icon: MessageSquare,
    color: 'text-orange-500'
  }];
  return <div className="space-y-6">
      <PageHeader title={pbnT("m393")} description={pbnT("m394")} />

      {/* Stats grid - GitHub style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(stat => {
        const Icon = stat.icon;
        return <div key={stat.title} className="border border-border rounded-lg p-4 bg-card hover:border-muted-foreground/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">
                  {stat.title}
                </span>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="text-3xl font-semibold">
                {loading ? '-' : stat.value.toLocaleString()}
              </div>
            </div>;
      })}
      </div>

      {/* Quick actions */}
      <div className="border border-border rounded-lg bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold">{pbnT("m395")}</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">{pbnT("m396")}</p>
        </div>
      </div>
    </div>;
}
