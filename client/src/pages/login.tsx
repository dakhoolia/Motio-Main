import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import logoImg from "@assets/logo_1780527843786.png";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const [_, setLocation] = useLocation();
  const { login, mfaLogin, isLoggingIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  function finishLogin(user: { mustChangePassword?: boolean | null }) {
    setLocation(user?.mustChangePassword ? "/change-password" : "/");
  }

  async function onSubmit(data: z.infer<typeof loginSchema>) {
    setError(null);
    try {
      const result = await login(data);
      if (result && "mfaRequired" in result) {
        setMfaStep(true);
        return;
      }
      finishLogin(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function onSubmitMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(mfaCode)) return;
    setError(null);
    try {
      const user = await mfaLogin(mfaCode);
      finishLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifisering feilet");
      setMfaCode("");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] animate-in">

        {/* App icon + branding */}
        <div className="text-center mb-8">
          <div
            className="inline-block relative h-[72px] w-[72px] rounded-[20px] mb-5 overflow-hidden"
            style={{ boxShadow: "0 8px 32px rgba(10, 132, 255, 0.35), 0 2px 8px rgba(0,0,0,0.12)" }}
          >
            <img src={logoImg} alt="Motio" className="h-full w-full object-cover" />
            <div
              className="absolute inset-0 rounded-[20px]"
              style={{ background: "linear-gradient(145deg, rgba(10,132,255,0.45) 0%, rgba(107,95,255,0.45) 100%)", mixBlendMode: "multiply" }}
            />
          </div>
          <h1
            className="text-[28px] font-bold text-foreground mb-1"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}
          >
            Motio
          </h1>
          <p className="text-[14px] text-muted-foreground">Fleet management for your dealership</p>
        </div>

        {/* Glass card */}
        <div className="glass-card rounded-2xl p-7">
          {mfaStep ? (
            <form onSubmit={onSubmitMfa} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-[13px] font-medium border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="text-center space-y-1">
                <p className="text-[15px] font-semibold text-foreground">Tofaktorautentisering</p>
                <p className="text-[13px] text-muted-foreground">Skriv inn koden fra autentiserings-appen din</p>
              </div>
              <Input
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                className="h-12 rounded-xl text-center text-[22px] font-mono tracking-[0.4em] bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.08] dark:border-white/[0.1]"
                data-testid="input-mfa-code"
              />
              <Button
                type="submit"
                className="w-full h-11 rounded-xl text-[15px] font-semibold"
                style={{
                  background: "linear-gradient(135deg, #0A84FF 0%, #0066CC 100%)",
                  boxShadow: "0 4px 16px rgba(10, 132, 255, 0.35)",
                }}
                disabled={isLoggingIn || mfaCode.length !== 6}
                data-testid="button-mfa-verify"
              >
                {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verifiser
              </Button>
              <button
                type="button"
                className="w-full text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setMfaStep(false); setMfaCode(""); setError(null); }}
              >
                ← Tilbake til innlogging
              </button>
            </form>
          ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-[13px] font-medium border border-destructive/20">
                  {error}
                </div>
              )}

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-foreground">Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="username"
                        {...field}
                        className="h-11 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.08] dark:border-white/[0.1] text-[15px] placeholder:text-muted-foreground/50 focus:ring-primary/30"
                        data-testid="input-username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-foreground">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="h-11 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.08] dark:border-white/[0.1] text-[15px] placeholder:text-muted-foreground/50 focus:ring-primary/30"
                        data-testid="input-password"
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 rounded-xl text-[15px] font-semibold mt-2 transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, #0A84FF 0%, #0066CC 100%)",
                  boxShadow: "0 4px 16px rgba(10, 132, 255, 0.35)",
                }}
                disabled={isLoggingIn}
                data-testid="button-sign-in"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>
          )}
        </div>

        <p className="text-center text-[12px] text-muted-foreground/60 mt-6">
          Motio · Car Dealership Logistics
        </p>
      </div>
    </div>
  );
}
