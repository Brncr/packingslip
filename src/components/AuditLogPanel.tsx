import { useAuditLogs } from "@/hooks/useAuditLogs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Search, RefreshCw, ArrowRightLeft, Trash2, Archive, Bell, Plus, FileSpreadsheet, DollarSign, User, Paperclip, Filter } from "lucide-react";
import { format } from "date-fns";
import type { Language } from "@/hooks/useLanguage";

const actionConfig: Record<string, { icon: React.ElementType; color: string; label: string; labelZh: string }> = {
  stage_change: { icon: ArrowRightLeft, color: "bg-blue-500/10 text-blue-600 border-blue-200", label: "Stage Change", labelZh: "阶段变更" },
  order_removed: { icon: Trash2, color: "bg-red-500/10 text-red-600 border-red-200", label: "Removed", labelZh: "已删除" },
  order_archived: { icon: Archive, color: "bg-amber-500/10 text-amber-600 border-amber-200", label: "Archived", labelZh: "已归档" },
  order_unarchived: { icon: Archive, color: "bg-green-500/10 text-green-600 border-green-200", label: "Unarchived", labelZh: "取消归档" },
  notify_toggled: { icon: Bell, color: "bg-purple-500/10 text-purple-600 border-purple-200", label: "Notification", labelZh: "通知" },
  order_added: { icon: Plus, color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", label: "Added", labelZh: "已添加" },
  spreadsheet_generated: { icon: FileSpreadsheet, color: "bg-teal-500/10 text-teal-600 border-teal-200", label: "Spreadsheet", labelZh: "表格" },
  payment_status: { icon: DollarSign, color: "bg-orange-500/10 text-orange-600 border-orange-200", label: "Payment", labelZh: "付款" },
  comment_added: { icon: User, color: "bg-indigo-500/10 text-indigo-600 border-indigo-200", label: "Comment", labelZh: "评论" },
  attachment_added: { icon: Paperclip, color: "bg-cyan-500/10 text-cyan-600 border-cyan-200", label: "Attachment", labelZh: "附件" },
};

const defaultAction = { icon: ClipboardList, color: "bg-muted text-muted-foreground", label: "Action", labelZh: "操作" };

interface AuditLogPanelProps {
  language: Language;
}

export function AuditLogPanel({ language }: AuditLogPanelProps) {
  const { logs, loading, filter, setFilter, actionTypeFilter, setActionTypeFilter, refetch } = useAuditLogs();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2 sm:px-3">
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">{language === 'zh' ? '日志' : 'Logs'}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold">
              {language === 'zh' ? '操作日志' : 'Activity Logs'}
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={refetch} className="h-8 w-8">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'zh' ? '搜索日志...' : 'Search logs...'}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
            <SelectTrigger className="h-9">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue placeholder={language === 'zh' ? '所有类型' : 'All types'} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'zh' ? '所有类型' : 'All types'}</SelectItem>
              {Object.entries(actionConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {language === 'zh' ? config.labelZh : config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">{language === 'zh' ? '暂无日志' : 'No logs yet'}</p>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              {logs.map((log) => {
                const config = actionConfig[log.action_type] || defaultAction;
                const Icon = config.icon;
                const date = new Date(log.created_at);

                return (
                  <div
                    key={log.id}
                    className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                          {language === 'zh' ? config.labelZh : config.label}
                        </Badge>
                        {log.order_number && (
                          <span className="text-xs font-mono font-semibold text-primary">
                            {log.order_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-0.5 text-foreground leading-snug">
                        {log.description}
                      </p>
                      {log.customer_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {language === 'zh' ? '客户' : 'Customer'}: {log.customer_name}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="font-medium">{log.performed_by}</span>
                        <span>•</span>
                        <span>{format(date, 'dd/MM/yyyy HH:mm:ss')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2.5 text-xs text-muted-foreground text-center">
          {language === 'zh'
            ? `显示 ${logs.length} 条日志`
            : `Showing ${logs.length} log entries`}
        </div>
      </SheetContent>
    </Sheet>
  );
}
