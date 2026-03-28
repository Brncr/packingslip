import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Wallet as WalletIcon,
  TrendingUp,
  TrendingDown,
  Plus,
  DollarSign,
  Calendar,
  User,
  FileText,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  Download,
  X,
  Trash2,
  Paperclip,
  Upload,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useWallet } from "@/hooks/useWallet";
import { PendingDebitsApproval } from "@/components/wallet/PendingDebitsApproval";
import { supabase } from "@/integrations/supabase/client";
import { useLanguageState } from "@/hooks/useLanguage";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, subMonths } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

type TransactionType = "all" | "deposit" | "debit" | "refund";

export default function Wallet() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguageState();
  const { wallet, transactions, loading, addDeposit, addRefund, refetch } = useWallet();
  const [depositOpen, setDepositOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [depositDescription, setDepositDescription] = useState("");
  const [refundDescription, setRefundDescription] = useState("");
  const [depositBy, setDepositBy] = useState(() => localStorage.getItem("wallet-user") || "");
  const [refundBy, setRefundBy] = useState(() => localStorage.getItem("wallet-user") || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [refundFile, setRefundFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [isClearing, setIsClearing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  const dateLocale = language === "zh" ? zhCN : enUS;

  const t = (en: string, zh: string) => (language === "zh" ? zh : en);

  const handleClearWallet = async () => {
    setIsClearing(true);
    try {
      // Delete all transactions
      const { error: transactionError } = await supabase
        .from("wallet_transactions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (transactionError) throw transactionError;

      // Reset wallet balance to 0
      if (wallet?.id) {
        const { error: walletError } = await supabase
          .from("wallet")
          .update({ balance: 0 })
          .eq("id", wallet.id);

        if (walletError) throw walletError;
      }

      toast.success(t("Wallet cleared successfully", "钱包已清空"));
      refetch();
    } catch (error) {
      console.error("Error clearing wallet:", error);
      toast.error(t("Failed to clear wallet", "清空钱包失败"));
    } finally {
      setIsClearing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: wallet?.currency || "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Get unique agents for filter
  const uniqueAgents = useMemo(() => {
    const agents = new Set(transactions.map((t) => t.created_by));
    return Array.from(agents).sort();
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      // Type filter
      if (typeFilter !== "all" && transaction.type !== typeFilter) return false;

      // Agent filter
      if (agentFilter !== "all" && transaction.created_by !== agentFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesDescription = transaction.description?.toLowerCase().includes(query);
        const matchesAgent = transaction.created_by.toLowerCase().includes(query);
        if (!matchesDescription && !matchesAgent) return false;
      }

      // Date range filter
      if (dateRange?.from) {
        const transactionDate = new Date(transaction.created_at);
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        if (!isWithinInterval(transactionDate, { start: from, end: to })) return false;
      }

      return true;
    });
  }, [transactions, typeFilter, agentFilter, searchQuery, dateRange]);

  // Calculate stats for filtered transactions
  const filteredStats = useMemo(() => {
    const deposits = filteredTransactions.filter((t) => t.type === "deposit");
    const debits = filteredTransactions.filter((t) => t.type === "debit");
    const refunds = filteredTransactions.filter((t) => t.type === "refund");

    return {
      totalDeposits: deposits.reduce((sum, t) => sum + t.amount, 0),
      totalDebits: debits.reduce((sum, t) => sum + t.amount, 0),
      totalRefunds: refunds.reduce((sum, t) => sum + t.amount, 0),
      depositCount: deposits.length,
      debitCount: debits.length,
      refundCount: refunds.length,
    };
  }, [filteredTransactions]);

  // Overall stats
  const totalDeposits = transactions
    .filter((t) => t.type === "deposit" || t.type === "refund")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);

  const uploadReceiptFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `receipt-${Date.now()}.${fileExt}`;
    const filePath = `receipts/${fileName}`;

    const { error } = await supabase.storage
      .from('order-attachments')
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading receipt:', error);
      toast.error(t('Failed to upload receipt', '上传收据失败'));
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('order-attachments')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("Invalid amount", "金额无效"));
      return;
    }

    const by = depositBy.trim() || "Admin";
    localStorage.setItem("wallet-user", by);

    setIsSubmitting(true);

    let receiptUrl: string | undefined;
    if (depositFile) {
      setUploadingFile(true);
      const url = await uploadReceiptFile(depositFile);
      setUploadingFile(false);
      if (url) receiptUrl = url;
    }

    const result = await addDeposit(amount, depositDescription || "Deposit", by, receiptUrl);
    setIsSubmitting(false);

    if (result.success) {
      toast.success(t("Deposit added successfully", "存款成功"));
      setDepositOpen(false);
      setDepositAmount("");
      setDepositDescription("");
      setDepositFile(null);
    } else {
      toast.error(result.error || t("Failed to add deposit", "存款失败"));
    }
  };

  const handleRefund = async () => {
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("Invalid amount", "金额无效"));
      return;
    }

    const by = refundBy.trim() || "Admin";
    localStorage.setItem("wallet-user", by);

    setIsSubmitting(true);

    let receiptUrl: string | undefined;
    if (refundFile) {
      setUploadingFile(true);
      const url = await uploadReceiptFile(refundFile);
      setUploadingFile(false);
      if (url) receiptUrl = url;
    }

    const result = await addRefund(amount, refundDescription || "Manual refund", by, undefined, receiptUrl);
    setIsSubmitting(false);

    if (result.success) {
      toast.success(t("Refund added successfully", "退款成功"));
      setRefundOpen(false);
      setRefundAmount("");
      setRefundDescription("");
      setRefundFile(null);
    } else {
      toast.error(result.error || t("Failed to add refund", "退款失败"));
    }
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Type", "Description", "Agent", "Amount"];
    const rows = filteredTransactions.map((t) => [
      format(new Date(t.created_at), "yyyy-MM-dd HH:mm:ss"),
      t.type,
      t.description || "",
      t.created_by,
      t.type === "debit" ? `-${t.amount}` : t.amount,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `wallet-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.click();
    toast.success(t("Exported successfully", "导出成功"));
  };

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setAgentFilter("all");
    setDateRange(undefined);
  };

  const hasActiveFilters = searchQuery || typeFilter !== "all" || agentFilter !== "all" || dateRange;

  const setQuickDateRange = (days: number | "month" | "all") => {
    if (days === "all") {
      setDateRange(undefined);
    } else if (days === "month") {
      setDateRange({ from: subMonths(new Date(), 1), to: new Date() });
    } else {
      setDateRange({ from: subDays(new Date(), days), to: new Date() });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigate("/workflow")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                  <WalletIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  {t("Wallet", "钱包")}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {t("Manage your balance and expenses", "管理您的余额和支出")}
                </p>
              </div>
            </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
            <LanguageSelector language={language} onLanguageChange={setLanguage} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                  {t("Clear", "清空")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("Clear Wallet?", "清空钱包？")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      "This will delete ALL transaction history and reset the balance to $0.00. This action cannot be undone.",
                      "这将删除所有交易历史并将余额重置为 $0.00。此操作无法撤消。"
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("Cancel", "取消")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearWallet}
                    disabled={isClearing}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isClearing ? t("Clearing...", "清空中...") : t("Clear All", "全部清空")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("Refresh", "刷新")}
            </Button>
            <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("Add Funds", "添加资金")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {t("Add Deposit", "添加存款")}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>{t("Amount (USD)", "金额 (USD)")}</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="pl-10 text-lg font-semibold"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Description", "描述")}</Label>
                    <Textarea
                      placeholder={t("E.g., Wire transfer from bank", "例如：银行电汇")}
                      value={depositDescription}
                      onChange={(e) => setDepositDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Added by", "添加者")}</Label>
                    <Input
                      placeholder={t("Your name", "您的名字")}
                      value={depositBy}
                      onChange={(e) => setDepositBy(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      {t("Receipt / Proof", "收据 / 凭证")}
                    </Label>
                    {depositFile ? (
                      <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1">{depositFile.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDepositFile(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-4 rounded-md border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 cursor-pointer transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {t("Click to attach receipt", "点击附加收据")}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setDepositFile(file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleDeposit}
                    disabled={isSubmitting || uploadingFile || !depositAmount}
                  >
                    {uploadingFile ? t("Uploading...", "上传中...") : isSubmitting ? t("Processing...", "处理中...") : t("Confirm Deposit", "确认存款")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950">
                  <RefreshCw className="h-4 w-4" />
                  {t("Refund", "退款")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-blue-600">
                    <RefreshCw className="h-5 w-5" />
                    {t("Manual Refund", "手动退款")}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/50 p-3 text-sm text-blue-700 dark:text-blue-300">
                    {t(
                      "Use this to correct billing errors. The amount will be added back to the wallet balance.",
                      "使用此功能纠正计费错误。金额将添加回钱包余额。"
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Amount (USD)", "金额 (USD)")}</Label>
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
                  <div className="space-y-2">
                    <Label>{t("Reason", "原因")}</Label>
                    <Textarea
                      placeholder={t("E.g., Incorrect charge, billing error", "例如：收费错误、计费错误")}
                      value={refundDescription}
                      onChange={(e) => setRefundDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("Refunded by", "退款人")}</Label>
                    <Input
                      placeholder={t("Your name", "您的名字")}
                      value={refundBy}
                      onChange={(e) => setRefundBy(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      {t("Receipt / Proof", "收据 / 凭证")}
                    </Label>
                    {refundFile ? (
                      <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1">{refundFile.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRefundFile(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-4 rounded-md border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 cursor-pointer transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {t("Click to attach receipt", "点击附加收据")}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setRefundFile(file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={handleRefund}
                    disabled={isSubmitting || uploadingFile || !refundAmount}
                  >
                    {uploadingFile ? t("Uploading...", "上传中...") : isSubmitting ? t("Processing...", "处理中...") : t("Confirm Refund", "确认退款")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          </div>
        </div>
      </header>

      <main className="p-3 sm:p-6 max-w-6xl mx-auto">
        {/* Pending Approvals */}
        <div className="mb-6">
          <PendingDebitsApproval language={language} />
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <WalletIcon className="h-4 w-4" />
                  {t("Current Balance", "当前余额")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${(wallet?.balance || 0) < 0 ? "text-destructive" : "text-primary"}`}>
                  {formatCurrency(wallet?.balance || 0)}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                  {t("Total Deposits", "总存款")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(totalDeposits)}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                  {t("Total Expenses", "总支出")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">
                  {formatCurrency(totalDebits)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t("Transaction History", "交易记录")}
                  <Badge variant="secondary" className="ml-2">
                    {filteredTransactions.length}
                    {hasActiveFilters && ` / ${transactions.length}`}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className={showFilters ? "bg-primary/10" : ""}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {t("Filters", "筛选")}
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        !
                      </Badge>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    {t("Export CSV", "导出CSV")}
                  </Button>
                </div>
              </div>

              {/* Filters Section */}
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 p-4 rounded-lg bg-muted/30 border"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t("Search", "搜索")}</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={t("Order, description...", "订单、描述...")}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {/* Type Filter */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t("Type", "类型")}</Label>
                      <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("All Types", "所有类型")}</SelectItem>
                          <SelectItem value="deposit">{t("Deposits", "存款")}</SelectItem>
                          <SelectItem value="debit">{t("Debits", "支出")}</SelectItem>
                          <SelectItem value="refund">{t("Refunds", "退款")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Agent Filter */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t("Agent", "代理")}</Label>
                      <Select value={agentFilter} onValueChange={setAgentFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("All Agents", "所有代理")}</SelectItem>
                          {uniqueAgents.map((agent) => (
                            <SelectItem key={agent} value={agent}>
                              {agent}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t("Date Range", "日期范围")}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "LLL dd", { locale: dateLocale })} -{" "}
                                  {format(dateRange.to, "LLL dd", { locale: dateLocale })}
                                </>
                              ) : (
                                format(dateRange.from, "LLL dd, y", { locale: dateLocale })
                              )
                            ) : (
                              <span className="text-muted-foreground">{t("Pick dates", "选择日期")}</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-2 border-b flex gap-1 flex-wrap">
                            <Button variant="ghost" size="sm" onClick={() => setQuickDateRange(7)}>
                              {t("Last 7 days", "最近7天")}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setQuickDateRange(30)}>
                              {t("Last 30 days", "最近30天")}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setQuickDateRange("month")}>
                              {t("This month", "本月")}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setQuickDateRange("all")}>
                              {t("All time", "全部")}
                            </Button>
                          </div>
                          <CalendarComponent
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                            locale={dateLocale}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-2" />
                        {t("Clear filters", "清除筛选")}
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        {t("Showing", "显示")} {filteredTransactions.length} {t("of", "共")} {transactions.length} {t("transactions", "笔交易")}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Filtered Summary Stats */}
              {hasActiveFilters && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">
                      {t("Filtered Deposits", "筛选后存款")} ({filteredStats.depositCount})
                    </div>
                    <div className="text-lg font-bold text-green-700 dark:text-green-300">
                      +{formatCurrency(filteredStats.totalDeposits)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <div className="text-xs text-red-600 dark:text-red-400 mb-1">
                      {t("Filtered Debits", "筛选后支出")} ({filteredStats.debitCount})
                    </div>
                    <div className="text-lg font-bold text-red-700 dark:text-red-300">
                      -{formatCurrency(filteredStats.totalDebits)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                      {t("Filtered Refunds", "筛选后退款")} ({filteredStats.refundCount})
                    </div>
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      +{formatCurrency(filteredStats.totalRefunds)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    {hasActiveFilters
                      ? t("No transactions match filters", "没有匹配筛选条件的交易")
                      : t("No transactions yet", "暂无交易记录")}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      {t("Clear filters", "清除筛选")}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTransactions.map((transaction, index) => (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div
                          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                            transaction.type === "deposit"
                              ? "bg-green-500/20 text-green-600"
                              : transaction.type === "refund"
                              ? "bg-blue-500/20 text-blue-600"
                              : "bg-red-500/20 text-red-600"
                          }`}
                        >
                          {transaction.type === "deposit" ? (
                            <TrendingUp className="h-5 w-5" />
                          ) : transaction.type === "refund" ? (
                            <RefreshCw className="h-5 w-5" />
                          ) : (
                            <TrendingDown className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {transaction.description || (transaction.type === "deposit" ? "Deposit" : transaction.type === "refund" ? "Refund" : "Expense")}
                              </p>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  transaction.type === "deposit"
                                    ? "border-green-500 text-green-600"
                                    : transaction.type === "refund"
                                    ? "border-blue-500 text-blue-600"
                                    : "border-red-500 text-red-600"
                                }`}
                              >
                                {transaction.type === "deposit"
                                  ? t("Deposit", "存款")
                                  : transaction.type === "refund"
                                  ? t("Refund", "退款")
                                  : t("Debit", "支出")}
                              </Badge>
                            </div>
                            <p
                              className={`font-bold ${
                                transaction.type === "deposit"
                                  ? "text-green-600"
                                  : transaction.type === "refund"
                                  ? "text-blue-600"
                                  : "text-red-600"
                              }`}
                            >
                              {transaction.type === "debit" ? "-" : "+"}
                              {formatCurrency(transaction.amount)}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {transaction.created_by}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(transaction.created_at), "PPp", { locale: dateLocale })}
                            </span>
                            {(transaction as any).receipt_url && (
                              <a
                                href={(transaction as any).receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                <Paperclip className="h-3 w-3" />
                                {t("Receipt", "收据")}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      {index < filteredTransactions.length - 1 && <Separator className="my-2" />}
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
