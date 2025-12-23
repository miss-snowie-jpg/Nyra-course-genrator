import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, ArrowLeft, Video, Download, Play, Monitor, Loader2, History, Trash2, Image, Upload, X } from "lucide-react";
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

const ASPECT_RATIOS = [
  { id: "16:9", name: "Landscape (16:9)", icon: "🖥️", description: "Best for YouTube, presentations" },
  { id: "9:16", name: "Portrait (9:16)", icon: "📱", description: "Best for TikTok, Reels, Shorts" },
];

const VideoGenerator = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    prompt: "",
    aspectRatio: "16:9",
    provider: "client",
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
          aspect_ratio: formData.aspectRatio,
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImageToDataUrl = async (): Promise<string> => {
    if (!imageFile) throw new Error("No image selected");
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  };

  const promptToAnimationOptions = (prompt: string) => {
    const base = Math.max(4, Math.min(10, Math.floor(prompt.length / 40) + 4));
    const duration = base; // seconds
    const intensity = /fast|quick|energetic|dramatic/i.test(prompt) ? 0.18 : 0.08;
    return { duration, intensity };
  }

  const generateClientVideo = async (file: File, prompt: string, aspectRatio: string): Promise<Blob> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = (e) => resolve(e.target?.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });

    const { duration, intensity } = promptToAnimationOptions(prompt);
    const fps = 30;
    const width = aspectRatio === '9:16' ? 720 : 1280;
    const height = aspectRatio === '9:16' ? 1280 : 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');

    // capture stream
    const stream = (canvas as any).captureStream?.(fps) as MediaStream | undefined;
    if (!stream) throw new Error('Browser does not support canvas.captureStream');

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

    const stopPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });

    recorder.start();

    const start = performance.now();
    const end = start + duration * 1000;

    function drawFrame(now: number) {
      const t = Math.min(1, (now - start) / (duration * 1000));
      // ease in-out
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const scale = 1 + intensity * (0.5 - Math.abs(0.5 - ease)) * 2;
      const angle = (ease - 0.5) * 0.06; // subtle rotation
      const dx = (ease - 0.5) * width * 0.06;
      const dy = (ease - 0.5) * height * 0.03;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + dx, height / 2 + dy);
      ctx.rotate(angle);
      ctx.scale(scale, scale);

      // draw the image as cover
      const iw = img.width;
      const ih = img.height;
      const ir = iw / ih;
      const cr = width / height;
      let dw = width, dh = height;
      if (ir > cr) {
        dh = height;
        dw = height * ir;
      } else {
        dw = width;
        dh = width / ir;
      }
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();

      if (now < end) {
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
      }
    }

    requestAnimationFrame(drawFrame);
    const blob = await stopPromise;
    return blob;
  }

  const uploadBlobToStorageAndSaveHistory = async (blob: Blob): Promise<string> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fileName = `video-${Date.now()}.webm`;

      if (!session) {
        const localUrl = URL.createObjectURL(blob);
        await saveVideoToHistory(localUrl);
        return localUrl;
      }

      const path = `${session.user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('videos').upload(path, blob, { contentType: 'video/webm' });
      if (uploadError) {
        console.warn('Storage upload failed:', uploadError);
        const localUrl = URL.createObjectURL(blob);
        await saveVideoToHistory(localUrl);
        return localUrl;
      }

      const { data: publicData } = await supabase.storage.from('videos').getPublicUrl(path);
      const publicUrl = (publicData as any)?.publicUrl;
      if (publicUrl) {
        await saveVideoToHistory(publicUrl);
        return publicUrl;
      }

      const localUrl = URL.createObjectURL(blob);
      await saveVideoToHistory(localUrl);
      return localUrl;
    } catch (err) {
      console.error('Error uploading video blob:', err);
      const localUrl = URL.createObjectURL(blob);
      await saveVideoToHistory(localUrl);
      return localUrl;
    }
  };

  const handleGenerate = async () => {
    if (!formData.prompt.trim()) {
      toast.error("Please enter a video description");
      return;
    }

    if (!imageFile) {
      toast.error("Please upload an image to animate");
      return;
    }

    setLoading(true);
    setVideoUrl(null);
    setProgress(0);
    
    try {
      if (formData.provider === 'client') {
        toast.info('Generating video in your browser (no payment required)...')
        setUploadingImage(true);
        const blob = await generateClientVideo(imageFile, formData.prompt, formData.aspectRatio);
        setUploadingImage(false);
        setProgress(50);

        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setProgress(80);
        toast.success('Video generated locally! Saving...');

        await uploadBlobToStorageAndSaveHistory(blob);
        setProgress(100);
        toast.success('Video saved to history');
        setLoading(false);
        return;
      }

      // existing server-based flow (SkyReels / Fal)
      toast.info("Starting video generation with SkyReels V1... This may take a few minutes.");
      
      setUploadingImage(true);
      const imageDataUrl = await uploadImageToDataUrl();
      setUploadingImage(false);
      setProgress(5);

      const { data: startData, error: startError } = await supabase.functions.invoke('generate-video', {
        body: { 
          prompt: formData.prompt,
          image_url: imageDataUrl,
          aspect_ratio: formData.aspectRatio,
        }
      });

      if (startError) throw startError;
      if (!startData?.requestId) throw new Error("Failed to start video generation");

      const requestId = startData.requestId;
      setProgress(10);
      
      let attempts = 0;
      const maxAttempts = 120;
      
      const checkStatus = async (): Promise<void> => {
        attempts++;
        const estimatedProgress = Math.min(10 + (attempts / maxAttempts) * 85, 95);
        setProgress(estimatedProgress);
        
        const { data: statusData, error: statusError } = await supabase.functions.invoke('generate-video', {
          body: { requestId }
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
          setTimeout(checkStatus, 5000);
        } else {
          throw new Error("Video generation timed out");
        }
      };

      await checkStatus();
      
    } catch (error: any) {
      console.error('Video generation error:', error);
      const raw = error?.message || String(error) || "Failed to generate video";
      let friendly = "Failed to generate video";
      try {
        const parsed = JSON.parse(raw);
        if (parsed.error_code === 'config_error') {
          friendly = 'Server configuration error. Contact the site administrator.'
        } else if (parsed.error_code === 'internal_server_error') {
          friendly = parsed.error_id ? `Server error occurred (id: ${parsed.error_id}). Contact support.` : 'Server error occurred. Contact support.'
        } else if (parsed.error_code === 'provider_account_issue' || /provider_account_issue|provider|balance|account|billing|credit|quota/i.test(parsed.error || '')) {
          friendly = 'Video generation temporarily unavailable due to provider account issue. Try again later.'
        } else if (parsed.error) {
          friendly = parsed.error
        }
      } catch (_) {
        if (/provider_account_issue|provider|balance|account|billing|credit|quota/i.test(raw)) {
          friendly = "Video generation temporarily unavailable due to provider account issue. Try again later.";
        } else {
          friendly = raw;
        }
      }
      toast.error(friendly);
      setLoading(false);
      setProgress(0);
      setUploadingImage(false);
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
                  <p className="text-muted-foreground text-sm">{formData.provider === 'client' ? 'Rendered in browser (no-pay, limited quality)' : 'Powered by SkyReels V1 (Image-to-Video)'}</p>
                </div>

                {/* Image Upload */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    Source Image
                  </Label>
                  
                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border-2 border-primary/50 bg-muted/50">
                      <img 
                        src={imagePreview} 
                        alt="Selected image" 
                        className="w-full h-48 object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/20"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Click to upload an image</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 10MB</p>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>

                {/* Prompt Input */}
                <div className="space-y-2">
                  <Label htmlFor="prompt" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Animation Description
                  </Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe how you want the image to animate... E.g., 'The woman walks confidently down the street, her hair flowing in the wind'"
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    className="min-h-28 border-border/50 bg-background/50 resize-none"
                  />
                  <p className="text-xs text-muted-foreground">{formData.prompt.length} characters</p>
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
                    className="grid grid-cols-2 gap-3"
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

                {/* Provider */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-primary" />
                    Provider
                  </Label>
                  <RadioGroup
                    value={formData.provider}
                    onValueChange={(value) => setFormData({ ...formData, provider: value })}
                    className="grid grid-cols-2 gap-3"
                  >
                    <Label className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${formData.provider === 'client' ? 'border-primary bg-primary/10 shadow-lg' : 'border-border/50 bg-card/50 hover:border-primary/50'}`}>
                      <RadioGroupItem value="client" id="provider-client" className="sr-only" />
                      <span className="font-medium text-sm">Client (No-pay)</span>
                      <span className="text-xs text-muted-foreground text-center">Runs in the browser; unlimited, lower fidelity</span>
                    </Label>
                    <Label className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${formData.provider === 'fal' ? 'border-primary bg-primary/10 shadow-lg' : 'border-border/50 bg-card/50 hover:border-primary/50'}`}>
                      <RadioGroupItem value="fal" id="provider-fal" className="sr-only" />
                      <span className="font-medium text-sm">SkyReels (Fal)</span>
                      <span className="text-xs text-muted-foreground text-center">Higher fidelity cloud model (may have quotas)</span>
                    </Label>
                  </RadioGroup>
                </div>

                {/* Generate Button */}
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
                  onClick={handleGenerate}
                  disabled={loading || !formData.prompt.trim() || !imageFile}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {uploadingImage ? 'Uploading...' : `Generating... ${Math.round(progress)}%`}
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
                      {formData.provider === 'client' ? 'Rendering in your browser... This may take a few seconds.' : 'SkyReels is animating your image... This may take 1-3 minutes.'}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-6">
            <Card className="border-border/50 bg-card/80 p-6 backdrop-blur-sm">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Video Preview
                </h3>
                
                <div 
                  className={`relative rounded-xl overflow-hidden bg-muted/50 flex items-center justify-center ${
                    formData.aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[500px] mx-auto' : 'aspect-video'
                  }`}
                >
                  {videoUrl ? (
                    <video 
                      src={videoUrl} 
                      controls 
                      className="w-full h-full object-contain"
                      autoPlay
                    />
                  ) : (
                    <div className="text-center p-8">
                      <Video className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {loading ? "Generating your video..." : "Your generated video will appear here"}
                      </p>
                    </div>
                  )}
                </div>

                {videoUrl && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleDownload}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Video
                  </Button>
                )}
              </div>
            </Card>

            {/* Settings Summary */}
            <Card className="border-border/50 bg-card/80 p-4 backdrop-blur-sm">
              <h4 className="font-semibold mb-3 text-sm">Current Settings</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aspect Ratio</span>
                  <span>{formData.aspectRatio}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span>{formData.provider === 'client' ? 'Client (no-pay)' : formData.provider === 'fal' ? 'SkyReels V1' : formData.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Image</span>
                  <span>{imageFile ? '✓ Selected' : 'Not selected'}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Video History Section */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <History className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Video History</h2>
          </div>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : savedVideos.length === 0 ? (
            <Card className="border-border/50 bg-card/80 p-8 text-center backdrop-blur-sm">
              <Video className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No videos generated yet. Create your first video above!</p>
            </Card>
          ) : (
            <ScrollArea className="w-full">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {savedVideos.map((video) => (
                  <Card 
                    key={video.id} 
                    className="border-border/50 bg-card/80 overflow-hidden backdrop-blur-sm group hover:border-primary/50 transition-colors"
                  >
                    <div 
                      className={`relative bg-muted/50 cursor-pointer ${
                        video.aspect_ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'
                      }`}
                      onClick={() => playFromHistory(video)}
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-12 h-12 text-primary" />
                      </div>
                      <Video className="w-8 h-8 text-muted-foreground/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium truncate">{video.title}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(video.created_at).toLocaleDateString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteVideo(video.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </main>
    </div>
  );
};

export default VideoGenerator;
