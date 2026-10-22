-- Correct only the newly introduced default paid-pin plans; existing currencies and wallets stay intact.
UPDATE shop_items SET currency_code='credits' WHERE type='topic_pin' AND currency_code='gold';
