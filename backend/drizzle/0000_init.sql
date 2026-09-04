CREATE TABLE `bot_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coin` text NOT NULL,
	`status` text DEFAULT 'LÍQUIDO' NOT NULL,
	`entry_price` real DEFAULT 0 NOT NULL,
	`entry_time` text,
	`tp_target` real DEFAULT 0 NOT NULL,
	`piso_actual` real DEFAULT 0 NOT NULL,
	`streak_losses` integer DEFAULT 0 NOT NULL,
	`monto_entrada` real DEFAULT 0 NOT NULL,
	`last_sell_time` text,
	`last_sell_reason` text,
	`last_sell_price` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT '2026-08-27T22:53:50.925Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bot_state_coin_unique` ON `bot_state` (`coin`);--> statement-breakpoint
CREATE TABLE `execution_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coin` text NOT NULL,
	`status` text NOT NULL,
	`decision` text,
	`motivo` text,
	`monto` real,
	`entry_price` real,
	`error` text,
	`score` real,
	`rsi` real,
	`adx` real,
	`timestamp` text DEFAULT '2026-08-27T22:53:50.927Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coin` text NOT NULL,
	`decision` text NOT NULL,
	`motivo` text,
	`monto` real DEFAULT 0 NOT NULL,
	`precio` real DEFAULT 0 NOT NULL,
	`rsi` real,
	`adx` real,
	`direction` text,
	`entry_price` real,
	`entry_time` text,
	`pnl` text,
	`timestamp` text DEFAULT '2026-08-27T22:53:50.927Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`coin` text NOT NULL,
	`risk_pct` real,
	`entry_min` real,
	`entry_max` real,
	`custom_settings` text,
	`created_at` text DEFAULT '2026-08-27T22:53:50.927Z' NOT NULL,
	`updated_at` text DEFAULT '2026-08-27T22:53:50.927Z' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`api_key_encrypted` text,
	`api_secret_encrypted` text,
	`created_at` text DEFAULT '2026-08-27T22:53:50.927Z' NOT NULL,
	`updated_at` text DEFAULT '2026-08-27T22:53:50.927Z' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);