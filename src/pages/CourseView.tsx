import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft, BookOpen, GraduationCap, ChevronRight, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Lesson {
  title: string;
  content: string;
  keyPoints?: string[];
}

interface Module {
  title: string;
  lessons: Lesson[] | string[];
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
  const [activeLesson, setActiveLesson] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

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

  const getLessonKey = (moduleIndex: number, lessonIndex: number) => 
    `${moduleIndex}-${lessonIndex}`;

  const toggleLessonComplete = () => {
    const key = getLessonKey(activeModule, activeLesson);
    setCompletedLessons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isLessonComplete = (moduleIndex: number, lessonIndex: number) => 
    completedLessons.has(getLessonKey(moduleIndex, lessonIndex));

  const goToNextLesson = () => {
    const currentModule = course?.modules[activeModule];
    if (!currentModule) return;

    if (activeLesson < currentModule.lessons.length - 1) {
      setActiveLesson(activeLesson + 1);
    } else if (activeModule < (course?.modules.length || 0) - 1) {
      setActiveModule(activeModule + 1);
      setActiveLesson(0);
    }
  };

  const goToPreviousLesson = () => {
    if (activeLesson > 0) {
      setActiveLesson(activeLesson - 1);
    } else if (activeModule > 0) {
      const prevModule = course?.modules[activeModule - 1];
      setActiveModule(activeModule - 1);
      setActiveLesson((prevModule?.lessons.length || 1) - 1);
    }
  };

  // Helper to get lesson data (handles both old string format and new object format)
  const getLessonData = (lesson: Lesson | string): { title: string; content: string; keyPoints: string[] } => {
    if (typeof lesson === 'string') {
      return { title: lesson, content: '', keyPoints: [] };
    }
    return { 
      title: lesson.title, 
      content: lesson.content || '', 
      keyPoints: lesson.keyPoints || [] 
    };
  };

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

  const currentModuleLessons = course.modules[activeModule]?.lessons || [];
  const currentLesson = currentModuleLessons[activeLesson];
  const lessonData = currentLesson ? getLessonData(currentLesson) : null;
  const hasContent = lessonData && lessonData.content;

  const totalLessons = course.modules.reduce((acc, mod) => acc + mod.lessons.length, 0);
  const completedCount = completedLessons.size;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

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
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hidden sm:inline">
                {course.title}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span>{progressPercent}%</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-80 border-r border-border/50 bg-card/30 min-h-[calc(100vh-65px)] hidden lg:block">
          <ScrollArea className="h-[calc(100vh-65px)]">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
                Course Content
              </h3>
              <nav className="space-y-2">
                {course.modules.map((module, moduleIndex) => (
                  <div key={moduleIndex} className="space-y-1">
                    <button
                      onClick={() => {
                        setActiveModule(moduleIndex);
                        setActiveLesson(0);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                        activeModule === moduleIndex
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="text-xs font-medium opacity-70">Module {moduleIndex + 1}</span>
                      <p className="text-sm font-medium line-clamp-2">{module.title}</p>
                    </button>
                    
                    {activeModule === moduleIndex && (
                      <div className="ml-4 space-y-1 border-l-2 border-border pl-3">
                        {module.lessons.map((lesson, lessonIndex) => {
                          const data = getLessonData(lesson);
                          const isComplete = isLessonComplete(moduleIndex, lessonIndex);
                          return (
                            <button
                              key={lessonIndex}
                              onClick={() => setActiveLesson(lessonIndex)}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-all ${
                                activeLesson === lessonIndex
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {isComplete ? (
                                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                              ) : (
                                <span className="w-4 h-4 rounded-full border border-current flex-shrink-0 text-xs flex items-center justify-center">
                                  {lessonIndex + 1}
                                </span>
                              )}
                              <span className="line-clamp-1">{data.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-65px)]">
          <ScrollArea className="h-[calc(100vh-65px)]">
            <div className="p-6 lg:p-8 max-w-4xl mx-auto">
              {/* Mobile Module/Lesson Selector */}
              <div className="lg:hidden mb-6 space-y-2">
                <select
                  value={activeModule}
                  onChange={(e) => {
                    setActiveModule(Number(e.target.value));
                    setActiveLesson(0);
                  }}
                  className="w-full p-3 rounded-lg border border-border bg-card text-foreground"
                >
                  {course.modules.map((module, index) => (
                    <option key={index} value={index}>
                      Module {index + 1}: {module.title}
                    </option>
                  ))}
                </select>
                <select
                  value={activeLesson}
                  onChange={(e) => setActiveLesson(Number(e.target.value))}
                  className="w-full p-3 rounded-lg border border-border bg-card text-foreground"
                >
                  {currentModuleLessons.map((lesson, index) => {
                    const data = getLessonData(lesson);
                    return (
                      <option key={index} value={index}>
                        Lesson {index + 1}: {data.title}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <span>Module {activeModule + 1}</span>
                <ChevronRight className="h-4 w-4" />
                <span>Lesson {activeLesson + 1}</span>
              </div>

              {/* Lesson Content */}
              {lessonData && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{lessonData.title}</h1>
                    <p className="text-muted-foreground">
                      {course.modules[activeModule]?.title}
                    </p>
                  </div>

                  {hasContent ? (
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                      <div 
                        className="bg-card rounded-xl border border-border/50 p-6 lg:p-8"
                        dangerouslySetInnerHTML={{ 
                          __html: lessonData.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/##\s?(.*?)(\n|$)/g, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>')
                            .replace(/###\s?(.*?)(\n|$)/g, '<h4 class="text-lg font-medium mt-4 mb-2">$1</h4>')
                            .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
                            .replace(/```([\s\S]*?)```/g, '<pre class="bg-muted p-4 rounded-lg overflow-x-auto my-4"><code>$1</code></pre>')
                            .replace(/^- (.*?)$/gm, '<li class="ml-4">$1</li>')
                            .replace(/(<li.*<\/li>)/s, '<ul class="list-disc space-y-2 my-4">$1</ul>')
                            .replace(/\n\n/g, '</p><p class="mb-4">')
                            .replace(/^(?!<)(.+)$/gm, '<p class="mb-4">$1</p>')
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-2">Lesson Preview</h3>
                      <p className="text-muted-foreground">
                        This is a preview of the lesson structure. Create a new course to generate full lesson content.
                      </p>
                    </div>
                  )}

                  {/* Key Points */}
                  {lessonData.keyPoints && lessonData.keyPoints.length > 0 && (
                    <div className="bg-primary/5 rounded-xl border border-primary/20 p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Key Takeaways
                      </h3>
                      <ul className="space-y-3">
                        {lessonData.keyPoints.map((point, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Mark Complete & Navigation */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/50">
                    <Button
                      variant={isLessonComplete(activeModule, activeLesson) ? "secondary" : "outline"}
                      onClick={toggleLessonComplete}
                      className="w-full sm:w-auto"
                    >
                      {isLessonComplete(activeModule, activeLesson) ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Completed
                        </>
                      ) : (
                        <>
                          <span className="w-4 h-4 rounded-full border-2 border-current mr-2" />
                          Mark as Complete
                        </>
                      )}
                    </Button>
                    
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={goToPreviousLesson}
                        disabled={activeModule === 0 && activeLesson === 0}
                        className="flex-1 sm:flex-none"
                      >
                        Previous
                      </Button>
                      <Button
                        onClick={goToNextLesson}
                        disabled={
                          activeModule === course.modules.length - 1 && 
                          activeLesson === currentModuleLessons.length - 1
                        }
                        className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-accent"
                      >
                        Next Lesson
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
};

export default CourseView;