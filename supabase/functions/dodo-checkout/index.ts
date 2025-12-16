import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DODO_TEST_CHECKOUTS_URL = "https://test.dodopayments.com/checkouts";
const DODO_LIVE_CHECKOUTS_URL = "https://live.dodopayments.com/checkouts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { amount, currency, courseId, courseName, productId, customerEmail, successUrl } =
      await req.json();

    console.log("Creating Dodo checkout session:", {
      amount,
      currency,
      courseId,
      courseName,
      productId,
    });

    const apiKey = Deno.env.get("DODO_API_KEY");
    if (!apiKey) {
      throw new Error("DODO_API_KEY not configured");
    }

    const resolvedProductId = (productId || "").trim();
    if (!resolvedProductId) {
      return new Response(JSON.stringify({ error: "Missing productId (Dodo product id is required)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert amount to cents for Dodo API (e.g., 40.99 -> 4099)
    const amountInCents = Math.round((amount || 40.99) * 100);

    const requestBody = {
      product_cart: [
        {
          product_id: resolvedProductId,
          quantity: 1,
          amount: amountInCents,
        },
      ],
      customer: {
        email: customerEmail || "customer@example.com",
        name: courseName || "Course Purchase",
      },
      billing_address: {
        street: "Default",
        city: "Addis Ababa",
        state: "AA",
        country: "ET",
        zipcode: "1000",
      },
      return_url: successUrl || `${req.headers.get("origin")}/wizard?payment=success`,
      metadata: {
        course_id: courseId,
        course_name: courseName,
      },
    };

    const tryUrls = [DODO_TEST_CHECKOUTS_URL, DODO_LIVE_CHECKOUTS_URL];
    let lastStatus = 0;
    let lastText = "";

    for (const url of tryUrls) {
      console.log("Calling Dodo API:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      lastStatus = response.status;
      lastText = responseText;

      console.log("Dodo API response status:", response.status);
      console.log("Dodo API response:", responseText);

      if (response.ok) {
        const data = JSON.parse(responseText || "{}");
        console.log("Dodo checkout session created:", data);

        return new Response(
          JSON.stringify({
            checkout_url: data.checkout_url,
            session_id: data.session_id,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // If key is for the other environment (test vs live), retry once on the other host.
      if (response.status === 401) {
        console.warn("Dodo returned 401 for", url, "- trying next environment if available.");
        continue;
      }

      throw new Error(`Dodo API error: ${response.status} - ${responseText}`);
    }

    throw new Error(
      `Dodo API error: ${lastStatus} - ${lastText}\n` +
        "Unauthorized (401). Please ensure you used the correct API key for TEST vs LIVE, and that the product ID exists in that same environment.",
    );
  } catch (error: unknown) {
    console.error("Error creating checkout:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
