use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{IpAddr, SocketAddr, TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_RESPONSE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_MESSAGES: usize = 40;
const MAX_MESSAGE_CHARS: usize = 32_000;

static ACTIVE_STREAMS: std::sync::LazyLock<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn register_active_stream(request_id: &str) -> Arc<AtomicBool> {
    let token = Arc::new(AtomicBool::new(false));
    let mut map = ACTIVE_STREAMS.lock().unwrap();
    map.insert(request_id.to_string(), Arc::clone(&token));
    token
}

pub fn unregister_active_stream(request_id: &str) {
    let mut map = ACTIVE_STREAMS.lock().unwrap();
    map.remove(request_id);
}

pub fn abort_stream(request_id: &str) -> bool {
    let map = ACTIVE_STREAMS.lock().unwrap();
    if let Some(token) = map.get(request_id) {
        token.store(true, Ordering::SeqCst);
        true
    } else {
        false
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatTurn {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OllamaChatResponse {
    pub model: String,
    pub content: String,
    pub timings: OllamaChatTimings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OllamaChatTimings {
    pub handler_elapsed_ms: u64,
    pub http_elapsed_ms: u64,
    pub ollama_total_ms: Option<u64>,
    pub model_load_ms: Option<u64>,
    pub prompt_eval_ms: Option<u64>,
    pub generation_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OllamaStreamEvent {
    pub request_id: String,
    pub chunk: String,
    pub done: bool,
    pub model: Option<String>,
    pub timings: Option<OllamaChatTimings>,
    pub eval_count: Option<u64>,
    pub eval_duration_ns: Option<u64>,
    pub prompt_eval_count: Option<u64>,
    pub prompt_eval_duration_ns: Option<u64>,
    pub total_duration_ns: Option<u64>,
    pub cancelled: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct OllamaOptions {
    pub num_predict: Option<u32>,
    pub num_ctx: Option<u32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub keep_alive: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LocalEndpoint {
    host: String,
    port: u16,
    address: SocketAddr,
}

impl LocalEndpoint {
    fn parse(value: &str) -> Result<Self, String> {
        let value = value.trim();
        let authority = value
            .strip_prefix("http://")
            .ok_or_else(|| "Ollama endpoint must use http:// on localhost.".to_string())?;
        if authority.contains('/')
            || authority.contains('?')
            || authority.contains('#')
            || authority.contains('@')
        {
            return Err("Ollama endpoint must contain only a local host and optional port.".into());
        }

        let (host, port) = if let Some(bracketed) = authority.strip_prefix('[') {
            let (ip, rest) = bracketed
                .split_once(']')
                .ok_or_else(|| "Ollama endpoint has an invalid IPv6 address.".to_string())?;
            let ip: IpAddr = ip
                .parse()
                .map_err(|_| "Ollama endpoint has an invalid IPv6 address.".to_string())?;
            if !ip.is_loopback() || !matches!(ip, IpAddr::V6(_)) {
                return Err(
                    "Ollama endpoint must resolve to this PC (localhost or a loopback IP).".into(),
                );
            }
            let port = if rest.is_empty() {
                11434
            } else {
                rest.strip_prefix(':')
                    .ok_or_else(|| "Ollama endpoint has an invalid port.".to_string())?
                    .parse::<u16>()
                    .map_err(|_| "Ollama endpoint has an invalid port.".to_string())?
            };
            (ip.to_string(), port)
        } else {
            let (host, port) = match authority.rsplit_once(':') {
                Some((host, port)) if !host.contains(':') => (
                    host,
                    port.parse::<u16>()
                        .map_err(|_| "Ollama endpoint has an invalid port.".to_string())?,
                ),
                Some(_) => return Err("Use brackets around an IPv6 loopback address.".into()),
                None => (authority, 11434),
            };
            let ip = host.parse::<IpAddr>().ok();
            if !host.eq_ignore_ascii_case("localhost") && !ip.is_some_and(|ip| ip.is_loopback()) {
                return Err(
                    "Ollama endpoint must resolve to this PC (localhost or a loopback IP).".into(),
                );
            }
            (host.to_string(), port)
        };

        if port == 0 {
            return Err("Ollama endpoint port must be between 1 and 65535.".into());
        }
        let addresses = (host.as_str(), port)
            .to_socket_addrs()
            .map_err(|_| "Could not resolve the local Ollama endpoint.".to_string())?;
        let resolved = addresses
            .filter(|address| address.ip().is_loopback())
            .collect::<Vec<_>>();
        let address = resolved
            .iter()
            .find(|address| address.is_ipv4())
            .copied()
            .or_else(|| resolved.first().copied())
            .ok_or_else(|| "Ollama endpoint did not resolve to a loopback address.".to_string())?;

        Ok(Self {
            host,
            port,
            address,
        })
    }
}

fn request(
    endpoint: &LocalEndpoint,
    method: &str,
    path: &str,
    body: Option<&[u8]>,
) -> Result<Vec<u8>, String> {
    let mut stream =
        TcpStream::connect_timeout(&endpoint.address, CONNECT_TIMEOUT).map_err(|error| {
            if error.kind() == std::io::ErrorKind::TimedOut {
                "Timed out connecting to Ollama. Check that the local server is running."
                    .to_string()
            } else if matches!(
                error.kind(),
                std::io::ErrorKind::ConnectionRefused | std::io::ErrorKind::NotFound
            ) {
                "Ollama is not running at the configured local address. Start Ollama and try again."
                    .to_string()
            } else {
                format!("Could not connect to the local Ollama server: {error}")
            }
        })?;
    stream
        .set_read_timeout(Some(REQUEST_TIMEOUT))
        .map_err(|_| "Could not configure the Ollama response timeout.".to_string())?;
    stream
        .set_write_timeout(Some(CONNECT_TIMEOUT))
        .map_err(|_| "Could not configure the Ollama connection timeout.".to_string())?;

    let body = body.unwrap_or_default();
    let host_header = if endpoint.host.contains(':') {
        format!("[{}]:{}", endpoint.host, endpoint.port)
    } else {
        format!("{}:{}", endpoint.host, endpoint.port)
    };
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {host_header}\r\nConnection: close\r\nAccept: application/json\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n",
        body.len()
    );
    stream
        .write_all(request.as_bytes())
        .and_then(|_| stream.write_all(body))
        .map_err(|error| format!("Could not send the request to Ollama: {error}"))?;

    let mut response = Vec::new();
    stream
        .take(MAX_RESPONSE_BYTES + 1)
        .read_to_end(&mut response)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::TimedOut {
                "Ollama took too long to respond. Try again or use a smaller model.".to_string()
            } else {
                format!("Could not read the Ollama response: {error}")
            }
        })?;
    if response.len() as u64 > MAX_RESPONSE_BYTES {
        return Err("Ollama response was larger than the 16 MB safety limit.".into());
    }

    let header_end = response
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .ok_or_else(|| "Ollama returned a malformed HTTP response.".to_string())?;
    if header_end > 16 * 1024 {
        return Err("Ollama returned oversized HTTP headers.".into());
    }
    let headers = std::str::from_utf8(&response[..header_end])
        .map_err(|_| "Ollama returned malformed HTTP headers.".to_string())?;
    let status = headers
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .ok_or_else(|| "Ollama returned malformed HTTP status.".to_string())?;
    let response_body = &response[header_end + 4..];
    let is_chunked = headers.lines().skip(1).any(|line| {
        line.split_once(':').is_some_and(|(name, value)| {
            name.eq_ignore_ascii_case("transfer-encoding")
                && value.to_lowercase().contains("chunked")
        })
    });
    let decoded_body;
    let response_body = if is_chunked {
        decoded_body = decode_chunked(response_body)?;
        decoded_body.as_slice()
    } else {
        response_body
    };
    if !(200..300).contains(&status) {
        let detail = serde_json::from_slice::<Value>(response_body)
            .ok()
            .and_then(|value| value.get("error")?.as_str().map(str::to_string));
        if let Some(detail) = detail {
            if detail.to_lowercase().contains("model")
                && detail.to_lowercase().contains("not found")
            {
                return Err(format!("Ollama model is not installed: {detail}. Check the model name in Model Providers and retry."));
            }
            return Err(format!("Ollama request failed: {detail}"));
        }
        return Err(format!(
            "Ollama returned HTTP {status}. Check the local server and model configuration."
        ));
    }
    Ok(response_body.to_vec())
}

fn decode_chunked(body: &[u8]) -> Result<Vec<u8>, String> {
    let mut cursor = 0;
    let mut decoded = Vec::new();
    loop {
        let line_end = body[cursor..]
            .windows(2)
            .position(|window| window == b"\r\n")
            .map(|offset| cursor + offset)
            .ok_or_else(|| "Ollama returned malformed chunked response data.".to_string())?;
        let size_line = std::str::from_utf8(&body[cursor..line_end])
            .map_err(|_| "Ollama returned malformed chunked response data.".to_string())?;
        let size =
            usize::from_str_radix(size_line.split(';').next().unwrap_or_default().trim(), 16)
                .map_err(|_| "Ollama returned malformed chunked response data.".to_string())?;
        cursor = line_end + 2;
        if size == 0 {
            return Ok(decoded);
        }
        let chunk_end = cursor
            .checked_add(size)
            .filter(|end| *end + 2 <= body.len())
            .ok_or_else(|| "Ollama returned an incomplete chunked response.".to_string())?;
        decoded.extend_from_slice(&body[cursor..chunk_end]);
        if decoded.len() as u64 > MAX_RESPONSE_BYTES {
            return Err("Ollama response was larger than the 16 MB safety limit.".into());
        }
        if &body[chunk_end..chunk_end + 2] != b"\r\n" {
            return Err("Ollama returned malformed chunked response data.".into());
        }
        cursor = chunk_end + 2;
    }
}

pub fn list_models(endpoint: &str) -> Result<Vec<String>, String> {
    let endpoint = LocalEndpoint::parse(endpoint)?;
    let body = request(&endpoint, "GET", "/api/tags", None)?;
    let response: Value = serde_json::from_slice(&body)
        .map_err(|_| "Ollama returned an unreadable model list.".to_string())?;
    let models = response
        .get("models")
        .and_then(Value::as_array)
        .ok_or_else(|| "Ollama returned an unexpected model list format.".to_string())?;
    let mut names = models
        .iter()
        .filter_map(|model| model.get("name")?.as_str().map(str::to_string))
        .collect::<Vec<_>>();
    names.sort();
    names.dedup();
    Ok(names)
}

pub fn chat(
    endpoint: &str,
    model: &str,
    messages: Vec<ChatTurn>,
) -> Result<OllamaChatResponse, String> {
    chat_with_options(endpoint, model, messages, None)
}

pub fn chat_with_options(
    endpoint: &str,
    model: &str,
    messages: Vec<ChatTurn>,
    options: Option<OllamaOptions>,
) -> Result<OllamaChatResponse, String> {
    let endpoint = LocalEndpoint::parse(endpoint)?;
    let model = model.trim();
    if model.is_empty() {
        return Err("Choose an installed Ollama model in Model Providers before chatting.".into());
    }
    if model.len() > 128 || model.chars().any(char::is_control) {
        return Err("The Ollama model name is invalid.".into());
    }
    if messages.is_empty() {
        return Err("Enter a message before sending it to Ollama.".into());
    }
    if messages.len() > MAX_MESSAGES {
        return Err("This conversation has too many turns for one request. Start a new conversation and try again.".into());
    }
    if messages.iter().any(|message| {
        !matches!(message.role.as_str(), "user" | "assistant")
            || message.content.trim().is_empty()
            || message.content.chars().count() > MAX_MESSAGE_CHARS
    }) {
        return Err("A chat message was empty, too long, or had an unsupported role.".into());
    }

    let body = build_chat_body(model, &messages, false, options.as_ref())?;
    let request_started = Instant::now();
    let body = request(&endpoint, "POST", "/api/chat", Some(&body))?;
    let http_elapsed_ms = request_started.elapsed().as_millis() as u64;
    let response: Value = serde_json::from_slice(&body)
        .map_err(|_| "Ollama returned malformed JSON instead of a chat response.".to_string())?;
    let content = response
        .get("message")
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .ok_or_else(|| "Ollama response did not include message content.".to_string())?
        .trim()
        .to_string();
    if content.is_empty() {
        return Err("Ollama returned an empty response. Try the prompt again.".into());
    }
    let response_model = response
        .get("model")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .unwrap_or(model)
        .to_string();
    let duration_ms = |field: &str| {
        response
            .get(field)
            .and_then(Value::as_u64)
            .map(|nanoseconds| nanoseconds / 1_000_000)
    };
    Ok(OllamaChatResponse {
        model: response_model,
        content,
        timings: OllamaChatTimings {
            handler_elapsed_ms: 0,
            http_elapsed_ms,
            ollama_total_ms: duration_ms("total_duration"),
            model_load_ms: duration_ms("load_duration"),
            prompt_eval_ms: duration_ms("prompt_eval_duration"),
            generation_ms: duration_ms("eval_duration"),
        },
    })
}

fn build_chat_body(
    model: &str,
    messages: &[ChatTurn],
    stream: bool,
    options: Option<&OllamaOptions>,
) -> Result<Vec<u8>, String> {
    let keep_alive = options
        .and_then(|o| o.keep_alive.as_deref())
        .unwrap_or("30m");
    let num_predict = options.and_then(|o| o.num_predict).unwrap_or(2048);
    let num_ctx = options.and_then(|o| o.num_ctx).unwrap_or(4096);
    let temperature = options.and_then(|o| o.temperature).unwrap_or(0.7);

    let mut options_json = json!({
        "num_predict": num_predict,
        "num_ctx": num_ctx,
        "temperature": temperature,
    });
    if let Some(top_p) = options.and_then(|o| o.top_p) {
        options_json["top_p"] = json!(top_p);
    }

    let payload = json!({
        "model": model,
        "messages": messages,
        "stream": stream,
        "keep_alive": keep_alive,
        "options": options_json
    });

    serde_json::to_vec(&payload)
        .map_err(|_| "Could not prepare the local Ollama request.".to_string())
}

pub fn prewarm_model(
    endpoint: &str,
    model: &str,
    keep_alive: Option<&str>,
) -> Result<bool, String> {
    let endpoint = LocalEndpoint::parse(endpoint)?;
    let model = model.trim();
    if model.is_empty() {
        return Err("Choose an installed Ollama model in Model Providers to pre-warm.".into());
    }
    let keep_alive_str = keep_alive.unwrap_or("30m");
    let payload = json!({
        "model": model,
        "keep_alive": keep_alive_str,
        "options": {
            "num_ctx": 4096
        }
    });
    let body = serde_json::to_vec(&payload)
        .map_err(|_| "Could not prepare the local Ollama prewarm request.".to_string())?;
    let _ = request(&endpoint, "POST", "/api/generate", Some(&body))?;
    Ok(true)
}

#[allow(dead_code)]
pub fn chat_stream<F>(
    endpoint: &str,
    model: &str,
    messages: Vec<ChatTurn>,
    request_id: &str,
    cancellation_token: Arc<AtomicBool>,
    on_chunk: F,
) -> Result<OllamaChatResponse, String>
where
    F: FnMut(OllamaStreamEvent) -> Result<(), String>,
{
    chat_stream_with_options(
        endpoint,
        model,
        messages,
        None,
        request_id,
        cancellation_token,
        on_chunk,
    )
}

pub fn chat_stream_with_options<F>(
    endpoint: &str,
    model: &str,
    messages: Vec<ChatTurn>,
    options: Option<OllamaOptions>,
    request_id: &str,
    cancellation_token: Arc<AtomicBool>,
    mut on_chunk: F,
) -> Result<OllamaChatResponse, String>
where
    F: FnMut(OllamaStreamEvent) -> Result<(), String>,
{
    let endpoint = LocalEndpoint::parse(endpoint)?;
    let model = model.trim();
    if model.is_empty() {
        return Err("Choose an installed Ollama model in Model Providers before chatting.".into());
    }
    if model.len() > 128 || model.chars().any(char::is_control) {
        return Err("The Ollama model name is invalid.".into());
    }
    if messages.is_empty() {
        return Err("Enter a message before sending it to Ollama.".into());
    }
    if messages.len() > MAX_MESSAGES {
        return Err("This conversation has too many turns for one request. Start a new conversation and try again.".into());
    }
    if messages.iter().any(|message| {
        !matches!(message.role.as_str(), "user" | "assistant")
            || message.content.trim().is_empty()
            || message.content.chars().count() > MAX_MESSAGE_CHARS
    }) {
        return Err("A chat message was empty, too long, or had an unsupported role.".into());
    }

    let body = build_chat_body(model, &messages, true, options.as_ref())?;

    let host_header = if endpoint.host.contains(':') {
        format!("[{}]:{}", endpoint.host, endpoint.port)
    } else {
        format!("{}:{}", endpoint.host, endpoint.port)
    };
    let request_header = format!(
        "POST /api/chat HTTP/1.1\r\nHost: {host_header}\r\nConnection: close\r\nAccept: application/x-ndjson\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n",
        body.len()
    );

    let mut stream =
        TcpStream::connect_timeout(&endpoint.address, CONNECT_TIMEOUT).map_err(|error| {
            if error.kind() == std::io::ErrorKind::TimedOut {
                "Timed out connecting to Ollama. Check that the local server is running.".to_string()
            } else if matches!(
                error.kind(),
                std::io::ErrorKind::ConnectionRefused | std::io::ErrorKind::NotFound
            ) {
                "Ollama is not running at the configured local address. Start Ollama and try again.".to_string()
            } else {
                format!("Could not connect to the local Ollama server: {error}")
            }
        })?;
    stream
        .set_read_timeout(Some(REQUEST_TIMEOUT))
        .map_err(|_| "Could not configure the Ollama response timeout.".to_string())?;
    stream
        .set_write_timeout(Some(CONNECT_TIMEOUT))
        .map_err(|_| "Could not configure the Ollama connection timeout.".to_string())?;

    let request_started = Instant::now();
    stream
        .write_all(request_header.as_bytes())
        .and_then(|_| stream.write_all(&body))
        .map_err(|error| format!("Could not send the request to Ollama: {error}"))?;

    let mut reader = BufReader::new(stream);

    // Read HTTP response status and headers
    let mut header_bytes = Vec::new();
    let mut is_chunked = false;
    let mut status_code: Option<u16> = None;

    loop {
        let mut line = String::new();
        let bytes = reader
            .read_line(&mut line)
            .map_err(|e| format!("Could not read HTTP headers from Ollama: {e}"))?;
        if bytes == 0 {
            return Err("Ollama closed connection before sending headers.".to_string());
        }
        if status_code.is_none() {
            let mut parts = line.split_whitespace();
            let _proto = parts.next();
            status_code = parts.next().and_then(|c| c.parse::<u16>().ok());
        }
        if line.to_lowercase().starts_with("transfer-encoding:")
            && line.to_lowercase().contains("chunked")
        {
            is_chunked = true;
        }
        header_bytes.extend_from_slice(line.as_bytes());
        if line == "\r\n" || line == "\n" {
            break;
        }
        if header_bytes.len() > 16 * 1024 {
            return Err("Ollama returned oversized HTTP headers.".into());
        }
    }

    let status = status_code.ok_or_else(|| "Ollama returned malformed HTTP status.".to_string())?;
    if !(200..300).contains(&status) {
        let mut error_body = Vec::new();
        let _ = reader.by_ref().take(4096).read_to_end(&mut error_body);
        let detail = serde_json::from_slice::<Value>(&error_body)
            .ok()
            .and_then(|value| value.get("error")?.as_str().map(str::to_string));
        if let Some(detail) = detail {
            if detail.to_lowercase().contains("model")
                && detail.to_lowercase().contains("not found")
            {
                return Err(format!(
                    "Ollama model is not installed: {detail}. Check the model name in Model Providers and retry."
                ));
            }
            return Err(format!("Ollama request failed: {detail}"));
        }
        return Err(format!(
            "Ollama returned HTTP {status}. Check the local server and model configuration."
        ));
    }

    let mut accumulated_content = String::new();
    let mut final_model = model.to_string();
    let mut final_timings: Option<OllamaChatTimings> = None;
    let mut line_buffer = String::new();
    let mut total_bytes_read: u64 = 0;
    let mut received_done = false;

    if is_chunked {
        loop {
            if cancellation_token.load(Ordering::Relaxed) {
                let _ = on_chunk(OllamaStreamEvent {
                    request_id: request_id.to_string(),
                    chunk: String::new(),
                    done: true,
                    model: Some(final_model.clone()),
                    timings: None,
                    eval_count: None,
                    eval_duration_ns: None,
                    prompt_eval_count: None,
                    prompt_eval_duration_ns: None,
                    total_duration_ns: None,
                    cancelled: true,
                    error: None,
                });
                return Err("Chat request was stopped by the user.".to_string());
            }

            let mut size_line = String::new();
            let bytes_read = reader
                .read_line(&mut size_line)
                .map_err(|e| format!("Error reading chunk size: {e}"))?;
            if bytes_read == 0 {
                break;
            }
            let hex_str = size_line.split(';').next().unwrap_or("").trim();
            if hex_str.is_empty() {
                continue;
            }
            let chunk_size = usize::from_str_radix(hex_str, 16)
                .map_err(|_| "Malformed chunk size from Ollama.".to_string())?;

            if chunk_size == 0 {
                let mut trailer = String::new();
                let _ = reader.read_line(&mut trailer);
                break;
            }

            total_bytes_read += chunk_size as u64;
            if total_bytes_read > MAX_RESPONSE_BYTES {
                return Err("Ollama streaming response exceeded safety limit.".into());
            }

            let mut chunk_data = vec![0u8; chunk_size];
            reader
                .read_exact(&mut chunk_data)
                .map_err(|e| format!("Incomplete chunk from Ollama: {e}"))?;

            let mut crlf = [0u8; 2];
            let _ = reader.read_exact(&mut crlf);

            line_buffer.push_str(&String::from_utf8_lossy(&chunk_data));

            while let Some(pos) = line_buffer.find('\n') {
                let raw_line = line_buffer[..pos].trim().to_string();
                line_buffer.drain(..=pos);
                if raw_line.is_empty() {
                    continue;
                }

                if let Ok(parsed) = serde_json::from_str::<Value>(&raw_line) {
                    let is_done = parsed.get("done").and_then(Value::as_bool).unwrap_or(false);
                    let token = parsed
                        .get("message")
                        .and_then(|m| m.get("content"))
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string();

                    if let Some(m) = parsed.get("model").and_then(Value::as_str) {
                        final_model = m.to_string();
                    }

                    if !token.is_empty() {
                        accumulated_content.push_str(&token);
                    }

                    let eval_count = parsed.get("eval_count").and_then(Value::as_u64);
                    let eval_duration = parsed.get("eval_duration").and_then(Value::as_u64);
                    let prompt_eval_count = parsed.get("prompt_eval_count").and_then(Value::as_u64);
                    let prompt_eval_duration = parsed.get("prompt_eval_duration").and_then(Value::as_u64);
                    let total_duration = parsed.get("total_duration").and_then(Value::as_u64);

                    let timings = if is_done {
                        let t = OllamaChatTimings {
                            handler_elapsed_ms: 0,
                            http_elapsed_ms: request_started.elapsed().as_millis() as u64,
                            ollama_total_ms: total_duration.map(|ns| ns / 1_000_000),
                            model_load_ms: parsed.get("load_duration").and_then(Value::as_u64).map(|ns| ns / 1_000_000),
                            prompt_eval_ms: prompt_eval_duration.map(|ns| ns / 1_000_000),
                            generation_ms: eval_duration.map(|ns| ns / 1_000_000),
                        };
                        final_timings = Some(t.clone());
                        Some(t)
                    } else {
                        None
                    };

                    on_chunk(OllamaStreamEvent {
                        request_id: request_id.to_string(),
                        chunk: token,
                        done: is_done,
                        model: Some(final_model.clone()),
                        timings,
                        eval_count,
                        eval_duration_ns: eval_duration,
                        prompt_eval_count,
                        prompt_eval_duration_ns: prompt_eval_duration,
                        total_duration_ns: total_duration,
                        cancelled: false,
                        error: None,
                    })?;

                    if is_done {
                        received_done = true;
                        break;
                    }
                }
            }

            if received_done {
                break;
            }
        }
    } else {
        loop {
            if cancellation_token.load(Ordering::Relaxed) {
                let _ = on_chunk(OllamaStreamEvent {
                    request_id: request_id.to_string(),
                    chunk: String::new(),
                    done: true,
                    model: Some(final_model.clone()),
                    timings: None,
                    eval_count: None,
                    eval_duration_ns: None,
                    prompt_eval_count: None,
                    prompt_eval_duration_ns: None,
                    total_duration_ns: None,
                    cancelled: true,
                    error: None,
                });
                return Err("Chat request was stopped by the user.".to_string());
            }

            let mut line = String::new();
            let bytes_read = reader
                .read_line(&mut line)
                .map_err(|e| format!("Error reading from Ollama stream: {e}"))?;
            if bytes_read == 0 {
                break;
            }

            total_bytes_read += bytes_read as u64;
            if total_bytes_read > MAX_RESPONSE_BYTES {
                return Err("Ollama streaming response exceeded safety limit.".into());
            }

            let raw_line = line.trim();
            if raw_line.is_empty() {
                continue;
            }

            if let Ok(parsed) = serde_json::from_str::<Value>(raw_line) {
                let is_done = parsed.get("done").and_then(Value::as_bool).unwrap_or(false);
                let token = parsed
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();

                if let Some(m) = parsed.get("model").and_then(Value::as_str) {
                    final_model = m.to_string();
                }

                if !token.is_empty() {
                    accumulated_content.push_str(&token);
                }

                let eval_count = parsed.get("eval_count").and_then(Value::as_u64);
                let eval_duration = parsed.get("eval_duration").and_then(Value::as_u64);
                let prompt_eval_count = parsed.get("prompt_eval_count").and_then(Value::as_u64);
                let prompt_eval_duration = parsed.get("prompt_eval_duration").and_then(Value::as_u64);
                let total_duration = parsed.get("total_duration").and_then(Value::as_u64);

                let timings = if is_done {
                    let t = OllamaChatTimings {
                        handler_elapsed_ms: 0,
                        http_elapsed_ms: request_started.elapsed().as_millis() as u64,
                        ollama_total_ms: total_duration.map(|ns| ns / 1_000_000),
                        model_load_ms: parsed.get("load_duration").and_then(Value::as_u64).map(|ns| ns / 1_000_000),
                        prompt_eval_ms: prompt_eval_duration.map(|ns| ns / 1_000_000),
                        generation_ms: eval_duration.map(|ns| ns / 1_000_000),
                    };
                    final_timings = Some(t.clone());
                    Some(t)
                } else {
                    None
                };

                on_chunk(OllamaStreamEvent {
                    request_id: request_id.to_string(),
                    chunk: token,
                    done: is_done,
                    model: Some(final_model.clone()),
                    timings,
                    eval_count,
                    eval_duration_ns: eval_duration,
                    prompt_eval_count,
                    prompt_eval_duration_ns: prompt_eval_duration,
                    total_duration_ns: total_duration,
                    cancelled: false,
                    error: None,
                })?;

                if is_done {
                    received_done = true;
                    break;
                }
            }
        }
    }

    if !received_done {
        if accumulated_content.trim().is_empty() {
            return Err("Ollama returned an empty response. Try the prompt again.".into());
        }
        let t = OllamaChatTimings {
            handler_elapsed_ms: 0,
            http_elapsed_ms: request_started.elapsed().as_millis() as u64,
            ollama_total_ms: None,
            model_load_ms: None,
            prompt_eval_ms: None,
            generation_ms: None,
        };
        final_timings = Some(t.clone());
        let _ = on_chunk(OllamaStreamEvent {
            request_id: request_id.to_string(),
            chunk: String::new(),
            done: true,
            model: Some(final_model.clone()),
            timings: Some(t),
            eval_count: None,
            eval_duration_ns: None,
            prompt_eval_count: None,
            prompt_eval_duration_ns: None,
            total_duration_ns: None,
            cancelled: false,
            error: None,
        });
    }

    Ok(OllamaChatResponse {
        model: final_model,
        content: accumulated_content,
        timings: final_timings.unwrap_or(OllamaChatTimings {
            handler_elapsed_ms: 0,
            http_elapsed_ms: request_started.elapsed().as_millis() as u64,
            ollama_total_ms: None,
            model_load_ms: None,
            prompt_eval_ms: None,
            generation_ms: None,
        }),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    fn fake_ollama(
        response_status: &str,
        response_body: &str,
    ) -> (String, thread::JoinHandle<String>) {
        fake_ollama_response(response_status, response_body, false)
    }

    fn fake_ollama_response(
        response_status: &str,
        response_body: &str,
        chunked: bool,
    ) -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let response_status = response_status.to_string();
        let response_body = response_body.to_string();
        let task = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
            let mut request = Vec::new();
            let mut buffer = [0; 4096];
            loop {
                let count = stream.read(&mut buffer).unwrap();
                if count == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..count]);
                let Some(header_end) = request.windows(4).position(|window| window == b"\r\n\r\n")
                else {
                    continue;
                };
                let headers = String::from_utf8_lossy(&request[..header_end]);
                let content_length = headers
                    .lines()
                    .find_map(|line| {
                        let (name, value) = line.split_once(':')?;
                        name.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse::<usize>().ok())?
                    })
                    .unwrap_or(0);
                if request.len() >= header_end + 4 + content_length {
                    break;
                }
            }
            let request = String::from_utf8_lossy(&request).to_string();
            if chunked {
                let response = format!(
                    "HTTP/1.1 {response_status}\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n{:X}\r\n{}\r\n0\r\n\r\n",
                    response_body.len(), response_body
                );
                stream.write_all(response.as_bytes()).unwrap();
            } else {
                let response = format!(
                    "HTTP/1.1 {response_status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    response_body.len(), response_body
                );
                stream.write_all(response.as_bytes()).unwrap();
            }
            request
        });
        (format!("http://{address}"), task)
    }

    #[test]
    fn endpoint_accepts_only_loopback_http() {
        assert!(LocalEndpoint::parse("http://127.0.0.1:11434").is_ok());
        assert!(LocalEndpoint::parse("http://localhost").is_ok());
        assert!(LocalEndpoint::parse("https://127.0.0.1:11434").is_err());
        assert!(LocalEndpoint::parse("http://192.168.1.20:11434").is_err());
        assert!(LocalEndpoint::parse("http://localhost:11434/path").is_err());
        assert!(LocalEndpoint::parse("http://user:pass@localhost:11434").is_err());
    }

    #[test]
    fn lists_models_from_a_mock_local_ollama_response() {
        let (endpoint, server) = fake_ollama(
            "200 OK",
            r#"{"models":[{"name":"phi3:mini"},{"name":"qwen2.5:3b"},{"name":"phi3:mini"}]}"#,
        );
        assert_eq!(
            list_models(&endpoint).unwrap(),
            vec!["phi3:mini", "qwen2.5:3b"]
        );
        assert!(server.join().unwrap().starts_with("GET /api/tags HTTP/1.1"));
    }

    #[test]
    fn sends_conversation_and_returns_the_real_api_response_shape() {
        let response = r#"{"model":"qwen2.5:3b","message":{"role":"assistant","content":"Hello from the mock."},"total_duration":123000000,"load_duration":10000000,"prompt_eval_duration":20000000,"eval_duration":80000000,"done":true}"#;
        let (endpoint, server) = fake_ollama("200 OK", response);
        let result = chat(
            &endpoint,
            "qwen2.5:3b",
            vec![ChatTurn {
                role: "user".into(),
                content: "Hello".into(),
            }],
        )
        .unwrap();
        let request = server.join().unwrap();
        assert!(request.starts_with("POST /api/chat HTTP/1.1"));
        assert!(request.contains("\"stream\":false"));
        assert!(request.contains("Hello"));
        assert_eq!(result.content, "Hello from the mock.");
        assert_eq!(result.model, "qwen2.5:3b");
        assert_eq!(result.timings.ollama_total_ms, Some(123));
        assert_eq!(result.timings.model_load_ms, Some(10));
        assert_eq!(result.timings.prompt_eval_ms, Some(20));
        assert_eq!(result.timings.generation_ms, Some(80));
    }

    #[test]
    fn parses_chunked_ollama_chat_responses() {
        let response = r#"{"model":"qwen2.5-coder:3b","message":{"role":"assistant","content":"Chunked response."}}"#;
        let (endpoint, server) = fake_ollama_response("200 OK", response, true);
        let result = chat(
            &endpoint,
            "qwen2.5-coder:3b",
            vec![ChatTurn {
                role: "user".into(),
                content: "Hello".into(),
            }],
        )
        .unwrap();
        server.join().unwrap();
        assert_eq!(result.content, "Chunked response.");
    }

    #[test]
    fn reports_missing_model_and_malformed_or_empty_responses() {
        let (endpoint, server) = fake_ollama(
            "404 Not Found",
            r#"{"error":"model 'qwen2.5:3b' not found"}"#,
        );
        assert!(chat(
            &endpoint,
            "qwen2.5:3b",
            vec![ChatTurn {
                role: "user".into(),
                content: "Hi".into()
            }]
        )
        .unwrap_err()
        .contains("not installed"));
        server.join().unwrap();

        let (endpoint, server) = fake_ollama("200 OK", "not json");
        assert!(chat(
            &endpoint,
            "model",
            vec![ChatTurn {
                role: "user".into(),
                content: "Hi".into()
            }]
        )
        .unwrap_err()
        .contains("malformed JSON"));
        server.join().unwrap();

        let (endpoint, server) = fake_ollama("200 OK", r#"{"message":{"content":"  "}}"#);
        assert!(chat(
            &endpoint,
            "model",
            vec![ChatTurn {
                role: "user".into(),
                content: "Hi".into()
            }]
        )
        .unwrap_err()
        .contains("empty response"));
        server.join().unwrap();
    }

    #[test]
    fn rejects_empty_prompts_models_and_unsupported_roles_before_network_access() {
        assert!(chat("http://127.0.0.1:11434", "model", vec![])
            .unwrap_err()
            .contains("Enter a message"));
        assert!(chat(
            "http://127.0.0.1:11434",
            " ",
            vec![ChatTurn {
                role: "user".into(),
                content: "Hi".into()
            }]
        )
        .unwrap_err()
        .contains("Choose an installed"));
        assert!(chat(
            "http://127.0.0.1:11434",
            "model",
            vec![ChatTurn {
                role: "system".into(),
                content: "Hi".into()
            }]
        )
        .unwrap_err()
        .contains("unsupported role"));
    }

    #[test]
    fn connection_refusal_has_an_actionable_local_server_message() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        let error = list_models(&format!("http://127.0.0.1:{port}")).unwrap_err();
        assert!(error.contains("Ollama is not running"));
    }

    fn fake_streaming_ollama(chunks: Vec<String>) -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let task = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
            let mut request = Vec::new();
            let mut buffer = [0; 4096];
            loop {
                let count = stream.read(&mut buffer).unwrap();
                if count == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..count]);
                if request.windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
            let request = String::from_utf8_lossy(&request).to_string();
            let header = "HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n";
            stream.write_all(header.as_bytes()).unwrap();

            for chunk in chunks {
                let formatted = format!("{:X}\r\n{}\r\n", chunk.len(), chunk);
                if stream.write_all(formatted.as_bytes()).is_err() {
                    break;
                }
                thread::sleep(Duration::from_millis(5));
            }
            let _ = stream.write_all(b"0\r\n\r\n");
            let _ = stream.flush();
            thread::sleep(Duration::from_millis(25));
            request
        });
        (format!("http://{address}"), task)
    }

    #[test]
    fn streams_tokens_chunk_by_chunk_from_ollama() {
        let chunks = vec![
            "{\"model\":\"qwen2.5:3b\",\"message\":{\"role\":\"assistant\",\"content\":\"Hello\"},\"done\":false}\n".to_string(),
            "{\"model\":\"qwen2.5:3b\",\"message\":{\"role\":\"assistant\",\"content\":\" world\"},\"done\":false}\n".to_string(),
            "{\"model\":\"qwen2.5:3b\",\"message\":{\"role\":\"assistant\",\"content\":\"!\"},\"done\":true,\"eval_count\":3,\"eval_duration\":150000000,\"prompt_eval_count\":10,\"total_duration\":200000000}\n".to_string(),
        ];
        let (endpoint, server) = fake_streaming_ollama(chunks);
        let mut received_tokens = Vec::new();
        let mut final_eval_count = None;
        let token = register_active_stream("test-req-1");

        let result = chat_stream(
            &endpoint,
            "qwen2.5:3b",
            vec![ChatTurn {
                role: "user".into(),
                content: "Hi".into(),
            }],
            "test-req-1",
            token,
            |event| {
                if !event.chunk.is_empty() {
                    received_tokens.push(event.chunk);
                }
                if event.done {
                    final_eval_count = event.eval_count;
                }
                Ok(())
            },
        )
        .expect("Streaming should succeed");

        unregister_active_stream("test-req-1");
        assert_eq!(received_tokens, vec!["Hello", " world", "!"]);
        assert_eq!(result.content, "Hello world!");
        assert_eq!(final_eval_count, Some(3));
        assert_eq!(result.timings.generation_ms, Some(150));
        server.join().unwrap();
    }

    #[test]
    fn handles_cancellation_during_streaming() {
        let chunks = vec![
            "{\"model\":\"qwen2.5:3b\",\"message\":{\"role\":\"assistant\",\"content\":\"Starting\"},\"done\":false}\n".to_string(),
            "{\"model\":\"qwen2.5:3b\",\"message\":{\"role\":\"assistant\",\"content\":\" more\"},\"done\":false}\n".to_string(),
            "{\"model\":\"qwen2.5:3b\",\"message\":{\"role\":\"assistant\",\"content\":\" text\"},\"done\":false}\n".to_string(),
        ];
        let (endpoint, server) = fake_streaming_ollama(chunks);
        let token = register_active_stream("test-cancel");
        let token_clone = Arc::clone(&token);

        let err = chat_stream(
            &endpoint,
            "qwen2.5:3b",
            vec![ChatTurn {
                role: "user".into(),
                content: "Hi".into(),
            }],
            "test-cancel",
            token,
            move |event| {
                if event.chunk == "Starting" {
                    token_clone.store(true, Ordering::SeqCst);
                }
                Ok(())
            },
        )
        .unwrap_err();

        unregister_active_stream("test-cancel");
        assert!(err.contains("stopped by the user"));
        server.join().unwrap();
    }

    #[test]
    fn handles_malformed_ndjson_line_gracefully() {
        let chunks = vec![
            "{\"model\":\"qwen2.5:3b\",\"message\":{\"role\":\"assistant\",\"content\":\"Good\"},\"done\":false}\n".to_string(),
            "CORRUPTED_LINE_NOT_JSON\n".to_string(),
            "{\"model\":\"qwen2.5:3b\",\"message\":{\"role\":\"assistant\",\"content\":\" day\"},\"done\":true,\"eval_count\":2}\n".to_string(),
        ];
        let (endpoint, server) = fake_streaming_ollama(chunks);
        let mut tokens = Vec::new();
        let token = register_active_stream("test-malformed");

        let result = chat_stream(
            &endpoint,
            "qwen2.5:3b",
            vec![ChatTurn {
                role: "user".into(),
                content: "Hi".into(),
            }],
            "test-malformed",
            token,
            |event| {
                if !event.chunk.is_empty() {
                    tokens.push(event.chunk);
                }
                Ok(())
            },
        )
        .expect("Should continue past malformed line");

        unregister_active_stream("test-malformed");
        assert_eq!(tokens, vec!["Good", " day"]);
        assert_eq!(result.content, "Good day");
        server.join().unwrap();
    }
}
