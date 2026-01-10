import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Sparkles, Crown, Zap, Calendar, Share2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Pricing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }
      
      setUser(session.user);
      
      // Check if user already has an active subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .single();
      
      if (subscription) {
        // User already has a subscription, redirect to dashboard
        navigate('/dashboard');
        return;
      }
      
      // Check if user is admin (admins bypass subscription)
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });
      
      if (isAdmin) {
        navigate('/dashboard');
        return;
      }
      
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSelectPlan = (plan: 'monthly' | 'annual') => {
    navigate(`/checkout?plan=${plan}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Sparkles className="mx-auto mb-4 h-12 w-12 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Nyra
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">
            Choose Your Plan
          </h1>
          <p className="mb-12 text-xl text-muted-foreground">
            Select a plan to unlock all features and start creating
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Monthly Plan */}
            <Card className="relative overflow-hidden border-border/50 bg-card p-8 text-left">
              <div className="mb-6">
                <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">Monthly</h2>
                <div className="mb-1">
                  <span className="text-4xl font-bold">$40.99</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Flexible monthly billing
                </p>
              </div>

              <ul className="mb-8 space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>Unlimited course creation</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>AI content generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>Publish unlimited courses</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>Video generator access</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>Priority support</span>
                </li>
              </ul>

              <Button 
                size="lg"
                className="w-full"
                variant="outline"
                onClick={() => handleSelectPlan('monthly')}
              >
                Get Started
              </Button>
            </Card>

            {/* Yearly Plan */}
            <Card className="relative overflow-hidden border-primary bg-gradient-to-b from-primary/10 to-card p-8 text-left shadow-xl">
              <div className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-semibold text-primary-foreground">
                BEST VALUE
              </div>
              
              <div className="mb-6">
                <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">Yearly</h2>
                <div className="mb-1">
                  <span className="text-4xl font-bold">$399.99</span>
                  <span className="text-muted-foreground">/year</span>
                </div>
                <p className="text-sm text-green-500 font-medium">
                  Save $91.89 per year!
                </p>
              </div>

              <ul className="mb-8 space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>Everything in Monthly</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>2+ months FREE</span>
                </li>
                <li className="flex items-start gap-3">
                  <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span className="font-medium text-accent">Auto Poster - Post ads to social media automatically</span>
                </li>
                <li className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span className="font-medium text-accent">Schedule posts across platforms</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>Dedicated support</span>
                </li>
              </ul>

              <Button 
                size="lg"
                className="w-full bg-gradient-to-r from-primary to-accent"
                onClick={() => handleSelectPlan('annual')}
              >
                Get Yearly Access
              </Button>
            </Card>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Secure payment powered by Dodo Payments. Cancel anytime.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
