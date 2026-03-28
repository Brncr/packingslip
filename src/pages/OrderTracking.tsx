import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderProgressTracker } from "@/components/tracking/OrderProgressTracker";
import { OrderTimeline } from "@/components/tracking/OrderTimeline";
import { Package, User, Calendar, AlertCircle, Wifi } from "lucide-react";
import { format } from "date-fns";
import twitterLogo from "@/assets/twitter-logo.png";

type OrderStage = "novo" | "em_producao" | "pronto" | "enviado" | "entregue";

interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  current_stage: OrderStage;
  created_at: string;
  updated_at: string;
}

interface HistoryEntry {
  id: string;
  from_stage: OrderStage | null;
  to_stage: OrderStage;
  changed_at: string;
  notified_customer: boolean;
}

export default function OrderTracking() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const queryClient = useQueryClient();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order-tracking", orderNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_workflow")
        .select("id, order_number, customer_name, current_stage, created_at, updated_at")
        .eq("order_number", orderNumber)
        .single();

      if (error) throw error;
      return data as OrderData;
    },
    enabled: !!orderNumber,
  });

  const { data: history } = useQuery({
    queryKey: ["order-history", order?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_stage_history")
        .select("id, from_stage, to_stage, changed_at, notified_customer")
        .eq("workflow_id", order!.id)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      return data as HistoryEntry[];
    },
    enabled: !!order?.id,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!order?.id) return;

    console.log("🔌 Subscribing to realtime updates for order:", order.order_number);

    // Subscribe to order_workflow changes
    const workflowChannel = supabase
      .channel(`order-tracking-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_workflow',
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          console.log("📦 Order status changed:", payload.new);
          // Update the order data in cache
          queryClient.setQueryData(["order-tracking", orderNumber], (old: OrderData | undefined) => {
            if (!old) return old;
            return { ...old, ...payload.new };
          });
        }
      )
      .subscribe((status) => {
        console.log("📡 Workflow subscription status:", status);
      });

    // Subscribe to order_stage_history changes (new entries)
    const historyChannel = supabase
      .channel(`order-history-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_stage_history',
          filter: `workflow_id=eq.${order.id}`,
        },
        (payload) => {
          console.log("📜 New history entry:", payload.new);
          // Invalidate history query to refetch
          queryClient.invalidateQueries({ queryKey: ["order-history", order.id] });
        }
      )
      .subscribe((status) => {
        console.log("📡 History subscription status:", status);
      });

    return () => {
      console.log("🔌 Unsubscribing from realtime updates");
      supabase.removeChannel(workflowChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [order?.id, order?.order_number, orderNumber, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <Skeleton className="h-12 w-12 mx-auto rounded-full" />
            <Skeleton className="h-6 w-48 mx-auto" />
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
            <p className="text-muted-foreground">
              We couldn't find an order with number <strong>{orderNumber}</strong>. 
              Please check the order number and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img 
            src={twitterLogo} 
            alt="Twitter Bike USA" 
            className="h-12 w-auto mx-auto"
          />
          <div>
            <h1 className="text-2xl font-bold">Order Tracking</h1>
            <p className="text-muted-foreground text-sm flex items-center justify-center gap-1">
              <Wifi className="h-3 w-3 text-primary" />
              Live updates enabled
            </p>
          </div>
        </div>

        {/* Order Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Order #{order.order_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium">{order.customer_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Order Date:</span>
              <span className="font-medium">
                {format(new Date(order.created_at), "MMM d, yyyy")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Progress Tracker */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">Production Status</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderProgressTracker currentStage={order.current_stage} />
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderTimeline history={history || []} />
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Questions about your order? Contact us at support@twitterbikeusa.com
        </p>
      </div>
    </div>
  );
}
