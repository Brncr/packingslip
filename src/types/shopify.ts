export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  default_address?: ShopifyAddress;
}

export interface ShopifyAddress {
  company: string | null;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  zip: string;
  country: string;
}

export interface ShopifyLineItemProperty {
  name: string;
  value: string;
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string | null;
  variant_title: string | null;
  vendor: string;
  product_id: number;
  variant_id: number;
  properties: ShopifyLineItemProperty[];
}

export interface ShopifyShippingLine {
  id: number;
  title: string;
  price: string;
  code: string | null;
  source: string | null;
  delivery_category: string | null;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  subtotal_price: string;
  total_shipping_price_set: {
    shop_money: {
      amount: string;
    };
  };
  customer: ShopifyCustomer | null;
  shipping_address?: ShopifyAddress;
  billing_address?: ShopifyAddress;
  line_items: ShopifyLineItem[];
  shipping_lines: ShopifyShippingLine[];
  note: string | null;
  note_attributes: Array<{ name: string; value: string }>;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  images: Array<{
    id: number;
    src: string;
    alt: string | null;
    variant_ids?: number[];
  }>;
  variants: Array<{
    id: number;
    title: string;
    sku: string;
    price: string;
  }>;
}

export interface PackingSlipData {
  order: ShopifyOrder;
  products: Record<number, ShopifyProduct>;
  invoiceNumber: string;
  date: string;
}
