import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API } from "../contexts/AuthContext";
import { Calendar } from "../components/ui/calendar";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Plus, Clock, Trash2, CheckCircle2, CalendarDays, Loader2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { format } from "date-fns";

export default function CalendarPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ subject_id: "", title: "", scheduled_time: "09:00", duration_minutes: 60, notes: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, subRes] = await Promise.all([
        axios.get(`${API}/sessions`, { withCredentials: true }),
        axios.get(`${API}/subjects`, { withCredentials: true })
      ]);
      setAllSessions(sessRes.data);
      setSubjects(subRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    setSessions(allSessions.filter(s => s.scheduled_date === dateStr));
  }, [selectedDate, allSessions]);

  const sessionDates = allSessions.map(s => {
    const [y, m, d] = s.scheduled_date.split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.subject_id) { toast({ title: "Select a subject", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/sessions`, {
        ...form,
        scheduled_date: format(selectedDate, "yyyy-MM-dd"),
        duration_minutes: parseInt(form.duration_minutes)
      }, { withCredentials: true });
      toast({ title: "Session scheduled!" });
      setDialogOpen(false);
      setForm({ subject_id: "", title: "", scheduled_time: "09:00", duration_minutes: 60, notes: "" });
      fetchData();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || "Failed to create session", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/sessions/${id}`, { withCredentials: true });
      toast({ title: "Session deleted" });
      fetchData();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleComplete = async (id) => {
    try {
      await axios.patch(`${API}/sessions/${id}/complete`, {}, { withCredentials: true });
      toast({ title: "Session completed!" });
      fetchData();
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const statusColor = { scheduled: "bg-primary/10 text-primary", completed: "bg-secondary/10 text-secondary", cancelled: "bg-muted text-muted-foreground" };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>Study Calendar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Schedule and track your study sessions</p>
        </div>
        <Button
          data-testid="add-session-button"
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2"
        >
          <Plus className="w-4 h-4" /> New Session
        </Button>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        {/* Calendar */}
        <Card className="p-4 border border-border animate-fade-in-up stagger-1" data-testid="calendar-card">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            className="rounded-xl w-full"
            modifiers={{ hasSession: sessionDates }}
            modifiersClassNames={{ hasSession: "font-bold underline decoration-primary decoration-2 text-primary" }}
          />
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground px-2">
            <span className="font-bold text-primary underline decoration-primary decoration-2">15</span>
            <span>= has sessions</span>
          </div>
        </Card>

        {/* Sessions for selected date */}
        <Card className="p-6 border border-border animate-fade-in-up stagger-2" data-testid="sessions-panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <CalendarDays className="w-4 h-4 inline mr-2 text-primary" />
              {format(selectedDate, "MMMM d, yyyy")}
            </h2>
            <Badge variant="outline">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</Badge>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No sessions scheduled for this day</p>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(true)}
                className="mt-4 gap-2 rounded-xl"
                data-testid="add-first-session-button"
              >
                <Plus className="w-4 h-4" /> Schedule a session
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s.id} data-testid={`calendar-session-${s.id}`} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-muted/30 hover:border-primary/30 transition-colors">
                  <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: s.subject_color || "#F97316" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{s.title}</p>
                        <p className="text-sm text-muted-foreground">{s.subject_name}</p>
                      </div>
                      <Badge className={`text-xs ${statusColor[s.status] || statusColor.scheduled} shrink-0`}>
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.scheduled_time}</span>
                      <span>{s.duration_minutes} min</span>
                      {s.notes && <span className="truncate">{s.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {s.status === "scheduled" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`complete-session-calendar-${s.id}`}
                        onClick={() => handleComplete(s.id)}
                        className="w-8 h-8 text-muted-foreground hover:text-secondary"
                        title="Mark complete"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`delete-session-${s.id}`}
                      onClick={() => handleDelete(s.id)}
                      className="w-8 h-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Create session dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="create-session-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Schedule Study Session</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Subject</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger data-testid="session-subject-select">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                  {subjects.length === 0 && <SelectItem value="none" disabled>No subjects yet - add some first</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Title</Label>
              <Input
                data-testid="session-title-input"
                placeholder="e.g. Chapter 3 review"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Time</Label>
                <Input
                  type="time"
                  data-testid="session-time-input"
                  value={form.scheduled_time}
                  onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Duration (min)</Label>
                <Input
                  type="number"
                  data-testid="session-duration-input"
                  min="15"
                  max="480"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Notes (optional)</Label>
              <Input
                data-testid="session-notes-input"
                placeholder="Any notes..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 rounded-xl">
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="save-session-button"
                disabled={saving}
                className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl"
              >
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Schedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
