-- Update RPCs to support Gross/Net toggle

-- 1. KPI (Issued, Collected, Outstanding, Avg Days)
CREATE OR REPLACE FUNCTION public.get_revenue_kpis(
    p_start_date DATE,
    p_end_date DATE,
    p_client_id UUID DEFAULT NULL,
    p_is_gross BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
DECLARE
    v_issued NUMERIC;
    v_collected NUMERIC;
    v_outstanding NUMERIC;
    v_avg_days NUMERIC;
    
    -- Helper to select column based on flag
    v_col TEXT; 
BEGIN
    -- We can't use dynamic SQL easily for variables, so we use CASE in queries.
    
    -- Issued: Invoice Date in range, not Cancelled
    SELECT COALESCE(SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END), 0)
    INTO v_issued
    FROM invoices
    WHERE invoice_date BETWEEN p_start_date AND p_end_date
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Collected: Payment Date in range, Status = Saldata (or has payment date)
    SELECT COALESCE(SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END), 0)
    INTO v_collected
    FROM invoices
    WHERE payment_date BETWEEN p_start_date AND p_end_date
      AND (status = 'Saldata' OR payment_date IS NOT NULL)
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Outstanding: Sum of amounts for unpaid invoices within the filtered period.
    SELECT COALESCE(SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END), 0)
    INTO v_outstanding
    FROM invoices
    WHERE invoice_date BETWEEN p_start_date AND p_end_date
      AND (status != 'Saldata' AND (payment_date IS NULL OR payment_date > p_end_date))
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Avg Days: Payment Date - Invoice Date for invoices PAID in this period
    SELECT COALESCE(AVG(payment_date - invoice_date), 0)
    INTO v_avg_days
    FROM invoices
    WHERE payment_date BETWEEN p_start_date AND p_end_date
      AND (status = 'Saldata' OR payment_date IS NOT NULL)
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    RETURN json_build_object(
        'issued', v_issued,
        'collected', v_collected,
        'outstanding', v_outstanding,
        'avg_days', ROUND(v_avg_days, 1)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Chart Data
CREATE OR REPLACE FUNCTION public.get_revenue_chart_data(
    p_start_date DATE,
    p_end_date DATE,
    p_interval TEXT DEFAULT 'month', -- 'month' or 'quarter'
    p_client_id UUID DEFAULT NULL,
    p_is_gross BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
DECLARE
    v_series JSON;
BEGIN
    IF p_interval = 'quarter' THEN
        SELECT json_agg(t) INTO v_series FROM (
            SELECT
                to_char(d, 'Q-YYYY') as label, -- Q1-2024
                date_trunc('quarter', d) as period_start,
                -- Issued in this quarter
                COALESCE((SELECT SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END) FROM invoices
                          WHERE date_trunc('quarter', invoice_date) = date_trunc('quarter', d)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as issued,
                -- Collected in this quarter
                COALESCE((SELECT SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END) FROM invoices
                          WHERE date_trunc('quarter', payment_date) = date_trunc('quarter', d)
                          AND (status = 'Saldata' OR payment_date IS NOT NULL)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as collected
            FROM generate_series(date_trunc('quarter', p_start_date), date_trunc('quarter', p_end_date), '3 months'::interval) d
        ) t;
    ELSE
        SELECT json_agg(t) INTO v_series FROM (
            SELECT
                to_char(d, 'YYYY-MM') as label,
                d as period_start,
                COALESCE((SELECT SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END) FROM invoices
                          WHERE date_trunc('month', invoice_date) = date_trunc('month', d)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as issued,
                COALESCE((SELECT SUM(CASE WHEN p_is_gross THEN amount_tax_included ELSE amount_tax_excluded END) FROM invoices
                          WHERE date_trunc('month', payment_date) = date_trunc('month', d)
                          AND (status = 'Saldata' OR payment_date IS NOT NULL)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as collected
            FROM generate_series(date_trunc('month', p_start_date), date_trunc('month', p_end_date), '1 month'::interval) d
        ) t;
    END IF;

    RETURN v_series;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Top Clients
CREATE OR REPLACE FUNCTION public.get_top_clients_revenue(
    p_start_date DATE,
    p_end_date DATE,
    p_is_gross BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(t) INTO v_result FROM (
        SELECT
            c.business_name,
            c.id as client_id,
            SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) as issued,
            SUM(CASE WHEN i.payment_date BETWEEN p_start_date AND p_end_date AND (i.status = 'Saldata' OR i.payment_date IS NOT NULL) THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) as collected,
            -- Outstanding from invoices ISSUED in this period
            SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date AND i.status != 'Saldata' THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) as outstanding
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        WHERE i.status != 'Annullata'
          AND (i.invoice_date BETWEEN p_start_date AND p_end_date OR i.payment_date BETWEEN p_start_date AND p_end_date)
        GROUP BY c.id, c.business_name
        HAVING SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) > 0
            OR SUM(CASE WHEN i.payment_date BETWEEN p_start_date AND p_end_date AND (i.status = 'Saldata' OR i.payment_date IS NOT NULL) THEN (CASE WHEN p_is_gross THEN i.amount_tax_included ELSE i.amount_tax_excluded END) ELSE 0 END) > 0
        ORDER BY issued DESC
        LIMIT 10
    ) t;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Outstanding List (Just displays amounts, maybe sort by one or other, but we return both anyway)
-- Actually, let's keep it returning all fields, but maybe we want to filter by amount > 0?
-- The list returns specific invoices, so user can see tax_excluded and included in the frontend.
-- No change needed here really, except maybe consistent signature?
-- Let's update it to accept the param for consistency if we wanted to filter by amount threshold, but current logic is fine.
-- Wait, if the user toggles "Gross", the sorting might arguably change? No, date sort.
-- But the logic doesn't aggregate.
-- Let's LEAVE THIS ONE ALONE as it returns the full object with both amounts.
