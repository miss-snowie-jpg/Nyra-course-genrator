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
    const HEYGEN_API_KEY = Deno.env.get('HEYGEN_API_KEY')
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY is not set')
    }

    const body = await req.json()

    // If it's a status check request
    if (body.videoId) {
      console.log("Checking status for video:", body.videoId)
      const statusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${body.videoId}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
        },
      })

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text()
        console.error("Status check error:", statusResponse.status, errorText)
        throw new Error(`Failed to check video status: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()
      console.log("Status check response:", statusData)
      
      return new Response(JSON.stringify({
        status: statusData.data?.status || 'unknown',
        video_url: statusData.data?.video_url,
        error: statusData.data?.error
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

    // Extract parameters from request body with defaults
    const avatarId = body.avatarId || "Angela-inblackskirt-20220820"
    const voiceId = body.voiceId || "1bd001e7e50f421d891986aad5158bc8"
    const aspectRatio = body.aspectRatio || "16:9"
    
    // Calculate dimensions based on aspect ratio
    let width = 1280
    let height = 720
    if (aspectRatio === "9:16") {
      width = 720
      height = 1280
    } else if (aspectRatio === "1:1") {
      width = 720
      height = 720
    }

    console.log("Generating video with:", { prompt: body.prompt, avatarId, voiceId, aspectRatio, width, height })
    
    // Generate video using HeyGen API
    const videoData = {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: avatarId,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: body.prompt,
            voice_id: voiceId,
          },
        },
      ],
      title: body.title || "Generated Video",
      test: true,
      caption: false,
      dimension: {
        width,
        height,
      },
    }

    const generateResponse = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(videoData),
    })

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text()
      console.error("Generation error:", generateResponse.status, errorText)
      throw new Error(`Failed to generate video: ${generateResponse.status} - ${errorText}`)
    }

    const generateData = await generateResponse.json()
    console.log("Video generation started:", generateData)

    return new Response(JSON.stringify({ 
      videoId: generateData.data?.video_id,
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
