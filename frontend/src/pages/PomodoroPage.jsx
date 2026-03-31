import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { API } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Play, Pause, RotateCcw, Coffee, CheckCircle2, Flame } from "lucide-react";
import { useToast } from "../hooks/use-toast";

const CIRCLE_R = 90;
const CIRCLE_C = 2 * Math.PI * CIRCLE_R;

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function PomodoroPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");

  // Settings
  const [workMins, setWorkMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [longBreakMins, setLongBreakMins] = useState(15);

  // Timer state
  const [mode, setMode] = useState("work"); // work | break | longBreak
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [totalFocusMins, setTotalFocusMins] = useState(0);
  const [todayStats, setTodayStats] = useState({ today_pomodoros: 0, today_minutes: 0 });

  const intervalRef = useRef(null);
  const totalTime = mode === "work" ? workMins * 60 : mode === "break" ? breakMins * 60 : longBreakMins * 60;
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * CIRCLE_C : 0;
  const dashOffset = CIRCLE_C - progress;

  useEffect(() => {
    axios.get(`${API}/subjects`, { withCredentials: true }).then(r => setSubjects(r.data)).catch(() => {});
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API}/pomodoro/stats`, { withCredentials: true });
      setTodayStats(data);
    } catch {}
  };

  const tick = useCallback(() => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        handleTimerEnd();
        return 0;
      }
      return prev - 1;
    });
  }, []);

  const handleTimerEnd = () => {
    setRunning(false);
    clearInterval(intervalRef.current);

    if (mode === "work") {
      const newCount = completedPomodoros + 1;
      const newFocusMins = totalFocusMins + workMins;
      setCompletedPomodoros(newCount);
      setTotalFocusMins(newFocusMins);

      // Log to backend
      axios.post(`${API}/pomodoro/log`, {
        subject_id: (selectedSubject && selectedSubject !== "none") ? selectedSubject : null,
        pomodoros_completed: 1,
        total_focus_minutes: workMins
      }, { withCredentials: true }).then(() => fetchStats()).catch(() => {});

      toast({ title: `Pomodoro ${newCount} complete!`, description: "Time for a break." });

      // Switch to break
      if (newCount % 4 === 0) {
        setMode("longBreak");
        setTimeLeft(longBreakMins * 60);
      } else {
        setMode("break");
        setTimeLeft(breakMins * 60);
      }
    } else {
      toast({ title: "Break over!", description: "Ready to focus?" });
      setMode("work");
      setTimeLeft(workMins * 60);
    }
  };

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, tick]);

  const handleReset = () => {
    setRunning(false);
    clearInterval(intervalRef.current);
    const t = mode === "work" ? workMins : mode === "break" ? breakMins : longBreakMins;
    setTimeLeft(t * 60);
  };

  const switchMode = (newMode) => {
    setRunning(false);
    clearInterval(intervalRef.current);
    setMode(newMode);
    const t = newMode === "work" ? workMins : newMode === "break" ? breakMins : longBreakMins;
    setTimeLeft(t * 60);
  };

  const modeColor = mode === "work" ? "hsl(var(--primary))" : mode === "break" ? "hsl(var(--secondary))" : "#8B5CF6";
  const modeBg = mode === "work" ? "bg-primary/10" : mode === "break" ? "bg-secondary/10" : "bg-purple-100 dark:bg-purple-900/20";
  const modeText = mode === "work" ? "Focus Time" : mode === "break" ? "Short Break" : "Long Break";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>Pomodoro Timer</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Stay focused with timed study sessions</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Timer */}
        <Card className="p-8 flex flex-col items-center border border-border animate-fade-in-up stagger-1" data-testid="pomodoro-timer-card">
          {/* Mode tabs */}
          <div className="flex bg-muted rounded-xl p-1 mb-8 gap-1">
            {[["work", "Focus", Play], ["break", "Break", Coffee], ["longBreak", "Long Break", Coffee]].map(([m, label, Icon]) => (
              <button
                key={m}
                data-testid={`mode-${m}`}
                onClick={() => switchMode(m)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${mode === m ? "bg-white dark:bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>

          {/* SVG Circle Timer */}
          <div className="relative" data-testid="timer-circle">
            <svg width="240" height="240" className="transform -rotate-90">
              <circle cx="120" cy="120" r={CIRCLE_R} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
              <circle
                className="timer-ring"
                cx="120" cy="120" r={CIRCLE_R}
                fill="none"
                stroke={modeColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRCLE_C}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`px-3 py-1 rounded-full text-xs font-bold mb-2 ${modeBg}`} style={{ color: modeColor }}>
                {modeText}
              </div>
              <span
                data-testid="timer-display"
                className="text-5xl font-extrabold tracking-tight text-foreground"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              >
                {formatTime(timeLeft)}
              </span>
              {selectedSubject && (
                <p className="text-xs text-muted-foreground mt-2">
                  {subjects.find(s => s.id === selectedSubject)?.name}
                </p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 mt-8">
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              data-testid="timer-reset"
              className="w-11 h-11 rounded-xl border-border hover:border-primary/50"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              data-testid="timer-start-pause"
              onClick={() => setRunning(!running)}
              className="w-20 h-14 rounded-2xl text-white font-bold text-lg transition-all hover:scale-105 hover:shadow-xl"
              style={{ backgroundColor: modeColor }}
            >
              {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 translate-x-0.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              data-testid="skip-to-break"
              onClick={() => switchMode(mode === "work" ? "break" : "work")}
              className="w-11 h-11 rounded-xl border-border hover:border-primary/50"
              title="Skip"
            >
              <Coffee className="w-4 h-4" />
            </Button>
          </div>

          {/* Session counter */}
          <div className="flex items-center gap-2 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                data-testid={`pomodoro-dot-${i}`}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${i < (completedPomodoros % 4) ? "bg-primary scale-110" : "bg-muted-foreground/20"}`}
              />
            ))}
            <span className="text-sm text-muted-foreground ml-2 font-medium">{completedPomodoros} completed</span>
          </div>

          {/* Subject selector */}
          <div className="mt-6 w-full max-w-xs">
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger data-testid="pomodoro-subject-select" className="h-9 text-sm">
                <SelectValue placeholder="Select subject (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No subject</SelectItem>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Settings & Stats */}
        <div className="space-y-4">
          {/* Today stats */}
          <Card className="p-5 border border-border animate-fade-in-up stagger-2" data-testid="pomodoro-stats">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <Flame className="w-4 h-4 text-primary" /> Today's Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/5 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-primary" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="today-pomodoros">
                  {todayStats.today_pomodoros + (completedPomodoros > 0 ? completedPomodoros : 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Pomodoros</p>
              </div>
              <div className="bg-secondary/5 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-secondary" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="today-focus-mins">
                  {todayStats.today_minutes + totalFocusMins}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Focus mins</p>
              </div>
            </div>
          </Card>

          {/* Timer Settings */}
          <Card className="p-5 border border-border animate-fade-in-up stagger-3" data-testid="timer-settings">
            <h3 className="font-semibold text-foreground mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>Settings</h3>
            <div className="space-y-3">
              {[
                { label: "Focus (min)", value: workMins, set: (v) => { setWorkMins(v); if (mode === "work") setTimeLeft(v * 60); }, testId: "work-mins-input" },
                { label: "Short Break (min)", value: breakMins, set: (v) => { setBreakMins(v); if (mode === "break") setTimeLeft(v * 60); }, testId: "break-mins-input" },
                { label: "Long Break (min)", value: longBreakMins, set: (v) => { setLongBreakMins(v); if (mode === "longBreak") setTimeLeft(v * 60); }, testId: "long-break-mins-input" },
              ].map(({ label, value, set, testId }) => (
                <div key={label} className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">{label}</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => !running && value > 1 && set(value - 1)} className="w-6 h-6 rounded-lg bg-muted hover:bg-border transition-colors text-foreground font-bold text-sm disabled:opacity-50">−</button>
                    <span data-testid={testId} className="w-8 text-center text-sm font-bold text-foreground">{value}</span>
                    <button onClick={() => !running && value < 90 && set(value + 1)} className="w-6 h-6 rounded-lg bg-muted hover:bg-border transition-colors text-foreground font-bold text-sm">+</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* How it works */}
          <Card className="p-5 border border-border animate-fade-in-up stagger-4">
            <h3 className="font-semibold text-foreground mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>How it works</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              {[
                ["1", "Focus for 25 minutes without interruption"],
                ["2", "Take a 5-minute break"],
                ["3", "Repeat 4 times, then take a 15-min break"],
                ["4", "Track your progress and build streaks!"],
              ].map(([n, text]) => (
                <div key={n} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">{n}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
