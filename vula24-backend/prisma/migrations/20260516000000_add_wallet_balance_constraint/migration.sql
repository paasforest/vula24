-- Enforce non-negative wallet balance at the database layer.
ALTER TABLE "Wallet"
ADD CONSTRAINT "wallet_balance_non_negative"
CHECK ("balance" >= 0);
