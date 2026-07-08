import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "../middleware";
import { ROLE_NAMES } from "@shared/schema";
import { z } from "zod";

const { ADMIN } = ROLE_NAMES;

export const embedRouter = Router();

// ── CORS middleware for all embed/public routes ────────────────────────────────
const allowPublicCors = (_req: Request, res: Response, next: () => void) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
};

// ── GET /public/:slug/vehicles ─────────────────────────────────────────────────
// Public JSON endpoint — no auth, open CORS
embedRouter.get("/public/:slug/vehicles", allowPublicCors, async (req, res) => {
  const slug = String(req.params.slug);
  const vehicles = await storage.getVehiclesBySlug(slug);
  if (vehicles === null) return res.status(404).json({ message: "Dealership not found" });
  res.json(vehicles);
});

// ── GET /embed/:slug ───────────────────────────────────────────────────────────
// Standalone HTML iframe page — no auth, open CORS
embedRouter.get("/embed/:slug", allowPublicCors, async (req, res) => {
  const slug = String(req.params.slug);
  const settings = await storage.getDealershipSettings();
  if (!settings || settings.slug !== slug) {
    return res.status(404).send("<h1>404 – Dealership not found</h1>");
  }

  const apiBase = `${req.protocol}://${req.get("host")}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(buildEmbedHtml(settings.name, slug, apiBase));
});

// ── GET /api/settings/dealership ──────────────────────────────────────────────
embedRouter.get("/api/settings/dealership", requireAuth, async (_req, res) => {
  const settings = await storage.getDealershipSettings();
  res.json(settings ?? { name: "", slug: "" });
});

// ── PUT /api/settings/dealership ──────────────────────────────────────────────
embedRouter.put("/api/settings/dealership", requireRole(ADMIN), async (req, res) => {
  const { name, slug } = z.object({
    name: z.string().min(1),
    slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug kan kun inneholde små bokstaver, tall og bindestreker",
    }),
  }).parse(req.body);

  try {
    const updated = await storage.upsertDealershipSettings({ name, slug });
    res.json(updated);
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(400).json({ message: "Denne slug-en er allerede i bruk" });
    }
    throw err;
  }
});

// ── Embed HTML template ────────────────────────────────────────────────────────
function buildEmbedHtml(dealerName: string, slug: string, apiBase: string): string {
  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(dealerName)} – Biler til salgs</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      padding: 20px;
    }
    #motio-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 8px;
    }
    #motio-header h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; }
    #motio-count { font-size: 0.85rem; color: #64748b; }
    #motio-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 18px;
    }
    .motio-card {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
      transition: box-shadow .2s, transform .2s;
      cursor: default;
    }
    .motio-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,.10); transform: translateY(-2px); }
    .motio-card-img {
      width: 100%;
      aspect-ratio: 16/10;
      object-fit: cover;
      background: #e2e8f0;
      display: block;
    }
    .motio-card-img-placeholder {
      width: 100%;
      aspect-ratio: 16/10;
      background: linear-gradient(135deg,#e2e8f0 0%,#cbd5e1 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 2rem;
    }
    .motio-card-body { padding: 14px 16px; }
    .motio-card-title { font-size: 1rem; font-weight: 700; margin-bottom: 2px; color: #0f172a; }
    .motio-card-sub { font-size: 0.8rem; color: #64748b; margin-bottom: 10px; }
    .motio-card-meta {
      display: flex;
      gap: 12px;
      font-size: 0.78rem;
      color: #475569;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .motio-card-meta span::before { margin-right: 3px; }
    .motio-card-price {
      font-size: 1.1rem;
      font-weight: 800;
      color: #0ea5e9;
      letter-spacing: -0.03em;
    }
    .motio-badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: #dcfce7;
      color: #16a34a;
      margin-bottom: 6px;
    }
    #motio-loading, #motio-error {
      text-align: center;
      padding: 48px 0;
      color: #64748b;
      font-size: 0.95rem;
    }
    #motio-error { color: #ef4444; }
    #motio-footer {
      margin-top: 24px;
      text-align: center;
      font-size: 0.72rem;
      color: #94a3b8;
    }
    #motio-footer a { color: #0ea5e9; text-decoration: none; }
  </style>
</head>
<body>
  <div id="motio-header">
    <h2>${esc(dealerName)}</h2>
    <span id="motio-count"></span>
  </div>
  <div id="motio-loading">Laster inn biler…</div>
  <div id="motio-grid" style="display:none"></div>
  <div id="motio-error" style="display:none">Kunne ikke laste inn biler.</div>
  <div id="motio-footer">Drevet av <a href="https://motio.no" target="_blank">Motio</a></div>

  <script>
    (function() {
      const API = "${apiBase}/public/${slug}/vehicles";
      const grid = document.getElementById("motio-grid");
      const loading = document.getElementById("motio-loading");
      const error = document.getElementById("motio-error");
      const count = document.getElementById("motio-count");

      function fmt(n) {
        if (!n) return null;
        return Number(n).toLocaleString("nb-NO") + " kr";
      }
      function fmtKm(n) {
        return n != null ? Number(n).toLocaleString("nb-NO") + " km" : null;
      }

      fetch(API)
        .then(r => r.json())
        .then(cars => {
          loading.style.display = "none";
          if (!cars.length) {
            error.textContent = "Ingen biler tilgjengelig for øyeblikket.";
            error.style.display = "";
            return;
          }
          count.textContent = cars.length + " bil" + (cars.length !== 1 ? "er" : "");
          grid.style.display = "";
          cars.forEach(car => {
            const price = fmt(car.listPrice);
            const km = fmtKm(car.mileage);
            const card = document.createElement("div");
            card.className = "motio-card";
            card.innerHTML =
              (car.coverPhotoUrl
                ? '<img class="motio-card-img" src="${apiBase}' + car.coverPhotoUrl + '" alt="' + car.make + ' ' + car.model + '" loading="lazy" />'
                : '<div class="motio-card-img-placeholder">🚗</div>'
              ) +
              '<div class="motio-card-body">' +
                '<div class="motio-badge">' + (car.status?.name || "Til salgs") + '</div>' +
                '<div class="motio-card-title">' + car.year + " " + car.make + " " + car.model + '</div>' +
                (car.variant ? '<div class="motio-card-sub">' + car.variant + '</div>' : '') +
                '<div class="motio-card-meta">' +
                  (km ? '<span>📍 ' + km + '</span>' : '') +
                  (car.fuelType ? '<span>⛽ ' + car.fuelType + '</span>' : '') +
                  (car.transmission ? '<span>⚙️ ' + car.transmission + '</span>' : '') +
                '</div>' +
                (price ? '<div class="motio-card-price">' + price + '</div>' : '') +
              '</div>';
            grid.appendChild(card);
          });
        })
        .catch(() => {
          loading.style.display = "none";
          error.style.display = "";
        });
    })();
  </script>
</body>
</html>`;
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
