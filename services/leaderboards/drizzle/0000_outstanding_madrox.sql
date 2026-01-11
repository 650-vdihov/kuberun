CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"distance" numeric(10, 2) NOT NULL,
	"duration" integer NOT NULL,
	"pace" numeric(5, 2),
	"avg_speed" numeric(5, 2),
	"calories" integer,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"completed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
