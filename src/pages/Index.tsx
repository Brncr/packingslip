import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Printer, ChevronLeft, Package, FileSpreadsheet, ExternalLink, Loader2, 
  Star, Keyboard, CheckSquare, Square, Layers, Eye, X, Factory, Check
} from "lucide-react";
import { OrderList } from "@/components/OrderList";
import { OrderPreview } from "@/components/OrderPreview";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Dashboard } from "@/components/Dashboard";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { BatchExport } from "@/components/BatchExport";
import { ContextualHelp } from "@/components/ContextualHelp";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { fetchProduct, fetchOrders } from "@/lib/shopify";
import { exportPackingSlipToSheet, getTemplateSpreadsheetUrl } from "@/lib/exportToSheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useFavorites } from "@/hooks/useFavorites";
import { useActionHistory } from "@/hooks/useActionHistory";
import { useLanguageState } from "@/hooks/useLanguage";
import type { ShopifyOrder, ShopifyProduct } from "@/types/shopify";
import twitterLogo from "@/assets/twitter-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [selectedOrder, setSelectedOrder] = useState<ShopifyOrder | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [showBatchExport, setShowBatchExport] = useState(false);
  const [sendingToAssembly, setSendingToAssembly] = useState(false);
  const [sentToAssembly, setSentToAssembly] = useState<Set<number>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const { toggleFavorite, isFavorite, favorites } = useFavorites();
  const { addAction } = useActionHistory();
  const { language } = useLanguageState();

  // Fetch orders for dashboard
  const { data: orders } = useQuery({
    queryKey: ['shopify-orders'],
    queryFn: fetchOrders,
    staleTime: 60000,
  });

  // Fetch spreadsheets count for dashboard
  const { data: spreadsheets } = useQuery({
    queryKey: ['generated-spreadsheets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_spreadsheets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch product details for images when order is selected
  const productIds = selectedOrder?.line_items
    .map(item => item.product_id)
    .filter((id): id is number => id != null && id > 0) || [];
  
  const { data: products } = useQuery({
    queryKey: ['products', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return {};
      
      const productMap: Record<number, ShopifyProduct> = {};
      await Promise.all(
        productIds.map(async (id) => {
          try {
            const product = await fetchProduct(id);
            if (product) {
              productMap[id] = product;
            }
          } catch (error) {
            console.error(`Failed to fetch product ${id}:`, error);
          }
        })
      );
      return productMap;
    },
    enabled: productIds.length > 0,
    staleTime: 300000,
  });

  // Mutation for exporting to Google Sheets
  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('No order selected');
      return exportPackingSlipToSheet({
        order: selectedOrder,
        products: products || {},
      });
    },
    onSuccess: (result) => {
      if (result.success && selectedOrder) {
        queryClient.invalidateQueries({ queryKey: ['generated-spreadsheets'] });
        addAction({
          type: 'export',
          orderNumber: selectedOrder.order_number.toString(),
          customerName: selectedOrder.customer 
            ? `${selectedOrder.customer.first_name} ${selectedOrder.customer.last_name}`
            : 'Guest',
          details: result.fileName,
        });
        toast.success(`Spreadsheet "${result.fileName}" created!`, {
          description: 'Click to open in Google Sheets',
          action: {
            label: 'Open',
            onClick: () => window.open(result.spreadsheetUrl, '_blank'),
          },
        });
      } else {
        toast.error('Export failed', {
          description: result.error,
        });
      }
    },
    onError: (error) => {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const handlePrint = () => {
    if (selectedOrder) {
      addAction({
        type: 'print',
        orderNumber: selectedOrder.order_number.toString(),
        customerName: selectedOrder.customer 
          ? `${selectedOrder.customer.first_name} ${selectedOrder.customer.last_name}`
          : 'Guest',
      });
    }
    window.print();
  };

  const handleExportToSheet = () => {
    exportMutation.mutate();
  };

  const handleOpenTemplate = () => {
    window.open(getTemplateSpreadsheetUrl(), '_blank');
  };

  const handleSendToAssembly = async () => {
    if (!selectedOrder) return;
    setSendingToAssembly(true);
    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('order_workflow')
        .select('id')
        .eq('order_id', String(selectedOrder.id))
        .maybeSingle();

      if (existing) {
        toast.info('Already in Assembly Line');
        setSentToAssembly(prev => new Set([...prev, selectedOrder.id]));
        setSendingToAssembly(false);
        return;
      }

      // Get first stage
      const { data: stages } = await supabase
        .from('workflow_stages')
        .select('id')
        .order('position', { ascending: true })
        .limit(1);

      const firstStageId = stages?.[0]?.id || null;
      const customerName = selectedOrder.customer
        ? `${selectedOrder.customer.first_name || ''} ${selectedOrder.customer.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown';
      const orderNum = selectedOrder.name?.replace('#', '').replace('TB-', 'TB') || String(selectedOrder.order_number);

      const { error } = await supabase.from('order_workflow').insert({
        order_id: String(selectedOrder.id),
        order_number: orderNum,
        customer_name: customerName,
        customer_email: selectedOrder.customer?.email || null,
        current_stage: 'novo',
        stage_id: firstStageId,
        notify_customer: false,
      });

      if (error) {
        console.error('Error sending to assembly:', error);
        toast.error('Failed to send to Assembly Line');
      } else {
        toast.success(`Order #${selectedOrder.order_number} sent to Assembly Line! 🏭`);
        setSentToAssembly(prev => new Set([...prev, selectedOrder.id]));
        // Navigate to workflow
        setTimeout(() => navigate('/workflow'), 800);
      }
    } catch (err) {
      console.error('Send to assembly error:', err);
      toast.error('Failed to send to Assembly Line');
    }
    setSendingToAssembly(false);
  };

  const handleBatchExport = async (order: ShopifyOrder) => {
    try {
      const orderProductIds = order.line_items
        .map(item => item.product_id)
        .filter((id): id is number => id != null && id > 0);
      
      const orderProducts: Record<number, ShopifyProduct> = {};
      await Promise.all(
        orderProductIds.map(async (id) => {
          try {
            const product = await fetchProduct(id);
            if (product) {
              orderProducts[id] = product;
            }
          } catch (error) {
            console.error(`Failed to fetch product ${id}:`, error);
          }
        })
      );

      const result = await exportPackingSlipToSheet({
        order,
        products: orderProducts,
      });

      if (result.success) {
        addAction({
          type: 'export',
          orderNumber: order.order_number.toString(),
          customerName: order.customer 
            ? `${order.customer.first_name} ${order.customer.last_name}`
            : 'Guest',
          details: result.fileName,
        });
        queryClient.invalidateQueries({ queryKey: ['generated-spreadsheets'] });
      }

      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  };

  const selectedOrdersForBatch = useMemo(() => {
    return orders?.filter(o => selectedOrderIds.has(o.id)) || [];
  }, [orders, selectedOrderIds]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'e', handler: handleExportToSheet, description: 'Export' },
    { key: 'p', handler: handlePrint, description: 'Print' },
    { key: 't', handler: handleOpenTemplate, description: 'Template' },
    { key: 'f', handler: () => selectedOrder && toggleFavorite(selectedOrder.id), description: 'Favorite' },
    { key: 'Escape', handler: () => setSelectedOrder(null), description: 'Deselect' },
    { key: '?', shift: true, handler: () => setShowShortcutsHelp(true), description: 'Help' },
  ], !!selectedOrder || showShortcutsHelp);

  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Compact Header */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-20 no-print">
        <div className="px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Logo & Nav */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img src={twitterLogo} alt="Twitter Bikes" className="h-7 sm:h-9 w-auto flex-shrink-0" />
              <span className="font-semibold text-foreground hidden lg:block">Packing Slip</span>

              <nav className="flex items-center gap-1 ml-1 sm:ml-2 pl-2 sm:pl-3 border-l border-border">
                <NavLink to="/">
                  <Package className="w-4 h-4" />
                  <span className="hidden sm:inline">Orders</span>
                </NavLink>
                <NavLink to="/sheets">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">Sheets</span>
                </NavLink>
              </nav>
            </div>

            {/* Quick Stats - Only on large screens */}
            <div className="hidden xl:block flex-1 max-w-2xl mx-4">
              <Dashboard orders={orders} spreadsheetsCount={spreadsheets?.length || 0} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant={selectionMode ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) setSelectedOrderIds(new Set());
                }}
                className="gap-1 h-8 px-2 sm:px-3"
              >
                {selectionMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline text-xs">{selectionMode ? 'Done' : 'Select'}</span>
              </Button>

              {selectionMode && selectedOrderIds.size > 0 && (
                <Button size="sm" onClick={() => setShowBatchExport(true)} className="gap-1 h-8 px-2 sm:px-3">
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-xs">{selectedOrderIds.size}</span>
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowShortcutsHelp(true)}
                className="h-8 w-8 hidden sm:flex"
              >
                <Keyboard className="w-4 h-4" />
              </Button>
              
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Stats */}
      <div className="xl:hidden px-3 sm:px-4 py-2 no-print">
        <Dashboard orders={orders} spreadsheetsCount={spreadsheets?.length || 0} />
      </div>

      {/* Main Content - Split View */}
      <main className="px-3 sm:px-4 pb-4">
        <div className="grid lg:grid-cols-[320px,1fr] xl:grid-cols-[360px,1fr] gap-3 sm:gap-4 min-h-[calc(100vh-160px)] lg:min-h-[calc(100vh-100px)]">
          {/* Orders Sidebar */}
          <aside className={`no-print ${selectedOrder ? 'hidden lg:block' : ''} overflow-hidden`}>
            <div className="bg-card rounded-xl border border-border h-full max-h-[calc(100vh-200px)] lg:max-h-full flex flex-col">
              <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <h2 className="font-semibold text-foreground text-sm sm:text-base">Orders</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {orders?.length || 0}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 sm:p-3">
                <OrderList 
                  onSelectOrder={setSelectedOrder}
                  selectedOrderId={selectedOrder?.id}
                  selectionMode={selectionMode}
                  selectedIds={selectedOrderIds}
                  onToggleSelect={toggleOrderSelection}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            </div>
          </aside>

          {/* Preview Panel */}
          <div className="flex flex-col h-full">
            <AnimatePresence mode="wait">
              {selectedOrder ? (
                <motion.div
                  key={selectedOrder.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col h-full"
                >
                  {/* Preview Header */}
                  <div className="bg-card rounded-t-xl border border-border border-b-0 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 no-print">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="lg:hidden h-8 w-8 p-0 flex-shrink-0"
                        onClick={() => setSelectedOrder(null)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h2 className="font-semibold text-foreground text-sm sm:text-base truncate">
                              #{selectedOrder.order_number}
                            </h2>
                            {isFavorite(selectedOrder.id) && (
                              <Star className="w-3 h-3 text-yellow-500 fill-current flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {selectedOrder.customer 
                              ? `${selectedOrder.customer.first_name}`
                              : 'Guest'
                            } • ${parseFloat(selectedOrder.total_price).toFixed(0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button 
                        size="sm"
                        onClick={handleExportToSheet}
                        disabled={exportMutation.isPending}
                        className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs"
                      >
                        {exportMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        )}
                        <span className="hidden xs:inline">Export</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleOpenTemplate} className="h-7 sm:h-8 w-7 sm:w-8 p-0 hidden sm:flex">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={handlePrint} className="h-7 sm:h-8 w-7 sm:w-8 p-0">
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleFavorite(selectedOrder.id)} 
                        className={`h-7 sm:h-8 w-7 sm:w-8 p-0 ${isFavorite(selectedOrder.id) ? 'text-yellow-500' : ''}`}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFavorite(selectedOrder.id) ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant={sentToAssembly.has(selectedOrder.id) ? "outline" : "default"}
                        onClick={handleSendToAssembly}
                        disabled={sendingToAssembly || sentToAssembly.has(selectedOrder.id)}
                        className={`gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs ${
                          sentToAssembly.has(selectedOrder.id) 
                            ? 'text-green-600 border-green-300' 
                            : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                      >
                        {sendingToAssembly ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : sentToAssembly.has(selectedOrder.id) ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Factory className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        )}
                        <span className="hidden sm:inline">
                          {sentToAssembly.has(selectedOrder.id) ? 'Sent' : 'Assembly'}
                        </span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedOrder(null)} 
                        className="h-7 sm:h-8 w-7 sm:w-8 p-0 hidden lg:flex"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Preview Content */}
                  <div className="flex-1 bg-muted/30 rounded-b-xl border border-border border-t-0 overflow-auto">
                    <div ref={printRef} className="p-2 sm:p-4">
                      <OrderPreview 
                        order={selectedOrder}
                        products={products || {}}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex items-center justify-center"
                >
                  <EmptyState />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Modals */}
      <KeyboardShortcutsHelp 
        isOpen={showShortcutsHelp} 
        onClose={() => setShowShortcutsHelp(false)} 
      />

      <BatchExport
        isOpen={showBatchExport}
        onClose={() => {
          setShowBatchExport(false);
          setSelectionMode(false);
          setSelectedOrderIds(new Set());
        }}
        selectedOrders={selectedOrdersForBatch}
        onExport={handleBatchExport}
        products={products || {}}
      />

      <ContextualHelp page="home" language={language} />
    </div>
  );
};

export default Index;
