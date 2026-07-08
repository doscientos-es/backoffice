-- ============================================================
-- Revert settings company address to a single freeform text column.
-- The five structured columns (street, zip, city, province, country)
-- are replaced by a single `company_address` text field.
--
-- Existing structured data is composed into the new field using the
-- same multi-line format that formatAddress() would produce.
-- ============================================================

alter table public.settings
  add column if not exists company_address text;

-- Compose structured parts → single text (mirrors lib/address.ts formatAddress)
update public.settings
  set company_address = trim(
    concat_ws(
      E'\n',
      nullif(trim(coalesce(company_address_street, '')), ''),
      nullif(
        trim(
          concat_ws(' ',
            nullif(trim(coalesce(company_address_zip, '')), ''),
            nullif(trim(coalesce(company_address_city, '')), '')
          )
        ),
        ''
      ),
      nullif(trim(coalesce(company_address_province, '')), ''),
      case
        when upper(trim(coalesce(company_address_country, 'ES'))) <> 'ES'
          then upper(trim(company_address_country))
        else null
      end
    )
  )
  where
    company_address_street   is not null or
    company_address_zip      is not null or
    company_address_city     is not null or
    company_address_province is not null;

alter table public.settings
  drop column if exists company_address_street,
  drop column if exists company_address_zip,
  drop column if exists company_address_city,
  drop column if exists company_address_province,
  drop column if exists company_address_country;
