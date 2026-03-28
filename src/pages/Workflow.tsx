import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DynamicKanbanBoard } from "@/components/workflow/DynamicKanbanBoard";
import { StageManagement } from "@/components/workflow/StageManagement";
import { AddOrderDialog } from "@/components/workflow/AddOrderDialog";
import { LanguageSelector } from "@/components/LanguageSelector";
import { NotificationBell } from "@/components/NotificationBell";
import { GeneralChat } from "@/components/GeneralChat";
import { ContextualHelp } from "@/components/ContextualHelp";
import { WalletDisplay } from "@/components/wallet/WalletDisplay";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, RefreshCw, Archive, ArrowUpDown, Search, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguageState } from "@/hooks/useLanguage";
import { useWorkflowStages } from "@/hooks/useWorkflowStages";
import { useWallet } from "@/hooks/useWallet";
import { logAuditAction } from "@/hooks/useAuditLogs";
import type { Database } from "@/integrations/supabase/types";

type OrderWorkflow = Database["public"]["Tables"]["order_workflow"]["Row"];
type SortOption = "newest" | "oldest" | "order_number_asc" | "order_number_desc";

export default function Workflow() {
  const [orders, setOrders] = useState<OrderWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguageState();
  const { stages, loading: stagesLoading, addStage, updateStage, deleteStage, reorderStages, refetch: refetchStages } = useWorkflowStages();
  const { wallet, refetch: refetchWallet } = useWallet();
  const { isAuthenticated: isAdmin } = useAdminAuth();
  

  // Mark all cards as read on page load
  useEffect(() => {
    const markAllAsRead = async () => {
      if (orders.length === 0) return;
      
      const token = localStorage.getItem("admin-auth-token");
      let currentUser = "Agent";
      if (token) {
        try {
          const decoded = JSON.parse(atob(token));
          if (decoded.exp && decoded.exp > Date.now()) currentUser = decoded.username || "Admin";
        } catch {}
      } else {
        currentUser = localStorage.getItem("comment-author-name") || "Agent";
      }
      const now = new Date().toISOString();
      
      const updates = orders.map(order => ({
        workflow_id: order.id,
        user_name: currentUser,
        last_read_at: now,
      }));
      
      try {
        await supabase
          .from("card_read_status")
          .upsert(updates, { onConflict: "workflow_id,user_name" });
      } catch (err) {
        console.error("Failed to mark cards as read:", err);
      }
    };
    
    markAllAsRead();
  }, []); // Run only once on mount

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => showArchived ? o.archived : !o.archived);
    
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(o =>
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q)
      );
    }
    
    // Apply sorting
    switch (sortBy) {
      case "newest":
        result = [...result].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "oldest":
        result = [...result].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "order_number_asc":
        result = [...result].sort((a, b) => 
          a.order_number.localeCompare(b.order_number, undefined, { numeric: true })
        );
        break;
      case "order_number_desc":
        result = [...result].sort((a, b) => 
          b.order_number.localeCompare(a.order_number, undefined, { numeric: true })
        );
        break;
    }
    
    return result;
  }, [orders, showArchived, sortBy, searchQuery]);

  // Count archived orders
  const archivedCount = useMemo(() => {
    return orders.filter(o => o.archived).length;
  }, [orders]);

  // Calculate order counts per stage
  const orderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    stages.forEach((stage) => {
      counts[stage.id] = filteredOrders.filter((o) => o.stage_id === stage.id).length;
    });
    return counts;
  }, [filteredOrders, stages]);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("order_workflow")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast({ title: t('toast.loadError'), variant: "destructive" });
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  // Migrate orders without stage_id to first stage
  const migrateOrders = async () => {
    if (stages.length === 0) return;
    
    const firstStage = stages[0];
    const ordersWithoutStage = orders.filter((o) => !o.stage_id);
    
    if (ordersWithoutStage.length > 0) {
      // Map current_stage enum to new stage IDs
      const stageMapping: Record<string, string> = {};
      const stageNameMap: Record<string, string> = {
        novo: "New",
        em_producao: "In Production",
        pronto: "Ready",
        enviado: "Shipped",
        entregue: "Delivered",
      };
      
      stages.forEach((stage) => {
        Object.entries(stageNameMap).forEach(([key, name]) => {
          if (stage.name === name || stage.name.toLowerCase().includes(key.replace("_", " "))) {
            stageMapping[key] = stage.id;
          }
        });
      });

      for (const order of ordersWithoutStage) {
        const newStageId = stageMapping[order.current_stage] || firstStage.id;
        await supabase
          .from("order_workflow")
          .update({ stage_id: newStageId })
          .eq("id", order.id);
      }
      
      fetchOrders();
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("order_workflow_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_workflow" },
        (payload) => {
          console.log("Realtime update:", payload);
          if (payload.eventType === "INSERT") {
            setOrders((prev) => [payload.new as OrderWorkflow, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === (payload.new as OrderWorkflow).id
                  ? (payload.new as OrderWorkflow)
                  : o
              )
            );
          } else if (payload.eventType === "DELETE") {
            setOrders((prev) =>
              prev.filter((o) => o.id !== (payload.old as OrderWorkflow).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Run migration when stages and orders are loaded
  useEffect(() => {
    if (!stagesLoading && stages.length > 0 && orders.length > 0) {
      migrateOrders();
    }
  }, [stagesLoading, stages.length, orders.length]);

  const handleStageChange = async (
    orderId: string,
    newStageId: string,
    notifyCustomer: boolean,
    shopifyOrderId: string,
    orderNumber: string
  ) => {
    const currentOrder = orders.find((o) => o.id === orderId);
    const fromStageId = currentOrder?.stage_id;

    // OPTIMISTIC UPDATE
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, stage_id: newStageId } : o
      )
    );

    const { error } = await supabase
      .from("order_workflow")
      .update({ stage_id: newStageId })
      .eq("id", orderId);

    if (error) {
      console.error("Error updating stage:", error);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, stage_id: fromStageId } : o
        )
      );
      toast({ title: t('toast.updateError'), variant: "destructive" });
      return;
    }

    const fromStage = stages.find((s) => s.id === fromStageId);
    const toStage = stages.find((s) => s.id === newStageId);
    logAuditAction({
      action_type: 'stage_change',
      order_number: orderNumber,
      customer_name: currentOrder?.customer_name,
      description: `Stage: ${fromStage?.name || '?'} → ${toStage?.name || '?'}`,
      metadata: { from_stage_id: fromStageId, to_stage_id: newStageId },
    });

    // Create activity notification for stage change
    const userName = (() => {
      const token = localStorage.getItem("admin-auth-token");
      if (token) {
        try {
          const decoded = JSON.parse(atob(token));
          if (decoded.exp && decoded.exp > Date.now()) return decoded.username || "Admin";
        } catch {}
      }
      return localStorage.getItem("comment-author-name") || "Agent";
    })();
    
    await supabase.from("activity_notifications").insert({
      workflow_id: orderId,
      order_number: orderNumber,
      customer_name: currentOrder?.customer_name || "",
      activity_type: "stage_change",
      description: `${fromStage?.name || '?'} → ${toStage?.name || '?'}`,
      created_by: userName,
    });

    toast({ title: t('toast.stageUpdated') });
    const newStage = stages.find((s) => s.id === newStageId);
    if (notifyCustomer && shopifyOrderId && newStage) {
      supabase.functions.invoke("shopify-notify-customer", {
        body: {
          orderId: shopifyOrderId,
          orderNumber,
          stage: newStage.name,
          notifyCustomer: true,
          language,
        },
      });
    }
  };

  const handleToggleNotify = async (orderId: string, notify: boolean) => {
    const currentOrder = orders.find((o) => o.id === orderId);
    const previousValue = currentOrder?.notify_customer;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, notify_customer: notify } : o
      )
    );

    const { error } = await supabase
      .from("order_workflow")
      .update({ notify_customer: notify })
      .eq("id", orderId);

    if (error) {
      console.error("Error updating notify:", error);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, notify_customer: previousValue! } : o
        )
      );
      toast({ title: t('toast.notifyError'), variant: "destructive" });
    } else {
      logAuditAction({
        action_type: 'notify_toggled',
        order_number: currentOrder?.order_number,
        customer_name: currentOrder?.customer_name,
        description: `Notification ${notify ? 'enabled' : 'disabled'}`,
      });
    }
  };

  const handleRemoveOrder = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    const { error } = await supabase
      .from("order_workflow")
      .delete()
      .eq("id", orderId);

    if (error) {
      console.error("Error removing order:", error);
      toast({ title: t('toast.notifyError'), variant: "destructive" });
    } else {
      logAuditAction({
        action_type: 'order_removed',
        order_number: order?.order_number,
        customer_name: order?.customer_name,
        description: `Order removed from workflow`,
      });
      toast({ title: t('toast.orderRemoved') });
    }
  };

  const handleRefresh = () => {
    fetchOrders();
    refetchStages();
    refetchWallet();
  };

  const handleArchiveOrder = async (orderId: string, archived: boolean) => {
    const currentOrder = orders.find((o) => o.id === orderId);
    const previousValue = currentOrder?.archived;

    // Optimistic update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, archived } : o
      )
    );

    const { error } = await supabase
      .from("order_workflow")
      .update({ archived })
      .eq("id", orderId);

    if (error) {
      console.error("Error archiving order:", error);
      // Revert on error
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, archived: previousValue! } : o
        )
      );
      toast({ title: t('toast.updateError'), variant: "destructive" });
    } else {
      logAuditAction({
        action_type: archived ? 'order_archived' : 'order_unarchived',
        order_number: currentOrder?.order_number,
        customer_name: currentOrder?.customer_name,
        description: archived ? 'Order archived' : 'Order unarchived',
      });
      toast({ 
        title: archived 
          ? (language === 'zh' ? '订单已归档' : 'Order archived')
          : (language === 'zh' ? '订单已取消归档' : 'Order unarchived')
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-3">
          {/* Top row: Title + main actions */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">{t('header.title')}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {t('header.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Button
                variant={chatOpen ? "default" : "outline"}
                size="sm"
                onClick={() => setChatOpen(!chatOpen)}
                className={`h-8 gap-1.5 px-2.5 ${
                  chatOpen ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">General Chat</span>
              </Button>
              <NotificationBell language={language} />
              {isAdmin && <AuditLogPanel language={language} />}
              <LanguageSelector language={language} onLanguageChange={setLanguage} />
              <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 w-8 sm:w-auto p-0 sm:px-3">
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('header.refresh')}</span>
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="h-8 gap-1 px-2 sm:px-3">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t('header.addOrder')}</span>
              </Button>
            </div>
          </div>

          {/* Bottom row: Search, filters, wallet */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 sm:max-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'zh' ? '搜索订单...' : 'Search orders...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && wallet && (
                <WalletDisplay
                  balance={wallet.balance}
                  currency={wallet.currency}
                  language={language}
                />
              )}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[140px] sm:w-[180px] h-9">
                  <ArrowUpDown className="h-4 w-4 mr-1 sm:mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">
                    {language === 'zh' ? '最新优先' : 'Newest First'}
                  </SelectItem>
                  <SelectItem value="oldest">
                    {language === 'zh' ? '最旧优先' : 'Oldest First'}
                  </SelectItem>
                  <SelectItem value="order_number_desc">
                    {language === 'zh' ? '订单号 (降序)' : 'Order # (Desc)'}
                  </SelectItem>
                  <SelectItem value="order_number_asc">
                    {language === 'zh' ? '订单号 (升序)' : 'Order # (Asc)'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
                <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="show-archived" className="text-xs sm:text-sm cursor-pointer whitespace-nowrap">
                  {language === 'zh' ? '归档' : 'Archived'}
                  {archivedCount > 0 && (
                    <span className="ml-1 text-muted-foreground">({archivedCount})</span>
                  )}
                </Label>
                <Switch
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                  className="scale-75"
                />
              </div>
              <StageManagement
                stages={stages}
                orderCounts={orderCounts}
                onAddStage={addStage}
                onUpdateStage={updateStage}
                onDeleteStage={deleteStage}
                onReorderStages={reorderStages}
                language={language}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="p-3 sm:p-6">
        <DynamicKanbanBoard
          orders={filteredOrders}
          stages={stages}
          loading={loading || stagesLoading}
          onStageChange={handleStageChange}
          onToggleNotify={handleToggleNotify}
          onRemoveOrder={handleRemoveOrder}
          onArchiveOrder={handleArchiveOrder}
          language={language}
          isAdmin={isAdmin}
        />
      </main>

      <AddOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onOrderAdded={fetchOrders}
        language={language}
      />

      <ContextualHelp page="workflow" language={language} />

      <GeneralChat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
