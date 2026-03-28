import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Plus,
  Trash2,
  Save,
  Package,
  Calculator,
  Loader2,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useOrderItems, useWallet } from "@/hooks/useWallet";
import { usePendingDebits } from "@/hooks/usePendingDebits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Language } from "@/hooks/useLanguage";

interface OrderCostSectionProps {
  workflowId: string;
  orderNumber: string;
  customerName: string;
  currentTotalCost: number | null;
  language: Language;
  onTotalCostUpdate: (cost: number) => void;
}

export function OrderCostSection({
  workflowId,
  orderNumber,
  customerName,
  currentTotalCost,
  language,
  onTotalCostUpdate,
}: OrderCostSectionProps) {
  const { items, loading, addItem, deleteItem, totalItemsCost } = useOrderItems(workflowId);
  const { wallet, addDebit, addRefund } = useWallet();
  const { createPendingDebit } = usePendingDebits();

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [totalCost, setTotalCost] = useState(currentTotalCost?.toString() || "");
  // Track the last saved cost for accurate diff calculation
  const [savedTotalCost, setSavedTotalCost] = useState(currentTotalCost || 0);
  const [authorName, setAuthorName] = useState(() => localStorage.getItem("wallet-user") || "");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isSavingCost, setIsSavingCost] = useState(false);
  
  // Manual refund state
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDescription, setRefundDescription] = useState("");
  const [refundBy, setRefundBy] = useState(() => localStorage.getItem("wallet-user") || "");
  const [isRefunding, setIsRefunding] = useState(false);

  const t = (en: string, zh: string) => (language === "zh" ? zh : en);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim() || !newItemPrice) return;

    const price = parseFloat(newItemPrice);
    const qty = parseInt(newItemQty) || 1;

    if (isNaN(price) || price <= 0) {
      toast.error(t("Invalid price", "价格无效"));
      return;
    }

    setIsAddingItem(true);
    const by = authorName.trim() || "Agent";
    localStorage.setItem("wallet-user", by);

    // Add item to order
    const result = await addItem(newItemName.trim(), price, qty);

    if (result.success) {
      // Create pending debit instead of immediate debit
      const debitAmount = price * qty;
      await createPendingDebit({
        workflow_id: workflowId,
        order_number: orderNumber,
        customer_name: customerName,
        amount: debitAmount,
        description: `${orderNumber}: ${newItemName.trim()} (x${qty})`,
        created_by: by,
        debit_type: "item",
        item_name: newItemName.trim(),
        item_price: price,
        item_quantity: qty,
      });

      toast.success(t("Item added - pending admin approval for debit", "项目已添加 - 等待管理员批准扣款"));
      setNewItemName("");
      setNewItemPrice("");
      setNewItemQty("1");
    } else {
      toast.error(result.error || t("Failed to add item", "添加项目失败"));
    }

    setIsAddingItem(false);
  };

  const handleDeleteItem = async (itemId: string, itemName: string, itemPrice: number, itemQty: number) => {
    await deleteItem(itemId);
    toast.success(t("Item removed", "项目已删除"));
  };

  const handleSaveTotalCost = async () => {
    const cost = parseFloat(totalCost);
    if (isNaN(cost) || cost < 0) {
      toast.error(t("Invalid total cost", "总成本无效"));
      return;
    }

    setIsSavingCost(true);
    const by = authorName.trim() || "Agent";
    localStorage.setItem("wallet-user", by);

    const previousCost = savedTotalCost;
    const difference = cost - previousCost;

    if (difference > 0) {
      // Create pending debit for the difference instead of immediate debit
      await createPendingDebit({
        workflow_id: workflowId,
        order_number: orderNumber,
        customer_name: customerName,
        amount: difference,
        description: `${orderNumber}: Total cost update ($${previousCost} → $${cost})`,
        created_by: by,
        debit_type: "total_cost",
        previous_total_cost: previousCost,
        new_total_cost: cost,
      });

      // Update order total_cost (cost is saved, but debit is pending)
      const { error } = await supabase
        .from("order_workflow")
        .update({ total_cost: cost })
        .eq("id", workflowId);

      if (error) {
        toast.error(t("Failed to save total cost", "保存总成本失败"));
      } else {
        setSavedTotalCost(cost);
        onTotalCostUpdate(cost);
        toast.success(t("Cost saved - pending admin approval for debit", "成本已保存 - 等待管理员批准扣款"));
      }
    } else if (difference < 0) {
      // Refund the difference immediately (reducing cost doesn't need approval)
      const { error } = await supabase
        .from("order_workflow")
        .update({ total_cost: cost })
        .eq("id", workflowId);

      if (error) {
        toast.error(t("Failed to save total cost", "保存总成本失败"));
      } else {
        await addRefund(Math.abs(difference), `${orderNumber}: Cost refund`, by, workflowId);
        setSavedTotalCost(cost);
        onTotalCostUpdate(cost);
        toast.success(t("Total cost saved and refunded", "总成本已保存并退款"));
      }
    } else {
      toast.success(t("Total cost saved (no change)", "总成本已保存（无变化）"));
    }

    setIsSavingCost(false);
  };

  const handleManualRefund = async () => {
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("Invalid refund amount", "退款金额无效"));
      return;
    }
    if (!refundBy.trim()) {
      toast.error(t("Please enter your name", "请输入您的名字"));
      return;
    }

    setIsRefunding(true);
    localStorage.setItem("wallet-user", refundBy.trim());

    const result = await addRefund(
      amount,
      `${orderNumber}: ${refundDescription || "Manual refund"}`,
      refundBy.trim(),
      workflowId
    );

    if (result.success) {
      // Subtract refund amount from order's total_cost
      const currentCost = savedTotalCost;
      const newCost = Math.max(0, currentCost - amount);
      const { error: updateError } = await supabase
        .from("order_workflow")
        .update({ total_cost: newCost })
        .eq("id", workflowId);

      if (!updateError) {
        setSavedTotalCost(newCost);
        setTotalCost(newCost.toString());
        onTotalCostUpdate(newCost);
      }

      toast.success(t("Refund submitted and cost updated", "退款已提交并更新成本"));
      setRefundOpen(false);
      setRefundAmount("");
      setRefundDescription("");
    } else {
      toast.error(result.error || t("Failed to submit refund", "提交退款失败"));
    }

    setIsRefunding(false);
  };

  return (
    <div className="space-y-6">
      {/* Wallet Balance + Refund Button */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("Wallet Balance", "钱包余额")}</p>
            <p className={`text-xl font-bold ${(wallet?.balance || 0) < 0 ? "text-destructive" : "text-primary"}`}>
              {formatCurrency(wallet?.balance || 0)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={wallet && wallet.balance < 500 ? "destructive" : "secondary"}>
            {wallet && wallet.balance < 500 ? t("Low Balance", "余额不足") : "USD"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
            onClick={() => setRefundOpen(true)}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            {t("Refund", "退款")}
          </Button>
        </div>
      </div>

      {/* Order Items List */}
      <div>
        <Label className="text-sm font-medium flex items-center gap-2 mb-3">
          <Package className="h-4 w-4" />
          {t("Order Items", "订单项目")} ({items.length})
        </Label>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
            {t("No items added yet", "暂无项目")}
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      x{item.quantity}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10"
                      onClick={() => handleDeleteItem(item.id, item.name, item.price, item.quantity)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Items Total */}
            {items.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("Items Total", "项目合计")}
                </span>
                <span className="font-bold text-primary">{formatCurrency(totalItemsCost)}</span>
              </div>
            )}
          </div>
        )}

        {/* Add New Item Form */}
        <div className="p-4 rounded-lg border border-dashed bg-muted/20 space-y-3">
          <Label className="text-xs font-medium text-muted-foreground">
            {t("Add New Item", "添加新项目")}
          </Label>
          <div className="grid grid-cols-12 gap-2">
            <Input
              placeholder={t("Item name", "项目名称")}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="col-span-5 h-9 text-sm"
            />
            <div className="col-span-3 relative">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="number"
                placeholder="0.00"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                className="pl-7 h-9 text-sm"
                min="0"
                step="0.01"
              />
            </div>
            <Input
              type="number"
              placeholder="Qty"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              className="col-span-2 h-9 text-sm text-center"
              min="1"
            />
            <Button
              size="sm"
              className="col-span-2 h-9"
              onClick={handleAddItem}
              disabled={isAddingItem || !newItemName.trim() || !newItemPrice}
            >
              {isAddingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          <Input
            placeholder={t("Your name (for records)", "您的名字（用于记录）")}
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <Separator />

      {/* Total Cost Field */}
      <div>
        <Label className="text-sm font-medium flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4" />
          {t("Total Order Cost", "订单总成本")}
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              placeholder="0.00"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              className="pl-10 text-lg font-semibold"
              min="0"
              step="0.01"
            />
          </div>
          <Button onClick={handleSaveTotalCost} disabled={isSavingCost}>
            {isSavingCost ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                {t("Save & Request Approval", "保存并请求审批")}
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t(
            "Cost changes require admin approval before debiting",
            "费用变更需要管理员批准后才能扣款"
          )}
        </p>
      </div>


      {/* Manual Refund Dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              {t("Submit Manual Refund", "提交手动退款")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {t("Order", "订单")}
              </Label>
              <div className="p-3 rounded-lg bg-muted/50 text-sm font-medium">
                #{orderNumber}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {t("Refund Amount", "退款金额")} *
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="pl-10 text-lg font-semibold"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {t("Reason (optional)", "原因（可选）")}
              </Label>
              <Textarea
                placeholder={t("e.g., Incorrect amount entered", "例如：输入金额错误")}
                value={refundDescription}
                onChange={(e) => setRefundDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {t("Your Name", "您的名字")} *
              </Label>
              <Input
                placeholder={t("Agent name", "代理名称")}
                value={refundBy}
                onChange={(e) => setRefundBy(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              {t("Cancel", "取消")}
            </Button>
            <Button
              onClick={handleManualRefund}
              disabled={isRefunding || !refundAmount || !refundBy.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRefunding ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t("Submit Refund", "提交退款")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
