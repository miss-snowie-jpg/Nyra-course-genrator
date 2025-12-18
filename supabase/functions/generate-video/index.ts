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
    const FAL_API_KEY = Deno.env.get('FAL_API_KEY')
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY is not set')
    }

    const body = await req.json()

    // If it's a status check request
    if (body.requestId) {
      console.log("Checking status for request:", body.requestId)
      
      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/skyreels-i2v/requests/${body.requestId}/status`,
        { 
          method: 'GET',
          headers: {
            'Authorization': `Key ${FAL_API_KEY}`,
          }
        }
      )

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.error("Status check error:", statusResponse.status, errorText)
        throw new Error(`Failed to check video status: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()
      console.log("Status check response:", JSON.stringify(statusData))
      
      if (statusData.status === 'COMPLETED') {
        // Fetch the result
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/skyreels-i2v/requests/${body.requestId}`,
          { 
            method: 'GET',
            headers: {
              'Authorization': `Key ${FAL_API_KEY}`,
            }
          }
        )

        if (!resultResponse.ok) {
          throw new Error('Failed to fetch result')
        }

        const resultData = await resultResponse.json()
        console.log("Result data:", JSON.stringify(resultData))
        
        return new Response(JSON.stringify({
          status: 'completed',
          video_url: resultData.video?.url || null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else if (statusData.status === 'FAILED') {
        return new Response(JSON.stringify({
          status: 'failed',
          error: statusData.error || 'Video generation failed',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else {
        return new Response(JSON.stringify({
          status: 'processing',
          video_url: null,
          queue_position: statusData.queue_position,
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

    if (!body.image_url) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required field: image_url is required for SkyReels image-to-video" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Extract parameters from request body
    const aspectRatio = body.aspect_ratio || body.aspectRatio || "16:9"

    console.log("Generating video with SkyReels V1:", { prompt: body.prompt, imageUrl: body.image_url, aspectRatio })
    
    // Generate video using SkyReels I2V API via queue
    const requestBody = {
      prompt: body.prompt,
      image_url: body.image_url,
      aspect_ratio: aspectRatio,
      guidance_scale: 6,
      num_inference_steps: 30,
    }

    console.log("Request body:", JSON.stringify(requestBody))

    const generateResponse = await fetch(
      'https://queue.fal.run/fal-ai/skyreels-i2v',
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text()
      console.error("Generation error:", generateResponse.status, errorText)
      throw new Error(`Failed to start video generation: ${generateResponse.status} - ${errorText}`)
    }

    const generateData = await generateResponse.json()
    console.log("Video generation started:", JSON.stringify(generateData))

    return new Response(JSON.stringify({ 
      requestId: generateData.request_id,
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
