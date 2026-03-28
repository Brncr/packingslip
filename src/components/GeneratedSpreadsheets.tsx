import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, FileSpreadsheet, Loader2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cleanupDriveSpreadsheets, deleteSpreadsheet, getDriveQuota } from "@/lib/googleSheets";
import { toast } from "sonner";
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

function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) return "-";
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function GeneratedSpreadsheets() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<GeneratedSpreadsheet | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);

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

  const { data: quota, isLoading: isQuotaLoading } = useQuery({
    queryKey: ["drive-quota"],
    queryFn: async () => getDriveQuota(),
    staleTime: 60_000,
    retry: 1,
  });

  const quotaText = useMemo(() => {
    const limit = quota?.storageQuota?.limit ? Number(quota.storageQuota.limit) : undefined;
    const usage = quota?.storageQuota?.usage ? Number(quota.storageQuota.usage) : undefined;
    if (!limit || !usage) return null;
    return `${formatBytes(usage)} / ${formatBytes(limit)}`;
  }, [quota]);

  const deleteMutation = useMutation({
    mutationFn: async (spreadsheet: GeneratedSpreadsheet) => {
      // Delete from Google Drive
      try {
        await deleteSpreadsheet(spreadsheet.spreadsheet_id);
      } catch (error) {
        console.warn("Failed to delete from Google Drive:", error);
        // Continue to delete from database even if Drive deletion fails
      }

      // Delete from database
      const { error } = await supabase
        .from("generated_spreadsheets")
        .delete()
        .eq("id", spreadsheet.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-spreadsheets"] });
      queryClient.invalidateQueries({ queryKey: ["drive-quota"] });
      toast.success("Spreadsheet deleted successfully!");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error("Error deleting spreadsheet", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => cleanupDriveSpreadsheets({ nameContains: "PI-TB", maxToDelete: 100 }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["drive-quota"] });
      toast.success("Drive cleanup completed", {
        description: `${result.deletedCount} spreadsheet(s) deleted (filter: ${result.nameContains}).`,
      });
      setCleanupOpen(false);
    },
    onError: (error) => {
      toast.error("Could not clean up Drive", {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {isQuotaLoading ? "Checking Drive quota..." : quotaText ? `Drive: ${quotaText}` : "Drive: -"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCleanupOpen(true)}>
          <HardDrive className="w-4 h-4 mr-2" />
          Clean Drive
        </Button>
      </div>

      {!spreadsheets || spreadsheets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No spreadsheets generated yet</p>
          <p className="text-sm">
            If you see <span className="font-mono">storageQuotaExceeded</span> error, use "Clean Drive" above.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {spreadsheets.map((spreadsheet) => (
            <button
              key={spreadsheet.id}
              onClick={() => window.open(spreadsheet.spreadsheet_url, "_blank")}
              className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-primary/10 hover:border-primary/30 border border-transparent transition-all cursor-pointer text-left group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileSpreadsheet className="w-5 h-5 text-primary flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors">
                    {spreadsheet.file_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {spreadsheet.order_number} • {formatDate(spreadsheet.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-muted-foreground mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to open
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(spreadsheet);
                  }}
                  title="Delete spreadsheet"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Delete single spreadsheet */}
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

      {/* Cleanup Drive spreadsheets */}
      <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clean system Drive account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete old spreadsheets from the system Drive (filter: name contains "PI-TB").
              Use this when you see the quota exceeded error (storageQuotaExceeded).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Clean now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
