import { Link } from "wouter";
import { format } from "date-fns";
import { Car, MapPin, Calendar, Activity } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { Vehicle, VehicleStatus, Location } from "@shared/schema";

interface VehicleCardProps {
  vehicle: Vehicle & { status: VehicleStatus; location: Location | null; coverPhotoUrl?: string | null };
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  return (
    <Link href={`/vehicles/${vehicle.id}`}>
      <div className="group glass-card rounded-2xl overflow-hidden cursor-pointer h-full flex flex-col hover-elevate">
        {/* Image */}
        <div className="relative h-44 overflow-hidden bg-muted/60">
          {vehicle.coverPhotoUrl ? (
            <img
              src={vehicle.coverPhotoUrl}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Car className="h-14 w-14 text-muted-foreground/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="absolute top-3 right-3">
            <StatusBadge status={vehicle.status.name} />
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <div className="mb-3">
            <h3
              className="font-bold text-[16px] text-foreground leading-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}
            >
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            {vehicle.variant && (
              <p className="text-[12px] text-muted-foreground mt-0.5">{vehicle.variant}</p>
            )}
          </div>

          <div className="mt-auto pt-3 border-t border-black/[0.06] dark:border-white/[0.06] grid grid-cols-2 gap-y-2">
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span>{vehicle.mileage?.toLocaleString()} km</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span className="truncate">{vehicle.location?.name || "Unknown"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground col-span-2">
              <Calendar className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <span>Acquired {vehicle.acquiredAt ? format(new Date(vehicle.acquiredAt), "MMM d, yyyy") : "N/A"}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
