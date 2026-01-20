-- Revenue Dashboard RPCs

-- 1. Helper to simplify numeric checks
CREATE OR REPLACE FUNCTION public.safe_numeric(val anyelement)
RETURNS numeric AS $$
BEGIN
    RETURN COALESCE(val::numeric, 0);
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. KPI Aggregation
CREATE OR REPLACE FUNCTION public.get_revenue_kpis(
    p_start_date DATE,
    p_end_date DATE,
    p_client_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_issued NUMERIC;
    v_collected NUMERIC;
    v_outstanding NUMERIC;
    v_avg_days NUMERIC;
BEGIN
    -- Issued: Invoice Date in range, not Cancelled
    SELECT COALESCE(SUM(amount_tax_excluded), 0)
    INTO v_issued
    FROM invoices
    WHERE invoice_date BETWEEN p_start_date AND p_end_date
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Collected: Payment Date in range, Status = Saldata (or has payment date)
    -- We assume 'Collected' means the money came in during this period, regardless of when invoice was issued.
    SELECT COALESCE(SUM(amount_tax_excluded), 0)
    INTO v_collected
    FROM invoices
    WHERE payment_date BETWEEN p_start_date AND p_end_date
      AND (status = 'Saldata' OR payment_date IS NOT NULL)
      AND status != 'Annullata'
      AND (p_client_id IS NULL OR client_id = p_client_id);

    -- Outstanding: All time (or maybe snapshot? implementation says "sum importi delle fatture NON saldate... nel perimetro dei filtri")
    -- Requirement: "Da incassare (Outstanding): somma importi delle fatture non saldate (data saldo assente e/o stato non “pagata”) nel perimetro dei filtri."
    -- "Nel perimetro dei filtri" usually implies "Issued in this period but not yet paid" OR "Currently outstanding regardless of issue date"?
    -- Common ERP logic: "Outstanding" usually refers to CURRENTLY outstanding debt.
    -- However, if I filter for 2024, do I want to see what is STILL outstanding from 2024? Yes.
    SELECT COALESCE(SUM(amount_tax_excluded), 0)
    INTO v_outstanding
    FROM invoices
    WHERE invoice_date BETWEEN p_start_date AND p_end_date
      AND (status != 'Saldata' AND (payment_date IS NULL OR payment_date > p_end_date)) -- If paid AFTER the period, it was outstanding AT END of period? Or just simplistic "Is currently unpaid from that period"?
      -- UX Requirement: "Quanto mi manca da incassare". This usually implies "What is left to collect from the invoices issued in this period".
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

-- 3. Chart Data (Time Series)
CREATE OR REPLACE FUNCTION public.get_revenue_chart_data(
    p_start_date DATE,
    p_end_date DATE,
    p_interval TEXT DEFAULT 'month', -- 'month' or 'quarter'
    p_client_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_series JSON;
BEGIN
    -- We generate a series of dates for the axis, then join with data
    -- This handles gaps (months with 0 revenue)
    IF p_interval = 'quarter' THEN
        SELECT json_agg(t) INTO v_series FROM (
            SELECT
                to_char(d, 'Q-YYYY') as label, -- Q1-2024
                date_trunc('quarter', d) as period_start,
                -- Issued in this quarter
                COALESCE((SELECT SUM(amount_tax_excluded) FROM invoices 
                          WHERE date_trunc('quarter', invoice_date) = date_trunc('quarter', d)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as issued,
                -- Collected in this quarter
                COALESCE((SELECT SUM(amount_tax_excluded) FROM invoices 
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
                COALESCE((SELECT SUM(amount_tax_excluded) FROM invoices 
                          WHERE date_trunc('month', invoice_date) = date_trunc('month', d)
                          AND status != 'Annullata'
                          AND (p_client_id IS NULL OR client_id = p_client_id)), 0) as issued,
                COALESCE((SELECT SUM(amount_tax_excluded) FROM invoices 
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

-- 4. Top Clients
CREATE OR REPLACE FUNCTION public.get_top_clients_revenue(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(t) INTO v_result FROM (
        SELECT 
            c.business_name,
            c.id as client_id,
            SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date THEN i.amount_tax_excluded ELSE 0 END) as issued,
            SUM(CASE WHEN i.payment_date BETWEEN p_start_date AND p_end_date AND (i.status = 'Saldata' OR i.payment_date IS NOT NULL) THEN i.amount_tax_excluded ELSE 0 END) as collected,
            -- Outstanding from invoices ISSUED in this period
            SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date AND i.status != 'Saldata' THEN i.amount_tax_excluded ELSE 0 END) as outstanding
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        WHERE i.status != 'Annullata'
          AND (i.invoice_date BETWEEN p_start_date AND p_end_date OR i.payment_date BETWEEN p_start_date AND p_end_date)
        GROUP BY c.id, c.business_name
        HAVING SUM(CASE WHEN i.invoice_date BETWEEN p_start_date AND p_end_date THEN i.amount_tax_excluded ELSE 0 END) > 0 
            OR SUM(CASE WHEN i.payment_date BETWEEN p_start_date AND p_end_date AND (i.status = 'Saldata' OR i.payment_date IS NOT NULL) THEN i.amount_tax_excluded ELSE 0 END) > 0
        ORDER BY issued DESC
        LIMIT 10
    ) t;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Outstanding List (Paginated)
CREATE OR REPLACE FUNCTION public.get_outstanding_invoices_list(
    p_client_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(t) INTO v_result FROM (
        SELECT 
            i.id,
            i.invoice_number,
            i.invoice_date,
            i.amount_tax_excluded,
            i.amount_tax_included,
            i.title,
            c.business_name as client_name,
            CURRENT_DATE - i.invoice_date as days_open
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.status != 'Saldata' 
          AND i.status != 'Annullata'
          AND (i.payment_date IS NULL) -- Truly unpaid
          AND (p_client_id IS NULL OR i.client_id = p_client_id)
        ORDER BY i.invoice_date ASC -- Oldest first
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;
