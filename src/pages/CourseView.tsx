import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft, BookOpen, GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Module {
  title: string;
  lessons: string[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  level: string;
  style: string;
  audience: string;
  modules: Module[];
}

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState(0);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseId) {
        navigate('/dashboard');
        return;
      }

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (error || !data) {
        navigate('/dashboard');
        return;
      }

      setCourse({
        id: data.id,
        title: data.title,
        description: data.description,
        level: data.level,
        style: data.style,
        audience: data.audience,
        modules: (data.modules as unknown as Module[]) || [],
      });
      setLoading(false);
    };

    fetchCourse();
  }, [courseId, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Sparkles className="mx-auto mb-4 h-12 w-12 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2 text-xl font-bold">
              <GraduationCap className="h-5 w-5 text-primary" />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {course.title}
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-72 border-r border-border/50 bg-card/30 min-h-[calc(100vh-65px)] p-4 hidden md:block">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
            Course Modules
          </h3>
          <nav className="space-y-2">
            {course.modules.map((module, index) => (
              <button
                key={index}
                onClick={() => setActiveModule(index)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                  activeModule === index
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="text-xs font-medium opacity-70">Module {index + 1}</span>
                <p className="text-sm font-medium line-clamp-2">{module.title}</p>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {/* Course Header */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {course.level}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
                {course.style}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                For: {course.audience}
              </span>
            </div>
            <p className="text-muted-foreground max-w-3xl">
              {course.description}
            </p>
          </div>

          {/* Active Module Content */}
          {course.modules[activeModule] && (
            <div className="bg-card rounded-xl border border-border/50 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                  {activeModule + 1}
                </div>
                <h2 className="text-2xl font-bold">{course.modules[activeModule].title}</h2>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Lessons in this module
                </h3>
                <ul className="space-y-3">
                  {course.modules[activeModule].lessons.map((lesson, lessonIndex) => (
                    <li
                      key={lessonIndex}
                      className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                        {lessonIndex + 1}
                      </span>
                      <span className="text-foreground">{lesson}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Module Navigation */}
              <div className="flex justify-between mt-8 pt-6 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={() => setActiveModule(Math.max(0, activeModule - 1))}
                  disabled={activeModule === 0}
                >
                  Previous Module
                </Button>
                <Button
                  onClick={() => setActiveModule(Math.min(course.modules.length - 1, activeModule + 1))}
                  disabled={activeModule === course.modules.length - 1}
                  className="bg-gradient-to-r from-primary to-accent"
                >
                  Next Module
                </Button>
              </div>
            </div>
          )}

          {/* Mobile Module Selector */}
          <div className="md:hidden mt-6">
            <select
              value={activeModule}
              onChange={(e) => setActiveModule(Number(e.target.value))}
              className="w-full p-3 rounded-lg border border-border bg-card text-foreground"
            >
              {course.modules.map((module, index) => (
                <option key={index} value={index}>
                  Module {index + 1}: {module.title}
                </option>
              ))}
            </select>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CourseView;
