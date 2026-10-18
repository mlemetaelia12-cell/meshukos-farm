-- Add sex-specific newborn counts without dropping or rewriting existing stock history.
-- Existing born_quantity values remain available in the UI as legacy/unassigned birth counts.
ALTER TABLE daily_report_lines
  ADD COLUMN IF NOT EXISTS newborn_male_quantity integer NOT NULL DEFAULT 0 CHECK (newborn_male_quantity >= 0);

ALTER TABLE daily_report_lines
  ADD COLUMN IF NOT EXISTS newborn_female_quantity integer NOT NULL DEFAULT 0 CHECK (newborn_female_quantity >= 0);

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
