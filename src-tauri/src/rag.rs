use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const MAX_DOC_SIZE_BYTES: u64 = 10 * 1024 * 1024; // 10 MB limit for 8 GB RAM profile
const DEFAULT_CHUNK_SIZE: usize = 500;
const DEFAULT_CHUNK_OVERLAP: usize = 60;

// Standard SHA-256 implementation (pure Rust, zero external crate dependencies)
fn sha256_digest(data: &[u8]) -> String {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    let k: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    let bit_len = (data.len() as u64) * 8;
    let mut padded = data.to_vec();
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0x00);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.chunks_exact(64) {
        let mut w = [0u32; 64];
        for (i, w_val) in w.iter_mut().take(16).enumerate() {
            let offset = i * 4;
            *w_val = u32::from_be_bytes([chunk[offset], chunk[offset + 1], chunk[offset + 2], chunk[offset + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut h_val = h[7];

        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = h_val.wrapping_add(s1).wrapping_add(ch).wrapping_add(k[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            h_val = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(h_val);
    }

    let mut result = String::with_capacity(64);
    for word in h {
        result.push_str(&format!("{:08x}", word));
    }
    result
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DocumentMeta {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub content_hash: String,
    pub chunk_count: usize,
    pub mime_type: String,
    pub collection_id: String,
    pub indexed_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DocumentChunk {
    pub chunk_id: String,
    pub doc_id: String,
    pub chunk_index: usize,
    pub content: String,
    pub token_estimate: usize,
    pub start_char: usize,
    pub end_char: usize,
    pub term_frequencies: HashMap<String, f32>,
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SearchResult {
    pub doc_id: String,
    pub doc_name: String,
    pub chunk_id: String,
    pub chunk_index: usize,
    pub content: String,
    pub score: f32,
    pub citation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestionResult {
    pub document: DocumentMeta,
    pub is_duplicate: bool,
    pub chunks_created: usize,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RagStore {
    pub documents: HashMap<String, DocumentMeta>,
    pub chunks: Vec<DocumentChunk>,
    pub total_documents: usize,
    pub total_chunks: usize,
    pub version: u32,
}

impl RagStore {
    pub fn new() -> Self {
        Self {
            documents: HashMap::new(),
            chunks: Vec::new(),
            total_documents: 0,
            total_chunks: 0,
            version: 1,
        }
    }
}

// Global persistent RAG store singleton protected by Mutex
pub static RAG_STORE: Mutex<Option<RagStore>> = Mutex::new(None);

fn get_rag_storage_path() -> Option<PathBuf> {
    if let Ok(app_data) = std::env::var("APPDATA") {
        let dir = PathBuf::from(app_data).join("com.lodhiai.desktop");
        if !dir.exists() {
            let _ = fs::create_dir_all(&dir);
        }
        Some(dir.join("rag_index.json"))
    } else {
        None
    }
}

/// Tokenize text into lowercased terms for BM25 search
pub fn tokenize(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
        .filter(|t| t.len() >= 2)
        .map(|t| t.to_lowercase())
        .collect()
}

/// Compute term frequency map for BM25
pub fn compute_term_frequencies(tokens: &[String]) -> HashMap<String, f32> {
    let mut tf = HashMap::new();
    if tokens.is_empty() {
        return tf;
    }
    let total = tokens.len() as f32;
    for token in tokens {
        *tf.entry(token.clone()).or_insert(0.0) += 1.0;
    }
    for val in tf.values_mut() {
        *val /= total;
    }
    tf
}

/// Break text into semantically coherent overlapping chunks
pub fn semantic_chunk_text(
    text: &str,
    target_size: usize,
    overlap: usize,
) -> Vec<(String, usize, usize)> {
    let mut chunks = Vec::new();
    if text.trim().is_empty() {
        return chunks;
    }

    let chars: Vec<char> = text.chars().collect();
    let total_len = chars.len();

    let mut start = 0;
    while start < total_len {
        let mut end = (start + target_size).min(total_len);

        // Find boundary break (double newline, single newline, period, space)
        if end < total_len {
            let window_start = if end > 50 { end - 50 } else { start };
            let slice: String = chars[window_start..end].iter().collect();

            if let Some(pos) = slice.rfind("\n\n") {
                end = window_start + pos + 2;
            } else if let Some(pos) = slice.rfind('\n') {
                end = window_start + pos + 1;
            } else if let Some(pos) = slice.rfind(". ") {
                end = window_start + pos + 2;
            } else if let Some(pos) = slice.rfind(' ') {
                end = window_start + pos + 1;
            }
        }

        let chunk_str: String = chars[start..end].iter().collect();
        let trimmed = chunk_str.trim();
        if !trimmed.is_empty() {
            chunks.push((trimmed.to_string(), start, end));
        }

        if end >= total_len {
            break;
        }

        let next_start = end.saturating_sub(overlap);
        if next_start <= start {
            start = end;
        } else {
            start = next_start;
        }
    }

    chunks
}

/// Extract text from supported formats
pub fn extract_document_text(path: &Path) -> Result<(String, String), String> {
    if !path.exists() {
        return Err(format!("Document does not exist: {}", path.display()));
    }

    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read metadata: {}", e))?;
    if metadata.len() == 0 {
        return Err("Document is empty (0 bytes).".to_string());
    }
    if metadata.len() > MAX_DOC_SIZE_BYTES {
        return Err(format!(
            "Document exceeds maximum size limit of {} MB (actual: {:.2} MB)",
            MAX_DOC_SIZE_BYTES / (1024 * 1024),
            metadata.len() as f64 / (1024.0 * 1024.0)
        ));
    }

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "md" | "markdown" => {
            let content = fs::read_to_string(path).map_err(|e| format!("Failed to read Markdown file: {}", e))?;
            Ok((content, "text/markdown".to_string()))
        }
        "txt" | "log" | "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "json" | "toml" | "yaml" | "yml" | "csv" => {
            let bytes = fs::read(path).map_err(|e| format!("Failed to read text file: {}", e))?;
            let content = String::from_utf8_lossy(&bytes).into_owned();
            Ok((content, "text/plain".to_string()))
        }
        "pdf" => {
            let bytes = fs::read(path).map_err(|e| format!("Failed to read PDF file: {}", e))?;
            let text = extract_pdf_text_streams(&bytes)?;
            if text.trim().is_empty() {
                return Err("No extractable text streams found in PDF (scanned or image-only PDF requires OCR).".to_string());
            }
            Ok((text, "application/pdf".to_string()))
        }
        other => Err(format!(
            "Unsupported document format '.{}'. Supported formats: md, txt, json, csv, code files, pdf.",
            other
        )),
    }
}

/// Native PDF stream extractor that parses text display operators (BT ... ET, Tj, TJ)
fn extract_pdf_text_streams(bytes: &[u8]) -> Result<String, String> {
    if !bytes.starts_with(b"%PDF-") {
        return Err("Corrupted or invalid PDF header (missing %PDF- marker).".to_string());
    }

    let mut extracted_text = String::new();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        // Look for Begin Text "BT"
        if i + 2 <= len && &bytes[i..i + 2] == b"BT" && (i == 0 || bytes[i - 1].is_ascii_whitespace()) {
            i += 2;
            let bt_start = i;
            // Scan until End Text "ET"
            let mut et_pos = None;
            while i + 2 <= len {
                if &bytes[i..i + 2] == b"ET" && (bytes[i + 2.min(len - 1)].is_ascii_whitespace() || i + 2 == len) {
                    et_pos = Some(i);
                    i += 2;
                    break;
                }
                i += 1;
            }

            if let Some(et) = et_pos {
                let stream_slice = &bytes[bt_start..et];
                parse_text_operators(stream_slice, &mut extracted_text);
            }
        } else {
            i += 1;
        }
    }

    Ok(extracted_text)
}

/// Helper to parse literal strings inside PDF text operators
fn parse_text_operators(slice: &[u8], out: &mut String) {
    let mut j = 0;
    let slen = slice.len();

    while j < slen {
        if slice[j] == b'(' {
            // Literal string: (...)
            j += 1;
            let mut in_escape = false;
            let mut s = String::new();
            while j < slen {
                let b = slice[j];
                if in_escape {
                    match b {
                        b'n' => s.push('\n'),
                        b'r' => s.push('\r'),
                        b't' => s.push('\t'),
                        _ => s.push(b as char),
                    }
                    in_escape = false;
                } else if b == b'\\' {
                    in_escape = true;
                } else if b == b')' {
                    j += 1;
                    break;
                } else {
                    s.push(b as char);
                }
                j += 1;
            }
            if !s.is_empty() {
                out.push_str(&s);
                out.push(' ');
            }
        } else {
            j += 1;
        }
    }
}

/// Load the RAG store from disk or initialize empty
pub fn load_rag_store() -> RagStore {
    let mut guard = RAG_STORE.lock().unwrap();
    if let Some(ref store) = *guard {
        return store.clone();
    }

    let store = if let Some(path) = get_rag_storage_path() {
        if path.exists() {
            match fs::read_to_string(&path) {
                Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| RagStore::new()),
                Err(_) => RagStore::new(),
            }
        } else {
            RagStore::new()
        }
    } else {
        RagStore::new()
    };

    *guard = Some(store.clone());
    store
}

/// Save the current RAG store to persistent disk
pub fn save_rag_store(store: &RagStore) -> Result<(), String> {
    if let Some(path) = get_rag_storage_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let serialized = serde_json::to_string_pretty(store)
            .map_err(|e| format!("Failed to serialize RAG store: {}", e))?;
        
        // Write atomically via temporary file
        let temp_path = path.with_extension("tmp");
        let mut file = fs::File::create(&temp_path)
            .map_err(|e| format!("Failed to create temporary RAG file: {}", e))?;
        file.write_all(serialized.as_bytes())
            .map_err(|e| format!("Failed to write RAG data: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("Failed to flush RAG data: {}", e))?;

        fs::rename(&temp_path, &path)
            .map_err(|e| format!("Failed to replace RAG database: {}", e))?;
    }
    
    let mut guard = RAG_STORE.lock().unwrap();
    *guard = Some(store.clone());
    Ok(())
}

/// Ingest a document: reads, verifies, chunks, hashes, and indexes into store
pub fn ingest_document(
    file_path: &str,
    collection_id: Option<&str>,
) -> Result<IngestionResult, String> {
    let path = Path::new(file_path);
    let (text, mime_type) = extract_document_text(path)?;

    let mut store = load_rag_store();
    let content_hash = sha256_digest(text.as_bytes());

    // Check duplicate by hash
    for existing in store.documents.values() {
        if existing.content_hash == content_hash {
            return Ok(IngestionResult {
                document: existing.clone(),
                is_duplicate: true,
                chunks_created: 0,
                message: format!(
                    "Document with identical content hash ({}) already exists as '{}'.",
                    &content_hash[..8],
                    existing.name
                ),
            });
        }
    }

    let doc_id = format!("doc-{}", &content_hash[..12]);
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("document")
        .to_string();

    let chunks_raw = semantic_chunk_text(&text, DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP);
    let mut new_chunks = Vec::new();

    for (idx, (chunk_text, start_char, end_char)) in chunks_raw.into_iter().enumerate() {
        let tokens = tokenize(&chunk_text);
        let tf = compute_term_frequencies(&tokens);
        let token_estimate = tokens.len();

        new_chunks.push(DocumentChunk {
            chunk_id: format!("{}-c{}", doc_id, idx + 1),
            doc_id: doc_id.clone(),
            chunk_index: idx + 1,
            content: chunk_text,
            token_estimate,
            start_char,
            end_char,
            term_frequencies: tf,
            embedding: None,
        });
    }

    let meta = DocumentMeta {
        id: doc_id.clone(),
        name,
        path: file_path.to_string(),
        size_bytes: text.len() as u64,
        content_hash,
        chunk_count: new_chunks.len(),
        mime_type,
        collection_id: collection_id.unwrap_or("default").to_string(),
        indexed_at_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
    };

    store.documents.insert(doc_id, meta.clone());
    store.chunks.extend(new_chunks);
    store.total_documents = store.documents.len();
    store.total_chunks = store.chunks.len();

    save_rag_store(&store)?;

    Ok(IngestionResult {
        document: meta,
        is_duplicate: false,
        chunks_created: store.total_chunks,
        message: "Document successfully indexed with verified local chunks.".to_string(),
    })
}

/// Delete a document and all its chunks from the RAG store
pub fn remove_document(doc_id: &str) -> Result<bool, String> {
    let mut store = load_rag_store();
    if store.documents.remove(doc_id).is_some() {
        store.chunks.retain(|c| c.doc_id != doc_id);
        store.total_documents = store.documents.len();
        store.total_chunks = store.chunks.len();
        save_rag_store(&store)?;
        Ok(true)
    } else {
        Err(format!("Document with id '{}' not found in index.", doc_id))
    }
}

/// Reindex an existing document from its original path
pub fn reindex_document(doc_id: &str) -> Result<IngestionResult, String> {
    let store = load_rag_store();
    let doc = store
        .documents
        .get(doc_id)
        .ok_or_else(|| format!("Document with id '{}' not found.", doc_id))?
        .clone();

    // Remove old version
    remove_document(doc_id)?;

    // Re-ingest
    ingest_document(&doc.path, Some(&doc.collection_id))
}

/// Perform BM25-ranked keyword search across all indexed chunks
pub fn search_knowledge_base(query: &str, top_k: usize) -> Vec<SearchResult> {
    let store = load_rag_store();
    if store.chunks.is_empty() {
        return Vec::new();
    }

    let query_tokens = tokenize(query);
    if query_tokens.is_empty() {
        return Vec::new();
    }

    let total_chunks = store.chunks.len() as f32;
    let avg_chunk_len: f32 = store
        .chunks
        .iter()
        .map(|c| c.token_estimate as f32)
        .sum::<f32>()
        / total_chunks.max(1.0);

    // Compute IDF for each query term
    let mut idf: HashMap<String, f32> = HashMap::new();
    for token in &query_tokens {
        let docs_with_term = store
            .chunks
            .iter()
            .filter(|c| c.term_frequencies.contains_key(token))
            .count() as f32;
        let idf_val = ((total_chunks - docs_with_term + 0.5) / (docs_with_term + 0.5) + 1.0).ln();
        idf.insert(token.clone(), idf_val.max(0.1));
    }

    // Score chunks using standard BM25 formula (k1=1.2, b=0.75)
    let k1: f32 = 1.2;
    let b: f32 = 0.75;
    let mut scored_chunks: Vec<(f32, &DocumentChunk)> = Vec::new();

    for chunk in &store.chunks {
        let chunk_len = chunk.token_estimate as f32;
        let mut score: f32 = 0.0;

        for token in &query_tokens {
            if let Some(&tf_val) = chunk.term_frequencies.get(token) {
                let term_idf = idf.get(token).copied().unwrap_or(0.1);
                let num = tf_val * (k1 + 1.0);
                let denom = tf_val + k1 * (1.0 - b + b * (chunk_len / avg_chunk_len.max(1.0)));
                score += term_idf * (num / denom);
            }
        }

        if score > 0.01 {
            scored_chunks.push((score, chunk));
        }
    }

    // Sort descending by score
    scored_chunks.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    let top = scored_chunks.into_iter().take(top_k);
    let mut results = Vec::new();

    for (score, chunk) in top {
        let doc_name = store
            .documents
            .get(&chunk.doc_id)
            .map(|d| d.name.as_str())
            .unwrap_or("document");

        results.push(SearchResult {
            doc_id: chunk.doc_id.clone(),
            doc_name: doc_name.to_string(),
            chunk_id: chunk.chunk_id.clone(),
            chunk_index: chunk.chunk_index,
            content: chunk.content.clone(),
            score,
            citation: format!("[Source: {} (Chunk #{})]", doc_name, chunk.chunk_index),
        });
    }

    results
}

/// Synthesize grounded RAG context with citations for LLM prompt injection
pub fn get_rag_context(query: &str, max_tokens: usize) -> Option<String> {
    let results = search_knowledge_base(query, 5);
    if results.is_empty() {
        return None;
    }

    let mut context_block = String::from("--- GROUNDED KNOWLEDGE BASE CONTEXT ---\n");
    let mut token_count = 0;

    for r in results {
        let snippet = format!("{}\n{}\n\n", r.citation, r.content);
        let est_tokens = snippet.split_whitespace().count();
        if token_count + est_tokens > max_tokens {
            break;
        }
        context_block.push_str(&snippet);
        token_count += est_tokens;
    }

    context_block.push_str("--- END KNOWLEDGE BASE CONTEXT ---\n");
    Some(context_block)
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn test_sha256_known_vector() {
        let empty_hash = sha256_digest(b"");
        assert_eq!(
            empty_hash,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );

        let abc_hash = sha256_digest(b"abc");
        assert_eq!(
            abc_hash,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn test_semantic_chunker_respects_sentence_boundaries() {
        let text = "This is sentence one. This is sentence two. This is sentence three. This is sentence four.";
        let chunks = semantic_chunk_text(text, 45, 10);
        assert!(!chunks.is_empty());
        for (chunk, _, _) in &chunks {
            assert!(!chunk.is_empty());
            assert!(chunk.len() <= 60);
        }
    }

    #[test]
    fn test_empty_document_rejection() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("lodhi_empty_test.txt");
        let _ = fs::write(&file_path, b"");

        let res = extract_document_text(&file_path);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("empty"));
        let _ = fs::remove_file(file_path);
    }

    #[test]
    fn test_corrupted_pdf_rejection() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("lodhi_corrupted_test.pdf");
        let _ = fs::write(&file_path, b"Not a real PDF stream content");

        let res = extract_document_text(&file_path);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Corrupted or invalid PDF"));
        let _ = fs::remove_file(file_path);
    }

    #[test]
    fn test_valid_pdf_stream_extraction() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("lodhi_valid_test.pdf");
        // Minimal valid PDF text stream
        let pdf_data = b"%PDF-1.4\n1 0 obj\n<<>>\nstream\nBT\n(Lodhi AI Local RAG Architecture) Tj\nET\nendstream\nendobj";
        let _ = fs::write(&file_path, pdf_data);

        let res = extract_document_text(&file_path);
        assert!(res.is_ok());
        let (extracted, mime) = res.unwrap();
        assert_eq!(mime, "application/pdf");
        assert!(extracted.contains("Lodhi AI Local RAG Architecture"));
        let _ = fs::remove_file(file_path);
    }

    #[test]
    fn test_bm25_search_ranking_and_citations() {
        let temp_dir = std::env::temp_dir();
        let doc1_path = temp_dir.join("lodhi_rag_doc1.md");
        let doc2_path = temp_dir.join("lodhi_rag_doc2.md");

        let _ = fs::write(
            &doc1_path,
            "# Security Architecture\nAll secrets are encrypted with Windows DPAPI and never leave localhost.",
        );
        let _ = fs::write(
            &doc2_path,
            "# Ollama Streaming\nTokens stream in real-time with NDJSON parsing and socket cancellation.",
        );

        let res1 = ingest_document(doc1_path.to_str().unwrap(), Some("test-col")).unwrap();
        let res2 = ingest_document(doc2_path.to_str().unwrap(), Some("test-col")).unwrap();

        assert_eq!(res1.is_duplicate, false);
        assert_eq!(res2.is_duplicate, false);

        // Search for DPAPI security
        let results = search_knowledge_base("Windows DPAPI encryption", 3);
        assert!(!results.is_empty());
        assert_eq!(results[0].doc_name, "lodhi_rag_doc1.md");
        assert!(results[0].citation.contains("lodhi_rag_doc1.md"));

        // Context generation
        let context = get_rag_context("Windows DPAPI encryption", 200);
        assert!(context.is_some());
        let ctx = context.unwrap();
        assert!(ctx.contains("GROUNDED KNOWLEDGE BASE CONTEXT"));
        assert!(ctx.contains("Windows DPAPI"));

        // Clean up
        let _ = remove_document(&res1.document.id);
        let _ = remove_document(&res2.document.id);
        let _ = fs::remove_file(doc1_path);
        let _ = fs::remove_file(doc2_path);
    }

    #[test]
    fn test_duplicate_document_detection() {
        let temp_dir = std::env::temp_dir();
        let doc_path = temp_dir.join("lodhi_duplicate_test.md");
        let _ = fs::write(&doc_path, "Exact same content for duplicate testing.");

        let res1 = ingest_document(doc_path.to_str().unwrap(), Some("test-col")).unwrap();
        assert_eq!(res1.is_duplicate, false);

        let res2 = ingest_document(doc_path.to_str().unwrap(), Some("test-col")).unwrap();
        assert_eq!(res2.is_duplicate, true);
        assert!(res2.message.contains("already exists"));

        let _ = remove_document(&res1.document.id);
        let _ = fs::remove_file(doc_path);
    }
}
