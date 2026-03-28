import { useState, useEffect, createContext, useContext } from 'react';

export type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    'header.title': 'The Assembly Line',
    'header.subtitle': 'Track the status of your order assembly',
    'header.refresh': 'Refresh',
    'header.addOrder': 'Add Order',
    
    // Stages
    'stage.novo': 'New',
    'stage.em_producao': 'In Production',
    'stage.pronto': 'Ready to Ship',
    'stage.enviado': 'Sent to Agent',
    'stage.entregue': 'Delivered',
    
    // Cards
    'card.notify': 'Notify customer',
    'card.remove': 'Remove',
    'card.viewSpreadsheet': 'View Spreadsheet',
    
    // Dialog
    'dialog.title': 'Add Order to Workflow',
    'dialog.selectFromSheets': 'Select from generated spreadsheets',
    'dialog.orAddManually': 'Or add manually',
    'dialog.orderNumber': 'Order Number',
    'dialog.customerName': 'Customer Name',
    'dialog.customerEmail': 'Customer Email (optional)',
    'dialog.cancel': 'Cancel',
    'dialog.add': 'Add',
    
    // Toasts
    'toast.stageUpdated': 'Stage updated',
    'toast.shopifyUpdated': 'Shopify updated successfully',
    'toast.shopifyError': 'Error notifying Shopify',
    'toast.orderRemoved': 'Order removed from workflow',
    'toast.loadError': 'Error loading orders',
    'toast.updateError': 'Error updating stage',
    'toast.notifyError': 'Error updating notification',
    
    // Empty states
    'empty.noOrders': 'No orders',
    'empty.dragHere': 'Drag orders here',
  },
  zh: {
    // Header
    'header.title': '生产流水线',
    'header.subtitle': '跟踪您的订单组装状态',
    'header.refresh': '刷新',
    'header.addOrder': '添加订单',
    
    // Stages
    'stage.novo': '新订单',
    'stage.em_producao': '生产中',
    'stage.pronto': '待发货',
    'stage.enviado': '已发货',
    'stage.entregue': '已送达',
    
    // Cards
    'card.notify': '通知客户',
    'card.remove': '移除',
    'card.viewSpreadsheet': '查看表格',
    
    // Dialog
    'dialog.title': '添加订单到工作流',
    'dialog.selectFromSheets': '从已生成的表格中选择',
    'dialog.orAddManually': '或手动添加',
    'dialog.orderNumber': '订单号',
    'dialog.customerName': '客户名称',
    'dialog.customerEmail': '客户邮箱（可选）',
    'dialog.cancel': '取消',
    'dialog.add': '添加',
    
    // Toasts
    'toast.stageUpdated': '状态已更新',
    'toast.shopifyUpdated': 'Shopify 更新成功',
    'toast.shopifyError': '通知 Shopify 失败',
    'toast.orderRemoved': '订单已从工作流移除',
    'toast.loadError': '加载订单失败',
    'toast.updateError': '更新状态失败',
    'toast.notifyError': '更新通知失败',
    
    // Empty states
    'empty.noOrders': '暂无订单',
    'empty.dragHere': '将订单拖到这里',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function useLanguageState() {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('app-language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return { language, setLanguage, t };
}

export { LanguageContext, translations };
