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
    const { amount, currency, courseId, courseName, successUrl, cancelUrl } = await req.json();
    
    console.log("Creating Dodo checkout session:", { amount, currency, courseId, courseName });

    const apiKey = Deno.env.get('DODO_API_KEY');
    if (!apiKey) {
      throw new Error('DODO_API_KEY not configured');
    }

    // Dodo Payments API - create a one-time payment checkout
    // For test mode use: https://test.dodopayments.com/v1/payments
    // For live mode use: https://api.dodopayments.com/v1/payments
    const response = await fetch('https://test.dodopayments.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        billing: {
          city: "Addis Ababa",
          country: "ET",
          state: "AA",
          street: "Default",
          zipcode: "1000"
        },
        customer: {
          email: "customer@example.com",
          name: courseName || "Course Purchase"
        },
        payment_link: true,
        product_cart: [
          {
            product_id: courseId || 'course_product',
            quantity: 1
          }
        ],
        return_url: successUrl || `${req.headers.get('origin')}/dashboard?payment=success`,
        metadata: {
          course_id: courseId,
          course_name: courseName
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
    console.log("Dodo payment created:", data);

    return new Response(
      JSON.stringify({
        checkout_url: data.payment_link || data.payment_url || data.url,
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
