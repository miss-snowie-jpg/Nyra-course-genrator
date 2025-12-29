import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Sparkles, Zap, DollarSign, BarChart, Video, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Sparkles,
      title: "AI-Powered Course Creation",
      description: "Generate complete course structures, lesson content, and video scripts in minutes"
    },
    {
      icon: Zap,
      title: "Instant Website Builder",
      description: "Get a beautiful, SEO-optimized course website with zero coding required"
    },
    {
      icon: BarChart,
      title: "Growth Analytics",
      description: "Track traffic, sales, and revenue with real-time insights"
    }
  ];

  const pricingPlans = [
    {
      name: "Free Trial",
      price: "Free",
      duration: "3 days",
      features: [
        "Create unlimited courses",
        "AI content generation",
        "Course website preview",
        "All editing features"
      ],
      cta: "Start Free Trial",
      popular: false
    },
    {
      name: "Monthly",
      price: "$40",
      duration: "per month",
      features: [
        "Everything in trial",
        "Publish unlimited courses",
        "Accept payments",
        "Custom domain support",
        "Analytics dashboard",
        "Priority support"
      ],
      cta: "Get Started",
      popular: true
    },
    {
      name: "Annual",
      price: "$400",
      duration: "per year",
      features: [
        "Everything in monthly",
        "2 months FREE",
        "Premium AI features",
        "White-label options",
        "Advanced analytics",
        "Dedicated support"
      ],
      cta: "Save $80/year",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header with Theme Toggle */}
      <header className="absolute top-0 left-0 right-0 z-10 border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Nyra</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
        <div className="absolute inset-0" style={{ boxShadow: "var(--shadow-glow)" }} />
        
        <div className="container relative mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Launch Your Course Business in Minutes</span>
            </div>
            
            <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              Turn Your Ideas Into
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> Income</span>
            </h1>
            
            <p className="mb-8 text-xl text-muted-foreground md:text-2xl">
              Nyra is your AI business coach that creates, designs, and launches your online course—no tech skills needed.
            </p>
            
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button 
                size="lg" 
                className="group relative overflow-hidden bg-gradient-to-r from-primary to-accent text-lg"
                onClick={() => navigate('/auth')}
              >
                <span className="relative z-10">Start Free Trial</span>
                <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-primary/30 text-lg backdrop-blur-sm hover:bg-primary/10"
                onClick={() => navigate('/auth')}
              >
                View Pricing
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">Everything You Need to Succeed</h2>
          <p className="text-xl text-muted-foreground">From idea to income in four simple steps</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card key={index} className="group relative overflow-hidden border-border/50 bg-gradient-to-b from-card to-card/50 p-6 backdrop-blur-sm transition-all hover:border-primary/50">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">Simple, Transparent Pricing</h2>
          <p className="text-xl text-muted-foreground">Start free, scale when you're ready</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {pricingPlans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative overflow-hidden p-8 ${
                plan.popular 
                  ? 'border-primary bg-gradient-to-b from-primary/10 to-card shadow-xl' 
                  : 'border-border/50 bg-card'
              }`}
            >
              {plan.popular && (
                <div className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-semibold">
                  POPULAR
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="mb-2 text-2xl font-bold">{plan.name}</h3>
                <div className="mb-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.duration}</span>
                </div>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className={`w-full ${
                  plan.popular 
                    ? 'bg-gradient-to-r from-primary to-accent' 
                    : 'bg-secondary'
                }`}
                onClick={() => {
                  const planType = plan.name === 'Annual' ? 'annual' : plan.name === 'Monthly' ? 'subscription' : 'free';
                  navigate(`/auth?plan=${planType}`);
                }}
              >
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20" />
        
        <div className="container relative mx-auto px-4 py-20 text-center">
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            Ready to Build Your Course Empire?
          </h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Join thousands of creators turning their expertise into income
          </p>
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-primary to-accent text-lg"
            onClick={() => navigate('/auth')}
          >
            Start Your Free Trial
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Landing;