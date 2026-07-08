import { useState, useEffect } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, ExternalLink, Code2, Eye, Loader2 } from "lucide-react";

const settingsSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd"),
  slug: z
    .string()
    .min(2, "Slug må ha minst 2 tegn")
    .max(64, "Slug kan maks ha 64 tegn")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Kun små bokstaver, tall og bindestreker (f.eks. hernes-bil)",
    }),
});
type SettingsForm = z.infer<typeof settingsSchema>;

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function EmbedSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const { data: settings, isLoading } = useQuery<{ name: string; slug: string }>({
    queryKey: ["/api/settings/dealership"],
    queryFn: async () => {
      const res = await fetch("/api/settings/dealership", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: async (data: SettingsForm) => {
      const res = await fetch("/api/settings/dealership", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Lagring feilet");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/dealership"] });
      setPreviewKey(k => k + 1);
      toast({ title: "Innstillinger lagret" });
    },
    onError: (err: any) => {
      toast({ title: "Feil", description: err.message, variant: "destructive" });
    },
  });

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { name: "", slug: "" },
  });

  useEffect(() => {
    if (settings) {
      form.reset({ name: settings.name, slug: settings.slug });
    }
  }, [settings]);

  const slug = form.watch("slug");
  const iframeSnippet = `<iframe
  src="${window.location.origin}/embed/${slug}"
  width="100%"
  height="600"
  style="border:none;border-radius:12px;"
  title="Biler fra ${form.watch("name") || "forhandler"}"
  loading="lazy"
></iframe>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(iframeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Embed-widget</h1>
          <p className="text-muted-foreground mt-1">
            Vis dine biler på din nettside med én linje kode.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Settings form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-primary" />
                  Forhandlerinnstillinger
                </CardTitle>
                <CardDescription>
                  Sett navn og slug. Slugen brukes i iframe-URL-en og bør matche domenet ditt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(d => saveSettings(d))} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Forhandlernavn</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Hernes Bil AS"
                              {...field}
                              onChange={e => {
                                field.onChange(e);
                                // Auto-fill slug if it hasn't been manually edited
                                if (!form.getValues("slug") || form.getValues("slug") === slugify(form.getValues("name"))) {
                                  form.setValue("slug", slugify(e.target.value), { shouldValidate: true });
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <div className="flex items-center rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                              <span className="pl-3 pr-1 text-muted-foreground text-sm select-none">/embed/</span>
                              <input
                                {...field}
                                className="flex-1 py-2 pr-3 text-sm outline-none bg-transparent"
                                placeholder="hernes-bil"
                                onChange={e => field.onChange(e.target.value.toLowerCase())}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Kun små bokstaver, tall og bindestreker.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Lagre innstillinger
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Snippet card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Din iframe-kode</CardTitle>
                <CardDescription>
                  Lim inn denne koden på din nettside der du vil vise bilene.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <pre className="text-[11px] leading-relaxed bg-muted/60 rounded-lg p-4 overflow-x-auto border border-border font-mono text-muted-foreground whitespace-pre-wrap break-all">
                    {iframeSnippet}
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={copySnippet}
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="ml-1.5">{copied ? "Kopiert!" : "Kopier"}</span>
                  </Button>
                </div>
                {slug && (
                  <a
                    href={`/embed/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Åpne embed-siden i ny fane
                  </a>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right — Live preview */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Forhåndsvisning</h2>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-xs"
                onClick={() => setPreviewKey(k => k + 1)}
              >
                Oppdater
              </Button>
            </div>
            <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
              {/* Browser chrome mockup */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-muted border-b border-border">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <div className="ml-2 flex-1 bg-background rounded text-[10px] text-muted-foreground px-2 py-0.5 truncate">
                  {window.location.origin}/embed/{slug || "din-slug"}
                </div>
              </div>
              {slug ? (
                <iframe
                  key={previewKey}
                  src={`/embed/${slug}`}
                  className="w-full"
                  style={{ height: "480px", border: "none" }}
                  title="Embed forhåndsvisning"
                />
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Fyll inn en slug for å se forhåndsvisning
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}
