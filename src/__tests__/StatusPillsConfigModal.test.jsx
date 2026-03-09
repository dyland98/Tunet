import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/cards/StatusPill', () => ({
  default: () => <div data-testid="status-pill-preview" />,
}));

import StatusPillsConfigModal from '../modals/StatusPillsConfigModal';

const t = (key) => {
  const values = {
    'statusPills.title': 'Status Pills',
    'statusPills.yourPills': 'Your Pills',
    'statusPills.editor': 'Edit Pill',
    'statusPills.typeSensor': 'Sensor',
    'statusPills.show': 'Show',
    'statusPills.hide': 'Hide',
    'statusPills.newPill': 'New Pill',
    'statusPills.selectPillHint': 'Select a pill',
    'statusPills.pillNamePlaceholder': 'Pill name',
    'statusPills.cancel': 'Cancel',
    'statusPills.save': 'Save',
    'common.close': 'Close',
    form: 'Search',
  };
  return values[key] || key;
};

describe('StatusPillsConfigModal', () => {
  it('keeps the editor open when the selected pill is clicked again', async () => {
    await act(async () => {
      render(
        <StatusPillsConfigModal
          show
          onClose={() => {}}
          onSave={() => {}}
          entities={{
            'sensor.living_room': {
              attributes: { friendly_name: 'Living Room Sensor' },
            },
          }}
          statusPillsConfig={[
            {
              id: 'pill-1',
              type: 'conditional',
              entityId: 'sensor.living_room',
              label: 'Living Room',
              icon: 'Activity',
              iconBgColor: 'rgba(59, 130, 246, 0.1)',
              iconColor: 'text-[var(--accent-color)]',
              visible: true,
              conditionEnabled: false,
            },
          ]}
          t={t}
        />
      );
      await Promise.resolve();
    });

    const pillButton = screen.getByText('Living Room').closest('button');
    expect(screen.getByText('Select a pill')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(pillButton);
    });
    expect(screen.getByPlaceholderText('Pill name')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(pillButton);
    });
    expect(screen.getByPlaceholderText('Pill name')).toBeInTheDocument();
    expect(screen.queryByText('Select a pill')).not.toBeInTheDocument();
  });
});