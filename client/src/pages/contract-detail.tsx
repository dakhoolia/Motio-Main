import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Send, CheckCircle2, Clock, Loader2,
  ShieldCheck, Trash2, Save, FileText, Mail,
} from "lucide-react";
import type { ContractWithDetails } from "@shared/schema";

const FUEL_TYPES = ["Bensin", "Diesel", "Elektrisk", "Hybrid", "Plug-in hybrid", "Hydrogen", "Annet"];

const DEFAULT_TERMS = `Følgende avtale er inngått mellom selger og bilbutikk

1. INNLEVERING
1.1 Tilstand og levering: Ved innlevering av kjøretøyet skal det være i ren tilstand, uten personlige eiendeler og uten feil eller mangler, med mindre annet er avtalt skriftlig.
1.2 Nøkler, dekk, felger og drivstoff: Kjøretøyet skal leveres med alle nøkler, komplette dekk og felger, samt med en full tank drivstoff.

2. OPPLYSNINGER
2.1 Plassering: Kjøretøyet skal plasseres på forhandlerens salgsområde.
2.2 Dekkbytte: Ved sesongskifte utføres dekkbytte mot en avgift på kr 500,-.
2.3 Salgsannonser: Selger skal ikke ha egne aktive salgsannonser i perioden kjøretøyet er til salg hos forhandler.
2.4 Fastpris: Prisen for kjøretøyet avtales på forhånd som en fastpris. Hvis ønsket pris ikke oppnås i markedet, må Selger gi skriftlig tillatelse for å redusere prisen.
2.5 Ved feil eller mangler: Eventuelle utbedringer av kjøretøyet skal avtales skriftlig mellom forhandler og Selger.
2.6 Eiendomsrett: Kjøretøyet forblir Selgers eiendom inntil eiendomsretten overføres til forhandler.

3. FORSIKRING
Selger skal holde kjøretøyet forsikret inntil overtakelse har funnet sted.

4. ANSVAR
4.1 Forhandler har ansvaret for forsvarlig bruk av kjøretøyet og kun tillater prøvekjøring av seriøse kjøpere.
4.2 Forhandler er ansvarlig for kjøretøyet så lenge det er under deres besittelse. Selskapet står ansvarlig for eventuelle økonomiske tap knyttet til kjøretøyet, med unntak av markedsprissvingninger og plutselige mekaniske feil.

5. HEFTELSER / GJELD
5.1 Økonomiske heftelser: Ved økonomiske heftelser skal Selger innfri disse ovenfor panthaver hvis salgssummen er lavere enn restlånet.
5.2 Oppgjør: Kjøpesummen/tilgodehavende overføres til Selgers konto. Oppgjør utbetales så snart kjøretøyet er omregistrert og oppgjøret er mottatt fra kjøper/bank, eller innen 14 dager.

6. ØKONOMI
Forhandler er juridisk forpliktet til å innbetale avtalte oppgjørssum til Selger/juridisk eier etter et vellykket salg av kjøretøyet.

7. REKLAMASJON
Forhandler påtar seg ansvar og håndtering av reklamasjoner for kjøretøyet etter salg.

8. ANNULLERING
Kjøretøyet kan hentes av juridisk eier etter mottatt betaling av påløpende kostnader og arbeid relatert til kjøretøyet, for kr 3.990,- (inkludert NAF-test, rengjøring og klargjøring / Polering). Dersom forhandler har en aktiv kunde på kjøretøyet, må dette avklares først, før kjøretøyet kan utleveres.`;

// ── Field components defined OUTSIDE ContractDetailPage so React never remounts them ──

function FText({
  value, onChange, placeholder, canEdit, testId, className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  canEdit: boolean;
  testId?: string;
  className?: string;
}) {
  if (!canEdit) {
    return <span className={`text-[13px] text-foreground ${className ?? ""}`}>{value || <span className="text-muted-foreground/40 italic">—</span>}</span>;
  }
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? ""}
      className={`w-full bg-transparent border-b border-dashed border-black/20 dark:border-white/20 focus:border-primary outline-none text-[13px] text-foreground placeholder:text-muted-foreground/40 py-0.5 ${className ?? ""}`}
      data-testid={testId}
    />
  );
}

function FNumber({
  value, onChange, placeholder, canEdit, testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  canEdit: boolean;
  testId?: string;
}) {
  if (!canEdit) {
    return <span className="text-[13px] text-foreground">{value || <span className="text-muted-foreground/40 italic">—</span>}</span>;
  }
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? ""}
      className="w-full bg-transparent border-b border-dashed border-black/20 dark:border-white/20 focus:border-primary outline-none text-[13px] text-foreground placeholder:text-muted-foreground/40 py-0.5"
      data-testid={testId}
    />
  );
}

function FSelect({
  value, onChange, options, canEdit, testId,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  canEdit: boolean;
  testId?: string;
}) {
  if (!canEdit) {
    return <span className="text-[13px] text-foreground">{value || <span className="text-muted-foreground/40 italic">—</span>}</span>;
  }
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-transparent border-b border-dashed border-black/20 dark:border-white/20 focus:border-primary outline-none text-[13px] text-foreground py-0.5"
      data-testid={testId}
    >
      <option value="">Velg…</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function FTextarea({
  value, onChange, placeholder, canEdit, testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  canEdit: boolean;
  testId?: string;
}) {
  if (!canEdit) {
    return <span className="text-[13px] text-foreground">{value || <span className="text-muted-foreground/40 italic">—</span>}</span>;
  }
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? ""}
      className="w-full bg-transparent border border-dashed border-black/20 dark:border-white/20 focus:border-primary outline-none text-[13px] text-foreground placeholder:text-muted-foreground/40 p-1.5 rounded-md min-h-[60px] resize-none"
      data-testid={testId}
    />
  );
}

function Section({ title, color, children }: { title: string; color: "blue" | "emerald" | "slate"; children: React.ReactNode }) {
  const borders = { blue: "border-blue-200/60 dark:border-blue-500/20", emerald: "border-emerald-200/60 dark:border-emerald-500/20", slate: "border-black/[0.07] dark:border-white/[0.09]" };
  const headers = { blue: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400", emerald: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400", slate: "bg-slate-50 dark:bg-white/[0.04] text-muted-foreground" };
  return (
    <div className={`rounded-xl border ${borders[color]} overflow-hidden`}>
      <div className={`px-4 py-2.5 ${headers[color]}`}>
        <h3 className="text-[11px] font-bold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">{label}</p>
      <div>{children}</div>
    </div>
  );
}

// ── BankID modal ──
function BankIdModal({ open, party, onClose, onSigned }: { open: boolean; party: "buyer" | "seller"; onClose: () => void; onSigned: (phone: string) => void; }) {
  const [step, setStep] = useState<"phone" | "waiting" | "done">("phone");
  const [phone, setPhone] = useState("");

  function handleStart() {
    if (phone.replace(/\s/g, "").length < 8) return;
    setStep("waiting");
    setTimeout(() => {
      setStep("done");
      setTimeout(() => { onSigned(phone); setStep("phone"); setPhone(""); }, 1200);
    }, 2500);
  }

  const partyLabel = party === "buyer" ? "kjøper" : "selger";
  return (
    <Dialog open={open} onOpenChange={v => { if (!v && step === "phone") { onClose(); setPhone(""); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Signering — {partyLabel} (simulert)
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          {step === "phone" && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <p className="text-sm text-amber-800 dark:text-amber-400 font-medium">
                  ⚠️ Dette er en simulert signering. Ingen BankID-forespørsel sendes, og ingen identitet verifiseres. Signaturen er ikke en juridisk bindende e-signatur.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Registrer mobilnummeret til {partyLabel} for dokumentasjon:</p>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="4xx xx xxx"
                type="tel"
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="input-bankid-phone"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>Avbryt</Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleStart} disabled={phone.replace(/\s/g, "").length < 8} data-testid="button-bankid-confirm">
                  Bekreft signering (simulert)
                </Button>
              </div>
            </div>
          )}
          {step === "waiting" && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
              <p className="font-semibold">Registrerer signering…</p>
              <p className="text-sm text-muted-foreground">Simulert signering — ingen BankID-verifisering utføres</p>
            </div>
          )}
          {step === "done" && (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <p className="font-semibold">Signering registrert (simulert)</p>
              <p className="text-sm text-muted-foreground">Kontrakten er merket som signert av {partyLabel} — uten identitetsverifisering</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ──
export default function ContractDetailPage() {
  const [, params] = useRoute("/contracts/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { roleName, user } = useAuth();

  const id = Number(params?.id);
  const { data: contract, isLoading } = useQuery<ContractWithDetails>({
    queryKey: ["/api/contracts", id],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const [bankIdModal, setBankIdModal] = useState<"buyer" | "seller" | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const isAdminOrHybrid = roleName === "Admin" || roleName === "Hybrid";
  const canEdit = contract?.status === "draft" && (isAdminOrHybrid || contract?.createdBy === user?.id);
  const canSend = contract?.status === "draft" && (isAdminOrHybrid || contract?.createdBy === user?.id);
  const canSign = contract?.status === "pending";

  const set = useCallback((key: string, value: any) => {
    setForm(f => ({ ...f, [key]: value }));
    setHasChanges(true);
  }, []);

  // Get value: form overrides contract
  const g = useCallback((key: string): string => {
    if (key in form) return form[key] ?? "";
    const v = (contract as any)?.[key];
    return v === null || v === undefined ? "" : String(v);
  }, [form, contract]);

  const updateMutation = useMutation({
    mutationFn: (updates: Record<string, any>) =>
      apiRequest("PUT", `/api/contracts/${id}`, updates).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setForm({});
      setHasChanges(false);
      toast({ title: "Kontrakt lagret" });
    },
    onError: () => toast({ title: "Feil ved lagring", variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (hasChanges) await apiRequest("PUT", `/api/contracts/${id}`, form).then(r => r.json());
      return apiRequest("POST", `/api/contracts/${id}/send`).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setForm({});
      setHasChanges(false);
      toast({ title: "Kontrakt sendt til signering" });
    },
    onError: () => toast({ title: "Feil ved sending", variant: "destructive" }),
  });

  const signMutation = useMutation({
    mutationFn: ({ party, phone }: { party: "buyer" | "seller"; phone: string }) =>
      apiRequest("POST", `/api/contracts/${id}/sign`, { party, phoneNumber: phone }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", id] });
      setBankIdModal(null);
      toast({ title: "Signering registrert (simulert)" });
    },
    onError: () => toast({ title: "Signering feilet", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setLocation("/contracts");
      toast({ title: "Kontrakt slettet" });
    },
    onError: () => toast({ title: "Kunne ikke slette", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </LayoutShell>
    );
  }

  if (!contract) {
    return (
      <LayoutShell>
        <div className="p-6 text-center text-muted-foreground">Kontrakt ikke funnet</div>
      </LayoutShell>
    );
  }

  const today = new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });

  const statusConfig = {
    draft:     { label: "Utkast",              color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    pending:   { label: "Venter på signering", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
    signed:    { label: "Signert",             color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-500" },
    cancelled: { label: "Kansellert",          color: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400" },
  }[contract.status] ?? { label: contract.status, color: "bg-gray-100 text-gray-600" };

  const typeColor = contract.type === "innkjøp"
    ? "text-blue-600 bg-blue-50 dark:bg-blue-950/30"
    : "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30";
  const typeLabel = contract.type === "innkjøp" ? "Innkjøpskontrakt" : "Salgskontrakt";

  const priceNum = g("vehiclePrice");
  const priceFormatted = priceNum ? `kr ${Number(priceNum).toLocaleString("nb-NO")},–` : "";
  const settlementNum = g("settlementAmount");
  const settlementFormatted = settlementNum ? `kr ${Number(settlementNum).toLocaleString("nb-NO")},–` : "";
  const customTermsValue = g("customTerms") || DEFAULT_TERMS;

  return (
    <LayoutShell>
      <div className="max-w-5xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Button>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${typeColor}`}>{typeLabel}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusConfig.color}`}>{statusConfig.label}</span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {hasChanges && canEdit && (
              <Button size="sm" variant="outline" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} data-testid="button-save-contract">
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {updateMutation.isPending ? "Lagrer…" : "Lagre"}
              </Button>
            )}
            {canSend && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} data-testid="button-send-contract">
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                {sendMutation.isPending ? "Sender…" : "Send til signering"}
              </Button>
            )}
            {contract.status === "draft" && isAdminOrHybrid && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 border-red-200">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Slett kontrakt?</AlertDialogTitle>
                    <AlertDialogDescription>Dette kan ikke angres.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => deleteMutation.mutate()}>Slett</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Contract document */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Document header */}
          <div className="bg-slate-700 dark:bg-slate-900 text-white px-6 py-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{typeLabel}</h1>
              <p className="text-slate-300 text-xs mt-0.5">
                Kontrakt #{contract.id} · Opprettet {new Date(contract.createdAt).toLocaleDateString("nb-NO")}
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-300 leading-relaxed">
              <p className="font-semibold text-white text-sm">{g("buyerName") || "Forhandler"}</p>
              <p>{g("buyerAddress") || ""}</p>
              <p>{g("buyerEmail") || ""}</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Header row: Dato | Kontaktperson | Overtakelsesdato | Sted */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-black/[0.07] dark:border-white/[0.08]">
              <Field label="Dato">
                <span className="text-[13px] font-medium text-foreground">{today}</span>
              </Field>
              <Field label="Kontaktperson">
                <FText value={g("contactPerson")} onChange={v => set("contactPerson", v)} placeholder="Navn på kontaktperson" canEdit={canEdit} testId="input-contactPerson" />
              </Field>
              <Field label="Overtakelsesdato">
                <FText value={g("handoverDate")} onChange={v => set("handoverDate", v)} placeholder="DD/MM/ÅÅÅÅ" canEdit={canEdit} testId="input-handoverDate" />
              </Field>
              <Field label="Kontrakt inngått sted">
                <FText value={g("contractLocation")} onChange={v => set("contractLocation", v)} placeholder="F.eks. Hos forhandler" canEdit={canEdit} testId="input-contractLocation" />
              </Field>
            </div>

            {/* Selger */}
            <Section title={contract.type === "innkjøp" ? "Selger" : "Selger (Forhandler)"} color="blue">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                <Field label="F.nr / D-nummer (fødselsnummer)">
                  <FText value={g("sellerPersonNumber")} onChange={v => set("sellerPersonNumber", v)} placeholder="11 siffer" canEdit={canEdit} testId="input-sellerPersonNumber" />
                </Field>
                <Field label="Navn">
                  <FText value={g("sellerName")} onChange={v => set("sellerName", v)} placeholder="Fullt navn" canEdit={canEdit} testId="input-sellerName" />
                </Field>
                <Field label="Adresse">
                  <FText value={g("sellerAddress")} onChange={v => set("sellerAddress", v)} placeholder="Gateadresse" canEdit={canEdit} testId="input-sellerAddress" />
                </Field>
                <Field label="Postnr.">
                  <FText value={g("sellerPostalCode")} onChange={v => set("sellerPostalCode", v)} placeholder="0000" canEdit={canEdit} testId="input-sellerPostalCode" />
                </Field>
                <Field label="Sted">
                  <FText value={g("sellerCity")} onChange={v => set("sellerCity", v)} placeholder="By/sted" canEdit={canEdit} testId="input-sellerCity" />
                </Field>
                <Field label="E-post">
                  <FText value={g("sellerEmail")} onChange={v => set("sellerEmail", v)} placeholder="epost@eksempel.no" canEdit={canEdit} testId="input-sellerEmail" />
                </Field>
                <Field label="Mobil">
                  <FText value={g("sellerPhone")} onChange={v => set("sellerPhone", v)} placeholder="4xx xx xxx" canEdit={canEdit} testId="input-sellerPhone" />
                </Field>
              </div>
            </Section>

            {/* Kjøper */}
            <Section title={contract.type === "innkjøp" ? "Kjøper (Forhandler)" : "Kjøper"} color="emerald">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                <Field label={contract.type === "innkjøp" ? "Org.nr" : "F.nr / D-nummer"}>
                  <FText value={g("buyerPersonNumber")} onChange={v => set("buyerPersonNumber", v)} placeholder={contract.type === "innkjøp" ? "Org.nr" : "11 siffer"} canEdit={canEdit} testId="input-buyerPersonNumber" />
                </Field>
                <Field label="Navn">
                  <FText value={g("buyerName")} onChange={v => set("buyerName", v)} placeholder="Fullt navn / Firmanavn" canEdit={canEdit} testId="input-buyerName" />
                </Field>
                <Field label="Adresse">
                  <FText value={g("buyerAddress")} onChange={v => set("buyerAddress", v)} placeholder="Gateadresse" canEdit={canEdit} testId="input-buyerAddress" />
                </Field>
                <Field label="Postnr.">
                  <FText value={g("buyerPostalCode")} onChange={v => set("buyerPostalCode", v)} placeholder="0000" canEdit={canEdit} testId="input-buyerPostalCode" />
                </Field>
                <Field label="Sted">
                  <FText value={g("buyerCity")} onChange={v => set("buyerCity", v)} placeholder="By/sted" canEdit={canEdit} testId="input-buyerCity" />
                </Field>
                <Field label="E-post">
                  <FText value={g("buyerEmail")} onChange={v => set("buyerEmail", v)} placeholder="epost@eksempel.no" canEdit={canEdit} testId="input-buyerEmail" />
                </Field>
                <Field label="Mobil">
                  <FText value={g("buyerPhone")} onChange={v => set("buyerPhone", v)} placeholder="4xx xx xxx" canEdit={canEdit} testId="input-buyerPhone" />
                </Field>
                <Field label="Kontonummer">
                  <FText value={g("sellerAccountNo")} onChange={v => set("sellerAccountNo", v)} placeholder="XXXX.XX.XXXXX" canEdit={canEdit} testId="input-sellerAccountNo" />
                </Field>
              </div>
            </Section>

            {/* Kjøretøy */}
            <Section title="Opplysninger om kjøretøy" color="slate">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                <Field label="Merke">
                  <FText value={g("vehicleMake")} onChange={v => set("vehicleMake", v)} placeholder="Merke" canEdit={canEdit} testId="input-vehicleMake" />
                </Field>
                <Field label="Modell">
                  <FText value={g("vehicleModel")} onChange={v => set("vehicleModel", v)} placeholder="Modell" canEdit={canEdit} testId="input-vehicleModel" />
                </Field>
                <Field label="Årsmodell">
                  <FNumber value={g("vehicleYear")} onChange={v => set("vehicleYear", v ? Number(v) : null)} placeholder="2020" canEdit={canEdit} testId="input-vehicleYear" />
                </Field>
                <Field label="Først registrert">
                  <FText value={g("vehicleFirstRegistered")} onChange={v => set("vehicleFirstRegistered", v)} placeholder="DD/MM/ÅÅÅÅ" canEdit={canEdit} testId="input-vehicleFirstRegistered" />
                </Field>
                <Field label="Kjennemerke">
                  <FText value={g("vehicleRegNo")} onChange={v => set("vehicleRegNo", v)} placeholder="AB12345" canEdit={canEdit} testId="input-vehicleRegNo" />
                </Field>
                <Field label="VIN / Chassisnr.">
                  <FText value={g("vehicleVin")} onChange={v => set("vehicleVin", v)} placeholder="VIN" canEdit={canEdit} testId="input-vehicleVin" />
                </Field>
                <Field label="Kjørelengde (km)">
                  <FNumber value={g("vehicleMileage")} onChange={v => set("vehicleMileage", v ? Number(v) : null)} placeholder="0" canEdit={canEdit} testId="input-vehicleMileage" />
                </Field>
                <Field label="Drivstoff">
                  <FSelect value={g("vehicleFuelType")} onChange={v => set("vehicleFuelType", v)} options={FUEL_TYPES} canEdit={canEdit} testId="select-vehicleFuelType" />
                </Field>
                <Field label="Nøkler, antall">
                  <FNumber value={g("vehicleKeys")} onChange={v => set("vehicleKeys", v ? Number(v) : null)} placeholder="2" canEdit={canEdit} testId="input-vehicleKeys" />
                </Field>
                <Field label="Sist EU-kontroll">
                  <FText value={g("vehicleEuControlLast")} onChange={v => set("vehicleEuControlLast", v)} placeholder="MM/ÅÅÅÅ" canEdit={canEdit} testId="input-vehicleEuControlLast" />
                </Field>
                <Field label="Neste EU-kontroll">
                  <FText value={g("vehicleEuControlNext")} onChange={v => set("vehicleEuControlNext", v)} placeholder="MM/ÅÅÅÅ" canEdit={canEdit} testId="input-vehicleEuControlNext" />
                </Field>
                <Field label="Farge">
                  <FText value={g("vehicleColor")} onChange={v => set("vehicleColor", v)} placeholder="Farge" canEdit={canEdit} testId="input-vehicleColor" />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.05]">
                <Field label="Utstyr / tilbehør">
                  <FTextarea value={g("vehicleEquipment")} onChange={v => set("vehicleEquipment", v)} placeholder="Sommerhjul, vinterhjul, osv." canEdit={canEdit} testId="input-vehicleEquipment" />
                </Field>
                <Field label="Andre opplysninger">
                  <FTextarea value={g("notes")} onChange={v => set("notes", v)} placeholder="Heftelser, andre anmerkninger…" canEdit={canEdit} testId="input-notes" />
                </Field>
              </div>
            </Section>

            {/* Kjøp + Oppgjør */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.09] overflow-hidden">
                <div className="bg-slate-50 dark:bg-white/[0.04] px-4 py-2.5 border-b border-black/[0.07] dark:border-white/[0.07]">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Kjøp: {g("vehicleMake")} {g("vehicleModel")}
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <Field label="Pris på kjøretøy">
                    {canEdit ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] text-muted-foreground">kr</span>
                        <input
                          type="number"
                          value={g("vehiclePrice")}
                          onChange={e => set("vehiclePrice", e.target.value)}
                          placeholder="0"
                          className="flex-1 bg-transparent border-b border-dashed border-black/20 dark:border-white/20 focus:border-primary outline-none text-[13px] text-foreground"
                          data-testid="input-vehiclePrice"
                        />
                      </div>
                    ) : (
                      <span className="text-[13px] font-semibold text-foreground">{priceFormatted || "—"}</span>
                    )}
                  </Field>
                  <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                    <span className="text-[12px] font-bold text-foreground uppercase tracking-wide">Sum kjøp</span>
                    <span className="text-[13px] font-bold text-foreground">{priceFormatted || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.09] overflow-hidden">
                <div className="bg-slate-50 dark:bg-white/[0.04] px-4 py-2.5 border-b border-black/[0.07] dark:border-white/[0.07]">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Oppgjør</h3>
                </div>
                <div className="p-4 space-y-3">
                  <Field label="Bankoverføring">
                    {canEdit ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] text-muted-foreground">kr</span>
                        <input
                          type="number"
                          value={g("settlementAmount")}
                          onChange={e => set("settlementAmount", e.target.value)}
                          placeholder="0"
                          className="flex-1 bg-transparent border-b border-dashed border-black/20 dark:border-white/20 focus:border-primary outline-none text-[13px] text-foreground"
                          data-testid="input-settlementAmount"
                        />
                      </div>
                    ) : (
                      <span className="text-[13px] font-semibold text-foreground">{settlementFormatted || "—"}</span>
                    )}
                  </Field>
                  <Field label="Selgers kontonummer">
                    <FText value={g("sellerAccountNo")} onChange={v => set("sellerAccountNo", v)} placeholder="XXXX.XX.XXXXX" canEdit={canEdit} testId="input-sellerAccountNo-oppgjor" />
                  </Field>
                  <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                    <span className="text-[12px] font-bold text-foreground uppercase tracking-wide">Sum oppgjør</span>
                    <span className="text-[13px] font-bold text-foreground">{settlementFormatted || priceFormatted || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BankID signing */}
            <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.09] overflow-hidden">
              <div className="bg-slate-50 dark:bg-white/[0.04] px-4 py-2.5 border-b border-black/[0.07] dark:border-white/[0.07] flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Signering (simulert — uten BankID-verifisering)</h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { party: "seller" as const, label: contract.type === "innkjøp" ? "Selger (privat)" : "Selger (forhandler)", signed: contract.sellerSigned, signedAt: contract.sellerSignedAt },
                  { party: "buyer" as const, label: contract.type === "innkjøp" ? "Kjøper (forhandler)" : "Kjøper", signed: contract.buyerSigned, signedAt: contract.buyerSignedAt },
                ].map(({ party, label, signed, signedAt }) => (
                  <div key={party} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.03]">
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      {signed && signedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(signedAt).toLocaleDateString("nb-NO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    {signed ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                        <CheckCircle2 className="h-4 w-4" /> Signert (simulert)
                      </span>
                    ) : canSign ? (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs text-white h-8" onClick={() => setBankIdModal(party)} data-testid={`button-sign-${party}`}>
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Signer
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground/50 text-xs">
                        <Clock className="h-3.5 w-3.5" /> Venter
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Kontraktvilkår */}
            <div className="rounded-xl border border-black/[0.07] dark:border-white/[0.09] overflow-hidden">
              <div className="bg-slate-50 dark:bg-white/[0.04] px-4 py-2.5 border-b border-black/[0.07] dark:border-white/[0.07] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Kontraktvilkår</h3>
                </div>
                {canEdit && <span className="text-[10px] text-muted-foreground/50 italic">Redigerbart — tilpass til din forhandler</span>}
              </div>
              <div className="p-4">
                {canEdit ? (
                  <Textarea
                    value={customTermsValue}
                    onChange={e => set("customTerms", e.target.value)}
                    className="min-h-[400px] text-[12px] font-mono leading-relaxed resize-y bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
                    data-testid="textarea-custom-terms"
                  />
                ) : (
                  <pre className="text-[12px] leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                    {customTermsValue}
                  </pre>
                )}
              </div>
            </div>

            {/* Footer save bar */}
            {canEdit && hasChanges && (
              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.07] dark:border-white/[0.08]">
                <Button onClick={() => { setForm({}); setHasChanges(false); }} variant="outline" size="sm">
                  Angre endringer
                </Button>
                <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending} size="sm" data-testid="button-save-contract-bottom">
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {updateMutation.isPending ? "Lagrer…" : "Lagre kontrakt"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <BankIdModal
        open={!!bankIdModal}
        party={bankIdModal ?? "buyer"}
        onClose={() => setBankIdModal(null)}
        onSigned={phone => signMutation.mutate({ party: bankIdModal!, phone })}
      />
    </LayoutShell>
  );
}
