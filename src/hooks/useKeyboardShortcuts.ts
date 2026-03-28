import { useEffect, useCallback } from "react";

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[], enabled: boolean = true) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        shortcut.handler();
        return;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function useShortcutHelp() {
  return [
    { key: 'E', description: 'Export selected order', descriptionZh: '导出选中订单' },
    { key: 'P', description: 'Print packing slip', descriptionZh: '打印装箱单' },
    { key: 'T', description: 'Open template', descriptionZh: '打开模板' },
    { key: 'F', description: 'Toggle favorite', descriptionZh: '切换收藏' },
    { key: 'R', description: 'Refund order', descriptionZh: '退款订单' },
    { key: 'Esc', description: 'Deselect / Close', descriptionZh: '取消选择 / 关闭' },
    { key: '/', description: 'Focus search', descriptionZh: '聚焦搜索' },
    { key: '?', description: 'Show shortcuts', descriptionZh: '显示快捷键' },
  ];
}
