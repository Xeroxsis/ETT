import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Badge } from "../components/ui/badge";
import { Plus, Pencil, Trash2, Check, ChevronDown, ChevronUp, Loader2, BookOpen } from "lucide-react";
import { useToast } from "../hooks/use-toast";

const COLORS = ["#F97316", "#10B981", "#3B82F6", "#8B5CF6", "#EF4444", "#F59E0B", "#06B6D4", "#EC4899"];

function TopicItem({ topic, onToggle, onDelete }) {
  return (
    <div data-testid={`topic-item-${topic.id}`} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
      <button
        data-testid={`toggle-topic-${topic.id}`}
        onClick={() => onToggle(topic.id)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${topic.is_completed ? "bg-secondary border-secondary" : "border-border hover:border-primary"}`}
      >
        {topic.is_completed && <Check className="w-3 h-3 text-white" />}
      </button>
      <span className={`flex-1 text-sm ${topic.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
        {topic.name}
      </span>
      {topic.description && <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[150px]">{topic.description}</span>}
      <button
        data-testid={`delete-topic-${topic.id}`}
        onClick={() => onDelete(topic.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SubjectCard({ subject, onEdit, onDelete, onTopicsChange }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [topics, setTopics] = useState([]);
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [addingTopic, setAddingTopic] = useState(false);

  const progress = subject.topic_count > 0 ? Math.round(subject.completed_topic_count / subject.topic_count * 100) : 0;

  const loadTopics = async () => {
    if (topicsLoaded) return;
    try {
      const { data } = await axios.get(`${API}/subjects/${subject.id}/topics`, { withCredentials: true });
      setTopics(data);
      setTopicsLoaded(true);
    } catch {}
  };

  const handleExpand = async () => {
    if (!expanded) await loadTopics();
    setExpanded(!expanded);
  };

  const handleAddTopic = async (e) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    setAddingTopic(true);
    try {
      const { data } = await axios.post(`${API}/subjects/${subject.id}/topics`, { name: newTopicName.trim() }, { withCredentials: true });
      setTopics(prev => [...prev, data]);
      setNewTopicName("");
      onTopicsChange();
      toast({ title: "Topic added!" });
    } catch {
      toast({ title: "Failed to add topic", variant: "destructive" });
    } finally {
      setAddingTopic(false);
    }
  };

  const handleToggle = async (topicId) => {
    try {
      const { data } = await axios.patch(`${API}/topics/${topicId}/toggle`, {}, { withCredentials: true });
      setTopics(prev => prev.map(t => t.id === topicId ? data : t));
      onTopicsChange();
    } catch {
      toast({ title: "Failed to update topic", variant: "destructive" });
    }
  };

  const handleDeleteTopic = async (topicId) => {
    try {
      await axios.delete(`${API}/topics/${topicId}`, { withCredentials: true });
      setTopics(prev => prev.filter(t => t.id !== topicId));
      onTopicsChange();
    } catch {
      toast({ title: "Failed to delete topic", variant: "destructive" });
    }
  };

  return (
    <Card data-testid={`subject-card-${subject.id}`} className="border border-border hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: subject.color + "20" }}>
              <BookOpen className="w-5 h-5" style={{ color: subject.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>{subject.name}</h3>
              {subject.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{subject.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground" onClick={() => onEdit(subject)} data-testid={`edit-subject-${subject.id}`}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(subject.id)} data-testid={`delete-subject-${subject.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{subject.completed_topic_count}/{subject.topic_count} topics</span>
          <Badge style={{ backgroundColor: subject.color + "20", color: subject.color }} className="text-xs">{progress}%</Badge>
        </div>
        <Progress value={progress} className="h-1.5 mb-4" />

        <button
          data-testid={`expand-topics-${subject.id}`}
          onClick={handleExpand}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide topics" : `Show topics (${subject.topic_count})`}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border px-5 pb-4 pt-3 animate-fade-in">
          {topics.length === 0 && <p className="text-xs text-muted-foreground py-2">No topics yet</p>}
          <div className="space-y-0.5 mb-3">
            {topics.map(t => (
              <TopicItem key={t.id} topic={t} onToggle={handleToggle} onDelete={handleDeleteTopic} />
            ))}
          </div>
          <form onSubmit={handleAddTopic} className="flex gap-2">
            <Input
              data-testid={`add-topic-input-${subject.id}`}
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="New topic name..."
              className="h-8 text-sm"
            />
            <Button
              type="submit"
              size="sm"
              data-testid={`add-topic-btn-${subject.id}`}
              disabled={addingTopic || !newTopicName.trim()}
              className="bg-primary hover:bg-primary/90 text-white h-8 px-3 rounded-lg shrink-0"
            >
              {addingTopic ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}

export default function SubjectsPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [form, setForm] = useState({ name: "", color: "#F97316", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchSubjects = async () => {
    try {
      const { data } = await axios.get(`${API}/subjects`, { withCredentials: true });
      setSubjects(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchSubjects(); }, []);

  const openAdd = () => {
    setEditSubject(null);
    setForm({ name: "", color: "#F97316", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (s) => {
    setEditSubject(s);
    setForm({ name: s.name, color: s.color, description: s.description || "" });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editSubject) {
        await axios.put(`${API}/subjects/${editSubject.id}`, form, { withCredentials: true });
        toast({ title: "Subject updated!" });
      } else {
        await axios.post(`${API}/subjects`, form, { withCredentials: true });
        toast({ title: "Subject created!" });
      }
      setDialogOpen(false);
      fetchSubjects();
    } catch (err) {
      toast({ title: err?.response?.data?.detail || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this subject and all its topics?")) return;
    try {
      await axios.delete(`${API}/subjects/${id}`, { withCredentials: true });
      toast({ title: "Subject deleted" });
      fetchSubjects();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>Subjects & Topics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track your learning progress by subject</p>
        </div>
        <Button data-testid="add-subject-button" onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Add Subject
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>No subjects yet</h2>
          <p className="text-muted-foreground mb-6">Add your first subject to start tracking progress</p>
          <Button data-testid="add-first-subject-button" onClick={openAdd} className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2">
            <Plus className="w-4 h-4" /> Add Your First Subject
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="subjects-grid">
          {subjects.map((s, i) => (
            <div key={s.id} className={`animate-fade-in-up stagger-${Math.min(i + 1, 5)}`}>
              <SubjectCard subject={s} onEdit={openEdit} onDelete={handleDelete} onTopicsChange={fetchSubjects} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="subject-dialog">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              {editSubject ? "Edit Subject" : "Add New Subject"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Subject Name</Label>
              <Input
                data-testid="subject-name-input"
                placeholder="e.g. Mathematics"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description (optional)</Label>
              <Input
                data-testid="subject-description-input"
                placeholder="Brief description..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    data-testid={`color-${c.replace("#", "")}`}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button type="submit" data-testid="save-subject-button" disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : editSubject ? "Save Changes" : "Add Subject"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
