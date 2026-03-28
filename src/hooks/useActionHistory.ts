import { useState, useEffect, useCallback } from "react";

export interface ActionHistoryItem {
  id: string;
  type: 'export' | 'print' | 'delete';
  orderNumber: string;
  customerName: string;
  timestamp: Date;
  details?: string;
}

const HISTORY_KEY = 'packing-slip-action-history';
const MAX_HISTORY_ITEMS = 50;

export function useActionHistory() {
  const [history, setHistory] = useState<ActionHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((item: ActionHistoryItem) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
    } catch (error) {
      console.error('Failed to save action history:', error);
    }
  }, [history]);

  const addAction = useCallback((action: Omit<ActionHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: ActionHistoryItem = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setHistory(prev => [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getRecentActions = useCallback((count: number = 10) => {
    return history.slice(0, count);
  }, [history]);

  return {
    history,
    addAction,
    clearHistory,
    getRecentActions,
    historyCount: history.length,
  };
}
