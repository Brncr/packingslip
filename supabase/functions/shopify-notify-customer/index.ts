import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Language = 'en' | 'zh';

const STAGE_LABELS: Record<Language, Record<string, string>> = {
  en: {
    novo: "New Order",
    em_producao: "In Production",
    pronto: "Ready to Ship",
    enviado: "Sent to Agent",
    entregue: "Delivered",
  },
  zh: {
    novo: "新订单",
    em_producao: "生产中",
    pronto: "待发货",
    enviado: "已送至代理",
    entregue: "已送达",
  }
};

const STAGE_EMAILS: Record<Language, Record<string, { subject: string; emoji: string; title: string; message: string; footer: string }>> = {
  en: {
    em_producao: {
      subject: "Your order is now in production 🔧",
      emoji: "🔧",
      title: "Production Started",
      message: "Great news! Your custom bike has entered our production line. Our skilled craftsmen are now carefully assembling your bike with the highest quality standards. We'll notify you as soon as it's ready for shipping.",
      footer: "Thank you for your patience!"
    },
    pronto: {
      subject: "Your bike is ready! ✅",
      emoji: "✅",
      title: "Ready for Shipping",
      message: "Wonderful news! Your bike has been completed and passed our quality inspection. It's now being carefully packaged for safe delivery. You'll receive shipping information shortly.",
      footer: "Get ready to ride!"
    },
    enviado: {
      subject: "Your bike has been sent to Agent! 📦",
      emoji: "📦",
      title: "Sent to Agent",
      message: "Your bike has been sent to our agent for final processing and delivery! You will receive tracking information via email shortly. If you have any questions, please don't hesitate to contact us.",
      footer: "Almost there!"
    },
    entregue: {
      subject: "Your bike has been delivered! 🎉",
      emoji: "🎉",
      title: "Delivered",
      message: "Your bike has arrived! We hope you're thrilled with your new ride. If you have any questions or need assistance, our team is always here to help. Enjoy every ride!",
      footer: "Happy cycling!"
    }
  },
  zh: {
    em_producao: {
      subject: "您的订单正在生产中 🔧",
      emoji: "🔧",
      title: "生产已开始",
      message: "好消息！您的定制自行车已进入我们的生产线。我们的技师正在按照最高质量标准精心组装您的自行车。一旦准备好发货，我们会立即通知您。",
      footer: "感谢您的耐心等待！"
    },
    pronto: {
      subject: "您的自行车已准备就绪！✅",
      emoji: "✅",
      title: "准备发货",
      message: "好消息！您的自行车已完成组装并通过了我们的质量检测。现在正在进行精心包装，以确保安全送达。您很快就会收到发货信息。",
      footer: "准备开始骑行吧！"
    },
    enviado: {
      subject: "您的自行车已送至代理！📦",
      emoji: "📦",
      title: "已送至代理",
      message: "您的自行车已送至我们的代理进行最后处理和配送！您将很快通过电子邮件收到物流追踪信息。如果您有任何疑问，请随时与我们联系。",
      footer: "即将送达！"
    },
    entregue: {
      subject: "您的自行车已送达！🎉",
      emoji: "🎉",
      title: "已送达",
      message: "您的自行车已送达！希望您对新车感到满意。如果您有任何问题或需要帮助，我们的团队随时为您服务。祝您骑行愉快！",
      footer: "骑行快乐！"
    }
  }
};

function generateEmailHtml(
  customerName: string, 
  orderNumber: string, 
  stageLabel: string, 
  emoji: string, 
  title: string,
  message: string,
  footer: string,
  language: Language
): string {
  const isZh = language === 'zh';
  
  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 48px 24px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding: 48px 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">${emoji}</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                ${title}
              </h1>
              <p style="margin: 12px 0 0; color: #94a3b8; font-size: 15px; font-weight: 500;">
                ${isZh ? '订单号' : 'Order'} ${orderNumber}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px;">
              <p style="margin: 0 0 24px; color: #1e293b; font-size: 18px; font-weight: 600;">
                ${isZh ? '尊敬的' : 'Dear'} ${customerName}${isZh ? '，' : ','}
              </p>
              <p style="margin: 0 0 32px; color: #475569; font-size: 16px; line-height: 1.8;">
                ${message}
              </p>
              
              <!-- Status Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-radius: 12px; padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      ${isZh ? '当前状态' : 'Current Status'}
                    </p>
                    <p style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700;">
                      ${stageLabel}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                    <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
                      ${footer}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 32px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #475569; font-size: 14px; font-weight: 600;">
                ${isZh ? '如有任何问题，请随时联系我们' : 'If you have any questions, please contact us'}
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © ${new Date().getFullYear()} Twitter Bike USA. ${isZh ? '保留所有权利' : 'All rights reserved'}.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId, orderNumber, stage, notifyCustomer, customerEmail, customerName, language = 'en' } = await req.json();

    console.log(`Processing notification for order ${orderNumber}, stage: ${stage}, notify: ${notifyCustomer}, language: ${language}`);

    if (!orderNumber || !stage) {
      return new Response(
        JSON.stringify({ error: 'Missing orderNumber or stage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SHOPIFY_ACCESS_TOKEN = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    const SHOPIFY_STORE_DOMAIN = Deno.env.get('SHOPIFY_STORE_DOMAIN');

    if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_DOMAIN) {
      console.error('Missing Shopify credentials');
      return new Response(
        JSON.stringify({ error: 'Shopify credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lang: Language = (language === 'zh') ? 'zh' : 'en';
    
    // ALWAYS use English for Shopify notes/tags
    const shopifyStageLabelEN = STAGE_LABELS['en'][stage] || stage;
    // Use user's language for emails
    const emailStageLabel = STAGE_LABELS[lang][stage] || stage;
    
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    
    // Build the note to add (always in English for Shopify)
    const noteContent = `[${timestamp}] Status: ${shopifyStageLabelEN}`;

    // Search for order by order number (name field in Shopify)
    const searchName = orderNumber.startsWith('#') ? orderNumber : orderNumber;
    const searchUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json?name=${encodeURIComponent(searchName)}&status=any`;
    
    console.log(`Searching for order with name: ${searchName}`);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`Failed to search orders: ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Failed to search orders in Shopify' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    
    let shopifyOrderId: number | null = null;
    let shopifyCustomerEmail: string | null = customerEmail || null;
    let shopifyCustomerName: string | null = customerName || null;
    
    if (searchData.orders && searchData.orders.length > 0) {
      const order = searchData.orders[0];
      shopifyOrderId = order.id;
      shopifyCustomerEmail = shopifyCustomerEmail || order.customer?.email;
      shopifyCustomerName = shopifyCustomerName || order.customer?.first_name || (lang === 'zh' ? '客户' : 'Customer');
      
      console.log(`Found Shopify order ID: ${shopifyOrderId} for ${orderNumber}`);

      const currentNote = order.note || '';
      const newNote = currentNote ? `${currentNote}\n${noteContent}` : noteContent;

      // Build tags - add current stage tag
      const currentTags = order.tags || '';
      const tagList = currentTags.split(',').map((t: string) => t.trim()).filter(Boolean);
      
      // Remove old stage tags and add new one
      const allStageLabels = [...Object.values(STAGE_LABELS.en), ...Object.values(STAGE_LABELS.zh)];
      const stageTags = allStageLabels.map(label => `status:${label}`);
      const filteredTags = tagList.filter((tag: string) => !stageTags.some(st => tag.includes('status:')));
      filteredTags.push(`status:${shopifyStageLabelEN}`);

      // Update order with new note and tag
      const updateUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${shopifyOrderId}.json`;
      
      const updatePayload = {
        order: {
          id: shopifyOrderId,
          note: newNote,
          tags: filteredTags.join(', '),
        }
      };

      const updateResponse = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error(`Failed to update order: ${errorText}`);
      } else {
        console.log(`Successfully updated Shopify order ${orderNumber} to stage ${shopifyStageLabelEN}`);
      }
    } else {
      console.log(`Order ${orderNumber} not found in Shopify`);
    }

    // Send email notification if enabled
    let emailSent = false;
    
    if (notifyCustomer && shopifyCustomerEmail && stage !== 'novo') {
      const emailConfig = STAGE_EMAILS[lang][stage];
      
      if (emailConfig) {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        
        if (RESEND_API_KEY) {
          try {
            const resend = new Resend(RESEND_API_KEY);
            
            const emailHtml = generateEmailHtml(
              shopifyCustomerName || (lang === 'zh' ? '客户' : 'Customer'),
              orderNumber,
              emailStageLabel,
              emailConfig.emoji,
              emailConfig.title,
              emailConfig.message,
              emailConfig.footer,
              lang
            );
            
            const { error: emailError } = await resend.emails.send({
              from: 'Twitter Bike USA <orders@twitterbikeusa.com>',
              to: [shopifyCustomerEmail],
              subject: `${orderNumber} - ${emailConfig.subject}`,
              html: emailHtml,
            });

            if (emailError) {
              console.error('Error sending email:', emailError);
            } else {
              console.log(`Email sent to ${shopifyCustomerEmail} for stage ${stage} in ${lang}`);
              emailSent = true;
            }
          } catch (emailErr) {
            console.error('Failed to send email:', emailErr);
          }
        } else {
          console.log('RESEND_API_KEY not configured, skipping email');
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Order ${orderNumber} updated to ${shopifyStageLabelEN}`,
        notifiedCustomer: notifyCustomer,
        emailSent,
        language: lang
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in shopify-notify-customer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
