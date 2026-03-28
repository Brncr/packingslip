import { motion, AnimatePresence } from "framer-motion";
import { FileSpreadsheet, Printer, Trash2, Clock, History } from "lucide-react";
import { ActionHistoryItem } from "@/hooks/useActionHistory";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface ActionHistoryProps {
  history: ActionHistoryItem[];
  onClear: () => void;
}

const getActionIcon = (type: ActionHistoryItem['type']) => {
  switch (type) {
    case 'export':
      return <FileSpreadsheet className="w-4 h-4 text-primary" />;
    case 'print':
      return <Printer className="w-4 h-4 text-blue-500" />;
    case 'delete':
      return <Trash2 className="w-4 h-4 text-destructive" />;
  }
};

const getActionLabel = (type: ActionHistoryItem['type']) => {
  switch (type) {
    case 'export':
      return 'Exported';
    case 'print':
      return 'Printed';
    case 'delete':
      return 'Deleted';
  }
};

export function ActionHistory({ history, onClear }: ActionHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No recent actions</p>
        <p className="text-xs">Your export and print history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Recent Actions
        </h3>
        <Button variant="ghost" size="sm" onClick={onClear} className="text-xs h-7">
          Clear
        </Button>
      </div>
      
      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {history.slice(0, 10).map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                {getActionIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {getActionLabel(item.type)} #{item.orderNumber}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.customerName}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(item.timestamp, { addSuffix: true })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
