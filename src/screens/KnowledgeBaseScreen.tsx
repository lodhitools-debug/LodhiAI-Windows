import React, { useState } from 'react';
import { Database, HardDrive, Cpu, Search, Sparkles, BookOpen, Quote } from 'lucide-react';
import { RoadmapBanner } from '../components/common/RoadmapBanner';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { searchKnowledgeBase, getRagContext, listDocuments } from '../services/tauri';
import { SearchResult, DocumentMeta } from '../types';


export const KnowledgeBaseScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [ragContextPreview, setRagContextPreview] = useState<string | null>(null);
  const [realDocs, setRealDocs] = useState<DocumentMeta[]>([]);

  React.useEffect(() => {
    void (async () => {
      try {
        const docs = await listDocuments();
        setRealDocs(docs || []);
      } catch {
        // web sandbox
      }
    })();
  }, []);

  const totalChunks = realDocs.reduce((acc, d) => acc + d.chunk_count, 0);

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const results = await searchKnowledgeBase(q, 5);
      setSearchResults(results);

      const ctx = await getRagContext(q, 300);
      setRagContextPreview(ctx);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Roadmap Banner */}
      <RoadmapBanner
        phase="Phase 3 Roadmap"
        featureName="Local Vector Knowledge Base (RAG)"
        description="The Knowledge Base manages vector embeddings stored in an ultra-compact embedded SQLite-vec database. Semantic search and RAG retrieval run natively on Windows with low CPU and memory overhead, tailored specifically for 8 GB RAM target machines."
        upcomingDeliverables={[
          'Phase 3: Embedded SQLite-vec native extension integration',
          'Phase 3: Fast BM25 keyword and dense vector cosine ranking',
          'Phase 3: Semantic hybrid search (BM25 keyword + cosine vector)',
          'Phase 3: Context-augmented prompt injector for Chat and Coding Assistant',
        ]}
      />

      {/* RAG Engine Specs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <Card title="Vector Storage Engine" subtitle="Local embedded database" action={<Database size={18} color="#38bdf8" />}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', marginTop: '6px' }}>
            SQLite-vec
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Single-file zero-configuration database. No background daemon required.
          </p>
        </Card>

        <Card title="Embedding Runtime" subtitle="Local ONNX / Ollama" action={<Cpu size={18} color="#818cf8" />}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#818cf8', marginTop: '6px' }}>
            nomic-embed-text
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Fast 768-dim embeddings running directly on CPU without cloud latency.
          </p>
        </Card>

        <Card title="Memory Budget" subtitle="8 GB RAM Allocation" action={<HardDrive size={18} color="#2dd4bf" />}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#2dd4bf', marginTop: '6px' }}>
            &lt; 250 MB
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Extremely lightweight footprint engineered for Windows multitasking.
          </p>
        </Card>
      </div>

      {/* Semantic Search & RAG Citation Explorer */}
      <Card
        title="Knowledge Base Semantic Search & Retrieval"
        subtitle="Test BM25 ranking, excerpt retrieval, and ground-truth source citations against indexed documents."
      >
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <div style={{ flex: 1 }}>
            <Input
              placeholder="e.g. Windows DPAPI secret protection or local streaming..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleSearch();
              }}
              icon={<Search size={15} />}
            />
          </div>
          <Button
            icon={<Sparkles size={15} />}
            onClick={() => void handleSearch()}
            loading={isSearching}
            disabled={!searchQuery.trim()}
          >
            Search Index
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h5 style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>
              Top Retrieval Results ({searchResults.length} excerpts matched):
            </h5>
            {searchResults.map((r, idx) => (
              <div
                key={r.chunk_id || idx}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Quote size={13} />
                    {r.citation}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                    Score: {r.score.toFixed(3)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {r.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {ragContextPreview && (
          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(7, 11, 20, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={14} /> Grounded Chat Prompt Injection Preview:
            </div>
            <pre style={{ margin: 0, fontSize: '11px', color: '#cbd5e1', whiteSpace: 'pre-wrap', maxHeight: '140px', overflowY: 'auto' }}>
              {ragContextPreview}
            </pre>
          </div>
        )}
      </Card>

      {/* Collections Grid */}
      <Card
        title="Knowledge Collections & Vector Vaults"
        subtitle="Logical vector vaults indexed for contextual assistance"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '8px' }}>
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '14px', color: '#f8fafc' }}>Active Workspace Vector Store</strong>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                {totalChunks} vectors ({realDocs.length} files)
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
              Locally persisted in %APPDATA%\com.lodhiai.desktop\lodhi_rag_store.json. Chunks are generated on-device with zero network latency.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              <span>Engine: Pure-Rust Lexical & BM25</span>
              <span>Footprint: &lt; 25 MB</span>
            </div>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '14px', color: '#f8fafc' }}>Core Platform Architecture Vault</strong>
              <span style={{ fontSize: '11px', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>
                Reference Specification
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
              Design guidelines, security sandbox rules, and commercial roadmap documentation from docs/ directory.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              <span>Format: Markdown & RFC Specs</span>
              <span>Status: Ready to Index</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
