import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, currency, courseId, successUrl, cancelUrl } = await req.json();
    
    console.log("Creating Dodo checkout session:", { amount, currency, courseId });

    const apiKey = Deno.env.get('DODO_API_KEY');
    if (!apiKey) {
      throw new Error('DODO_API_KEY not configured');
    }

    // Use Dodo Payments checkout sessions API
    // For test mode use: https://test.dodopayments.com/checkouts
    // For live mode use: https://live.dodopayments.com/checkouts
    const response = await fetch('https://test.dodopayments.com/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: courseId || 'course_product',
            quantity: 1
          }
        ],
        success_url: successUrl || `${req.headers.get('origin')}/dashboard?payment=success`,
        cancel_url: cancelUrl,
        metadata: {
          course_id: courseId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Dodo API error:", errorText);
      throw new Error(`Dodo API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Dodo checkout session created:", data);

    return new Response(
      JSON.stringify({
        checkout_url: data.checkout_url,
        session_id: data.session_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error("Error creating checkout:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
