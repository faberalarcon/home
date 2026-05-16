-- Tidy descriptions on existing items (idempotent: by name)
UPDATE `drinks` SET `description` = 'Creamy caramel custard' WHERE `name` = 'Flan';
--> statement-breakpoint
UPDATE `drinks` SET `description` = 'Rocky Mountain lager' WHERE `name` = 'Coors Banquet';
--> statement-breakpoint
UPDATE `drinks` SET `description` = 'Cuban-style espresso, dark and sweet' WHERE `name` = 'Espresso';
--> statement-breakpoint
UPDATE `drinks` SET `description` = 'Johnnie Walker Red — blended scotch, neat or rocks' WHERE `name` = 'Red Label';
--> statement-breakpoint
UPDATE `drinks` SET `description` = 'Whiskey, Coca-Cola, splash of lime' WHERE `name` = 'Whiskey Cola';
--> statement-breakpoint
UPDATE `drinks` SET `description` = 'Glocky Tocky — handle responsibly' WHERE `name` = 'Glockenspiel';
--> statement-breakpoint

-- New food/small-bites items; INSERT only if name not already present
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Croquetas', 'Cuban ham croquettes, crispy outside', 'food', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Croquetas');
--> statement-breakpoint
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Empanadas', 'Beef or chicken, baked golden', 'food', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Empanadas');
--> statement-breakpoint
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Cheese Plate', 'Manchego, brie, blue, crackers', 'food', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Cheese Plate');
--> statement-breakpoint
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Charcuterie', 'Cured meats, olives, cornichons', 'food', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Charcuterie');
--> statement-breakpoint
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Mixed Nuts', 'Marcona almonds, cashews, pistachios', 'snack', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Mixed Nuts');
--> statement-breakpoint
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Marinated Olives', 'Castelvetrano and Kalamata, citrus and herbs', 'snack', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Marinated Olives');
--> statement-breakpoint
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Chips and Salsa', 'Tortilla chips, fresh tomato salsa', 'snack', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Chips and Salsa');
--> statement-breakpoint
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Guacamole', 'Avocado, lime, cilantro, sea salt', 'snack', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Guacamole');
--> statement-breakpoint
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Tres Leches', 'Three-milk sponge cake, lightly sweet', 'dessert', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Tres Leches');
--> statement-breakpoint
INSERT INTO `drinks` (`name`, `description`, `category`, `active`, `sort_order`)
SELECT 'Churros', 'Cinnamon sugar, chocolate dipping sauce', 'dessert', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM `drinks` WHERE `name` = 'Churros');
