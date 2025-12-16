import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const HEYGEN_API_KEY = Deno.env.get('HEYGEN_API_KEY')
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY is not set')
    }

    console.log("Fetching voices from HeyGen API")
    
    const response = await fetch('https://api.heygen.com/v2/voices', {
      method: 'GET',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("HeyGen API error:", response.status, errorText)
      throw new Error(`Failed to fetch voices: ${response.status}`)
    }

    const data = await response.json()
    console.log("Fetched voices count:", data.data?.voices?.length || 0)
    
    // Return only essential voice data
    const voices = (data.data?.voices || []).map((voice: any) => ({
      id: voice.voice_id,
      name: voice.name || voice.display_name,
      language: voice.language,
      gender: voice.gender,
    }))

    return new Response(JSON.stringify({ voices }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("Error fetching voices:", error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
