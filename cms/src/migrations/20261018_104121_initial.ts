import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_users_role" AS ENUM('admin', 'redaktor', 'agent', 'reader');
  CREATE TYPE "payload"."enum_authors_kind" AS ENUM('person', 'organization');
  CREATE TYPE "payload"."enum_posts_origin" AS ENUM('manual', 'n8n');
  CREATE TYPE "payload"."enum_posts_review_state" AS ENUM('ny', 'til_vurdering', 'godkjent', 'avvist');
  CREATE TYPE "payload"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__posts_v_version_origin" AS ENUM('manual', 'n8n');
  CREATE TYPE "payload"."enum__posts_v_version_review_state" AS ENUM('ny', 'til_vurdering', 'godkjent', 'avvist');
  CREATE TYPE "payload"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "payload"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "payload"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TABLE "payload"."users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "payload"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "payload"."enum_users_role" DEFAULT 'redaktor' NOT NULL,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"credit" varchar,
  	"license" varchar,
  	"source_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar,
  	"sizes_og_url" varchar,
  	"sizes_og_width" numeric,
  	"sizes_og_height" numeric,
  	"sizes_og_mime_type" varchar,
  	"sizes_og_filesize" numeric,
  	"sizes_og_filename" varchar
  );
  
  CREATE TABLE "payload"."categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."authors_same_as" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."authors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"kind" "payload"."enum_authors_kind" DEFAULT 'organization' NOT NULL,
  	"role" varchar,
  	"bio" varchar,
  	"avatar_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."posts_suggested_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "payload"."posts_related_sak_ids" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."posts_related_horing_ids" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."posts_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "payload"."posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"excerpt" varchar,
  	"body_markdown" varchar,
  	"content" jsonb,
  	"hero_image_id" integer,
  	"featured" boolean DEFAULT false,
  	"category_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"updated_at_display" timestamp(3) with time zone,
  	"reading_time_minutes" numeric,
  	"origin" "payload"."enum_posts_origin" DEFAULT 'manual',
  	"source_event" varchar,
  	"ai_assisted" boolean DEFAULT false,
  	"ai_model_family" varchar,
  	"ai_generated_at" timestamp(3) with time zone,
  	"ai_prompt_version" varchar,
  	"review_state" "payload"."enum_posts_review_state" DEFAULT 'ny',
  	"review_note" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"seo_canonical_override" varchar,
  	"seo_noindex" boolean DEFAULT false,
  	"social_bluesky_text" varchar,
  	"social_social_posted_at" timestamp(3) with time zone,
  	"social_bluesky_uri" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer,
  	"authors_id" integer
  );
  
  CREATE TABLE "payload"."_posts_v_version_suggested_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_posts_v_version_related_sak_ids" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_posts_v_version_related_horing_ids" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_posts_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_body_markdown" varchar,
  	"version_content" jsonb,
  	"version_hero_image_id" integer,
  	"version_featured" boolean DEFAULT false,
  	"version_category_id" integer,
  	"version_published_at" timestamp(3) with time zone,
  	"version_updated_at_display" timestamp(3) with time zone,
  	"version_reading_time_minutes" numeric,
  	"version_origin" "payload"."enum__posts_v_version_origin" DEFAULT 'manual',
  	"version_source_event" varchar,
  	"version_ai_assisted" boolean DEFAULT false,
  	"version_ai_model_family" varchar,
  	"version_ai_generated_at" timestamp(3) with time zone,
  	"version_ai_prompt_version" varchar,
  	"version_review_state" "payload"."enum__posts_v_version_review_state" DEFAULT 'ny',
  	"version_review_note" varchar,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_og_image_id" integer,
  	"version_seo_canonical_override" varchar,
  	"version_seo_noindex" boolean DEFAULT false,
  	"version_social_bluesky_text" varchar,
  	"version_social_social_posted_at" timestamp(3) with time zone,
  	"version_social_bluesky_uri" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "payload"."_posts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer,
  	"authors_id" integer
  );
  
  CREATE TABLE "payload"."payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "payload"."enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "payload"."enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload"."payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "payload"."enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"categories_id" integer,
  	"tags_id" integer,
  	"authors_id" integer,
  	"posts_id" integer,
  	"payload_jobs_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."authors_same_as" ADD CONSTRAINT "authors_same_as_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."authors" ADD CONSTRAINT "authors_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."posts_suggested_tags" ADD CONSTRAINT "posts_suggested_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."posts_related_sak_ids" ADD CONSTRAINT "posts_related_sak_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."posts_related_horing_ids" ADD CONSTRAINT "posts_related_horing_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."posts_sources" ADD CONSTRAINT "posts_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."posts" ADD CONSTRAINT "posts_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."posts" ADD CONSTRAINT "posts_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."posts_rels" ADD CONSTRAINT "posts_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."posts_rels" ADD CONSTRAINT "posts_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "payload"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v_version_suggested_tags" ADD CONSTRAINT "_posts_v_version_suggested_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v_version_related_sak_ids" ADD CONSTRAINT "_posts_v_version_related_sak_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v_version_related_horing_ids" ADD CONSTRAINT "_posts_v_version_related_horing_ids_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v_version_sources" ADD CONSTRAINT "_posts_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v" ADD CONSTRAINT "_posts_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v" ADD CONSTRAINT "_posts_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "payload"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v" ADD CONSTRAINT "_posts_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "payload"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "payload"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "payload"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "payload"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "payload"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_jobs_fk" FOREIGN KEY ("payload_jobs_id") REFERENCES "payload"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "payload"."users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "payload"."users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "payload"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "payload"."users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "payload"."users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "payload"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "payload"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "payload"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "payload"."media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "payload"."media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "payload"."media" USING btree ("sizes_hero_filename");
  CREATE INDEX "media_sizes_og_sizes_og_filename_idx" ON "payload"."media" USING btree ("sizes_og_filename");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "payload"."categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "payload"."categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "payload"."categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "tags_slug_idx" ON "payload"."tags" USING btree ("slug");
  CREATE INDEX "tags_updated_at_idx" ON "payload"."tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "payload"."tags" USING btree ("created_at");
  CREATE INDEX "authors_same_as_order_idx" ON "payload"."authors_same_as" USING btree ("_order");
  CREATE INDEX "authors_same_as_parent_id_idx" ON "payload"."authors_same_as" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "authors_slug_idx" ON "payload"."authors" USING btree ("slug");
  CREATE INDEX "authors_avatar_idx" ON "payload"."authors" USING btree ("avatar_id");
  CREATE INDEX "authors_updated_at_idx" ON "payload"."authors" USING btree ("updated_at");
  CREATE INDEX "authors_created_at_idx" ON "payload"."authors" USING btree ("created_at");
  CREATE INDEX "posts_suggested_tags_order_idx" ON "payload"."posts_suggested_tags" USING btree ("_order");
  CREATE INDEX "posts_suggested_tags_parent_id_idx" ON "payload"."posts_suggested_tags" USING btree ("_parent_id");
  CREATE INDEX "posts_related_sak_ids_order_idx" ON "payload"."posts_related_sak_ids" USING btree ("_order");
  CREATE INDEX "posts_related_sak_ids_parent_id_idx" ON "payload"."posts_related_sak_ids" USING btree ("_parent_id");
  CREATE INDEX "posts_related_horing_ids_order_idx" ON "payload"."posts_related_horing_ids" USING btree ("_order");
  CREATE INDEX "posts_related_horing_ids_parent_id_idx" ON "payload"."posts_related_horing_ids" USING btree ("_parent_id");
  CREATE INDEX "posts_sources_order_idx" ON "payload"."posts_sources" USING btree ("_order");
  CREATE INDEX "posts_sources_parent_id_idx" ON "payload"."posts_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "posts_slug_idx" ON "payload"."posts" USING btree ("slug");
  CREATE INDEX "posts_hero_image_idx" ON "payload"."posts" USING btree ("hero_image_id");
  CREATE INDEX "posts_category_idx" ON "payload"."posts" USING btree ("category_id");
  CREATE UNIQUE INDEX "posts_source_event_idx" ON "payload"."posts" USING btree ("source_event");
  CREATE INDEX "posts_seo_seo_og_image_idx" ON "payload"."posts" USING btree ("seo_og_image_id");
  CREATE INDEX "posts_updated_at_idx" ON "payload"."posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "payload"."posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "payload"."posts" USING btree ("_status");
  CREATE INDEX "posts_rels_order_idx" ON "payload"."posts_rels" USING btree ("order");
  CREATE INDEX "posts_rels_parent_idx" ON "payload"."posts_rels" USING btree ("parent_id");
  CREATE INDEX "posts_rels_path_idx" ON "payload"."posts_rels" USING btree ("path");
  CREATE INDEX "posts_rels_tags_id_idx" ON "payload"."posts_rels" USING btree ("tags_id");
  CREATE INDEX "posts_rels_authors_id_idx" ON "payload"."posts_rels" USING btree ("authors_id");
  CREATE INDEX "_posts_v_version_suggested_tags_order_idx" ON "payload"."_posts_v_version_suggested_tags" USING btree ("_order");
  CREATE INDEX "_posts_v_version_suggested_tags_parent_id_idx" ON "payload"."_posts_v_version_suggested_tags" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_related_sak_ids_order_idx" ON "payload"."_posts_v_version_related_sak_ids" USING btree ("_order");
  CREATE INDEX "_posts_v_version_related_sak_ids_parent_id_idx" ON "payload"."_posts_v_version_related_sak_ids" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_related_horing_ids_order_idx" ON "payload"."_posts_v_version_related_horing_ids" USING btree ("_order");
  CREATE INDEX "_posts_v_version_related_horing_ids_parent_id_idx" ON "payload"."_posts_v_version_related_horing_ids" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_sources_order_idx" ON "payload"."_posts_v_version_sources" USING btree ("_order");
  CREATE INDEX "_posts_v_version_sources_parent_id_idx" ON "payload"."_posts_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_parent_idx" ON "payload"."_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "payload"."_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_hero_image_idx" ON "payload"."_posts_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_posts_v_version_version_category_idx" ON "payload"."_posts_v" USING btree ("version_category_id");
  CREATE INDEX "_posts_v_version_version_source_event_idx" ON "payload"."_posts_v" USING btree ("version_source_event");
  CREATE INDEX "_posts_v_version_seo_version_seo_og_image_idx" ON "payload"."_posts_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "payload"."_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "payload"."_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "payload"."_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "payload"."_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "payload"."_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "payload"."_posts_v" USING btree ("latest");
  CREATE INDEX "_posts_v_autosave_idx" ON "payload"."_posts_v" USING btree ("autosave");
  CREATE INDEX "_posts_v_rels_order_idx" ON "payload"."_posts_v_rels" USING btree ("order");
  CREATE INDEX "_posts_v_rels_parent_idx" ON "payload"."_posts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_posts_v_rels_path_idx" ON "payload"."_posts_v_rels" USING btree ("path");
  CREATE INDEX "_posts_v_rels_tags_id_idx" ON "payload"."_posts_v_rels" USING btree ("tags_id");
  CREATE INDEX "_posts_v_rels_authors_id_idx" ON "payload"."_posts_v_rels" USING btree ("authors_id");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload"."payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload"."payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload"."payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload"."payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload"."payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload"."payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload"."payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload"."payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload"."payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload"."payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload"."payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_authors_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("authors_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_payload_jobs_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("payload_jobs_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."users_sessions" CASCADE;
  DROP TABLE "payload"."users" CASCADE;
  DROP TABLE "payload"."media" CASCADE;
  DROP TABLE "payload"."categories" CASCADE;
  DROP TABLE "payload"."tags" CASCADE;
  DROP TABLE "payload"."authors_same_as" CASCADE;
  DROP TABLE "payload"."authors" CASCADE;
  DROP TABLE "payload"."posts_suggested_tags" CASCADE;
  DROP TABLE "payload"."posts_related_sak_ids" CASCADE;
  DROP TABLE "payload"."posts_related_horing_ids" CASCADE;
  DROP TABLE "payload"."posts_sources" CASCADE;
  DROP TABLE "payload"."posts" CASCADE;
  DROP TABLE "payload"."posts_rels" CASCADE;
  DROP TABLE "payload"."_posts_v_version_suggested_tags" CASCADE;
  DROP TABLE "payload"."_posts_v_version_related_sak_ids" CASCADE;
  DROP TABLE "payload"."_posts_v_version_related_horing_ids" CASCADE;
  DROP TABLE "payload"."_posts_v_version_sources" CASCADE;
  DROP TABLE "payload"."_posts_v" CASCADE;
  DROP TABLE "payload"."_posts_v_rels" CASCADE;
  DROP TABLE "payload"."payload_jobs_log" CASCADE;
  DROP TABLE "payload"."payload_jobs" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TYPE "payload"."enum_users_role";
  DROP TYPE "payload"."enum_authors_kind";
  DROP TYPE "payload"."enum_posts_origin";
  DROP TYPE "payload"."enum_posts_review_state";
  DROP TYPE "payload"."enum_posts_status";
  DROP TYPE "payload"."enum__posts_v_version_origin";
  DROP TYPE "payload"."enum__posts_v_version_review_state";
  DROP TYPE "payload"."enum__posts_v_version_status";
  DROP TYPE "payload"."enum_payload_jobs_log_task_slug";
  DROP TYPE "payload"."enum_payload_jobs_log_state";
  DROP TYPE "payload"."enum_payload_jobs_task_slug";`)
}
