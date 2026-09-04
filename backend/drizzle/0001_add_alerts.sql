CREATE TABLE IF NOT EXISTS `alert_config` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer REFERENCES users(id),
  `coin` text NOT NULL,
  `alert_type` text NOT NULL,
  `threshold` real NOT NULL,
  `enabled` integer DEFAULT true NOT NULL,
  `triggered` integer DEFAULT false NOT NULL,
  `last_triggered_at` text,
  `cooldown_minutes` integer DEFAULT 60 NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `alert_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `alert_config_id` integer NOT NULL REFERENCES alert_config(id),
  `coin` text NOT NULL,
  `alert_type` text NOT NULL,
  `threshold` real NOT NULL,
  `current_value` real NOT NULL,
  `message` text NOT NULL,
  `sent_via` text DEFAULT 'push' NOT NULL,
  `timestamp` text DEFAULT (datetime('now')) NOT NULL
);
