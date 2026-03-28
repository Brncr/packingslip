import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WorkflowStage {
  id: string;
  name: string;
  color: string;
  position: number;
  wip_limit: number | null;
  created_at: string;
  updated_at: string;
}

export function useWorkflowStages() {
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStages = async () => {
    const { data, error } = await supabase
      .from("workflow_stages")
      .select("*")
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching stages:", error);
    } else {
      setStages(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStages();

    // Realtime subscription
    const channel = supabase
      .channel("workflow_stages_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflow_stages" },
        (payload) => {
          console.log("Stage update:", payload);
          fetchStages(); // Refetch to maintain order
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addStage = async (name: string, color: string = "bg-blue-500") => {
    const maxPosition = Math.max(...stages.map((s) => s.position), -1);
    const { data, error } = await supabase
      .from("workflow_stages")
      .insert({ name, color, position: maxPosition + 1 })
      .select()
      .single();

    if (error) {
      console.error("Error adding stage:", error);
      return { success: false, error };
    }
    return { success: true, data };
  };

  const updateStage = async (
    id: string,
    updates: Partial<Pick<WorkflowStage, "name" | "color" | "wip_limit">>
  ) => {
    const { error } = await supabase
      .from("workflow_stages")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Error updating stage:", error);
      return { success: false, error };
    }
    
    // Immediately refetch to update UI without waiting for realtime
    await fetchStages();
    return { success: true };
  };

  const deleteStage = async (id: string) => {
    const { error } = await supabase
      .from("workflow_stages")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting stage:", error);
      return { success: false, error };
    }
    return { success: true };
  };

  const reorderStages = async (reorderedStages: WorkflowStage[]) => {
    // Optimistic update
    setStages(reorderedStages);

    // Update positions in database
    const updates = reorderedStages.map((stage, index) =>
      supabase
        .from("workflow_stages")
        .update({ position: index })
        .eq("id", stage.id)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      console.error("Error reordering stages");
      fetchStages(); // Revert on error
      return { success: false };
    }
    return { success: true };
  };

  return {
    stages,
    loading,
    addStage,
    updateStage,
    deleteStage,
    reorderStages,
    refetch: fetchStages,
  };
}
