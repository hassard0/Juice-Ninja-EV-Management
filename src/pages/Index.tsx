import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, BarChart3, Clock, Shield, ChevronRight, Leaf, Sun, BatteryCharging } from "lucide-react";
import AppFooter from "@/components/AppFooter";
import { useEffect, useRef } from "react";

const useScrollReveal = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("animate-in");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
};

const RevealSection = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`opacity-0 translate-y-4 blur-[2px] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// Add the CSS for animate-in
const style = document.createElement("style");
style.textContent = `.animate-in { opacity: 1 !important; transform: translateY(0) !important; filter: blur(0) !important; }`;
if (!document.querySelector("[data-juice-anim]")) {
  style.setAttribute("data-juice-anim", "");
  document.head.appendChild(style);
}

const features = [
  {
    icon: BarChart3,
    title: "Real-Time Monitoring",
    description: "Track voltage, amperage, temperature, and energy consumption as it happens — all from your browser.",
  },
  {
    icon: Clock,
    title: "Smart Scheduling",
    description: "Set charging windows that align with off-peak rates or solar production to save money automatically.",
  },
  {
    icon: Zap,
    title: "Remote Control",
    description: "Start, stop, or adjust charging current from anywhere. No need to walk to the garage.",
  },
  {
    icon: Shield,
    title: "Secure by Default",
    description: "End-to-end encryption, role-based access, and audit logging keep your charger and data safe.",
  },
  {
    icon: Leaf,
    title: "Eco-Aware Charging",
    description: "Solar divert mode routes excess PV energy to your EV before exporting to the grid.",
  },
  {
    icon: Sun,
    title: "Energy Insights",
    description: "Daily, weekly, and monthly usage breakdowns help you understand and optimise your consumption.",
  },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <BatteryCharging className="h-6 w-6" />
            Juice Ninja
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild className="active:scale-[0.97] transition-transform">
              <Link to="/auth?tab=signup">Get started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 sm:py-32 lg:py-40">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.06] to-transparent" />
        <div className="mx-auto max-w-6xl px-6">
          <RevealSection className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-4">EV Charger Management</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight text-foreground">
              Take control of your EV charging
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground max-w-xl">
              Monitor, schedule, and control your home or business chargers from one secure dashboard. Save energy, save money, charge smarter.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button size="lg" asChild className="active:scale-[0.97] transition-transform text-base px-8 h-12">
                <Link to="/auth?tab=signup">
                  Start free
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="active:scale-[0.97] transition-transform text-base px-8 h-12">
                <a href="#features">See how it works</a>
              </Button>
            </div>
          </RevealSection>

          {/* Stats */}
          <RevealSection delay={200} className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { value: "2.4M", label: "kWh managed" },
              { value: "18k", label: "Charging sessions" },
              { value: "99.7%", label: "Uptime" },
              { value: "£342k", label: "User savings" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-card p-5 shadow-sm">
                <p className="text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </RevealSection>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <RevealSection className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Everything you need to charge smarter</h2>
            <p className="mt-4 text-muted-foreground text-lg">From real-time telemetry to intelligent scheduling, Juice Ninja gives you full visibility and control.</p>
          </RevealSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <RevealSection key={feature.title} delay={i * 80}>
                <div className="group rounded-xl border bg-card p-7 shadow-sm hover:shadow-md transition-shadow duration-300 h-full">
                  <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-2.5 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-[0.935rem]">{feature.description}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32 bg-primary/[0.04]">
        <div className="mx-auto max-w-6xl px-6">
          <RevealSection className="text-center max-w-xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Ready to charge smarter?</h2>
            <p className="mt-4 text-muted-foreground text-lg">Create your free account and register your first charger in under two minutes.</p>
            <Button size="lg" asChild className="mt-8 active:scale-[0.97] transition-transform text-base px-10 h-12">
              <Link to="/auth?tab=signup">
                Create free account
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </RevealSection>
        </div>
      </section>

      <AppFooter />
    </div>
  );
}
