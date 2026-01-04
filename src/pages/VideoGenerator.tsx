import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Play, Video } from "lucide-react";
import { video1, video2, video3 } from "@/src/assers/videos"

const VideoGenerator = () => {
  const navigate = useNavigate();
  const videos = [video1, video2, video3];
  
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const getEmbedUrl = (url: string) => {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    
    // Direct video URL (mp4, webm, etc.)
    if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) return url;
    
    return url;
  };

  const isDirectVideo = (url: string) => {
    return url.match(/\.(mp4|webm|ogg)(\?.*)?$/i);
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
        {activeVideo && (
          <Card className="mb-8 overflow-hidden border-border/50">
            <div className="aspect-video bg-black">
              {isDirectVideo(videos.find(v => v.id === activeVideo)?.url || "") ? (
                <video
                  src={getEmbedUrl(videos.find(v => v.id === activeVideo)?.url || "")}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              ) : (
                <iframe
                  src={getEmbedUrl(videos.find(v => v.id === activeVideo)?.url || "")}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              )}
            </div>
            <div className="p-4 bg-card">
              <h3 className="text-lg font-semibold">
                {videos.find(v => v.id === activeVideo)?.title}
              </h3>
            </div>
          </Card>
        )}

        {/* Video Grid */}
        {videos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Card 
                key={video.id} 
                className={`overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
                  activeVideo === video.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setActiveVideo(video.id)}
              >
                <div className="aspect-video bg-muted flex items-center justify-center relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Play className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </div>
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
