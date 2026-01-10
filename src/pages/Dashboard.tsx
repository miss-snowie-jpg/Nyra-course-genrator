import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, BookOpen, TrendingUp, DollarSign, LogOut, Video, CheckCircle, Clock, ExternalLink, Trash2, Settings, Share2, Crown } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Course {
  id: string;
  title: string;
  description: string | null;
  topic: string;
  website_status: string | null;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();
  const { subscription, hasSubscription, hasAutoPoster, loading: subscriptionLoading } = useSubscription();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    const checkAuthAndSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }
      
      setUser(session.user);
      
      // Check if user is admin
      const { data: adminData } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });
      
      if (!adminData) {
        // Check for active subscription
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .single();
        
        if (!sub) {
          // No subscription, redirect to pricing
          navigate('/pricing');
          return;
        }
      }
      
      fetchCourses(session.user.id);
      setLoading(false);
    };

    checkAuthAndSubscription();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    return () => authSub.unsubscribe();
  }, [navigate]);

  const fetchCourses = async (userId: string) => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description, topic, website_status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCourses(data);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
  };

  const handleDeleteCourse = async (courseId: string, courseTitle: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${courseTitle}"?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (error) {
      toast.error("Failed to delete course");
    } else {
      setCourses(courses.filter(c => c.id !== courseId));
      toast.success("Course deleted successfully");
    }
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

  const paidCourses = courses.filter(c => c.website_status === 'paid');
  const pendingCourses = courses.filter(c => c.website_status !== 'paid');

  const stats = [
    { icon: BookOpen, label: "Courses Created", value: courses.length.toString(), color: "text-primary" },
    { icon: TrendingUp, label: "Published", value: paidCourses.length.toString(), color: "text-accent" },
    { icon: DollarSign, label: "Revenue", value: `$${paidCourses.length * 40}`, color: "text-green-500" },
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
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/videos')}>
                <Settings className="mr-2 h-4 w-4" />
                Admin
              </Button>
            )}
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

        {/* My Courses Section */}
        {courses.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">My Courses</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <Card key={course.id} className="border-border/50 bg-card p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg line-clamp-1">{course.title}</h3>
                    {course.website_status === 'paid' ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                        <Clock className="w-3 h-3 mr-1" />
                        Draft
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {course.description || course.topic}
                  </p>
                  <div className="flex gap-2">
                    {course.website_status === 'paid' ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => navigate(`/course/${course.id}`)}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View Site
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        className="flex-1 bg-gradient-to-r from-primary to-accent"
                        onClick={() => navigate('/wizard')}
                      >
                        Continue Editing
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleDeleteCourse(course.id, course.title)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Create Content CTAs */}
        <div className={`grid gap-6 ${hasAutoPoster ? 'md:grid-cols-3' : 'md:grid-cols-2'} mb-6`}>
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
              <h2 className="mb-4 text-2xl font-bold">Generate Video</h2>
              <p className="mb-6 text-muted-foreground">
                Create AI-powered videos from your images.
              </p>
              <Button 
                size="lg" 
                className="w-full bg-gradient-to-r from-accent to-primary"
                onClick={() => navigate('/video-generator')}
              >
                <Video className="mr-2 h-5 w-5" />
                Video Generator
              </Button>
            </div>
          </Card>

          {/* Auto Poster Card - Only for yearly subscribers */}
          {hasAutoPoster && (
            <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-card to-orange-500/10 p-8 text-center relative overflow-hidden">
              <Badge className="absolute top-4 right-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                <Crown className="mr-1 h-3 w-3" />
                Yearly
              </Badge>
              <div className="mx-auto max-w-xl">
                <Share2 className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                <h2 className="mb-4 text-2xl font-bold">Auto Poster</h2>
                <p className="mb-6 text-muted-foreground">
                  Automatically post ads from our library to your social media.
                </p>
                <Button 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500"
                  onClick={() => navigate('/auto-poster')}
                >
                  <Share2 className="mr-2 h-5 w-5" />
                  Manage Auto Poster
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Subscription Badge */}
        {subscription && (
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {subscription.plan === 'yearly' ? (
                <>🌟 <strong>Yearly Subscriber</strong> - You have access to all premium features including Auto Poster!</>
              ) : (
                <>✨ <strong>Monthly Subscriber</strong> - Upgrade to yearly to unlock Auto Poster and save $91.89/year!</>
              )}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;