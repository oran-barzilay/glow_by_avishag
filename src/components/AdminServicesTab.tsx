import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addService, CreateServiceInput, deleteService, updateService } from "@/services/api";
import { Service } from "@/services/types";
import { SERVICE_COLOR_OPTIONS, SERVICE_ICON_OPTIONS } from "@/lib/serviceDisplay";
import { toast } from "sonner";

interface AdminServicesTabProps {
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
}

const defaultDraft = (): CreateServiceInput => ({
  name: "",
  description: "",
  duration: 30,
  price: 0,
  icon: "Sparkles",
  color: "service-nails",
});

export function AdminServicesTab({ services, setServices }: AdminServicesTabProps) {
  const [draft, setDraft] = useState<CreateServiceInput>(defaultDraft);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const patchService = (id: string, patch: Partial<Service>) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const handleSave = async (service: Service) => {
    if (!service.name.trim()) {
      toast.error("נא למלא שם שירות");
      return;
    }
    if (service.duration < 5 || service.duration > 480) {
      toast.error("משך זמן: בין 5 ל־480 דקות");
      return;
    }
    if (service.price < 0) {
      toast.error("מחיר לא יכול להיות שלילי");
      return;
    }
    try {
      const saved = await updateService({
        ...service,
        name: service.name.trim(),
        description: service.description.trim(),
      });
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      toast.success("השירות נשמר");
    } catch {
      toast.error("שמירה נכשלה");
    }
  };

  const handleAdd = async () => {
    if (!draft.name.trim()) {
      toast.error("נא למלא שם לשירות החדש");
      return;
    }
    if (draft.duration < 5 || draft.duration > 480) {
      toast.error("משך זמן: בין 5 ל־480 דקות");
      return;
    }
    try {
      const created = await addService({
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
      });
      setServices((prev) => [...prev, created]);
      setDraft(defaultDraft());
      toast.success("השירות נוסף");
    } catch {
      toast.error("הוספה נכשלה");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteService(deleteId);
      setServices((prev) => prev.filter((s) => s.id !== deleteId));
      toast.success("השירות נמחק");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "מחיקה נכשלה");
    }
    setDeleteId(null);
  };

  return (
    <>
      <div className="space-y-6">
        {services.map((service) => (
          <div
            key={service.id}
            className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor={`name-${service.id}`}>שם השירות</Label>
                <Input
                  id={`name-${service.id}`}
                  value={service.name}
                  onChange={(e) => patchService(service.id, { name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor={`desc-${service.id}`}>תיאור</Label>
                <Textarea
                  id={`desc-${service.id}`}
                  value={service.description}
                  onChange={(e) =>
                    patchService(service.id, { description: e.target.value })
                  }
                  className="mt-1.5 min-h-[72px]"
                />
              </div>
              <div>
                <Label htmlFor={`dur-${service.id}`}>משך (דקות)</Label>
                <Input
                  id={`dur-${service.id}`}
                  type="number"
                  min={5}
                  max={480}
                  value={service.duration}
                  onChange={(e) =>
                    patchService(service.id, {
                      duration: Number.parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="mt-1.5"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor={`price-${service.id}`}>מחיר (₪)</Label>
                <Input
                  id={`price-${service.id}`}
                  type="number"
                  min={0}
                  value={service.price}
                  onChange={(e) =>
                    patchService(service.id, {
                      price: Number.parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="mt-1.5"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor={`icon-${service.id}`}>אייקון</Label>
                <select
                  id={`icon-${service.id}`}
                  value={service.icon}
                  onChange={(e) =>
                    patchService(service.id, { icon: e.target.value })
                  }
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SERVICE_ICON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`color-${service.id}`}>צבע בכרטיס</Label>
                <select
                  id={`color-${service.id}`}
                  value={service.color}
                  onChange={(e) =>
                    patchService(service.id, { color: e.target.value })
                  }
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SERVICE_COLOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="hero" onClick={() => handleSave(service)}>
                שמור שינויים
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1 text-destructive hover:text-destructive"
                onClick={() => setDeleteId(service.id)}
              >
                <Trash2 className="h-4 w-4" />
                מחק שירות
              </Button>
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-dashed border-primary/40 bg-secondary/30 p-4 sm:p-5">
          <h3 className="mb-4 text-lg font-semibold">הוספת שירות חדש</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="new-name">שם השירות</Label>
              <Input
                id="new-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="mt-1.5"
                placeholder="לדוגמה: פדיקור"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="new-desc">תיאור</Label>
              <Textarea
                id="new-desc"
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                className="mt-1.5 min-h-[72px]"
              />
            </div>
            <div>
              <Label htmlFor="new-dur">משך (דקות)</Label>
              <Input
                id="new-dur"
                type="number"
                min={5}
                max={480}
                value={draft.duration}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    duration: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="mt-1.5"
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="new-price">מחיר (₪)</Label>
              <Input
                id="new-price"
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    price: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="mt-1.5"
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="new-icon">אייקון</Label>
              <select
                id="new-icon"
                value={draft.icon}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, icon: e.target.value }))
                }
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SERVICE_ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="new-color">צבע בכרטיס</Label>
              <select
                id="new-color"
                value={draft.color}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, color: e.target.value }))
                }
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SERVICE_COLOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button type="button" variant="hero" className="mt-4 gap-2" onClick={handleAdd}>
            הוספת שירות
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent dir="rtl" className="text-start">
          <AlertDialogHeader className="sm:text-start">
            <AlertDialogTitle>למחוק את השירות?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו לא תאפשר מחיקה אם קיימים תורים פעילים או ממתינים לאישור עבור שירות זה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel type="button">ביטול</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete}>
              מחק
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
