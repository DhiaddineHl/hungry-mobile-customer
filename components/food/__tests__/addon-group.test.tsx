// Imported from the module, not the `components/food` barrel: the barrel also
// pulls in `AddToCartBar` -> `PressableScale` -> reanimated, whose native half
// is not initialised under jest and throws on import.
import { AddonGroup, type AddonGroupData } from '@/components/food/addon-group';
import { fireEvent, render, screen } from '@testing-library/react-native';

/**
 * What a group's `type` actually changes on screen.
 *
 * The single/multi RULE itself — what a tap does to the selection — is a pure
 * function tested in `services/api/__tests__/product-view-model.test.ts`
 * (`toggleAddonSelection`). These cases cover the half that only a renderer can
 * answer: that a SINGLE group presents radios rather than checkboxes, that the
 * control reports its own state, and that a tap reaches the screen with the
 * group it happened in.
 */

const SIZES: AddonGroupData = {
  id: 'grp-size',
  title: 'Choose a size',
  type: 'radio',
  required: true,
  options: [
    { id: 'small', name: 'Small' },
    { id: 'large', name: 'Large', price: '+2.00 DT' },
  ],
};

const TOPPINGS: AddonGroupData = {
  id: 'grp-toppings',
  title: 'Toppings',
  type: 'checkbox',
  required: false,
  options: [
    { id: 'egg', name: 'Egg' },
    { id: 'cheese', name: 'Cheese' },
  ],
};

// `render` is ASYNC in RNTL 14 — await it, or the queries on `screen` are
// still unbound and every assertion throws "render function has not been called".
async function renderGroup(group: AddonGroupData, selectedIds: string[] = []) {
  const onToggle = jest.fn();
  await render(
    <AddonGroup
      group={group}
      selectedIds={selectedIds}
      onToggle={onToggle}
    />
  );
  return onToggle;
}

it('presents a single-select group as radios', async () => {
  await renderGroup(SIZES);

  expect(screen.getAllByRole('radio')).toHaveLength(2);
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
});

it('presents a multi-select group as checkboxes', async () => {
  await renderGroup(TOPPINGS);

  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
});

it('reports which radio is chosen, so a screen reader can announce it', async () => {
  await renderGroup(SIZES, ['large']);

  const [small, large] = screen.getAllByRole('radio');
  expect(small).not.toBeChecked();
  expect(large).toBeChecked();
});

it('passes a tap on a radio up with its group, so the screen can replace the choice', async () => {
  const onToggle = await renderGroup(SIZES, ['small']);

  fireEvent.press(screen.getByText('Large'));

  expect(onToggle).toHaveBeenCalledWith('grp-size', 'large');
});

it('lets a radio option be tapped even while another one is selected', async () => {
  // The multi-select cap must never disable the alternatives of a radio group:
  // picking another size is how a customer CHANGES their answer.
  const onToggle = await renderGroup({ ...SIZES, maxSelect: 1 }, ['small']);

  fireEvent.press(screen.getByText('Large'));

  expect(onToggle).toHaveBeenCalledWith('grp-size', 'large');
});

it('counts the selections of a multi-select group', async () => {
  await renderGroup(TOPPINGS, ['egg', 'cheese']);

  expect(screen.getByText('2 items selected')).toBeTruthy();
});

it('says "1 item selected", not "1 items"', async () => {
  await renderGroup(TOPPINGS, ['egg']);

  expect(screen.getByText('1 item selected')).toBeTruthy();
});

it('counts nothing in a radio group — the chosen row already shows it', async () => {
  await renderGroup({ ...SIZES, required: false }, ['small']);

  expect(screen.queryByText(/selected/)).toBeNull();
});

describe('the Required badge', () => {
  it('reads as unanswered while a required group holds nothing', async () => {
    await renderGroup(SIZES);

    expect(screen.getByLabelText('Required, choose an option')).toBeTruthy();
    expect(screen.queryByLabelText('Required, answered')).toBeNull();
  });

  it('flips to answered the moment an option is picked — no submit needed', async () => {
    // The old badge waited for a rejected Add attempt to turn green, which left
    // a red Required tag sitting on a question the customer had answered.
    await renderGroup(SIZES, ['small']);

    expect(screen.getByLabelText('Required, answered')).toBeTruthy();
    expect(screen.queryByLabelText('Required, choose an option')).toBeNull();
  });

  it('is not shown at all for an optional group', async () => {
    await renderGroup(TOPPINGS);

    expect(screen.queryByText('Required')).toBeNull();
  });
});
