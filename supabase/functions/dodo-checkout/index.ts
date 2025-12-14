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

    // Create checkout session with Dodo Payments
    const response = await fetch('https://api.dodopayments.com/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        billing: {
          city: "string",
          country: "AC",
          state: "string",
          street: "string",
          zipcode: "string"
        },
        customer: {
          customer_id: courseId,
          email: "customer@example.com",
          name: "Customer"
        },
        payment_link: true,
        product_cart: [
          {
            product_id: courseId,
            quantity: 1
          }
        ],
        return_url: successUrl || `${req.headers.get('origin')}/dashboard?payment=success`,
        metadata: {
          course_id: courseId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Dodo API error:", errorText);
      throw new Error(`Dodo API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Dodo checkout session created:", data);

    return new Response(
      JSON.stringify({
        checkout_url: data.payment_link,
        payment_id: data.payment_id,
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
