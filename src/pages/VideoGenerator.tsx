import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sparkles, ArrowLeft, Video, Download, Play, User, Volume2, Monitor, Clock, Loader2, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SavedVideo {
  id: string;
  title: string;
  prompt: string;
  video_url: string;
  avatar_id: string | null;
  voice_id: string | null;
  aspect_ratio: string | null;
  duration: number | null;
  created_at: string;
}

const AVATARS = [
  { id: "josh_lite3_20230714", name: "Josh", preview: "Professional Male" },
  { id: "anna_lite3_20230714", name: "Anna", preview: "Professional Female" },
  { id: "angela_lite3_20230714", name: "Angela", preview: "Friendly Female" },
  { id: "wayne_lite3_20230714", name: "Wayne", preview: "Casual Male" },
  { id: "monica_lite3_20230714", name: "Monica", preview: "Elegant Female" },
  { id: "tyler_lite3_20230714", name: "Tyler", preview: "Young Male" },
];

const VOICES = [
  { id: "en-US-AriaNeural", name: "Aria", language: "English (US)", gender: "Female" },
  { id: "en-US-GuyNeural", name: "Guy", language: "English (US)", gender: "Male" },
  { id: "en-GB-SoniaNeural", name: "Sonia", language: "English (UK)", gender: "Female" },
  { id: "en-GB-RyanNeural", name: "Ryan", language: "English (UK)", gender: "Male" },
  { id: "es-ES-ElviraNeural", name: "Elvira", language: "Spanish", gender: "Female" },
  { id: "fr-FR-DeniseNeural", name: "Denise", language: "French", gender: "Female" },
];

const ASPECT_RATIOS = [
  { id: "16:9", name: "Landscape (16:9)", icon: "🖥️", description: "Best for YouTube, presentations" },
  { id: "9:16", name: "Portrait (9:16)", icon: "📱", description: "Best for TikTok, Reels, Shorts" },
  { id: "1:1", name: "Square (1:1)", icon: "⬛", description: "Best for Instagram, social posts" },
];

const VideoGenerator = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [formData, setFormData] = useState({
    prompt: "",
    avatar: "josh_lite3_20230714",
    voice: "en-US-AriaNeural",
    aspectRatio: "16:9",
    duration: 30,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        fetchVideoHistory();
      }
    });
  }, [navigate]);

  const fetchVideoHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedVideos(data || []);
    } catch (error) {
      console.error('Error fetching video history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const saveVideoToHistory = async (videoUrl: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const title = formData.prompt.slice(0, 50) + (formData.prompt.length > 50 ? '...' : '');
      
      const { error } = await supabase
        .from('videos')
        .insert({
          user_id: session.user.id,
          title,
          prompt: formData.prompt,
          video_url: videoUrl,
          avatar_id: formData.avatar,
          voice_id: formData.voice,
          aspect_ratio: formData.aspectRatio,
          duration: formData.duration,
        });

      if (error) throw error;
      fetchVideoHistory();
    } catch (error) {
      console.error('Error saving video:', error);
    }
  };

  const deleteVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;
      toast.success("Video deleted");
      fetchVideoHistory();
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error("Failed to delete video");
    }
  };

  const playFromHistory = (video: SavedVideo) => {
    setVideoUrl(video.video_url);
    if (video.aspect_ratio) {
      setFormData(prev => ({ ...prev, aspectRatio: video.aspect_ratio! }));
    }
    toast.success("Playing video from history");
  };

  const handleGenerate = async () => {
    if (!formData.prompt.trim()) {
      toast.error("Please enter a video description");
      return;
    }

    setLoading(true);
    setVideoUrl(null);
    setProgress(0);
    
    try {
      toast.info("Starting video generation... This may take a few minutes.");
      
      const { data: startData, error: startError } = await supabase.functions.invoke('generate-video', {
        body: { 
          prompt: formData.prompt,
          avatar_id: formData.avatar,
          voice_id: formData.voice,
          aspect_ratio: formData.aspectRatio,
          duration: formData.duration,
        }
      });

      if (startError) throw startError;
      if (!startData?.videoId) throw new Error("Failed to start video generation");

      const videoId = startData.videoId;
      setProgress(10); // Initial progress after generation started
      
      let attempts = 0;
      const maxAttempts = 60;
      
      const checkStatus = async (): Promise<void> => {
        attempts++;
        // Update progress: start at 10%, go up to 95%
        const estimatedProgress = Math.min(10 + (attempts / maxAttempts) * 85, 95);
        setProgress(estimatedProgress);
        
        const { data: statusData, error: statusError } = await supabase.functions.invoke('generate-video', {
          body: { videoId }
        });

        if (statusError) throw statusError;

        console.log('Video status:', statusData);

        if (statusData.status === 'completed') {
          const generatedVideoUrl = statusData.video_url;
          if (generatedVideoUrl) {
            setVideoUrl(generatedVideoUrl);
            setProgress(100);
            toast.success("Video generated successfully!");
            await saveVideoToHistory(generatedVideoUrl);
            setLoading(false);
          } else {
            throw new Error("No video URL in response");
          }
        } else if (statusData.status === 'failed' || statusData.error) {
          throw new Error(statusData.error || "Video generation failed");
        } else if (attempts < maxAttempts) {
          // Poll every 3 seconds for faster feedback
          setTimeout(checkStatus, 3000);
        } else {
          throw new Error("Video generation timed out");
        }
      };

      await checkStatus();
      
    } catch (error: any) {
      console.error('Video generation error:', error);
      toast.error(error.message || "Failed to generate video");
      setLoading(false);
      setProgress(0);
    }
  };

  const handleDownload = async () => {
    if (!videoUrl) return;
    
    try {
      toast.info("Starting download...");
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Video downloaded!");
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download video");
    }
  };

  const selectedAvatar = AVATARS.find(a => a.id === formData.avatar);
  const selectedVoice = VOICES.find(v => v.id === formData.voice);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Video Generator
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            <Card className="border-border/50 bg-card/80 p-6 backdrop-blur-sm">
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent mb-3">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">Create AI Video</h2>
                  <p className="text-muted-foreground text-sm">Powered by HeyGen</p>
                </div>

                {/* Script Input */}
                <div className="space-y-2">
                  <Label htmlFor="prompt" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Video Script
                  </Label>
                  <Textarea
                    id="prompt"
                    placeholder="Enter your video script here... The avatar will speak this text."
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    className="min-h-28 border-border/50 bg-background/50 resize-none"
                  />
                  <p className="text-xs text-muted-foreground">{formData.prompt.length} characters</p>
                </div>

                {/* Avatar Selection */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Select Avatar
                  </Label>
                  <RadioGroup
                    value={formData.avatar}
                    onValueChange={(value) => setFormData({ ...formData, avatar: value })}
                    className="grid grid-cols-3 gap-3"
                  >
                    {AVATARS.map((avatar) => (
                      <Label
                        key={avatar.id}
                        htmlFor={avatar.id}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${
                          formData.avatar === avatar.id 
                            ? 'border-primary bg-primary/10 shadow-lg' 
                            : 'border-border/50 bg-card/50 hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={avatar.id} id={avatar.id} className="sr-only" />
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-medium text-sm">{avatar.name}</span>
                        <span className="text-xs text-muted-foreground text-center">{avatar.preview}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                {/* Voice Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-primary" />
                    Voice
                  </Label>
                  <Select value={formData.voice} onValueChange={(value) => setFormData({ ...formData, voice: value })}>
                    <SelectTrigger className="border-border/50 bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICES.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{voice.name}</span>
                            <span className="text-muted-foreground text-xs">({voice.language} - {voice.gender})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-primary" />
                    Aspect Ratio
                  </Label>
                  <RadioGroup
                    value={formData.aspectRatio}
                    onValueChange={(value) => setFormData({ ...formData, aspectRatio: value })}
                    className="grid grid-cols-3 gap-3"
                  >
                    {ASPECT_RATIOS.map((ratio) => (
                      <Label
                        key={ratio.id}
                        htmlFor={`ratio-${ratio.id}`}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${
                          formData.aspectRatio === ratio.id 
                            ? 'border-primary bg-primary/10 shadow-lg' 
                            : 'border-border/50 bg-card/50 hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={ratio.id} id={`ratio-${ratio.id}`} className="sr-only" />
                        <span className="text-2xl">{ratio.icon}</span>
                        <span className="font-medium text-sm">{ratio.id}</span>
                        <span className="text-xs text-muted-foreground text-center">{ratio.description}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                {/* Duration Slider */}
                <div className="space-y-4">
                  <Label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Duration
                    </span>
                    <span className="text-primary font-bold">{formData.duration}s</span>
                  </Label>
                  <Slider
                    value={[formData.duration]}
                    onValueChange={(value) => setFormData({ ...formData, duration: value[0] })}
                    min={10}
                    max={120}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10s</span>
                    <span>60s</span>
                    <span>120s</span>
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                  onClick={handleGenerate}
                  disabled={loading || !formData.prompt.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating... {Math.round(progress)}%
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Video
                    </>
                  )}
                </Button>

                {/* Progress Bar */}
                {loading && (
                  <div className="space-y-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      This may take 2-5 minutes depending on video length
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column - Preview Area */}
          <div className="space-y-6">
            <Card className="border-border/50 bg-card/80 p-6 backdrop-blur-sm">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Video Preview
                </h3>

                {/* Video Player Area */}
                <div 
                  className={`relative rounded-xl overflow-hidden bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center ${
                    formData.aspectRatio === '16:9' ? 'aspect-video' : 
                    formData.aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[500px]' : 
                    'aspect-square'
                  }`}
                >
                  {videoUrl ? (
                    <video 
                      src={videoUrl} 
                      controls 
                      className="w-full h-full object-contain bg-black rounded-xl"
                      poster=""
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-muted-foreground p-8">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Video className="w-10 h-10 text-primary/50" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium">No video yet</p>
                        <p className="text-sm">Your generated video will appear here</p>
                      </div>
                    </div>
                  )}

                  {/* Loading Overlay */}
                  {loading && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                        <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium">Generating your video...</p>
                        <p className="text-sm text-muted-foreground">{Math.round(progress)}% complete</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Download Button */}
                {videoUrl && (
                  <Button 
                    size="lg"
                    variant="outline" 
                    className="w-full border-primary/50 hover:bg-primary/10"
                    onClick={handleDownload}
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Download Video
                  </Button>
                )}

                {/* Current Settings Summary */}
                <div className="rounded-xl bg-muted/30 p-4 space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">Current Settings</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <span>{selectedAvatar?.name || 'None'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-primary" />
                      <span>{selectedVoice?.name || 'None'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-primary" />
                      <span>{formData.aspectRatio}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>{formData.duration}s</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Video History Section */}
        <Card className="mt-8 border-border/50 bg-card/80 p-6 backdrop-blur-sm">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Video History
              <span className="text-sm font-normal text-muted-foreground">
                ({savedVideos.length} video{savedVideos.length !== 1 ? 's' : ''})
              </span>
            </h3>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : savedVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Video className="h-12 w-12 mb-3 opacity-50" />
                <p className="font-medium">No videos yet</p>
                <p className="text-sm">Your generated videos will appear here</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pr-4">
                  {savedVideos.map((video) => {
                    const avatarInfo = AVATARS.find(a => a.id === video.avatar_id);
                    const voiceInfo = VOICES.find(v => v.id === video.voice_id);
                    
                    return (
                      <div 
                        key={video.id}
                        className="group relative rounded-xl border border-border/50 bg-card/50 overflow-hidden hover:border-primary/50 transition-all"
                      >
                        {/* Video Thumbnail */}
                        <div className="aspect-video bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                          <video 
                            src={video.video_url} 
                            className="w-full h-full object-cover"
                            preload="metadata"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-2"
                              onClick={() => playFromHistory(video)}
                            >
                              <Play className="h-4 w-4" />
                              Play
                            </Button>
                          </div>
                        </div>
                        
                        {/* Video Info */}
                        <div className="p-3 space-y-2">
                          <p className="font-medium text-sm line-clamp-2" title={video.prompt}>
                            {video.title}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{avatarInfo?.name || 'Unknown'}</span>
                            </div>
                            <span>{video.aspect_ratio || '16:9'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {new Date(video.created_at).toLocaleDateString()}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteVideo(video.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default VideoGenerator;
