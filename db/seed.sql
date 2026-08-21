-- Mock Data for remote-rupiah (April 2026)
-- Populate with US 1042-S transaction data for testing NPPN and PPh 24 logic

-- Insert a test user (if using a specific auth provider, this might be different)
-- For now, we assume a local development user ID

-- Transactions for a software developer (KLU 62010)
-- January 2026 Payment
INSERT INTO transactions (user_id, date, currency, amount_cents, withholding_cents, actual_idr_received_cents, kmk_rate, is_1042s_verified)
VALUES
('00000000-0000-0000-0000-000000000000', '2026-01-15', 'USD', 500000, 50000, 780000000, 15600.00, TRUE), -- $5000.00, $500 WHT
('00000000-0000-0000-0000-000000000000', '2026-02-15', 'USD', 550000, 55000, 863500000, 15700.00, TRUE), -- $5500.00, $550 WHT
('00000000-0000-0000-0000-000000000000', '2026-03-15', 'USD', 480000, 48000, 758400000, 15800.00, FALSE); -- $4800.00, $480 WHT (Unverified)

-- Note: amount_cents and other currency fields are BIGINT (cents).
-- actual_idr_received_cents is in IDR cents.
