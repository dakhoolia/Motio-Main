import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Loader2, Car, ArrowLeft, MapPin, Gauge, ChevronLeft, ChevronRight, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import type { Vehicle, VehicleStatus, Location, Photo } from "@shared/schema";

type PublicVehicle = Vehicle & { status: VehicleStatus; location: Location | null; photos: Photo[] };

function calcMonthly(price: number, equity: number, years: number, rate: number) {
  const P = Math.max(0, price - equity);
  if (P === 0) return 0;
  const r = rate / 100 / 12;
  const n = years * 12;
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export default function ShowroomDetailPage() {
  const [, params] = useRoute("/showroom/:id");
  const id = params ? parseInt(params.id) : 0;

  const { data: vehicle, isLoading, error } = useQuery<PublicVehicle>({
    queryKey: ["/api/showroom", id],
    queryFn: async () => {
      const res = await fetch(`/api/showroom/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  const [activePhoto, setActivePhoto] = useState(0);
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(7);

  const photos = vehicle?.photos ?? [];
  const price = vehicle?.listPrice ? Number(vehicle.listPrice) : 0;
  const [equity, setEquity] = useState(() => Math.round(price * 0.2));
  const monthly = useMemo(() => calcMonthly(price, equity, years, rate), [price, equity, years, rate]);

  function prevPhoto() { setActivePhoto(p => Math.max(0, p - 1)); }
  function nextPhoto() { setActivePhoto(p => Math.min(photos.length - 1, p + 1)); }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Car className="h-20 w-20 text-gray-200" />
        <p className="text-xl font-semibold text-gray-600">Bilen ble ikke funnet</p>
        <Link href="/showroom">
          <Button variant="outline">Tilbake til oversikten</Button>
        </Link>
      </div>
    );
  }

  const specs = [
    { label: "VIN", value: vehicle.vin },
    { label: "Årsmodell", value: vehicle.year?.toString() },
    { label: "Kilometerstand", value: vehicle.mileage != null ? `${vehicle.mileage.toLocaleString("nb-NO")} km` : null },
    { label: "Girkasse", value: vehicle.transmission },
    { label: "Drivstoff", value: vehicle.fuelType },
    { label: "Karosseri", value: vehicle.bodyType },
    { label: "Hjuldrift", value: vehicle.driveType },
    { label: "Motorvolum", value: vehicle.engineSize ? `${vehicle.engineSize}L` : null },
    { label: "Effekt", value: vehicle.horsepower ? `${vehicle.horsepower} hk` : null },
    { label: "Eksteriørfarge", value: vehicle.color },
    { label: "Regnr", value: vehicle.regNo },
    { label: "Sted", value: vehicle.location?.name },
  ].filter(s => s.value);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/showroom">
            <div className="flex items-center gap-2 text-gray-600 hover:text-blue-700 cursor-pointer transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Tilbake</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center shadow">
              <Car className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 hidden sm:block">Motio Showroom</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Photo + Specs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo gallery */}
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <div className="relative bg-gray-100" style={{ aspectRatio: "16/9" }}>
                {photos.length > 0 ? (
                  <>
                    <img
                      src={photos[activePhoto].url}
                      alt={`${vehicle.make} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={prevPhoto}
                          disabled={activePhoto === 0}
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 disabled:opacity-30 transition"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          onClick={nextPhoto}
                          disabled={activePhoto === photos.length - 1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 disabled:opacity-30 transition"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                        <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          {activePhoto + 1} / {photos.length}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Car className="h-24 w-24 text-gray-200" />
                  </div>
                )}
              </div>

              {photos.length > 1 && (
                <div className="p-3 flex gap-2 overflow-x-auto">
                  {photos.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => setActivePhoto(i)}
                      className={`shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition-all ${
                        i === activePhoto ? "border-blue-600" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Oversikt specs */}
            {specs.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-900 text-lg mb-4">Oversikt</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                  {specs.map(({ label, value }) => (
                    <div key={label} className="flex flex-col">
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
                      <span className="text-sm font-semibold text-gray-800 mt-0.5">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {vehicle.description && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-lg">Annonsetekst</h2>
                  {vehicle.finnCode && (
                    <a
                      href={`https://www.finn.no/car/used/ad.html?finnkode=${vehicle.finnCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      ID #{vehicle.finnCode}
                    </a>
                  )}
                </div>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">{vehicle.description}</p>
              </div>
            )}
          </div>

          {/* Right: Price card + financing */}
          <div className="space-y-5">
            {/* Price card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h1 className="font-bold text-gray-900 text-lg leading-snug">
                {vehicle.year} {vehicle.make} {vehicle.model}
                {vehicle.variant ? ` ${vehicle.variant}` : ""}
              </h1>
              {vehicle.listPrice ? (
                <p className="text-blue-700 font-bold text-3xl mt-3">
                  kr {Number(vehicle.listPrice).toLocaleString("nb-NO")},-
                </p>
              ) : (
                <p className="text-gray-500 text-base mt-3 italic">Kontakt oss for pris</p>
              )}

              <div className="mt-4 space-y-2 text-sm text-gray-500">
                {vehicle.mileage != null && (
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 shrink-0" />
                    <span>{vehicle.mileage.toLocaleString("nb-NO")} km</span>
                  </div>
                )}
                {vehicle.fuelType && (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 shrink-0 text-center text-xs">⛽</span>
                    <span>{vehicle.fuelType}</span>
                  </div>
                )}
                {vehicle.transmission && (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 shrink-0 text-center text-xs">⚙️</span>
                    <span>{vehicle.transmission}</span>
                  </div>
                )}
                {vehicle.location?.name && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{vehicle.location.name}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl">
                  <Mail className="h-4 w-4 mr-2" />
                  Send melding
                </Button>
                <Button variant="outline" className="w-full h-11 border-2 border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white font-semibold rounded-xl transition-colors">
                  <Phone className="h-4 w-4 mr-2" />
                  Avtal visning
                </Button>
              </div>
            </div>

            {/* Financing calculator */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6" data-testid="section-financing">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Finansiering</h2>
              <p className="text-xs text-gray-400 mb-5 leading-relaxed">
                Her kan du sjekke hva et lån vil koste deg. Kalkulatoren gir kun et estimat.
              </p>

              <div className="space-y-5">
                <CalcField
                  label="Egenkapital"
                  value={equity}
                  onChange={setEquity}
                  min={0}
                  max={Math.max(price, 1000000)}
                  step={10000}
                  format={(v) => `kr ${v.toLocaleString("nb-NO")}`}
                />
                <CalcField
                  label="Antall år"
                  value={years}
                  onChange={setYears}
                  min={1}
                  max={10}
                  step={1}
                  format={(v) => `${v} år`}
                />
                <CalcField
                  label="Rente"
                  value={rate}
                  onChange={setRate}
                  min={1}
                  max={20}
                  step={0.5}
                  format={(v) => `${v} %`}
                />
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl text-center" data-testid="section-monthly-payment">
                <p className="text-xs text-gray-500 mb-1">Estimert månedskostnad</p>
                {price > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-blue-700">
                      kr {Math.round(monthly).toLocaleString("nb-NO")},-
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Lån: kr {Math.max(0, price - equity).toLocaleString("nb-NO")} over {years} år
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 italic">Legg til pris for å beregne</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalcField({
  label, sublabel, value, onChange, min, max, step, format,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
        </div>
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
          className="w-24 h-8 text-right text-sm font-semibold border-gray-200"
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&>.relative>span:first-child]:bg-blue-600"
      />
    </div>
  );
}
