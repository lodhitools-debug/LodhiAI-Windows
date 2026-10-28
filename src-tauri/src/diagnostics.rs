use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const MAX_OUTPUT_BYTES: usize = 64 * 1024;
const DIAGNOSTIC_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIntelligence {
    pub root_path: String,
    pub primary_language: String,
    pub detected_languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub package_manager: String,
    pub entry_points: Vec<String>,
    pub dependencies: HashMap<String, String>,
    pub dev_dependencies: HashMap<String, String>,
    pub available_checks: Vec<String>,
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticItem {
    pub file: String,
    pub line: u32,
    pub column: Option<u32>,
    pub severity: String, // "error" | "warning" | "info"
    pub code: Option<String>,
    pub message: String,
    pub source: String, // "tsc" | "rustc" | "eslint" | "mypy" | "pytest" | "generic"
    pub suggested_fix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiagnosticsReport {
    pub tool_id: String,
    pub success: bool,
    pub exit_code: Option<i32>,
    pub raw_output: String,
    pub diagnostics: Vec<DiagnosticItem>,
    pub total_errors: usize,
    pub total_warnings: usize,
    pub timestamp_ms: u64,
}

fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Inspects project manifests to extract language, framework, dependencies, and check scripts.
pub fn analyze_project_intelligence(root: &Path) -> Result<ProjectIntelligence, String> {
    if !root.is_dir() {
        return Err("Project root directory is not valid or does not exist.".to_string());
    }

    let mut detected_languages = Vec::new();
    let mut frameworks = Vec::new();
    let mut package_manager = "unknown".to_string();
    let mut dependencies = HashMap::new();
    let mut dev_dependencies = HashMap::new();
    let mut available_checks = Vec::new();
    let mut entry_points = Vec::new();

    // 1. Inspect Node / TypeScript ecosystem (package.json)
    let package_json_path = root.join("package.json");
    if package_json_path.is_file() {
        if !detected_languages.contains(&"TypeScript/JavaScript".to_string()) {
            detected_languages.push("TypeScript/JavaScript".to_string());
        }

        // Determine package manager from lockfiles
        if root.join("pnpm-lock.yaml").is_file() {
            package_manager = "pnpm".to_string();
        } else if root.join("yarn.lock").is_file() {
            package_manager = "yarn".to_string();
        } else if root.join("bun.lockb").is_file() {
            package_manager = "bun".to_string();
        } else if root.join("package-lock.json").is_file() {
            package_manager = "npm".to_string();
        } else {
            package_manager = "npm".to_string();
        }

        if let Ok(content) = fs::read_to_string(&package_json_path) {
            if let Ok(val) = serde_json::from_str::<Value>(&content) {
                // Parse scripts
                if let Some(scripts) = val.get("scripts").and_then(Value::as_object) {
                    for key in scripts.keys() {
                        available_checks.push(key.clone());
                    }
                }

                // Parse production dependencies
                if let Some(deps) = val.get("dependencies").and_then(Value::as_object) {
                    for (k, v) in deps {
                        let version_str = v.as_str().unwrap_or("").to_string();
                        dependencies.insert(k.clone(), version_str);

                        // Framework identification
                        match k.as_str() {
                            "react" => frameworks.push("React".to_string()),
                            "vue" => frameworks.push("Vue".to_string()),
                            "svelte" => frameworks.push("Svelte".to_string()),
                            "next" => frameworks.push("Next.js".to_string()),
                            "express" => frameworks.push("Express".to_string()),
                            "electron" => frameworks.push("Electron".to_string()),
                            "@angular/core" => frameworks.push("Angular".to_string()),
                            "@nestjs/core" => frameworks.push("NestJS".to_string()),
                            _ => {}
                        }
                    }
                }

                // Parse devDependencies
                if let Some(dev_deps) = val.get("devDependencies").and_then(Value::as_object) {
                    for (k, v) in dev_deps {
                        let version_str = v.as_str().unwrap_or("").to_string();
                        dev_dependencies.insert(k.clone(), version_str);

                        match k.as_str() {
                            "vite" => frameworks.push("Vite".to_string()),
                            "typescript" => {
                                if !detected_languages.contains(&"TypeScript".to_string()) {
                                    detected_languages.push("TypeScript".to_string());
                                }
                            }
                            "tailwindcss" => frameworks.push("Tailwind CSS".to_string()),
                            "vitest" => frameworks.push("Vitest".to_string()),
                            "jest" => frameworks.push("Jest".to_string()),
                            "eslint" => frameworks.push("ESLint".to_string()),
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    // 2. Inspect Rust ecosystem (Cargo.toml)
    let cargo_toml_path = root.join("Cargo.toml");
    let tauri_cargo_path = root.join("src-tauri").join("Cargo.toml");
    let actual_cargo_path = if cargo_toml_path.is_file() {
        Some(cargo_toml_path)
    } else if tauri_cargo_path.is_file() {
        Some(tauri_cargo_path)
    } else {
        None
    };

    if let Some(cargo_path) = actual_cargo_path {
        if !detected_languages.contains(&"Rust".to_string()) {
            detected_languages.push("Rust".to_string());
        }
        if package_manager == "unknown" {
            package_manager = "cargo".to_string();
        }
        if !available_checks.contains(&"cargo check".to_string()) {
            available_checks.push("cargo check".to_string());
        }
        if !available_checks.contains(&"cargo test".to_string()) {
            available_checks.push("cargo test".to_string());
        }

        if let Ok(content) = fs::read_to_string(&cargo_path) {
            if content.contains("tauri =") || content.contains("tauri-build =") {
                frameworks.push("Tauri".to_string());
            }
            if content.contains("tokio =") {
                frameworks.push("Tokio".to_string());
            }
            if content.contains("actix-web =") {
                frameworks.push("Actix-Web".to_string());
            }
            if content.contains("axum =") {
                frameworks.push("Axum".to_string());
            }
        }
    }

    // 3. Inspect Python ecosystem (pyproject.toml, requirements.txt, setup.py)
    let pyproject_path = root.join("pyproject.toml");
    let requirements_path = root.join("requirements.txt");
    if pyproject_path.is_file() || requirements_path.is_file() || root.join("Pipfile").is_file() {
        if !detected_languages.contains(&"Python".to_string()) {
            detected_languages.push("Python".to_string());
        }
        if package_manager == "unknown" {
            package_manager = "pip".to_string();
        }

        let py_text = fs::read_to_string(&pyproject_path)
            .or_else(|_| fs::read_to_string(&requirements_path))
            .unwrap_or_default();

        if py_text.contains("fastapi") { frameworks.push("FastAPI".to_string()); }
        if py_text.contains("flask") { frameworks.push("Flask".to_string()); }
        if py_text.contains("django") { frameworks.push("Django".to_string()); }
        if py_text.contains("pytest") {
            frameworks.push("Pytest".to_string());
            available_checks.push("pytest".to_string());
        }
    }

    // 4. Inspect Go ecosystem (go.mod)
    let go_mod_path = root.join("go.mod");
    if go_mod_path.is_file() {
        if !detected_languages.contains(&"Go".to_string()) {
            detected_languages.push("Go".to_string());
        }
        if package_manager == "unknown" {
            package_manager = "go".to_string();
        }
        available_checks.push("go test".to_string());
        available_checks.push("go build".to_string());
    }

    // 5. Inspect Java ecosystem (pom.xml, build.gradle, build.gradle.kts)
    let pom_path = root.join("pom.xml");
    let gradle_path = root.join("build.gradle");
    let gradle_kts_path = root.join("build.gradle.kts");
    if pom_path.is_file() || gradle_path.is_file() || gradle_kts_path.is_file() {
        if !detected_languages.contains(&"Java".to_string()) {
            detected_languages.push("Java".to_string());
        }
        if package_manager == "unknown" {
            package_manager = if pom_path.is_file() {
                "maven".to_string()
            } else {
                "gradle".to_string()
            };
        }
        if pom_path.is_file() && !available_checks.contains(&"mvn test".to_string()) {
            available_checks.push("mvn test".to_string());
        } else if !available_checks.contains(&"gradle test".to_string()) {
            available_checks.push("gradle test".to_string());
        }

        let java_text = fs::read_to_string(&pom_path)
            .or_else(|_| fs::read_to_string(&gradle_path))
            .or_else(|_| fs::read_to_string(&gradle_kts_path))
            .unwrap_or_default();

        if java_text.contains("spring-boot") || java_text.contains("springframework") {
            frameworks.push("Spring Boot".to_string());
        }
        if java_text.contains("quarkus") {
            frameworks.push("Quarkus".to_string());
        }
        if java_text.contains("junit") {
            frameworks.push("JUnit".to_string());
        }
    }

    // Determine primary language
    let primary_language = if detected_languages.contains(&"TypeScript".to_string()) {
        "TypeScript".to_string()
    } else if detected_languages.contains(&"TypeScript/JavaScript".to_string()) {
        "JavaScript".to_string()
    } else if detected_languages.contains(&"Rust".to_string()) {
        "Rust".to_string()
    } else if detected_languages.contains(&"Python".to_string()) {
        "Python".to_string()
    } else if detected_languages.contains(&"Java".to_string()) {
        "Java".to_string()
    } else if detected_languages.contains(&"Go".to_string()) {
        "Go".to_string()
    } else {
        detected_languages.first().cloned().unwrap_or_else(|| "Unknown".to_string())
    };

    // Locate candidate entry points
    let candidates = [
        "src/main.tsx", "src/main.ts", "src/index.tsx", "src/index.ts", "src/App.tsx",
        "src/main.rs", "src-tauri/src/main.rs", "src-tauri/src/lib.rs",
        "main.py", "app.py", "src/main.py",
        "src/main/java/Main.java", "src/Main.java",
        "main.go", "cmd/main.go",
    ];

    for candidate in candidates {
        if root.join(candidate).is_file() {
            entry_points.push(candidate.to_string());
        }
    }

    // Deduplicate frameworks
    frameworks.sort();
    frameworks.dedup();

    Ok(ProjectIntelligence {
        root_path: root.to_string_lossy().into_owned(),
        primary_language,
        detected_languages,
        frameworks,
        package_manager,
        entry_points,
        dependencies,
        dev_dependencies,
        available_checks,
        timestamp_ms: current_time_ms(),
    })
}

/// Parses raw compiler, linter, or test-runner diagnostic output into structured DiagnosticItems.
pub fn parse_compiler_output(raw_output: &str, tool_source: &str) -> Vec<DiagnosticItem> {
    let mut diagnostics = Vec::new();
    let lines: Vec<&str> = raw_output.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();

        // 1. Rustc / Cargo check parsing:
        // error[E0425]: cannot find value `x` in this scope
        //  --> src/main.rs:14:5
        if line.starts_with("error[") || line.starts_with("warning[") || line.starts_with("error:") || line.starts_with("warning:") {
            let is_error = line.starts_with("error");
            let severity = if is_error { "error" } else { "warning" };
            let code = extract_rust_code(line);
            let message = line.to_string();

            // Look ahead for location line: "  --> src/path.rs:line:col"
            let mut file = "unknown".to_string();
            let mut line_num = 1u32;
            let mut col_num = None;

            if i + 1 < lines.len() && lines[i + 1].trim().starts_with("-->") {
                let loc_line = lines[i + 1].trim().trim_start_matches("-->").trim();
                let parts: Vec<&str> = loc_line.split(':').collect();
                if parts.len() >= 2 {
                    file = parts[0].trim().replace('\\', "/");
                    line_num = parts[1].trim().parse::<u32>().unwrap_or(1);
                    if parts.len() >= 3 {
                        col_num = parts[2].trim().parse::<u32>().ok();
                    }
                }
                i += 1; // Consume location line
            }

            let suggested_fix = suggest_rust_fix(&code, &message);

            diagnostics.push(DiagnosticItem {
                file,
                line: line_num,
                column: col_num,
                severity: severity.to_string(),
                code,
                message,
                source: "rustc".to_string(),
                suggested_fix,
            });
            i += 1;
            continue;
        }

        // 2. TypeScript / tsc parsing:
        // src/App.tsx:42:15 - error TS2322: Type 'string' is not assignable to type 'number'.
        // or src/App.tsx(42,15): error TS2322: Type 'string' is not assignable to type 'number'.
        if line.contains(" - error TS") || line.contains(" - warning TS") || line.contains("): error TS") || line.contains("): warning TS") {
            if let Some(item) = parse_tsc_line(line) {
                diagnostics.push(item);
                i += 1;
                continue;
            }
        }

        // 3. ESLint line parsing:
        //   42:15  error  'foo' is not defined  no-undef
        if (line.contains(" error ") || line.contains(" warning ")) && (line.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) || lines.get(i.saturating_sub(1)).map(|l| l.ends_with(".ts") || l.ends_with(".tsx") || l.ends_with(".js")).unwrap_or(false)) {
            if let Some(item) = parse_eslint_line(lines.as_slice(), i) {
                diagnostics.push(item);
                i += 1;
                continue;
            }
        }

        // 4. Pytest / Python failure parsing:
        // FAILED tests/test_app.py::test_login - AssertionError: assert 1 == 2
        // or src/main.py:10:5: error: Incompatible types in assignment
        if line.starts_with("FAILED ") {
            let rest = line.trim_start_matches("FAILED ").trim();
            let parts: Vec<&str> = rest.split(" - ").collect();
            let test_target = parts.first().unwrap_or(&rest);
            let test_file = test_target.split("::").next().unwrap_or(test_target);
            let message = parts.get(1).unwrap_or(&"Test assertion failed").to_string();

            diagnostics.push(DiagnosticItem {
                file: test_file.to_string().replace('\\', "/"),
                line: 1,
                column: None,
                severity: "error".to_string(),
                code: Some("PYTEST_FAILURE".to_string()),
                message,
                source: "pytest".to_string(),
                suggested_fix: Some("Inspect the failed test assertion and update logic or test fixtures.".to_string()),
            });
            i += 1;
            continue;
        }

        // 5. Python mypy/flake8 or Java javac parsing:
        // src/main.py:10:5: error: Incompatible types in assignment
        // or src/Main.java:14: error: cannot find symbol
        if line.contains(": error:") || line.contains(": warning:") {
            let is_error = line.contains(": error:");
            let severity = if is_error { "error" } else { "warning" };
            let delimiter = if is_error { ": error:" } else { ": warning:" };
            let parts: Vec<&str> = line.splitn(2, delimiter).collect();
            if parts.len() == 2 {
                let loc_tokens: Vec<&str> = parts[0].trim().split(':').collect();
                let file = loc_tokens[0].trim().replace('\\', "/");
                let line_num = loc_tokens.get(1).and_then(|s| s.trim().parse::<u32>().ok()).unwrap_or(1);
                let col_num = loc_tokens.get(2).and_then(|s| s.trim().parse::<u32>().ok());
                let message = parts[1].trim().to_string();

                let is_java = file.ends_with(".java") || tool_source == "javac" || tool_source == "mvn";
                let source = if is_java { "javac".to_string() } else { "mypy".to_string() };
                let suggested_fix = if is_java {
                    Some("Check Java class, method declarations, or missing imports.".to_string())
                } else {
                    Some("Check variable type annotations and function return types.".to_string())
                };

                diagnostics.push(DiagnosticItem {
                    file,
                    line: line_num,
                    column: col_num,
                    severity: severity.to_string(),
                    code: None,
                    message,
                    source,
                    suggested_fix,
                });
                i += 1;
                continue;
            }
        }

        i += 1;
    }

    // Deduplicate diagnostics
    diagnostics.dedup_by(|a, b| a.file == b.file && a.line == b.line && a.code == b.code && a.message == b.message);

    // If no structured diagnostics were detected but tool failed with errors in tool_source, add high-level summary
    if diagnostics.is_empty() && (raw_output.contains("error") || raw_output.contains("FAIL") || raw_output.contains("ERR!")) {
        diagnostics.push(DiagnosticItem {
            file: "workspace".to_string(),
            line: 1,
            column: None,
            severity: "error".to_string(),
            code: Some("EXECUTION_ERROR".to_string()),
            message: summarize_raw_error(raw_output),
            source: tool_source.to_string(),
            suggested_fix: Some("Inspect the terminal command output for the exact stack trace.".to_string()),
        });
    }

    diagnostics
}

fn extract_rust_code(line: &str) -> Option<String> {
    if let Some(start) = line.find('[') {
        if let Some(end) = line.find(']') {
            if end > start + 1 {
                return Some(line[start + 1..end].to_string());
            }
        }
    }
    None
}

fn suggest_rust_fix(code: &Option<String>, message: &str) -> Option<String> {
    match code.as_deref() {
        Some("E0425") => Some("Verify the variable is declared in current scope or import missing module with `use`.".to_string()),
        Some("E0308") => Some("Mismatched types; check expected parameter/return type or apply conversion (.into(), &ref).".to_string()),
        Some("E0277") => Some("Trait bound not satisfied; ensure the required trait is implemented or imported.".to_string()),
        Some("E0599") => Some("No method found on type; verify method name or bring required extension trait into scope.".to_string()),
        Some("E0432") => Some("Unresolved import; check crate name in Cargo.toml or module path spelling.".to_string()),
        _ => {
            if message.contains("unused variable") {
                Some("Prefix variable name with an underscore `_` to silence the unused warning.".to_string())
            } else {
                None
            }
        }
    }
}

fn parse_tsc_line(line: &str) -> Option<DiagnosticItem> {
    // Example format A: src/App.tsx:42:15 - error TS2322: Type 'string' is not assignable...
    // Example format B: src/App.tsx(42,15): error TS2322: Type 'string' is not assignable...
    let is_error = line.contains("error TS");
    let severity = if is_error { "error" } else { "warning" };

    let (file, line_num, col_num, rest) = if let Some(dash_idx) = line.find(" - ") {
        let prefix = &line[..dash_idx].trim();
        let rest = &line[dash_idx + 3..].trim();
        let parts: Vec<&str> = prefix.split(':').collect();
        if parts.len() >= 3 {
            let f = parts[0].trim().replace('\\', "/");
            let l = parts[1].trim().parse::<u32>().unwrap_or(1);
            let c = parts[2].trim().parse::<u32>().ok();
            (f, l, c, *rest)
        } else {
            return None;
        }
    } else if let Some(paren_idx) = line.find('(') {
        if let Some(close_idx) = line.find("):") {
            let file = line[..paren_idx].trim().replace('\\', "/");
            let loc_str = &line[paren_idx + 1..close_idx];
            let loc_parts: Vec<&str> = loc_str.split(',').collect();
            let l = loc_parts.first().and_then(|p| p.trim().parse::<u32>().ok()).unwrap_or(1);
            let c = loc_parts.get(1).and_then(|p| p.trim().parse::<u32>().ok());
            let rest = &line[close_idx + 2..].trim();
            (file, l, c, *rest)
        } else {
            return None;
        }
    } else {
        return None;
    };

    // Extract TS code: "error TS2322: message..."
    let code = if let Some(ts_idx) = rest.find("TS") {
        let code_part = &rest[ts_idx..];
        code_part.split(':').next().map(|s| s.trim().to_string())
    } else {
        None
    };

    let message = if let Some(colon_idx) = rest.find(':') {
        rest[colon_idx + 1..].trim().to_string()
    } else {
        rest.to_string()
    };

    let suggested_fix = suggest_tsc_fix(&code);

    Some(DiagnosticItem {
        file,
        line: line_num,
        column: col_num,
        severity: severity.to_string(),
        code,
        message,
        source: "tsc".to_string(),
        suggested_fix,
    })
}

fn suggest_tsc_fix(code: &Option<String>) -> Option<String> {
    match code.as_deref() {
        Some("TS2304") => Some("Identifier cannot be found; import symbol or declare type definition.".to_string()),
        Some("TS2322") => Some("Type mismatch; verify target type or use proper type assertion/narrowing.".to_string()),
        Some("TS2339") => Some("Property does not exist on type; verify spelling or update type/interface.".to_string()),
        Some("TS2345") => Some("Argument type mismatch; verify argument format matches function parameter.".to_string()),
        Some("TS2307") => Some("Cannot find module; verify package is installed in package.json and path is correct.".to_string()),
        Some("TS6133") => Some("Declared but never read; prefix with an underscore `_` or remove unused import.".to_string()),
        Some("TS7006") => Some("Implicit 'any' type; add explicit TypeScript type annotation to parameter.".to_string()),
        _ => None,
    }
}

fn parse_eslint_line(lines: &[&str], curr_idx: usize) -> Option<DiagnosticItem> {
    let line = lines[curr_idx].trim();
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 4 {
        return None;
    }

    let loc_parts: Vec<&str> = parts[0].split(':').collect();
    let line_num = loc_parts.first()?.parse::<u32>().ok()?;
    let col_num = loc_parts.get(1).and_then(|c| c.parse::<u32>().ok());
    let severity = parts[1].to_string();

    let rule = parts.last()?.to_string();
    let message = parts[2..parts.len() - 1].join(" ");

    // Look backward for nearest file path
    let mut file = "unknown".to_string();
    for prev in lines[..curr_idx].iter().rev() {
        let p = prev.trim();
        if (p.ends_with(".ts") || p.ends_with(".tsx") || p.ends_with(".js") || p.ends_with(".jsx")) && !p.contains(' ') {
            file = p.replace('\\', "/");
            break;
        }
    }

    Some(DiagnosticItem {
        file,
        line: line_num,
        column: col_num,
        severity,
        code: Some(rule.clone()),
        message,
        source: "eslint".to_string(),
        suggested_fix: Some(format!("Review ESLint rule '{rule}' guidelines or apply automatic formatter.")),
    })
}

fn summarize_raw_error(raw: &str) -> String {
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Error:") || trimmed.starts_with("ERR!") || trimmed.contains("failed") {
            return trimmed.to_string();
        }
    }
    raw.lines().take(3).collect::<Vec<&str>>().join(" ")
}

/// Runs an allowlisted diagnostics check script in the workspace root and parses the resulting output.
pub fn run_project_diagnostics(
    root: &Path,
    tool_id: &str,
    approved: bool,
) -> Result<ProjectDiagnosticsReport, String> {
    if !approved {
        return Err("Diagnostics check was not approved by user.".to_string());
    }

    // Only allow safe, allowlisted check commands
    let (cmd, args) = match tool_id {
        "type-check" => ("npm.cmd", vec!["run", "type-check"]),
        "test" => ("npm.cmd", vec!["run", "test"]),
        "build" => ("npm.cmd", vec!["run", "build"]),
        "lint" => ("npm.cmd", vec!["run", "lint"]),
        "cargo-check" => ("cargo", vec!["check"]),
        "cargo-test" => ("cargo", vec!["test", "--no-run"]),
        _ => return Err(format!("Unknown or unapproved diagnostics tool '{tool_id}'")),
    };

    let start = Instant::now();
    let mut child = Command::new(cmd)
        .args(&args)
        .current_dir(root)
        .env("CI", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn diagnostics tool '{cmd}': {e}"))?;

    // Wait with timeout
    let mut exit_code = None;
    let mut timed_out = false;

    loop {
        if let Ok(Some(status)) = child.try_wait() {
            exit_code = status.code();
            break;
        }
        if start.elapsed() >= DIAGNOSTIC_TIMEOUT {
            timed_out = true;
            let _ = child.kill();
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    if timed_out {
        return Err(format!("Diagnostics tool '{tool_id}' timed out after 120s."));
    }

    let mut raw_output = String::new();
    if let Some(mut out) = child.stdout.take() {
        let mut buf = Vec::new();
        use std::io::Read;
        let _ = out.read_to_end(&mut buf);
        raw_output.push_str(&String::from_utf8_lossy(&buf));
    }
    if let Some(mut err) = child.stderr.take() {
        let mut buf = Vec::new();
        use std::io::Read;
        let _ = err.read_to_end(&mut buf);
        raw_output.push_str(&String::from_utf8_lossy(&buf));
    }

    // Truncate if exceeds MAX_OUTPUT_BYTES
    if raw_output.len() > MAX_OUTPUT_BYTES {
        raw_output.truncate(MAX_OUTPUT_BYTES);
        raw_output.push_str("\n[Output capped at 64 KB]");
    }

    let success = exit_code == Some(0);
    let diagnostics = parse_compiler_output(&raw_output, tool_id);

    let total_errors = diagnostics.iter().filter(|d| d.severity == "error").count();
    let total_warnings = diagnostics.iter().filter(|d| d.severity == "warning").count();

    Ok(ProjectDiagnosticsReport {
        tool_id: tool_id.to_string(),
        success,
        exit_code,
        raw_output,
        diagnostics,
        total_errors,
        total_warnings,
        timestamp_ms: current_time_ms(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tsc_error_format() {
        let raw = "src/App.tsx:42:15 - error TS2322: Type 'string' is not assignable to type 'number'.\nsrc/screens/ChatScreen.tsx:10:5 - warning TS6133: 'unusedVar' is declared but its value is never read.";
        let diags = parse_compiler_output(raw, "type-check");

        assert_eq!(diags.len(), 2);
        assert_eq!(diags[0].file, "src/App.tsx");
        assert_eq!(diags[0].line, 42);
        assert_eq!(diags[0].column, Some(15));
        assert_eq!(diags[0].severity, "error");
        assert_eq!(diags[0].code, Some("TS2322".to_string()));
        assert!(diags[0].suggested_fix.is_some());

        assert_eq!(diags[1].file, "src/screens/ChatScreen.tsx");
        assert_eq!(diags[1].line, 10);
        assert_eq!(diags[1].severity, "warning");
        assert_eq!(diags[1].code, Some("TS6133".to_string()));
    }

    #[test]
    fn test_parse_rustc_error_format() {
        let raw = r#"
error[E0425]: cannot find value `unresolved_token` in this scope
  --> src/main.rs:14:5
   |
14 |     unresolved_token.process();
   |     ^^^^^^^^^^^^^^^^ not found in this scope
"#;
        let diags = parse_compiler_output(raw, "cargo-check");
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].file, "src/main.rs");
        assert_eq!(diags[0].line, 14);
        assert_eq!(diags[0].column, Some(5));
        assert_eq!(diags[0].severity, "error");
        assert_eq!(diags[0].code, Some("E0425".to_string()));
        assert!(diags[0].suggested_fix.as_ref().unwrap().contains("scope"));
    }

    #[test]
    fn test_parse_pytest_error_format() {
        let raw = "FAILED tests/test_auth.py::test_login_denial - AssertionError: assert False";
        let diags = parse_compiler_output(raw, "test");
        assert_eq!(diags.len(), 1);
        assert_eq!(diags[0].file, "tests/test_auth.py");
        assert_eq!(diags[0].code, Some("PYTEST_FAILURE".to_string()));
        assert_eq!(diags[0].severity, "error");
    }

    #[test]
    fn test_parse_javac_error_format() {
        let raw = "src/Main.java:14: error: cannot find symbol\nsrc/service/App.java:22: warning: [deprecation] oldMethod() has been deprecated";
        let diags = parse_compiler_output(raw, "javac");
        assert_eq!(diags.len(), 2);
        assert_eq!(diags[0].file, "src/Main.java");
        assert_eq!(diags[0].line, 14);
        assert_eq!(diags[0].severity, "error");
        assert_eq!(diags[0].source, "javac");
        assert!(diags[0].suggested_fix.as_ref().unwrap().contains("Java class"));

        assert_eq!(diags[1].file, "src/service/App.java");
        assert_eq!(diags[1].line, 22);
        assert_eq!(diags[1].severity, "warning");
        assert_eq!(diags[1].source, "javac");
    }

    #[test]
    fn test_analyze_project_intelligence_self() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
        let intel = analyze_project_intelligence(root).expect("should inspect current repo root");

        assert!(intel.detected_languages.contains(&"TypeScript".to_string()) || intel.detected_languages.contains(&"TypeScript/JavaScript".to_string()));
        assert!(intel.frameworks.contains(&"React".to_string()));
        assert!(intel.frameworks.contains(&"Vite".to_string()));
        assert_eq!(intel.package_manager, "npm");
        assert!(intel.available_checks.contains(&"test".to_string()));
        assert!(intel.available_checks.contains(&"type-check".to_string()));
    }
}
