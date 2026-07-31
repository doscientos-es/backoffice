-- Technical submission failures are not fiscal rejections. Keep them visible
-- as retryable errors so operators can fix certificates/connectivity first.
alter type public.verifactu_status add value if not exists 'error';
