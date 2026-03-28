import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { DroppableColumn } from "./DroppableColumn";
import { DraggableCard } from "./DraggableCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkflowStage } from "@/hooks/useWorkflowStages";
import type { Language } from "@/hooks/useLanguage";
import type { Database } from "@/integrations/supabase/types";

type OrderWorkflow = Database["public"]["Tables"]["order_workflow"]["Row"];

interface DynamicKanbanBoardProps {
  orders: OrderWorkflow[];
  stages: WorkflowStage[];
  loading: boolean;
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
  isAdmin?: boolean;
}

export function DynamicKanbanBoard({
  orders,
  stages,
  loading,
  onStageChange,
  onToggleNotify,
  onRemoveOrder,
  onArchiveOrder,
  language,
  isAdmin,
}: DynamicKanbanBoardProps) {
  const [activeOrder, setActiveOrder] = useState<OrderWorkflow | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const order = orders.find((o) => o.id === active.id);
    if (order) {
      setActiveOrder(order);
    }
  }, [orders]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveOrder(null);

    if (!over) return;

    const orderId = active.id as string;
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Get the target stage ID
    let targetStageId: string | null = null;

    // Check if dropped directly on a column
    if (stages.some((s) => s.id === over.id)) {
      targetStageId = over.id as string;
    } else {
      // Dropped on another card - find its stage
      const targetOrder = orders.find((o) => o.id === over.id);
      if (targetOrder) {
        targetStageId = targetOrder.stage_id;
      }
    }

    // Only update if moving to a different stage
    if (targetStageId && targetStageId !== order.stage_id) {
      onStageChange(
        orderId,
        targetStageId,
        order.notify_customer,
        order.order_id,
        order.order_number
      );
    }
  }, [orders, stages, onStageChange]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Optional: Add visual feedback during drag
  }, []);

  if (loading) {
    return (
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex-shrink-0 w-[75vw] sm:w-[280px] snap-center space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // Find the stage of the active order for overlay
  const activeStage = activeOrder 
    ? stages.find((s) => s.id === activeOrder.stage_id) 
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none">
        {stages.map((stage) => {
          const stageOrders = orders.filter((o) => o.stage_id === stage.id);
          
          return (
            <div key={stage.id} className="flex-shrink-0 w-[75vw] sm:w-[280px] snap-center">
              <DroppableColumn
                stage={stage}
                orders={stageOrders}
                allStages={stages}
                onStageChange={onStageChange}
                onToggleNotify={onToggleNotify}
                onRemoveOrder={onRemoveOrder}
                onArchiveOrder={onArchiveOrder}
                language={language}
                isDropTarget={activeOrder !== null}
                isAdmin={isAdmin}
              />
            </div>
          );
        })}
      </div>

      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeOrder && activeStage && (
          <DraggableCard
            order={activeOrder}
            currentStage={activeStage}
            allStages={stages}
            onStageChange={onStageChange}
            onToggleNotify={onToggleNotify}
            onRemoveOrder={onRemoveOrder}
            onArchiveOrder={onArchiveOrder}
            language={language}
            isDragging
            isOverlay
            isAdmin={isAdmin}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
