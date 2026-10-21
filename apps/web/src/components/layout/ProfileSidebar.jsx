'use client';

import { usePbnTranslations } from "@/i18n/useTranslations";
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/components/common/Link';
import { Settings, MessageSquare, Star, MessageCircle, Bell, Mail, ShieldOff, Gift, Coins, ShoppingCart, Package, ChevronDown, ChevronRight, Store, Medal, Wallet } from 'lucide-react';
import { useLedger, useDefaultCurrencyName } from '@/extensions/ledger/contexts/LedgerContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
export default function ProfileSidebar() {
  const pbnT = usePbnTranslations();
  const pathname = usePathname();
  const {
    isWalletEnabled
  } = useLedger();
  const currencyName = useDefaultCurrencyName();
  const [openMenus, setOpenMenus] = useState({
    'content': true,
    'messages': true,
    'rewards-shop': true,
    'account': true
  });
  const toggleMenu = key => {
    setOpenMenus(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };
  const menuItems = [{
    key: 'content',
    label: pbnT("m1499"),
    icon: MessageSquare,
    children: [{
      href: '/profile/topics',
      icon: MessageSquare,
      label: pbnT("m1193")
    }, {
      href: '/profile/replies',
      icon: MessageCircle,
      label: pbnT("m1009")
    }]
  }, {
    key: 'messages',
    label: pbnT("m1509"),
    icon: Mail,
    children: [{
      href: '/profile/messages',
      icon: Mail,
      label: pbnT("m962")
    }, {
      href: '/profile/notifications',
      icon: Bell,
      label: pbnT("m986")
    }]
  }, ...(isWalletEnabled ? [{
    key: 'rewards-shop',
    label: pbnT("m1510"),
    icon: Store,
    children: [{
      href: '/profile/wallet',
      icon: Wallet,
      label: pbnT("m1511")
    }, {
      href: '/profile/shop',
      icon: ShoppingCart,
      label: pbnT("m1512", {
        arg0: currencyName
      })
    }, {
      href: '/profile/items',
      icon: Package,
      label: pbnT("m1513")
    }, {
      href: '/profile/badges',
      icon: Medal,
      label: pbnT("m918")
    }]
  }] : []), {
    key: 'account',
    label: pbnT("m1514"),
    icon: Settings,
    children: [{
      href: '/profile/settings',
      icon: Settings,
      label: pbnT("m1171")
    }, {
      href: '/profile/blocked',
      icon: ShieldOff,
      label: pbnT("m925")
    }, {
      href: '/profile/invitations',
      icon: Gift,
      label: pbnT("m934")
    }]
  }];
  const isActive = href => {
    return pathname === href || pathname?.startsWith(href + '/');
  };
  const renderMenuItem = item => {
    const Icon = item.icon;

    // 处理有子菜单的项
    if (item.children) {
      const isOpen = openMenus[item.key];
      // 检查子菜单是否有激活项
      const hasActiveChild = item.children.some(child => isActive(child.href));
      return <div key={item.key} className="mb-4">
          <button onClick={() => toggleMenu(item.key)} className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors">
            <span>{item.label}</span>
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>

          {isOpen && <div className="mt-1 space-y-0.5">
              {item.children.map(child => renderMenuItem(child))}
            </div>}
        </div>;
    }

    // 处理普通菜单项
    const active = isActive(item.href);
    return <Link key={item.href} href={item.href} className={cn("group flex items-center justify-between gap-3 mx-2 px-3 py-2 text-sm rounded-md transition-colors duration-200", active ? "text-primary font-medium bg-primary/10" : "text-foreground/80 hover:text-foreground hover:bg-muted/50")}>
        <div className="flex items-center gap-2.5">
          <Icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
          <span>{item.label}</span>
        </div>
        {item.badge && <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px] font-medium">
            {item.badge > 99 ? '99+' : item.badge}
          </Badge>}
      </Link>;
  };
  return <nav className="">
      {menuItems.map(item => renderMenuItem(item))}
    </nav>;
}
