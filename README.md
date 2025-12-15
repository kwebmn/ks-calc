# Kiev Shipping — Sea Freight Calculator DEMO

Prototype sea freight calculator built with MDBootstrap, PHP 8, and Vanilla JS. Data lives in a single local JSON configuration file; no external services or databases are required.

## Getting started

```bash
php -S localhost:8080 -t public
```

Open the demo at http://localhost:8080/demo.html

## Data file

- `public/data/freight_config.json` — single source of truth for quantities, coefficients, ports, cargoes, base rates at 20 000 mt, and voyage speed.

## Calculation logic (vFINAL-10kn)
- Base rate: taken from the matching `load_port + discharge_port + cargo` route entry (`base_rate_20000_usd_mt`).
- Quantity adjustment: coefficient per bracket defined in `meta.coefficients` (four fixed brackets).
- Final freight: `base_rate_20000_usd_mt * coefficient`, rounded to one decimal place.
- Voyage duration: `distance_nm / 10 / 24`, rounded to one decimal place; if distance is missing, duration is `N/A`.

## Admin workflow

Weekly admin updates (every Monday) edit only two fields inside `public/data/freight_config.json`:

- `meta.last_update` — ISO date string (`YYYY-MM-DD`).
- `routes[].base_rate_20000_usd_mt` — base freight for 20 000 mt per route.

All ports, cargo lists, coefficients, and brackets remain fixed unless a new approved specification is received. Saving the JSON file is enough; no redeploy is required.
