import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Sparkles, ArrowLeft, Upload, Trash2, Video, Edit, Save, X, Plus, 
  GripVertical, Eye, EyeOff 
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

interface GalleryVideo {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  description: string | null;
  duration: number | null;
  aspect_ratio: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const AdminVideos = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const [videos, setVideos] = useState<GalleryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<GalleryVideo>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New video form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVideo, setNewVideo] = useState({
    title: "",
    description: "",
    video_url: "",
  });

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Access denied - Admin only");
      navigate('/dashboard');
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchVideos();
    }
  }, [isAdmin]);

  const fetchVideos = async () => {
    // Admin can see all videos including inactive ones via RLS policy
    const { data, error } = await supabase
      .from('gallery_videos')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching videos:', error);
      toast.error("Failed to fetch videos");
    } else {
      setVideos(data || []);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error("Please select a video file");
      return;
    }

    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('gallery-videos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('gallery-videos')
        .getPublicUrl(fileName);

      setNewVideo(prev => ({
        ...prev,
        video_url: publicUrl,
        title: prev.title || file.name.replace(/\.[^/.]+$/, "")
      }));
      
      toast.success("Video uploaded successfully");
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload video");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddVideo = async () => {
    if (!newVideo.title.trim() || !newVideo.video_url.trim()) {
      toast.error("Title and video URL are required");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('gallery_videos')
      .insert({
        title: newVideo.title.trim(),
        description: newVideo.description.trim() || null,
        video_url: newVideo.video_url.trim(),
        added_by: user?.id,
        sort_order: videos.length,
        is_active: true
      });

    if (error) {
      console.error('Error adding video:', error);
      toast.error("Failed to add video");
    } else {
      toast.success("Video added successfully");
      setNewVideo({ title: "", description: "", video_url: "" });
      setShowAddForm(false);
      fetchVideos();
    }
  };

  const handleDeleteVideo = async (video: GalleryVideo) => {
    const confirmed = window.confirm(`Delete "${video.title}"?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('gallery_videos')
      .delete()
      .eq('id', video.id);

    if (error) {
      toast.error("Failed to delete video");
    } else {
      setVideos(videos.filter(v => v.id !== video.id));
      toast.success("Video deleted");
    }
  };

  const handleToggleActive = async (video: GalleryVideo) => {
    const { error } = await supabase
      .from('gallery_videos')
      .update({ is_active: !video.is_active })
      .eq('id', video.id);

    if (error) {
      toast.error("Failed to update video");
    } else {
      setVideos(videos.map(v => 
        v.id === video.id ? { ...v, is_active: !v.is_active } : v
      ));
    }
  };

  const startEdit = (video: GalleryVideo) => {
    setEditingId(video.id);
    setEditForm({
      title: video.title,
      description: video.description || "",
      video_url: video.video_url
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const { error } = await supabase
      .from('gallery_videos')
      .update({
        title: editForm.title,
        description: editForm.description || null,
        video_url: editForm.video_url
      })
      .eq('id', editingId);

    if (error) {
      toast.error("Failed to update video");
    } else {
      setVideos(videos.map(v => 
        v.id === editingId ? { ...v, ...editForm } : v
      ));
      setEditingId(null);
      toast.success("Video updated");
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Sparkles className="mx-auto mb-4 h-12 w-12 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Video className="h-6 w-6 text-primary" />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Admin: Video Gallery
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Add New Video */}
        <Card className="mb-8 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Add New Video</h2>
            <Button 
              variant={showAddForm ? "outline" : "default"}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {showAddForm ? "Cancel" : "Add Video"}
            </Button>
          </div>

          {showAddForm && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={newVideo.title}
                    onChange={(e) => setNewVideo(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Video title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Video URL *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newVideo.video_url}
                      onChange={(e) => setNewVideo(prev => ({ ...prev, video_url: e.target.value }))}
                      placeholder="https://... or upload"
                      className="flex-1"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newVideo.description}
                  onChange={(e) => setNewVideo(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>
              {newVideo.video_url && (
                <div className="rounded-lg border p-2">
                  <video 
                    src={newVideo.video_url} 
                    className="max-h-48 rounded"
                    controls
                  />
                </div>
              )}
              <Button onClick={handleAddVideo} disabled={!newVideo.title || !newVideo.video_url}>
                <Save className="mr-2 h-4 w-4" />
                Save Video
              </Button>
            </div>
          )}
        </Card>

        {/* Video List */}
        <h2 className="text-xl font-bold mb-4">Gallery Videos ({videos.length})</h2>
        
        {videos.length === 0 ? (
          <Card className="p-8 text-center">
            <Video className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No videos in the gallery yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {videos.map((video) => (
              <Card key={video.id} className={`p-4 ${!video.is_active ? 'opacity-50' : ''}`}>
                {editingId === video.id ? (
                  <div className="space-y-3">
                    <Input
                      value={editForm.title || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Title"
                    />
                    <Input
                      value={editForm.video_url || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, video_url: e.target.value }))}
                      placeholder="Video URL"
                    />
                    <Textarea
                      value={editForm.description || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit}>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    
                    <div className="w-32 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                      <video 
                        src={video.video_url} 
                        className="w-full h-full object-cover"
                        muted
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{video.title}</h3>
                      {video.description && (
                        <p className="text-sm text-muted-foreground truncate">{video.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Added {new Date(video.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleToggleActive(video)}
                        title={video.is_active ? "Hide from gallery" : "Show in gallery"}
                      >
                        {video.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => startEdit(video)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-destructive"
                        onClick={() => handleDeleteVideo(video)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminVideos;
