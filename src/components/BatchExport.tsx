import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileSpreadsheet, Loader2, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ShopifyOrder, ShopifyProduct } from "@/types/shopify";

interface BatchExportProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: ShopifyOrder[];
  onExport: (order: ShopifyOrder) => Promise<{ success: boolean; error?: string }>;
  products: Record<number, ShopifyProduct>;
}

interface ExportStatus {
  orderId: number;
  status: 'pending' | 'exporting' | 'success' | 'error';
  error?: string;
}

export function BatchExport({ isOpen, onClose, selectedOrders, onExport }: BatchExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatuses, setExportStatuses] = useState<ExportStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const progress = exportStatuses.length > 0 
    ? (exportStatuses.filter(s => s.status === 'success' || s.status === 'error').length / selectedOrders.length) * 100 
    : 0;

  const successCount = exportStatuses.filter(s => s.status === 'success').length;
  const errorCount = exportStatuses.filter(s => s.status === 'error').length;

  const startExport = async () => {
    setIsExporting(true);
    setExportStatuses(selectedOrders.map(order => ({
      orderId: order.id,
      status: 'pending',
    })));

    for (let i = 0; i < selectedOrders.length; i++) {
      const order = selectedOrders[i];
      setCurrentIndex(i);
      
      setExportStatuses(prev => prev.map(s => 
        s.orderId === order.id ? { ...s, status: 'exporting' } : s
      ));

      try {
        const result = await onExport(order);
        setExportStatuses(prev => prev.map(s => 
          s.orderId === order.id 
            ? { ...s, status: result.success ? 'success' : 'error', error: result.error } 
            : s
        ));
      } catch (error) {
        setExportStatuses(prev => prev.map(s => 
          s.orderId === order.id 
            ? { ...s, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' } 
            : s
        ));
      }

      // Small delay between exports to avoid rate limiting
      if (i < selectedOrders.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsExporting(false);
  };

  const handleClose = () => {
    if (!isExporting) {
      setExportStatuses([]);
      setCurrentIndex(0);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Batch Export</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleClose} disabled={isExporting}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {exportStatuses.length === 0 ? (
                // Pre-export state
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This will export all selected orders to Google Sheets. Each order will create a new spreadsheet.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleClose} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={startExport} className="flex-1 gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Start Export
                    </Button>
                  </div>
                </div>
              ) : (
                // Export progress state
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isExporting ? `Exporting order ${currentIndex + 1} of ${selectedOrders.length}...` : 'Export complete'}
                      </span>
                      <span className="font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Results summary */}
                  <div className="flex gap-4 justify-center py-2">
                    <div className="flex items-center gap-2 text-green-500">
                      <Check className="w-4 h-4" />
                      <span className="font-medium">{successCount} success</span>
                    </div>
                    {errorCount > 0 && (
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-medium">{errorCount} failed</span>
                      </div>
                    )}
                  </div>

                  {/* Order list with status */}
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {selectedOrders.map((order, index) => {
                      const status = exportStatuses.find(s => s.orderId === order.id);
                      return (
                        <div
                          key={order.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                        >
                          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            {status?.status === 'pending' && (
                              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                            )}
                            {status?.status === 'exporting' && (
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            )}
                            {status?.status === 'success' && (
                              <Check className="w-4 h-4 text-green-500" />
                            )}
                            {status?.status === 'error' && (
                              <AlertCircle className="w-4 h-4 text-destructive" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              Order #{order.order_number}
                            </p>
                            {status?.error && (
                              <p className="text-xs text-destructive truncate">{status.error}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!isExporting && (
                    <Button onClick={handleClose} className="w-full">
                      Done
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
