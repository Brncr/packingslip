import { useState, useEffect } from "react";
import { Pencil, X, Plus } from "lucide-react";
import type { ShopifyOrder, ShopifyProduct } from "@/types/shopify";
import { formatDate } from "@/lib/shopify";

interface PackingSlipProps {
  order: ShopifyOrder;
  products: Record<number, ShopifyProduct>;
}

interface EditableFieldProps {
  value: string;
  onChange: (val: string) => void;
  onDelete?: () => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}

function EditableField({ value, onChange, onDelete, multiline, className = "", placeholder }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (editing) {
    return (
      <div className="editable-field-wrap">
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { onChange(draft); setEditing(false); }}
            onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
            className={`editable-field editable-field--active ${className}`}
            placeholder={placeholder}
            rows={3}
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { onChange(draft); setEditing(false); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onChange(draft); setEditing(false); }
              if (e.key === 'Escape') { setDraft(value); setEditing(false); }
            }}
            className={`editable-field editable-field--active ${className}`}
            placeholder={placeholder}
          />
        )}
      </div>
    );
  }

  return (
    <span className="editable-field-wrap">
      <span
        onClick={() => setEditing(true)}
        className={`editable-field editable-field--display ${className} ${!value ? 'editable-field--empty' : ''}`}
        title="Click to edit"
      >
        {value || placeholder || '—'}
      </span>
      {onDelete && (
        <button onClick={onDelete} className="ps-delete-btn no-print" title="Remove">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

// Delete button for sections
function SectionDeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="ps-section-delete no-print" title="Remove this section">
      <X className="w-3.5 h-3.5" />
    </button>
  );
}

interface ItemEditState {
  title: string;
  quantity: string;
  imageUrl: string | null;
  properties: { name: string; value: string }[];
  visible: boolean;
}

export function PackingSlip({ order, products }: PackingSlipProps) {
  const date = formatDate(order.created_at);
  const shippingAddress = order.shipping_address || order.customer?.default_address;
  const billingAddress = order.billing_address || shippingAddress;

  const shipName = shippingAddress
    ? `${shippingAddress.first_name || order.customer?.first_name || ''} ${shippingAddress.last_name || order.customer?.last_name || ''}`.trim()
    : order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : '';

  const billName = billingAddress
    ? `${billingAddress.first_name || order.customer?.first_name || ''} ${billingAddress.last_name || order.customer?.last_name || ''}`.trim()
    : shipName;

  // ─── Section visibility ───
  const [sections, setSections] = useState({
    header: true,
    shipTo: true,
    billTo: true,
    notes: true,
    shipping: true,
  });

  const toggleSection = (s: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [s]: !prev[s] }));
  };

  // ─── Global editable state ───
  const [editState, setEditState] = useState({
    companyName: 'Twitter Bikes',
    shipName,
    shipAddress1: shippingAddress?.address1 || '',
    shipAddress2: shippingAddress?.address2 || '',
    shipCityLine: `${shippingAddress?.city || ''}${shippingAddress?.province ? ' ' + shippingAddress.province : ''} ${shippingAddress?.zip || ''}`.trim(),
    shipCountry: shippingAddress?.country || '',
    shipPhone: order.customer?.phone || '',
    billName,
    billAddress1: billingAddress?.address1 || '',
    billAddress2: billingAddress?.address2 || '',
    billCityLine: `${billingAddress?.city || ''}${billingAddress?.province ? ' ' + billingAddress.province : ''} ${billingAddress?.zip || ''}`.trim(),
    billCountry: billingAddress?.country || '',
    orderNote: order.note || '',
    shippingMethod: order.shipping_lines?.[0]?.title || '',
  });

  // ─── Per-item editable state ───
  const sortedItems = [...order.line_items].sort((a, b) =>
    parseFloat(b.price) - parseFloat(a.price)
  );

  const getItemImage = (item: typeof sortedItems[0]) => {
    // 1. Check line item properties first (apps like Avis store images here)
    if (item.properties) {
      const imgProp = item.properties.find(p =>
        p.name.toLowerCase().includes('image') ||
        p.name.toLowerCase().includes('photo') ||
        p.name.toLowerCase().includes('picture') ||
        p.name.toLowerCase().includes('preview') ||
        p.name.toLowerCase().includes('_image')
      );
      if (imgProp?.value && typeof imgProp.value === 'string' && 
          (imgProp.value.startsWith('http') || imgProp.value.startsWith('//'))) {
        return imgProp.value;
      }
    }

    const product = products[item.product_id];
    if (!product) return null;

    // 2. Try variant-specific image (matches exact color/size)
    if (item.variant_id && product.images?.length > 0) {
      const variantImage = product.images.find(img =>
        img.variant_ids && img.variant_ids.includes(item.variant_id)
      );
      if (variantImage) return variantImage.src;
    }

    // 3. Fallback to first product image
    return product.images?.[0]?.src || null;
  };

  const buildItemEdits = (): Record<number, ItemEditState> => {
    const map: Record<number, ItemEditState> = {};
    for (const item of sortedItems) {
      const fullTitle = item.variant_title
        ? `${item.title} - ${item.variant_title}`
        : item.title;
      const displayProps = (item.properties || []).filter(p =>
        !p.name.toLowerCase().includes('image') &&
        !p.name.toLowerCase().includes('photo') &&
        !p.name.toLowerCase().includes('picture')
      );
      map[item.id] = {
        title: fullTitle,
        quantity: String(item.quantity),
        imageUrl: getItemImage(item),
        properties: displayProps.map(p => ({ name: p.name, value: p.value })),
        visible: true,
      };
    }
    return map;
  };

  const [itemEdits, setItemEdits] = useState<Record<number, ItemEditState>>(buildItemEdits);

  // Reset when order changes
  useEffect(() => {
    const sa = order.shipping_address || order.customer?.default_address;
    const ba = order.billing_address || sa;
    const sn = sa ? `${sa.first_name || order.customer?.first_name || ''} ${sa.last_name || order.customer?.last_name || ''}`.trim()
      : order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : '';
    const bn = ba ? `${ba.first_name || order.customer?.first_name || ''} ${ba.last_name || order.customer?.last_name || ''}`.trim() : sn;

    setEditState({
      companyName: 'Twitter Bikes',
      shipName: sn,
      shipAddress1: sa?.address1 || '',
      shipAddress2: sa?.address2 || '',
      shipCityLine: `${sa?.city || ''}${sa?.province ? ' ' + sa.province : ''} ${sa?.zip || ''}`.trim(),
      shipCountry: sa?.country || '',
      shipPhone: order.customer?.phone || '',
      billName: bn,
      billAddress1: ba?.address1 || '',
      billAddress2: ba?.address2 || '',
      billCityLine: `${ba?.city || ''}${ba?.province ? ' ' + ba.province : ''} ${ba?.zip || ''}`.trim(),
      billCountry: ba?.country || '',
      orderNote: order.note || '',
      shippingMethod: order.shipping_lines?.[0]?.title || '',
    });
    setItemEdits(buildItemEdits());
    setSections({ header: true, shipTo: true, billTo: true, notes: true, shipping: true });
  }, [order.id]);

  const updateField = (field: keyof typeof editState, value: string) => {
    setEditState(prev => ({ ...prev, [field]: value }));
  };

  const clearField = (field: keyof typeof editState) => {
    setEditState(prev => ({ ...prev, [field]: '' }));
  };

  const updateItem = (itemId: number, field: keyof ItemEditState, value: string | boolean) => {
    setItemEdits(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const deleteItem = (itemId: number) => {
    setItemEdits(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], visible: false },
    }));
  };

  const deleteItemProp = (itemId: number, propIdx: number) => {
    setItemEdits(prev => {
      const item = { ...prev[itemId] };
      const props = [...item.properties];
      props.splice(propIdx, 1);
      return { ...prev, [itemId]: { ...item, properties: props } };
    });
  };

  const updateItemProp = (itemId: number, propIdx: number, value: string) => {
    setItemEdits(prev => {
      const item = { ...prev[itemId] };
      const props = [...item.properties];
      props[propIdx] = { ...props[propIdx], value };
      return { ...prev, [itemId]: { ...item, properties: props } };
    });
  };

  const deleteItemImage = (itemId: number) => {
    setItemEdits(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], imageUrl: null },
    }));
  };

  // Count visible items
  const visibleItems = sortedItems.filter(item => itemEdits[item.id]?.visible);

  // Deleted sections tracker for restore
  const deletedSections = Object.entries(sections).filter(([, v]) => !v);
  const deletedItems = sortedItems.filter(item => !itemEdits[item.id]?.visible);

  return (
    <div className="packing-slip-container" id="packing-slip">
      {/* Edit hint */}
      <div className="ps-edit-hint no-print">
        <Pencil className="w-3.5 h-3.5" />
        <span>Click to edit any field · <strong>✕</strong> to delete sections</span>
      </div>

      {/* ─── HEADER ─── */}
      {sections.header && (
        <div className="ps-header ps-section">
          <SectionDeleteBtn onClick={() => toggleSection('header')} />
          <div>
            <h1 className="ps-company">
              <EditableField value={editState.companyName} onChange={v => updateField('companyName', v)} className="ps-company-edit" placeholder="Company Name" />
            </h1>
          </div>
          <div className="ps-header-right">
            <div className="ps-order-number">Order #TB-{order.order_number}</div>
            <div className="ps-date">{date}</div>
          </div>
        </div>
      )}

      {/* ─── ADDRESSES ─── */}
      <div className="ps-addresses">
        {sections.shipTo && (
          <div className="ps-address-block ps-section">
            <SectionDeleteBtn onClick={() => toggleSection('shipTo')} />
            <h3 className="ps-address-title">Ship to</h3>
            <div className="ps-address-lines">
              <EditableField value={editState.shipName} onChange={v => updateField('shipName', v)} onDelete={() => clearField('shipName')} className="ps-address-name" placeholder="Customer name" />
              <EditableField value={editState.shipAddress1} onChange={v => updateField('shipAddress1', v)} onDelete={() => clearField('shipAddress1')} placeholder="Street address" />
              <EditableField value={editState.shipAddress2} onChange={v => updateField('shipAddress2', v)} onDelete={() => clearField('shipAddress2')} placeholder="Apt, suite, etc." />
              <EditableField value={editState.shipCityLine} onChange={v => updateField('shipCityLine', v)} onDelete={() => clearField('shipCityLine')} placeholder="City, State ZIP" />
              <EditableField value={editState.shipCountry} onChange={v => updateField('shipCountry', v)} onDelete={() => clearField('shipCountry')} placeholder="Country" />
              <EditableField value={editState.shipPhone} onChange={v => updateField('shipPhone', v)} onDelete={() => clearField('shipPhone')} placeholder="Phone number" />
            </div>
          </div>
        )}

        {sections.billTo && (
          <div className="ps-address-block ps-section">
            <SectionDeleteBtn onClick={() => toggleSection('billTo')} />
            <h3 className="ps-address-title">Bill to</h3>
            <div className="ps-address-lines">
              <EditableField value={editState.billName} onChange={v => updateField('billName', v)} onDelete={() => clearField('billName')} className="ps-address-name" placeholder="Customer name" />
              <EditableField value={editState.billAddress1} onChange={v => updateField('billAddress1', v)} onDelete={() => clearField('billAddress1')} placeholder="Street address" />
              <EditableField value={editState.billAddress2} onChange={v => updateField('billAddress2', v)} onDelete={() => clearField('billAddress2')} placeholder="Apt, suite, etc." />
              <EditableField value={editState.billCityLine} onChange={v => updateField('billCityLine', v)} onDelete={() => clearField('billCityLine')} placeholder="City, State ZIP" />
              <EditableField value={editState.billCountry} onChange={v => updateField('billCountry', v)} onDelete={() => clearField('billCountry')} placeholder="Country" />
            </div>
          </div>
        )}
      </div>

      {/* ─── PRODUCT TABLE HEADER ─── */}
      <div className="ps-product-header">
        <span>Product</span>
        <span>Quantity</span>
      </div>

      {/* ─── ORDER NOTES ─── */}
      {sections.notes && (
        <div className="ps-notes ps-section">
          <SectionDeleteBtn onClick={() => toggleSection('notes')} />
          <span className="ps-notes-label">Order Notes:</span>
          <EditableField
            value={editState.orderNote}
            onChange={v => updateField('orderNote', v)}
            multiline
            className="ps-notes-content"
            placeholder="Add order notes here..."
          />
        </div>
      )}

      {/* ─── PRODUCT ITEMS ─── */}
      {sortedItems.map((item) => {
        const ie = itemEdits[item.id];
        if (!ie || !ie.visible) return null;

        return (
          <div key={item.id} className="ps-product-item ps-section">
            <SectionDeleteBtn onClick={() => deleteItem(item.id)} />

            {/* Quantity - editable */}
            <div className="ps-product-qty">
              <EditableField
                value={ie.quantity}
                onChange={v => updateItem(item.id, 'quantity', v)}
                placeholder="Qty"
              />
            </div>

            {/* Product Image - with delete */}
            {ie.imageUrl && (
              <div className="ps-product-image-wrap ps-section">
                <button onClick={() => deleteItemImage(item.id)} className="ps-image-delete no-print" title="Remove image">
                  <X className="w-4 h-4" />
                </button>
                <img src={ie.imageUrl} alt={ie.title} className="ps-product-image" />
              </div>
            )}

            {/* Product Title - editable */}
            <div className="ps-product-title">
              <EditableField
                value={ie.title}
                onChange={v => updateItem(item.id, 'title', v)}
                placeholder="Product name"
              />
            </div>

            {/* Custom Properties - each deletable */}
            {ie.properties.length > 0 && (
              <div className="ps-product-props">
                {ie.properties.map((prop, idx) => (
                  <div key={idx} className="ps-product-prop">
                    <span className="ps-product-prop-name">{prop.name}:</span>{' '}
                    <EditableField
                      value={prop.value}
                      onChange={v => updateItemProp(item.id, idx, v)}
                      onDelete={() => deleteItemProp(item.id, idx)}
                      placeholder={`${prop.name} value`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ─── SHIPPING DETAILS ─── */}
      {sections.shipping && (
        <div className="ps-shipping ps-section">
          <SectionDeleteBtn onClick={() => toggleSection('shipping')} />
          <h3 className="ps-shipping-title">Shipping Details</h3>
          <div className="ps-shipping-content">
            <span className="ps-shipping-label">Shipping Method:</span>{' '}
            <EditableField
              value={editState.shippingMethod}
              onChange={v => updateField('shippingMethod', v)}
              placeholder="Shipping method"
            />
          </div>
        </div>
      )}

      {/* ─── RESTORE DELETED ─── */}
      {(deletedSections.length > 0 || deletedItems.length > 0) && (
        <div className="ps-restore no-print">
          <span className="ps-restore-label">Removed:</span>
          {deletedSections.map(([key]) => (
            <button key={key} onClick={() => toggleSection(key as keyof typeof sections)} className="ps-restore-btn">
              <Plus className="w-3 h-3" /> {key === 'shipTo' ? 'Ship To' : key === 'billTo' ? 'Bill To' : key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
          {deletedItems.map(item => (
            <button key={item.id} onClick={() => updateItem(item.id, 'visible', true)} className="ps-restore-btn">
              <Plus className="w-3 h-3" /> {item.title.substring(0, 30)}...
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
