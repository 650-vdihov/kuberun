CREATE TABLE IF NOT EXISTS "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"distance" numeric(10, 2) NOT NULL,
	"duration" integer NOT NULL,
	"pace" numeric(5, 2),
	"calories" integer,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255),
	"gender" varchar(50),
	"height" numeric(5, 2),
	"weight" numeric(5, 2),
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
