import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set')
    }

    const body = await req.json()

    // If it's a status check request
    if (body.operationName) {
      console.log("Checking status for operation:", body.operationName)
      
      const statusResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${body.operationName}?key=${GEMINI_API_KEY}`,
        { method: 'GET' }
      )

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.error("Status check error:", statusResponse.status, errorText)
        throw new Error(`Failed to check video status: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()
      console.log("Status check response:", JSON.stringify(statusData))
      
      if (statusData.done) {
        // Extract video URL from response
        const generatedVideos = statusData.response?.generatedVideos
        const videoUri = generatedVideos?.[0]?.video?.uri
        
        return new Response(JSON.stringify({
          status: 'completed',
          video_url: videoUri ? `${videoUri}&key=${GEMINI_API_KEY}` : null,
          error: statusData.error?.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else {
        return new Response(JSON.stringify({
          status: 'processing',
          video_url: null,
          metadata: statusData.metadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // If it's a generation request
    if (!body.prompt) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: prompt is required" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Extract parameters from request body
    const aspectRatio = body.aspect_ratio || body.aspectRatio || "16:9"
    const duration = body.duration || 8

    console.log("Generating video with Veo:", { prompt: body.prompt, aspectRatio, duration })
    
    // Generate video using Veo API with generateVideos endpoint
    const requestBody = {
      prompt: body.prompt,
      config: {
        aspectRatio: aspectRatio,
        numberOfVideos: 1,
        durationSeconds: Math.min(Math.max(duration, 5), 8),
        personGeneration: "allow_adult"
      }
    }

    console.log("Request body:", JSON.stringify(requestBody))

    // Use veo-2.0-generate-001 which is available via Gemini API
    const generateResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideos?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text()
      console.error("Generation error:", generateResponse.status, errorText)
      throw new Error(`Failed to generate video: ${generateResponse.status} - ${errorText}`)
    }

    const generateData = await generateResponse.json()
    console.log("Video generation started:", JSON.stringify(generateData))

    return new Response(JSON.stringify({ 
      operationName: generateData.name,
      status: 'pending'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Error in generate-video function:", error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
