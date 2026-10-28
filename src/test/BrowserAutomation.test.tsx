import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserAutomationCockpit } from '../components/automation/BrowserAutomationCockpit';
import { AppProvider } from '../store/AppContext';
import * as tauriService from '../services/tauri';
import {
  BrowserCapabilities,
  BrowserPageInspection,
  BrowserActionRequest,
  BrowserHistoryItem,
} from '../types';

describe('Phase 3 — Stage 3.6: Sandboxed Browser Automation Suite', () => {
  const mockCapabilities: BrowserCapabilities = {
    supportedSchemes: ['http', 'https'],
    sandboxEnforced: true,
    formSubmissionApprovalRequired: true,
    untrustedInputSanitization: true,
    activeEngine: 'Lodhi Sandboxed Native HTTP / DOM Parser (Zero-Extension)',
    securityNotice: 'Web pages are treated as untrusted content.',
  };

  const mockInspection: BrowserPageInspection = {
    url: 'https://example.com',
    title: 'Example Domain',
    statusCode: 200,
    excerpt: 'This domain is for use in illustrative examples in documents.',
    links: ['https://www.iana.org/domains/example'],
    forms: [{ name: 'search_query', fieldType: 'text', value: '', isRequired: true }],
    textContent: 'Example Domain. This domain is for use in illustrative examples in documents.',
    fetchedAtMs: Date.now(),
  };

  const mockHistory: BrowserHistoryItem[] = [
    {
      url: 'https://example.com',
      title: 'Example Domain',
      statusCode: 200,
      timestamp: Date.now() - 30000,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(tauriService, 'getBrowserCapabilities').mockResolvedValue(mockCapabilities);
    vi.spyOn(tauriService, 'getBrowserHistory').mockResolvedValue(mockHistory);
    vi.spyOn(tauriService, 'navigateAndInspectUrl').mockResolvedValue(mockInspection);
  });

  it('renders Browser Automation Cockpit and URL navigator bar', async () => {
    render(
      <AppProvider>
        <BrowserAutomationCockpit />
      </AppProvider>
    );

    expect(screen.getByText(/Sandboxed Browser Automation/i)).toBeInTheDocument();
    expect(screen.getByText(/Web Page Navigator & DOM Inspector/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Target Web URL/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Example Domain')).toBeInTheDocument();
    });
  });

  it('navigates to URL and renders sanitized text and extracted forms', async () => {
    render(
      <AppProvider>
        <BrowserAutomationCockpit />
      </AppProvider>
    );

    const navBtn = screen.getByRole('button', { name: /Navigate & Inspect/i });
    fireEvent.click(navBtn);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 200/i)).toBeInTheDocument();
      expect(screen.getByText(/This domain is for use in illustrative examples/i)).toBeInTheDocument();
      expect(screen.getByText(/https:\/\/www.iana.org\/domains\/example/i)).toBeInTheDocument();
      expect(screen.getByText(/Field: search_query/i)).toBeInTheDocument();
    });
  });

  it('triggers form submission and enforces human authorization modal', async () => {
    const mockRequest: BrowserActionRequest = {
      id: 'browser-req-submit-1',
      actionType: 'submit_form',
      url: 'https://example.com',
      parameters: { fields: { search_query: 'test query' } },
      requiresConfirmation: true,
      preview: 'Submit form on https://example.com with query: test query',
      status: 'pending',
      createdAt: Date.now(),
    };

    const previewSpy = vi.spyOn(tauriService, 'previewBrowserAction').mockResolvedValue(mockRequest);
    const executeSpy = vi.spyOn(tauriService, 'executeBrowserAction').mockResolvedValue({
      requestId: 'browser-req-submit-1',
      actionType: 'submit_form',
      success: true,
      output: 'Form submitted successfully.',
      executionTimeMs: 40,
    });

    render(
      <AppProvider>
        <BrowserAutomationCockpit />
      </AppProvider>
    );

    // Navigate first
    const navBtn = screen.getByRole('button', { name: /Navigate & Inspect/i });
    fireEvent.click(navBtn);

    await waitFor(() => {
      expect(screen.getByText(/Submit Form Data \(Approval Req\.\)/i)).toBeInTheDocument();
    });

    const submitBtn = screen.getByText(/Submit Form Data \(Approval Req\.\)/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Authorize External Form Submission/i)).toBeInTheDocument();
    });

    // Authorize & Submit
    const authBtn = screen.getByRole('button', { name: /Authorize & Submit/i });
    fireEvent.click(authBtn);

    await waitFor(() => {
      expect(executeSpy).toHaveBeenCalledWith(mockRequest, true);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('handles user denial for form submission', async () => {
    const mockRequest: BrowserActionRequest = {
      id: 'browser-req-deny-1',
      actionType: 'submit_form',
      url: 'https://example.com',
      parameters: { fields: { search_query: 'unauthorized' } },
      requiresConfirmation: true,
      preview: 'Submit form on https://example.com',
      status: 'pending',
      createdAt: Date.now(),
    };

    vi.spyOn(tauriService, 'previewBrowserAction').mockResolvedValue(mockRequest);
    const executeSpy = vi.spyOn(tauriService, 'executeBrowserAction').mockResolvedValue({
      requestId: 'browser-req-deny-1',
      actionType: 'submit_form',
      success: false,
      output: '',
      executionTimeMs: 10,
      error: 'Action blocked: human authorization was denied.',
    });

    render(
      <AppProvider>
        <BrowserAutomationCockpit />
      </AppProvider>
    );

    const navBtn = screen.getByRole('button', { name: /Navigate & Inspect/i });
    fireEvent.click(navBtn);

    await waitFor(() => {
      expect(screen.getByText(/Submit Form Data \(Approval Req\.\)/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Submit Form Data \(Approval Req\.\)/i));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const denyBtn = screen.getByRole('button', { name: /Deny & Cancel/i });
    fireEvent.click(denyBtn);

    await waitFor(() => {
      expect(executeSpy).toHaveBeenCalledWith(mockRequest, false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
