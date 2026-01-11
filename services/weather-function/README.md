# Weather Enrichment Azure Function

Azure Function that enriches completed runs with weather data from WeatherAPI.com.

## Overview

This serverless function receives run location data (latitude, longitude, timestamp) and returns weather information mapped to 5 icon categories: sunny, cloudy, rainy, snowy, stormy.

## API

### POST /api/enrichWeather

**Request Body:**
```json
{
  "runId": "uuid",
  "latitude": 46.0569,
  "longitude": 14.5058,
  "timestamp": "2026-01-10T14:30:00Z"
}
```

**Response (200 OK):**
```json
{
  "runId": "uuid",
  "weatherCondition": "sunny",
  "weatherTemp": 22.5,
  "weatherIcon": "sunny",
  "weatherDescription": "Sunny"
}
```

**Error Response (400/500):**
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

## Weather Categories

The function maps WeatherAPI condition codes to 5 categories:

- **sunny**: Clear/sunny conditions (code 1000)
- **cloudy**: Partly cloudy, cloudy, overcast, mist, fog
- **rainy**: All rain conditions (drizzle, light rain, moderate, heavy, showers)
- **snowy**: All snow conditions (light snow, moderate, heavy, blizzard, sleet, ice)
- **stormy**: Thunderstorms (with or without rain/snow)

## Environment Variables

- `WEATHERAPI_KEY`: API key from weatherapi.com (required)
- `FUNCTIONS_WORKER_RUNTIME`: Set to "node"

## Local Development

1. Install dependencies:
   ```bash
   cd services/weather-function
   pnpm install
   ```

2. Set up `local.settings.json` with your WeatherAPI key

3. Start the function:
   ```bash
   pnpm start
   ```

4. Test locally:
   ```bash
   curl -X POST http://localhost:7071/api/enrichWeather \
     -H "Content-Type: application/json" \
     -d '{
       "runId": "test-123",
       "latitude": 46.0569,
       "longitude": 14.5058,
       "timestamp": "2026-01-10T14:30:00Z"
     }'
   ```

## Deployment Notes (Azure Functions)

This project uses the Node.js v4 programming model (`@azure/functions` + `app.http(...)`) and does not generate `function.json` files. In Azure, ensure worker indexing is enabled or the portal/CLI will report 0 functions.

- Function App settings: set `AzureWebJobsFeatureFlags=EnableWorkerIndexing` (and ensure `FUNCTIONS_WORKER_RUNTIME=node`).
- Publish (Linux): `func azure functionapp publish <APP_NAME> --build remote` (this repo’s `.funcignore` excludes `node_modules` and `dist`).
- Optional: run `npm run build` locally first to catch TypeScript errors before publishing.
