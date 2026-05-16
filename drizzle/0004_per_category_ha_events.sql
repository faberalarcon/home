-- 1. Reassign Glockenspiel firearm -> novelty (idempotent: only fires while still firearm)
UPDATE `drinks` SET `category` = 'novelty' WHERE `name` = 'Glockenspiel' AND `category` = 'firearm';
--> statement-breakpoint

-- 2. Insert Big Bertha novelty item if not present
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Big Bertha', 'Long, smooth, batteries not included', 'novelty', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Big Bertha');
--> statement-breakpoint

-- 3. Repopulate ha_trigger_event for every row by category
UPDATE `drinks` SET `ha_trigger_event` = 'drink_ordered'
  WHERE `category` IN ('cocktail','beer','wine','spirit','liquor','coffee','non-alcoholic');
--> statement-breakpoint
UPDATE `drinks` SET `ha_trigger_event` = 'food_ordered'    WHERE `category` = 'food';
--> statement-breakpoint
UPDATE `drinks` SET `ha_trigger_event` = 'snack_ordered'   WHERE `category` = 'snack';
--> statement-breakpoint
UPDATE `drinks` SET `ha_trigger_event` = 'dessert_ordered' WHERE `category` = 'dessert';
--> statement-breakpoint
UPDATE `drinks` SET `ha_trigger_event` = 'novelty_ordered' WHERE `category` = 'novelty';
--> statement-breakpoint
UPDATE `drinks` SET `ha_trigger_event` = 'misc_ordered'
  WHERE `category` NOT IN ('cocktail','beer','wine','spirit','liquor','coffee','non-alcoholic','food','snack','dessert','novelty');
