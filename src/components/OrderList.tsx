import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileText, Search, RefreshCw, CheckCircle2, Clock, ShoppingBag, Star } from "lucide-react";
import { fetchOrders } from "@/lib/shopify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { OrderListSkeleton } from "@/components/OrderListSkeleton";
import type { ShopifyOrder } from "@/types/shopify";
import { formatDate } from "@/lib/shopify";

interface OrderListProps {
  onSelectOrder: (order: ShopifyOrder) => void;
  selectedOrderId?: number;
  selectionMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (orderId: number) => void;
  favorites?: Set<number>;
  onToggleFavorite?: (orderId: number) => void;
}

type StatusFilter = 'all' | 'paid' | 'authorized' | 'favorites';

export function OrderList({ 
  onSelectOrder, 
  selectedOrderId,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  favorites = new Set(),
  onToggleFavorite,
}: OrderListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: orders, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['shopify-orders'],
    queryFn: fetchOrders,
    staleTime: 60000,
  });

  // Count orders by status
  const statusCounts = {
    all: orders?.length || 0,
    paid: orders?.filter(o => o.financial_status === 'paid').length || 0,
    authorized: orders?.filter(o => o.financial_status === 'authorized').length || 0,
    favorites: orders?.filter(o => favorites.has(o.id)).length || 0,
  };

  const filteredOrders = orders?.filter(order => {
    // Status filter
    if (statusFilter === 'favorites') {
      if (!favorites.has(order.id)) return false;
    } else if (statusFilter !== 'all' && order.financial_status !== statusFilter) {
      return false;
    }

    // Search filter
    const searchLower = search.toLowerCase();
    const customerName = order.customer 
      ? `${order.customer.first_name} ${order.customer.last_name}`.toLowerCase()
      : '';
    const orderNumber = order.order_number.toString();
    
    return customerName.includes(searchLower) || orderNumber.includes(searchLower);
  });

  if (isLoading) {
    return <OrderListSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8 text-destructive" />
        </div>
        <p className="text-destructive font-medium mb-2">Failed to load orders</p>
        <p className="text-sm text-muted-foreground mb-4">Check your connection and try again</p>
        <Button onClick={() => refetch()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search and Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 sm:pl-10 h-9 text-sm"
          />
        </div>
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh list"
          className="h-9 w-9 flex-shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Status Filter Buttons */}
      <div className="flex gap-1.5 sm:gap-2 flex-wrap">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
          className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs"
        >
          All
          <Badge variant="secondary" className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0 text-[10px] sm:text-xs">
            {statusCounts.all}
          </Badge>
        </Button>
        <Button
          variant={statusFilter === 'paid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('paid')}
          className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs"
        >
          <CheckCircle2 className="w-3 h-3" />
          <span className="hidden sm:inline">Paid</span>
          <Badge variant="secondary" className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0 text-[10px] sm:text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {statusCounts.paid}
          </Badge>
        </Button>
        <Button
          variant={statusFilter === 'authorized' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('authorized')}
          className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs"
        >
          <Clock className="w-3 h-3" />
          <span className="hidden sm:inline">Auth</span>
          <Badge variant="secondary" className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0 text-[10px] sm:text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {statusCounts.authorized}
          </Badge>
        </Button>
        {statusCounts.favorites > 0 && (
          <Button
            variant={statusFilter === 'favorites' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('favorites')}
            className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs"
          >
            <Star className="w-3 h-3" />
            <Badge variant="secondary" className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0 text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              {statusCounts.favorites}
            </Badge>
          </Button>
        )}
      </div>

      {/* Order List */}
      <div className="space-y-1.5 sm:space-y-2">
        {filteredOrders?.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">No orders found</p>
            {search && (
              <Button 
                variant="link" 
                onClick={() => setSearch("")}
                className="text-xs sm:text-sm mt-1"
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          filteredOrders?.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
              className="relative"
            >
              {selectionMode && (
                <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 z-10">
                  <Checkbox
                    checked={selectedIds.has(order.id)}
                    onCheckedChange={() => onToggleSelect?.(order.id)}
                  />
                </div>
              )}
              <button
                onClick={() => selectionMode ? onToggleSelect?.(order.id) : onSelectOrder(order)}
                className={`
                  w-full text-left p-2.5 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all duration-200
                  hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50
                  group
                  ${selectionMode ? 'pl-8 sm:pl-10' : ''}
                  ${selectedIds.has(order.id) ? 'border-primary bg-primary/10' : ''}
                  ${selectedOrderId === order.id 
                    ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20' 
                    : 'border-border bg-card hover:bg-card/80'
                  }
                `}
              >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className={`
                    w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0
                    ${selectedOrderId === order.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-primary/10 text-primary group-hover:bg-primary/20'
                    }
                  `}>
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold group-hover:text-primary transition-colors text-sm sm:text-base">
                      #{order.order_number}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {order.customer 
                        ? `${order.customer.first_name}`
                        : 'Guest'
                      }
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end flex-shrink-0">
                  {favorites.has(order.id) && (
                    <Star className="w-3 h-3 text-yellow-500 fill-current mb-0.5" />
                  )}
                  <p className="font-mono font-semibold text-foreground text-sm">
                    ${parseFloat(order.total_price).toFixed(0)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                </div>
              </div>
              <div className="mt-2 sm:mt-3 flex items-center gap-1.5 sm:gap-2">
                <span className={`
                  inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium transition-all
                  ${order.financial_status === 'paid' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }
                `}>
                  {order.financial_status === 'paid' ? (
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  ) : (
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  )}
                  <span className="hidden sm:inline">{order.financial_status}</span>
                </span>
                {order.line_items.length > 0 && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-0.5 sm:gap-1">
                    <ShoppingBag className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    {order.line_items.length}
                  </span>
                )}
              </div>
            </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
