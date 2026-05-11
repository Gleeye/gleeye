
    -- Fix orders that were incorrectly defaulted to 'saldo'
    UPDATE public.orders 
    SET payment_mode = NULL,
        deposit_percentage = 0,
        balance_percentage = 0,
        installments_count = 0
    WHERE order_number IN ('23-0075', '23-0076', '24-CVS', '24-0005', '24-0020', '24-0022', '24-0023', '24-0024', '24-0025', '24-0006', '24-0031', '24-0032', '24-0021', '25-0005', '25-0006', '25-0009', '25-0012', '25-0014', '25-0016', '25-0017', '25-0018', '25-0019', '25-0020', '25-0021', '25-0023', '25-0024', '25-0027', '25-0028');
    