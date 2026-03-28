import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Wallet {
  id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: "deposit" | "debit" | "refund";
  amount: number;
  description: string | null;
  order_id: string | null;
  created_by: string;
  created_at: string;
  receipt_url: string | null;
}

interface OrderItem {
  id: string;
  workflow_id: string;
  name: string;
  price: number;
  quantity: number;
  created_at: string;
}

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    const { data, error } = await supabase
      .from("wallet")
      .select("*")
      .single();

    if (error) {
      console.error("Error fetching wallet:", error);
    } else {
      setWallet(data);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching transactions:", error);
    } else {
      setTransactions((data || []) as WalletTransaction[]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchWallet(), fetchTransactions()]);
    setLoading(false);
  }, [fetchWallet, fetchTransactions]);

  useEffect(() => {
    loadAll();

    // Realtime updates for wallet
    const walletChannel = supabase
      .channel("wallet_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet" },
        () => {
          fetchWallet();
        }
      )
      .subscribe();

    // Realtime updates for transactions
    const transChannel = supabase
      .channel("wallet_transactions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_transactions" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTransactions((prev) => [payload.new as WalletTransaction, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setTransactions((prev) =>
              prev.filter((t) => t.id !== (payload.old as WalletTransaction).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
      supabase.removeChannel(transChannel);
    };
  }, [fetchWallet, fetchTransactions, loadAll]);

  const addDeposit = async (
    amount: number,
    description: string,
    createdBy: string,
    receiptUrl?: string
  ) => {
    if (!wallet) return { success: false, error: "Wallet not found" };

    const { error: transError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        type: "deposit",
        amount,
        description,
        created_by: createdBy,
        receipt_url: receiptUrl || null,
      } as any);

    if (transError) {
      console.error("Error creating deposit:", transError);
      return { success: false, error: transError.message };
    }

    // Atomic balance update
    const { error: walletError } = await supabase.rpc("update_wallet_balance", {
      p_wallet_id: wallet.id,
      p_amount: amount,
      p_operation: "add",
    });

    if (walletError) {
      console.error("Error updating wallet:", walletError);
      return { success: false, error: walletError.message };
    }

    fetchWallet();
    return { success: true };
  };

  const addDebit = async (
    amount: number,
    description: string,
    createdBy: string,
    orderId?: string
  ) => {
    if (!wallet) return { success: false, error: "Wallet not found" };

    const { error: transError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        type: "debit",
        amount,
        description,
        created_by: createdBy,
        order_id: orderId || null,
      });

    if (transError) {
      console.error("Error creating debit:", transError);
      return { success: false, error: transError.message };
    }

    // Atomic balance update
    const { error: walletError } = await supabase.rpc("update_wallet_balance", {
      p_wallet_id: wallet.id,
      p_amount: amount,
      p_operation: "subtract",
    });

    if (walletError) {
      console.error("Error updating wallet:", walletError);
      return { success: false, error: walletError.message };
    }

    fetchWallet();
    return { success: true };
  };

  const addRefund = async (
    amount: number,
    description: string,
    createdBy: string,
    orderId?: string,
    receiptUrl?: string
  ) => {
    if (!wallet) return { success: false, error: "Wallet not found" };

    const { error: transError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        type: "refund",
        amount,
        description,
        created_by: createdBy,
        order_id: orderId || null,
        receipt_url: receiptUrl || null,
      } as any);

    if (transError) {
      console.error("Error creating refund:", transError);
      return { success: false, error: transError.message };
    }

    // Atomic balance update
    const { error: walletError } = await supabase.rpc("update_wallet_balance", {
      p_wallet_id: wallet.id,
      p_amount: amount,
      p_operation: "add",
    });

    if (walletError) {
      console.error("Error updating wallet:", walletError);
      return { success: false, error: walletError.message };
    }

    fetchWallet();
    return { success: true };
  };

  return {
    wallet,
    transactions,
    loading,
    addDeposit,
    addDebit,
    addRefund,
    refetch: loadAll,
  };
}

export function useOrderItems(workflowId: string | undefined) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching order items:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, [workflowId]);

  useEffect(() => {
    fetchItems();

    if (!workflowId) return;

    const channel = supabase
      .channel(`order_items_${workflowId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: `workflow_id=eq.${workflowId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => [...prev, payload.new as OrderItem]);
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) =>
              prev.map((i) =>
                i.id === (payload.new as OrderItem).id
                  ? (payload.new as OrderItem)
                  : i
              )
            );
          } else if (payload.eventType === "DELETE") {
            setItems((prev) =>
              prev.filter((i) => i.id !== (payload.old as OrderItem).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workflowId, fetchItems]);

  const addItem = async (name: string, price: number, quantity: number = 1) => {
    if (!workflowId) return { success: false };

    const { error } = await supabase.from("order_items").insert({
      workflow_id: workflowId,
      name,
      price,
      quantity,
    });

    if (error) {
      console.error("Error adding item:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const updateItem = async (
    itemId: string,
    updates: Partial<{ name: string; price: number; quantity: number }>
  ) => {
    const { error } = await supabase
      .from("order_items")
      .update(updates)
      .eq("id", itemId);

    if (error) {
      console.error("Error updating item:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const deleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from("order_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      console.error("Error deleting item:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const totalItemsCost = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return {
    items,
    loading,
    addItem,
    updateItem,
    deleteItem,
    totalItemsCost,
    refetch: fetchItems,
  };
}

export type { Wallet, WalletTransaction, OrderItem };
