import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Plus, Search, ChevronRight, Car,
  Clock, CheckCircle2, XCircle, FileCheck,
} from "lucide-react";
import type { ContractWithDetails, ContractTemplate } from "@shared/schema";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Utkast", color: "bg-gray-100 text-gray-600", icon: FileText },
  pending: { label: "Venter på signering", color: "bg-amber-100 text-amber-700", icon: Clock },
  signed: { label: "Signert", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  cancelled: { label: "Kansellert", color: "bg-red-100 text-red-600", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.draft;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

export default function ContractsPage() {
  const [, setLocation] = useLocation();
  const { roleName } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);

  const { data: contracts = [], isLoading } = useQuery<ContractWithDetails[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: templates = [] } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contract-templates"],
  });

  const filtered = useMemo(() => {
    let list = contracts;
    if (tab !== "all") list = list.filter(c => c.type === tab);
    if (q) {
      const lq = q.toLowerCase();
      list = list.filter(c =>
        c.buyerName?.toLowerCase().includes(lq) ||
        c.sellerName?.toLowerCase().includes(lq) ||
        c.vehicleMake?.toLowerCase().includes(lq) ||
        c.vehicleModel?.toLowerCase().includes(lq) ||
        c.vehicleRegNo?.toLowerCase().includes(lq)
      );
    }
    return list;
  }, [contracts, tab, q]);

  return (
    <LayoutShell>
      <div className="max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}>Kontrakter</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Innkjøps- og salgskontrakter med simulert signering
            </p>
          </div>
          <div className="flex gap-2">
            {roleName === "Admin" && (
              <Button variant="outline" asChild>
                <Link href="/contract-templates">
                  <FileCheck className="h-4 w-4 mr-2" />
                  Maler
                </Link>
              </Button>
            )}
            <Button onClick={() => setShowNew(true)} data-testid="button-new-contract">
              <Plus className="h-4 w-4 mr-2" />
              Ny kontrakt
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Søk på bil, kjøper, selger…"
              className="pl-9"
              value={q}
              onChange={e => setQ(e.target.value)}
              data-testid="input-contract-search"
            />
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">Alle</TabsTrigger>
              <TabsTrigger value="innkjøp">Innkjøp</TabsTrigger>
              <TabsTrigger value="salg">Salg</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Ingen kontrakter funnet</p>
            <p className="text-sm mt-1">Opprett en ny kontrakt for å komme i gang</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(c => (
              <Link key={c.id} href={`/contracts/${c.id}`}>
                <div
                  className="glass-card rounded-2xl p-4 hover-elevate cursor-pointer flex items-center gap-4"
                  data-testid={`row-contract-${c.id}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.type === "innkjøp" ? "bg-blue-50 dark:bg-blue-950/40" : "bg-emerald-50 dark:bg-emerald-950/40"}`}>
                    <Car className={`h-5 w-5 ${c.type === "innkjøp" ? "text-blue-600" : "text-emerald-600"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${c.type === "innkjøp" ? "text-blue-600" : "text-emerald-600"}`}>
                        {c.type === "innkjøp" ? "Innkjøp" : "Salg"}
                      </span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="text-[11px] text-muted-foreground">
                        #{c.id} · {new Date(c.createdAt).toLocaleDateString("nb-NO")}
                      </span>
                    </div>
                    <p className="font-semibold text-[14px] text-foreground truncate">
                      {c.vehicleMake && c.vehicleModel
                        ? `${c.vehicleYear ?? ""} ${c.vehicleMake} ${c.vehicleModel}`.trim()
                        : "Bil ikke spesifisert"}
                      {c.vehicleRegNo ? ` · ${c.vehicleRegNo}` : ""}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                      {c.type === "innkjøp"
                        ? `Selger: ${c.sellerName ?? "—"}`
                        : `Kjøper: ${c.buyerName ?? "—"}`}
                      {c.vehiclePrice ? ` · kr ${Number(c.vehiclePrice).toLocaleString("nb-NO")},-` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={c.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New contract dialog */}
      <NewContractDialog
        open={showNew}
        templates={templates}
        onClose={() => setShowNew(false)}
        onCreated={(id) => { setShowNew(false); setLocation(`/contracts/${id}`); }}
      />
    </LayoutShell>
  );
}

function NewContractDialog({
  open, templates, onClose, onCreated,
}: {
  open: boolean;
  templates: ContractTemplate[];
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<"innkjøp" | "salg">("salg");
  const [templateId, setTemplateId] = useState<string>("");

  const matchingTemplates = templates.filter(t => t.type === type && t.isActive);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/contracts", {
        type,
        templateId: templateId ? Number(templateId) : null,
      });
      return res.json();
    },
    onSuccess: (contract) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      onCreated(contract.id);
    },
    onError: () => toast({ title: "Kunne ikke opprette kontrakt", variant: "destructive" }),
  });

  function handleCreate() {
    createMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ny kontrakt</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Type selection */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Type kontrakt</p>
            <div className="grid grid-cols-2 gap-3">
              {(["innkjøp", "salg"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setType(t); setTemplateId(""); }}
                  data-testid={`button-type-${t}`}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    type === t
                      ? t === "innkjøp"
                        ? "border-blue-500 bg-blue-50"
                        : "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Car className={`h-6 w-6 mb-2 ${type === t ? (t === "innkjøp" ? "text-blue-600" : "text-emerald-600") : "text-gray-400"}`} />
                  <p className="font-semibold text-sm capitalize">{t}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t === "innkjøp" ? "Kjøper inn bil fra privat" : "Selger ut bil til kjøper"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Template selection */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Mal (valgfritt)</p>
            {matchingTemplates.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Ingen aktive maler for {type}. Admin kan legge til maler under "Maler".
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Velg mal…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Ingen mal</SelectItem>
                  {matchingTemplates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Avbryt
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-create-contract"
            >
              {createMutation.isPending ? "Oppretter…" : "Opprett kontrakt"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
