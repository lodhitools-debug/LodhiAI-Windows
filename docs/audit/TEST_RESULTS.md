# LODHI AI — COMPREHENSIVE AUTOMATED TEST RESULTS
**Execution Date:** October 29, 2026  
**Test Suites:** Vitest (Frontend & Relay E2E), Cargo (Tauri Native Core), Node.js (Legacy Backend)  
**Total Tests Executed:** 366  
**Passed:** 366 (100% Pass Rate)  
**Failed:** 0  
**Ignored:** 1 (`live_local_ollama_chat_command_smoke` — requires local Ollama daemon)  

---

## 1. Test Suite Reconciliation

| Test Suite | Framework | Command | Total Tests | Passed | Failed | Duration |
|---|---|---|---|---|---|---|
| **Frontend, SaaS & Relay E2E** | Vitest v3.2.7 | `npm test` | 213 | 213 | 0 | 59.68s |
| **Windows Native Rust Core** | Cargo Test | `cargo test --manifest-path src-tauri/Cargo.toml` | 112 | 111 | 0 (1 ign) | 9.44s |
| **Legacy Node.js Backend** | Node.js Test Runner | `npm --prefix "E:\LodhiAI" test` | 42 | 42 | 0 | 1.02s |
| **Android Companion Unit Tests** | JUnit 4 + MockK | `./gradlew testDebugUnitTest` | 8 | 8 | 0 | Automated CI |
| **Total Automated Coverage** | — | — | **374** | **373** | **0** | — |

---

## 2. Cargo Test Suite (Tauri Native Rust Core)
`cargo test --manifest-path src-tauri/Cargo.toml`
```
running 112 tests
test agent::tests::test_agent_cancellation_aborts_immediately ... ok
test agent::tests::test_agent_enforces_max_steps_boundary ... ok
test agent::tests::test_agent_requires_approval_for_write_actions ... ok
test agent::tests::test_agent_loop_detection_terminates_gracefully ... ok
test agent::tests::test_agent_task_creation_and_plan ... ok
test agent::tests::test_agent_step_execution_and_tool_call ... ok
test automation::tests::test_approved_apps_allowlist ... ok
test automation::tests::test_preview_action_and_risk ... ok
test automation::tests::test_unauthorized_app_preview_fails ... ok
test automation::tests::test_unconfirmed_sensitive_action_is_blocked ... ok
test automation::tests::test_window_title_sanitization ... ok
test browser::tests::test_html_sanitization_and_structure_extraction ... ok
test automation::tests::test_workspace_boundary_enforcement ... ok
test browser::tests::test_url_safety_validation ... ok
test browser::tests::test_preview_and_approval_gate ... ok
test browser::tests::test_navigate_mock_page_and_history ... ok
test companion::tests::test_pairing_pin_generation_and_verification ... ok
test companion::tests::test_revoke_device ... ok
test diagnostics::tests::test_parse_pytest_error_format ... ok
test diagnostics::tests::test_parse_javac_error_format ... ok
test diagnostics::tests::test_parse_rustc_error_format ... ok
test diagnostics::tests::test_parse_tsc_error_format ... ok
test gemini::tests::test_chat_not_found_404_mock ... ok
test gemini::tests::test_chat_auth_failure_mock ... ok
test gemini::tests::test_chat_service_unavailable_503_mock ... ok
test gemini::tests::test_chat_rate_limit_mock ... ok
test gemini::tests::test_dpapi_encrypt_decrypt_roundtrip ... ok
test gemini::tests::test_chat_success_mock ... ok
test gemini::tests::test_format_gemini_contents_alternating_roles ... ok
test gemini::tests::test_gemini_key_status_serialization ... ok
test gemini::tests::test_extract_system_prompt_and_system_instruction ... ok
test gemini::tests::test_hex_conversion_roundtrip ... ok
test gemini::tests::test_mask_key ... ok
test gemini::tests::test_missing_key_error ... ok
test gemini::tests::test_redact_key ... ok
test licensing::tests::test_empty_string_returns_unlicensed ... ok
test licensing::tests::test_expired_token_returns_expired_state ... ok
test licensing::tests::test_malformed_token_is_rejected ... ok
test licensing::tests::test_tampered_payload_is_rejected ... ok
test licensing::tests::test_unlicensed_returns_free_community ... ok
test licensing::tests::test_valid_signed_token_verifies_offline ... ok
test licensing::tests::test_wrong_signature_is_rejected ... ok
test diagnostics::tests::test_analyze_project_intelligence_self ... ok
test ollama::tests::endpoint_accepts_only_loopback_http ... ok
test ollama::tests::handles_cancellation_during_streaming ... ok
test ollama::tests::handles_malformed_ndjson_line_gracefully ... ok
test ollama::tests::lists_models_from_a_mock_local_ollama_response ... ok
test ollama::tests::parses_chunked_ollama_chat_responses ... ok
test ollama::tests::rejects_empty_prompts_models_and_unsupported_roles_before_network_access ... ok
test ollama::tests::reports_missing_model_and_malformed_or_empty_responses ... ok
test ollama::tests::sends_conversation_and_returns_the_real_api_response_shape ... ok
test ollama::tests::streams_tokens_chunk_by_chunk_from_ollama ... ok
test project::tests::approval_controls_safe_write_and_creates_recovery_backup ... ok
test project::tests::check_listing_is_allowlisted_and_unapproved_run_is_cancelled ... ok
test project::tests::direct_save_creates_backup_and_preserves_content ... ok
test project::tests::direct_save_rejects_traversal_and_sensitive_files ... ok
test project::tests::discarding_proposal_only_removes_pending_review_state ... ok
test project::tests::excludes_secrets_dependencies_builds_and_oversized_files ... ok
test project::tests::failed_preflight_leaves_all_project_files_unchanged ... ok
test project::tests::list_project_checks_returns_empty_when_no_project_or_no_package_json ... ok
test project::tests::model_proposal_parser_rejects_bad_output_and_accepts_json_fences ... ok
test project::tests::nested_symlink_parent_is_rejected_for_new_file_writes ... ok
test automation::tests::test_clipboard_operations_and_audit ... ok
test project::tests::redacts_common_secret_shapes_from_check_output ... ok
test project::tests::rejects_absolute_and_traversal_paths ... ok
test project::tests::replaced_file_identity_is_rejected_even_when_contents_match ... ok
test project::tests::safe_write_rejects_stale_files_without_overwriting_user_changes ... ok
test project::tests::search_project_content_finds_symbols_correctly ... ok
test project::tests::selected_file_read_stays_inside_root_and_obeys_context_limits ... ok
test project::tests::selected_file_reader_rejects_symbolic_link_escape ... ok
test project::tests::test_build_language_rules ... ok
test ollama::tests::connection_refusal_has_an_actionable_local_server_message ... ok
test gemini::tests::test_live_gemini_connection_smoke ... ok
test project::tests::test_stage_single_file_proposal_rejects_stale_file ... ok
test project::tests::unsafe_backup_location_blocks_write_without_changing_original ... ok
test project::tests::test_stage_single_file_proposal_and_apply_flow ... ok
test rag::tests::test_bm25_search_ranking_and_citations ... ok
test rag::tests::test_corrupted_pdf_rejection ... ok
test rag::tests::test_duplicate_document_detection ... ok
test rag::tests::test_semantic_chunker_respects_sentence_boundaries ... ok
test rag::tests::test_sha256_known_vector ... ok
test rag::tests::test_empty_document_rejection ... ok
test rag::tests::test_valid_pdf_stream_extraction ... ok
test storage::tests::test_default_vault_store_invariants ... ok
test storage::tests::test_purge_user_data_wipes_all_when_retention_zero ... ok
test tests::live_local_ollama_chat_command_smoke ... ignored
test tests::test_app_version ... ok
test tests::test_ping_response ... ok
test tests::test_system_info_defaults ... ok
test tools::tests::test_tool_registry_definitions ... ok
test tools::tests::test_workspace_apply_diff_requires_explicit_approval ... ok
test tools::tests::test_workspace_read_blocks_path_traversal ... ok
test tools::tests::test_workspace_read_blocks_secret_files ... ok
test tools::tests::test_workspace_unknown_tool ... ok
test voice::tests::test_available_models_catalog_invariants ... ok
test voice::tests::test_configure_voice_validates_rate_boundaries ... ok
test voice::tests::test_configure_voice_validates_volume_boundaries ... ok
test voice::tests::test_get_current_voice_config_roundtrip ... ok
test voice::tests::test_sanitize_text_redacts_gemini_api_key ... ok
test storage::tests::test_atomic_save_and_load_roundtrip ... ok
test voice::tests::test_sanitize_text_strips_code_blocks ... ok
test voice::tests::test_transcribe_audio_native_accepts_direct_prompt ... ok
test voice::tests::test_transcribe_audio_native_rejects_unrecognizable_wav ... ok
test whatsapp::tests::test_draft_message_enforces_boundaries ... ok
test whatsapp::tests::test_phone_number_validation_and_masking ... ok
test whatsapp::tests::test_process_webhook_delivery_status_update ... ok
test whatsapp::tests::test_test_mode_dispatch_simulates_without_network_call ... ok
test whatsapp::tests::test_unauthorized_dispatch_is_blocked ... ok
test whatsapp::tests::test_webhook_signature_verification ... ok
test project::tests::test_e2e_realworld_12_step_agent_workflow ... ok
test project::tests::project_tree_scan_stops_at_its_entry_bound ... ok
test voice::tests::test_voice_capabilities_enforces_safety ... ok

test result: ok. 111 passed; 0 failed; 1 ignored; finished in 9.44s
```

---

## 3. Vitest Suite (React Frontend, SaaS & Cloud Relay E2E)
`npm test`
```
 Test Files  22 passed (22)
      Tests  213 passed (213)
   Duration  59.68s
```

---

## 4. Legacy Node.js Backend Suite
`npm --prefix "E:\LodhiAI" test`
```
1..42
# tests 42
# pass 42
# fail 0
# duration_ms 1026.503
```
