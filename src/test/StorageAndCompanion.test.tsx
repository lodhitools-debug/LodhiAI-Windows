import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AndroidCompanionCockpit } from '../components/companion/AndroidCompanionCockpit';
import * as tauriService from '../services/tauri';

describe('AndroidCompanionCockpit & Storage Foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(tauriService, 'listPairedDevices').mockResolvedValue([
      {
        id: 'device-1',
        name: 'Pixel 8 Pro',
        model: 'Google Pixel',
        ipAddress: '192.168.1.105',
        pairedAtMs: Date.now() - 3600000,
        lastSeenMs: Date.now(),
        authorized: true,
        publicKeyFingerprint: 'SHA256:7f8a9b...',
      },
    ]);

    vi.spyOn(tauriService, 'getCompanionSyncPayload').mockResolvedValue({
      syncId: 'sync-123',
      serverTimeMs: Date.now(),
      status: 'synchronized',
      tasksCount: 3,
      conversationsCount: 8,
      offlineQueueCount: 0,
    });

    vi.spyOn(tauriService, 'generateCompanionPairingPin').mockResolvedValue({
      pin: '582914',
      expiresAtMs: Date.now() + 300000,
      createdAtMs: Date.now(),
    });

    vi.spyOn(tauriService, 'revokePairedDevice').mockResolvedValue(true);
  });

  it('renders companion gateway status and synced checkpoints', async () => {
    render(<AndroidCompanionCockpit />);

    await waitFor(() => {
      expect(screen.getByText('Android Companion Integration')).toBeInTheDocument();
      expect(screen.getByText('Online (Port 8443)')).toBeInTheDocument();
      expect(screen.getByText(/3 Active Checkpoints/)).toBeInTheDocument();
      expect(screen.getByText(/Conversations: 8/)).toBeInTheDocument();
    });
  });

  it('renders authorized companion devices and key fingerprint', async () => {
    render(<AndroidCompanionCockpit />);

    await waitFor(() => {
      expect(screen.getByText('Pixel 8 Pro')).toBeInTheDocument();
      expect(screen.getByText(/Model: Google Pixel/)).toBeInTheDocument();
      expect(screen.getByText(/Key Fingerprint: SHA256:7f8a9b/)).toBeInTheDocument();
    });
  });

  it('generates a 6-digit one-time pairing PIN with countdown timer', async () => {
    render(<AndroidCompanionCockpit />);

    await waitFor(() => {
      expect(screen.getByText('Generate 6-Digit Pairing PIN')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Generate 6-Digit Pairing PIN'));

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText(/Expires in:/)).toBeInTheDocument();
    });
  });

  it('revokes companion device authorization with confirmation modal', async () => {
    render(<AndroidCompanionCockpit />);

    await waitFor(() => {
      expect(screen.getByText('Revoke Device')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Revoke Device'));

    expect(screen.getByText('Confirm Device Revocation')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to revoke authorization/)).toBeInTheDocument();

    // Confirm revocation
    fireEvent.click(screen.getByText('Revoke Authorization'));

    await waitFor(() => {
      expect(tauriService.revokePairedDevice).toHaveBeenCalledWith('device-1');
    });
  });
});
