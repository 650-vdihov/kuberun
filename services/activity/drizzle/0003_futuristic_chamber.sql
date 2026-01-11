ALTER TABLE "runs" ADD COLUMN "weather_condition" varchar(20);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "weather_temp" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "weather_icon" varchar(20);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "weather_description" varchar(255);