import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Edit2, Trash2, Tag } from "lucide-react";
import type { ContractTemplate } from "@shared/schema";

const PLACEHOLDERS = [
  ["{{buyerName}}", "Kjøpers navn"],
  ["{{buyerEmail}}", "Kjøpers e-post"],
  ["{{buyerPhone}}", "Kjøpers telefon"],
  ["{{buyerAddress}}", "Kjøpers adresse"],
  ["{{buyerPersonNumber}}", "Kjøpers fødselsnummer"],
  ["{{sellerName}}", "Selgers navn"],
  ["{{sellerEmail}}", "Selgers e-post"],
  ["{{sellerPhone}}", "Selgers telefon"],
  ["{{sellerAddress}}", "Selgers adresse"],
  ["{{sellerPersonNumber}}", "Selgers fødselsnummer"],
  ["{{vehicleMake}}", "Bilmerke"],
  ["{{vehicleModel}}", "Modell"],
  ["{{vehicleYear}}", "Årsmodell"],
  ["{{vehicleVin}}", "Chassisnummer (VIN)"],
  ["{{vehicleMileage}}", "Kilometerstand"],
  ["{{vehicleColor}}", "Farge"],
  ["{{vehicleRegNo}}", "Registreringsnummer"],
  ["{{vehicleEquipment}}", "Utstyr"],
  ["{{vehicleTires}}", "Dekk"],
  ["{{vehiclePrice}}", "Pris (kr)"],
  ["{{vehicleFuelType}}", "Drivstoff"],
  ["{{vehicleTransmission}}", "Girkasse"],
  ["{{vehicleBodyType}}", "Karosseri"],
  ["{{notes}}", "Merknader"],
  ["{{contractId}}", "Kontrakt-ID"],
  ["{{date}}", "Signeringsdato"],
];

const DEFAULT_TEMPLATE = `KJØPSKONTRAKT

Kontrakt nr: {{contractId}}
Dato: {{date}}

KJØPER
Navn: {{buyerName}}
Fødselsnummer: {{buyerPersonNumber}}
Adresse: {{buyerAddress}}
Telefon: {{buyerPhone}}
E-post: {{buyerEmail}}

SELGER
Navn: {{sellerName}}
Fødselsnummer: {{sellerPersonNumber}}
Adresse: {{sellerAddress}}
Telefon: {{sellerPhone}}
E-post: {{sellerEmail}}

KJØRETØY
Merke/Modell: {{vehicleMake}} {{vehicleModel}} ({{vehicleYear}})
Registreringsnummer: {{vehicleRegNo}}
Chassisnummer (VIN): {{vehicleVin}}
Kilometerstand: {{vehicleMileage}} km
Farge: {{vehicleColor}}
Drivstoff: {{vehicleFuelType}}
Girkasse: {{vehicleTransmission}}
Karosseri: {{vehicleBodyType}}

UTSTYR OG EKSTRAUTSTYR
{{vehicleEquipment}}

DEKK
{{vehicleTires}}

PRIS
Kjøpesum: kr {{vehiclePrice}},-

MERKNADER
{{notes}}

---
Partene bekrefter med sin signatur at ovenstående er korrekt.`;

export default function ContractTemplatesPage() {
  const { roleName } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: templates = [], isLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contract-templates"],
  });

  // Redirect non-admins
  if (roleName && roleName !== "Admin") {
    setLocation("/contracts");
    return null;
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contract-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      toast({ title: "Mal slettet" });
    },
    onError: () => toast({ title: "Kunne ikke slette mal", variant: "destructive" }),
  });

  const editingTemplate = templates.find(t => t.id === editingId);

  return (
    <LayoutShell>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kontraktmaler</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Maler for innkjøps- og salgskontrakter — kun Admin kan redigere
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} data-testid="button-new-template">
            <Plus className="h-4 w-4 mr-2" />
            Ny mal
          </Button>
        </div>

        {/* Placeholder guide */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Tag className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 mb-1.5">Tilgjengelige variabler</p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map(([tag, label]) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-white border border-blue-200 rounded px-2 py-0.5 text-xs font-mono text-blue-700"
                    title={label}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Template list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Ingen maler ennå</p>
            <p className="text-sm mt-1">Opprett din første kontraktmal</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div
                key={t.id}
                className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4"
                data-testid={`row-template-${t.id}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${t.type === "innkjøp" ? "bg-blue-50" : "bg-emerald-50"}`}>
                  <FileText className={`h-5 w-5 ${t.type === "innkjøp" ? "text-blue-600" : "text-emerald-600"}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{t.name}</p>
                    <Badge variant="outline" className={t.type === "innkjøp" ? "text-blue-600 border-blue-200" : "text-emerald-600 border-emerald-200"}>
                      {t.type === "innkjøp" ? "Innkjøp" : "Salg"}
                    </Badge>
                    {!t.isActive && (
                      <Badge variant="secondary">Inaktiv</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2 font-mono">
                    {t.content.slice(0, 120)}…
                  </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(t.id)}
                    data-testid={`button-edit-template-${t.id}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 hover:text-red-600"
                        data-testid={`button-delete-template-${t.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Slett mal?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Eksisterende kontrakter som bruker denne malen påvirkes ikke.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600"
                          onClick={() => deleteMutation.mutate(t.id)}
                        >
                          Slett
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TemplateFormDialog
        open={showCreate}
        initialValues={{ name: "", type: "salg", content: DEFAULT_TEMPLATE, isActive: true }}
        onClose={() => setShowCreate(false)}
        onSaved={() => setShowCreate(false)}
      />

      {editingTemplate && (
        <TemplateFormDialog
          key={editingId}
          open
          initialValues={editingTemplate}
          editId={editingId!}
          onClose={() => setEditingId(null)}
          onSaved={() => setEditingId(null)}
        />
      )}
    </LayoutShell>
  );
}

function TemplateFormDialog({
  open, onClose, onSaved, initialValues, editId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialValues: Partial<ContractTemplate>;
  editId?: number;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initialValues.name ?? "");
  const [type, setType] = useState<"innkjøp" | "salg">((initialValues.type as any) ?? "salg");
  const [content, setContent] = useState(initialValues.content ?? DEFAULT_TEMPLATE);
  const [isActive, setIsActive] = useState(initialValues.isActive ?? true);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        return apiRequest("PUT", `/api/contract-templates/${editId}`, { name, type, content, isActive });
      } else {
        return apiRequest("POST", "/api/contract-templates", { name, type, content, isActive });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      toast({ title: editId ? "Mal oppdatert" : "Mal opprettet" });
      onSaved();
    },
    onError: () => toast({ title: "Feil ved lagring", variant: "destructive" }),
  });

  function insertTag(tag: string) {
    const textarea = document.getElementById("template-content") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + tag + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      textarea.focus();
    }, 0);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? "Rediger mal" : "Ny kontraktmal"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Navn *</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="F.eks. Standardkontrakt salg"
                data-testid="input-template-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="innkjøp">Innkjøp</SelectItem>
                  <SelectItem value="salg">Salg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="active-switch" />
            <label htmlFor="active-switch" className="text-sm text-gray-700">Aktiv mal</label>
          </div>

          {/* Quick-insert tag buttons */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Klikk for å sette inn variabel:</p>
            <div className="flex flex-wrap gap-1">
              {PLACEHOLDERS.map(([tag, label]) => (
                <button
                  key={tag}
                  onClick={() => insertTag(tag)}
                  type="button"
                  className="text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded px-2 py-0.5 font-mono transition-colors"
                  title={label}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maltekst *</label>
            <Textarea
              id="template-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              className="font-mono text-sm min-h-[320px]"
              placeholder="Skriv kontraktinnholdet her. Bruk {{variabel}} for dynamisk innhold."
              data-testid="textarea-template-content"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Avbryt
            </Button>
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim() || !content.trim()}
              data-testid="button-save-template"
            >
              {saveMutation.isPending ? "Lagrer…" : editId ? "Lagre endringer" : "Opprett mal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
