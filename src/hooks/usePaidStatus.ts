import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePaidStatus() {
  const [isPaid, setIsPaid] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setIsPaid(false);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Check if user is admin (admins bypass payment)
        const { data: adminData } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

        if (adminData === true) {
          setIsAdmin(true);
          setIsPaid(true); // Admins are always considered paid
          setLoading(false);
          return;
        }

        // Check payment status via edge function
        const { data, error } = await supabase.functions.invoke('verify-paid');
        
        if (!error && data?.ok === true) {
          setIsPaid(true);
        } else {
          setIsPaid(false);
        }
      } catch (error) {
        console.error('Error checking paid status:', error);
        setIsPaid(false);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isPaid, isAdmin, loading };
}
