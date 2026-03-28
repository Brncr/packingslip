import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-topic, x-shopify-hmac-sha256, x-shopify-shop-domain, x-shopify-api-version',
};

const STAGE_FROM_TAG: Record<string, string> = {
  "status:Novo Pedido": "novo",
  "status:Em Produção": "em_producao",
  "status:Pronto para Envio": "pronto",
  "status:Enviado": "enviado",
  "status:Entregue": "entregue",
};

const STAGE_EMAILS: Record<string, { subject: string; emoji: string; message: string }> = {
  em_producao: {
    subject: "Sua bike está em produção! 🔧",
    emoji: "🔧",
    message: "Boas notícias! Sua bike está sendo montada na nossa fábrica com todo o cuidado que ela merece. Você será notificado assim que ela estiver pronta para envio."
  },
  pronto: {
    subject: "Sua bike está pronta! ✅",
    emoji: "✅",
    message: "Sua bike ficou incrível e está pronta! Ela será embalada e enviada em breve. Prepare-se para recebê-la!"
  },
  enviado: {
    subject: "Sua bike foi enviada! 📦",
    emoji: "📦",
    message: "Sua bike está a caminho! Em breve você receberá informações de rastreamento para acompanhar a entrega."
  },
  entregue: {
    subject: "Sua bike foi entregue! 🎉",
    emoji: "🎉",
    message: "Sua bike chegou! Esperamos que você aproveite cada pedalada. Se tiver qualquer dúvida, estamos aqui para ajudar!"
  }
};

function generateEmailHtml(customerName: string, orderNumber: string, stage: string, emoji: string, message: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atualização do Pedido</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                ${emoji} Atualização do Pedido
              </h1>
              <p style="margin: 10px 0 0; color: #a0aec0; font-size: 16px;">
                Pedido ${orderNumber}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 18px;">
                Olá <strong>${customerName}</strong>! 👋
              </p>
              <p style="margin: 0 0 30px; color: #555555; font-size: 16px; line-height: 1.6;">
                ${message}
              </p>
              
              <!-- Status Badge -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; background-color: #e8f5e9; color: #2e7d32; padding: 12px 24px; border-radius: 50px; font-size: 14px; font-weight: 600;">
                      Status: ${stage}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #888888; font-size: 14px;">
                Obrigado por escolher a gente! 🚴
              </p>
              <p style="margin: 10px 0 0; color: #aaaaaa; font-size: 12px;">
                Se tiver dúvidas, entre em contato conosco.
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
    const shopifyTopic = req.headers.get('x-shopify-topic');
    const shopifyDomain = req.headers.get('x-shopify-shop-domain');
    
    console.log(`Received Shopify webhook: ${shopifyTopic} from ${shopifyDomain}`);

    const payload = await req.json();
    
    // Log the order info
    const orderNumber = payload.name || payload.order_number || `#${payload.id}`;
    console.log(`Order ID: ${payload.id}, Order Number: ${orderNumber}`);
    console.log(`Tags: ${payload.tags}`);
    console.log(`Customer Email: ${payload.customer?.email}`);

    // Get customer info
    const customerEmail = payload.customer?.email;
    const customerName = payload.customer?.first_name || payload.customer?.default_address?.first_name || 'Cliente';
    
    // Detect stage from tags
    let detectedStage: string | null = null;
    let stageLabel: string = '';
    
    if (payload.tags) {
      const tags = payload.tags.split(',').map((t: string) => t.trim());
      for (const tag of tags) {
        if (STAGE_FROM_TAG[tag]) {
          detectedStage = STAGE_FROM_TAG[tag];
          stageLabel = tag.replace('status:', '');
          break;
        }
      }
    }

    console.log(`Detected stage from tags: ${detectedStage} (${stageLabel})`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this order exists in our workflow and if notifications are enabled
    const orderId = String(payload.id);
    
    const { data: existingOrder, error: fetchError } = await supabase
      .from('order_workflow')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    let shouldNotify = true;
    let previousStage: string | null = null;

    if (existingOrder) {
      shouldNotify = existingOrder.notify_customer;
      previousStage = existingOrder.current_stage;
      
      // Update the order stage if it changed
      if (detectedStage && existingOrder.current_stage !== detectedStage) {
        console.log(`Updating order ${orderNumber} stage from ${existingOrder.current_stage} to ${detectedStage}`);
        
        const { error: updateError } = await supabase
          .from('order_workflow')
          .update({ 
            current_stage: detectedStage,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOrder.id);

        if (updateError) {
          console.error('Error updating order stage:', updateError);
        } else {
          // Record history
          await supabase.from('order_stage_history').insert({
            workflow_id: existingOrder.id,
            from_stage: existingOrder.current_stage,
            to_stage: detectedStage,
            notified_customer: shouldNotify && !!customerEmail
          });
        }
      }
    }

    // Send email if notifications are enabled and we have email config
    let emailSent = false;
    
    if (shouldNotify && customerEmail && detectedStage && detectedStage !== previousStage) {
      const emailConfig = STAGE_EMAILS[detectedStage];
      
      if (emailConfig) {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        
        if (RESEND_API_KEY) {
          try {
            const resend = new Resend(RESEND_API_KEY);
            
            const emailHtml = generateEmailHtml(
              customerName,
              orderNumber,
              stageLabel,
              emailConfig.emoji,
              emailConfig.message
            );
            
            const { error: emailError } = await resend.emails.send({
              from: 'Atualizações <onboarding@resend.dev>', // Use your verified domain
              to: [customerEmail],
              subject: `${orderNumber} - ${emailConfig.subject}`,
              html: emailHtml,
            });

            if (emailError) {
              console.error('Error sending email:', emailError);
            } else {
              console.log(`Email sent to ${customerEmail} for stage ${detectedStage}`);
              emailSent = true;
            }
          } catch (emailErr) {
            console.error('Failed to send email:', emailErr);
          }
        } else {
          console.log('RESEND_API_KEY not configured, skipping email');
        }
      }
    } else {
      console.log(`Skipping email: shouldNotify=${shouldNotify}, hasEmail=${!!customerEmail}, stage=${detectedStage}, previousStage=${previousStage}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Webhook processed for order ${orderNumber}`,
        topic: shopifyTopic,
        detected_stage: detectedStage,
        email_sent: emailSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing Shopify webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
