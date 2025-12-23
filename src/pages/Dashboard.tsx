import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Plus, BookOpen, TrendingUp, DollarSign, LogOut, Video } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
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

  const stats = [
    { icon: BookOpen, label: "Courses Created", value: "0", color: "text-primary" },
    { icon: TrendingUp, label: "Total Views", value: "0", color: "text-accent" },
    { icon: DollarSign, label: "Revenue", value: "$0", color: "text-green-500" },
  ];

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
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">Welcome back!</h1>
          <p className="text-xl text-muted-foreground">Ready to create something amazing?</p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-3">
          {stats.map((stat, index) => (
            <Card key={index} className="border-border/50 bg-gradient-to-br from-card to-card/50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`rounded-2xl bg-primary/10 p-3 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Create Content CTAs */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-8 text-center">
            <div className="mx-auto max-w-xl">
              <Sparkles className="mx-auto mb-4 h-12 w-12 text-primary" />
              <h2 className="mb-4 text-2xl font-bold">Create Course</h2>
              <p className="mb-6 text-muted-foreground">
                Let Nyra guide you through creating an engaging, professional course in minutes.
              </p>
              <Button 
                size="lg" 
                className="w-full bg-gradient-to-r from-primary to-accent"
                onClick={() => navigate('/wizard')}
              >
                <Plus className="mr-2 h-5 w-5" />
                Start Course Wizard
              </Button>
            </div>
          </Card>

          <Card className="border-accent/30 bg-gradient-to-br from-accent/10 via-card to-primary/10 p-8 text-center">
            <div className="mx-auto max-w-xl">
              <Video className="mx-auto mb-4 h-12 w-12 text-accent" />
              <h2 className="mb-4 text-2xl font-bold">Ad Videos</h2>
              <p className="mb-6 text-muted-foreground">
                Browse curated ad videos tailored for course sellers.
              </p>
              <Button 
                size="lg" 
                className="w-full bg-gradient-to-r from-accent to-primary"
                onClick={() => navigate('/ad-videos')}
              >
                <Video className="mr-2 h-5 w-5" />
                Ad Videos
              </Button>
            </div>
          </Card>
        </div>

        {/* Trial Notice */}
        <div className="mt-6 rounded-lg border border-accent/30 bg-accent/5 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            🎉 <strong>Free Trial Active</strong> - You have 3 days to create and edit courses. 
            Publish and monetize after upgrading to a paid plan.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;