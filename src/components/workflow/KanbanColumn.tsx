import { AnimatePresence } from "framer-motion";
import { KanbanCard } from "./KanbanCard";
import { Badge } from "@/components/ui/badge";
import { translations, type Language } from "@/hooks/useLanguage";
import type { Database } from "@/integrations/supabase/types";

type OrderStage = Database["public"]["Enums"]["order_stage"];
type OrderWorkflow = Database["public"]["Tables"]["order_workflow"]["Row"];

interface KanbanColumnProps {
  stage: OrderStage;
  label: string;
  color: string;
  orders: OrderWorkflow[];
  allStages: { key: OrderStage; label: string; color: string }[];
  onStageChange: (
    orderId: string,
    newStage: OrderStage,
    notifyCustomer: boolean,
    shopifyOrderId: string,
    orderNumber: string
  ) => void;
  onToggleNotify: (orderId: string, notify: boolean) => void;
  onRemoveOrder: (orderId: string) => void;
  language: Language;
}

export function KanbanColumn({
  stage,
  label,
  color,
  orders,
  allStages,
  onStageChange,
  onToggleNotify,
  onRemoveOrder,
  language,
}: KanbanColumnProps) {
  const t = (key: string) => translations[language][key] || key;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <h3 className="font-semibold text-sm">{label}</h3>
        <Badge variant="secondary" className="ml-auto">
          {orders.length}
        </Badge>
      </div>

      <div className="bg-muted/50 rounded-lg p-2 min-h-[400px] space-y-2">
        {orders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            {t('empty.noOrders')}
          </p>
        ) : (
          <AnimatePresence mode="popLayout">
            {orders.map((order) => (
              <KanbanCard
                key={order.id}
                order={order}
                currentStage={stage}
                allStages={allStages}
                onStageChange={onStageChange}
                onToggleNotify={onToggleNotify}
                onRemoveOrder={onRemoveOrder}
                language={language}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
