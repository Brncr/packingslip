import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { translations, type Language } from "@/hooks/useLanguage";
import { Loader2, Plus, FileSpreadsheet, CloudDownload, ShoppingBag } from "lucide-react";

interface AddOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderAdded: () => void;
  language: Language;
}

interface GeneratedSpreadsheet {
  id: string;
  order_number: string;
  customer_name: string;
  spreadsheet_id: string;
  spreadsheet_url: string;
}

interface ShopifyOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
}

export function AddOrderDialog({
  open,
  onOpenChange,
  onOrderAdded,
  language,
}: AddOrderDialogProps) {
  const [spreadsheets, setSpreadsheets] = useState<GeneratedSpreadsheet[]>([]);
  const [shopifyOrders, setShopifyOrders] = useState<ShopifyOrder[]>([]);
  const [existingOrderIds, setExistingOrderIds] = useState<Set<string>>(new Set());
  const [existingOrderNumbers, setExistingOrderNumbers] = useState<Set<string>>(new Set());
  const [firstStageId, setFirstStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const t = (key: string) => translations[language][key] || key;

  // Manual form state
  const [manualForm, setManualForm] = useState({
    order_id: "",
    order_number: "",
    customer_name: "",
    customer_email: "",
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch first stage for new orders
    const { data: stages } = await supabase
      .from("workflow_stages")
      .select("id")
      .order("position", { ascending: true })
      .limit(1);

    if (stages && stages.length > 0) {
      setFirstStageId(stages[0].id);
    }

    // Fetch existing workflow order_ids and order_numbers
    const { data: workflows } = await supabase
      .from("order_workflow")
      .select("order_id, order_number");

    const existingIds = new Set(workflows?.map((w) => w.order_id) || []);
    const existingNumbers = new Set(workflows?.map((w) => w.order_number) || []);
    setExistingOrderIds(existingIds);
    setExistingOrderNumbers(existingNumbers);

    // Fetch generated spreadsheets not yet in workflow
    const { data: sheets, error } = await supabase
      .from("generated_spreadsheets")
      .select("id, order_number, customer_name, spreadsheet_id, spreadsheet_url")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching spreadsheets:", error);
    } else {
      // Filter out those already in workflow
      const available = (sheets || []).filter(
        (s) => !existingIds.has(s.spreadsheet_id)
      );
      setSpreadsheets(available);
    }

    setLoading(false);
  };

  const handleSyncShopify = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-orders');
      
      if (error) {
        console.error('Fetch Shopify error:', error);
        toast({ 
          title: language === 'zh' ? '获取订单失败' : 'Failed to fetch orders', 
          variant: "destructive" 
        });
        return;
      }

      // Refresh existing order numbers
      const { data: workflows } = await supabase
        .from("order_workflow")
        .select("order_id, order_number");

      const existingIds = new Set(workflows?.map((w) => w.order_id) || []);
      const existingNumbers = new Set(workflows?.map((w) => w.order_number) || []);
      setExistingOrderIds(existingIds);
      setExistingOrderNumbers(existingNumbers);

      // Filter out orders already in workflow
      const orders = (data?.orders || []).map((order: any) => ({
        id: String(order.id),
        order_number: order.name?.replace('#', '').replace('TB-', 'TB') || String(order.order_number),
        customer_name: order.customer 
          ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Unknown'
          : order.shipping_address?.name || 'Unknown',
        customer_email: order.customer?.email || order.email || null,
      }));

      // Filter to only show orders not already imported
      const availableOrders = orders.filter((o: ShopifyOrder) => 
        !existingIds.has(o.id) && !existingNumbers.has(o.order_number)
      );

      setShopifyOrders(availableOrders);
      
      toast({ 
        title: language === 'zh' 
          ? `找到 ${availableOrders.length} 个新订单` 
          : `Found ${availableOrders.length} new orders`
      });
    } catch (err) {
      console.error('Fetch Shopify error:', err);
      toast({ 
        title: language === 'zh' ? '获取订单失败' : 'Failed to fetch orders', 
        variant: "destructive" 
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleImportShopifyOrder = async (order: ShopifyOrder) => {
    setSubmitting(true);

    const { error } = await supabase.from("order_workflow").insert({
      order_id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      current_stage: "novo",
      stage_id: firstStageId,
      notify_customer: false,
    });

    if (error) {
      console.error("Error adding to workflow:", error);
      toast({ title: t('toast.updateError'), variant: "destructive" });
    } else {
      toast({ title: language === 'zh' ? '订单已导入' : 'Order imported' });
      // Remove from list
      setShopifyOrders(prev => prev.filter(o => o.id !== order.id));
      setExistingOrderIds(prev => new Set([...prev, order.id]));
      setExistingOrderNumbers(prev => new Set([...prev, order.order_number]));
      onOrderAdded();
    }

    setSubmitting(false);
  };

  const handleImportSpreadsheet = async (sheet: GeneratedSpreadsheet) => {
    setSubmitting(true);

    const { error } = await supabase.from("order_workflow").insert({
      order_id: sheet.spreadsheet_id,
      order_number: sheet.order_number,
      customer_name: sheet.customer_name,
      spreadsheet_id: sheet.spreadsheet_id,
      spreadsheet_url: sheet.spreadsheet_url,
      current_stage: "novo",
      stage_id: firstStageId,
      notify_customer: false,
    });

    if (error) {
      console.error("Error adding to workflow:", error);
      toast({ title: t('toast.updateError'), variant: "destructive" });
    } else {
      toast({ title: language === 'zh' ? '订单已添加到工作流' : 'Order added to workflow' });
      onOrderAdded();
      onOpenChange(false);
    }

    setSubmitting(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.order_id || !manualForm.order_number || !manualForm.customer_name) {
      toast({ 
        title: language === 'zh' ? '请填写所有必填字段' : 'Please fill in all required fields', 
        variant: "destructive" 
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("order_workflow").insert({
      order_id: manualForm.order_id,
      order_number: manualForm.order_number,
      customer_name: manualForm.customer_name,
      customer_email: manualForm.customer_email || null,
      current_stage: "novo",
      stage_id: firstStageId,
      notify_customer: false,
    });

    if (error) {
      console.error("Error adding order:", error);
      toast({ title: t('toast.updateError'), variant: "destructive" });
    } else {
      toast({ title: language === 'zh' ? '订单已添加' : 'Order added' });
      setManualForm({ order_id: "", order_number: "", customer_name: "", customer_email: "" });
      onOrderAdded();
      onOpenChange(false);
    }

    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('dialog.title')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="shopify" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="shopify">
              <ShoppingBag className="h-4 w-4 mr-1" />
              Shopify
            </TabsTrigger>
            <TabsTrigger value="import">
              {language === 'zh' ? '导入表格' : 'Import Spreadsheet'}
            </TabsTrigger>
            <TabsTrigger value="manual">
              {language === 'zh' ? '手动添加' : 'Manual'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shopify" className="mt-4">
            <div className="space-y-4">
              <Button 
                onClick={handleSyncShopify} 
                disabled={syncing}
                className="w-full"
                variant="outline"
              >
                <CloudDownload className={`mr-2 h-4 w-4 ${syncing ? 'animate-pulse' : ''}`} />
                {syncing 
                  ? (language === 'zh' ? '正在获取...' : 'Fetching...') 
                  : (language === 'zh' ? '获取Shopify订单' : 'Fetch Shopify Orders')}
              </Button>

              {shopifyOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {language === 'zh' 
                    ? '点击上方按钮获取Shopify订单' 
                    : 'Click button above to fetch Shopify orders'}
                </p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {shopifyOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <ShoppingBag className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">
                              #{order.order_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order.order_number}-{order.customer_name}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleImportShopifyOrder(order)}
                          disabled={submitting}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {language === 'zh' ? '导入' : 'Import'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : spreadsheets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {language === 'zh' 
                  ? '没有可导入的表格' 
                  : 'No spreadsheets available to import'}
              </p>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {spreadsheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">
                            #{sheet.order_number}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sheet.customer_name}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleImportSpreadsheet(sheet)}
                        disabled={submitting}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {language === 'zh' ? '导入' : 'Import'}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="order_id">
                  {language === 'zh' ? '订单 ID *' : 'Order ID *'}
                </Label>
                <Input
                  id="order_id"
                  value={manualForm.order_id}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, order_id: e.target.value }))
                  }
                  placeholder={language === 'zh' ? '例如: 5678901234567' : 'Ex: 5678901234567'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="order_number">{t('dialog.orderNumber')} *</Label>
                <Input
                  id="order_number"
                  value={manualForm.order_number}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, order_number: e.target.value }))
                  }
                  placeholder={language === 'zh' ? '例如: 1234' : 'Ex: 1234'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer_name">{t('dialog.customerName')} *</Label>
                <Input
                  id="customer_name"
                  value={manualForm.customer_name}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, customer_name: e.target.value }))
                  }
                  placeholder={language === 'zh' ? '例如: 张三' : 'Ex: John Doe'}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer_email">{t('dialog.customerEmail')}</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={manualForm.customer_email}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, customer_email: e.target.value }))
                  }
                  placeholder={language === 'zh' ? '例如: zhang@email.com' : 'Ex: john@email.com'}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('dialog.add')}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
