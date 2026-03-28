import { motion } from "framer-motion";
import { Package, FileSpreadsheet, DollarSign, TrendingUp } from "lucide-react";
import type { ShopifyOrder } from "@/types/shopify";

interface DashboardProps {
  orders: ShopifyOrder[] | undefined;
  spreadsheetsCount: number;
}

export function Dashboard({ orders, spreadsheetsCount }: DashboardProps) {
  const totalOrders = orders?.length || 0;
  const paidOrders = orders?.filter(o => o.financial_status === 'paid').length || 0;
  
  const totalRevenue = orders?.reduce((sum, order) => {
    return sum + parseFloat(order.total_price);
  }, 0) || 0;
  
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const stats = [
    {
      label: "Orders",
      value: totalOrders,
      detail: `${paidOrders} paid`,
      icon: Package,
    },
    {
      label: "Exported",
      value: spreadsheetsCount,
      icon: FileSpreadsheet,
    },
    {
      label: "Revenue",
      value: `$${(totalRevenue / 1000).toFixed(1)}k`,
      icon: DollarSign,
    },
    {
      label: "AOV",
      value: `$${avgOrderValue.toFixed(0)}`,
      icon: TrendingUp,
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-4 gap-2 sm:gap-3 xl:flex xl:items-center xl:gap-4 px-2 sm:px-3 xl:px-4 py-2 xl:py-3 bg-card/50 backdrop-blur-sm rounded-xl border border-border"
    >
      {stats.map((stat, index) => (
        <div key={stat.label} className="flex flex-col xl:flex-row items-center xl:items-center gap-1 xl:gap-3 text-center xl:text-left">
          {index > 0 && <div className="hidden xl:block w-px h-8 bg-border" />}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{stat.label}</p>
            <div className="flex items-baseline justify-center xl:justify-start gap-1">
              <p className="text-sm sm:text-base xl:text-lg font-bold text-foreground">{stat.value}</p>
              {stat.detail && (
                <span className="text-[10px] text-muted-foreground hidden sm:inline">{stat.detail}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
