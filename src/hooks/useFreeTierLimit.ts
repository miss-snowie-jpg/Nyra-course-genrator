 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 
 export const FREE_COURSE_LIMIT = 2;
 
 export const useFreeTierLimit = () => {
   const [publishedCount, setPublishedCount] = useState(0);
   const [loading, setLoading] = useState(true);
   const [hasReachedLimit, setHasReachedLimit] = useState(false);
 
   useEffect(() => {
     const fetchPublishedCourses = async () => {
       const { data: { session } } = await supabase.auth.getSession();
       if (!session) {
         setLoading(false);
         return;
       }
 
       const { count, error } = await supabase
         .from('courses')
         .select('*', { count: 'exact', head: true })
         .eq('user_id', session.user.id)
         .eq('website_status', 'paid');
 
       if (!error && count !== null) {
         setPublishedCount(count);
         setHasReachedLimit(count >= FREE_COURSE_LIMIT);
       }
       setLoading(false);
     };
 
     fetchPublishedCourses();
   }, []);
 
   return { 
     publishedCount, 
     loading, 
     hasReachedLimit,
     freeCoursesRemaining: Math.max(0, FREE_COURSE_LIMIT - publishedCount)
   };
 };