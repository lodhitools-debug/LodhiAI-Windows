import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeneralSettingsScreen } from '../screens/GeneralSettingsScreen';
import { AppProvider } from '../store/AppContext';
import * as tauriService from '../services/tauri';

describe('Commercial Licensing Architecture & General Settings (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(tauriService, 'getCurrentLicenseStatus').mockResolvedValue({
      state: 'unlicensed',
      tier: 'free',
      ticket: null,
      message: 'Free Community Edition. 100% offline, zero license or account required.',
      verifiedAtMs: Date.now(),
    });

    vi.spyOn(tauriService, 'verifyLicenseToken').mockImplementation(async (token?: string) => {
      if (token && token.includes('valid-pro')) {
        return {
          state: 'valid',
          tier: 'pro',
          ticket: {
            licenseId: 'lic-pro-100',
            issuer: 'lodhiai.com',
            subject: 'lead@enterprise.com',
            tier: 'pro',
            features: ['local_ollama', 'coding_agent', 'cloud_orchestration'],
            issuedAt: Math.floor(Date.now() / 1000) - 100,
            expiresAt: Math.floor(Date.now() / 1000) + 86400 * 30,
            deviceId: 'PC-TEST-01',
          },
          message: 'Valid Developer Pro license verified offline. All tier features active.',
          verifiedAtMs: Date.now(),
        };
      }
      return {
        state: 'invalid',
        tier: 'free',
        ticket: null,
        message: 'Cryptographic signature verification failed: signature does not match public key.',
        verifiedAtMs: Date.now(),
      };
    });

    vi.spyOn(tauriService, 'clearLicense').mockResolvedValue({
      state: 'unlicensed',
      tier: 'free',
      ticket: null,
      message: 'Free Community Edition. 100% offline, zero license or account required.',
      verifiedAtMs: Date.now(),
    });
  });

  it('renders default unlicensed state with active Free Community Edition', async () => {
    render(
      <AppProvider>
        <GeneralSettingsScreen />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Commercial Licensing & Account Architecture')).toBeInTheDocument();
      expect(screen.getByText('Community Free (Active)')).toBeInTheDocument();
      expect(screen.getByText(/Local Community Free functionality is 100% unrestricted/)).toBeInTheDocument();
    });
  });

  it('verifies and activates a signed license token offline', async () => {
    render(
      <AppProvider>
        <GeneralSettingsScreen />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/eyJhbGciOiJMT0RISS/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/eyJhbGciOiJMT0RISS/);
    fireEvent.change(input, { target: { value: 'eyJhbGciOiJMT0RISS1TSEEyNTYtVjEi.valid-pro.sig' } });

    const verifyBtn = screen.getByText('Verify & Activate');
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(tauriService.verifyLicenseToken).toHaveBeenCalledWith('eyJhbGciOiJMT0RISS1TSEEyNTYtVjEi.valid-pro.sig');
      expect(screen.getByText(/Valid Developer Pro license verified offline/)).toBeInTheDocument();
    });
  });

  it('reports error on invalid or tampered license token', async () => {
    render(
      <AppProvider>
        <GeneralSettingsScreen />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/eyJhbGciOiJMT0RISS/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/eyJhbGciOiJMT0RISS/);
    fireEvent.change(input, { target: { value: 'tampered.token.badsig' } });

    const verifyBtn = screen.getByText('Verify & Activate');
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cryptographic signature verification failed/)).toBeInTheDocument();
    });
  });

  it('allows clearing active license back to Free Community Edition', async () => {
    vi.spyOn(tauriService, 'getCurrentLicenseStatus').mockResolvedValueOnce({
      state: 'valid',
      tier: 'pro',
      ticket: {
        licenseId: 'lic-pro-100',
        issuer: 'lodhiai.com',
        subject: 'lead@enterprise.com',
        tier: 'pro',
        features: ['local_ollama', 'coding_agent'],
        issuedAt: Math.floor(Date.now() / 1000) - 100,
        expiresAt: Math.floor(Date.now() / 1000) + 86400 * 30,
        deviceId: 'PC-TEST-01',
      },
      message: 'Valid Developer Pro license verified offline.',
      verifiedAtMs: Date.now(),
    });

    render(
      <AppProvider>
        <GeneralSettingsScreen />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Clear License')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Clear License'));

    await waitFor(() => {
      expect(tauriService.clearLicense).toHaveBeenCalled();
      expect(screen.getByText(/License cleared\. Reverted to Free Community Edition/)).toBeInTheDocument();
    });
  });
});
