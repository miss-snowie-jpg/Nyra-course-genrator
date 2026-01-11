import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Platform OAuth configurations
const platforms = {
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: 'tweet.read tweet.write users.read offline.access',
  },
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: 'user.info.basic,video.upload',
  },
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: 'instagram_basic,instagram_content_publish',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: 'pages_manage_posts,pages_read_engagement,public_profile',
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } }
    )

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: authError } = await supabase.auth.getClaims(token)
    if (authError || !userData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = userData.claims.sub

    if (action === 'get-auth-url') {
      // Generate OAuth URL for a platform
      const { platform, redirectUri } = await req.json()
      
      if (!platforms[platform as keyof typeof platforms]) {
        return new Response(
          JSON.stringify({ error: 'Invalid platform' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const config = platforms[platform as keyof typeof platforms]
      const clientId = Deno.env.get(`${platform.toUpperCase()}_CLIENT_ID`)
      
      if (!clientId) {
        return new Response(
          JSON.stringify({ 
            error: 'Platform not configured',
            message: `${platform} OAuth is not yet configured. Please contact admin to set up ${platform.toUpperCase()}_CLIENT_ID and ${platform.toUpperCase()}_CLIENT_SECRET.`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Generate state with user ID for callback verification
      const state = btoa(JSON.stringify({ userId, platform, timestamp: Date.now() }))

      let authUrl = `${config.authUrl}?`
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: config.scopes,
        state,
      })

      // Platform-specific parameters
      if (platform === 'twitter') {
        params.set('code_challenge', 'challenge')
        params.set('code_challenge_method', 'plain')
      }
      if (platform === 'youtube') {
        params.set('access_type', 'offline')
        params.set('prompt', 'consent')
      }

      authUrl += params.toString()

      return new Response(
        JSON.stringify({ authUrl, state }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'exchange-code') {
      // Exchange authorization code for tokens
      const { platform, code, redirectUri, state } = await req.json()

      if (!platforms[platform as keyof typeof platforms]) {
        return new Response(
          JSON.stringify({ error: 'Invalid platform' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify state
      try {
        const stateData = JSON.parse(atob(state))
        if (stateData.userId !== userId) {
          return new Response(
            JSON.stringify({ error: 'State mismatch' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid state' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const config = platforms[platform as keyof typeof platforms]
      const clientId = Deno.env.get(`${platform.toUpperCase()}_CLIENT_ID`)
      const clientSecret = Deno.env.get(`${platform.toUpperCase()}_CLIENT_SECRET`)

      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: 'Platform not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Exchange code for tokens
      let tokenResponse
      let tokenData

      if (platform === 'twitter') {
        const credentials = btoa(`${clientId}:${clientSecret}`)
        tokenResponse = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: 'challenge',
          }),
        })
      } else if (platform === 'tiktok') {
        tokenResponse = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        })
      } else {
        tokenResponse = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        })
      }

      tokenData = await tokenResponse.json()

      if (!tokenResponse.ok || tokenData.error) {
        return new Response(
          JSON.stringify({ error: 'Token exchange failed', details: tokenData }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Calculate expiration time
      const expiresAt = tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null

      // Upsert social account
      const { error: upsertError } = await supabase
        .from('social_accounts')
        .upsert({
          user_id: userId,
          platform,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_at: expiresAt,
          platform_user_id: tokenData.user_id || tokenData.open_id || null,
        }, { onConflict: 'user_id,platform' })

      if (upsertError) {
        console.error('Failed to save account:', upsertError)
        return new Response(
          JSON.stringify({ error: 'Failed to save account' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, platform }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get-accounts') {
      // Get user's connected accounts
      const { data: accounts, error } = await supabase
        .from('social_accounts')
        .select('id, platform, platform_username, created_at')
        .eq('user_id', userId)

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch accounts' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ accounts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'disconnect') {
      const { platform } = await req.json()

      const { error } = await supabase
        .from('social_accounts')
        .delete()
        .eq('user_id', userId)
        .eq('platform', platform)

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to disconnect' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})