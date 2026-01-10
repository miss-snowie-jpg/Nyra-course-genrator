import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Subscription {
  id: string;
  plan: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'expired';
  started_at: string;
  expires_at: string | null;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setSubscription(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Check if user is admin (admins bypass subscription)
        const { data: adminData } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

        if (adminData === true) {
          setIsAdmin(true);
          // Set a fake yearly subscription for admins
          setSubscription({
            id: 'admin',
            plan: 'yearly',
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: null,
          });
          setLoading(false);
          return;
        }

        // Check subscription status
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single();

        if (!error && data) {
          setSubscription(data as Subscription);
        } else {
          setSubscription(null);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setSubscription(null);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      checkSubscription();
    });

    return () => authSub.unsubscribe();
  }, []);

  const hasSubscription = subscription !== null && subscription.status === 'active';
  const isYearly = subscription?.plan === 'yearly';
  const hasAutoPoster = isAdmin || isYearly;

  return { 
    subscription, 
    isAdmin, 
    loading, 
    hasSubscription,
    isYearly,
    hasAutoPoster 
  };
}
