import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DraggableCard } from "./DraggableCard";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { translations, type Language } from "@/hooks/useLanguage";
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

interface DroppableColumnProps {
  stage: WorkflowStage;
  orders: OrderWorkflow[];
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
  isDropTarget?: boolean;
  isAdmin?: boolean;
}

export function DroppableColumn({
  stage,
  orders,
  allStages,
  onStageChange,
  onToggleNotify,
  onRemoveOrder,
  onArchiveOrder,
  language,
  isDropTarget,
  isAdmin,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const t = (key: string) => translations[language][key] || key;
  const isOverLimit = stage.wip_limit && orders.length > stage.wip_limit;
  const isAtLimit = stage.wip_limit && orders.length === stage.wip_limit;
  const displayName = translateStageName(stage.name, language);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${stage.color}`} />
        <h3 className="font-semibold text-sm truncate">{displayName}</h3>
        <div className="flex items-center gap-1 ml-auto">
          {stage.wip_limit && (
            <span className={`text-xs ${isOverLimit ? 'text-destructive' : isAtLimit ? 'text-yellow-500' : 'text-muted-foreground'}`}>
              {orders.length}/{stage.wip_limit}
            </span>
          )}
          {!stage.wip_limit && (
            <Badge variant="secondary">
              {orders.length}
            </Badge>
          )}
          {isOverLimit && (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`
          bg-muted/50 rounded-lg p-2 min-h-[200px] max-h-[calc(100vh-220px)] overflow-y-auto space-y-2 transition-all duration-200
          ${isOverLimit ? 'ring-2 ring-destructive/50' : ''}
          ${isOver ? 'ring-2 ring-primary bg-primary/5 scale-[1.02]' : ''}
          ${isDropTarget && !isOver ? 'ring-1 ring-primary/30' : ''}
        `}
      >
        <SortableContext
          items={orders.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {orders.length === 0 ? (
            <div className={`text-xs text-muted-foreground text-center py-8 transition-all ${isOver ? 'text-primary font-medium' : ''}`}>
              {isOver ? (language === 'zh' ? '放在这里' : 'Drop here') : t('empty.noOrders')}
            </div>
          ) : (
            orders.map((order) => (
              <DraggableCard
                key={order.id}
                order={order}
                currentStage={stage}
                allStages={allStages}
                onStageChange={onStageChange}
                onToggleNotify={onToggleNotify}
                onRemoveOrder={onRemoveOrder}
                onArchiveOrder={onArchiveOrder}
                language={language}
                isAdmin={isAdmin}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
