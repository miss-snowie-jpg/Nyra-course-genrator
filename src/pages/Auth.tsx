import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
 import { Sparkles, Globe, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
 import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
 
 const LANGUAGES = [
   { id: "english", name: "English", flag: "🇬🇧", native: "English" },
   { id: "amharic", name: "Amharic", flag: "🇪🇹", native: "አማርኛ" },
   { id: "swahili", name: "Swahili", flag: "🇰🇪", native: "Kiswahili" },
   { id: "french", name: "French", flag: "🇫🇷", native: "Français" },
 ];

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
   const [step, setStep] = useState<'auth' | 'language'>('auth');
   const [selectedLanguage, setSelectedLanguage] = useState("english");

  const getRedirectUrl = () => {
    if (plan && plan !== 'free') {
      return `/checkout?plan=${plan}`;
    }
    return '/pricing';
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(getRedirectUrl());
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
       if (session && step === 'auth' && isLogin) {
        navigate(getRedirectUrl());
      }
    });

    return () => subscription.unsubscribe();
   }, [navigate, plan, step, isLogin]);
 
   const saveLanguageAndProceed = async () => {
     setLoading(true);
     try {
       const { data: { session } } = await supabase.auth.getSession();
       if (session) {
         await supabase
           .from('profiles')
           .upsert({ 
             user_id: session.user.id, 
             preferred_language: selectedLanguage 
           });
         toast.success("Language preference saved!");
         navigate(getRedirectUrl());
       }
     } catch (error: any) {
       toast.error(error.message || "Failed to save language");
     } finally {
       setLoading(false);
     }
   };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${getRedirectUrl()}`,
          },
        });
        if (error) throw error;
         toast.success("Account created!");
         setStep('language');
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

   if (step === 'language') {
     return (
       <div className="flex min-h-screen items-center justify-center bg-background p-4">
         <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
         
         <Card className="relative w-full max-w-md border-border/50 bg-card/80 p-8 backdrop-blur-sm">
           <div className="mb-8 text-center">
             <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent">
               <Globe className="h-8 w-8 text-white" />
             </div>
             <h1 className="mb-2 text-2xl font-bold">Choose Your Language</h1>
             <p className="text-muted-foreground">
               Select your preferred language for courses and content
             </p>
           </div>
 
           <RadioGroup
             value={selectedLanguage}
             onValueChange={setSelectedLanguage}
             className="grid grid-cols-2 gap-3 mb-6"
           >
             {LANGUAGES.map((lang) => (
               <Label
                 key={lang.id}
                 htmlFor={`lang-${lang.id}`}
                 className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${
                   selectedLanguage === lang.id 
                     ? 'border-primary bg-primary/10 shadow-lg' 
                     : 'border-border/50 bg-card/50 hover:border-primary/50'
                 }`}
               >
                 <RadioGroupItem value={lang.id} id={`lang-${lang.id}`} className="sr-only" />
                 <span className="text-2xl">{lang.flag}</span>
                 <div>
                   <p className="font-medium text-sm">{lang.name}</p>
                   <p className="text-xs text-muted-foreground">{lang.native}</p>
                 </div>
               </Label>
             ))}
           </RadioGroup>
 
           <Button
             className="w-full bg-gradient-to-r from-primary to-accent"
             onClick={saveLanguageAndProceed}
             disabled={loading}
           >
             {loading ? "Saving..." : "Continue"}
             <ArrowRight className="ml-2 h-4 w-4" />
           </Button>
 
           <div className="mt-4 p-3 bg-accent/10 rounded-lg">
             <p className="text-xs text-center text-muted-foreground">
               🌍 Building "The Africa We Want" — Aligned with AU Agenda 2063
             </p>
           </div>
         </Card>
       </div>
     );
   }
 
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      
      <Card className="relative w-full max-w-md border-border/50 bg-card/80 p-8 backdrop-blur-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 text-3xl font-bold">
            <Sparkles className="h-8 w-8 text-primary" />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Nyra
            </span>
          </div>
          <h1 className="mb-2 text-2xl font-bold">
            {isLogin ? "Welcome Back" : "Start Your Journey"}
          </h1>
          <p className="text-muted-foreground">
            {isLogin 
              ? "Sign in to continue building your courses" 
               : "Create your account — 2 free courses included!"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-border/50 bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-border/50 bg-background/50"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-accent"
            disabled={loading}
          >
             {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {isLogin 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"}
          </button>
        </div>
         
         {!isLogin && (
           <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
             <p className="text-xs text-center text-muted-foreground">
               ✨ <span className="font-medium">Free tier:</span> Create and publish up to 2 courses for free
             </p>
           </div>
         )}
      </Card>
    </div>
  );
};

export default Auth;