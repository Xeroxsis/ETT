import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { BookOpen, Eye, EyeOff, Loader2 } from "lucide-react";

function formatError(detail) {
  if (!detail) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) { setError("Name is required"); setLoading(false); return; }
        await register(form.email, form.name, form.password);
      }
    } catch (err) {
      setError(formatError(err?.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 xl:px-24">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold font-heading text-foreground">StudyPlanner</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-muted-foreground">
              {mode === "login" ? "Sign in to continue your study journey" : "Start planning smarter today"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-muted rounded-xl p-1 mb-8">
            <button
              data-testid="login-tab"
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${mode === "login" ? "bg-white dark:bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign In
            </button>
            <button
              data-testid="register-tab"
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${mode === "register" ? "bg-white dark:bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5 animate-fade-in">
                <Label htmlFor="name" className="text-sm font-medium text-foreground">Full Name</Label>
                <Input
                  id="name"
                  data-testid="register-name-input"
                  type="text"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-11 bg-white dark:bg-card border-border"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
              <Input
                id="email"
                data-testid="auth-email-input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-11 bg-white dark:bg-card border-border"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="auth-password-input"
                  type={showPass ? "text" : "password"}
                  placeholder={mode === "register" ? "Min. 8 characters" : "Your password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-11 bg-white dark:bg-card border-border pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div data-testid="auth-error" className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            <Button
              type="submit"
              data-testid="auth-submit-button"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold text-sm rounded-xl mt-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {mode === "login" ? "Signing in..." : "Creating account..."}</>
              ) : (
                mode === "login" ? "Sign In" : "Create Account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {mode === "login" ? "Sign up for free" : "Sign in instead"}
            </button>
          </p>
        </div>
      </div>

      {/* Right: Hero image */}
      <div className="hidden lg:block lg:flex-1 relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/16088727/pexels-photo-16088727.jpeg"
          alt="Study workspace"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-[1px]" />
        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <div className="bg-white/90 dark:bg-card/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-border/50 max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl">🎯</span>
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">AI Study Planning</p>
                <p className="text-xs text-muted-foreground">Smart schedule generation</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Plan smarter with AI-powered schedules, Pomodoro timers, and progress tracking — all in one place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
