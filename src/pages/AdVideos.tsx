import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

type Video = {
  id: string;
  title: string;
  description: string;
  category?: string;
};

const videos: Video[] = [
  { id: "dQw4w9WgXcQ", title: "Course Promo Sample 1", description: "Short ad style course promo", category: "General" },
  { id: "3JZ_D3ELwOQ", title: "Course Promo Sample 2", description: "High-energy ad", category: "General" },
  { id: "l9nh1l8ZIJQ", title: "Course Promo Sample 3", description: "Narrative-driven teaser", category: "General" },
  { id: "L_jWHffIx5E", title: "Course Promo Sample 4", description: "Testimonial style ad", category: "General" },
  { id: "eY52Zsg-KVI", title: "Course Promo Sample 5", description: "Minimal text ad", category: "General" },
  { id: "V-_O7nl0Ii0", title: "Course Promo Sample 6", description: "Animated explainer ad", category: "Explainer" },
  { id: "kXYiU_JCYtU", title: "Course Promo Sample 7", description: "Bold headline ad", category: "General" },
  { id: "9bZkp7q19f0", title: "Rich Lifestyle Montage", description: "Fast-paced lifestyle montage with luxury visuals", category: "Lifestyle" },
  { id: "RgKAFK5djSk", title: "Stylish Lifestyle Ad", description: "A lifestyle-focused ad with premium vibes", category: "Lifestyle" },
  { id: "60ItHLz5WEA", title: "Aspirational Travel Ad", description: "Adventure and high-end travel visuals", category: "Lifestyle" },
  { id: "hT_nvWreIhg", title: "Emotional Story Promo", description: "Emotional story ad", category: "General" },
  { id: "fJ9rUzIMcZQ", title: "Cinematic Promo", description: "Cinematic course promo", category: "General" },
  // Additional rich/lifestyle-focused entries
  { id: "V-_O7nl0Ii0", title: "Rich Lifestyle Promo 1", description: "Luxury product and lifestyle montage", category: "Lifestyle" },
  { id: "kXYiU_JCYtU", title: "Rich Lifestyle Promo 2", description: "Premium lifestyle shots and aspirational voiceover", category: "Lifestyle" },
  { id: "eY52Zsg-KVI", title: "Rich Lifestyle Promo 3", description: "Minimal, elegant ad focusing on lifestyle benefits", category: "Lifestyle" },
];

const AdVideos = () => {
  const [category, setCategory] = useState<string>("All");

  const categories = useMemo(() => {
    const cats = new Set<string>();
    videos.forEach((v) => cats.add(v.category ?? "General"));
    return ["All", ...Array.from(cats)];
  }, []);

  const filtered = useMemo(() => {
    if (category === "All") return videos;
    return videos.filter((v) => (v.category ?? "General") === category);
  }, [category]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold">Ad Video Library</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <p className="mb-6 text-muted-foreground">Curated collection of ad-style videos suitable for promoting courses. Use the filters to show Lifestyle-focused videos tailored for course sellers.</p>

        <div className="mb-6 flex gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-sm ${category === c ? 'bg-primary text-white' : 'bg-muted/10 text-muted-foreground'}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <Card key={`${v.id}-${v.title}`} className="p-0 overflow-hidden">
              <div className="aspect-video w-full">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${v.id}`}
                  title={v.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="mb-1 text-lg font-semibold">{v.title}</h3>
                  <span className="text-xs rounded-full bg-muted/10 px-2 py-1">{v.category ?? 'General'}</span>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">{v.description}</p>
                <div className="flex justify-end">
                  <Button asChild variant="ghost" size="sm">
                    <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">
                      Open on YouTube <ExternalLink className="inline-block ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdVideos;
