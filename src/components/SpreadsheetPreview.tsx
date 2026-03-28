import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Calendar, User, Package, FileSpreadsheet, Edit3, Eye, Maximize2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SpreadsheetPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheet: {
    id: string;
    spreadsheet_id: string;
    spreadsheet_url: string;
    order_number: string;
    customer_name: string;
    file_name: string;
    created_at: string;
  } | null;
}

export function SpreadsheetPreview({ isOpen, onClose, spreadsheet }: SpreadsheetPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  if (!spreadsheet) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Use preview URL for embedding (more reliable)
  const getPreviewUrl = () => {
    const baseUrl = spreadsheet.spreadsheet_url.replace('/edit', '');
    return `${baseUrl}/preview`;
  };

  // Open for editing in new tab (avoids iframe restrictions)
  const handleEdit = () => {
    window.open(spreadsheet.spreadsheet_url, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`fixed z-50 flex flex-col ${
              isFullscreen ? 'inset-0 p-0' : 'inset-2 sm:inset-4 md:inset-8'
            }`}
          >
            <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xl flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-foreground truncate">{spreadsheet.file_name}</h2>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {spreadsheet.order_number}
                      </span>
                      <span className="hidden xs:flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {spreadsheet.customer_name}
                      </span>
                      <span className="hidden md:flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(spreadsheet.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Button
                    size="sm"
                    onClick={handleEdit}
                    className="gap-1.5 h-8"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(spreadsheet.spreadsheet_url, '_blank')}
                    className="gap-1.5 h-8 hidden sm:flex"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    className="h-8 w-8 hidden sm:flex"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  
                  <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              
              {/* Preview iframe */}
              <div className="flex-1 bg-muted/20 relative">
                {iframeError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
                    <h3 className="font-semibold text-foreground mb-1">Couldn't load preview</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      The spreadsheet couldn't be embedded. Click below to open it directly.
                    </p>
                    <Button onClick={handleEdit} className="gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Open in Google Sheets
                    </Button>
                  </div>
                ) : (
                  <iframe
                    src={getPreviewUrl()}
                    className="w-full h-full border-0"
                    title="Preview Spreadsheet"
                    onError={() => setIframeError(true)}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
