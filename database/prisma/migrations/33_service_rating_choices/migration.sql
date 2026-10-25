ALTER TABLE "customer_messages"
  DROP CONSTRAINT "customer_messages_options_check",
  DROP CONSTRAINT "customer_messages_purpose_check";
ALTER TABLE "customer_messages"
  ADD CONSTRAINT "customer_messages_purpose_check" CHECK ("purpose" IN ('QUOTE', 'SCHEDULE', 'PICKUP', 'CUSTOM', 'RATING')),
  ADD CONSTRAINT "customer_messages_options_check" CHECK (
    ("purpose" = 'RATING' AND cardinality("options") = 5) OR
    ("purpose" <> 'RATING' AND cardinality("options") BETWEEN 2 AND 3)
  );
