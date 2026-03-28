import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HelpCircle, 
  ChevronUp, 
  ChevronDown,
  Search,
  Package,
  GripVertical,
  MessageSquare,
  Paperclip,
  Settings,
  FileSpreadsheet,
  Keyboard,
  Eye,
  Bell,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Language = "en" | "zh";

interface HelpItem {
  icon: React.ElementType;
  title: Record<Language, string>;
  content: Record<Language, string>;
}

interface HelpSection {
  title: Record<Language, string>;
  items: HelpItem[];
}

// Help content for each page
const helpContent: Record<string, HelpSection> = {
  home: {
    title: { en: "Order Management Guide", zh: "订单管理指南" },
    items: [
      {
        icon: Eye,
        title: { en: "Viewing Orders", zh: "查看订单" },
        content: {
          en: "The home page displays all orders from your Shopify store. Click on any order to see detailed information including customer details, products, and pricing.",
          zh: "首页显示您Shopify商店的所有订单。点击任何订单查看详细信息，包括客户详情、产品和定价。"
        }
      },
      {
        icon: Search,
        title: { en: "Searching Orders", zh: "搜索订单" },
        content: {
          en: "Use the search bar to find orders by order number, customer name, or product name. Press / to quickly focus the search field.",
          zh: "使用搜索栏按订单号、客户名称或产品名称查找订单。按 / 键快速聚焦搜索框。"
        }
      },
      {
        icon: Bell,
        title: { en: "Favorites", zh: "收藏夹" },
        content: {
          en: "Click the heart icon on any order to add it to favorites. Use the filter to show only favorited orders. Press F to toggle favorite.",
          zh: "点击任何订单上的心形图标将其添加到收藏夹。使用筛选器仅显示收藏的订单。按 F 键切换收藏。"
        }
      },
      {
        icon: Settings,
        title: { en: "Advanced Filters", zh: "高级筛选" },
        content: {
          en: "Click Filters to access advanced filtering options including date range, fulfillment status, and financial status.",
          zh: "点击筛选访问高级筛选选项，包括日期范围、履行状态和财务状态。"
        }
      },
      {
        icon: Keyboard,
        title: { en: "Keyboard Shortcuts", zh: "键盘快捷键" },
        content: {
          en: "E - Export order | P - Print packing slip | T - Open template | F - Toggle favorite | Esc - Deselect | / - Search | ? - Help",
          zh: "E - 导出订单 | P - 打印装箱单 | T - 打开模板 | F - 切换收藏 | Esc - 取消选择 | / - 搜索 | ? - 帮助"
        }
      }
    ]
  },
  workflow: {
    title: { en: "Workflow Board Guide", zh: "工作流看板指南" },
    items: [
      {
        icon: Eye,
        title: { en: "Kanban Board Overview", zh: "看板概述" },
        content: {
          en: "The workflow board shows orders organized by production stage. Each column represents a stage in your production process.",
          zh: "工作流看板按生产阶段显示订单。每列代表生产过程中的一个阶段。"
        }
      },
      {
        icon: GripVertical,
        title: { en: "Drag and Drop", zh: "拖放操作" },
        content: {
          en: "Drag order cards between columns to update their status. The change is saved automatically and synced in real-time. Use the grip handle on the left of each card.",
          zh: "在列之间拖动订单卡片以更新其状态。更改会自动保存并实时同步。使用每张卡片左侧的拖动手柄。"
        }
      },
      {
        icon: Package,
        title: { en: "Order Card Details", zh: "订单卡片详情" },
        content: {
          en: "Click on any card to open the detail modal with tabs for Overview, Comments (team discussion), and Attachments (file uploads).",
          zh: "点击任何卡片打开详情模态框，包含概述、评论（团队讨论）和附件（文件上传）选项卡。"
        }
      },
      {
        icon: MessageSquare,
        title: { en: "Comments & Attachments", zh: "评论和附件" },
        content: {
          en: "Add comments to discuss orders with your team. Upload files by dragging to the drop zone. Click images to view fullscreen.",
          zh: "添加评论与团队讨论订单。通过拖到放置区上传文件。点击图片全屏查看。"
        }
      },
      {
        icon: Settings,
        title: { en: "Stage Management", zh: "阶段管理" },
        content: {
          en: "Click Manage Stages to customize workflow columns. Add new stages, rename, reorder, set WIP limits, and change colors.",
          zh: "点击管理阶段自定义工作流列。添加新阶段、重命名、重新排序、设置在制品限制和更改颜色。"
        }
      },
      {
        icon: Bell,
        title: { en: "Customer Notifications", zh: "客户通知" },
        content: {
          en: "Enable Notify Customer toggle on order cards to automatically send email updates when the order status changes.",
          zh: "启用订单卡片上的通知客户开关，以便在订单状态更改时自动发送电子邮件更新。"
        }
      }
    ]
  },
  sheets: {
    title: { en: "Spreadsheets Guide", zh: "电子表格指南" },
    items: [
      {
        icon: FileSpreadsheet,
        title: { en: "Exporting Orders", zh: "导出订单" },
        content: {
          en: "From the home page, select an order and click Export to generate a spreadsheet. Press E to quickly export the selected order.",
          zh: "从首页选择一个订单，点击导出生成电子表格。按 E 键快速导出所选订单。"
        }
      },
      {
        icon: Plus,
        title: { en: "Batch Export", zh: "批量导出" },
        content: {
          en: "Use the batch export feature to export multiple orders at once. Select the orders you want and click Batch Export.",
          zh: "使用批量导出功能一次导出多个订单。选择您想要的订单，然后点击批量导出。"
        }
      },
      {
        icon: Eye,
        title: { en: "Generated Spreadsheets", zh: "已生成的电子表格" },
        content: {
          en: "Access all previously generated spreadsheets from this page. You can view, download, or delete spreadsheets.",
          zh: "从此页面访问所有先前生成的电子表格。您可以查看、下载或删除电子表格。"
        }
      },
      {
        icon: Package,
        title: { en: "Packing Slips", zh: "装箱单" },
        content: {
          en: "Generate printable packing slips for orders. Click Print or press P with an order selected.",
          zh: "为订单生成可打印的装箱单。选择订单后点击打印或按 P 键。"
        }
      }
    ]
  }
};

interface ContextualHelpProps {
  page: "home" | "workflow" | "sheets";
  language: Language;
}

export function ContextualHelp({ page, language }: ContextualHelpProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const content = helpContent[page];

  const toggleLabel = {
    en: isExpanded ? "Hide Help" : "Show Help",
    zh: isExpanded ? "隐藏帮助" : "显示帮助"
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-card/95 backdrop-blur-xl border-t border-border overflow-hidden"
          >
            <div className="container mx-auto max-w-4xl px-4 py-6">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                {content.title[language]}
              </h3>
              <Accordion type="single" collapsible className="w-full">
                {content.items.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border-b-0">
                    <AccordionTrigger className="hover:no-underline py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 text-left">
                        <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm">{item.title[language]}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="pl-7 text-sm text-muted-foreground">
                        {item.content[language]}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <div className="bg-card/80 backdrop-blur-sm border-t border-border">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-2 gap-2 text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="w-4 h-4" />
            {toggleLabel[language]}
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
