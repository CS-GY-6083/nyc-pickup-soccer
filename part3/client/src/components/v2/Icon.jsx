// Lucide icon with its stroke matched to the text beside it:
//   tone="body"  1.5  (running text)
//   tone="label" 2    (labels, buttons; the default)
//   tone="sign"  2.5  (bold sign lettering)
// Size defaults to 1.25 x the cap height of the surrounding text (~1.1em
// box for Lucide's 24px grid). Decorative by default; pass `label` to name it.
const STROKE = { body: 1.5, label: 2, sign: 2.5 };

export default function Icon({ icon: Glyph, tone = 'label', size = '1.1em', label, className, style, ...rest }) {
  return (
    <Glyph
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
      strokeWidth={STROKE[tone] ?? 2}
      absoluteStrokeWidth={false}
      className={className}
      style={{ width: size, height: size, flex: 'none', ...style }}
      {...rest}
    />
  );
}
