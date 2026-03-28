import { motion } from "framer-motion";
import { 
  User, MapPin, Mail, Phone, Calendar, Hash, 
  Truck, CreditCard, Package, ShoppingBag 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ShopifyOrder, ShopifyProduct } from "@/types/shopify";
import { formatDate, generateInvoiceNumber, formatAddress } from "@/lib/shopify";

interface OrderPreviewProps {
  order: ShopifyOrder;
  products: Record<number, ShopifyProduct>;
}

export function OrderPreview({ order, products }: OrderPreviewProps) {
  const date = formatDate(order.created_at);
  const invoiceNumber = generateInvoiceNumber(order.order_number, date);
  const address = order.shipping_address || order.customer?.default_address;
  const customerName = order.customer 
    ? `${order.customer.first_name} ${order.customer.last_name}`
    : 'Guest';

  // Get main product (most expensive)
  const sortedItems = [...order.line_items].sort((a, b) => 
    parseFloat(b.price) - parseFloat(a.price)
  );
  const mainItem = sortedItems[0];
  const addons = sortedItems.slice(1);
  const mainProduct = mainItem ? products[mainItem.product_id] : undefined;

  // Get product image - prioritize from properties (Avis app), then from product
  const getProductImage = () => {
    if (mainItem?.properties) {
      const imageProperty = mainItem.properties.find(p => 
        p.name.toLowerCase().includes('image') || 
        p.name.toLowerCase().includes('photo') ||
        p.name.toLowerCase().includes('picture')
      );
      if (imageProperty?.value && typeof imageProperty.value === 'string' && imageProperty.value.startsWith('http')) {
        return imageProperty.value;
      }
    }
    return mainProduct?.images?.[0]?.src;
  };

  const imageUrl = getProductImage();

  // Calculate totals
  const subtotal = parseFloat(order.subtotal_price);
  const shipping = parseFloat(order.total_shipping_price_set?.shop_money?.amount || "0");
  const total = parseFloat(order.total_price);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Customer Info Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Customer Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-lg sm:rounded-xl border border-border p-2.5 sm:p-4"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-xs sm:text-sm">Customer</h3>
          </div>
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground truncate">{customerName}</span>
            </div>
            {order.customer?.email && (
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground truncate">{order.customer.email}</span>
              </div>
            )}
            {order.customer?.phone && (
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm hidden sm:flex">
                <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">{order.customer.phone}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Shipping Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-lg sm:rounded-xl border border-border p-2.5 sm:p-4"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-xs sm:text-sm">Ship To</h3>
          </div>
          <div className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-muted-foreground">
            {address ? (
              <>
                <p className="truncate">{address.city}</p>
                <p className="truncate hidden sm:block">{address.province} {address.zip}</p>
                <p className="font-medium text-foreground">{address.country}</p>
              </>
            ) : (
              <p>No address</p>
            )}
          </div>
        </motion.div>

        {/* Order Details Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-lg sm:rounded-xl border border-border p-2.5 sm:p-4"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-primary/10 flex items-center justify-center">
              <Hash className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-xs sm:text-sm">Details</h3>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <div>
              <p className="text-muted-foreground text-[10px] sm:text-xs">Order</p>
              <p className="font-medium">#{order.order_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] sm:text-xs">Date</p>
              <p className="font-medium">{date}</p>
            </div>
          </div>
        </motion.div>

        {/* Totals Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-lg sm:rounded-xl border border-border p-2.5 sm:p-4"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-xs sm:text-sm">Summary</h3>
          </div>
          <div className="space-y-1 sm:space-y-1.5 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">${subtotal.toFixed(0)}</span>
            </div>
            <div className="border-t border-border pt-1 sm:pt-1.5 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-mono font-bold text-primary">${total.toFixed(2)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Product Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-lg sm:rounded-xl border border-border overflow-hidden"
      >
        <div className="p-2.5 sm:p-4 border-b border-border flex items-center gap-1.5 sm:gap-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-xs sm:text-sm">Product</h3>
          <Badge variant="secondary" className="ml-auto text-[10px] sm:text-xs">
            {order.line_items.length} item{order.line_items.length > 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="p-2.5 sm:p-4">
          {mainItem && (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Product Image */}
              <div className="w-full sm:w-32 md:w-48 h-32 sm:h-28 md:h-36 flex-shrink-0 rounded-lg bg-muted/50 overflow-hidden">
                {imageUrl ? (
                  <img 
                    src={imageUrl} 
                    alt={mainItem.title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Package className="w-8 h-8 sm:w-12 sm:h-12" />
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="flex-1 space-y-2 sm:space-y-3">
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                    {mainItem.vendor || 'TWITTER'}
                  </p>
                  <h4 className="text-sm sm:text-lg font-semibold text-foreground leading-tight">
                    {mainItem.title}
                  </h4>
                  {mainItem.variant_title && (
                    <p className="text-xs sm:text-sm text-primary font-medium mt-0.5">
                      {mainItem.variant_title}
                    </p>
                  )}
                </div>

                {/* Custom Properties (Bike Size, Wheel, etc.) */}
                {mainItem.properties && mainItem.properties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {mainItem.properties.slice(0, 4).map((prop, idx) => (
                      <div key={idx} className="bg-muted/50 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">{prop.name}: </span>
                        <span className="text-[10px] sm:text-xs font-medium text-foreground">{prop.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="text-xs sm:text-sm">
                    <span className="text-muted-foreground">Qty:</span>
                    <span className="font-medium ml-1">{mainItem.quantity}</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-mono font-semibold ml-1 text-primary">
                      ${parseFloat(mainItem.price).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Addons / Additional Items */}
          {addons.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Included Items ({addons.length})
                </p>
              </div>
              <div className="grid gap-2">
                {addons.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        {products[item.product_id]?.images?.[0]?.src ? (
                          <img 
                            src={products[item.product_id].images[0].src} 
                            alt={item.title}
                            className="w-full h-full object-contain rounded"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.variant_title && (
                          <p className="text-xs text-muted-foreground">{item.variant_title}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-medium">${parseFloat(item.price).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
