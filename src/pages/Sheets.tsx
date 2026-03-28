import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package, FileSpreadsheet, Trash2, Loader2, Search, Calendar, User, XSquare, Eye, ExternalLink } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ContextualHelp } from "@/components/ContextualHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SpreadsheetPreview } from "@/components/SpreadsheetPreview";
import { supabase } from "@/integrations/supabase/client";
import { deleteSpreadsheet } from "@/lib/googleSheets";
import { useLanguageState } from "@/hooks/useLanguage";
import { toast } from "sonner";
import twitterLogo from "@/assets/twitter-logo.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GeneratedSpreadsheet {
  id: string;
  spreadsheet_id: string;
  spreadsheet_url: string;
  order_number: string;
  customer_name: string;
  file_name: string;
  created_at: string;
}

const Sheets = () => {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<GeneratedSpreadsheet | null>(null);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewSpreadsheet, setPreviewSpreadsheet] = useState<GeneratedSpreadsheet | null>(null);
  const { language } = useLanguageState();

  const { data: spreadsheets, isLoading } = useQuery({
    queryKey: ["generated-spreadsheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_spreadsheets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GeneratedSpreadsheet[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (spreadsheet: GeneratedSpreadsheet) => {
      try {
        await deleteSpreadsheet(spreadsheet.spreadsheet_id);
      } catch (error) {
        console.warn("Failed to delete from Google Drive:", error);
      }

      const { error } = await supabase
        .from("generated_spreadsheets")
        .delete()
        .eq("id", spreadsheet.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-spreadsheets"] });
      toast.success("Spreadsheet deleted successfully!");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error("Error deleting spreadsheet", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const deleteSelectedMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const toDelete = spreadsheets?.filter((s) => ids.includes(s.id)) || [];
      
      for (const spreadsheet of toDelete) {
        try {
          await deleteSpreadsheet(spreadsheet.spreadsheet_id);
        } catch (error) {
          console.warn("Failed to delete from Google Drive:", error);
        }
      }

      const { error } = await supabase
        .from("generated_spreadsheets")
        .delete()
        .in("id", ids);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["generated-spreadsheets"] });
      toast.success(`${count} spreadsheet(s) deleted successfully!`);
      setSelectedIds(new Set());
      setDeleteSelectedOpen(false);
    },
    onError: (error) => {
      toast.error("Error deleting spreadsheets", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredSpreadsheets = spreadsheets?.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.file_name.toLowerCase().includes(query) ||
      s.order_number.toLowerCase().includes(query) ||
      s.customer_name.toLowerCase().includes(query)
    );
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredSpreadsheets) return;
    
    const allFilteredIds = filteredSpreadsheets.map((s) => s.id);
    const allSelected = allFilteredIds.every((id) => selectedIds.has(id));
    
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected = filteredSpreadsheets && filteredSpreadsheets.length > 0 && 
    filteredSpreadsheets.every((s) => selectedIds.has(s.id));
  
  const isSomeSelected = selectedIds.size > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={twitterLogo} alt="Twitter Bikes" className="h-9 w-auto" />
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-foreground">Spreadsheets</h1>
                <p className="text-xs text-muted-foreground">
                  {spreadsheets?.length || 0} exported
                </p>
              </div>

              <nav className="hidden sm:flex items-center gap-1 ml-2 pl-3 border-l border-border">
                <NavLink to="/">
                  <Package className="w-4 h-4" />
                  <span className="hidden md:inline">Orders</span>
                </NavLink>
                <NavLink to="/sheets">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden md:inline">Sheets</span>
                </NavLink>
              </nav>
            </div>

            <ThemeToggle />
          </div>

          {/* Mobile Navigation */}
          <nav className="flex sm:hidden gap-2 mt-3 pt-3 border-t border-border">
            <NavLink to="/">
              <Package className="w-4 h-4" />
              Orders
            </NavLink>
            <NavLink to="/sheets">
              <FileSpreadsheet className="w-4 h-4" />
              Sheets
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        <div className="bg-card rounded-xl border border-border p-4">
          {/* Search and Actions */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            
            {/* Selection Actions */}
            {isSomeSelected && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="h-8 gap-1.5"
                >
                  <XSquare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteSelectedOpen(true)}
                  className="h-8 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            )}
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredSpreadsheets || filteredSpreadsheets.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-30" />
              {searchQuery ? (
                <>
                  <p className="text-lg font-medium">No results found</p>
                  <p className="text-sm">Try searching for another term</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">No spreadsheets generated yet</p>
                  <p className="text-sm">Go to Packing Slips and export an order</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select All Header */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-border text-sm">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
                <button
                  onClick={toggleSelectAll}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isAllSelected ? "Deselect all" : "Select all"}
                </button>
              </div>

              {filteredSpreadsheets.map((spreadsheet, index) => (
                <motion.div
                  key={spreadsheet.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className={`flex items-center gap-2 sm:gap-3 p-3 rounded-lg border transition-all ${
                    selectedIds.has(spreadsheet.id)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/30 border-transparent hover:bg-primary/5 hover:border-primary/20"
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(spreadsheet.id)}
                    onCheckedChange={() => toggleSelect(spreadsheet.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  />
                  
                  <button
                    onClick={() => setPreviewSpreadsheet(spreadsheet)}
                    className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <FileSpreadsheet className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {spreadsheet.file_name}
                      </p>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {spreadsheet.order_number}
                        </span>
                        <span className="hidden xs:flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {spreadsheet.customer_name}
                        </span>
                        <span className="hidden sm:flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(spreadsheet.created_at)}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(spreadsheet.spreadsheet_url, '_blank');
                      }}
                      title="Open in Google Sheets"
                      className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(spreadsheet);
                      }}
                      title="Delete"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete single confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete spreadsheet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the spreadsheet "{deleteTarget?.file_name}" from Google Drive and the system.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete selected confirmation */}
      <AlertDialog open={deleteSelectedOpen} onOpenChange={setDeleteSelectedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} spreadsheet(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected spreadsheets from Google Drive and the system.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSelectedMutation.mutate(Array.from(selectedIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteSelectedMutation.isPending}
            >
              {deleteSelectedMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Spreadsheet Preview Modal */}
      <SpreadsheetPreview
        isOpen={!!previewSpreadsheet}
        onClose={() => setPreviewSpreadsheet(null)}
        spreadsheet={previewSpreadsheet}
      />

      <ContextualHelp page="sheets" language={language} />
    </div>
  );
};

export default Sheets;
