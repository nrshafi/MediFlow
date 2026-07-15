PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_metric_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`simulation_minute` integer NOT NULL,
	`kind` text NOT NULL,
	`avg_wait_min` integer NOT NULL,
	`avg_visit_min` integer NOT NULL,
	`utilization_pct` integer NOT NULL,
	`avg_queue_depth` integer DEFAULT 0 NOT NULL,
	`peak_queue_depth` integer DEFAULT 0 NOT NULL,
	`patients_in_house` integer NOT NULL,
	`completed` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "metric_snapshots_kind_valid" CHECK("__new_metric_snapshots"."kind" in ('live', 'baseline')),
	CONSTRAINT "metric_snapshots_minute_nonnegative" CHECK("__new_metric_snapshots"."simulation_minute" >= 0),
	CONSTRAINT "metric_snapshots_wait_nonnegative" CHECK("__new_metric_snapshots"."avg_wait_min" >= 0),
	CONSTRAINT "metric_snapshots_visit_nonnegative" CHECK("__new_metric_snapshots"."avg_visit_min" >= 0),
	CONSTRAINT "metric_snapshots_utilization_valid" CHECK("__new_metric_snapshots"."utilization_pct" between 0 and 100),
	CONSTRAINT "metric_snapshots_avg_queue_depth_nonnegative" CHECK("__new_metric_snapshots"."avg_queue_depth" >= 0),
	CONSTRAINT "metric_snapshots_peak_queue_depth_nonnegative" CHECK("__new_metric_snapshots"."peak_queue_depth" >= 0),
	CONSTRAINT "metric_snapshots_patients_in_house_nonnegative" CHECK("__new_metric_snapshots"."patients_in_house" >= 0),
	CONSTRAINT "metric_snapshots_completed_nonnegative" CHECK("__new_metric_snapshots"."completed" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_metric_snapshots`("id", "simulation_minute", "kind", "avg_wait_min", "avg_visit_min", "utilization_pct", "avg_queue_depth", "peak_queue_depth", "patients_in_house", "completed", "created_at") SELECT "id", "simulation_minute", "kind", "avg_wait_min", "avg_visit_min", "utilization_pct", 0, 0, "patients_in_house", "completed", "created_at" FROM `metric_snapshots`;--> statement-breakpoint
DROP TABLE `metric_snapshots`;--> statement-breakpoint
ALTER TABLE `__new_metric_snapshots` RENAME TO `metric_snapshots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `metric_snapshots_kind_minute_unique` ON `metric_snapshots` (`kind`,`simulation_minute`);
