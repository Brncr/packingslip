interface TermsSectionProps {
  shippingTitle?: string;
  customerName?: string;
}

export function TermsSection({ shippingTitle, customerName }: TermsSectionProps) {
  // Extract delivery time from shipping title (e.g., "DDP: Handling+(18-22 days)")
  const deliveryMatch = shippingTitle?.match(/\((\d+-\d+\s*days?)\)/i);
  const deliveryTime = deliveryMatch ? deliveryMatch[1] : shippingTitle || "7-10 days";
  
  return (
    <div className="space-y-2 text-sm mb-6">
      <div className="grid grid-cols-[120px,1fr] gap-2">
        <span className="font-medium">1.TERMS:</span>
        <span>EXW</span>
      </div>
      <div className="grid grid-cols-[120px,1fr] gap-2">
        <span className="font-medium">2.PACKING:</span>
        <span>Carton</span>
      </div>
      <div className="grid grid-cols-[120px,1fr] gap-2">
        <span className="font-medium">3.PAYMENT:</span>
        <span>100% Payment Before Shipping</span>
      </div>
      <div className="grid grid-cols-[120px,1fr] gap-2">
        <span className="font-medium">4.SHIPPING:</span>
        <span>Shipping cost from Shenzhen to {customerName || 'Customer'}</span>
      </div>
      <div className="grid grid-cols-[120px,1fr] gap-2">
        <span className="font-medium">5.DELIVERY:</span>
        <span>{deliveryTime} After delivery</span>
      </div>
    </div>
  );
}
