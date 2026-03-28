import type { ShopifyOrder } from "@/types/shopify";
import { formatAddress, formatDate, generateInvoiceNumber } from "@/lib/shopify";

interface BuyerInfoProps {
  order: ShopifyOrder;
}

export function BuyerInfo({ order }: BuyerInfoProps) {
  const date = formatDate(order.created_at);
  const invoiceNumber = generateInvoiceNumber(order.order_number, date);
  const address = order.shipping_address || order.customer?.default_address;
  const customerName = order.customer 
    ? `TB${order.order_number}-${order.customer.first_name} ${order.customer.last_name}`
    : `TB${order.order_number}`;

  return (
    <div className="grid grid-cols-2 gap-6 mb-6">
      {/* Left Column - Buyer Info */}
      <div className="space-y-3">
        <div className="grid grid-cols-[140px,1fr] gap-2">
          <span className="invoice-label">Buyer's COMPANY</span>
          <span className="invoice-value">{address?.company || '-'}</span>
        </div>
        <div className="grid grid-cols-[140px,1fr] gap-2">
          <span className="invoice-label">Buyer's ADDRESS</span>
          <span className="invoice-value whitespace-pre-line">
            {address ? formatAddress(address) : '-'}
          </span>
        </div>
        <div className="grid grid-cols-[140px,1fr] gap-2">
          <span className="invoice-label">Buyer's CONTACT</span>
          <span className="invoice-value">{customerName}</span>
        </div>
        <div className="grid grid-cols-[140px,1fr] gap-2">
          <span className="invoice-label">Buyer's TEL</span>
          <span className="invoice-value">{order.customer?.phone || '-'}</span>
        </div>
        <div className="grid grid-cols-[140px,1fr] gap-2">
          <span className="invoice-label">Buyer's EMAIL</span>
          <span className="invoice-value">{order.customer?.email || '-'}</span>
        </div>
      </div>

      {/* Right Column - Invoice Info */}
      <div className="space-y-3">
        <div className="grid grid-cols-[120px,1fr] gap-2">
          <span className="invoice-label">DATE</span>
          <span className="invoice-value">{date}</span>
        </div>
        <div className="grid grid-cols-[120px,1fr] gap-2">
          <span className="invoice-label">P/I No.</span>
          <span className="invoice-value">{invoiceNumber}</span>
        </div>
        <div className="grid grid-cols-[120px,1fr] gap-2">
          <span className="invoice-label">One touch No.</span>
          <span className="invoice-value">***</span>
        </div>
        <div className="grid grid-cols-[120px,1fr] gap-2">
          <span className="invoice-label">SHIP TO</span>
          <span className="invoice-value">{address?.country || 'United States'}</span>
        </div>
        <div className="grid grid-cols-[120px,1fr] gap-2">
          <span className="invoice-label">FROM</span>
          <span className="invoice-value">Shenzhen, China</span>
        </div>
      </div>
    </div>
  );
}
