-- MESHUKO'S S AND G FARM — PostgreSQL schema
-- Run with: npm run db:migrate (requires DATABASE_URL in .env)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS farms (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-4000-8000-000000000001',
  name text NOT NULL UNIQUE,
  timezone text NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO farms (id, name, timezone)
VALUES ('00000000-0000-4000-8000-000000000001', 'MESHUKO''S S AND G FARM', 'Africa/Dar_es_Salaam')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT 'Farm Owner',
  role text NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER','ADMIN')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farm_id, email)
);

CREATE TABLE IF NOT EXISTS animal_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('SHEEP','GOAT')),
  breed text NOT NULL,
  sex text NOT NULL CHECK (sex IN ('MALE','FEMALE','MIXED')),
  category text NOT NULL,
  group_name text NOT NULL DEFAULT 'MAIN HERD',
  tip_tag text NOT NULL DEFAULT '',
  tag_colour text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS animal_groups_farm_active_idx ON animal_groups(farm_id, active);
CREATE INDEX IF NOT EXISTS animal_groups_filters_idx ON animal_groups(farm_id, type, breed, sex, category);

CREATE TABLE IF NOT EXISTS daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','FINALIZED','VOIDED')),
  created_by text NOT NULL,
  finalized_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  UNIQUE (farm_id, report_date)
);
CREATE INDEX IF NOT EXISTS daily_reports_date_idx ON daily_reports(farm_id, report_date DESC);

CREATE TABLE IF NOT EXISTS daily_report_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  animal_group_id uuid NOT NULL REFERENCES animal_groups(id) ON DELETE RESTRICT,
  opening_quantity integer NOT NULL DEFAULT 0 CHECK (opening_quantity >= 0),
  born_quantity integer NOT NULL DEFAULT 0 CHECK (born_quantity >= 0), -- legacy unsplit births; preserved for existing records
  newborn_male_quantity integer NOT NULL DEFAULT 0 CHECK (newborn_male_quantity >= 0),
  newborn_female_quantity integer NOT NULL DEFAULT 0 CHECK (newborn_female_quantity >= 0),
  new_stock_quantity integer NOT NULL DEFAULT 0 CHECK (new_stock_quantity >= 0),
  transfer_in_quantity integer NOT NULL DEFAULT 0 CHECK (transfer_in_quantity >= 0),
  transfer_out_quantity integer NOT NULL DEFAULT 0 CHECK (transfer_out_quantity >= 0),
  lost_quantity integer NOT NULL DEFAULT 0 CHECK (lost_quantity >= 0),
  mortality_quantity integer NOT NULL DEFAULT 0 CHECK (mortality_quantity >= 0),
  sold_quantity integer NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  slaughter_quantity integer NOT NULL DEFAULT 0 CHECK (slaughter_quantity >= 0),
  closing_quantity integer NOT NULL DEFAULT 0 CHECK (closing_quantity >= 0),
  sick_quantity integer NOT NULL DEFAULT 0 CHECK (sick_quantity >= 0),
  snapshot_at timestamptz,
  UNIQUE (report_id, animal_group_id)
);
-- Also upgrade an existing installation before compiling functions that reference these fields.
ALTER TABLE daily_report_lines
  ADD COLUMN IF NOT EXISTS newborn_male_quantity integer NOT NULL DEFAULT 0 CHECK (newborn_male_quantity >= 0);
ALTER TABLE daily_report_lines
  ADD COLUMN IF NOT EXISTS newborn_female_quantity integer NOT NULL DEFAULT 0 CHECK (newborn_female_quantity >= 0);
CREATE INDEX IF NOT EXISTS report_lines_group_idx ON daily_report_lines(animal_group_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  animal_group_id uuid NOT NULL REFERENCES animal_groups(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN (
    'OPENING','BIRTH','NEW_STOCK','TRANSFER_IN','TRANSFER_OUT',
    'LOST','MORTALITY','SOLD','SLAUGHTER','ADJUSTMENT_IN','ADJUSTMENT_OUT'
  )),
  quantity integer NOT NULL CHECK (quantity > 0),
  effective_date date NOT NULL,
  transfer_id uuid,
  report_id uuid REFERENCES daily_reports(id) ON DELETE RESTRICT,
  external_party text,
  reference text,
  notes text,
  idempotency_key text UNIQUE,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversal_of uuid REFERENCES stock_movements(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS stock_movements_group_date_idx ON stock_movements(animal_group_id, effective_date);
CREATE INDEX IF NOT EXISTS stock_movements_farm_date_idx ON stock_movements(farm_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS stock_movements_transfer_idx ON stock_movements(transfer_id);

CREATE TABLE IF NOT EXISTS daily_report_movements (
  report_id uuid NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  movement_id uuid NOT NULL UNIQUE REFERENCES stock_movements(id) ON DELETE RESTRICT,
  PRIMARY KEY (report_id, movement_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  actor_email text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(farm_id, created_at DESC);

-- Keep transfers atomic: internal transfers always create balanced OUT + IN rows.
CREATE OR REPLACE FUNCTION record_farm_transfer(
  p_mode text,
  p_source_group_id uuid,
  p_destination_group_id uuid,
  p_quantity integer,
  p_effective_date date,
  p_external_party text,
  p_notes text,
  p_created_by text,
  p_idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_farm_id uuid := '00000000-0000-4000-8000-000000000001';
  v_transfer_id uuid := gen_random_uuid();
  v_source animal_groups%ROWTYPE;
  v_destination animal_groups%ROWTYPE;
  v_balance bigint;
  v_existing uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be a positive whole number.'; END IF;
  IF p_effective_date IS NULL OR p_effective_date > (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date THEN RAISE EXCEPTION 'Transfer date cannot be in the future.'; END IF;
  IF p_mode NOT IN ('INTERNAL','EXTERNAL_IN','EXTERNAL_OUT') THEN RAISE EXCEPTION 'Invalid transfer mode.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT transfer_id INTO v_existing FROM stock_movements
     WHERE idempotency_key IN (p_idempotency_key || ':OUT', p_idempotency_key || ':IN') LIMIT 1;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  -- Lock affected groups in a stable order before checking report state / balances.
  -- Finalization locks the same group rows, preventing same-date transfer/finalize races.
  IF p_mode = 'INTERNAL' THEN
    PERFORM 1 FROM animal_groups WHERE id IN (p_source_group_id,p_destination_group_id) AND farm_id=v_farm_id ORDER BY id FOR UPDATE;
  ELSIF p_mode = 'EXTERNAL_OUT' THEN
    PERFORM 1 FROM animal_groups WHERE id=p_source_group_id AND farm_id=v_farm_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM animal_groups WHERE id=p_destination_group_id AND farm_id=v_farm_id FOR UPDATE;
  END IF;

  IF EXISTS (SELECT 1 FROM daily_reports WHERE farm_id = v_farm_id AND report_date = p_effective_date AND status = 'FINALIZED') THEN
    RAISE EXCEPTION 'This date already has a finalized report. Record a correction with a new authorized adjustment instead.';
  END IF;
  IF EXISTS (SELECT 1 FROM daily_reports WHERE farm_id = v_farm_id AND status = 'FINALIZED' AND report_date > p_effective_date) THEN
    RAISE EXCEPTION 'Backdated transfer is blocked because a later report has already been finalized.';
  END IF;

  IF p_mode IN ('INTERNAL','EXTERNAL_OUT') THEN
    SELECT * INTO v_source FROM animal_groups WHERE id = p_source_group_id AND farm_id = v_farm_id AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Select a valid active source group.'; END IF;
    SELECT COALESCE(SUM(CASE
      WHEN movement_type IN ('OPENING','BIRTH','NEW_STOCK','TRANSFER_IN','ADJUSTMENT_IN') THEN quantity
      ELSE -quantity END), 0)
      INTO v_balance FROM stock_movements
      WHERE animal_group_id = p_source_group_id AND effective_date <= p_effective_date;
    IF v_balance < p_quantity THEN RAISE EXCEPTION 'Not enough stock in the selected source group. Available: %.', GREATEST(v_balance,0); END IF;
  END IF;

  IF p_mode IN ('INTERNAL','EXTERNAL_IN') THEN
    SELECT * INTO v_destination FROM animal_groups WHERE id = p_destination_group_id AND farm_id = v_farm_id AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Select a valid active destination group.'; END IF;
  END IF;

  IF p_mode = 'INTERNAL' THEN
    IF p_source_group_id = p_destination_group_id THEN RAISE EXCEPTION 'Source and destination groups must be different.'; END IF;
    IF v_source.type <> v_destination.type THEN RAISE EXCEPTION 'Transfers between sheep and goat groups are not allowed.'; END IF;
    INSERT INTO stock_movements(farm_id, animal_group_id, movement_type, quantity, effective_date, transfer_id, notes, idempotency_key, created_by)
    VALUES (v_farm_id, p_source_group_id, 'TRANSFER_OUT', p_quantity, p_effective_date, v_transfer_id, p_notes, p_idempotency_key || ':OUT', p_created_by);
    INSERT INTO stock_movements(farm_id, animal_group_id, movement_type, quantity, effective_date, transfer_id, notes, idempotency_key, created_by)
    VALUES (v_farm_id, p_destination_group_id, 'TRANSFER_IN', p_quantity, p_effective_date, v_transfer_id, p_notes, p_idempotency_key || ':IN', p_created_by);
  ELSIF p_mode = 'EXTERNAL_OUT' THEN
    IF COALESCE(trim(p_external_party),'') = '' THEN RAISE EXCEPTION 'Enter the receiving farm or destination.'; END IF;
    INSERT INTO stock_movements(farm_id, animal_group_id, movement_type, quantity, effective_date, transfer_id, external_party, notes, idempotency_key, created_by)
    VALUES (v_farm_id, p_source_group_id, 'TRANSFER_OUT', p_quantity, p_effective_date, v_transfer_id, p_external_party, p_notes, p_idempotency_key || ':OUT', p_created_by);
  ELSE
    IF COALESCE(trim(p_external_party),'') = '' THEN RAISE EXCEPTION 'Enter the sending farm or source.'; END IF;
    INSERT INTO stock_movements(farm_id, animal_group_id, movement_type, quantity, effective_date, transfer_id, external_party, notes, idempotency_key, created_by)
    VALUES (v_farm_id, p_destination_group_id, 'TRANSFER_IN', p_quantity, p_effective_date, v_transfer_id, p_external_party, p_notes, p_idempotency_key || ':IN', p_created_by);
  END IF;

  INSERT INTO audit_logs(farm_id, actor_email, action, entity_type, entity_id, after_data)
  VALUES (v_farm_id, p_created_by, 'CREATE_TRANSFER', 'stock_transfer', v_transfer_id::text,
    jsonb_build_object('mode',p_mode,'quantity',p_quantity,'effective_date',p_effective_date,'external_party',p_external_party));
  RETURN v_transfer_id;
END;
$$;

-- Finalization is a single PostgreSQL function call so the ledger and daily snapshot commit atomically.
CREATE OR REPLACE FUNCTION finalize_daily_report(p_report_id uuid, p_finalized_by text)
RETURNS TABLE(result_report_id uuid, result_report_date date, total_closing bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_report daily_reports%ROWTYPE;
  v_line daily_report_lines%ROWTYPE;
  v_opening bigint;
  v_transfer_in bigint;
  v_transfer_out bigint;
  v_closing bigint;
  v_type text;
  v_qty integer;
  v_total bigint := 0;
  v_farm_id uuid := '00000000-0000-4000-8000-000000000001';
BEGIN
  SELECT * INTO v_report FROM daily_reports WHERE id = p_report_id AND farm_id = v_farm_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Daily report not found.'; END IF;
  IF v_report.status <> 'DRAFT' THEN RAISE EXCEPTION 'Only draft reports can be finalized.'; END IF;
  IF v_report.report_date > (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date THEN RAISE EXCEPTION 'Report date cannot be in the future.'; END IF;
  IF EXISTS (SELECT 1 FROM daily_reports WHERE farm_id = v_farm_id AND status = 'FINALIZED' AND report_date > v_report.report_date) THEN
    RAISE EXCEPTION 'Cannot finalize a backdated report after a later report has been finalized. Use the correction workflow.';
  END IF;

  INSERT INTO daily_report_lines(report_id, animal_group_id)
  SELECT v_report.id, g.id FROM animal_groups g
  WHERE g.farm_id = v_farm_id AND g.active AND g.created_at::date <= v_report.report_date
  ON CONFLICT (report_id, animal_group_id) DO NOTHING;

  -- Lock affected groups in UUID order. Transfer writes take these same locks before checking
  -- report status, so a transfer cannot slip into a report while it is being finalized.
  PERFORM 1 FROM animal_groups g JOIN daily_report_lines l ON l.animal_group_id=g.id
    WHERE l.report_id=v_report.id ORDER BY g.id FOR UPDATE OF g;

  -- Derive starting balances and same-day transfers from the movement ledger.
  FOR v_line IN SELECT * FROM daily_report_lines WHERE daily_report_lines.report_id = v_report.id FOR UPDATE LOOP
    SELECT COALESCE(SUM(CASE
      WHEN movement_type IN ('OPENING','BIRTH','NEW_STOCK','TRANSFER_IN','ADJUSTMENT_IN') THEN quantity
      ELSE -quantity END),0)
      INTO v_opening FROM stock_movements
      WHERE animal_group_id = v_line.animal_group_id
        AND (effective_date < v_report.report_date OR (effective_date = v_report.report_date AND movement_type = 'OPENING'));

    SELECT COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'TRANSFER_IN'),0),
           COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'TRANSFER_OUT'),0)
      INTO v_transfer_in, v_transfer_out
      FROM stock_movements WHERE animal_group_id = v_line.animal_group_id AND effective_date = v_report.report_date;

    IF v_line.newborn_male_quantity > 0 AND NOT EXISTS (
      SELECT 1 FROM animal_groups g WHERE g.id=v_line.animal_group_id AND g.sex='MALE'
        AND regexp_replace(upper(trim(g.category)), '[^A-Z]', '', 'g') IN ('NEWBORN','NEWBORNS')
    ) THEN
      RAISE EXCEPTION 'Newborn Male quantity can only be entered on a MALE / NEWBORN group. Check group %, breed and category.', v_line.animal_group_id;
    END IF;
    IF v_line.newborn_female_quantity > 0 AND NOT EXISTS (
      SELECT 1 FROM animal_groups g WHERE g.id=v_line.animal_group_id AND g.sex='FEMALE'
        AND regexp_replace(upper(trim(g.category)), '[^A-Z]', '', 'g') IN ('NEWBORN','NEWBORNS')
    ) THEN
      RAISE EXCEPTION 'Newborn Female quantity can only be entered on a FEMALE / NEWBORN group. Check group %, breed and category.', v_line.animal_group_id;
    END IF;

    v_closing := v_opening + v_line.born_quantity + v_line.newborn_male_quantity + v_line.newborn_female_quantity
      + v_line.new_stock_quantity + v_transfer_in
      - v_transfer_out - v_line.lost_quantity - v_line.mortality_quantity - v_line.sold_quantity - v_line.slaughter_quantity;
    IF v_closing < 0 THEN
      RAISE EXCEPTION 'Insufficient stock for group %. Closing stock would be %.', v_line.animal_group_id, v_closing;
    END IF;
    IF v_line.sick_quantity > v_closing THEN
      RAISE EXCEPTION 'Sick quantity cannot exceed closing stock for group %.', v_line.animal_group_id;
    END IF;
    UPDATE daily_report_lines SET opening_quantity=v_opening, transfer_in_quantity=v_transfer_in,
      transfer_out_quantity=v_transfer_out, closing_quantity=v_closing, snapshot_at=now()
      WHERE id=v_line.id;
  END LOOP;

  -- Create the report's stock-affecting movements once, with stable idempotency keys.
  FOR v_line IN SELECT * FROM daily_report_lines WHERE daily_report_lines.report_id = v_report.id LOOP
    FOREACH v_type IN ARRAY ARRAY['BIRTH','NEW_STOCK','LOST','MORTALITY','SOLD','SLAUGHTER'] LOOP
      v_qty := CASE v_type
        WHEN 'BIRTH' THEN v_line.born_quantity + v_line.newborn_male_quantity + v_line.newborn_female_quantity
        WHEN 'NEW_STOCK' THEN v_line.new_stock_quantity
        WHEN 'LOST' THEN v_line.lost_quantity
        WHEN 'MORTALITY' THEN v_line.mortality_quantity
        WHEN 'SOLD' THEN v_line.sold_quantity
        WHEN 'SLAUGHTER' THEN v_line.slaughter_quantity
        ELSE 0 END;
      IF v_qty > 0 THEN
        INSERT INTO stock_movements(farm_id, animal_group_id, movement_type, quantity, effective_date, report_id, idempotency_key, created_by)
        VALUES(v_farm_id, v_line.animal_group_id, v_type, v_qty, v_report.report_date, v_report.id,
          'report:'||v_report.id::text||':'||v_line.animal_group_id::text||':'||v_type, v_report.created_by)
        ON CONFLICT (idempotency_key) DO NOTHING;
        INSERT INTO daily_report_movements(report_id, movement_id)
        SELECT v_report.id, id FROM stock_movements
        WHERE idempotency_key='report:'||v_report.id::text||':'||v_line.animal_group_id::text||':'||v_type
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;

  -- Reconcile the stock ledger by day: every cumulative day-end balance must remain non-negative.
  IF EXISTS (
    WITH daily AS (
      SELECT animal_group_id, effective_date,
        SUM(CASE WHEN movement_type IN ('OPENING','BIRTH','NEW_STOCK','TRANSFER_IN','ADJUSTMENT_IN') THEN quantity ELSE -quantity END) AS net
      FROM stock_movements WHERE farm_id=v_farm_id AND effective_date <= v_report.report_date
      GROUP BY animal_group_id,effective_date
    ), balances AS (
      SELECT animal_group_id,effective_date,
        SUM(net) OVER (PARTITION BY animal_group_id ORDER BY effective_date ROWS UNBOUNDED PRECEDING) AS balance
      FROM daily
    ) SELECT 1 FROM balances WHERE balance < 0 LIMIT 1
  ) THEN RAISE EXCEPTION 'This report would make stock negative on one or more dates. Review older movements before finalizing.'; END IF;

  SELECT COALESCE(SUM(closing_quantity),0) INTO v_total FROM daily_report_lines WHERE daily_report_lines.report_id=v_report.id;
  UPDATE daily_reports SET status='FINALIZED', finalized_by=p_finalized_by, finalized_at=now() WHERE id=v_report.id;
  INSERT INTO audit_logs(farm_id, actor_email, action, entity_type, entity_id, after_data)
  VALUES(v_farm_id,p_finalized_by,'FINALIZE_REPORT','daily_report',v_report.id::text,jsonb_build_object('date',v_report.report_date,'total_closing',v_total));

  RETURN QUERY SELECT v_report.id, v_report.report_date, v_total;
END;
$$;
