import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

interface VideoThumbnailProps {
  videoUrl: string;
  alt: string;
  className?: string;
}

const VideoThumbnail = ({ videoUrl, alt, className = "" }: VideoThumbnailProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const captureFrame = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setThumbnail(dataUrl);
      setLoading(false);
    };

    const handleLoadedData = () => {
      // Seek to 1 second or 10% of the video, whichever is smaller
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    const handleSeeked = () => {
      captureFrame();
    };

    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("seeked", handleSeeked);

    return () => {
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [videoUrl]);

  return (
    <div className={`relative ${className}`}>
      {/* Hidden video element for thumbnail extraction */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="hidden"
        muted
        playsInline
        preload="metadata"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Thumbnail display */}
      {loading ? (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center animate-pulse">
          <Play className="h-12 w-12 text-white/50" />
        </div>
      ) : thumbnail ? (
        <img
          src={thumbnail}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Play className="h-12 w-12 text-white/80" />
        </div>
      )}

      {/* Play overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="rounded-full bg-white/90 p-3 shadow-lg transform group-hover:scale-110 transition-transform">
          <Play className="h-8 w-8 text-primary fill-primary" />
        </div>
      </div>
    </div>
  );
};

export default VideoThumbnail;
