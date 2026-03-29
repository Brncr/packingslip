import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronRight,
  MoreVertical,
  Bell,
  BellOff,
  ExternalLink,
  Trash2,
  MessageSquare,
  Paperclip,
  GripVertical,
  Archive,
  ArchiveRestore,
  DollarSign,
  AlertCircle,
  Truck,
} from "lucide-react";
import { translations, type Language } from "@/hooks/useLanguage";
import { DynamicOrderDetailModal } from "./DynamicOrderDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "sonner";
import { logAuditAction } from "@/hooks/useAuditLogs";
import type { WorkflowStage } from "@/hooks/useWorkflowStages";
import type { Database } from "@/integrations/supabase/types";

type OrderWorkflow = Database["public"]["Tables"]["order_workflow"]["Row"];

// Freight agent options
const FREIGHT_AGENTS = [
  { value: "xingyoung", label: "Send to Xingyoung" },
  { value: "carl", label: "Send to Carl" },
  { value: "other", label: "Send to Other" },
] as const;

interface RecentActivity {
  type: "comment" | "attachment" | "debit";
  author: string;
  description: string;
  created_at: string;
}

const stageNameTranslations: Record<string, Record<Language, string>> = {
  "New": { en: "New", zh: "新订单" },
  "In Production": { en: "In Production", zh: "生产中" },
  "Ready": { en: "Ready", zh: "待发货" },
  "Shipped": { en: "Shipped", zh: "已发货" },
  "Delivered": { en: "Delivered", zh: "已送达" },
};

function translateStageName(name: string, language: Language): string {
  return stageNameTranslations[name]?.[language] || name;
}

interface DraggableCardProps {
  order: OrderWorkflow;
  currentStage: WorkflowStage;
  allStages: WorkflowStage[];
  onStageChange: (
    orderId: string,
    newStageId: string,
    notifyCustomer: boolean,
    shopifyOrderId: string,
    orderNumber: string
  ) => void;
  onToggleNotify: (orderId: string, notify: boolean) => void;
  onRemoveOrder: (orderId: string) => void;
  onArchiveOrder: (orderId: string, archived: boolean) => void;
  language: Language;
  isDragging?: boolean;
  isOverlay?: boolean;
  isAdmin?: boolean;
}

export function DraggableCard({
  order,
  currentStage,
  allStages,
  onStageChange,
  onToggleNotify,
  onRemoveOrder,
  onArchiveOrder,
  language,
  isDragging: externalIsDragging,
  isOverlay,
  isAdmin,
}: DraggableCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState(order.payment_status || 'unpaid');
  const [freightAgent, setFreightAgent] = useState<string>(order.freight_agent || "");
  const [hasRecentActivity, setHasRecentActivity] = useState(false);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const { addDeposit, addDebit } = useWallet();
  const t = (key: string) => translations[language][key] || key;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ 
    id: order.id,
    disabled: isOverlay,
  });

  const isDragging = externalIsDragging || sortableIsDragging;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sortableIsDragging ? 0.5 : 1,
  };

  const currentIndex = allStages.findIndex((s) => s.id === currentStage.id);
  const nextStage = currentIndex < allStages.length - 1 
    ? allStages[currentIndex + 1] 
    : null;

  // Sync local state with prop changes (realtime)
  useEffect(() => {
    setFreightAgent(order.freight_agent || "");
  }, [order.freight_agent]);

  // Get current user name for read tracking (admin from token, agent from saved name)
  const currentUser = (() => {
    const token = localStorage.getItem("admin-auth-token");
    if (token) {
      try {
        const decoded = JSON.parse(atob(token));
        if (decoded.exp && decoded.exp > Date.now()) return decoded.username || "Admin";
      } catch {}
    }
    return localStorage.getItem("comment-author-name") || "Agent";
  })();

  useEffect(() => {
    if (isOverlay) return;
    
    const loadCounts = async () => {
      // Get this user's last read timestamp for this card
      const { data: readStatus } = await supabase
        .from("card_read_status")
        .select("last_read_at")
        .eq("workflow_id", order.id)
        .eq("user_name", currentUser)
        .maybeSingle();
      
      const lastReadAt = readStatus?.last_read_at;

      const [commentsRes, attachmentsRes] = await Promise.all([
        supabase
          .from("order_comments")
          .select("id", { count: "exact", head: true })
          .eq("workflow_id", order.id),
        supabase
          .from("order_attachments")
          .select("id", { count: "exact", head: true })
          .eq("workflow_id", order.id),
      ]);
      setCommentCount(commentsRes.count || 0);
      setAttachmentCount(attachmentsRes.count || 0);
      
      // Only check for new activity if user has previously read this card
      if (lastReadAt) {
        const [newCommentsRes, newAttachmentsRes, pendingDebitsRes] = await Promise.all([
          supabase
            .from("order_comments")
            .select("id, author_name, content, created_at")
            .eq("workflow_id", order.id)
            .gt("created_at", lastReadAt)
            .neq("author_name", currentUser)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("order_attachments")
            .select("id, uploaded_by, file_name, created_at")
            .eq("workflow_id", order.id)
            .gt("created_at", lastReadAt)
            .neq("uploaded_by", currentUser)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("pending_debits")
            .select("id, created_by, description, amount, created_at")
            .eq("workflow_id", order.id)
            .eq("status", "pending")
            .neq("created_by", currentUser)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        
        // Combine and format recent activities
        const activities: RecentActivity[] = [];
        
        newCommentsRes.data?.forEach(c => {
          activities.push({
            type: "comment",
            author: c.author_name,
            description: c.content.substring(0, 50) + (c.content.length > 50 ? "..." : ""),
            created_at: c.created_at,
          });
        });
        
        newAttachmentsRes.data?.forEach(a => {
          activities.push({
            type: "attachment",
            author: a.uploaded_by,
            description: a.file_name,
            created_at: a.created_at,
          });
        });
        
        pendingDebitsRes.data?.forEach(d => {
          activities.push({
            type: "debit",
            author: d.created_by,
            description: d.description || `$${d.amount}`,
            created_at: d.created_at,
          });
        });
        
        // Sort by date and take top 3
        activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setRecentActivities(activities.slice(0, 3));
        setHasRecentActivity(activities.length > 0);
      } else {
        setHasRecentActivity(false);
        setRecentActivities([]);
      }
    };
    loadCounts();

    const channel = supabase
      .channel(`counts-${order.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_comments", filter: `workflow_id=eq.${order.id}` },
        () => loadCounts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_attachments", filter: `workflow_id=eq.${order.id}` },
        () => loadCounts()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_debits", filter: `workflow_id=eq.${order.id}` },
        () => loadCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id, isOverlay, currentUser]);

  const handleQuickAdvance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nextStage || isUpdating) return;
    setIsUpdating(true);
    await onStageChange(
      order.id,
      nextStage.id,
      order.notify_customer,
      order.order_id,
      order.order_number
    );
    setIsUpdating(false);
  };

  const handleStageSelect = async (newStageId: string) => {
    if (newStageId === currentStage.id || isUpdating) return;
    setIsUpdating(true);
    await onStageChange(
      order.id,
      newStageId,
      order.notify_customer,
      order.order_id,
      order.order_number
    );
    setIsUpdating(false);
  };

  const handlePaymentStatusChange = async (value: string) => {
    const previousStatus = paymentStatus;
    setPaymentStatus(value);
    
    await supabase
      .from("order_workflow")
      .update({ payment_status: value } as any)
      .eq("id", order.id);

    // Create activity notification for payment status change
    await supabase.from("activity_notifications").insert({
      workflow_id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      activity_type: "cost_update",
      description: `Payment: ${previousStatus} → ${value}`,
      created_by: currentUser,
    });

    // Audit log
    logAuditAction({
      action_type: 'payment_status',
      order_number: order.order_number,
      customer_name: order.customer_name,
      description: `Payment status: ${previousStatus} → ${value}`,
    });

    const cost = order.total_cost || 0;
    if (cost <= 0) return;

    const agentName = localStorage.getItem("wallet-user") || "System";

    if (value === "paid" && previousStatus !== "paid") {
      await addDeposit(cost, `#${order.order_number}: Payment received`, agentName);
      toast.success(`#${order.order_number}: $${cost.toFixed(2)} credited to wallet`);
    } else if (value === "unpaid" && previousStatus === "paid") {
      await addDebit(cost, `#${order.order_number}: Payment reverted`, agentName, order.id);
      toast.info(`#${order.order_number}: $${cost.toFixed(2)} reversed from wallet`);
    }
  };

  const handleFreightAgentChange = async (value: string) => {
    const previousValue = freightAgent;
    setFreightAgent(value);

    const { error } = await supabase
      .from("order_workflow")
      .update({ freight_agent: value })
      .eq("id", order.id);

    if (error) {
      console.error("Error updating freight agent:", error);
      setFreightAgent(previousValue);
    }
  };

  // Get badge color for freight agent
  const getAgentColor = (value: string) => {
    switch (value) {
      case "xingyoung":
        return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800";
      case "carl":
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
      case "other":
        return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";
      default:
        return "";
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`
          ${isDragging && isOverlay ? 'shadow-2xl scale-105 rotate-2' : ''}
          ${sortableIsDragging ? 'z-50' : ''}
        `}
      >
        <Card
          className={`
            bg-card shadow-sm cursor-pointer hover:shadow-md transition-all duration-200
            ${isDragging ? 'ring-2 ring-primary shadow-lg' : ''}
          `}
          onClick={() => {
            if (!isDragging) {
              setIsModalOpen(true);
              // Mark as read for this user
              setHasRecentActivity(false);
              supabase
                .from("card_read_status")
                .upsert(
                  { workflow_id: order.id, user_name: currentUser, last_read_at: new Date().toISOString() },
                  { onConflict: "workflow_id,user_name" }
                )
                .then();
            }
          }}
        >
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Drag handle */}
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm truncate">
                      #{order.order_number}
                    </p>
                    {hasRecentActivity && recentActivities.length > 0 && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="relative flex h-4 w-4 shrink-0 cursor-help" onClick={(e) => e.stopPropagation()}>
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                              <AlertCircle className="relative h-4 w-4 text-destructive" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs p-2">
                            <div className="space-y-1.5">
                              <p className="font-semibold text-xs text-foreground">
                                {language === "zh" ? "最新活动" : "Atividade recente"}
                              </p>
                              {recentActivities.map((activity, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-xs">
                                  <span className="shrink-0">
                                    {activity.type === "comment" && "💬"}
                                    {activity.type === "attachment" && "📎"}
                                    {activity.type === "debit" && "💰"}
                                  </span>
                                  <span className="text-muted-foreground">
                                    <span className="font-medium text-foreground">{activity.author}:</span>{" "}
                                    {activity.description}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.customer_name}
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allStages.map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      onClick={() => handleStageSelect(stage.id)}
                      disabled={stage.id === currentStage.id}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${stage.color}`}
                      />
                      {translateStageName(stage.name, language)}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {order.spreadsheet_url && (
                    <DropdownMenuItem asChild>
                      <a
                        href={order.spreadsheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t("card.viewSpreadsheet")}
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => onArchiveOrder(order.id, !order.archived)}
                  >
                    {order.archived ? (
                      <>
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        {language === 'zh' ? '取消归档' : 'Unarchive'}
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4 mr-2" />
                        {language === 'zh' ? '归档' : 'Archive'}
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onRemoveOrder(order.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("card.remove")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Cost & counts indicators */}
            <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
              {order.total_cost !== null && order.total_cost > 0 && (
                <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary bg-primary/5">
                  <DollarSign className="h-3 w-3" />
                  {order.total_cost.toFixed(0)}
                </Badge>
              )}
              {commentCount > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <MessageSquare className="h-3 w-3" />
                  {commentCount}
                </div>
              )}
              {attachmentCount > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <Paperclip className="h-3 w-3" />
                  {attachmentCount}
                </div>
              )}
            </div>

            {/* Freight Agent Selector */}
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={freightAgent}
                onValueChange={handleFreightAgentChange}
              >
                <SelectTrigger
                  className={`h-8 text-xs w-full ${
                    freightAgent
                      ? getAgentColor(freightAgent)
                      : "text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Truck className="h-3 w-3 flex-shrink-0" />
                    <SelectValue
                      placeholder={
                        language === "zh"
                          ? "选择货运代理"
                          : "Select freight agent"
                      }
                    />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {FREIGHT_AGENTS.map((agent) => (
                    <SelectItem key={agent.value} value={agent.value}>
                      {agent.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment status - admin only */}
            {isAdmin && (
              <div onClick={(e) => e.stopPropagation()}>
                <Select value={paymentStatus} onValueChange={handlePaymentStatusChange}>
                  <SelectTrigger className={`h-7 text-xs w-full ${paymentStatus === 'paid' ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'}`}>
                    <DollarSign className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">{language === 'zh' ? '未付款' : 'Unpaid'}</SelectItem>
                    <SelectItem value="paid">{language === 'zh' ? '已付款' : 'Paid'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {order.notify_customer ? (
                  <Bell className="h-3 w-3 text-primary" />
                ) : (
                  <BellOff className="h-3 w-3 text-muted-foreground" />
                )}
                <Switch
                  checked={order.notify_customer}
                  onCheckedChange={(checked) => onToggleNotify(order.id, checked)}
                  className="scale-75"
                />
              </div>

              {nextStage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleQuickAdvance}
                  disabled={isUpdating}
                >
                  {language === "zh" ? "前进" : "Advance"}
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}

              {!nextStage && (
                <Badge variant="secondary" className="text-xs">
                  {language === "zh" ? "已完成" : "Completed"}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {!isOverlay && (
        <DynamicOrderDetailModal
          order={order}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          language={language}
          stageLabel={translateStageName(currentStage.name, language)}
          stageColor={currentStage.color}
          allStages={allStages}
          onStageChange={(orderId, newStageId) =>
            onStageChange(orderId, newStageId, order.notify_customer, order.order_id, order.order_number)
          }
          onToggleNotify={onToggleNotify}
        />
      )}
    </>
  );
}
