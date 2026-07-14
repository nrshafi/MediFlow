CREATE TABLE `allergies` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`substance` text NOT NULL,
	`reaction` text NOT NULL,
	`severity` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "allergies_severity_valid" CHECK("allergies"."severity" in ('mild', 'moderate', 'severe'))
);
--> statement-breakpoint
CREATE INDEX `allergies_patient_idx` ON `allergies` (`patient_id`);--> statement-breakpoint
CREATE TABLE `diagnoses` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`condition` text NOT NULL,
	`year` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `diagnoses_patient_idx` ON `diagnoses` (`patient_id`);--> statement-breakpoint
CREATE TABLE `llm_outputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cache_key` text NOT NULL,
	`patient_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_hash` text NOT NULL,
	`content` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "llm_outputs_kind_valid" CHECK("llm_outputs"."kind" in ('recommendation_explanation', 'doctor_brief'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `llm_outputs_cache_key_unique` ON `llm_outputs` (`cache_key`);--> statement-breakpoint
CREATE INDEX `llm_outputs_patient_kind_idx` ON `llm_outputs` (`patient_id`,`kind`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`name` text NOT NULL,
	`dose` text NOT NULL,
	`frequency` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `medications_patient_idx` ON `medications` (`patient_id`);--> statement-breakpoint
CREATE TABLE `metric_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`simulation_minute` integer NOT NULL,
	`kind` text NOT NULL,
	`avg_wait_min` integer NOT NULL,
	`avg_visit_min` integer NOT NULL,
	`utilization_pct` integer NOT NULL,
	`patients_in_house` integer NOT NULL,
	`completed` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "metric_snapshots_kind_valid" CHECK("metric_snapshots"."kind" in ('live', 'baseline')),
	CONSTRAINT "metric_snapshots_minute_nonnegative" CHECK("metric_snapshots"."simulation_minute" >= 0),
	CONSTRAINT "metric_snapshots_wait_nonnegative" CHECK("metric_snapshots"."avg_wait_min" >= 0),
	CONSTRAINT "metric_snapshots_visit_nonnegative" CHECK("metric_snapshots"."avg_visit_min" >= 0),
	CONSTRAINT "metric_snapshots_utilization_valid" CHECK("metric_snapshots"."utilization_pct" between 0 and 100),
	CONSTRAINT "metric_snapshots_patients_in_house_nonnegative" CHECK("metric_snapshots"."patients_in_house" >= 0),
	CONSTRAINT "metric_snapshots_completed_nonnegative" CHECK("metric_snapshots"."completed" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metric_snapshots_kind_minute_unique` ON `metric_snapshots` (`kind`,`simulation_minute`);--> statement-breakpoint
CREATE TABLE `patient_timeline` (
	`patient_id` text NOT NULL,
	`position` integer NOT NULL,
	`stage` text NOT NULL,
	`started_at_minute` integer,
	`ended_at_minute` integer,
	PRIMARY KEY(`patient_id`, `position`),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "patient_timeline_position_nonnegative" CHECK("patient_timeline"."position" >= 0),
	CONSTRAINT "patient_timeline_stage_valid" CHECK("patient_timeline"."stage" in ('registration', 'lab', 'xray', 'ecg', 'consultation', 'pharmacy', 'billing', 'done')),
	CONSTRAINT "patient_timeline_order_valid" CHECK("patient_timeline"."ended_at_minute" is null or "patient_timeline"."started_at_minute" is null or "patient_timeline"."ended_at_minute" >= "patient_timeline"."started_at_minute")
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`gender` text NOT NULL,
	`arrival_minute` integer NOT NULL,
	`priority` text NOT NULL,
	`estimated_consultation_duration` integer NOT NULL,
	`current_stage` text DEFAULT 'registration' NOT NULL,
	`queue_position` integer DEFAULT 0 NOT NULL,
	`service_ends_at_minute` integer,
	`current_resource_id` text,
	`completed_at_minute` integer,
	`waited_min` integer DEFAULT 0 NOT NULL,
	`served_min` integer DEFAULT 0 NOT NULL,
	`registered` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`current_resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "patients_age_valid" CHECK("patients"."age" between 0 and 120),
	CONSTRAINT "patients_gender_valid" CHECK("patients"."gender" in ('male', 'female')),
	CONSTRAINT "patients_priority_valid" CHECK("patients"."priority" in ('normal', 'urgent')),
	CONSTRAINT "patients_current_stage_valid" CHECK("patients"."current_stage" in ('registration', 'lab', 'xray', 'ecg', 'consultation', 'pharmacy', 'billing', 'done')),
	CONSTRAINT "patients_arrival_minute_nonnegative" CHECK("patients"."arrival_minute" >= 0),
	CONSTRAINT "patients_consultation_duration_positive" CHECK("patients"."estimated_consultation_duration" > 0),
	CONSTRAINT "patients_queue_position_nonnegative" CHECK("patients"."queue_position" >= 0),
	CONSTRAINT "patients_waited_min_nonnegative" CHECK("patients"."waited_min" >= 0),
	CONSTRAINT "patients_served_min_nonnegative" CHECK("patients"."served_min" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_token_unique` ON `patients` (`token`);--> statement-breakpoint
CREATE INDEX `patients_arrival_minute_idx` ON `patients` (`arrival_minute`);--> statement-breakpoint
CREATE INDEX `patients_current_resource_idx` ON `patients` (`current_resource_id`);--> statement-breakpoint
CREATE TABLE `required_services` (
	`patient_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`doctor_id` text,
	`completed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`patient_id`, `position`),
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`doctor_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "required_services_position_nonnegative" CHECK("required_services"."position" >= 0),
	CONSTRAINT "required_services_kind_valid" CHECK("required_services"."kind" in ('consultation', 'lab', 'xray', 'ecg')),
	CONSTRAINT "required_services_doctor_consistency" CHECK(("required_services"."kind" = 'consultation' and "required_services"."doctor_id" is not null) or ("required_services"."kind" <> 'consultation' and "required_services"."doctor_id" is null))
);
--> statement-breakpoint
CREATE INDEX `required_services_doctor_idx` ON `required_services` (`doctor_id`);--> statement-breakpoint
CREATE TABLE `resource_queue` (
	`resource_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`position` integer NOT NULL,
	`enqueued_at_minute` integer NOT NULL,
	PRIMARY KEY(`resource_id`, `patient_id`),
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "resource_queue_position_positive" CHECK("resource_queue"."position" > 0),
	CONSTRAINT "resource_queue_enqueued_minute_nonnegative" CHECK("resource_queue"."enqueued_at_minute" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_queue_position_unique` ON `resource_queue` (`resource_id`,`position`);--> statement-breakpoint
CREATE INDEX `resource_queue_patient_idx` ON `resource_queue` (`patient_id`);--> statement-breakpoint
CREATE TABLE `resource_state` (
	`resource_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`current_patient_id` text,
	`predicted_wait_min` integer DEFAULT 0 NOT NULL,
	`utilization_pct` integer DEFAULT 0 NOT NULL,
	`busy_minutes` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`current_patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "resource_state_status_valid" CHECK("resource_state"."status" in ('available', 'busy', 'congested')),
	CONSTRAINT "resource_state_predicted_wait_nonnegative" CHECK("resource_state"."predicted_wait_min" >= 0),
	CONSTRAINT "resource_state_utilization_valid" CHECK("resource_state"."utilization_pct" between 0 and 100),
	CONSTRAINT "resource_state_busy_minutes_nonnegative" CHECK("resource_state"."busy_minutes" >= 0)
);
--> statement-breakpoint
CREATE INDEX `resource_state_current_patient_idx` ON `resource_state` (`current_patient_id`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`specialty` text,
	`tag` text NOT NULL,
	`service_duration_min` integer,
	CONSTRAINT "resources_type_valid" CHECK("resources"."type" in ('doctor', 'lab', 'xray', 'ecg')),
	CONSTRAINT "resources_service_duration_valid" CHECK(("resources"."type" = 'doctor' and "resources"."service_duration_min" is null) or ("resources"."type" <> 'doctor' and "resources"."service_duration_min" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resources_tag_unique` ON `resources` (`tag`);--> statement-breakpoint
CREATE TABLE `simulation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`simulation_minute` integer NOT NULL,
	`type` text NOT NULL,
	`order_in_minute` integer NOT NULL,
	`patient_id` text,
	`resource_id` text,
	`payload` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "simulation_events_type_valid" CHECK("simulation_events"."type" in ('simulation_initialized', 'clock_advanced', 'patient_arrived', 'patient_queued', 'service_started', 'service_completed', 'recommendation_created')),
	CONSTRAINT "simulation_events_minute_nonnegative" CHECK("simulation_events"."simulation_minute" >= 0),
	CONSTRAINT "simulation_events_order_nonnegative" CHECK("simulation_events"."order_in_minute" >= 0)
);
--> statement-breakpoint
CREATE INDEX `simulation_events_minute_idx` ON `simulation_events` (`simulation_minute`);--> statement-breakpoint
CREATE UNIQUE INDEX `simulation_events_minute_order_unique` ON `simulation_events` (`simulation_minute`,`order_in_minute`);--> statement-breakpoint
CREATE INDEX `simulation_events_patient_idx` ON `simulation_events` (`patient_id`);--> statement-breakpoint
CREATE INDEX `simulation_events_resource_idx` ON `simulation_events` (`resource_id`);--> statement-breakpoint
CREATE TABLE `simulation_state` (
	`id` text PRIMARY KEY NOT NULL,
	`minute` integer DEFAULT 0 NOT NULL,
	`playback_status` text DEFAULT 'paused' NOT NULL,
	`speed` integer DEFAULT 1 NOT NULL,
	`seed` integer NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "simulation_state_minute_nonnegative" CHECK("simulation_state"."minute" >= 0),
	CONSTRAINT "simulation_state_playback_status_valid" CHECK("simulation_state"."playback_status" in ('paused', 'playing')),
	CONSTRAINT "simulation_state_speed_valid" CHECK("simulation_state"."speed" in (1, 4))
);
--> statement-breakpoint
CREATE TABLE `test_results` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`test` text NOT NULL,
	`value` text NOT NULL,
	`date` text NOT NULL,
	`flag` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "test_results_flag_valid" CHECK("test_results"."flag" in ('normal', 'abnormal'))
);
--> statement-breakpoint
CREATE INDEX `test_results_patient_idx` ON `test_results` (`patient_id`);--> statement-breakpoint
CREATE TABLE `treatments` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`procedure` text NOT NULL,
	`date` text NOT NULL,
	`note` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `treatments_patient_idx` ON `treatments` (`patient_id`);