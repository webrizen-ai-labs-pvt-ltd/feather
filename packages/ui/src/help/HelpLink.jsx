import { HelpCircle } from '@untitledui/icons';
import { Link as AriaLink } from 'react-aria-components';
import { cx } from '@uui/utils/cx';

/** Small "?" that opens the guide at one section: <HelpLink topic="receive-truck" /> */
export function HelpLink({ topic, label = 'Help', className }) {
  return (
    <AriaLink
      href={`/help#${topic}`}
      aria-label={`${label}: how this screen works`}
      className={cx('inline-flex rounded-full p-0.5 text-fg-quaternary outline-focus-ring transition hover:text-fg-brand-primary focus-visible:outline-2', className)}
    >
      <HelpCircle className="size-5" aria-hidden />
    </AriaLink>
  );
}
