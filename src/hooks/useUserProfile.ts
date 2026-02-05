 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 
 interface Profile {
   id: string;
   user_id: string;
   preferred_language: string;
   created_at: string;
   updated_at: string;
 }
 
 export const useUserProfile = () => {
   const [profile, setProfile] = useState<Profile | null>(null);
   const [loading, setLoading] = useState(true);
 
   useEffect(() => {
     const fetchProfile = async () => {
       const { data: { session } } = await supabase.auth.getSession();
       if (!session) {
         setLoading(false);
         return;
       }
 
       const { data, error } = await supabase
         .from('profiles')
         .select('*')
         .eq('user_id', session.user.id)
         .single();
 
       if (!error && data) {
         setProfile(data as Profile);
       }
       setLoading(false);
     };
 
     fetchProfile();
 
     const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
       fetchProfile();
     });
 
     return () => subscription.unsubscribe();
   }, []);
 
   const updateLanguage = async (language: string) => {
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) return false;
 
     if (profile) {
       const { error } = await supabase
         .from('profiles')
         .update({ preferred_language: language })
         .eq('user_id', session.user.id);
       
       if (!error) {
         setProfile({ ...profile, preferred_language: language });
         return true;
       }
     } else {
       const { data, error } = await supabase
         .from('profiles')
         .insert({ user_id: session.user.id, preferred_language: language })
         .select()
         .single();
       
       if (!error && data) {
         setProfile(data as Profile);
         return true;
       }
     }
     return false;
   };
 
   return { profile, loading, updateLanguage };
 };