import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLog {
  id: string;
  action_type: string;
  order_number: string | null;
  customer_name: string | null;
  description: string;
  performed_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ADMIN_TOKEN_KEY = 'admin-auth-token';

function getAdminUsername(): string {
  try {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) {
      const decoded = JSON.parse(atob(token));
      return decoded.username || 'Admin';
    }
  } catch {}
  return localStorage.getItem("comment-author-name") || "Agent";
}

export async function logAuditAction(params: {
  action_type: string;
  order_number?: string;
  customer_name?: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const performed_by = getAdminUsername();
  const { error } = await (supabase as any).from('audit_logs').insert({
    action_type: params.action_type,
    order_number: params.order_number || null,
    customer_name: params.customer_name || null,
    description: params.description,
    performed_by,
    metadata: params.metadata || {},
  });
  if (error) console.error('[AuditLog] Failed to insert:', error);
}

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[AuditLog] Fetch error:', error);
    } else {
      setLogs((data as AuditLog[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('audit_logs_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          setLogs((prev) => [payload.new as AuditLog, ...prev].slice(0, 500));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  const filteredLogs = logs.filter((l) => {
    // Action type filter
    if (actionTypeFilter !== "all" && l.action_type !== actionTypeFilter) return false;
    // Text filter
    if (filter) {
      const q = filter.toLowerCase();
      return (
        l.action_type.toLowerCase().includes(q) ||
        l.order_number?.toLowerCase().includes(q) ||
        l.customer_name?.toLowerCase().includes(q) ||
        l.performed_by.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return { logs: filteredLogs, loading, filter, setFilter, actionTypeFilter, setActionTypeFilter, refetch: fetchLogs };
}
