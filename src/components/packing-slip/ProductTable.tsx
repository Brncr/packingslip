import type { ShopifyLineItem, ShopifyProduct } from "@/types/shopify";

interface ProductTableProps {
  lineItems: ShopifyLineItem[];
  products: Record<number, ShopifyProduct>;
  subtotal: string;
  shippingCost: string;
  total: string;
}

export function ProductTable({ lineItems, products, subtotal, shippingCost, total }: ProductTableProps) {
  return (
    <div className="mb-6">
      <table className="invoice-table">
        <thead>
          <tr>
            <th className="w-24">PART NO.</th>
            <th className="w-40">Picture</th>
            <th>DESCRIPTION</th>
            <th className="w-16 text-center">QTY</th>
            <th className="w-28 text-right">Unit Price($)</th>
            <th className="w-28 text-right">AMOUNT($)</th>
          </tr>
        </thead>
        <tbody>
        {lineItems.map((item) => {
            const product = products[item.product_id];
            const imageUrl = product?.images?.[0]?.src;
            
            // Extract custom properties (Bike Size, Wheel, etc. from Avis app)
            const bikeSize = item.properties?.find(p => p.name.toLowerCase().includes('bike size') || p.name.toLowerCase().includes('size'))?.value;
            const wheelType = item.properties?.find(p => p.name.toLowerCase().includes('wheel'))?.value;
            
            const descriptionParts = [
              `Brand: ${item.vendor || 'TWITTER'}`,
              item.title,
              item.variant_title ? `Config: ${item.variant_title}` : null,
              bikeSize ? `Bike Size: ${bikeSize}` : null,
              wheelType ? `Wheel: ${wheelType}` : null,
              // Include any other custom properties
              ...(item.properties || [])
                .filter(p => !p.name.toLowerCase().includes('bike size') && 
                            !p.name.toLowerCase().includes('size') && 
                            !p.name.toLowerCase().includes('wheel'))
                .map(p => `${p.name}: ${p.value}`)
            ].filter(Boolean);
            
            const description = descriptionParts.join('\n');

            return (
              <tr key={item.id}>
                <td className="font-mono text-sm">{item.sku || '-'}</td>
                <td className="p-2">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={item.title}
                      className="w-32 h-24 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-32 h-24 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                      No image
                    </div>
                  )}
                </td>
                <td className="whitespace-pre-line">{description}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right font-mono">{parseFloat(item.price).toFixed(0)}</td>
                <td className="text-right font-mono">{(parseFloat(item.price) * item.quantity).toFixed(0)}</td>
              </tr>
            );
          })}
          
          {/* EXW Row */}
          <tr>
            <td colSpan={4} className="text-center font-medium">EXW</td>
            <td className="text-right font-medium">Shipping cost ($)</td>
            <td className="text-right font-mono">{parseFloat(shippingCost).toFixed(0)}</td>
          </tr>
          
          {/* Total Row */}
          <tr className="bg-muted/50">
            <td colSpan={4}></td>
            <td className="text-right font-bold">Total Amount ($)</td>
            <td className="text-right font-mono font-bold">${parseFloat(total).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
