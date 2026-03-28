import { motion } from "framer-motion";
import { Package, FileSpreadsheet, DollarSign, TrendingUp, Users, Clock } from "lucide-react";
import type { ShopifyOrder } from "@/types/shopify";

interface QuickStatsProps {
  orders: ShopifyOrder[] | undefined;
  spreadsheetsCount: number;
}

export function QuickStats({ orders, spreadsheetsCount }: QuickStatsProps) {
  const totalOrders = orders?.length || 0;
  const paidOrders = orders?.filter(o => o.financial_status === 'paid').length || 0;
  const pendingOrders = orders?.filter(o => o.financial_status === 'authorized').length || 0;
  
  const totalRevenue = orders?.reduce((sum, order) => {
    return sum + parseFloat(order.total_price);
  }, 0) || 0;

  const uniqueCustomers = new Set(orders?.map(o => o.customer?.id).filter(Boolean)).size;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-2 lg:grid-cols-3 gap-3"
    >
      <StatCard
        title="Total Orders"
        value={totalOrders}
        subtitle={`${paidOrders} paid, ${pendingOrders} pending`}
        icon={<Package className="w-5 h-5 text-primary" />}
      />
      <StatCard
        title="Exported"
        value={spreadsheetsCount}
        subtitle="Spreadsheets generated"
        icon={<FileSpreadsheet className="w-5 h-5 text-primary" />}
      />
      <StatCard
        title="Total Revenue"
        value={`$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={<DollarSign className="w-5 h-5 text-primary" />}
      />
      <StatCard
        title="Customers"
        value={uniqueCustomers}
        subtitle="Unique buyers"
        icon={<Users className="w-5 h-5 text-primary" />}
      />
      <StatCard
        title="Avg. Order"
        value={`$${avgOrderValue.toFixed(2)}`}
        icon={<TrendingUp className="w-5 h-5 text-primary" />}
      />
      <StatCard
        title="Pending"
        value={pendingOrders}
        subtitle="Awaiting payment"
        icon={<Clock className="w-5 h-5 text-primary" />}
      />
    </motion.div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}

const StatCard = ({ title, value, subtitle, icon }: StatCardProps) => (
  <div className="bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/30 transition-all duration-300">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <p className="text-xl font-bold text-foreground mt-1">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
    </div>
  </div>
);
