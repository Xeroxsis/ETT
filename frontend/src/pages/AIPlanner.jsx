import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Sparkles, Trash2, ChevronDown, ChevronUp, Loader2, BookOpen } from "lucide-react";
import { useToast } from "../hooks/use-toast";

function renderMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1.05rem;font-weight:600;margin:1rem 0 0.4rem;font-family:Manrope,sans-serif">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.2rem;font-weight:700;margin:1.25rem 0 0.5rem;font-family:Manrope,sans-serif;color:hsl(25,95%,53%)">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.4rem;font-weight:800;margin:1.5rem 0 0.75rem;font-family:Manrope,sans-serif">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin:0.2rem 0;padding-left:0.5rem">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:0.2rem 0;padding-left:0.5rem"><strong>$1.</strong> $2</li>')
    .replace(/---/g, '<hr style="border:none;border-top:1px solid hsl(var(--border));margin:1rem 0">')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/(<li.*<\/li>)\n(<li)/g, '$1$2');
  return html;
}

function PlanCard({ plan, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card data-testid={`plan-card-${plan.id}`} className="border border-border hover:border-primary/30 transition-colors">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>{plan.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(plan.created_at).toLocaleDateString()} · {plan.duration_weeks}wk · {plan.study_hours_per_day}h/day
            </p>
            {plan.subjects?.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {plan.subjects.map(s => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              data-testid={`expand-plan-${plan.id}`}
              onClick={() => setExpanded(!expanded)}
              className="w-8 h-8 text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid={`delete-plan-${plan.id}`}
              onClick={() => onDelete(plan.id)}
              className="w-8 h-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      {expanded && (
        <div
          className="border-t border-border px-5 py-4 plan-content text-sm text-foreground leading-relaxed animate-fade-in"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(plan.plan_content) }}
        />
      )}
    </Card>
  );
}

export default function AIPlanner() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [form, setForm] = useState({ goals: "", study_hours_per_day: 2, duration_weeks: 4, additional_notes: "" });
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  useEffect(() => {
    axios.get(`${API}/subjects`, { withCredentials: true }).then(r => setSubjects(r.data)).catch(() => {});
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data } = await axios.get(`${API}/ai/plans`, { withCredentials: true });
      setPlans(data);
    } catch {}
    setPlansLoading(false);
  };

  const toggleSubject = (name) => {
    setSelectedSubjects(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.goals.trim()) { toast({ title: "Please describe your goals", variant: "destructive" }); return; }
    setLoading(true);
    setGeneratedPlan(null);
    try {
      const { data } = await axios.post(`${API}/ai/generate-plan`, {
        ...form,
        subjects: selectedSubjects,
        study_hours_per_day: parseFloat(form.study_hours_per_day),
        duration_weeks: parseInt(form.duration_weeks)
      }, { withCredentials: true });
      setGeneratedPlan(data);
      fetchPlans();
      toast({ title: "Study plan generated!" });
    } catch (err) {
      toast({ title: err?.response?.data?.detail || "Failed to generate plan", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (id) => {
    try {
      await axios.delete(`${API}/ai/plans/${id}`, { withCredentials: true });
      setPlans(prev => prev.filter(p => p.id !== id));
      toast({ title: "Plan deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
          <Sparkles className="w-6 h-6 text-primary" /> AI Study Planner
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Generate personalized study plans powered by AI</p>
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6">
        {/* Form */}
        <div className="space-y-4 animate-fade-in-up stagger-1">
          <Card className="p-6 border border-border">
            <h2 className="font-bold text-foreground mb-5" style={{ fontFamily: 'Manrope, sans-serif' }}>Generate New Plan</h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Your Study Goals *</Label>
                <Textarea
                  data-testid="ai-goals-input"
                  placeholder="e.g. Prepare for UPSC Civil Services exam in 6 months, focusing on history, geography and polity..."
                  value={form.goals}
                  onChange={(e) => setForm({ ...form, goals: e.target.value })}
                  className="resize-none h-24 text-sm"
                  required
                />
              </div>

              {subjects.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Subjects (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        data-testid={`subject-chip-${s.id}`}
                        onClick={() => toggleSubject(s.name)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                          selectedSubjects.includes(s.name)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Hours/Day</Label>
                  <Input
                    type="number"
                    data-testid="study-hours-input"
                    min="0.5"
                    max="16"
                    step="0.5"
                    value={form.study_hours_per_day}
                    onChange={(e) => setForm({ ...form, study_hours_per_day: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Duration (weeks)</Label>
                  <Input
                    type="number"
                    data-testid="duration-weeks-input"
                    min="1"
                    max="52"
                    value={form.duration_weeks}
                    onChange={(e) => setForm({ ...form, duration_weeks: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Additional Notes</Label>
                <Input
                  data-testid="ai-notes-input"
                  placeholder="Exam date, weak areas, preferred study style..."
                  value={form.additional_notes}
                  onChange={(e) => setForm({ ...form, additional_notes: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>

              <Button
                type="submit"
                data-testid="generate-plan-button"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-10 font-semibold gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Generating your plan...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />Generate Study Plan</>
                )}
              </Button>
            </form>
          </Card>

          {/* Tips */}
          <Card className="p-5 border border-border bg-primary/5">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Tips for better plans</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• Be specific about your exam or goal deadline</li>
              <li>• Mention your current knowledge level</li>
              <li>• Include any constraints (work, family time)</li>
              <li>• Select your subjects for targeted recommendations</li>
            </ul>
          </Card>
        </div>

        {/* Generated plan & history */}
        <div className="space-y-6 animate-fade-in-up stagger-2">
          {loading && (
            <Card className="p-8 border border-border border-dashed flex flex-col items-center justify-center min-h-[300px]" data-testid="generating-indicator">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="font-semibold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>Generating your personalized plan...</p>
              <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
            </Card>
          )}

          {generatedPlan && !loading && (
            <Card className="border border-primary/30 animate-fade-in" data-testid="generated-plan-card">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <Badge className="bg-primary/10 text-primary text-xs mb-1">New Plan</Badge>
                  <h3 className="font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>{generatedPlan.title}</h3>
                </div>
              </div>
              <div
                className="px-5 py-4 plan-content text-sm text-foreground leading-relaxed max-h-[500px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(generatedPlan.plan_content) }}
              />
            </Card>
          )}

          {/* Saved plans */}
          <div>
            <h2 className="font-bold text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              Saved Plans ({plans.length})
            </h2>
            {plansLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : plans.length === 0 ? (
              <Card className="p-8 text-center border border-dashed border-border">
                <Sparkles className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No saved plans yet. Generate your first one!</p>
              </Card>
            ) : (
              <div className="space-y-3" data-testid="saved-plans-list">
                {plans.map(p => (
                  <PlanCard key={p.id} plan={p} onDelete={handleDeletePlan} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
