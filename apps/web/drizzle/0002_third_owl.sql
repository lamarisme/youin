CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"title" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_url" text DEFAULT '' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "profiles_updated_at_idx" ON "profiles" USING btree ("updated_at");