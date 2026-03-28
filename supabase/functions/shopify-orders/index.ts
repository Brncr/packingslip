import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyOrder {
  id: number;
  order_number: number;
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
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    default_address?: {
      company: string | null;
      address1: string;
      address2: string | null;
      city: string;
      province: string;
      zip: string;
      country: string;
    };
  } | null;
  shipping_address?: {
    company: string | null;
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku: string | null;
    variant_title: string | null;
    vendor: string;
    product_id: number;
    variant_id: number;
    properties: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');

    if (!shopifyToken || !shopDomain) {
      throw new Error('Shopify credentials not configured');
    }

    const url = new URL(req.url);
    const orderId = url.searchParams.get('order_id');
    const action = url.searchParams.get('action') || 'list';

    let endpoint: string;
    
    if (action === 'get' && orderId) {
      endpoint = `https://${shopDomain}/admin/api/2024-10/orders/${orderId}.json`;
    } else if (action === 'product' && orderId) {
      // Get product details including images and metafields
      endpoint = `https://${shopDomain}/admin/api/2024-10/products/${orderId}.json`;
    } else if (action === 'product_metafields' && orderId) {
      // Get product metafields (including Avis app data)
      endpoint = `https://${shopDomain}/admin/api/2024-10/products/${orderId}/metafields.json`;
    } else if (action === 'variant_image' && orderId) {
      // Get variant details including image
      endpoint = `https://${shopDomain}/admin/api/2024-10/variants/${orderId}.json`;
    } else if (action === 'variant' && orderId) {
      // Get variant details including inventory_item_id
      endpoint = `https://${shopDomain}/admin/api/2024-10/variants/${orderId}.json`;
    } else if (action === 'inventory_item' && orderId) {
      // Get inventory item with cost price
      endpoint = `https://${shopDomain}/admin/api/2024-10/inventory_items/${orderId}.json`;
    } else {
      // List orders - get recent orders with all fields needed for packing slip
      endpoint = `https://${shopDomain}/admin/api/2024-10/orders.json?status=any&limit=50`;
    }

    const response = await fetch(endpoint, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', errorText);
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
