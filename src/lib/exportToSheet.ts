import { writeSheet, copySpreadsheet, addSheetTab } from "./googleSheets";
import { supabase } from "@/integrations/supabase/client";
import type { ShopifyOrder, ShopifyProduct } from "@/types/shopify";
import { formatAddress, formatDate, generateInvoiceNumber, getImageFromProperties, getImageForVariant, fetchCostPrice } from "./shopify";

// ID fixo da planilha template
const TEMPLATE_SPREADSHEET_ID = "1TFw2nGxxWc06JrDzI9DqQp4VEkG5LXLquQ2mebOhVDo";
const SHEET_NAME = "INVOICE (2)";

// Mapeamento baseado na estrutura real da planilha:
// Row 6: Buyer's COMPANY (A6) | DATE (E6, F6 = valor)
// Row 7: Buyer's ADDRESS (A7, B7 = valor) | P/I No. (E7, F7 = valor)
// Row 8: Buyer's CONTACT (A8, B8 = valor) | One touch No. (E8, F8 = valor)
// Row 9: Buyer's TEL (A9, B9 = valor) | SHIP TO (E9, F9 = valor)
// Row 10: Buyer's EMAIL (A10, B10 = valor) | FROM (E10, F10 = valor)
// Row 11: Header - PART NO. | Picture | DESCRIPTION | QTY | Unit Price($) | AMOUNT($)
// Row 12+: Product rows
// Row 13: EXW row | Shipping cost
// Row 14: Total Amount row
// Row 15: 1.TERMS
// Row 19: 5.DELIVERY

const CELL_MAPPING = {
  // Header info
  date: "F6",               // DATE
  invoiceNo: "F7",          // P/I No.
  buyerCompany: "B6",       // Buyer's COMPANY
  buyerAddress: "B7",       // Buyer's ADDRESS
  buyerContact: "B8",       // Buyer's CONTACT
  buyerTel: "B9",           // Buyer's TEL
  buyerEmail: "B10",        // Buyer's EMAIL
  shipTo: "F9",             // SHIP TO (país)
  
  // Product table starts at row 12
  productStartRow: 12,
  columns: {
    partNo: "A",            // PART NO.
    picture: "B",           // Picture
    description: "C",       // DESCRIPTION
    qty: "D",               // QTY
    unitPrice: "E",         // Unit Price($)
    amount: "F",            // AMOUNT($)
  },
  
  // EXW and Totals (rows after products)
  shippingCostRow: 13,      // EXW row
  totalAmountRow: 14,       // Total Amount row
  
  // Terms
  shippingTo: "B18",        // 4.SHIPPING
  delivery: "B19",          // 5.DELIVERY
};

interface ExportData {
  order: ShopifyOrder;
  products: Record<number, ShopifyProduct>;
}

interface ExportResult {
  success: boolean;
  spreadsheetUrl: string;
  spreadsheetId?: string;
  fileName?: string;
  error?: string;
}

// Format customer name for file name (remove special chars, replace spaces with underscore)
function formatCustomerNameForFile(firstName?: string, lastName?: string): string {
  const name = `${firstName || ''} ${lastName || ''}`.trim() || 'Customer';
  return name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
}

// Build bike description for the new sheet tab
// Convert HTML to plain text
function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Specification fields to extract from description
const SPEC_FIELDS = [
  'Bike Model',
  'ConfRev',
  'Wheel Size',
  'Frame Height',
  'Bike Color',
  'Net Weight',
  'Frame',
  'Handelbar Sets',
  'Seat Post',
  'Clamps',
  'Fork',
  'Head Sets',
  'Washer',
  'Derailleur Handle',
  'Front Derailleur',
  'Rear Derailleur',
  'Cranksets',
  'Cassettes',
  'Chain',
  'BB',
  'Brake',
  'Hubs',
  'Rim',
  'Spoke',
  'Tyre',
  'Belt',
  'Saddle',
  'Pedals',
  'Cables',
  'Accessories',
];

// Parse description HTML to extract specifications
// When multiple variants exist, extract specs only from the selected variant section

// Field name aliases - maps our field names to possible variations in Shopify body_html
const FIELD_ALIASES: Record<string, string[]> = {
  'Wheel Size': ['Wheel Size', 'Wheel Sizes'],
  'Frame Height': ['Frame Height', 'Frame Heights', 'Frame Size'],
  'Bike Color': ['Bike Color', 'Bike Colors', 'Color', 'Colors'],
  'Net Weight': ['Net Weight', 'Weight'],
  'Frame': ['Frame'],
  'Handelbar Sets': ['Handlebar Set', 'Handlebar Sets', 'Handelbar Set', 'Handelbar Sets', 'Handlebars'],
  'Seat Post': ['Seat Post', 'Seatpost'],
  'Clamps': ['Clamp', 'Clamps'],
  'Fork': ['Fork'],
  'Head Sets': ['Head Set', 'Head Sets', 'Headset', 'Headsets'],
  'Washer': ['Washer'],
  'Derailleur Handle': ['Derailleur Handle', 'Shifter', 'Shifters'],
  'Front Derailleur': ['Front Derailleur'],
  'Rear Derailleur': ['Rear Derailleur'],
  'Cranksets': ['Crankset', 'Cranksets', 'Crank'],
  'Cassettes': ['Cassette', 'Cassettes'],
  'Chain': ['Chain'],
  'BB': ['BB', 'Bottom Bracket', 'Bottom Brackets'],
  'Brake': ['Brake', 'Brakes'],
  'Hubs': ['Hub', 'Hubs'],
  'Rim': ['Rim', 'Rims'],
  'Spoke': ['Spoke', 'Spokes'],
  'Tyre': ['Tyre', 'Tyres', 'Tire', 'Tires'],
  'Belt': ['Belt'],
  'Saddle': ['Saddle'],
  'Pedals': ['Pedal', 'Pedals'],
  'Cables': ['Cable', 'Cables'],
  'Accessories': ['Accessories', 'Accessory', 'Included Accessories'],
};

// Extract a field value using all its aliases
function extractFieldValue(text: string, fieldName: string): string | null {
  const aliases = FIELD_ALIASES[fieldName] || [fieldName];
  
  for (const alias of aliases) {
    // Escape special regex characters in the alias
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`${escapedAlias}\\s*[:：]\\s*([^\\n]+)`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  
  return null;
}

function parseSpecifications(
  bodyHtml: string, 
  itemProperties?: Array<{name: string; value: string}>,
  variantTitle?: string | null
): Record<string, string> {
  const specs: Record<string, string> = {};
  const fullText = htmlToText(bodyHtml);
  
  // Check if there's a Drivetrain Options section with variants
  const hasDrivetrainVariants = /Drivetrain Options/i.test(fullText) && 
    /Variant \d+\s*[–\-]/i.test(fullText);
  
  // Extract general specs (non-drivetrain) from the full text
  const generalSpecs = ['Wheel Size', 'Frame Height', 'Bike Color', 'Net Weight', 
    'Frame', 'Handelbar Sets', 'Seat Post', 'Clamps', 'Fork', 'Head Sets', 'Washer',
    'Hubs', 'Rim', 'Spoke', 'Tyre', 'Belt', 'Saddle', 'Pedals', 'Cables', 'Accessories'];
  
  for (const field of generalSpecs) {
    const value = extractFieldValue(fullText, field);
    if (value) {
      specs[field] = value;
    }
  }
  
  // Handle drivetrain specs - extract from correct variant section
  const drivetrainSpecs = ['Derailleur Handle', 'Front Derailleur', 'Rear Derailleur', 
    'Cranksets', 'Cassettes', 'Chain', 'BB', 'Brake'];
  
  if (hasDrivetrainVariants && variantTitle) {
    console.log('Looking for drivetrain specs matching variant:', variantTitle);
    
    // Find the correct variant section based on variant_title
    const variantSection = findVariantSection(fullText, variantTitle);
    
    if (variantSection) {
      console.log('Found variant section, extracting drivetrain specs');
      
      // Extract drivetrain specs from the variant section
      for (const field of drivetrainSpecs) {
        const value = extractFieldValue(variantSection, field);
        if (value) {
          specs[field] = value;
        }
      }
    } else {
      console.log('Could not find matching variant section, skipping drivetrain specs');
    }
  } else {
    // No variants - extract drivetrain from full text
    for (const field of drivetrainSpecs) {
      const value = extractFieldValue(fullText, field);
      if (value) {
        specs[field] = value;
      }
    }
  }
  
  // Override with item properties if available (from Avis app, etc.)
  if (itemProperties) {
    for (const prop of itemProperties) {
      const propName = prop.name.toLowerCase();
      
      if (propName.includes('size') && !propName.includes('wheel')) {
        specs['Frame Height'] = prop.value;
      } else if (propName.includes('wheel')) {
        specs['Wheel Size'] = prop.value;
      } else if (propName.includes('color') || propName.includes('cor')) {
        specs['Bike Color'] = prop.value;
      }
    }
  }
  
  return specs;
}

// Find the variant section that matches the selected variant title
function findVariantSection(fullText: string, variantTitle: string): string | null {
  // Split into lines for easier processing
  const lines = fullText.split('\n');
  
  // Extract key identifying words from variant title (brand names, speeds, etc)
  const variantLower = variantTitle.toLowerCase();
  
  // Key identifiers to match
  const keyIdentifiers = extractKeyIdentifiers(variantLower);
  console.log('Key identifiers from variant title:', keyIdentifiers);
  
  // Find variant headers like "Variant 1 – WheelTop EDS..."
  const variantHeaderRegex = /Variant\s*\d+\s*[–\-]\s*(.+)/i;
  
  let bestMatchSection: string[] | null = null;
  let bestMatchScore = 0;
  let currentSection: string[] = [];
  let inVariantSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(variantHeaderRegex);
    
    if (headerMatch) {
      // Save previous section if it was a good match
      if (inVariantSection && currentSection.length > 0) {
        const sectionText = currentSection.join('\n').toLowerCase();
        const score = calculateMatchScore(sectionText, keyIdentifiers);
        
        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestMatchSection = [...currentSection];
        }
      }
      
      // Start new section
      currentSection = [line];
      inVariantSection = true;
      
      // Check if this header directly matches
      const headerText = headerMatch[1].toLowerCase();
      const headerScore = calculateMatchScore(headerText, keyIdentifiers);
      
      if (headerScore >= keyIdentifiers.length * 0.6) {
        // Good match in header alone
        console.log('Found matching variant header:', line);
      }
    } else if (inVariantSection) {
      // Check if we hit a new major section (not variant)
      if (/^(Wheelset|Braking System|Additional|Included|Frame & Structure)/i.test(line.trim())) {
        // End of variant sections
        const sectionText = currentSection.join('\n').toLowerCase();
        const score = calculateMatchScore(sectionText, keyIdentifiers);
        
        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestMatchSection = [...currentSection];
        }
        inVariantSection = false;
      } else {
        currentSection.push(line);
      }
    }
  }
  
  // Check final section
  if (inVariantSection && currentSection.length > 0) {
    const sectionText = currentSection.join('\n').toLowerCase();
    const score = calculateMatchScore(sectionText, keyIdentifiers);
    
    if (score > bestMatchScore) {
      bestMatchSection = [...currentSection];
    }
  }
  
  if (bestMatchSection) {
    return bestMatchSection.join('\n');
  }
  
  return null;
}

// Extract key identifying terms from variant title
function extractKeyIdentifiers(variantTitle: string): string[] {
  const identifiers: string[] = [];
  
  // Brand/component identifiers
  const brandPatterns = [
    /wheeltop/i, /eds/i, /ltwoo/i, /shimano/i, /105/i, /ultegra/i,
    /sensah/i, /sram/i, /r7\d+/i, /hrd\d+/i, /a12/i, /ox/i
  ];
  
  for (const pattern of brandPatterns) {
    const match = variantTitle.match(pattern);
    if (match) {
      identifiers.push(match[0].toLowerCase());
    }
  }
  
  // Speed patterns (1x13, 2x12, etc)
  const speedMatch = variantTitle.match(/(\d+)[x×](\d+)/i);
  if (speedMatch) {
    identifiers.push(`${speedMatch[1]}×${speedMatch[2]}`);
    identifiers.push(`${speedMatch[2]}-speed`);
  }
  
  // Wireless indicator
  if (/wireless/i.test(variantTitle)) {
    identifiers.push('wireless');
  }
  
  // Hydraulic indicator  
  if (/hydraulic/i.test(variantTitle)) {
    identifiers.push('hydraulic');
  }
  
  return identifiers;
}

// Calculate how well a section matches the identifiers
function calculateMatchScore(sectionText: string, identifiers: string[]): number {
  let score = 0;
  
  for (const id of identifiers) {
    if (sectionText.includes(id.toLowerCase())) {
      score += 1;
    }
  }
  
  return score;
}

function buildBikeDescription(order: ShopifyOrder, products: Record<number, ShopifyProduct>): string[][] {
  const rows: string[][] = [];

  // Find the main product (bike) - the most expensive item
  const sortedItems = [...order.line_items].sort((a, b) => 
    parseFloat(b.price) - parseFloat(a.price)
  );
  
  const mainItem = sortedItems[0];
  if (!mainItem) return rows;
  
  const product = products[mainItem.product_id];
  
  // Parse specifications from product description - pass variant_title to match correct section
  const specs = product?.body_html 
    ? parseSpecifications(product.body_html, mainItem.properties, mainItem.variant_title)
    : {};
  
  // Set Bike Model from item title
  specs['Bike Model'] = mainItem.title;
  
  // Add variant info to ConfRev if available
  if (mainItem.variant_title && !specs['ConfRev']) {
    specs['ConfRev'] = mainItem.variant_title;
  }
  
  // Build specification rows in the exact order specified - ONLY for the main bike
  for (const field of SPEC_FIELDS) {
    rows.push([field, specs[field] || '']);
  }

  return rows;
}

export async function exportPackingSlipToSheet({ order, products }: ExportData): Promise<ExportResult> {
  try {
    const address = order.shipping_address || order.customer?.default_address;
    const date = formatDate(order.created_at);
    const invoiceNumber = generateInvoiceNumber(order.order_number, date);
    const customerName = order.customer 
      ? `TB${order.order_number}-${order.customer.first_name} ${order.customer.last_name}`
      : `TB${order.order_number}`;
    
    // Generate file name: PI-TB1408-Javier_buitrago
    const customerNameForFile = formatCustomerNameForFile(order.customer?.first_name, order.customer?.last_name);
    const fileName = `PI-TB${order.order_number}-${customerNameForFile}`;
    
    // Step 1: Copy the template spreadsheet with the new name
    const copyResult = await copySpreadsheet(TEMPLATE_SPREADSHEET_ID, fileName);
    const newSpreadsheetId = copyResult.id;
    
    // Extract delivery time from shipping title
    const shippingTitle = order.shipping_lines?.[0]?.title;
    const deliveryMatch = shippingTitle?.match(/\((\d+-\d+\s*days?)\)/i);
    const deliveryTime = deliveryMatch ? deliveryMatch[1] : shippingTitle || "7-10 days";
    
    // Build all writes in batch for better performance
    const writes: Array<{ range: string; values: string[][] }> = [];
    
    // Header info
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.date}`, values: [[date]] });
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.invoiceNo}`, values: [[invoiceNumber]] });
    
    // Buyer info
    const buyerAddress = address ? formatAddress(address) : '-';
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.buyerCompany}`, values: [[address?.company || '-']] });
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.buyerAddress}`, values: [[buyerAddress]] });
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.buyerContact}`, values: [[customerName]] });
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.buyerTel}`, values: [[order.customer?.phone || '-']] });
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.buyerEmail}`, values: [[order.customer?.email || '-']] });
    
    // Ship to
    const shipTo = address?.country || 'United States';
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.shipTo}`, values: [[shipTo]] });
    
    // Terms
    const customerFirstName = order.customer?.first_name || address?.city || 'Customer';
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.shippingTo}`, values: [[`Shipping cost from Shenzhen to ${customerFirstName}`]] });
    writes.push({ range: `${SHEET_NAME}!${CELL_MAPPING.delivery}`, values: [[`${deliveryTime} After delivery`]] });
    
    // Process line items - identify main product (bike) and addons
    let totalAmount = 0;
    const shippingCost = 10; // Fixed shipping cost
    
    // Identify main product: the most expensive item or the one containing "bike"
    const sortedItems = [...order.line_items].sort((a, b) => 
      parseFloat(b.price) - parseFloat(a.price)
    );
    
    // Main product is the most expensive one (typically the bike)
    const mainProduct = sortedItems[0];
    const addonProducts = sortedItems.slice(1); // All other items are addons
    
    // Calculate total cost including all items
    let combinedUnitPrice = 0;
    let combinedQuantity = mainProduct?.quantity || 1;
    
    // Get main product cost
    if (mainProduct) {
      const mainCost = await fetchCostPrice(mainProduct.variant_id);
      combinedUnitPrice += (mainCost || parseFloat(mainProduct.price)) * mainProduct.quantity;
    }
    
    // Add all addon costs to the combined price
    for (const addon of addonProducts) {
      const addonCost = await fetchCostPrice(addon.variant_id);
      const addonPrice = addonCost || parseFloat(addon.price);
      combinedUnitPrice += addonPrice * addon.quantity;
    }
    
    totalAmount = combinedUnitPrice;
    
    // Only create ONE row for all items combined
    if (mainProduct) {
      const product = products[mainProduct.product_id];
      const row = CELL_MAPPING.productStartRow;
      
      // Build product name with bike size and model
      const bikeSize = mainProduct.properties?.find(p => 
        p.name.toLowerCase().includes('bike size') || p.name.toLowerCase().includes('size')
      )?.value;
      const wheelType = mainProduct.properties?.find(p => 
        p.name.toLowerCase().includes('wheel')
      )?.value;
      
      // PART NO. = nome da bike e modelo
      const partNo = [
        mainProduct.title,
        mainProduct.variant_title,
      ].filter(Boolean).join(' - ');
      
      // DESCRIPTION - consolidate ALL addons into the main product description
      const addonLines = addonProducts.map(addon => {
        const addonName = addon.title;
        const addonVariant = addon.variant_title ? ` (${addon.variant_title})` : '';
        const qty = addon.quantity > 1 ? ` x${addon.quantity}` : '';
        return `• ${addonName}${addonVariant}${qty}`;
      });
      
      const descriptionParts = [
        `Brand: ${mainProduct.vendor || 'TWITTER'}`,
        mainProduct.variant_title ? `Config: ${mainProduct.variant_title}` : null,
        bikeSize ? `Bike Size: ${bikeSize}` : null,
        wheelType ? `Wheel: ${wheelType}` : null,
        addonLines.length > 0 ? `\nIncluded Items:\n${addonLines.join('\n')}` : null,
      ].filter(Boolean);
      const description = descriptionParts.join('\n');
      
      // Get image URL - priority: 1. Avis properties, 2. Variant-specific image, 3. First product image
      const avisImageUrl = getImageFromProperties(mainProduct.properties);
      const variantImageUrl = getImageForVariant(product, mainProduct.variant_id);
      const imageUrl = avisImageUrl || variantImageUrl || '';
      
      const cols = CELL_MAPPING.columns;

      
      // Add product fields - ALL items consolidated into ONE row
      writes.push({ range: `${SHEET_NAME}!${cols.partNo}${row}`, values: [[partNo]] });
      
      if (imageUrl) {
        writes.push({ range: `${SHEET_NAME}!${cols.picture}${row}`, values: [[`=IMAGE("${imageUrl}")`]] });
      }
      
      writes.push({ range: `${SHEET_NAME}!${cols.description}${row}`, values: [[description]] });
      writes.push({ range: `${SHEET_NAME}!${cols.qty}${row}`, values: [[combinedQuantity.toString()]] });
      // Unit Price and Amount left BLANK for manual fill
      writes.push({ range: `${SHEET_NAME}!${cols.unitPrice}${row}`, values: [[""]] });
      writes.push({ range: `${SHEET_NAME}!${cols.amount}${row}`, values: [[""]] });
    }
    
    // Calculate rows for EXW and Total - always 1 row for main product
    const exwRow = CELL_MAPPING.productStartRow + 1;
    const totalRow = exwRow + 1;

    // Clear row 11 header column E with the destination country (Ship To)
    // The template has "Czech Republic" hardcoded there, but it should show the destination country
    writes.push({ range: `${SHEET_NAME}!E11`, values: [[shipTo]] });

    // IMPORTANT: the template sometimes contains leftover values in the EXW/Total rows.
    // Clear only columns A-D (product data) and restore proper labels with values.
    // Column E has "Shipping cost ($)" and "Total Amount ($)" labels that must be preserved.
    writes.push({
      range: `${SHEET_NAME}!A${exwRow}:D${totalRow}`,
      values: [
        ["EXW", "", "", ""],
        ["", "", "", ""],
      ],
    });

    // Restore labels in column E - values in column F left BLANK for manual fill
    writes.push({ range: `${SHEET_NAME}!E${exwRow}:F${exwRow}`, values: [["Shipping cost ($)", ""]] });
    writes.push({ range: `${SHEET_NAME}!E${totalRow}:F${totalRow}`, values: [["Total Amount ($)", ""]] });
    
    // Execute all writes on the NEW spreadsheet
    for (const write of writes) {
      await writeSheet(newSpreadsheetId, write.range, write.values);
    }
    
    // Step 2: Add a new tab with bike description
    const bikeTabName = `Bike - TB${order.order_number}`;
    await addSheetTab(newSpreadsheetId, bikeTabName);
    
    // Write bike description data to the new tab
    const bikeDescriptionData = buildBikeDescription(order, products);
    await writeSheet(newSpreadsheetId, `${bikeTabName}!A1`, bikeDescriptionData);
    
    // Step 3: Save reference to database
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`;
    
    await supabase.from('generated_spreadsheets').insert({
      spreadsheet_id: newSpreadsheetId,
      spreadsheet_url: spreadsheetUrl,
      order_number: `TB${order.order_number}`,
      customer_name: customerName,
      file_name: fileName,
    });

    // Step 4: Auto-attach spreadsheet to matching order_workflow as attachment
    const orderNum = `TB${order.order_number}`;
    console.log('[ExportSheet] Looking for workflow with order_number:', orderNum);
    
    const { data: workflow, error: workflowError } = await supabase
      .from('order_workflow')
      .select('id')
      .eq('order_number', orderNum)
      .maybeSingle();

    console.log('[ExportSheet] Workflow lookup result:', { workflow, error: workflowError });

    if (workflow) {
      // Also save spreadsheet reference on the workflow record itself
      const { error: updateError } = await supabase
        .from('order_workflow')
        .update({ spreadsheet_id: newSpreadsheetId, spreadsheet_url: spreadsheetUrl })
        .eq('id', workflow.id);
      
      if (updateError) console.error('[ExportSheet] Failed to update workflow:', updateError);

      // Insert as attachment so it appears in the order's attachments tab
      const { error: attachError } = await supabase.from('order_attachments').insert({
        workflow_id: workflow.id,
        file_name: fileName,
        file_url: spreadsheetUrl,
        file_type: 'application/vnd.google-apps.spreadsheet',
        file_size: 0,
        uploaded_by: 'System',
      });
      
      if (attachError) {
        console.error('[ExportSheet] Failed to insert attachment:', attachError);
      } else {
        console.log('[ExportSheet] Attachment created successfully for workflow:', workflow.id);
      }
    } else {
      console.warn('[ExportSheet] No workflow found for order_number:', orderNum);
    }
    
    return {
      success: true,
      spreadsheetUrl,
      spreadsheetId: newSpreadsheetId,
      fileName,
    };
    
  } catch (error) {
    console.error('Error exporting to sheet:', error);
    return {
      success: false,
      spreadsheetUrl: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function getTemplateSpreadsheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${TEMPLATE_SPREADSHEET_ID}/edit`;
}

export function getTemplateSpreadsheetId(): string {
  return TEMPLATE_SPREADSHEET_ID;
}
