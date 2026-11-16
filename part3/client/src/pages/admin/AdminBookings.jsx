// /admin/bookings  A1. Pending field bookings (spec: staff approval flow).
// Each booking shows the checks from Part 2 Q2 in words: an approved game
// in the way, a closure, or a time outside opening hours. Approve or
// reject (with a reason); then, as the course spec asks, the admin goes
// back to their home page with the server's success or error message.
// Owner: Abhinav
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CircleCheck, CircleX, ThumbsDown, ThumbsUp, TriangleAlert } from 'lucide-react';
import { api } from '../../api.js';
import { useGoHome } from '../../components/Flash.jsx';
import { BoroughBullet, Button, CARD, EmptyState, Icon, Notice, Page, Skeleton, TextArea } from '../../components/v2/index.js';
import { formatDate, formatTime } from '../../format.js';
import { clock } from '../../lib/hours.js';
import { cn } from '../../lib/utils.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekday(timestamp) {
  const [y, m, d] = String(timestamp).slice(0, 10).split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "Ready to approve" or "Conflict", in words with an icon. */
export function ConflictBadge({ conflict, className }) {
  const ok = conflict === 'none';
  return (
    <span
      className={cn(
        'inline-flex h-8 flex-none items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold',
        ok ? 'bg-primary-soft text-accent-ink' : 'bg-destructive-soft text-destructive',
        className,
      )}
    >
      <Icon icon={ok ? CircleCheck : TriangleAlert} tone="label" size="15px" />
      {ok ? 'Ready to approve' : 'Conflict'}
    </span>
  );
}

/** The three Q2 checks for one booking, each passed or failed, in words. */
function bookingChecks(b) {
  const overlap = b.overlap_start
    ? {
        ok: false,
        text: (
          <>
            Overlaps{' '}
            {b.overlap_game_id ? (
              <Link to={`/status?gameId=${b.overlap_game_id}`} className="underline underline-offset-4">
                game #{b.overlap_game_id}
              </Link>
            ) : (
              'a booking'
            )}
            , already approved for {formatTime(b.overlap_start)} – {formatTime(b.overlap_end)}.
          </>
        ),
      }
    : { ok: true, text: 'No approved game on this field at this time.' };
  const closure = b.closure_reason
    ? { ok: false, text: `Field closed: ${b.closure_reason} (${formatDate(b.closure_start)} to ${formatDate(b.closure_end)}).` }
    : { ok: true, text: 'No closure at this time.' };
  let hours;
  if (b.day_open == null) hours = { ok: false, text: `The field is closed on ${weekday(b.start_time)}s.` };
  else if (b.outside_hours) hours = { ok: false, text: `Outside opening hours: open ${clock(b.day_open)} – ${clock(b.day_close)} that day.` };
  else hours = { ok: true, text: `Inside opening hours (${clock(b.day_open)} – ${clock(b.day_close)}).` };
  return [overlap, closure, hours];
}

/** A rejection reason that matches the conflict, for the admin to edit. */
function suggestedReason(b) {
  if (b.overlap_start) {
    return `${b.field_name} is already booked from ${formatTime(b.overlap_start)} to ${formatTime(b.overlap_end)} that day.`;
  }
  if (b.closure_reason) return `${b.field_name} is closed then (${b.closure_reason}).`;
  if (b.conflict === 'outside field hours') return `The game is outside ${b.field_name}'s opening hours that day.`;
  return '';
}

function Fact({ label, children, sub }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] font-semibold text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{children}</dd>
      {sub && <dd className="text-[14px] text-muted-foreground">{sub}</dd>}
    </div>
  );
}

function BookingCard({ b, busy, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const headingId = useId();
  const rejectButton = useRef(null);
  const reopened = useRef(false);
  const checks = bookingChecks(b);

  // After "Keep it pending", put focus back on the Reject button.
  useEffect(() => {
    if (!rejecting && reopened.current) rejectButton.current?.focus();
    reopened.current = rejecting;
  }, [rejecting]);
  const clear = b.conflict === 'none';

  function openReject() {
    setReason(suggestedReason(b));
    setError('');
    setRejecting(true);
  }

  function submitReject(event) {
    event.preventDefault();
    if (!reason.trim()) return setError('Give the organizer a reason.');
    onReject(b, reason.trim());
  }

  return (
    <li id={`booking-${b.reservation_id}`} aria-labelledby={headingId} className={cn(CARD, 'flex scroll-mt-24 flex-col gap-4')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted-foreground tnum">
            Booking #{b.reservation_id} · requested {formatDate(b.requested_at)}, {formatTime(b.requested_at)}
          </p>
          <h2 id={headingId} className="mt-0.5 font-display text-[20px] leading-tight font-bold tracking-[-0.01em]">
            <Link to={`/fields/${b.field_id}`} className="text-foreground no-underline hover:underline">
              {b.field_name}
            </Link>
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-muted-foreground">
            <BoroughBullet borough={b.borough} size="xs" decorative />
            {b.borough}
          </p>
        </div>
        <ConflictBadge conflict={b.conflict} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Fact label="Kick-off" sub={`${formatTime(b.start_time)} – ${formatTime(b.end_time)}`}>
          <span className="tnum">{formatDate(b.start_time)}</span>
        </Fact>
        <Fact label="Game" sub={`${b.format} · ${b.skill_level}`}>
          <Link to={`/status?gameId=${b.game_id}`} className="text-foreground underline underline-offset-4">
            #{b.game_id}
          </Link>
        </Fact>
        <Fact label="Organizer">{b.organizer_name}</Fact>
        <Fact label="Signed up">
          <span className="tnum">
            {b.signed_up} / {b.max_players}
          </span>
        </Fact>
      </dl>

      <ul aria-label="Booking checks" className="flex flex-col gap-1.5 rounded-lg bg-surface-2 p-3 dark:bg-surface-3">
        {checks.map((c, i) => (
          <li key={i} className={cn('flex items-start gap-2 text-[14px] leading-5', c.ok ? 'text-foreground' : 'font-semibold text-destructive')}>
            <Icon icon={c.ok ? CircleCheck : CircleX} tone="label" size="17px" className={cn('mt-px', c.ok && 'text-accent-ink')} />
            <span>
              <span className="sr-only">{c.ok ? 'Passed: ' : 'Problem: '}</span>
              {c.text}
            </span>
          </li>
        ))}
      </ul>

      {b.competing_requests > 0 && (
        <Notice type="warning" className="py-3 text-[14px]">
          {b.competing_requests} other {b.competing_requests === 1 ? 'request wants' : 'requests want'} this field at an overlapping time. Approving
          this one means {b.competing_requests === 1 ? 'that one' : 'those'} can no longer be approved.
        </Notice>
      )}

      {rejecting ? (
        <form onSubmit={submitReject} className="flex flex-col gap-3 border-t border-line-soft pt-4">
          <TextArea
            label="Reason for the organizer"
            hint="Shown with the game's status. Rejecting calls off the game and cancels its sign-ups."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            error={error}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" aria-disabled={busy || undefined} disabled={busy}>
              <Icon icon={ThumbsDown} tone="label" size="16px" />
              {busy ? 'Rejecting…' : 'Reject booking'}
            </Button>
            <Button variant="quiet" onClick={() => setRejecting(false)} disabled={busy}>
              Keep it pending
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
          {clear ? (
            <>
              <Button onClick={() => onApprove(b)} disabled={busy}>
                <Icon icon={ThumbsUp} tone="label" size="16px" />
                {busy ? 'Approving…' : 'Approve'}
              </Button>
              <Button ref={rejectButton} variant="secondary" onClick={openReject} disabled={busy}>
                Reject…
              </Button>
            </>
          ) : (
            <>
              <Button ref={rejectButton} variant="danger" onClick={openReject} disabled={busy}>
                <Icon icon={ThumbsDown} tone="label" size="16px" />
                Reject…
              </Button>
              <Button variant="quiet" onClick={() => onApprove(b)} disabled={busy}>
                Try to approve anyway
              </Button>
              <span className="text-[13px] text-muted-foreground">The server refuses approvals with a conflict and says why.</span>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function AdminBookings() {
  const goHome = useGoHome();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let live = true;
    api('/admin/bookings')
      .then((d) => live && setBookings(d.bookings))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  // Scroll to #booking-N when coming from the admin home page.
  useEffect(() => {
    if (!bookings || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [bookings]);

  async function review(b, action, body) {
    setBusyId(b.reservation_id);
    try {
      const data = await api(`/admin/bookings/${b.reservation_id}/${action}`, { method: 'POST', body });
      goHome('success', data.message);
    } catch (e) {
      goHome('error', `Booking #${b.reservation_id} (game #${b.game_id}): ${e.message}`);
    }
  }

  const conflicts = bookings?.filter((b) => b.conflict !== 'none').length ?? 0;

  return (
    <Page
      title="Pending field bookings"
      lede="Games whose field booking is waiting for review, oldest request first. A booking with a conflict cannot be approved."
    >
      {error && <Notice type="error">{error}</Notice>}
      {!bookings && !error && <Skeleton rows={3} label="Loading bookings" />}
      {bookings && (
        <>
          <p role="status" className="mb-4 px-1 text-[15px] font-medium text-muted-foreground tnum">
            {bookings.length === 0
              ? 'Nothing waiting.'
              : `${bookings.length} waiting${conflicts ? ` · ${conflicts} with a conflict` : ''}`}
          </p>
          {bookings.length === 0 ? (
            <EmptyState title="All caught up." action={<Button to="/admin/games" variant="secondary">See all games</Button>}>
              Every field booking has been reviewed. New requests appear here when organizers create games.
            </EmptyState>
          ) : (
            <ol className="flex flex-col gap-4">
              {bookings.map((b) => (
                <BookingCard
                  key={b.reservation_id}
                  b={b}
                  busy={busyId === b.reservation_id}
                  onApprove={(x) => review(x, 'approve')}
                  onReject={(x, reason) => review(x, 'reject', { reason })}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </Page>
  );
}
