import { useState } from "react";
import { Plus, Trash2, Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Therapist, Service } from "@/services/types";
import { addTherapist, saveTherapist, removeTherapist } from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminTherapistsTabProps {
  therapists: Therapist[];
  setTherapists: React.Dispatch<React.SetStateAction<Therapist[]>>;
  services: Service[];
}

export function AdminTherapistsTab({ therapists, setTherapists, services }: AdminTherapistsTabProps) {
  const [newName, setNewName] = useState("");
  const [newServiceIds, setNewServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const patch = (id: string, changes: Partial<Therapist>) => {
    setTherapists((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  };

  const toggleService = (therapistId: string, serviceId: string, current: string[]) => {
    const updated = current.includes(serviceId)
      ? current.filter((s) => s !== serviceId)
      : [...current, serviceId];
    patch(therapistId, { serviceIds: updated });
  };

  const handleSave = async (therapist: Therapist) => {
    if (!therapist.name.trim()) { toast.error("יש להזין שם מטפלת"); return; }
    setSaving(therapist.id);
    try {
      await saveTherapist(therapist);
      toast.success(`${therapist.name} נשמרה`);
    } catch {
      toast.error("שמירה נכשלה");
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await removeTherapist(id);
      setTherapists((prev) => prev.filter((t) => t.id !== id));
      toast.success(`${name} הוסרה`);
    } catch {
      toast.error("מחיקה נכשלה");
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("יש להזין שם"); return; }
    try {
      const created = await addTherapist(newName.trim(), newServiceIds);
      setTherapists((prev) => [...prev, created]);
      setNewName("");
      setNewServiceIds([]);
      toast.success("המטפלת נוספה");
    } catch {
      toast.error("הוספה נכשלה");
    }
  };

  return (
    <div className="space-y-5">
      {/* קיימות */}
      {therapists.map((therapist) => (
        <div key={therapist.id} className="rounded-lg border border-border bg-card p-4 shadow-card space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* שם */}
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">שם המטפלת</Label>
              <Input
                value={therapist.name}
                onChange={(e) => patch(therapist.id, { name: e.target.value })}
                className="font-medium"
              />
            </div>
            {/* פעילה */}
            <div className="flex flex-col items-center gap-1">
              <Label className="text-xs text-muted-foreground">פעילה</Label>
              <Switch
                checked={therapist.isActive}
                onCheckedChange={(v) => patch(therapist.id, { isActive: v })}
              />
            </div>
          </div>

          {/* שירותים */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">שירותים שמטפלת ב:</Label>
            <div className="flex flex-wrap gap-2">
              {services.map((svc) => {
                const active = therapist.serviceIds.includes(svc.id);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => toggleService(therapist.id, svc.id, therapist.serviceIds)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary"
                    )}
                  >
                    {svc.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* כפתורים */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="hero"
              size="sm"
              onClick={() => handleSave(therapist)}
              disabled={saving === therapist.id}
              className="gap-1"
            >
              {saving === therapist.id
                ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />שומר...</>
                : <><Save className="h-3.5 w-3.5" />שמור</>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(therapist.id, therapist.name)}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              הסר
            </Button>
          </div>
        </div>
      ))}

      {/* הוספת מטפלת חדשה */}
      <div className="rounded-lg border border-dashed border-primary/40 bg-secondary/30 p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          הוספת מטפלת חדשה
        </h3>
        <div>
          <Label className="text-sm mb-1.5 block">שם</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="לדוגמה: שרה לוי"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">שירותים (ניתן לשנות אחר כך)</Label>
          <div className="flex flex-wrap gap-2">
            {services.map((svc) => {
              const active = newServiceIds.includes(svc.id);
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() =>
                    setNewServiceIds((prev) =>
                      active ? prev.filter((s) => s !== svc.id) : [...prev, svc.id]
                    )
                  }
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary"
                  )}
                >
                  {svc.name}
                </button>
              );
            })}
          </div>
        </div>
        <Button variant="hero" size="sm" onClick={handleAdd} className="gap-1">
          <Plus className="h-4 w-4" />
          הוסף מטפלת
        </Button>
      </div>
    </div>
  );
}

