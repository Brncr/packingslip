import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ChatMessage = Database["public"]["Tables"]["general_chat_messages"]["Row"];
type OrderWorkflow = Database["public"]["Tables"]["order_workflow"]["Row"];

export function useGeneralChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [orders, setOrders] = useState<OrderWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUser = (() => {
    const token = localStorage.getItem("admin-auth-token");
    if (token) {
      try {
        const decoded = JSON.parse(atob(token));
        if (decoded.exp && decoded.exp > Date.now()) return decoded.username || "Admin";
      } catch {}
    }
    return localStorage.getItem("comment-author-name") || "Agent";
  })();

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("general_chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200);

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("order_workflow")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (data) {
      setOrders(data);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string, orderNumber?: string, orderWorkflowId?: string) => {
      const { error } = await supabase.from("general_chat_messages").insert({
        author_name: currentUser,
        content,
        order_number: orderNumber || null,
        order_workflow_id: orderWorkflowId || null,
      });

      if (error) {
        console.error("Error sending message:", error);
        return false;
      }
      return true;
    },
    [currentUser]
  );

  useEffect(() => {
    fetchMessages();
    fetchOrders();

    const channel = supabase
      .channel("general_chat_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "general_chat_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "general_chat_messages" },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as ChatMessage).id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, fetchOrders]);

  return {
    messages,
    orders,
    loading,
    currentUser,
    sendMessage,
    refetch: fetchMessages,
  };
}
