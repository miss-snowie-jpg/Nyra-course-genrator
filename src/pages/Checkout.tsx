import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DODO_PRODUCT_ID_MONTHLY = "pdt_uysfRw7MOTEsSU5SaePxz";
const DODO_PRODUCT_ID_ANNUAL = "pdt_0NUDIGAMwMUEKsgsqEcK9";

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Check auth and get user email
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate(`/auth?plan=${plan}`);
        return;
      }
      setUserEmail(session.user.email || null);
      initiateCheckout(session.user.email);
    });
  }, [navigate, plan]);

  const initiateCheckout = async (email: string | null | undefined) => {
    try {
      const productId = plan === 'annual' ? DODO_PRODUCT_ID_ANNUAL : DODO_PRODUCT_ID_MONTHLY;
      const amount = plan === 'annual' ? 399.99 : 40.99;
      const planName = plan === 'annual' ? 'Annual Subscription' : 'Monthly Subscription';

      const { data, error } = await supabase.functions.invoke('dodo-checkout', {
        body: {
          amount,
          currency: 'USD',
          productId,
          customerEmail: email || 'customer@example.com',
          courseName: planName,
          successUrl: `${window.location.origin}/wizard?payment=success&plan=${plan}`,
        },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 p-8 backdrop-blur-sm text-center">
        <div className="mb-6 inline-flex items-center gap-2 text-3xl font-bold">
          <Sparkles className="h-8 w-8 text-primary" />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Nyra
          </span>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            Redirecting to payment...
          </p>
          <p className="text-sm text-muted-foreground">
            {plan === 'annual' ? 'Annual Plan - $399.99/year' : 'Monthly Plan - $40.99/month'}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Checkout;
