import * as React from "react";
import { Check, Package, Factory, PackageCheck, Truck, Home } from "lucide-react";
import { cn } from "@/lib/utils";

type OrderStage = "novo" | "em_producao" | "pronto" | "enviado" | "entregue";

interface OrderProgressTrackerProps {
  currentStage: OrderStage;
}

const stages: { key: OrderStage; label: string; icon: React.ElementType }[] = [
  { key: "novo", label: "Order Received", icon: Package },
  { key: "em_producao", label: "In Production", icon: Factory },
  { key: "pronto", label: "Ready for Pickup", icon: PackageCheck },
  { key: "enviado", label: "Shipped", icon: Truck },
  { key: "entregue", label: "Delivered", icon: Home },
];

export function OrderProgressTracker({ currentStage }: OrderProgressTrackerProps) {
  const currentIndex = stages.findIndex((s) => s.key === currentStage);

  return (
    <div className="w-full py-8">
      <div className="relative flex items-center justify-between">
        {/* Progress line background */}
        <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-muted rounded-full" />
        
        {/* Progress line filled */}
        <div 
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-primary rounded-full transition-all duration-500"
          style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
        />

        {/* Stage circles */}
        {stages.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-4 transition-all duration-300",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-background text-primary scale-110 shadow-lg",
                  isPending && "border-muted bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-6 w-6" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  "mt-3 text-xs font-medium text-center max-w-[80px]",
                  (isCompleted || isCurrent) && "text-foreground",
                  isPending && "text-muted-foreground"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
