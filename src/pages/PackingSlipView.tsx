import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Printer, ArrowLeft, Loader2, Package, Pencil, Save, X, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchOrder, fetchProduct, formatDate } from "@/lib/shopify";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ShopifyOrder, ShopifyProduct } from "@/types/shopify";

interface AddonOverride {
  title: string;
  variantTitle: string;
  quantity: number;
  imageUrl?: string;
}

interface SlipOverrides {
  orderLabel?: string;
  orderDate?: string;
  customerName?: string;
  billName?: string;
  shipAddress?: { address1?: string; address2?: string; city?: string; province?: string; zip?: string; country?: string };
  billAddress?: { address1?: string; address2?: string; city?: string; province?: string; zip?: string; country?: string };
  phone?: string;
  productTitle?: string;
  variantTitle?: string;
  quantity?: number;
  specs?: { name: string; value: string }[];
  addons?: AddonOverride[];
  shippingMethod?: string;
  orderNotes?: string;
  footerMessage?: string;
}

function isLoggedIn(): boolean {
  const token = localStorage.getItem("admin-auth-token");
  if (!token) return false;
  try {
    const decoded = JSON.parse(atob(token));
    return decoded.exp && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

export default function PackingSlipView() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<ShopifyOrder | null>(null);
  const [products, setProducts] = useState<Record<number, ShopifyProduct>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<SlipOverrides>({});
  const loggedIn = isLoggedIn();

  useEffect(() => {
    if (!orderNumber) return;
    loadOrder();
  }, [orderNumber]);

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      let wfData: any = null;
      const { data: wf1 } = await supabase
        .from("order_workflow")
        .select("id, order_id, packing_slip_data")
        .eq("order_number", orderNumber)
        .maybeSingle();
      wfData = wf1;
      if (!wfData) {
        const { data: wf2 } = await supabase
          .from("order_workflow")
          .select("id, order_id, packing_slip_data")
          .eq("order_number", `TB${orderNumber}`)
          .maybeSingle();
        wfData = wf2;
      }
      if (!wfData?.order_id) { setError("Order not found"); setLoading(false); return; }
      setWorkflowId(wfData.id);
      if (wfData.packing_slip_data) setOverrides(wfData.packing_slip_data as SlipOverrides);

      const shopifyOrder = await fetchOrder(wfData.order_id);
      setOrder(shopifyOrder);
      await loadProducts(shopifyOrder);
    } catch (err) {
      console.error(err);
      setError("Failed to load order data");
    }
    setLoading(false);
  };

  const loadProducts = async (o: ShopifyOrder) => {
    const map: Record<number, ShopifyProduct> = {};
    const ids = o.line_items.map(i => i.product_id).filter((id): id is number => id != null && id > 0);
    await Promise.all(ids.map(async (id) => { try { const p = await fetchProduct(id); if (p) map[id] = p; } catch {} }));
    setProducts(map);
  };

  const handlePrint = () => window.print();

  // Initialize overrides from Shopify data when entering edit mode
  const startEditing = () => {
    if (!order) return;
    const shipAddr = order.shipping_address || order.customer?.default_address;
    const billAddr = order.customer?.default_address || order.shipping_address;
    const sorted = [...order.line_items].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    const main = sorted[0];
    const addonsOrig = sorted.slice(1);

    const allProps = main?.properties
      ?.filter(p => !p.name.toLowerCase().includes('image') && !p.name.toLowerCase().includes('photo') && !p.name.startsWith('_'))
      .map(p => ({ name: p.name, value: p.value })) || [];

    const addonsData: AddonOverride[] = addonsOrig.map(item => ({
      title: item.title,
      variantTitle: item.variant_title || '',
      quantity: item.quantity,
      imageUrl: products[item.product_id]?.images?.[0]?.src || '',
    }));

    // Build billing name (may differ from shipping name)
    const shipName = order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Guest';
    const billCust = order.billing_address;
    const billName = billCust ? `${billCust.address1 ? shipName : shipName}` : shipName;

    setOverrides(prev => ({
      orderLabel: prev.orderLabel || (order.name?.replace('#', '') || String(order.order_number)),
      orderDate: prev.orderDate || formatDate(order.created_at),
      customerName: prev.customerName || shipName,
      billName: prev.billName || shipName,
      shipAddress: prev.shipAddress || {
        address1: shipAddr?.address1 || '', address2: shipAddr?.address2 || '',
        city: shipAddr?.city || '', province: shipAddr?.province || '', zip: shipAddr?.zip || '', country: shipAddr?.country || '',
      },
      billAddress: prev.billAddress || {
        address1: billAddr?.address1 || '', address2: billAddr?.address2 || '',
        city: billAddr?.city || '', province: billAddr?.province || '', zip: billAddr?.zip || '', country: billAddr?.country || '',
      },
      phone: prev.phone || order.customer?.phone || '',
      productTitle: prev.productTitle || main?.title || '',
      variantTitle: prev.variantTitle || main?.variant_title || '',
      quantity: prev.quantity || main?.quantity || 1,
      specs: prev.specs || allProps,
      addons: prev.addons || addonsData,
      shippingMethod: prev.shippingMethod || order.shipping_lines?.[0]?.title || '',
      orderNotes: prev.orderNotes || order.note || '',
      footerMessage: prev.footerMessage || 'Thank you for shopping with us!',
    }));
    setEditing(true);
  };

  const cancelEditing = () => { setEditing(false); loadOrder(); };

  const saveEdits = async () => {
    if (!workflowId) return;
    setSaving(true);
    const { error: err } = await supabase
      .from("order_workflow")
      .update({ packing_slip_data: overrides as any })
      .eq("id", workflowId);
    setSaving(false);
    if (err) { toast.error("Failed to save"); console.error(err); }
    else { toast.success("Packing slip saved! ✅"); setEditing(false); }
  };

  const set = (key: keyof SlipOverrides, value: any) => setOverrides(prev => ({ ...prev, [key]: value }));
  const setAddr = (type: 'shipAddress' | 'billAddress', field: string, val: string) =>
    setOverrides(prev => ({ ...prev, [type]: { ...(prev[type] || {}), [field]: val } }));
  const setSpec = (idx: number, field: 'name' | 'value', val: string) =>
    setOverrides(prev => { const s = [...(prev.specs || [])]; s[idx] = { ...s[idx], [field]: val }; return { ...prev, specs: s }; });
  const removeSpec = (idx: number) => setOverrides(prev => ({ ...prev, specs: (prev.specs || []).filter((_, i) => i !== idx) }));
  const addSpec = () => setOverrides(prev => ({ ...prev, specs: [...(prev.specs || []), { name: '', value: '' }] }));
  const setAddon = (idx: number, field: keyof AddonOverride, val: any) =>
    setOverrides(prev => { const a = [...(prev.addons || [])]; a[idx] = { ...a[idx], [field]: val }; return { ...prev, addons: a }; });
  const removeAddon = (idx: number) => setOverrides(prev => ({ ...prev, addons: (prev.addons || []).filter((_, i) => i !== idx) }));
  const addAddon = () => setOverrides(prev => ({ ...prev, addons: [...(prev.addons || []), { title: '', variantTitle: '', quantity: 1 }] }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <Package className="h-12 w-12 mx-auto text-gray-300" />
          <p className="text-gray-500">{error || "Order not found"}</p>
          <Link to="/workflow"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </div>
    );
  }

  // Resolve display values: overrides > Shopify
  const date = overrides.orderDate || formatDate(order.created_at);
  const label = overrides.orderLabel || order.name?.replace('#', '') || String(order.order_number);
  const origShip = order.shipping_address || order.customer?.default_address;
  const origBill = order.billing_address || order.customer?.default_address || order.shipping_address;
  const origName = order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : "Guest";

  const dName = overrides.customerName || origName;
  const dBillName = overrides.billName || origName;
  const dShip = overrides.shipAddress || origShip;
  const dBill = overrides.billAddress || origBill;
  const dPhone = overrides.phone || order.customer?.phone || '';

  const sorted = [...order.line_items].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  const mainItem = sorted[0];
  const origAddons = sorted.slice(1);
  const mainProduct = mainItem ? products[mainItem.product_id] : undefined;

  const getImage = () => {
    if (mainItem?.properties) {
      const ip = mainItem.properties.find(p => p.name.toLowerCase().includes("image") || p.name.toLowerCase().includes("photo"));
      if (ip?.value && typeof ip.value === "string" && ip.value.startsWith("http")) return ip.value;
    }
    return mainProduct?.images?.[0]?.src;
  };
  const imageUrl = getImage();

  const dTitle = overrides.productTitle || mainItem?.title || '';
  const dVariant = overrides.variantTitle || mainItem?.variant_title || '';
  const dQty = overrides.quantity || mainItem?.quantity || 1;
  const dShipping = overrides.shippingMethod || order.shipping_lines?.[0]?.title || '';
  const dNotes = overrides.orderNotes || order.note || '';
  const dFooter = overrides.footerMessage || 'Thank you for shopping with us!';

  const origSpecs = mainItem?.properties
    ?.filter(p => !p.name.toLowerCase().includes('image') && !p.name.toLowerCase().includes('photo') && !p.name.startsWith('_'))
    .map(p => ({ name: p.name, value: p.value })) || [];
  const dSpecs = overrides.specs || origSpecs;

  const dAddons: AddonOverride[] = overrides.addons || origAddons.map(item => ({
    title: item.title,
    variantTitle: item.variant_title || '',
    quantity: item.quantity,
    imageUrl: products[item.product_id]?.images?.[0]?.src || '',
  }));

  // Inline edit helper
  const E = ({ value, onChange, className = '', placeholder = '', bold = false }: {
    value: string; onChange: (v: string) => void; className?: string; placeholder?: string; bold?: boolean;
  }) => editing ? (
    <Input value={value} onChange={(e) => onChange(e.target.value)} className={`h-7 text-sm px-2 py-0 border-gray-300 ${bold ? 'font-bold' : ''} ${className}`} placeholder={placeholder} />
  ) : (
    <span className={`${bold ? 'font-bold' : ''} ${className}`}>{value}</span>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar (screen only) */}
      <div className="no-print bg-gray-50 border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/workflow"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Assembly Line</Button></Link>
          <span className="text-sm text-gray-300">|</span>
          <span className="text-sm font-medium text-gray-600">Packing Slip #{orderNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          {loggedIn && !editing && (
            <Button onClick={startEditing} variant="outline" size="sm" className="gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          {editing && (
            <>
              <Button onClick={cancelEditing} variant="ghost" size="sm" className="gap-2 text-gray-500"><X className="h-4 w-4" /> Cancel</Button>
              <Button onClick={saveEdits} disabled={saving} size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
              </Button>
            </>
          )}
          {!editing && (
            <Button onClick={handlePrint} className="gap-2 bg-gray-900 hover:bg-gray-800" size="sm">
              <Printer className="h-4 w-4" /> Print
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="no-print bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-700 font-medium">
          ✏️ Editing mode — ALL fields are editable. Click Save when done.
        </div>
      )}

      {/* ======= PACKING SLIP ======= */}
      <div className="slip-page max-w-[700px] mx-auto px-8 py-10 print:px-0 print:py-6 print:max-w-none font-['Georgia','Times_New_Roman',serif]">

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <h1 className="text-3xl font-bold text-black tracking-tight">Twitter Bikes</h1>
          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-1">
              <span className="text-base text-gray-700">Order #</span>
              <E value={label} onChange={(v) => set('orderLabel', v)} bold placeholder="Order #" />
            </div>
            <div>
              <E value={date} onChange={(v) => set('orderDate', v)} className="text-sm text-gray-500" placeholder="Date" />
            </div>
          </div>
        </div>

        {/* Ship To / Bill To */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          {/* Ship To */}
          <div>
            <h3 className="text-sm font-bold text-black mb-2">Ship to</h3>
            <div className="text-sm text-gray-700 leading-relaxed space-y-0.5">
              <div><E value={dName} onChange={(v) => set('customerName', v)} bold /></div>
              <div><E value={dShip?.address1 || ''} onChange={(v) => setAddr('shipAddress', 'address1', v)} placeholder="Address line 1" /></div>
              <div><E value={dShip?.address2 || ''} onChange={(v) => setAddr('shipAddress', 'address2', v)} placeholder="Address line 2" /></div>
              <div>
                {editing ? (
                  <div className="flex gap-1">
                    <Input value={dShip?.city || ''} onChange={(e) => setAddr('shipAddress', 'city', e.target.value)} className="h-7 text-sm px-2 py-0 flex-1" placeholder="City" />
                    <Input value={dShip?.province || ''} onChange={(e) => setAddr('shipAddress', 'province', e.target.value)} className="h-7 text-sm px-2 py-0 w-20" placeholder="State" />
                    <Input value={dShip?.zip || ''} onChange={(e) => setAddr('shipAddress', 'zip', e.target.value)} className="h-7 text-sm px-2 py-0 w-24" placeholder="ZIP" />
                  </div>
                ) : (
                  <span>{dShip?.city} {dShip?.province} {dShip?.zip}</span>
                )}
              </div>
              <div><E value={dShip?.country || ''} onChange={(v) => setAddr('shipAddress', 'country', v)} placeholder="Country" /></div>
              <div><E value={dPhone} onChange={(v) => set('phone', v)} placeholder="Phone" /></div>
            </div>
          </div>

          {/* Bill To */}
          <div>
            <h3 className="text-sm font-bold text-black mb-2">Bill to</h3>
            <div className="text-sm text-gray-700 leading-relaxed space-y-0.5">
              <div><E value={dBillName} onChange={(v) => set('billName', v)} bold /></div>
              <div><E value={dBill?.address1 || ''} onChange={(v) => setAddr('billAddress', 'address1', v)} placeholder="Address line 1" /></div>
              <div><E value={dBill?.address2 || ''} onChange={(v) => setAddr('billAddress', 'address2', v)} placeholder="Address line 2" /></div>
              <div>
                {editing ? (
                  <div className="flex gap-1">
                    <Input value={dBill?.city || ''} onChange={(e) => setAddr('billAddress', 'city', e.target.value)} className="h-7 text-sm px-2 py-0 flex-1" placeholder="City" />
                    <Input value={dBill?.province || ''} onChange={(e) => setAddr('billAddress', 'province', e.target.value)} className="h-7 text-sm px-2 py-0 w-20" placeholder="State" />
                    <Input value={dBill?.zip || ''} onChange={(e) => setAddr('billAddress', 'zip', e.target.value)} className="h-7 text-sm px-2 py-0 w-24" placeholder="ZIP" />
                  </div>
                ) : (
                  <span>{dBill?.city} {dBill?.province} {dBill?.zip}</span>
                )}
              </div>
              <div><E value={dBill?.country || ''} onChange={(v) => setAddr('billAddress', 'country', v)} placeholder="Country" /></div>
            </div>
          </div>
        </div>

        {/* Product / Quantity Header */}
        <div className="border-t-2 border-black pt-3 mb-4">
          <div className="flex justify-between text-sm font-bold text-black">
            <span>Product</span>
            <span>Quantity</span>
          </div>
        </div>
        <hr className="border-gray-300 mb-6" />

        {/* Order Notes */}
        {(dNotes || editing) && (
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order Notes</p>
            {editing ? (
              <textarea
                value={dNotes}
                onChange={(e) => set('orderNotes', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-3 py-2 min-h-[60px] resize-y font-['Georgia','Times_New_Roman',serif]"
                placeholder="Order notes and status history..."
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{dNotes}</p>
            )}
          </div>
        )}

        {/* Product Image */}
        {imageUrl && (
          <div className="flex justify-center mb-6">
            <img src={imageUrl} alt={mainItem?.title} className="max-h-[350px] max-w-full object-contain print:max-h-[280px]" />
          </div>
        )}

        {/* Product Title + Variant + Qty */}
        {mainItem && (
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 pr-8">
              {editing ? (
                <div className="space-y-1">
                  <Input value={dTitle} onChange={(e) => set('productTitle', e.target.value)} className="h-8 text-base font-bold px-2" placeholder="Product title" />
                  <Input value={dVariant} onChange={(e) => set('variantTitle', e.target.value)} className="h-7 text-sm px-2" placeholder="Variant (color / groupset / size)" />
                </div>
              ) : (
                <p className="text-base font-bold text-black leading-snug">
                  {dTitle}{dVariant ? ` - ${dVariant}` : ''}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              {editing ? (
                <Input type="number" value={dQty} onChange={(e) => set('quantity', parseInt(e.target.value) || 1)} className="h-8 w-16 text-center font-bold" />
              ) : (
                <span className="text-base font-bold text-black">{dQty}</span>
              )}
            </div>
          </div>
        )}

        {/* Specifications */}
        {(dSpecs.length > 0 || editing) && (
          <div className="mb-6 mt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Specifications</p>
            <div className="text-sm text-gray-700 space-y-1">
              {dSpecs.map((spec, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <Input value={spec.name} onChange={(e) => setSpec(idx, 'name', e.target.value)} className="h-7 text-sm px-2 w-40" placeholder="Spec name" />
                      <span className="text-gray-400">:</span>
                      <Input value={spec.value} onChange={(e) => setSpec(idx, 'value', e.target.value)} className="h-7 text-sm px-2 flex-1" placeholder="Spec value" />
                      <button onClick={() => removeSpec(idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                    </>
                  ) : (
                    <p><span className="font-semibold">{spec.name}:</span> {spec.value}</p>
                  )}
                </div>
              ))}
              {editing && (
                <button onClick={addSpec} className="text-blue-500 hover:text-blue-700 text-xs font-medium mt-1 flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add specification
                </button>
              )}
            </div>
          </div>
        )}

        {/* Addons / Additional Items */}
        {(dAddons.length > 0 || editing) && (
          <div className="mb-6">
            <hr className="border-gray-300 mb-4" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Additional Items</p>
            {dAddons.map((addon, idx) => (
              <div key={idx} className="flex justify-between items-start mb-3">
                {editing ? (
                  <div className="flex items-center gap-2 flex-1 pr-4">
                    <div className="flex-1 space-y-1">
                      <Input value={addon.title} onChange={(e) => setAddon(idx, 'title', e.target.value)} className="h-7 text-sm px-2 font-semibold" placeholder="Item title" />
                      <Input value={addon.variantTitle} onChange={(e) => setAddon(idx, 'variantTitle', e.target.value)} className="h-7 text-sm px-2" placeholder="Variant" />
                    </div>
                    <Input type="number" value={addon.quantity} onChange={(e) => setAddon(idx, 'quantity', parseInt(e.target.value) || 1)} className="h-7 w-14 text-center text-sm" />
                    <button onClick={() => removeAddon(idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 flex-1 pr-4">
                      {addon.imageUrl && <img src={addon.imageUrl} alt={addon.title} className="w-10 h-10 object-contain" />}
                      <div>
                        <p className="text-sm font-semibold text-black">{addon.title}</p>
                        {addon.variantTitle && <p className="text-xs text-gray-500">{addon.variantTitle}</p>}
                      </div>
                    </div>
                    <span className="text-sm text-black flex-shrink-0">{addon.quantity}</span>
                  </>
                )}
              </div>
            ))}
            {editing && (
              <button onClick={addAddon} className="text-blue-500 hover:text-blue-700 text-xs font-medium mt-1 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add item
              </button>
            )}
          </div>
        )}

        {/* Shipping Details */}
        <hr className="border-gray-300 mb-4" />
        <div className="mb-6">
          <h3 className="text-sm font-bold text-black mb-2">Shipping Details</h3>
          <div className="text-sm text-gray-700 flex items-center gap-1">
            <span className="font-semibold">Shipping Method: </span>
            <E value={dShipping} onChange={(v) => set('shippingMethod', v)} placeholder="e.g. DDP, Express, etc." />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-4 text-center">
          <div className="text-base text-gray-500 italic mb-6">
            <E value={dFooter} onChange={(v) => set('footerMessage', v)} className="text-base text-gray-500 italic" placeholder="Footer message" />
          </div>
          <hr className="border-gray-900 border-t-2 mb-4 mx-auto max-w-[300px]" />
          <p className="text-base font-bold text-black mb-1">Twitter Bikes</p>
          <p className="text-sm text-gray-600">info@twitterbikeusa.com</p>
          <p className="text-sm text-gray-600">twitterbikeusa.com</p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
          .slip-page { padding: 20px 40px !important; max-width: none !important; font-size: 12pt; }
        }
      `}</style>
    </div>
  );
}
