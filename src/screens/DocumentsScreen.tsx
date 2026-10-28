import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Search,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  listDocuments,
  ingestDocument,
  removeDocument,
  reindexDocument,
} from '../services/tauri';
import { DocumentMeta } from '../types';

interface DisplayDoc {
  id: string;
  name: string;
  size: string;
  type: string;
  chunks: number;
  addedDate: string;
  isReal?: boolean;
}

export const DocumentsScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const [documents, setDocuments] = useState<DisplayDoc[]>([]);
  const [filePathInput, setFilePathInput] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    void loadIndexedDocs();
  }, []);

  async function loadIndexedDocs() {
    try {
      const realDocs: DocumentMeta[] = await listDocuments();
      if (realDocs) {
        const mapped: DisplayDoc[] = realDocs.map(d => ({
          id: d.id,
          name: d.name,
          size: `${(d.size_bytes / 1024).toFixed(1)} KB`,
          type: d.mime_type.includes('markdown') ? 'Markdown' : d.mime_type.includes('pdf') ? 'PDF Document' : 'Text',
          chunks: d.chunk_count,
          addedDate: new Date(d.indexed_at_ms || Date.now()).toISOString().split('T')[0],
          isReal: true,
        }));
        setDocuments(mapped);
      }
    } catch (err) {
      console.warn('Could not load native documents:', err);
    }
  }

  async function handleIngestPath(path?: string) {
    const target = (path || filePathInput).trim();
    if (!target) return;

    setIsIngesting(true);
    setStatusMessage(null);
    try {
      const res = await ingestDocument(target);
      if (res.is_duplicate) {
        setStatusMessage({ text: res.message, isError: false });
      } else {
        setStatusMessage({
          text: `Successfully indexed ${res.document.name} into ${res.document.chunk_count} local chunks.`,
          isError: false,
        });
      }
      setFilePathInput('');
      await loadIndexedDocs();
    } catch (err) {
      setStatusMessage({ text: String(err), isError: true });
    } finally {
      setIsIngesting(false);
    }
  }

  async function handleRemoveDoc(id: string) {
    try {
      await removeDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      setStatusMessage({ text: 'Document removed from local vector index.', isError: false });
    } catch (err) {
      setStatusMessage({ text: String(err), isError: true });
    }
  }

  async function handleReindex(id: string) {
    try {
      const res = await reindexDocument(id);
      setStatusMessage({ text: `Re-indexed ${res.document.name} (${res.document.chunk_count} chunks).`, isError: false });
      await loadIndexedDocs();
    } catch (err) {
      setStatusMessage({ text: String(err), isError: true });
    }
  }

  const filteredDocs = documents.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) || d.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Knowledge Base Status Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderLeft: '4px solid #38bdf8',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                Local Document Ingestion & Vector Parsing (Native Offline RAG)
              </h3>
              <Badge variant="teal" size="sm">Active Subsystem</Badge>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              PDF, Markdown, and text documents are parsed and chunked locally in-memory. Zero document contents are ever transmitted to external servers.
            </p>
          </div>
        </div>
        <Badge variant="neutral" size="sm">Local Only</Badge>
      </div>

      {/* Upload Dropzone Preview & Ingestion Input */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          border: '2px dashed rgba(56, 189, 248, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '12px',
          backgroundColor: 'rgba(11, 19, 41, 0.5)',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
          }}
        >
          <UploadCloud size={24} />
        </div>
        <div>
          <h4 style={{ fontSize: '15px', color: '#f8fafc', margin: '0 0 4px 0' }}>
            Drop local documents here or index workspace files
          </h4>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
            Supports PDF, Markdown, JSON, Code, and TXT files. Indexed locally on disk with zero cloud egress.
          </p>
        </div>

        {/* Quick Workspace Ingestion Shortcuts */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { label: 'Index Roadmap Spec', path: 'docs/PRODUCT_ROADMAP.md' },
            { label: 'Index Architecture Spec', path: 'docs/ARCHITECTURE.md' },
            { label: 'Index Security Policy', path: 'docs/SECURITY.md' },
            { label: 'Index Readme Guide', path: 'README.md' },
          ].map(item => (
            <Button
              key={item.path}
              variant="outline"
              size="sm"
              icon={<FolderOpen size={13} />}
              onClick={() => void handleIngestPath(item.path)}
              loading={isIngesting}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '500px', marginTop: '6px' }}>
          <Input
            placeholder="Or enter path: e.g. docs/SECURITY.md"
            value={filePathInput}
            onChange={e => setFilePathInput(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => void handleIngestPath()}
            loading={isIngesting}
            disabled={!filePathInput.trim()}
          >
            Index File
          </Button>
        </div>

        {statusMessage && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: statusMessage.isError ? 'rgba(244, 63, 94, 0.1)' : 'rgba(45, 212, 191, 0.1)',
              color: statusMessage.isError ? '#fca5a5' : '#86efac',
              border: `1px solid ${statusMessage.isError ? 'rgba(244, 63, 94, 0.3)' : 'rgba(45, 212, 191, 0.3)'}`,
            }}
          >
            {statusMessage.isError ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
            {statusMessage.text}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <Badge variant="teal" size="sm" dot>
            Zero Cloud Upload
          </Badge>
          <Badge variant="neutral" size="sm">
            Max 10MB per file
          </Badge>
        </div>
      </div>

      {/* Document Library Table */}
      <Card
        title="Indexed Document Library"
        subtitle="Active and indexed resources available for local RAG knowledge grounding"
        action={
          <div style={{ width: '220px' }}>
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={<Search size={14} />}
            />
          </div>
        }
      >
        <div style={{ overflowX: 'auto', marginTop: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px' }}>Document Name</th>
                <th style={{ padding: '10px 12px' }}>Type</th>
                <th style={{ padding: '10px 12px' }}>File Size</th>
                <th style={{ padding: '10px 12px' }}>Indexed Chunks</th>
                <th style={{ padding: '10px 12px' }}>Security Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <FileText size={28} color="#64748b" />
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#f8fafc' }}>
                        No documents currently indexed in local vector store
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '440px' }}>
                        Enter a file path above or click a quick suggestion to index local workspace documentation for RAG grounding:
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Button variant="outline" size="sm" onClick={() => void handleIngestPath('docs/ARCHITECTURE.md')}>
                          + Index docs/ARCHITECTURE.md
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handleIngestPath('docs/SECURITY.md')}>
                          + Index docs/SECURITY.md
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void handleIngestPath('README.md')}>
                          + Index README.md
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDocs.map(doc => (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px', color: '#f8fafc', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={15} color="#38bdf8" />
                      <span>{doc.name}</span>
                    </td>
                    <td style={{ padding: '12px', color: '#94a3b8' }}>{doc.type}</td>
                    <td style={{ padding: '12px', color: '#94a3b8', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{doc.size}</td>
                    <td style={{ padding: '12px', color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{doc.chunks} chunks</td>
                    <td style={{ padding: '12px' }}>
                      <Badge variant="teal" size="sm">
                        Local Only
                      </Badge>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<RefreshCw size={12} />}
                          onClick={() => void handleReindex(doc.id)}
                          title="Reindex document"
                        >
                          Reindex
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={12} color="#f43f5e" />}
                          onClick={() => void handleRemoveDoc(doc.id)}
                          title="Delete from index"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
