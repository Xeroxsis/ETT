import { useEffect, useState } from "react";
import axios from "axios";
import { API, useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Flame, Clock, BookOpen, CheckCircle2, CalendarDays, TrendingUp, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

function StatCard({ icon: Icon, label, value, sublabel, color, testId, delay }) {
  return (
    <Card
      data-testid={testId}
      className={`p-6 border border-border hover:-translate-y-1 hover:shadow-lg transition-all duration-200 animate-fade-in-up stagger-${delay}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-extrabold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>{value}</p>
          {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-primary">{payload[0]?.value} min</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data: d } = await axios.get(`${API}/dashboard`, { withCredentials: true });
      setData(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markComplete = async (sessionId) => {
    try {
      await axios.patch(`${API}/sessions/${sessionId}/complete`, {}, { withCredentials: true });
      fetchDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const totalHours = data ? Math.round((data.total_study_minutes || 0) / 60 * 10) / 10 : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.name?.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground mt-1">Here's your study progress overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Flame} label="Study Streak" value={`${data?.streak_count || 0}d`} sublabel="consecutive days" color="bg-orange-100 dark:bg-orange-900/30 text-orange-500" testId="streak-card" delay="1" />
        <StatCard icon={Clock} label="Total Study" value={`${totalHours}h`} sublabel="all time" color="bg-blue-100 dark:bg-blue-900/30 text-blue-500" testId="study-time-card" delay="2" />
        <StatCard icon={CalendarDays} label="Today's Sessions" value={data?.today_sessions?.length || 0} sublabel="scheduled today" color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500" testId="today-sessions-card" delay="3" />
        <StatCard icon={BookOpen} label="Subjects" value={data?.subjects_progress?.length || 0} sublabel="active subjects" color="bg-purple-100 dark:bg-purple-900/30 text-purple-500" testId="subjects-card" delay="4" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Weekly chart */}
        <Card className="lg:col-span-2 p-6 border border-border animate-fade-in-up stagger-2" data-testid="weekly-chart">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <TrendingUp className="w-4 h-4 inline mr-2 text-primary" />Weekly Study Time
            </h2>
            <Badge variant="secondary" className="text-xs">Last 7 days</Badge>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.weekly_stats || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="focus_minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Subjects progress */}
        <Card className="p-6 border border-border animate-fade-in-up stagger-3" data-testid="subjects-progress">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>Subject Progress</h2>
            <Link to="/subjects" className="text-xs text-primary hover:text-primary/80 transition-colors">View all</Link>
          </div>
          {data?.subjects_progress?.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No subjects yet</p>
              <Link to="/subjects" className="text-sm text-primary hover:text-primary/80 mt-2 block">Add subjects</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.subjects_progress?.slice(0, 5).map((s) => (
                <div key={s.id} data-testid={`subject-progress-${s.id}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-sm font-medium text-foreground truncate max-w-[120px]">{s.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{s.completed_topic_count}/{s.topic_count}</span>
                  </div>
                  <Progress value={s.progress} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Today's sessions */}
      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <Card className="p-6 border border-border animate-fade-in-up stagger-4" data-testid="today-schedule">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>Today's Schedule</h2>
            <Link to="/calendar" className="text-xs text-primary hover:text-primary/80 transition-colors">Add session</Link>
          </div>
          {data?.today_sessions?.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No sessions today</p>
              <Link to="/calendar" className="text-sm text-primary hover:text-primary/80 mt-1 block">Schedule a session</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.today_sessions.map((s) => (
                <div key={s.id} data-testid={`session-item-${s.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border hover:border-primary/30 transition-colors">
                  <div className="w-1 h-10 rounded-full" style={{ backgroundColor: s.subject_color || "#F97316" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.scheduled_time} · {s.duration_minutes}min · {s.subject_name}</p>
                  </div>
                  {s.status === "scheduled" && (
                    <button
                      data-testid={`complete-session-${s.id}`}
                      onClick={() => markComplete(s.id)}
                      className="shrink-0 text-muted-foreground hover:text-secondary transition-colors"
                      title="Mark complete"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  )}
                  {s.status === "completed" && (
                    <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming sessions */}
        <Card className="p-6 border border-border animate-fade-in-up stagger-5" data-testid="upcoming-sessions">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>Upcoming Sessions</h2>
            <Badge variant="outline" className="text-xs">Next 7 days</Badge>
          </div>
          {data?.upcoming_sessions?.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming sessions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.upcoming_sessions.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{new Date(s.scheduled_date + "T00:00").getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.subject_name} · {s.duration_minutes}min</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
