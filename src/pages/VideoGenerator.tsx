import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Video, X, Loader2 } from "lucide-react";
import VideoThumbnail from "@/components/VideoThumbnail";
import { supabase } from "@/integrations/supabase/client";

interface GalleryVideo {
  id: string;
  url: string;
  title: string;
}

const VideoGenerator = () => {
  const navigate = useNavigate();
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9);
  const [videos, setVideos] = useState<GalleryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      const { data, error } = await supabase
        .from('gallery_videos')
        .select('id, title, video_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setVideos(data.map(v => ({
          id: v.id,
          url: v.video_url,
          title: v.title,
        })));
      }
      setLoading(false);
    };

    fetchVideos();
  }, []);

  const activeVideoData = videos.find(v => v.id === activeVideo);

  // Handle video metadata to get aspect ratio
  const handleVideoLoaded = () => {
    if (videoPlayerRef.current) {
      const { videoWidth, videoHeight } = videoPlayerRef.current;
      if (videoWidth && videoHeight) {
        setVideoAspectRatio(videoWidth / videoHeight);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Video className="h-6 w-6 text-primary" />
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Video Gallery
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        {/* Active Video Player */}
        {activeVideo && activeVideoData && (
          <Card className="mb-8 overflow-hidden border-border/50">
            <div 
              className="relative bg-black flex items-center justify-center"
              style={{ 
                maxHeight: '70vh',
              }}
            >
              <video
                ref={videoPlayerRef}
                src={activeVideoData.url}
                controls
                autoPlay
                onLoadedMetadata={handleVideoLoaded}
                className="max-w-full max-h-[70vh] w-auto h-auto"
                style={{
                  aspectRatio: videoAspectRatio,
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setActiveVideo(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4 bg-card">
              <h3 className="text-lg font-semibold">
                {activeVideoData.title}
              </h3>
            </div>
          </Card>
        )}

        {/* Video Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Card 
                key={video.id} 
                className={`overflow-hidden cursor-pointer transition-all hover:shadow-lg group ${
                  activeVideo === video.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setActiveVideo(video.id)}
              >
                <div className="aspect-video bg-muted relative">
                  <VideoThumbnail
                    videoUrl={video.url}
                    alt={video.title}
                    className="w-full h-full"
                  />
                </div>
                <div className="p-4">
                  <h4 className="font-medium truncate">{video.title}</h4>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed border-2 border-border/50">
            <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No videos yet</h3>
            <p className="text-muted-foreground">
              Add video URLs above to start building your gallery
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default VideoGenerator;
