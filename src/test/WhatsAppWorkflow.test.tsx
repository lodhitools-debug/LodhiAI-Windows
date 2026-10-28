import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WhatsAppWorkflowCockpit } from '../components/automation/WhatsAppWorkflowCockpit';
import { AppProvider } from '../store/AppContext';
import * as tauriService from '../services/tauri';
import {
  WhatsAppCapabilities,
  WhatsAppConfig,
  WhatsAppDraft,
  WhatsAppAuditEntry,
} from '../types';

describe('Phase 3 — Stage 3.7: WhatsApp Workflow Integration Suite', () => {
  const mockCapabilities: WhatsAppCapabilities = {
    officialBusinessApiSupported: true,
    testModeActive: true,
    dpapiTokenProtection: true,
    humanApprovalMandatory: true,
    rateLimitingEnforced: true,
    businessVerificationRequiredNotice: 'Meta WhatsApp Business Platform API requires an official Meta developer account and verified business portfolio.',
  };

  const mockConfig: WhatsAppConfig = {
    phoneNumberId: '1092837465',
    businessAccountId: '9876543210',
    hasApiToken: true,
    testMode: true,
    rateLimitPerMinute: 20,
    apiEndpoint: 'https://graph.facebook.com/v21.0',
  };

  const mockAuditLogs: WhatsAppAuditEntry[] = [
    {
      id: 'wa-audit-1',
      recipientMasked: '+141 *** **71',
      messageType: 'welcome_notification',
      permissionDecision: 'user_approved',
      status: 'simulatedDelivered',
      durationMs: 35,
      timestampMs: Date.now() - 45000,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(tauriService, 'getWhatsAppCapabilities').mockResolvedValue(mockCapabilities);
    vi.spyOn(tauriService, 'getWhatsAppConfig').mockResolvedValue(mockConfig);
    vi.spyOn(tauriService, 'getWhatsAppAuditLog').mockResolvedValue(mockAuditLogs);
  });

  it('renders WhatsApp workflow cockpit and Meta Business API compliance notice', async () => {
    render(
      <AppProvider>
        <WhatsAppWorkflowCockpit />
      </AppProvider>
    );

    expect(screen.getByText(/Official Meta WhatsApp Business Cloud API Integration/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Test Mode \(Sandbox\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Meta WhatsApp Business Platform API requires an official Meta developer account/i)).toBeInTheDocument();
      expect(screen.getByText('+141 *** **71')).toBeInTheDocument();
      expect(screen.getByText('SIMULATEDDELIVERED')).toBeInTheDocument();
    });
  });

  it('validates E.164 phone number format on input change', async () => {
    const validateSpy = vi.spyOn(tauriService, 'validateRecipientPhone').mockResolvedValue('+447911123456');

    render(
      <AppProvider>
        <WhatsAppWorkflowCockpit />
      </AppProvider>
    );

    const phoneInput = screen.getByRole('textbox', { name: /Recipient Phone Number/i });
    fireEvent.change(phoneInput, { target: { value: '+447911123456' } });

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith('+447911123456');
      expect(screen.getByText(/Valid E\.164 phone format/i)).toBeInTheDocument();
    });
  });

  it('prepares message draft and triggers human authorization modal', async () => {
    const mockDraft: WhatsAppDraft = {
      id: 'wa-draft-99',
      recipientPhone: '+14155552671',
      templateName: 'welcome_notification',
      bodyText: 'Hello from Lodhi AI Desktop Assistant.',
      requiresConfirmation: true,
      createdAtMs: Date.now(),
    };

    const draftSpy = vi.spyOn(tauriService, 'draftWhatsAppMessage').mockResolvedValue(mockDraft);
    const dispatchSpy = vi.spyOn(tauriService, 'dispatchWhatsAppMessage').mockResolvedValue({
      draftId: 'wa-draft-99',
      recipient: '+141 *** **71',
      status: 'simulatedDelivered',
      messageId: 'wamid.TEST_123456',
      isTestMode: true,
      timestampMs: Date.now(),
    });

    render(
      <AppProvider>
        <WhatsAppWorkflowCockpit />
      </AppProvider>
    );

    const draftBtn = screen.getByRole('button', { name: /Prepare Draft for Approval/i });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(draftSpy).toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Authorize WhatsApp Message Dispatch/i)).toBeInTheDocument();
      expect(screen.getByText('+14155552671')).toBeInTheDocument();
      expect(screen.getByText(/Test Mode Active/i)).toBeInTheDocument();
    });

    // Authorize & Dispatch
    const authBtn = screen.getByRole('button', { name: /Authorize & Dispatch/i });
    fireEvent.click(authBtn);

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(mockDraft, true);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('handles user denial in confirmation modal', async () => {
    const mockDraft: WhatsAppDraft = {
      id: 'wa-draft-deny',
      recipientPhone: '+14155552671',
      bodyText: 'Test message',
      requiresConfirmation: true,
      createdAtMs: Date.now(),
    };

    vi.spyOn(tauriService, 'draftWhatsAppMessage').mockResolvedValue(mockDraft);
    const dispatchSpy = vi.spyOn(tauriService, 'dispatchWhatsAppMessage').mockResolvedValue({
      draftId: 'wa-draft-deny',
      recipient: '+141 *** **71',
      status: 'blocked',
      messageId: '',
      isTestMode: true,
      timestampMs: Date.now(),
      error: 'Dispatch blocked: human authorization was denied.',
    });

    render(
      <AppProvider>
        <WhatsAppWorkflowCockpit />
      </AppProvider>
    );

    const draftBtn = screen.getByRole('button', { name: /Prepare Draft for Approval/i });
    fireEvent.click(draftBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const denyBtn = screen.getByRole('button', { name: /Deny & Cancel/i });
    fireEvent.click(denyBtn);

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(mockDraft, false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
