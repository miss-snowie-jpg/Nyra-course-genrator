import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, ArrowLeft, ArrowRight, Palette, Type, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const COLOR_THEMES = [
  { id: "blue", name: "Ocean Blue", primary: "#3B82F6", secondary: "#1E40AF", accent: "#60A5FA" },
  { id: "purple", name: "Royal Purple", primary: "#8B5CF6", secondary: "#6D28D9", accent: "#A78BFA" },
  { id: "green", name: "Forest Green", primary: "#10B981", secondary: "#047857", accent: "#34D399" },
  { id: "orange", name: "Sunset Orange", primary: "#F97316", secondary: "#C2410C", accent: "#FB923C" },
  { id: "pink", name: "Rose Pink", primary: "#EC4899", secondary: "#BE185D", accent: "#F472B6" },
  { id: "teal", name: "Modern Teal", primary: "#14B8A6", secondary: "#0D9488", accent: "#2DD4BF" },
];

const FONT_STYLES = [
  { id: "modern", name: "Modern Sans", heading: "Inter", body: "Inter", preview: "Clean and professional" },
  { id: "elegant", name: "Elegant Serif", heading: "Playfair Display", body: "Lora", preview: "Classic and refined" },
  { id: "playful", name: "Playful", heading: "Poppins", body: "Nunito", preview: "Fun and friendly" },
  { id: "minimal", name: "Minimal", heading: "DM Sans", body: "DM Sans", preview: "Simple and sleek" },
  { id: "bold", name: "Bold Impact", heading: "Montserrat", body: "Open Sans", preview: "Strong and impactful" },
];

interface CourseModule {
  title: string;
  lessons: string[];
}

interface GeneratedCourse {
  title: string;
  description: string;
  modules: CourseModule[];
}

const Wizard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generatedCourse, setGeneratedCourse] = useState<GeneratedCourse | null>(null);
  const [courseRecordId, setCourseRecordId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const DODO_PRODUCT_ID = "pdt_opSYvZuV8aSRkjMjqiHdN";
  const [formData, setFormData] = useState({
    topic: "",
    audience: "",
    style: "",
    level: "",
    monetization: "",
    colorTheme: "blue",
    fontStyle: "modern",
  });

  useEffect(() => {
    // If user is coming back from payment, show success even if their session expired.
    if (searchParams.get('payment') === 'success') {
      setPaymentSuccess(true);
      toast.success("Payment successful! Your course is now published.");
      return;
    }

    // Otherwise, enforce auth for the wizard.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      }
    });
  }, [navigate, searchParams]);

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/dashboard');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to create courses");
        navigate('/auth');
        return;
      }

      // Generate course using AI
      const { data: courseData, error: generateError } = await supabase.functions.invoke('generate-course', {
        body: {
          topic: formData.topic,
          audience: formData.audience,
          style: formData.style,
          level: formData.level,
          monetization: formData.monetization,
        }
      });

      if (generateError) throw generateError;

      // Save to database
      const { data: insertedCourse, error: insertError } = await (supabase as any)
        .from('courses')
        .insert({
          user_id: session.user.id,
          title: courseData.course.title,
          description: courseData.course.description,
          topic: formData.topic,
          audience: formData.audience,
          style: formData.style,
          level: formData.level,
          monetization: formData.monetization,
          modules: courseData.course.modules,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setCourseRecordId(insertedCourse.id);

      // Set generated course to display
      setGeneratedCourse(courseData.course);
      setStep(7); // Move to course preview step
      toast.success("Course generated successfully!");

      // Generate course website in background
      toast.info("Generating your course website...");
      supabase.functions.invoke('generate-course-website', {
        body: { courseId: insertedCourse.id }
      }).then(({ data, error }) => {
        if (error) {
          console.error('Website generation error:', error);
          toast.error("Course website generation failed");
        } else {
          toast.success("Course website ready!");
        }
      });
    } catch (error: any) {
      console.error('Course generation error:', error);
      toast.error(error.message || "Failed to generate course");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return formData.topic.trim().length > 0;
      case 2: return formData.audience.trim().length > 0;
      case 3: return formData.style.length > 0;
      case 4: return formData.level.length > 0;
      case 5: return formData.monetization.length > 0;
      case 6: return formData.colorTheme.length > 0 && formData.fontStyle.length > 0;
      default: return false;
    }
  };

  const selectedColorTheme = COLOR_THEMES.find(t => t.id === formData.colorTheme);
  const selectedFontStyle = FONT_STYLES.find(f => f.id === formData.fontStyle);

  const handlePublishCourse = async () => {
    setPaymentLoading(true);
    try {
      if (!courseRecordId) {
        toast.error("Missing course id. Please generate the course again.");
        return;
      }

      const productId = DODO_PRODUCT_ID;

      const { data: { session } } = await supabase.auth.getSession();
      const customerEmail = session?.user?.email;

      const { data, error } = await supabase.functions.invoke('dodo-checkout', {
        body: {
          amount: 40.99,
          currency: "USD",
          productId,
          courseId: courseRecordId,
          courseName: generatedCourse?.title || 'Course Purchase',
          customerEmail,
          successUrl: `${window.location.origin}/wizard?payment=success`,
          cancelUrl: `${window.location.origin}/wizard`,
        }
      });

      if (error) throw error;

      const checkoutUrl = data?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        console.error('No checkout URL in response:', data);
        toast.error("Failed to get checkout URL.");
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || "Payment failed");
    } finally {
      setPaymentLoading(false);
    }
  };

  // Payment Success View
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-lg mx-auto p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 mb-4">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Payment Successful!</h1>
          <p className="text-muted-foreground text-lg">
            Your course has been published successfully. Students can now access your course.
          </p>
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg p-6 space-y-3">
            <h3 className="font-semibold text-lg">What happens next?</h3>
            <ul className="text-left space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Your course website is now live</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Students can enroll and start learning</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <span>You'll receive notifications for new enrollments</span>
              </li>
            </ul>
          </div>
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-accent"
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex items-center gap-2 px-4 py-4">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Nyra Course Wizard
          </span>
        </div>
      </header>

      {/* Progress Bar */}
      {step <= 6 && (
        <div className="border-b border-border/50 bg-card/30">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between text-sm">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    i <= step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i}
                  </div>
                  {i < 6 && <div className={`h-1 w-8 md:w-16 ${i < step ? 'bg-primary' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto max-w-4xl px-4 py-12">
        <Card className="border-border/50 bg-card/80 p-8 backdrop-blur-sm">
          {step === 7 && generatedCourse ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Your Course is Ready!</h2>
                <p className="text-muted-foreground">Review your AI-generated course structure below</p>
              </div>

              <div className="space-y-6 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg p-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{generatedCourse.title}</h3>
                  <p className="text-muted-foreground">{generatedCourse.description}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xl font-semibold">Course Modules</h4>
                  {generatedCourse.modules.map((module, idx) => (
                    <Card key={idx} className="p-6 bg-card hover:shadow-md transition-shadow">
                      <h5 className="font-semibold text-lg mb-3 text-primary">
                        Module {idx + 1}: {module.title}
                      </h5>
                      <ul className="space-y-2">
                        {module.lessons.map((lesson, lessonIdx) => (
                          <li key={lessonIdx} className="flex items-start gap-2 text-sm">
                            <span className="text-accent mt-1">•</span>
                            <span>{lesson}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">

                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-accent to-primary hover:opacity-90 transition-opacity text-lg"
                  onClick={handlePublishCourse}
                  disabled={paymentLoading}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  {paymentLoading ? "Processing..." : "Publish Course - $40"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          ) : step === 1 && (
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">What's your course about?</h2>
              <p className="text-muted-foreground">Tell us the main topic of your course</p>
              <div className="space-y-2">
                <Label htmlFor="topic">Course Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Digital Marketing for Beginners"
                  value={formData.topic}
                  onChange={(e) => updateField('topic', e.target.value)}
                  className="border-border/50 bg-background/50"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Who is your audience?</h2>
              <p className="text-muted-foreground">Describe who will benefit from this course</p>
              <div className="space-y-2">
                <Label htmlFor="audience">Target Audience</Label>
                <Textarea
                  id="audience"
                  placeholder="e.g., Small business owners looking to grow their online presence"
                  value={formData.audience}
                  onChange={(e) => updateField('audience', e.target.value)}
                  className="min-h-32 border-border/50 bg-background/50"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">What's your teaching style?</h2>
              <p className="text-muted-foreground">Choose the tone for your course</p>
              <div className="space-y-2">
                <Label htmlFor="style">Teaching Style</Label>
                <Select value={formData.style} onValueChange={(value) => updateField('style', value)}>
                  <SelectTrigger className="border-border/50 bg-background/50">
                    <SelectValue placeholder="Select a style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="educational">Educational & Informative</SelectItem>
                    <SelectItem value="entertaining">Entertaining & Engaging</SelectItem>
                    <SelectItem value="professional">Professional & Formal</SelectItem>
                    <SelectItem value="casual">Casual & Conversational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Course difficulty level?</h2>
              <p className="text-muted-foreground">Select the appropriate level for your students</p>
              <div className="space-y-2">
                <Label htmlFor="level">Difficulty Level</Label>
                <Select value={formData.level} onValueChange={(value) => updateField('level', value)}>
                  <SelectTrigger className="border-border/50 bg-background/50">
                    <SelectValue placeholder="Select a level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner - No prior knowledge needed</SelectItem>
                    <SelectItem value="intermediate">Intermediate - Some experience required</SelectItem>
                    <SelectItem value="advanced">Advanced - Expert level content</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Monetization strategy?</h2>
              <p className="text-muted-foreground">How do you plan to sell your course?</p>
              <div className="space-y-2">
                <Label htmlFor="monetization">Pricing Model</Label>
                <Select value={formData.monetization} onValueChange={(value) => updateField('monetization', value)}>
                  <SelectTrigger className="border-border/50 bg-background/50">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free - Build audience first</SelectItem>
                    <SelectItem value="one-time">One-time Payment</SelectItem>
                    <SelectItem value="subscription">Monthly Subscription</SelectItem>
                    <SelectItem value="tiered">Tiered Pricing (Basic/Pro/Premium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-2">
                  <Palette className="h-8 w-8 text-primary" />
                  Design Your Course
                </h2>
                <p className="text-muted-foreground mt-2">Choose colors and typography for your course website</p>
              </div>

              {/* Color Theme Selection */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Color Theme
                </Label>
                <RadioGroup
                  value={formData.colorTheme}
                  onValueChange={(value) => updateField('colorTheme', value)}
                  className="grid grid-cols-2 md:grid-cols-3 gap-4"
                >
                  {COLOR_THEMES.map((theme) => (
                    <Label
                      key={theme.id}
                      htmlFor={theme.id}
                      className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${
                        formData.colorTheme === theme.id 
                          ? 'border-primary bg-primary/10 shadow-lg' 
                          : 'border-border/50 bg-card/50 hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={theme.id} id={theme.id} className="sr-only" />
                      <div className="flex gap-1">
                        <div 
                          className="w-8 h-8 rounded-full shadow-md" 
                          style={{ backgroundColor: theme.primary }}
                        />
                        <div 
                          className="w-8 h-8 rounded-full shadow-md" 
                          style={{ backgroundColor: theme.secondary }}
                        />
                        <div 
                          className="w-8 h-8 rounded-full shadow-md" 
                          style={{ backgroundColor: theme.accent }}
                        />
                      </div>
                      <span className="font-medium text-sm">{theme.name}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {/* Font Style Selection */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Typography Style
                </Label>
                <RadioGroup
                  value={formData.fontStyle}
                  onValueChange={(value) => updateField('fontStyle', value)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {FONT_STYLES.map((font) => (
                    <Label
                      key={font.id}
                      htmlFor={`font-${font.id}`}
                      className={`flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${
                        formData.fontStyle === font.id 
                          ? 'border-primary bg-primary/10 shadow-lg' 
                          : 'border-border/50 bg-card/50 hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={font.id} id={`font-${font.id}`} className="sr-only" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">{font.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{font.preview}</p>
                      <div className="text-xs text-muted-foreground/70">
                        Headings: {font.heading} | Body: {font.body}
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {/* Preview */}
              {selectedColorTheme && selectedFontStyle && (
                <div className="mt-6 p-6 rounded-xl border border-border/50" style={{ 
                  background: `linear-gradient(135deg, ${selectedColorTheme.primary}10, ${selectedColorTheme.accent}10)` 
                }}>
                  <h3 className="text-lg font-semibold mb-2">Preview</h3>
                  <div className="space-y-2">
                    <h4 
                      className="text-2xl font-bold" 
                      style={{ color: selectedColorTheme.primary }}
                    >
                      Your Course Title
                    </h4>
                    <p className="text-muted-foreground">
                      This is how your course content will look with {selectedColorTheme.name} colors and {selectedFontStyle.name} typography.
                    </p>
                    <button 
                      className="px-4 py-2 rounded-lg text-white font-medium"
                      style={{ backgroundColor: selectedColorTheme.primary }}
                    >
                      Enroll Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          {step <= 6 && (
            <div className="mt-8 flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {step === 1 ? 'Dashboard' : 'Back'}
              </Button>
              <Button 
                onClick={handleNext} 
                disabled={!isStepValid() || loading}
                className="bg-gradient-to-r from-primary to-accent"
              >
                {loading ? 'Generating...' : step === 6 ? 'Generate Course' : 'Next'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Wizard;
