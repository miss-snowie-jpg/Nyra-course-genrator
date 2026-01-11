import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Instagram, Youtube, Facebook, Twitter, Link2, Unlink,
  Share2, ExternalLink, CheckCircle2, AlertCircle, Loader2
} from "lucide-react";
import { toast } from "sonner";

interface SocialAccount {
  id: string;
  platform: string;
  platform_username: string | null;
  created_at: string;
}

const platformConfig = {
  instagram: {
    icon: Instagram,
    name: "Instagram",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
  youtube: {
    icon: Youtube,
    name: "YouTube",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  facebook: {
    icon: Facebook,
    name: "Facebook",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  twitter: {
    icon: Twitter,
    name: "Twitter/X",
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
  },
  tiktok: {
    icon: Share2,
    name: "TikTok",
    color: "text-foreground",
    bgColor: "bg-foreground/10",
  },
  linktree: {
    icon: Link2,
    name: "Linktree",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
};

const SocialAccountsManager = () => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
    
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      handleOAuthCallback(code, state);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-oauth?action=get-accounts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();
      if (data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      const stateData = JSON.parse(atob(state));
      const platform = stateData.platform;
      
      setConnecting(platform);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to connect accounts");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-oauth?action=exchange-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            platform,
            code,
            redirectUri: window.location.origin + '/auto-poster',
            state,
          }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success(`${platform} connected successfully!`);
        fetchAccounts();
      } else {
        toast.error(data.message || `Failed to connect ${platform}`);
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast.error("Failed to complete connection");
    } finally {
      setConnecting(null);
    }
  };

  const handleConnect = async (platform: string) => {
    try {
      setConnecting(platform);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to connect accounts");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-oauth?action=get-auth-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            platform,
            redirectUri: window.location.origin + '/auto-poster',
          }),
        }
      );

      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else if (data.message) {
        toast.error(data.message);
        setConnecting(null);
      } else {
        toast.error(`Failed to connect to ${platform}`);
        setConnecting(null);
      }
    } catch (error) {
      console.error('Connect error:', error);
      toast.error("Failed to initiate connection");
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    const confirmed = window.confirm(`Are you sure you want to disconnect ${platform}?`);
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-oauth?action=disconnect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ platform }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success(`${platform} disconnected`);
        setAccounts(accounts.filter(a => a.platform !== platform));
      } else {
        toast.error(`Failed to disconnect ${platform}`);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error("Failed to disconnect");
    }
  };

  const isConnected = (platform: string) => {
    return accounts.some(a => a.platform === platform);
  };

  if (loading) {
    return (
      <Card className="border-border/50 bg-card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card p-6 mb-8">
      <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
        <Link2 className="h-5 w-5 text-primary" />
        Connected Accounts
      </h3>
      <p className="mb-6 text-sm text-muted-foreground">
        Connect your social media accounts to enable automatic posting. Your credentials are stored securely.
      </p>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(platformConfig).map(([key, config]) => {
          const Icon = config.icon;
          const connected = isConnected(key);
          const isLoading = connecting === key;
          
          return (
            <div 
              key={key}
              className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                connected 
                  ? 'border-green-500/30 bg-green-500/5' 
                  : 'border-border/50 bg-card hover:border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${config.bgColor}`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div>
                  <p className="font-medium">{config.name}</p>
                  {connected ? (
                    <Badge variant="outline" className="text-green-500 border-green-500/30">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not connected</span>
                  )}
                </div>
              </div>
              
              {connected ? (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDisconnect(key)}
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={isLoading}
                  onClick={() => handleConnect(key)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Connect
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 flex items-start gap-2 rounded-lg bg-muted/50 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Platform Setup Required</p>
          <p>Each platform requires developer app credentials to be configured. Contact your administrator to set up OAuth apps for each platform.</p>
        </div>
      </div>
    </Card>
  );
};

export default SocialAccountsManager;