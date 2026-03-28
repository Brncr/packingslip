import * as React from "react";
import { Package, Factory, PackageCheck, Truck, Home, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type OrderStage = "novo" | "em_producao" | "pronto" | "enviado" | "entregue";

interface HistoryEntry {
  id: string;
  from_stage: OrderStage | null;
  to_stage: OrderStage;
  changed_at: string;
  notified_customer: boolean;
}

interface OrderTimelineProps {
  history: HistoryEntry[];
}

const stageConfig: Record<OrderStage, { label: string; icon: React.ElementType; color: string }> = {
  novo: { label: "Order Received", icon: Package, color: "text-blue-500" },
  em_producao: { label: "In Production", icon: Factory, color: "text-amber-500" },
  pronto: { label: "Ready for Pickup", icon: PackageCheck, color: "text-emerald-500" },
  enviado: { label: "Shipped", icon: Truck, color: "text-purple-500" },
  entregue: { label: "Delivered", icon: Home, color: "text-green-600" },
};

export function OrderTimeline({ history }: OrderTimelineProps) {
  // Sort history by date, newest first
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  if (sortedHistory.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No status updates yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {sortedHistory.map((entry, index) => {
          const config = stageConfig[entry.to_stage];
          const Icon = config.icon;
          const isLatest = index === 0;

          return (
            <div key={entry.id} className="relative flex items-start gap-4 pl-10">
              {/* Icon circle */}
              <div
                className={cn(
                  "absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background",
                  isLatest ? "border-primary" : "border-muted"
                )}
              >
                <Icon className={cn("h-4 w-4", config.color)} />
              </div>

              {/* Content */}
              <div className={cn("flex-1 pb-4", !isLatest && "opacity-70")}>
                <p className={cn("font-medium", isLatest && "text-foreground")}>
                  {config.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(entry.changed_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
