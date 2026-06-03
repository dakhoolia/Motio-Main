import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Car, Gauge, Fuel, Settings2 } from "lucide-react";
import type { Vehicle, VehicleStatus, Location } from "@shared/schema";

type PublicVehicle = Vehicle & { status: VehicleStatus; location: Location | null; coverPhotoUrl: string | null };

export default function ShowroomPage() {
  const [search, setSearch] = useState("");

  const { data: vehicles = [], isLoading } = useQuery<PublicVehicle[]>({
    queryKey: ["/api/showroom"],
    queryFn: async () => {
      const res = await fetch("/api/showroom");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    staleTime: 60000,
  });

  const filtered = vehicles.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${v.year} ${v.make} ${v.model} ${v.variant ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <Car className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Motio Showroom</span>
          </div>
          <Link href="/login">
            <span className="text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
              Ansattinnlogging →
            </span>
          </Link>
        </div>
      </header>

      <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight">Biler til salgs</h1>
          <p className="text-blue-200 text-lg mb-8">Finn din neste drømmebil hos oss</p>
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Søk etter merke, modell, årsmodell..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-white text-gray-900 rounded-xl border-0 shadow-xl text-base placeholder:text-gray-400"
              data-testid="input-showroom-search"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <Car className="h-20 w-20 mx-auto mb-4 opacity-20" />
            <p className="text-xl font-semibold">Ingen biler funnet</p>
            <p className="text-sm mt-1">Prøv et annet søk</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6 font-medium">
              {filtered.length} bil{filtered.length !== 1 ? "er" : ""} til salgs
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((v) => (
                <ShowroomCard key={v.id} vehicle={v} />
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="border-t border-gray-200 bg-white py-8 mt-10">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          © {new Date().getFullYear()} Motio Showroom. Alle rettigheter reservert.
        </div>
      </footer>
    </div>
  );
}

function ShowroomCard({ vehicle: v }: { vehicle: PublicVehicle }) {
  const isReserved = v.status.name === "Reserved";

  return (
    <Link href={`/showroom/${v.id}`}>
      <div
        className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full"
        data-testid={`card-showroom-${v.id}`}
      >
        <div className="relative h-48 bg-gray-100 overflow-hidden">
          {v.coverPhotoUrl ? (
            <img
              src={v.coverPhotoUrl}
              alt={`${v.make} ${v.model}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Car className="h-20 w-20 text-gray-200" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                isReserved ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
              }`}
            >
              {isReserved ? "Reservert" : "Til salgs"}
            </span>
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-gray-900 text-base leading-snug">
            {v.year} {v.make} {v.model}
          </h3>
          {v.variant && <p className="text-xs text-gray-500 mt-0.5 truncate">{v.variant}</p>}

          {v.listPrice && (
            <p className="text-blue-700 font-bold text-xl mt-2">
              kr {Number(v.listPrice).toLocaleString("nb-NO")},-
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-y-1.5 text-xs text-gray-500">
            {v.mileage != null && (
              <div className="flex items-center gap-1">
                <Gauge className="h-3 w-3 shrink-0" />
                <span>{v.mileage.toLocaleString("nb-NO")} km</span>
              </div>
            )}
            {v.fuelType && (
              <div className="flex items-center gap-1">
                <Fuel className="h-3 w-3 shrink-0" />
                <span>{v.fuelType}</span>
              </div>
            )}
            {v.transmission && (
              <div className="flex items-center gap-1 col-span-2">
                <Settings2 className="h-3 w-3 shrink-0" />
                <span>{v.transmission}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
