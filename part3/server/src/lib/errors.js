// Turning errors into the JSON message the React app shows the user.

/**
 * An error we expect and want to show the user as-is, e.g.
 *   throw new HttpError(409, 'This game is full.');
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Friendly messages for the database constraints a user can trip over.
// Anything not listed falls back to a generic message per error code.
const CONSTRAINT_MESSAGES = {
  uq_users_email: 'An account with this email already exists.',
  chk_users_email: 'Please enter a valid email address.',
  excl_reservation_no_overlap: 'That field already has an approved game at an overlapping time.',
  chk_reservation_future: 'A game must be booked before it starts.',
  chk_reservation_length: 'A game slot must last between 1 and 3 hours.',
  chk_reservation_same_day: 'A game must start and end on the same day.',
  chk_reservation_order: 'The end time must be after the start time.',
  chk_game_max_players: 'Max players must fit two full teams for the format, and be at most 30.',
  chk_closure_order: 'The closure must end after it starts.',
  chk_hours_order: 'Closing time must be after opening time.',
  chk_rating_range: 'A rating must be between 1 and 5 stars.',
  chk_rating_eligible: 'You can only rate games you played that have finished.',
};

// PostgreSQL error codes: https://www.postgresql.org/docs/17/errcodes-appendix.html
const CODE_MESSAGES = {
  '23505': [409, 'That record already exists.'],              // unique_violation
  '23P01': [409, 'That conflicts with an existing booking.'], // exclusion_violation
  '23514': [400, 'Some of the values are not allowed.'],      // check_violation
  '23503': [400, 'That refers to something that does not exist.'], // foreign_key_violation
  '23502': [400, 'A required value is missing.'],             // not_null_violation
  '22001': [400, 'One of the values is too long.'],           // string_data_right_truncation
  '22007': [400, 'Invalid date or time.'],                    // invalid_datetime_format
  '22008': [400, 'Invalid date or time.'],                    // datetime_field_overflow
  '22P02': [400, 'Invalid number or value.'],                 // invalid_text_representation
  '22021': [400, 'Some text contains characters that are not allowed.'], // character_not_in_repertoire
};

/** Map any thrown error to { status, message } for the response. */
export function toHttpError(err) {
  if (err instanceof HttpError) return { status: err.status, message: err.message };
  if (err?.code && CODE_MESSAGES[err.code]) {
    const [status, fallback] = CODE_MESSAGES[err.code];
    return { status, message: CONSTRAINT_MESSAGES[err.constraint] ?? fallback };
  }
  // Errors from express.json(): bad JSON, body too large, wrong charset...
  // They carry their own 4xx status and are safe to report.
  if (err?.expose && err.status >= 400 && err.status < 500) {
    const message = err.type === 'entity.too.large' ? 'The request is too large.' : 'Invalid request body.';
    return { status: err.status, message };
  }
  return { status: 500, message: 'Something went wrong on our side. Please try again.' };
}
