# Kiev Shipping — Sea Freight Calculator DEMO

Prototype sea freight calculator built with MDBootstrap, PHP 8, and Vanilla JS. Data lives in local JSON files; no external services or databases are required.

## Getting started

```bash
php -S localhost:8080 -t public
```

Open the demo at http://localhost:8080/demo.html

## Data files

- `public/data/load_ports.json`
- `public/data/discharge_countries.json`
- `public/data/discharge_ports.json`
- `public/data/cargoes.json`
- `public/data/base_rates.json`

## Calculation logic (overview)
- Base rate chosen by load/discharge pair, otherwise by discharge port fallback.
- Quantity multiplier: `1 + (20000 - q) / 100000` clamped to 0.75–1.25.
- Cargo multiplier: `1 + (stowage - 47) / 470`.
- Final rate: `base * q_mult * cargo_mult`, rounded to 2 decimals. Range is ±3% of rate; total is `rate * quantity`.

## Quick API checks (curl)

Each example posts JSON to `http://localhost:8080/api/calc.php`.

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "load_port": "Reni",
  "discharge_country": "Turkey",
  "discharge_port": "Mersin",
  "cargo": "wheat_bulk",
  "stowage_cbft_mt": 47.0,
  "quantity": 20000
}' http://localhost:8080/api/calc.php
```

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "load_port": "Odesa",
  "discharge_country": "Egypt",
  "discharge_port": "Alexandria",
  "cargo": "corn_bulk",
  "stowage_cbft_mt": 48.0,
  "quantity": 15000
}' http://localhost:8080/api/calc.php
```

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "load_port": "Chornomorsk",
  "discharge_country": "Italy",
  "discharge_port": "Ravenna",
  "cargo": "sunflower_meal",
  "stowage_cbft_mt": 52.0,
  "quantity": 30000
}' http://localhost:8080/api/calc.php
```

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "load_port": "Odesa",
  "discharge_country": "Spain",
  "discharge_port": "Barcelona",
  "cargo": "steel_coils",
  "stowage_cbft_mt": 22.0,
  "quantity": 5000
}' http://localhost:8080/api/calc.php
```
