-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: Only admins can manage roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create gallery_videos table for admin-managed video gallery
CREATE TABLE public.gallery_videos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    video_url text NOT NULL,
    thumbnail_url text,
    description text,
    duration integer,
    aspect_ratio text DEFAULT '16:9',
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    added_by uuid REFERENCES auth.users(id)
);

-- Enable RLS on gallery_videos
ALTER TABLE public.gallery_videos ENABLE ROW LEVEL SECURITY;

-- RLS: Everyone can view active gallery videos
CREATE POLICY "Anyone can view active gallery videos"
ON public.gallery_videos
FOR SELECT
USING (is_active = true);

-- RLS: Only admins can manage gallery videos
CREATE POLICY "Admins can manage gallery videos"
ON public.gallery_videos
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_gallery_videos_updated_at
BEFORE UPDATE ON public.gallery_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for gallery videos
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery-videos', 'gallery-videos', true);

-- Storage policies for gallery videos bucket
CREATE POLICY "Public can view gallery videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'gallery-videos');

CREATE POLICY "Admins can upload gallery videos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'gallery-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update gallery videos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'gallery-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gallery videos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'gallery-videos' AND public.has_role(auth.uid(), 'admin'));