import { KanbanColumn } from "./KanbanColumn";
import { Skeleton } from "@/components/ui/skeleton";
import { translations, type Language } from "@/hooks/useLanguage";
import type { Database } from "@/integrations/supabase/types";

type OrderStage = Database["public"]["Enums"]["order_stage"];
type OrderWorkflow = Database["public"]["Tables"]["order_workflow"]["Row"];

const getStages = (language: Language): { key: OrderStage; label: string; color: string }[] => [
  { key: "novo", label: translations[language]['stage.novo'], color: "bg-blue-500" },
  { key: "em_producao", label: translations[language]['stage.em_producao'], color: "bg-yellow-500" },
  { key: "pronto", label: translations[language]['stage.pronto'], color: "bg-green-500" },
  { key: "enviado", label: translations[language]['stage.enviado'], color: "bg-purple-500" },
  { key: "entregue", label: translations[language]['stage.entregue'], color: "bg-gray-500" },
];

interface KanbanBoardProps {
  orders: OrderWorkflow[];
  loading: boolean;
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

export function KanbanBoard({
  orders,
  loading,
  onStageChange,
  onToggleNotify,
  onRemoveOrder,
  language,
}: KanbanBoardProps) {
  const stages = getStages(language);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stages.map((stage) => (
          <div key={stage.key} className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stages.map((stage) => (
        <KanbanColumn
          key={stage.key}
          stage={stage.key}
          label={stage.label}
          color={stage.color}
          orders={orders.filter((o) => o.current_stage === stage.key)}
          allStages={stages}
          onStageChange={onStageChange}
          onToggleNotify={onToggleNotify}
          onRemoveOrder={onRemoveOrder}
          language={language}
        />
      ))}
    </div>
  );
}
