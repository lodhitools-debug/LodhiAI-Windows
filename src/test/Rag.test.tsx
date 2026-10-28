import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { KnowledgeBaseScreen } from '../screens/KnowledgeBaseScreen';
import { AppProvider } from '../store/AppContext';
import * as tauriService from '../services/tauri';
import { DocumentMeta, SearchResult, IngestionResult } from '../types';

describe('Phase 3 — Stage 3.3: Documents, Knowledge Base & RAG Engine Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders DocumentsScreen and lists indexed document library', async () => {
    const mockDocs: DocumentMeta[] = [
      {
        id: 'doc-1',
        name: 'SECURITY_AUDIT.md',
        path: 'docs/SECURITY_AUDIT.md',
        size_bytes: 4096,
        content_hash: 'hash-sec-123',
        chunk_count: 8,
        mime_type: 'text/markdown',
        collection_id: 'default',
        indexed_at_ms: Date.now(),
      },
    ];

    vi.spyOn(tauriService, 'listDocuments').mockResolvedValue(mockDocs);

    render(
      <AppProvider>
        <DocumentsScreen />
      </AppProvider>
    );

    expect(screen.getByText(/Local Document Ingestion & Vector Parsing/i)).toBeInTheDocument();
    expect(screen.getByText(/Indexed Document Library/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('SECURITY_AUDIT.md')).toBeInTheDocument();
      expect(screen.getByText('8 chunks')).toBeInTheDocument();
    });
  });

  it('indexes a new document and updates visual status feedback', async () => {
    const mockIngestResult: IngestionResult = {
      document: {
        id: 'doc-new-1',
        name: 'NEW_SPEC.md',
        path: 'docs/NEW_SPEC.md',
        size_bytes: 2048,
        content_hash: 'hash-new-456',
        chunk_count: 4,
        mime_type: 'text/markdown',
        collection_id: 'default',
        indexed_at_ms: Date.now(),
      },
      is_duplicate: false,
      chunks_created: 4,
      message: 'Document successfully indexed with verified local chunks.',
    };

    vi.spyOn(tauriService, 'listDocuments').mockResolvedValue([]);
    vi.spyOn(tauriService, 'ingestDocument').mockResolvedValue(mockIngestResult);

    render(
      <AppProvider>
        <DocumentsScreen />
      </AppProvider>
    );

    const input = screen.getByPlaceholderText(/Or enter path: e.g. docs\/SECURITY.md/i);
    fireEvent.change(input, { target: { value: 'docs/NEW_SPEC.md' } });

    const indexBtn = screen.getByRole('button', { name: /Index File/i });
    fireEvent.click(indexBtn);

    await waitFor(() => {
      expect(tauriService.ingestDocument).toHaveBeenCalledWith('docs/NEW_SPEC.md');
      expect(screen.getByText(/Successfully indexed NEW_SPEC.md into 4 local chunks/i)).toBeInTheDocument();
    });
  });

  it('performs semantic BM25 search and renders citations on KnowledgeBaseScreen', async () => {
    const mockSearchResults: SearchResult[] = [
      {
        doc_id: 'doc-sec',
        doc_name: 'SECURITY.md',
        chunk_id: 'chunk-1',
        chunk_index: 1,
        content: 'All API keys are encrypted at rest with Windows DPAPI.',
        score: 0.892,
        citation: '[Source: SECURITY.md (Chunk #1)]',
      },
    ];

    const mockRagContext = `--- GROUNDED KNOWLEDGE BASE CONTEXT ---
[Source: SECURITY.md (Chunk #1)]
All API keys are encrypted at rest with Windows DPAPI.
--- END KNOWLEDGE BASE CONTEXT ---`;

    vi.spyOn(tauriService, 'searchKnowledgeBase').mockResolvedValue(mockSearchResults);
    vi.spyOn(tauriService, 'getRagContext').mockResolvedValue(mockRagContext);

    render(
      <AppProvider>
        <KnowledgeBaseScreen />
      </AppProvider>
    );

    expect(screen.getByText(/Local Vector Knowledge Base \(RAG\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Knowledge Base Semantic Search & Retrieval/i)).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/e\.g\. Windows DPAPI secret protection/i);
    fireEvent.change(searchInput, { target: { value: 'DPAPI encryption' } });

    const searchBtn = screen.getByRole('button', { name: /Search Index/i });
    await waitFor(() => expect(searchBtn).toBeEnabled());
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(tauriService.searchKnowledgeBase).toHaveBeenCalledWith('DPAPI encryption', 5);
      expect(screen.getAllByText(/Source: SECURITY\.md/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/All API keys are encrypted at rest with Windows DPAPI\./i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Grounded Chat Prompt Injection Preview:/i)).toBeInTheDocument();
    });
  });
});
