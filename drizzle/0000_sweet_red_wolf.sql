CREATE TABLE `ballot_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`ballot_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`votes` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`ballot_id`) REFERENCES `ballots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ballot_votes_ballot_idx` ON `ballot_votes` (`ballot_id`);--> statement-breakpoint
CREATE INDEX `ballot_votes_candidate_idx` ON `ballot_votes` (`candidate_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ballot_votes_unique_candidate` ON `ballot_votes` (`ballot_id`,`candidate_id`);--> statement-breakpoint
CREATE TABLE `ballots` (
	`id` text PRIMARY KEY NOT NULL,
	`election_id` text NOT NULL,
	`ballot_number` integer NOT NULL,
	`seats_available` integer NOT NULL,
	`type` text DEFAULT 'primary' NOT NULL,
	`status` text DEFAULT 'counting' NOT NULL,
	`notes` text,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finalized_at` integer,
	FOREIGN KEY (`election_id`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ballots_election_idx` ON `ballots` (`election_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ballots_unique_round` ON `ballots` (`election_id`,`ballot_number`);--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`election_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`elected_ballot_number` integer,
	`eliminated_ballot_number` integer,
	FOREIGN KEY (`election_id`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `candidates_election_idx` ON `candidates` (`election_id`);--> statement-breakpoint
CREATE INDEX `candidates_order_idx` ON `candidates` (`sort_order`);--> statement-breakpoint
CREATE TABLE `elections` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`position` text NOT NULL,
	`term` text NOT NULL,
	`seats` integer NOT NULL,
	`election_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_ballot_number` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finalized_at` integer
);
