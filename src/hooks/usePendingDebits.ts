import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PendingDebit {
  id: string;
  workflow_id: string;
  order_number: string;
  customer_name: string;
  amount: number;
  description: string | null;
  created_by: string;
  status: "pending" | "approved" | "rejected";
  debit_type: "item" | "total_cost";
  item_name: string | null;
  item_price: number | null;
  item_quantity: number | null;
  previous_total_cost: number | null;
  new_total_cost: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export function usePendingDebits() {
  const [pendingDebits, setPendingDebits] = useState<PendingDebit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    const { data, error } = await supabase
      .from("pending_debits")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pending debits:", error);
    } else {
      setPendingDebits((data || []) as unknown as PendingDebit[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();

    const channel = supabase
      .channel("pending_debits_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_debits" },
        () => {
          fetchPending();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPending]);

  const createPendingDebit = async (debit: {
    workflow_id: string;
    order_number: string;
    customer_name: string;
    amount: number;
    description: string;
    created_by: string;
    debit_type: "item" | "total_cost";
    item_name?: string;
    item_price?: number;
    item_quantity?: number;
    previous_total_cost?: number;
    new_total_cost?: number;
  }) => {
    const { error } = await supabase.from("pending_debits").insert({
      workflow_id: debit.workflow_id,
      order_number: debit.order_number,
      customer_name: debit.customer_name,
      amount: debit.amount,
      description: debit.description,
      created_by: debit.created_by,
      debit_type: debit.debit_type,
      item_name: debit.item_name || null,
      item_price: debit.item_price || null,
      item_quantity: debit.item_quantity || null,
      previous_total_cost: debit.previous_total_cost ?? 0,
      new_total_cost: debit.new_total_cost ?? 0,
    } as any);

    if (error) {
      console.error("Error creating pending debit:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const approveDebit = async (debitId: string, reviewedBy: string) => {
    const { error } = await supabase
      .from("pending_debits")
      .update({
        status: "approved",
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", debitId);

    if (error) {
      console.error("Error approving debit:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const rejectDebit = async (debitId: string, reviewedBy: string) => {
    const { error } = await supabase
      .from("pending_debits")
      .update({
        status: "rejected",
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", debitId);

    if (error) {
      console.error("Error rejecting debit:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  return {
    pendingDebits,
    loading,
    createPendingDebit,
    approveDebit,
    rejectDebit,
    refetch: fetchPending,
  };
}
