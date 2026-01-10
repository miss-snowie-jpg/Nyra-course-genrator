import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Sparkles, ArrowLeft, Plus, Trash2, Play, Pause, 
  Instagram, Youtube, Facebook, Twitter, Clock,
  Share2, Crown
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

interface GalleryVideo {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
}

interface AutoPosterJob {
  id: string;
  video_id: string;
  platform: string;
  schedule_type: string;
  is_active: boolean;
  last_posted_at: string | null;
  next_post_at: string | null;
  video?: GalleryVideo;
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  twitter: Twitter,
  tiktok: Share2,
};

const platformColors: Record<string, string> = {
  instagram: "text-pink-500",
  youtube: "text-red-500",
  facebook: "text-blue-500",
  twitter: "text-sky-500",
  tiktok: "text-foreground",
};

const AutoPoster = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [jobs, setJobs] = useState<AutoPosterJob[]>([]);
  const [galleryVideos, setGalleryVideos] = useState<GalleryVideo[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newJob, setNewJob] = useState({
    video_id: "",
    platform: "instagram",
    schedule_type: "daily",
  });

  useEffect(() => {
    checkAccessAndFetchData();
  }, []);

  const checkAccessAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: session.user.id,
      _role: 'admin'
    });

    if (isAdmin) {
      setHasAccess(true);
    } else {
      // Check for yearly subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('plan', 'yearly')
        .eq('status', 'active')
        .single();

      if (!subscription) {
        setHasAccess(false);
        setLoading(false);
        return;
      }
      setHasAccess(true);
    }

    // Fetch gallery videos
    const { data: videos } = await supabase
      .from('gallery_videos')
      .select('id, title, video_url, thumbnail_url')
      .eq('is_active', true)
      .order('sort_order');

    if (videos) {
      setGalleryVideos(videos);
    }

    // Fetch user's auto poster jobs
    const { data: userJobs } = await supabase
      .from('auto_poster_jobs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (userJobs) {
      // Attach video info to jobs
      const jobsWithVideos = userJobs.map(job => ({
        ...job,
        video: videos?.find(v => v.id === job.video_id)
      }));
      setJobs(jobsWithVideos);
    }

    setLoading(false);
  };

  const handleCreateJob = async () => {
    if (!newJob.video_id) {
      toast.error("Please select a video");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const nextPostAt = new Date();
    switch (newJob.schedule_type) {
      case 'hourly':
        nextPostAt.setHours(nextPostAt.getHours() + 1);
        break;
      case 'daily':
        nextPostAt.setDate(nextPostAt.getDate() + 1);
        break;
      case 'weekly':
        nextPostAt.setDate(nextPostAt.getDate() + 7);
        break;
    }

    const { data, error } = await supabase
      .from('auto_poster_jobs')
      .insert({
        user_id: session.user.id,
        video_id: newJob.video_id,
        platform: newJob.platform,
        schedule_type: newJob.schedule_type,
        next_post_at: nextPostAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create auto poster job");
      return;
    }

    const video = galleryVideos.find(v => v.id === newJob.video_id);
    setJobs([{ ...data, video }, ...jobs]);
    setShowAddForm(false);
    setNewJob({ video_id: "", platform: "instagram", schedule_type: "daily" });
    toast.success("Auto poster job created!");
  };

  const handleToggleJob = async (jobId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('auto_poster_jobs')
      .update({ is_active: !isActive })
      .eq('id', jobId);

    if (error) {
      toast.error("Failed to update job");
      return;
    }

    setJobs(jobs.map(job => 
      job.id === jobId ? { ...job, is_active: !isActive } : job
    ));
    toast.success(isActive ? "Job paused" : "Job activated");
  };

  const handleDeleteJob = async (jobId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this auto poster job?");
    if (!confirmed) return;

    const { error } = await supabase
      .from('auto_poster_jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      toast.error("Failed to delete job");
      return;
    }

    setJobs(jobs.filter(job => job.id !== jobId));
    toast.success("Job deleted");
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

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-between px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <main className="container mx-auto px-4 py-20 text-center">
          <Crown className="mx-auto mb-6 h-16 w-16 text-primary" />
          <h1 className="mb-4 text-3xl font-bold">Auto Poster is a Yearly Feature</h1>
          <p className="mb-8 text-xl text-muted-foreground max-w-md mx-auto">
            Upgrade to our yearly plan to automatically post ads from our library to your social media accounts.
          </p>
          <Button 
            size="lg"
            className="bg-gradient-to-r from-primary to-accent"
            onClick={() => navigate('/pricing')}
          >
            Upgrade to Yearly
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <Badge className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
              <Crown className="mr-1 h-3 w-3" />
              Yearly Feature
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Auto Poster</h1>
            <p className="text-muted-foreground">Automatically post ads to your social media</p>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        </div>

        {/* Add New Job Form */}
        {showAddForm && (
          <Card className="mb-8 border-primary/30 bg-gradient-to-br from-primary/5 to-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Create New Auto Poster Job</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Video from Library</label>
                <Select value={newJob.video_id} onValueChange={(v) => setNewJob({ ...newJob, video_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a video" />
                  </SelectTrigger>
                  <SelectContent>
                    {galleryVideos.map((video) => (
                      <SelectItem key={video.id} value={video.id}>
                        {video.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Platform</label>
                <Select value={newJob.platform} onValueChange={(v) => setNewJob({ ...newJob, platform: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Schedule</label>
                <Select value={newJob.schedule_type} onValueChange={(v) => setNewJob({ ...newJob, schedule_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Every Hour</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={handleCreateJob}>
                  Create Job
                </Button>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Note: You'll need to connect your social media accounts in Settings to enable actual posting.
            </p>
          </Card>
        )}

        {/* Jobs List */}
        {jobs.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50 bg-card/50 p-12 text-center">
            <Share2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-xl font-semibold">No Auto Poster Jobs Yet</h3>
            <p className="mb-6 text-muted-foreground">
              Create your first job to start automatically posting ads to social media.
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Job
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => {
              const PlatformIcon = platformIcons[job.platform] || Share2;
              return (
                <Card key={job.id} className="border-border/50 bg-card p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg bg-muted p-2 ${platformColors[job.platform]}`}>
                        <PlatformIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium capitalize">{job.platform}</p>
                        <p className="text-sm text-muted-foreground capitalize">{job.schedule_type}</p>
                      </div>
                    </div>
                    <Switch 
                      checked={job.is_active} 
                      onCheckedChange={() => handleToggleJob(job.id, job.is_active)}
                    />
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium line-clamp-1">{job.video?.title || 'Unknown Video'}</p>
                    {job.video?.thumbnail_url && (
                      <img 
                        src={job.video.thumbnail_url} 
                        alt={job.video.title}
                        className="mt-2 h-24 w-full rounded-lg object-cover"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {job.next_post_at 
                          ? `Next: ${new Date(job.next_post_at).toLocaleDateString()}`
                          : 'Not scheduled'
                        }
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {job.is_active ? (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          <Play className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Pause className="mr-1 h-3 w-3" />
                          Paused
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4 w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleDeleteJob(job.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AutoPoster;
