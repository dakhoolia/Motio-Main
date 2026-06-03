import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useVehicle, useUpdateVehicle, useStatuses, useUsers } from "@/hooks/use-vehicles";
import { useCreateTask } from "@/hooks/use-tasks";
import { useCreateSale } from "@/hooks/use-sales";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LayoutShell } from "@/components/layout-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Calendar, MapPin, Gauge, Hash, Edit, CheckSquare, AlertTriangle, Plus, Camera, Trash2, Upload, ExternalLink, Globe } from "lucide-react";
import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, ROLE_NAMES, type Photo } from "@shared/schema";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function VehicleDetailPage() {
  const [match, params] = useRoute("/vehicles/:id");
  const id = params ? parseInt(params.id) : 0;
  const { user, roleName } = useAuth();
  
  const { data: vehicle, isLoading } = useVehicle(id);
  const { mutate: updateVehicle } = useUpdateVehicle();
  const { data: statuses } = useStatuses();
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<number | null>(null);

  const canEditVehicle = roleName && [ROLE_NAMES.ADMIN, ROLE_NAMES.HYBRID, ROLE_NAMES.INNKJOPER].includes(roleName as any);
  const canSellVehicle = roleName && [ROLE_NAMES.ADMIN, ROLE_NAMES.HYBRID, ROLE_NAMES.SELGER].includes(roleName as any);
  const canChangeStatus = roleName && [ROLE_NAMES.ADMIN, ROLE_NAMES.HYBRID, ROLE_NAMES.INNKJOPER, ROLE_NAMES.KLARGJORER].includes(roleName as any);
  const canManageFinn = roleName && [ROLE_NAMES.ADMIN, ROLE_NAMES.HYBRID].includes(roleName as any);

  const { toast } = useToast();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: photoList = [] } = useQuery<Photo[]>({
    queryKey: ["/api/vehicles", id, "photos"],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${id}/photos`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/vehicles/${id}/photos`, { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", id, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", id] });
      toast({ title: "Foto lastet opp" });
    },
    onError: () => toast({ title: "Opplasting feilet", variant: "destructive" }),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: number) => apiRequest("DELETE", `/api/photos/${photoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", id, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", id] });
      toast({ title: "Foto slettet" });
    },
    onError: () => toast({ title: "Sletting feilet", variant: "destructive" }),
  });

  const publishFinnMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/vehicles/${id}/finn/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", id] });
      toast({ title: "Publisert til Finn.no!" });
    },
    onError: (err: any) => toast({ title: "Finn-publisering feilet", description: err.message, variant: "destructive" }),
  });

  const unpublishFinnMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/vehicles/${id}/finn/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", id] });
      toast({ title: "Fjernet fra Finn.no" });
    },
    onError: (err: any) => toast({ title: "Fjerning feilet", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </LayoutShell>
    );
  }

  if (!vehicle) {
    return (
      <LayoutShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Vehicle not found</h2>
          <Link href="/vehicles">
            <Button variant="ghost">Return to list</Button>
          </Link>
        </div>
      </LayoutShell>
    );
  }

  const handleStatusChange = (statusId: string) => {
    const newStatusId = parseInt(statusId);
    const selectedStatus = statuses?.find(s => s.id === newStatusId);
    
    // If changing to "Sold" status, show the sold dialog
    if (selectedStatus?.name === "Sold") {
      setPendingStatusId(newStatusId);
      setSoldDialogOpen(true);
    } else {
      updateVehicle({ id, statusId: newStatusId });
    }
  };
  
  const handleSoldConfirmed = () => {
    if (pendingStatusId) {
      updateVehicle({ id, statusId: pendingStatusId });
    }
    setSoldDialogOpen(false);
    setPendingStatusId(null);
  };

  return (
    <LayoutShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Link href="/vehicles" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Inventory
          </Link>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-display font-bold text-foreground">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h1>
                <StatusBadge status={vehicle.status.name} className="text-sm px-3 py-1" />
              </div>
              <p className="text-muted-foreground text-lg">{vehicle.variant}</p>
            </div>

            <div className="flex items-center gap-3">
              {canChangeStatus && (
                <Select 
                  value={String(vehicle.statusId)} 
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger className="w-[180px] h-11" data-testid="select-vehicle-status">
                    <SelectValue placeholder="Change Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses?.filter(s => {
                      if (roleName === ROLE_NAMES.KLARGJORER) {
                        return ["Intake", "Klargjøring", "Klargjort"].includes(s.name);
                      }
                      if (roleName === ROLE_NAMES.SELGER) {
                        return false;
                      }
                      return true;
                    }).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {canEditVehicle && (
                <Button size="lg" className="h-11 shadow-lg shadow-primary/20" data-testid="button-edit-vehicle">
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-8">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="w-full justify-start h-12 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
                <TabsTrigger value="tasks" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Tasks & Work</TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">History</TabsTrigger>
                <TabsTrigger value="photos" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Photos</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-6 animate-in">
                <Card>
                  <CardHeader>
                    <CardTitle>Kjøretøydetaljer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <DetailItem icon={Calendar} label="Årsmodell" value={vehicle.year.toString()} />
                      <DetailItem icon={Gauge} label="Kilometerstand" value={vehicle.mileage != null ? `${vehicle.mileage.toLocaleString("nb-NO")} km` : "N/A"} />
                      <DetailItem icon={Hash} label="Farge" value={vehicle.color || "N/A"} />
                      <DetailItem icon={MapPin} label="Sted" value={vehicle.location?.name || "Ukjent"} />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Registrering</h4>
                        <div className="space-y-3">
                          {[
                            ["Regnr", vehicle.regNo],
                            ["VIN", vehicle.vin],
                            ["Farge", vehicle.color],
                          ].filter(([, v]) => v).map(([label, val]) => (
                            <div key={label} className="flex justify-between py-1 border-b border-border/50">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="font-medium font-mono text-sm">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Økonomi</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Innkjøpspris</span>
                            <span className="font-medium font-mono">kr {Number(vehicle.buyPrice).toLocaleString("nb-NO")}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Salgspris</span>
                            <span className="font-medium font-mono text-primary">kr {Number(vehicle.listPrice || 0).toLocaleString("nb-NO")}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Tekniske spesifikasjoner</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                        {[
                          ["Drivstoff", vehicle.fuelType],
                          ["Girkasse", vehicle.transmission],
                          ["Karosseri", vehicle.bodyType],
                          ["Hjuldrift", vehicle.driveType],
                          ["Motorvolum", vehicle.engineSize ? `${vehicle.engineSize}L` : null],
                          ["Effekt", vehicle.horsepower ? `${vehicle.horsepower} hk` : null],
                        ].filter(([, v]) => v).map(([label, val]) => (
                          <div key={label} className="flex flex-col">
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
                            <span className="font-semibold text-sm mt-0.5">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {vehicle.description && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Beskrivelse</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{vehicle.description}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tasks" className="mt-6 animate-in">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle>Aktive oppgaver</CardTitle>
                      <CardDescription>Vedlikeholds- og klargjøringsarbeid</CardDescription>
                    </div>
                    <CreateVehicleTaskDialog vehicleId={id} vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />
                  </CardHeader>
                  <CardContent>
                    {vehicle.tasks && vehicle.tasks.length > 0 ? (
                      <div className="space-y-4">
                        {vehicle.tasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${task.status === 'Done' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                <CheckSquare className="h-4 w-4" />
                              </div>
                              <div>
                                <h4 className="font-medium">{task.title}</h4>
                                <p className="text-xs text-muted-foreground">{task.type} • Frist: {task.dueAt ? new Date(task.dueAt).toLocaleDateString("nb-NO") : 'Ingen'}</p>
                              </div>
                            </div>
                            <StatusBadge status={task.status || 'Open'} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Ingen aktive oppgaver for dette kjøretøyet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="photos" className="mt-6 animate-in">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle>Bilder</CardTitle>
                      <CardDescription>Kjøretøybilder for annonse og dokumentasjon</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        data-testid="input-photo-upload"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          files.forEach(f => uploadPhotoMutation.mutate(f));
                          e.target.value = "";
                        }}
                      />
                      <Button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadPhotoMutation.isPending}
                        data-testid="button-upload-photo"
                        size="sm"
                      >
                        {uploadPhotoMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Last opp
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {photoList.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Camera className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">Ingen bilder lastet opp</p>
                        <p className="text-sm mt-1">Klikk «Last opp» for å legge til bilder</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {photoList.map((photo, i) => (
                          <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-border aspect-square bg-muted" data-testid={`card-photo-${photo.id}`}>
                            <img src={photo.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            {i === 0 && (
                              <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
                                Forsidebilde
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 w-8 p-0"
                                disabled={deletePhotoMutation.isPending}
                                data-testid={`button-delete-photo-${photo.id}`}
                                onClick={() => deletePhotoMutation.mutate(photo.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="mt-6 animate-in">
                <Card>
                  <CardHeader>
                    <CardTitle>Historikk</CardTitle>
                    <CardDescription>Endringslogg for dette kjøretøyet</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Historikk er ikke tilgjengelig ennå.
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Summary/Media */}
          <div className="space-y-6">
            <Card className="overflow-hidden border-border shadow-sm">
              <div className="aspect-video bg-muted relative">
                {photoList[0] ? (
                  <img src={photoList[0].url} className="w-full h-full object-cover" alt="Forsidebilde" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
                    <Camera className="h-12 w-12" />
                    <span className="text-xs">Ingen bilde</span>
                  </div>
                )}
                {photoList[0] && (
                  <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {photoList.length} bilde{photoList.length !== 1 ? "r" : ""}
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => photoInputRef.current?.click()}
                  data-testid="button-upload-photo-shortcut"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {photoList.length === 0 ? "Last opp bilde" : "Legg til bilde"}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-primary flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Hurtighandlinger
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {canEditVehicle && (
                  <Button className="w-full justify-start" variant="secondary" data-testid="button-create-work-order">Opprett arbeidsordre</Button>
                )}
                {canEditVehicle && (
                  <Button className="w-full justify-start" variant="secondary" data-testid="button-schedule-inspection">Planlegg inspeksjon</Button>
                )}
                {canSellVehicle && (
                  <Button className="w-full justify-start" variant="secondary" data-testid="button-mark-sold">Merk som solgt</Button>
                )}
              </CardContent>
            </Card>

            {canManageFinn && (
              <Card className="border-orange-200 bg-orange-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-orange-800 text-base">
                    <Globe className="h-4 w-4" />
                    Finn.no
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {vehicle.finnCode ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-semibold text-green-700">Publisert</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Finn-kode: <span className="font-mono font-semibold text-foreground">{vehicle.finnCode}</span>
                      </div>
                      {vehicle.finnPublishedAt && (
                        <div className="text-xs text-muted-foreground">
                          Publisert: {new Date(vehicle.finnPublishedAt).toLocaleDateString("nb-NO")}
                        </div>
                      )}
                      <a
                        href={`https://www.finn.no/car/used/ad.html?finnkode=${vehicle.finnCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                        data-testid="link-finn-no"
                      >
                        <ExternalLink className="h-3 w-3" /> Se annonsen på Finn.no
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-red-200 text-red-600 hover:bg-red-50"
                        disabled={unpublishFinnMutation.isPending}
                        data-testid="button-finn-unpublish"
                        onClick={() => unpublishFinnMutation.mutate()}
                      >
                        {unpublishFinnMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
                        Avpubliser fra Finn
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-gray-300" />
                        <span className="text-sm text-muted-foreground">Ikke publisert</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Publiser denne bilen til Finn.no automatisk. Krever at FINN_API_KEY og FINN_PARTNER_ID er konfigurert.
                      </p>
                      <Button
                        size="sm"
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                        disabled={publishFinnMutation.isPending}
                        data-testid="button-finn-publish"
                        onClick={() => publishFinnMutation.mutate()}
                      >
                        {publishFinnMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-2" />}
                        Publiser til Finn.no
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      
      {/* Sold Dialog */}
      <SoldDialog 
        open={soldDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatusId(null);
          }
          setSoldDialogOpen(open);
        }}
        vehicle={vehicle}
        onConfirm={handleSoldConfirmed}
      />
    </LayoutShell>
  );
}

function DetailItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function CreateVehicleTaskDialog({ vehicleId, vehicleName }: { vehicleId: number; vehicleName: string }) {
  const [open, setOpen] = useState(false);
  const { mutateAsync: createTask, isPending } = useCreateTask();

  const form = useForm<z.infer<typeof insertTaskSchema>>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      priority: "Medium",
      status: "Open",
      type: "Maintenance",
      vehicleId: vehicleId,
    },
  });

  const onSubmit = async (data: any) => {
    await createTask({ ...data, vehicleId });
    setOpen(false);
    form.reset();
    // Invalidate both vehicles and tasks queries so both lists update
    queryClient.invalidateQueries({ queryKey: [api.vehicles.get.path, vehicleId] });
    queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-create-vehicle-task">
          <Plus className="mr-2 h-4 w-4" /> Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task for Vehicle</DialogTitle>
          <DialogDescription>Add a task for {vehicleName}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="Task description" {...field} data-testid="input-vehicle-task-title" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle-task-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle-task-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                        <SelectItem value="Cleaning">Cleaning</SelectItem>
                        <SelectItem value="Paperwork">Paperwork</SelectItem>
                        <SelectItem value="Inspection">Inspection</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-vehicle-task">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Schema for sold dialog form
const soldFormSchema = z.object({
  salePrice: z.string().min(1, "Sale price is required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Must be a valid positive number"),
  buyPrice: z.string().min(1, "Purchase price is required").refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid number"),
  hasServiceCost: z.boolean(),
  serviceCost: z.string().optional(),
  buyerName: z.string().min(1, "Buyer name is required"),
  sellerId: z.string().min(1, "Seller is required"),
});

function SoldDialog({ 
  open, 
  onOpenChange, 
  vehicle, 
  onConfirm 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  vehicle: any; 
  onConfirm: () => void;
}) {
  const { user } = useAuth();
  const { mutateAsync: createSale, isPending } = useCreateSale();
  const { data: usersList } = useUsers();
  const [hasServiceCost, setHasServiceCost] = useState(false);
  
  const form = useForm<z.infer<typeof soldFormSchema>>({
    resolver: zodResolver(soldFormSchema),
    defaultValues: {
      salePrice: "",
      buyPrice: vehicle?.buyPrice ? String(vehicle.buyPrice) : "0",
      hasServiceCost: false,
      serviceCost: "0",
      buyerName: "",
      sellerId: user?.id ? String(user.id) : "",
    },
  });

  useEffect(() => {
    if (open && vehicle) {
      form.reset({
        salePrice: "",
        buyPrice: vehicle?.buyPrice ? String(vehicle.buyPrice) : "0",
        hasServiceCost: false,
        serviceCost: "0",
        buyerName: "",
        sellerId: user?.id ? String(user.id) : "",
      });
      setHasServiceCost(false);
    }
  }, [open, vehicle]);
  
  const onSubmit = async (data: z.infer<typeof soldFormSchema>) => {
    const serviceCostValue = hasServiceCost && data.serviceCost ? data.serviceCost : "0";
    
    await createSale({
      vehicleId: vehicle.id,
      sellerId: parseInt(data.sellerId),
      salePrice: data.salePrice,
      buyPrice: data.buyPrice,
      serviceCost: serviceCostValue,
      buyerName: data.buyerName,
    });
    
    form.reset();
    setHasServiceCost(false);
    onConfirm();
  };

  // Calculate estimated profit
  const salePrice = Number(form.watch("salePrice")) || 0;
  const buyPrice = Number(form.watch("buyPrice")) || 0;
  const serviceCost = hasServiceCost ? (Number(form.watch("serviceCost")) || 0) : 0;
  const estimatedProfit = salePrice - buyPrice - serviceCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Vehicle as Sold</DialogTitle>
          <DialogDescription>
            Complete the sale details for {vehicle?.year} {vehicle?.make} {vehicle?.model}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="buyerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buyer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter buyer's name" {...field} data-testid="input-buyer-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sellerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seller</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-seller">
                        <SelectValue placeholder="Select seller" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {usersList?.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>The employee who sold this vehicle</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="salePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Price</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter sale price" 
                      {...field} 
                      data-testid="input-sale-price"
                    />
                  </FormControl>
                  <FormDescription>The final price the vehicle was sold for</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="buyPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Price (Confirm)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Confirm or edit purchase price" 
                      {...field} 
                      data-testid="input-buy-price"
                    />
                  </FormControl>
                  <FormDescription>Original purchase price of the vehicle</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="service-cost-toggle">Were there any service costs?</Label>
                <Switch
                  id="service-cost-toggle"
                  checked={hasServiceCost}
                  onCheckedChange={setHasServiceCost}
                  data-testid="switch-service-cost"
                />
              </div>
              
              {hasServiceCost && (
                <FormField
                  control={form.control}
                  name="serviceCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Cost</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Enter service costs" 
                          {...field}
                          data-testid="input-service-cost"
                        />
                      </FormControl>
                      <FormDescription>This amount will be deducted from profit</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            {/* Profit Preview */}
            <div className={`p-4 rounded-lg border ${estimatedProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-sm text-muted-foreground mb-1">Estimated Profit</div>
              <div className={`text-2xl font-bold ${estimatedProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                ${estimatedProfit.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Sale: ${salePrice.toLocaleString()} - Purchase: ${buyPrice.toLocaleString()} - Service: ${serviceCost.toLocaleString()}
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-confirm-sale">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Sale
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
