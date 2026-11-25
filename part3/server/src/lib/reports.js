// Date ranges for the report pages: O6 (organizer), A5 (admin), and
// U6 (player activity). Each takes an optional inclusive ?from=&to= range.
//
// Missing dates mean the year ending today in New York. The range is
// worked out in SQL with nyc_now(), so it follows the database clock
// (the tests freeze it). A range may be at most MAX_REPORT_YEARS long:
// the monthly charts call generate_series over it, and 0001-01-01 to
// 9999-12-31 would otherwise build about 120,000 months.
import { query } from '../db.js';
import { HttpError } from './errors.js';
import { optionalDate } from './validate.js';

export const MAX_REPORT_YEARS = 5;

export const REPORT_RANGE_SQL = `
SELECT to_char(from_date, 'YYYY-MM-DD') AS from_date,
       to_char(to_date, 'YYYY-MM-DD') AS to_date,
       from_date > to_date AS reversed,
       from_date < to_date - make_interval(years => $3::int) AS too_long
FROM (
    SELECT COALESCE($1::date, (nyc_now() - INTERVAL '1 year')::date) AS from_date,
           COALESCE($2::date, nyc_now()::date) AS to_date
) AS bounds`;

/**
 * Checks ?from= and ?to= and fills in the defaults.
 * Returns { from, to } as 'YYYY-MM-DD' strings, or throws a 400.
 */
export async function resolveReportRange(rawFrom, rawTo, { maxYears = MAX_REPORT_YEARS } = {}) {
  const from = optionalDate(rawFrom, 'From date');
  const to = optionalDate(rawTo, 'To date');
  const { rows: [range] } = await query(REPORT_RANGE_SQL, [from, to, maxYears]);
  if (range.reversed) {
    throw new HttpError(400, 'The start date must be on or before the end date.');
  }
  if (range.too_long) {
    throw new HttpError(400, `A report can cover at most ${maxYears} years. Pick a shorter date range.`);
  }
  return { from: range.from_date, to: range.to_date };
}
