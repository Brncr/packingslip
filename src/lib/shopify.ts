import { supabase } from "@/integrations/supabase/client";
import type { ShopifyOrder, ShopifyProduct } from "@/types/shopify";

export async function fetchOrders(): Promise<ShopifyOrder[]> {
  const { data, error } = await supabase.functions.invoke('shopify-orders', {
    body: {},
  });

  if (error) {
    console.error('Error fetching orders:', error);
    throw new Error('Failed to fetch orders from Shopify');
  }

  return data.orders || [];
}

export async function fetchOrder(orderId: string): Promise<ShopifyOrder> {
  const { data, error } = await supabase.functions.invoke('shopify-orders', {
    body: {},
    headers: {},
  });

  // Use query params via the function URL
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-orders?action=get&order_id=${orderId}`,
    {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch order');
  }

  const result = await response.json();
  return result.order;
}

export async function fetchProduct(productId: number): Promise<ShopifyProduct | null> {
  if (!productId || productId <= 0) {
    console.warn('Invalid product ID:', productId);
    return null;
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-orders?action=product&order_id=${productId}`,
    {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    console.error('Failed to fetch product:', productId);
    return null;
  }

  const result = await response.json();
  return result.product || null;
}

// Fetch product metafields (including Avis app data)
export async function fetchProductMetafields(productId: number): Promise<Array<{ namespace: string; key: string; value: string }>> {
  if (!productId || productId <= 0) {
    return [];
  }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-orders?action=product_metafields&order_id=${productId}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch product metafields:', productId);
      return [];
    }

    const result = await response.json();
    return result.metafields || [];
  } catch (error) {
    console.error('Error fetching metafields:', error);
    return [];
  }
}

// Get image URL from line item properties (Avis app stores images here)
export function getImageFromProperties(properties: Array<{ name: string; value: string }> | undefined): string | null {
  if (!properties) return null;
  
  // Avis app may store image in various property names
  const imageProperty = properties.find(p => 
    p.name.toLowerCase().includes('image') ||
    p.name.toLowerCase().includes('foto') ||
    p.name.toLowerCase().includes('picture') ||
    p.name.toLowerCase().includes('_image') ||
    p.name.toLowerCase().includes('preview')
  );
  
  if (imageProperty?.value && (
    imageProperty.value.startsWith('http') || 
    imageProperty.value.startsWith('//')
  )) {
    return imageProperty.value;
  }
  
  return null;
}

// Get the correct product image based on variant_id
// Shopify associates images with specific variants - this ensures we get the right color
export function getImageForVariant(
  product: ShopifyProduct | null | undefined, 
  variantId: number
): string | null {
  if (!product?.images || product.images.length === 0) {
    return null;
  }
  
  // First, try to find an image specifically associated with this variant
  const variantImage = product.images.find(img => 
    img.variant_ids && img.variant_ids.includes(variantId)
  );
  
  if (variantImage) {
    console.log('Found variant-specific image:', variantImage.alt || variantImage.src);
    return variantImage.src;
  }
  
  // Fallback to first image (but log warning)
  console.warn('No variant-specific image found for variant:', variantId, '- using first image');
  return product.images[0]?.src || null;
}

// Fetch variant details to get inventory_item_id
export async function fetchVariant(variantId: number): Promise<{ id: number; inventory_item_id: number } | null> {
  if (!variantId || variantId <= 0) {
    return null;
  }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-orders?action=variant&order_id=${variantId}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      // Variant may have been deleted - silently return null
      console.warn('Variant not found (may have been deleted):', variantId);
      return null;
    }

    const result = await response.json();
    return result.variant || null;
  } catch (error) {
    console.warn('Error fetching variant (non-critical):', error);
    return null;
  }
}

// Fetch inventory item to get cost price
export async function fetchInventoryItemCost(inventoryItemId: number): Promise<string | null> {
  if (!inventoryItemId || inventoryItemId <= 0) {
    return null;
  }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-orders?action=inventory_item&order_id=${inventoryItemId}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch inventory item:', inventoryItemId);
      return null;
    }

    const result = await response.json();
    return result.inventory_item?.cost || null;
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    return null;
  }
}

// Get cost price for a variant (combines variant lookup + inventory item lookup)
export async function fetchCostPrice(variantId: number): Promise<number | null> {
  const variant = await fetchVariant(variantId);
  if (!variant?.inventory_item_id) {
    return null;
  }

  const cost = await fetchInventoryItemCost(variant.inventory_item_id);
  return cost ? parseFloat(cost) : null;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0].replace(/-/g, '/');
}

export function generateInvoiceNumber(orderNumber: number, date: string): string {
  const dateFormatted = date.replace(/\//g, '');
  return `FST${dateFormatted}`;
}

export function formatAddress(address: {
  address1: string;
  address2?: string | null;
  city: string;
  province: string;
  zip: string;
  country: string;
}): string {
  const parts = [
    address.address1,
    address.address2,
    `${address.city} ${address.province} ${address.zip}`,
    address.country,
  ].filter(Boolean);
  
  return parts.join('\n');
}
