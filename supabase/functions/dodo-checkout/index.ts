import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { amount, currency, courseId, courseName, productId, customerEmail, successUrl } = await req.json();
    
    console.log("Creating Dodo checkout session:", { amount, currency, courseId, courseName, productId });

    const apiKey = Deno.env.get('DODO_API_KEY');
    if (!apiKey) {
      throw new Error('DODO_API_KEY not configured');
    }

    const resolvedProductId = (productId || '').trim();
    if (!resolvedProductId) {
      return new Response(
        JSON.stringify({ error: 'Missing productId (Dodo product id is required).' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Dodo Checkout Sessions API
    // Test: https://test.dodopayments.com/checkouts
    // Live: https://live.dodopayments.com/checkouts
    const response = await fetch('https://test.dodopayments.com/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: resolvedProductId,
            quantity: 1,
          }
        ],
        customer: {
          email: customerEmail || 'customer@example.com',
          name: courseName || 'Course Purchase',
        },
        billing_address: {
          street: 'Default',
          city: 'Addis Ababa',
          state: 'AA',
          country: 'ET',
          zipcode: '1000',
        },
        return_url: successUrl || `${req.headers.get('origin')}/wizard?payment=success`,
        metadata: {
          course_id: courseId,
          course_name: courseName,
        },
      }),
    });

    const responseText = await response.text();
    console.log("Dodo API response status:", response.status);
    console.log("Dodo API response:", responseText);

    if (!response.ok) {
      throw new Error(`Dodo API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
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
