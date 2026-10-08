import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import {
  Badge,
  Counter,
  PrimaryButton,
  SegmentedControl,
  Stepper,
  TextField,
  Toggle,
  initialsOf,
} from '@/components/ds';
import { formatDecimal, formatDT, formatShortDate, formatTimeRange, withCount } from '@/theme';

/**
 * The behaviour the design system pins down for its stateful primitives
 * (DESIGN_SYSTEM.md §6–§7, §10–§11). Styling is checked on the board, not here.
 */

describe('PrimaryButton', () => {
  it('reads label and amount together and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Add to cart" right="21,36 DT" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Add to cart, 21,36 DT'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not pressable while loading and shows the progressive label', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Log in" loadingLabel="Logging in…" loading onPress={onPress} />);
    expect(screen.getByText('Logging in…')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Log in'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Log in').props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });

  it('exposes disabled and can carry the reason as its label', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Choose a sauce" disabled onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Choose a sauce'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Choose a sauce').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('Stepper', () => {
  it('turns minus into a delete at quantity 1 when the line can be removed', async () => {
    const onDecrement = jest.fn();
    await render(
      <Stepper value={1} onIncrement={jest.fn()} onDecrement={onDecrement} size="compact" trashAtMin itemName="Coke" />,
    );
    fireEvent.press(screen.getByLabelText('Remove Coke'));
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it('disables minus at the minimum when deletion is not allowed', async () => {
    const onDecrement = jest.fn();
    await render(<Stepper value={1} onIncrement={jest.fn()} onDecrement={onDecrement} />);
    fireEvent.press(screen.getByLabelText('Decrease quantity'));
    expect(onDecrement).not.toHaveBeenCalled();
  });

  it('stops at max', async () => {
    const onIncrement = jest.fn();
    await render(<Stepper value={5} max={5} onIncrement={onIncrement} onDecrement={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Increase quantity'));
    expect(onIncrement).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('shows and announces the error message instead of the helper', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await render(
      <TextField
        label="Phone number"
        helper="Riders use this number to reach you about an order."
        error="Enter an 8-digit Tunisian number."
      />,
    );
    expect(screen.getByText('Enter an 8-digit Tunisian number.')).toBeTruthy();
    expect(screen.queryByText('Riders use this number to reach you about an order.')).toBeNull();
    expect(announce).toHaveBeenCalledWith('Enter an 8-digit Tunisian number.');
    announce.mockRestore();
  });

  it('is not editable while locked', async () => {
    await render(<TextField label="Email" locked />);
    expect(screen.getByLabelText('Email').props.editable).toBe(false);
  });
});

describe('selection', () => {
  it('SegmentedControl reports the tapped segment and marks the selected one', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        segments={[
          { key: 'active', label: 'In progress · 3' },
          { key: 'done', label: 'Completed · 1' },
        ]}
        value="active"
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText('In progress · 3').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByLabelText('Completed · 1'));
    expect(onChange).toHaveBeenCalledWith('done');
  });

  it('Toggle flips its value', async () => {
    const onValueChange = jest.fn();
    await render(<Toggle value accessibilityLabel="Order notifications" onValueChange={onValueChange} />);
    fireEvent.press(screen.getByLabelText('Order notifications'));
    expect(onValueChange).toHaveBeenCalledWith(false);
  });
});

describe('badges', () => {
  it('Counter caps at 9+ and hides at zero', async () => {
    const { rerender } = await render(<Counter count={12} />);
    expect(screen.getByText('9+', { includeHiddenElements: true })).toBeTruthy();
    await rerender(<Counter count={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('Badge renders its label', async () => {
    await render(<Badge label="Closed · Opens at 10:00" variant="closed" />);
    expect(screen.getByText('Closed · Opens at 10:00')).toBeTruthy();
  });
});

describe('copy formatters (§10)', () => {
  it('prices use a comma decimal and drop trailing zeros', () => {
    expect(formatDT(14)).toBe('14 DT');
    expect(formatDT(9.68)).toBe('9,68 DT');
    expect(formatDT(59.9)).toBe('59,9 DT');
    expect(formatDT(2.5)).toBe('2,5 DT');
    expect(formatDT(10)).toBe('10 DT');
    expect(formatDecimal(-0.001)).toBe('0');
  });

  it('times, counts, dates and initials follow the board', () => {
    expect(formatTimeRange(25, 40)).toBe('25–40 min');
    expect(formatTimeRange(30, 30)).toBe('30 min');
    expect(withCount('In progress', 3)).toBe('In progress · 3');
    expect(formatShortDate(new Date(2026, 8, 29))).toBe('29 Sept 2026');
    expect(initialsOf('Med Ridha Chemchik')).toBe('MC');
    expect(initialsOf('')).toBe('?');
  });
});
