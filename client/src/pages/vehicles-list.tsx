import { useState } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useVehicles, useStatuses, useCreateVehicle, useLocations, useUsers } from "@/hooks/use-vehicles";
import { VehicleCard } from "@/components/vehicle-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Plus, Search, Filter } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVehicleSchema, ROLE_NAMES } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";

export default function VehiclesListPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { roleName } = useAuth();
  
  const canCreateVehicle = roleName && [ROLE_NAMES.ADMIN, ROLE_NAMES.HYBRID, ROLE_NAMES.INNKJOPER].includes(roleName as any);
  
  const { data: vehiclesData, isLoading, isError } = useVehicles({ 
    statusId: statusFilter === "all" ? undefined : Number(statusFilter),
    q: searchQuery 
  });
  const { data: statuses } = useStatuses();

  return (
    <LayoutShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Vehicles</h1>
            <p className="text-muted-foreground mt-1">Manage your inventory and status</p>
          </div>
          {canCreateVehicle && (
            <CreateVehicleDialog 
              open={isCreateOpen} 
              onOpenChange={setIsCreateOpen} 
            />
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 glass-card p-4 rounded-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search make, model, VIN..." 
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses?.map((status) => (
                  <SelectItem key={status.id} value={String(status.id)}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-xl border-destructive/50">
            <h3 className="text-lg font-medium text-destructive">Error loading vehicles</h3>
            <p className="text-muted-foreground max-w-sm mt-1">
              Please try refreshing the page.
            </p>
          </div>
        ) : !vehiclesData?.data || vehiclesData.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-xl">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Filter className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No vehicles found</h3>
            <p className="text-muted-foreground max-w-sm mt-1">
              Try adjusting your filters or search query, or add a new vehicle.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {vehiclesData.data.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </div>
    </LayoutShell>
  );
}

function CreateVehicleDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { mutateAsync: createVehicle, isPending } = useCreateVehicle();
  const { data: statuses } = useStatuses();
  const { data: locations } = useLocations();
  const { data: usersList } = useUsers();
  const { user } = useAuth();

  const form = useForm<z.infer<typeof insertVehicleSchema>>({
    resolver: zodResolver(insertVehicleSchema),
    defaultValues: {
      make: "",
      model: "",
      year: new Date().getFullYear(),
      variant: "",
      color: "",
      regNo: "",
      mileage: 0,
      buyPrice: "",
      addedById: user?.id || undefined,
    },
  });

  async function onSubmit(data: z.infer<typeof insertVehicleSchema>) {
    try {
      // Set default status to first one (Intake) if not set
      if (!data.statusId && statuses?.[0]) {
        data.statusId = statuses[0].id;
      }
      // Set default location if available
      if (!data.locationId && locations?.[0]) {
        data.locationId = locations[0].id;
      }
      
      // Ensure mileage is a number
      if (typeof data.mileage === 'string') {
        data.mileage = parseInt(data.mileage as any) || 0;
      }
      
      await createVehicle(data);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Vehicle creation error:", error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
          <DialogDescription>
            Enter the vehicle details to add it to inventory.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Make</FormLabel>
                    <FormControl><Input placeholder="BMW" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl><Input placeholder="X5" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="variant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variant</FormLabel>
                    <FormControl><Input placeholder="xDrive40i M Sport" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="regNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reg No</FormLabel>
                    <FormControl><Input placeholder="AB12345" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl><Input placeholder="e.g. Black, White, Silver" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mileage (km)</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0"
                        {...field} 
                        value={field.value || ""} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          field.onChange(val ? parseInt(val) : 0);
                        }} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buyPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Innkjøpspris (kr)</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0"
                        {...field} 
                        value={field.value || ""} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          field.onChange(val);
                        }} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="listPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salgspris (kr)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0"
                        {...field}
                        value={field.value || ""}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          field.onChange(val);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VIN</FormLabel>
                    <FormControl><Input placeholder="WBAFW71050L..." {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fuelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drivstoff</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-fuel-type"><SelectValue placeholder="Velg drivstoff" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["Bensin", "Diesel", "Elektrisk", "Hybrid", "Plug-in hybrid", "Hydrogen"].map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="transmission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Girkasse</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-transmission"><SelectValue placeholder="Velg girkasse" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["Manuell", "Automat", "Semi-automat", "CVT"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bodyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Karosseri</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-body-type"><SelectValue placeholder="Velg karosseri" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["Sedan", "SUV", "Stasjonsvogn", "Kombi", "Cabriolet", "Coupé", "Varebil", "MPV", "Pickup"].map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="driveType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hjuldrift</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-drive-type"><SelectValue placeholder="Velg hjuldrift" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["Forhjulsdrift", "Bakhjulsdrift", "Firehjulsdrift (4WD)", "Allhjulsdrift (AWD)"].map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="engineSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motorvolum (L)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="2.0"
                        {...field}
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="horsepower"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effekt (hk)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="150"
                        {...field}
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beskrivelse (annonsetekst)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Skriv en beskrivelse av bilen for annonsen..."
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addedById"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Intaker</FormLabel>
                  <Select 
                    onValueChange={(val) => field.onChange(parseInt(val))} 
                    value={field.value ? String(field.value) : undefined}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-intaker">
                        <SelectValue placeholder="Select who is adding this vehicle" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {usersList?.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-create-vehicle">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Vehicle
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
