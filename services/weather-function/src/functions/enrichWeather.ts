import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

interface WeatherRequest {
  runId: string;
  latitude: number;
  longitude: number;
  timestamp: string; // ISO 8601 date string
}

interface WeatherResponse {
  runId: string;
  weatherCondition: string; // sunny, cloudy, rainy, snowy, stormy
  weatherTemp: number; // Celsius
  weatherIcon: string; // icon category
  weatherDescription?: string;
}

interface WeatherAPIResponse {
  forecast: {
    forecastday: Array<{
      hour: Array<{
        time_epoch: number;
        temp_c: number;
        condition: {
          text: string;
          code: number;
        };
        wind_kph: number;
        humidity: number;
      }>;
    }>;
  };
}

// Map WeatherAPI condition codes to our 5 categories
// Based on: https://www.weatherapi.com/docs/weather_conditions.json
function mapWeatherCondition(code: number): string {
  // Sunny/Clear
  if (code === 1000) return "sunny";
  
  // Cloudy (partly cloudy, cloudy, overcast, mist, fog)
  if ([1003, 1006, 1009, 1030, 1135, 1147].includes(code)) return "cloudy";
  
  // Rainy (patchy rain, light rain, moderate rain, heavy rain, drizzle, etc.)
  if (
    [1063, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246].includes(code)
  ) {
    return "rainy";
  }
  
  // Snowy (patchy snow, light snow, moderate snow, heavy snow, blizzard, ice, sleet)
  if (
    [1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code)
  ) {
    return "snowy";
  }
  
  // Stormy (thunderstorm, thunder with rain, thunder with snow)
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return "stormy";
  
  // Default to cloudy for unknown conditions
  return "cloudy";
}

async function fetchWeatherData(
  latitude: number,
  longitude: number,
  timestamp: string
): Promise<{ condition: string; temp: number; description: string }> {
  const apiKey = process.env.WEATHERAPI_KEY;
  
  if (!apiKey) {
    throw new Error("WEATHERAPI_KEY environment variable is not set");
  }

  // Convert ISO timestamp to date format (YYYY-MM-DD)
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split("T")[0];
  
  // WeatherAPI History endpoint
  const url = `http://api.weatherapi.com/v1/history.json?key=${apiKey}&q=${latitude},${longitude}&dt=${dateStr}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`WeatherAPI request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json() as WeatherAPIResponse;
  
  // Find the hour closest to the timestamp
  const targetTime = date.getTime() / 1000; // Unix timestamp in seconds
  const forecastDay = data.forecast.forecastday[0];
  
  if (!forecastDay || !forecastDay.hour || forecastDay.hour.length === 0) {
    throw new Error("No weather data available for the specified date");
  }
  
  const hours = forecastDay.hour;
  let closestHour = hours[0];
  let minDiff = Math.abs(closestHour.time_epoch - targetTime);
  
  for (const hour of hours) {
    const diff = Math.abs(hour.time_epoch - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestHour = hour;
    }
  }
  
  const weatherIcon = mapWeatherCondition(closestHour.condition.code);
  
  return {
    condition: weatherIcon,
    temp: Math.round(closestHour.temp_c * 10) / 10, // Round to 1 decimal
    description: closestHour.condition.text,
  };
}

export async function enrichWeather(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("Weather enrichment function triggered");

  try {
    // Parse request body
    const body = (await request.json()) as WeatherRequest;
    
    // Validate required fields
    if (!body.runId || !body.latitude || !body.longitude || !body.timestamp) {
      return {
        status: 400,
        jsonBody: {
          error: "Missing required fields: runId, latitude, longitude, timestamp",
        },
      };
    }

    // Validate coordinates
    if (body.latitude < -90 || body.latitude > 90) {
      return {
        status: 400,
        jsonBody: { error: "Invalid latitude: must be between -90 and 90" },
      };
    }

    if (body.longitude < -180 || body.longitude > 180) {
      return {
        status: 400,
        jsonBody: { error: "Invalid longitude: must be between -180 and 180" },
      };
    }

    context.log(
      `Fetching weather for run ${body.runId} at (${body.latitude}, ${body.longitude}) on ${body.timestamp}`
    );

    // Fetch weather data
    const weather = await fetchWeatherData(
      body.latitude,
      body.longitude,
      body.timestamp
    );

    const response: WeatherResponse = {
      runId: body.runId,
      weatherCondition: weather.condition,
      weatherTemp: weather.temp,
      weatherIcon: weather.condition,
      weatherDescription: weather.description,
    };

    context.log(`Weather enrichment successful: ${weather.condition}, ${weather.temp}°C`);

    return {
      status: 200,
      jsonBody: response,
    };
  } catch (error) {
    context.error("Error enriching weather data:", error);
    
    return {
      status: 500,
      jsonBody: {
        error: "Failed to enrich weather data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

app.http("enrichWeather", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: enrichWeather,
});
