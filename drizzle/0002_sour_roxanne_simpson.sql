ALTER TABLE `provider_credentials` ADD `last_verified_at` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `provider_credentials` SET `last_verified_at` = `created_at` WHERE `last_verified_at` = 0;