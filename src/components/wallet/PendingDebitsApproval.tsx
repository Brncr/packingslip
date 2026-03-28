import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Package,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePendingDebits, type PendingDebit } from "@/hooks/usePendingDebits";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";

interface PendingDebitsApprovalProps {
  language: "en" | "zh";
}

export function PendingDebitsApproval({ language }: PendingDebitsApprovalProps) {
  const { pendingDebits, loading, approveDebit, rejectDebit } = usePendingDebits();
  const { wallet, addDebit } = useWallet();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const t = (en: string, zh: string) => (language === "zh" ? zh : en);
  const dateLocale = language === "zh" ? zhCN : enUS;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const adminName = localStorage.getItem("wallet-user") || "Admin";

  const handleApprove = async (debit: PendingDebit) => {
    setProcessingId(debit.id);

    // Execute the actual debit
    const debitResult = await addDebit(
      debit.amount,
      debit.description || `${debit.order_number}: Approved debit`,
      adminName,
      debit.workflow_id
    );

    if (debitResult.success) {
      await approveDebit(debit.id, adminName);
      toast.success(t(
        `Approved: ${formatCurrency(debit.amount)} debited for #${debit.order_number}`,
        `已批准：#${debit.order_number} 扣除 ${formatCurrency(debit.amount)}`
      ));
    } else {
      toast.error(debitResult.error || t("Failed to process debit", "处理扣款失败"));
    }

    setProcessingId(null);
  };

  const handleReject = async (debit: PendingDebit) => {
    setProcessingId(debit.id);

    // If it's a total_cost type, revert the order cost
    if (debit.debit_type === "total_cost" && debit.previous_total_cost !== null) {
      await supabase
        .from("order_workflow")
        .update({ total_cost: debit.previous_total_cost })
        .eq("id", debit.workflow_id);
    }

    // If it's an item type, delete the order item
    if (debit.debit_type === "item" && debit.item_name) {
      await supabase
        .from("order_items")
        .delete()
        .eq("workflow_id", debit.workflow_id)
        .eq("name", debit.item_name)
        .eq("price", debit.item_price || 0);
    }

    await rejectDebit(debit.id, adminName);
    toast.success(t(
      `Rejected and reverted: #${debit.order_number}`,
      `已拒绝并恢复：#${debit.order_number}`
    ));

    setProcessingId(null);
  };

  if (loading) return null;
  if (pendingDebits.length === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          {t("Pending Approvals", "待审批")}
          <Badge variant="secondary" className="bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            {pendingDebits.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <AnimatePresence>
          {pendingDebits.map((debit) => (
            <motion.div
              key={debit.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="p-4 rounded-lg bg-background border shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">#{debit.order_number}</span>
                    <Badge variant="outline" className="text-xs">
                      {debit.customer_name}
                    </Badge>
                    <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 dark:text-amber-300">
                      <Clock className="h-3 w-3 mr-1" />
                      {debit.debit_type === "item" ? t("Item", "项目") : t("Total Cost", "总成本")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {debit.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {debit.created_by}
                    </span>
                    <span>
                      {format(new Date(debit.created_at), "PPp", { locale: dateLocale })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-lg font-bold text-destructive">
                    -{formatCurrency(debit.amount)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={() => handleReject(debit)}
                      disabled={processingId === debit.id}
                    >
                      {processingId === debit.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                      )}
                      {t("Reject", "拒绝")}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => handleApprove(debit)}
                      disabled={processingId === debit.id}
                    >
                      {processingId === debit.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      )}
                      {t("Approve", "批准")}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
