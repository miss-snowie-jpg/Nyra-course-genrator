import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const videos = [
  { id: "dQw4w9WgXcQ", title: "Course Promo Sample 1", description: "Short ad style course promo" },
  { id: "3JZ_D3ELwOQ", title: "Course Promo Sample 2", description: "High-energy ad" },
  { id: "l9nh1l8ZIJQ", title: "Course Promo Sample 3", description: "Narrative-driven teaser" },
  { id: "L_jWHffIx5E", title: "Course Promo Sample 4", description: "Testimonial style ad" },
  { id: "eY52Zsg-KVI", title: "Course Promo Sample 5", description: "Minimal text ad" },
  { id: "V-_O7nl0Ii0", title: "Course Promo Sample 6", description: "Animated explainer ad" },
  { id: "kXYiU_JCYtU", title: "Course Promo Sample 7", description: "Bold headline ad" },
  { id: "9bZkp7q19f0", title: "Course Promo Sample 8", description: "Fast-cut ad" },
  { id: "RgKAFK5djSk", title: "Course Promo Sample 9", description: "Lifestyle ad" },
  { id: "60ItHLz5WEA", title: "Course Promo Sample 10", description: "Text-first ad" },
  { id: "hT_nvWreIhg", title: "Course Promo Sample 11", description: "Emotional story ad" },
  { id: "fJ9rUzIMcZQ", title: "Course Promo Sample 12", description: "Cinematic promo" },
];

const AdVideos = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold">Ad Video Library</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <p className="mb-6 text-muted-foreground">Curated collection of ad-style videos suitable for promoting courses. Click any video to view or open on YouTube.</p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <Card key={v.id} className="p-0 overflow-hidden">
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
                <h3 className="mb-1 text-lg font-semibold">{v.title}</h3>
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
