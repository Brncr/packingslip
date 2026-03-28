import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
  ChevronRight,
  MoreVertical,
  Bell,
  BellOff,
  ExternalLink,
  Trash2,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { translations, type Language } from "@/hooks/useLanguage";
import { DynamicOrderDetailModal } from "./DynamicOrderDetailModal";
import { supabase } from "@/integrations/supabase/client";
import type { WorkflowStage } from "@/hooks/useWorkflowStages";
import type { Database } from "@/integrations/supabase/types";

type OrderWorkflow = Database["public"]["Tables"]["order_workflow"]["Row"];

// Translation mapping for default stage names
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

interface DynamicKanbanCardProps {
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
  language: Language;
}

export function DynamicKanbanCard({
  order,
  currentStage,
  allStages,
  onStageChange,
  onToggleNotify,
  onRemoveOrder,
  language,
}: DynamicKanbanCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const t = (key: string) => translations[language][key] || key;

  // Find next stage by position
  const currentIndex = allStages.findIndex((s) => s.id === currentStage.id);
  const nextStage = currentIndex < allStages.length - 1 
    ? allStages[currentIndex + 1] 
    : null;

  // Load counts
  useEffect(() => {
    const loadCounts = async () => {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id]);

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

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Card
          className="bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setIsModalOpen(true)}
        >
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  #{order.order_number}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {order.customer_name}
                </p>
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
                    onClick={() => onRemoveOrder(order.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("card.remove")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {(commentCount > 0 || attachmentCount > 0) && (
              <div className="flex items-center gap-2 text-muted-foreground">
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
      </motion.div>

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
    </>
  );
}
