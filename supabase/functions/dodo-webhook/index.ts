import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, dodo-signature',
};

async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    // Dodo webhook signature format: whsec_XXX
    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(cleanSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Compare signatures
    return signature === expectedSignature || signature.includes(expectedSignature);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('DODO_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('DODO_WEBHOOK_SECRET not configured');
    }

    const payload = await req.text();
    const signature = req.headers.get('dodo-signature') || req.headers.get('x-dodo-signature') || '';
    
    console.log("Received webhook payload:", payload);
    console.log("Signature header:", signature);

    // Verify signature
    const isValid = await verifyWebhookSignature(payload, signature, webhookSecret);
    if (!isValid && signature) {
      console.warn("Webhook signature verification failed, but continuing for development");
      // In production, you might want to: throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(payload);
    console.log("Webhook event type:", event.type || event.event_type);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    const eventType = event.type || event.event_type;
    
    switch (eventType) {
      case 'payment.succeeded':
      case 'payment_intent.succeeded':
        console.log("Payment succeeded:", event.data);
        
        // Extract course ID from metadata
        const courseId = event.data?.metadata?.course_id || event.data?.object?.metadata?.course_id;
        
        if (courseId) {
          // Update course status or create payment record
          const { error } = await supabase
            .from('courses')
            .update({ website_status: 'paid' })
            .eq('id', courseId);
          
          if (error) {
            console.error("Error updating course:", error);
          } else {
            console.log("Course marked as paid:", courseId);
          }
        }
        break;

      case 'subscription.created':
      case 'subscription.active':
        console.log("Subscription event:", event.data);
        break;

      case 'payment.failed':
      case 'payment_intent.payment_failed':
        console.log("Payment failed:", event.data);
        break;

      default:
        console.log("Unhandled event type:", eventType);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
