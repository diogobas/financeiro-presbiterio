-- SQL Performance Testing Scripts
-- Place queries that should be monitored for performance regressions here

-- Q1: Account lookups - Should use index
SELECT * FROM accounts WHERE active = true LIMIT 10;

-- Q2: Recent import batches - Should use created_at index
SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 100;

-- Q3: Transactions with classifier joins - Multi-table join
SELECT t.*, c.name 
FROM transactions t 
LEFT JOIN classifiers c ON t.classifier_id = c.id 
WHERE t.created_at >= NOW() - INTERVAL '30 days' 
LIMIT 100;

-- Q4: Monthly aggregation - GROUP BY query
SELECT account_id, SUM(amount) as total 
FROM transactions 
WHERE created_at >= NOW() - INTERVAL '1 month' 
GROUP BY account_id;

-- Q5: Active overrides - Filter and sort
SELECT * FROM overrides 
WHERE is_active = true 
ORDER BY created_at DESC 
LIMIT 50;
