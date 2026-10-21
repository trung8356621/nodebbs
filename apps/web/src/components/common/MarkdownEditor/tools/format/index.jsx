import { usePbnTranslations } from "@/i18n/useTranslations";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import React, { useRef } from 'react';
import { Bold, Italic, Strikethrough, Code, Quote, List, ListOrdered, ListTodo, Minus, FileCode, Heading, Heading2, Heading3, Heading4, Heading5, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// 基础格式化工具定义
const FORMAT_TOOLS = (pbnT = pbnRuntimeT) => ({
  bold: {
    icon: Bold,
    title: pbnT("m1317"),
    before: '**',
    after: '**'
  },
  italic: {
    icon: Italic,
    title: pbnT("m1318"),
    before: '*',
    after: '*'
  },
  strike: {
    icon: Strikethrough,
    title: pbnT("m1319"),
    before: '~~',
    after: '~~'
  },
  code: {
    icon: Code,
    title: pbnT("m1320"),
    before: '`',
    after: '`'
  },
  codeBlock: {
    icon: FileCode,
    title: pbnT("m1321"),
    before: '```\n',
    after: '\n```'
  },
  quote: {
    icon: Quote,
    title: pbnT("m1322"),
    blockPrefix: '> '
  },
  bulletList: {
    icon: List,
    title: pbnT("m1323"),
    blockPrefix: '- '
  },
  orderedList: {
    icon: ListOrdered,
    title: pbnT("m1324"),
    blockPrefix: '1. '
  },
  checklist: {
    icon: ListTodo,
    title: pbnT("m1325"),
    blockPrefix: '- [ ] '
  },
  horizontalRule: {
    icon: Minus,
    title: pbnT("m1326"),
    blockPrefix: '---'
  }
});
export const FormatTool = ({
  type,
  editor,
  disabled
}) => {
  const pbnT = usePbnTranslations();
  const config = FORMAT_TOOLS(pbnT)[type];
  if (!config) return null;
  const handleClick = () => {
    if (config.blockPrefix) {
      editor.insertBlock(config.blockPrefix);
    } else {
      editor.insertText(config.before, config.after);
    }
  };
  return <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleClick} disabled={disabled} title={config.title}>
      <config.icon className="h-4 w-4" />
    </Button>;
};
export const HeadingTool = ({
  editor,
  disabled
}) => {
  const pbnT = usePbnTranslations();
  const pendingPrefixRef = useRef(null);
  const options = [{
    label: pbnT("m1327"),
    value: '## ',
    icon: Heading2
  }, {
    label: pbnT("m1328"),
    value: '### ',
    icon: Heading3
  }, {
    label: pbnT("m1329"),
    value: '#### ',
    icon: Heading4
  }, {
    label: pbnT("m1330"),
    value: '##### ',
    icon: Heading5
  }];

  // DropdownMenu 默认 modal，菜单打开期间焦点被 trap，而 Radix 是先跑我们的
  // onClick、后关闭菜单。此时插入会让 execCommand 落空并清空撤销历史，
  // 因此只暂存选择，等菜单关闭、焦点锁解除后再插入
  const handleCloseAutoFocus = e => {
    const prefix = pendingPrefixRef.current;
    if (!prefix) return;
    pendingPrefixRef.current = null;
    e.preventDefault(); // 阻止焦点回到触发按钮，让光标落回编辑器
    editor.insertBlock(prefix);
  };
  return <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" disabled={disabled} title={pbnT("m830")}>
          <Heading className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={handleCloseAutoFocus}>
        {options.map(option => <DropdownMenuItem key={option.value} onClick={() => {
        pendingPrefixRef.current = option.value;
      }} className="gap-2">
            <option.icon className="h-4 w-4" />
            {option.label}
          </DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>;
};
