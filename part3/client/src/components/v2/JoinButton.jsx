// Join toggle with a blurred icon swap (Join game -> Joined). The parent owns
// the state and decides what a click does (join, log in first, or explain).
import { Check, Plus } from 'lucide-react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import IconSwap from './IconSwap.jsx';

export default function JoinButton({ joined, onClick, size = 'md', label = 'Join game', joinedLabel = 'Joined', className, ...rest }) {
  return (
    <Button variant={joined ? 'secondary' : 'primary'} size={size} aria-pressed={joined} onClick={onClick} className={className} {...rest}>
      <IconSwap swapKey={joined ? 'joined' : 'join'}>
        <Icon icon={joined ? Check : Plus} tone="label" size="17px" className={joined ? 'text-accent-ink' : undefined} />
      </IconSwap>
      {joined ? joinedLabel : label}
    </Button>
  );
}
