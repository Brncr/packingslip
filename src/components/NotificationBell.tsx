import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR, zhCN } from "date-fns/locale";
import type { Language } from "@/hooks/useLanguage";

interface Notification {
  id: string;
  workflow_id: string;
  order_number: string;
  customer_name: string;
  activity_type: string;
  description: string;
  created_by: string;
  created_at: string;
}

interface NotificationBellProps {
  language: Language;
}

export function NotificationBell({ language }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

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

  const fetchNotifications = async () => {
    // Fetch last 50 notifications
    const { data } = await supabase
      .from("activity_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setNotifications(data);

      // Get read status for current user
      const { data: readStatuses } = await supabase
        .from("notification_read_status")
        .select("notification_id")
        .eq("user_name", currentUser);

      const readIds = new Set(readStatuses?.map(r => r.notification_id) || []);
      
      // Count unread notifications NOT created by current user
      const unread = data.filter(
        n => !readIds.has(n.id) && n.created_by !== currentUser
      ).length;
      setUnreadCount(unread);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("activity_notifications_bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          // Only increment if not from current user
          if (newNotif.created_by !== currentUser) {
            setNotifications(prev => [newNotif, ...prev].slice(0, 50));
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    
    if (isOpen && unreadCount > 0) {
      // Mark all as read for this user
      const unreadNotifs = notifications.filter(n => n.created_by !== currentUser);
      const inserts = unreadNotifs.map(n => ({
        notification_id: n.id,
        user_name: currentUser,
      }));

      if (inserts.length > 0) {
        await supabase
          .from("notification_read_status")
          .upsert(inserts, { onConflict: "notification_id,user_name", ignoreDuplicates: true });
      }
      
      setUnreadCount(0);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "comment": return "💬";
      case "attachment": return "📎";
      case "cost_update": return "💰";
      case "stage_change": return "🔄";
      default: return "📌";
    }
  };

  const getDateLocale = () => {
    return language === "zh" ? zhCN : ptBR;
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-bold animate-pulse"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">
            {language === "zh" ? "通知" : "Notificações"}
          </h4>
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {language === "zh" ? "暂无通知" : "Nenhuma notificação"}
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-3 hover:bg-muted/50 transition-colors ${
                    notif.created_by === currentUser ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">{getActivityIcon(notif.activity_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        #{notif.order_number} - {notif.customer_name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        <span className="font-medium">{notif.created_by}:</span> {notif.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), {
                          addSuffix: true,
                          locale: getDateLocale(),
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
