import { useState } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldOff, Loader2, Smartphone, Copy, Check } from "lucide-react";

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Noe gikk galt" }));
    throw new Error(err.message);
  }
  return res.json();
}

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [setupData, setSetupData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [copied, setCopied] = useState(false);

  const mfaEnabled = (user as any)?.totpEnabled === true;

  const refreshUser = () => queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });

  const setupMutation = useMutation({
    mutationFn: () => postJson("/api/auth/mfa/setup"),
    onSuccess: (data) => setSetupData({ qrDataUrl: data.qrDataUrl, secret: data.secret }),
    onError: (err: any) => toast({ title: "Feil", description: err.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => postJson("/api/auth/mfa/verify", { code }),
    onSuccess: () => {
      setSetupData(null);
      setVerifyCode("");
      refreshUser();
      toast({ title: "MFA aktivert", description: "Du blir nå bedt om en kode ved innlogging." });
    },
    onError: (err: any) => toast({ title: "Feil", description: err.message, variant: "destructive" }),
  });

  const disableMutation = useMutation({
    mutationFn: (code: string) => postJson("/api/auth/mfa/disable", { code }),
    onSuccess: () => {
      setShowDisable(false);
      setDisableCode("");
      refreshUser();
      toast({ title: "MFA deaktivert" });
    },
    onError: (err: any) => toast({ title: "Feil", description: err.message, variant: "destructive" }),
  });

  const copySecret = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <LayoutShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Sikkerhet</h1>
          <p className="text-muted-foreground mt-1">Administrer tofaktorautentisering for kontoen din</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mfaEnabled ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              ) : (
                <ShieldOff className="h-5 w-5 text-muted-foreground" />
              )}
              Tofaktorautentisering (TOTP)
            </CardTitle>
            <CardDescription>
              {mfaEnabled
                ? "Aktivert — du må oppgi en kode fra autentiserings-appen ved hver innlogging."
                : "Beskytt kontoen din med engangskoder fra en autentiserings-app (Google Authenticator, 1Password, Authy m.fl.)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Not enabled, not in setup */}
            {!mfaEnabled && !setupData && (
              <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending} data-testid="button-mfa-setup">
                {setupMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
                Aktiver MFA
              </Button>
            )}

            {/* Setup step: QR + verify */}
            {!mfaEnabled && setupData && (
              <div className="space-y-4">
                <ol className="text-sm text-muted-foreground list-decimal ml-4 space-y-1">
                  <li>Skann QR-koden med autentiserings-appen din</li>
                  <li>Skriv inn 6-sifret kode fra appen for å bekrefte</li>
                </ol>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <img
                    src={setupData.qrDataUrl}
                    alt="TOTP QR-kode"
                    className="h-44 w-44 rounded-lg border border-border bg-white p-2"
                  />
                  <div className="flex-1 space-y-2 w-full">
                    <p className="text-xs text-muted-foreground">Kan du ikke skanne? Skriv inn nøkkelen manuelt:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] font-mono bg-muted rounded px-2 py-1.5 break-all flex-1">{setupData.secret}</code>
                      <Button size="sm" variant="ghost" onClick={copySecret}>
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    className="w-36 text-center font-mono tracking-[0.3em]"
                    data-testid="input-mfa-verify-code"
                  />
                  <Button
                    onClick={() => verifyMutation.mutate(verifyCode)}
                    disabled={verifyCode.length !== 6 || verifyMutation.isPending}
                    data-testid="button-mfa-verify-setup"
                  >
                    {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Bekreft og aktiver
                  </Button>
                  <Button variant="ghost" onClick={() => { setSetupData(null); setVerifyCode(""); }}>Avbryt</Button>
                </div>
              </div>
            )}

            {/* Enabled: disable flow */}
            {mfaEnabled && !showDisable && (
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30" onClick={() => setShowDisable(true)} data-testid="button-mfa-disable">
                Deaktiver MFA
              </Button>
            )}
            {mfaEnabled && showDisable && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Skriv inn en gyldig kode fra appen for å deaktivere:</p>
                <div className="flex gap-2 items-center">
                  <Input
                    value={disableCode}
                    onChange={e => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    className="w-36 text-center font-mono tracking-[0.3em]"
                    data-testid="input-mfa-disable-code"
                  />
                  <Button
                    variant="destructive"
                    onClick={() => disableMutation.mutate(disableCode)}
                    disabled={disableCode.length !== 6 || disableMutation.isPending}
                    data-testid="button-mfa-disable-confirm"
                  >
                    {disableMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Deaktiver
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowDisable(false); setDisableCode(""); }}>Avbryt</Button>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground/70 border-t border-border pt-3">
              Mistet tilgang til autentiserings-appen? En administrator kan nullstille MFA for kontoen din.
            </p>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
