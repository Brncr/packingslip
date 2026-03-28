import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Hash, Send, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useGeneralChat } from "@/hooks/useGeneralChat";
import { format } from "date-fns";
import { DynamicOrderDetailModal } from "./workflow/DynamicOrderDetailModal";
import { useWorkflowStages } from "@/hooks/useWorkflowStages";
import { useLanguageState } from "@/hooks/useLanguage";
import type { Database } from "@/integrations/supabase/types";

type OrderWorkflow = Database["public"]["Tables"]["order_workflow"]["Row"];

interface GeneralChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GeneralChat({ isOpen, onClose }: GeneralChatProps) {
  const { messages, orders, loading, currentUser, sendMessage } = useGeneralChat();
  const { language } = useLanguageState();
  const { stages } = useWorkflowStages();
  
  const [inputValue, setInputValue] = useState("");
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<{
    order_number: string;
    id: string;
    customer_name: string;
  } | null>(null);
  const [modalOrder, setModalOrder] = useState<OrderWorkflow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const orderPickerRef = useRef<HTMLDivElement>(null);

  const handleOpenOrderModal = (orderId: string | null) => {
    if (!orderId) return;
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      setModalOrder(order);
      setIsModalOpen(true);
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages.length, isOpen]);

  // Close order picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orderPickerRef.current && !orderPickerRef.current.contains(e.target as Node)) {
        setShowOrderPicker(false);
      }
    };
    if (showOrderPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showOrderPicker]);

  // Filter orders for picker
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return orders.slice(0, 20);
    const q = orderSearch.toLowerCase();
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [orders, orderSearch]);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content) return;

    const success = await sendMessage(
      content,
      selectedOrder?.order_number,
      selectedOrder?.id
    );

    if (success) {
      setInputValue("");
      setSelectedOrder(null);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectOrder = (order: typeof orders[0]) => {
    setSelectedOrder({
      order_number: order.order_number,
      id: order.id,
      customer_name: order.customer_name,
    });
    setShowOrderPicker(false);
    setOrderSearch("");
    inputRef.current?.focus();
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-600",
      "bg-purple-600",
      "bg-green-600",
      "bg-orange-600",
      "bg-pink-600",
      "bg-teal-600",
      "bg-indigo-600",
      "bg-red-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={onClose}
          />

          {/* Chat Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="font-semibold text-base">General Chat</h2>
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 font-medium">
                  {messages.length}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-pulse text-sm text-muted-foreground">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground/70">Start a conversation about your orders</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isMe = msg.author_name === currentUser;
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(msg.author_name)}`}
                        >
                          {getInitial(msg.author_name)}
                        </div>

                        {/* Message bubble */}
                        <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                          {/* Author name */}
                          <span className={`text-[11px] text-muted-foreground mb-0.5 px-1 ${isMe ? "text-right" : "text-left"}`}>
                            {msg.author_name}
                          </span>

                          {/* Bubble */}
                          <div
                            className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                              isMe
                                ? "bg-blue-600 text-white rounded-br-md"
                                : "bg-muted text-foreground rounded-bl-md"
                            }`}
                          >
                            {msg.content}
                          </div>

                          {/* Order tag */}
                          {msg.order_number && (
                            <div className={`mt-1 ${isMe ? "self-end" : "self-start"}`}>
                              <Badge
                                variant="outline"
                                className="text-[11px] gap-1 px-2 py-0.5 font-medium border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                onClick={() => handleOpenOrderModal(msg.order_workflow_id)}
                              >
                                <Hash className="w-3 h-3" />
                                Order {msg.order_number}
                              </Badge>
                            </div>
                          )}

                          {/* Timestamp */}
                          <span className={`text-[10px] text-muted-foreground/60 mt-0.5 px-1 ${isMe ? "text-right" : "text-left"}`}>
                            {format(new Date(msg.created_at), "dd MMM. HH:mm")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Selected order indicator */}
            {selectedOrder && (
              <div className="px-4 py-1.5 border-t border-border bg-blue-50 dark:bg-blue-950/20 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs gap-1 px-2 py-0.5 font-medium border-blue-300 text-blue-700 dark:text-blue-300"
                >
                  <Hash className="w-3 h-3" />
                  {selectedOrder.order_number}
                </Badge>
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {selectedOrder.customer_name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setSelectedOrder(null)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-border p-3 bg-card relative">
              {/* Order Picker Dropdown */}
              <AnimatePresence>
                {showOrderPicker && (
                  <motion.div
                    ref={orderPickerRef}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-3 right-3 mb-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-10"
                  >
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search order..."
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {filteredOrders.length === 0 ? (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          No orders found
                        </div>
                      ) : (
                        filteredOrders.map((order) => (
                          <button
                            key={order.id}
                            onClick={() => handleSelectOrder(order)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/60 transition-colors text-left"
                          >
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                              #{order.order_number}
                            </span>
                            <span className="text-xs text-muted-foreground truncate ml-2 max-w-[150px]">
                              {order.customer_name}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2">
                <Button
                  variant={showOrderPicker ? "default" : "outline"}
                  size="icon"
                  className={`h-9 w-9 flex-shrink-0 ${
                    showOrderPicker
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : selectedOrder
                        ? "border-blue-400 text-blue-600"
                        : ""
                  }`}
                  onClick={() => setShowOrderPicker(!showOrderPicker)}
                >
                  <Hash className="w-4 h-4" />
                </Button>
                <Input
                  ref={inputRef}
                  placeholder="Type a message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 h-9"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 flex-shrink-0 bg-blue-600 hover:bg-blue-700"
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {modalOrder && (
        <DynamicOrderDetailModal
          order={modalOrder}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          language={language}
          stageLabel={stages.find((s) => s.id === modalOrder.stage_id)?.name || "Unknown"}
          stageColor={stages.find((s) => s.id === modalOrder.stage_id)?.color || "bg-gray-500"}
          allStages={stages}
        />
      )}
    </AnimatePresence>
  );
}
