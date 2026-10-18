import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Static Android ↔ web CRM compatibility contract.
 *
 * Parses the Kotlin API clients and the server route files and fails when the
 * app sends a path, field or response key the server no longer understands —
 * the four flows the desk cannot work without: login, report, recording
 * upload and reminders.
 */
const kotlinApi = readFileSync('android/app/src/main/java/com/winstone/connect/data/remote/WinstoneApi.kt', 'utf8');
const kotlinAgent = readFileSync('android/app/src/main/java/com/winstone/connect/data/remote/WinstoneAgentApi.kt', 'utf8');
const kotlin = kotlinApi + '\n' + kotlinAgent;

function serverRoute(path: string): string {
  return readFileSync(`src/routes/api${path}.ts`, 'utf8');
}

describe('android API compatibility', () => {
  it('every /api/public path used by the app exists as a server route file', () => {
    const paths = [...kotlin.matchAll(/"(\/api\/public\/[^"?]+)"/g)].map((m) => m[1]!);
    expect(paths.length).toBeGreaterThanOrEqual(15);
    for (const path of new Set(paths)) {
      expect(() => serverRoute(path), `missing server route for ${path}`).not.toThrow();
    }
  });

  it('the app always calls the live CRM origin', () => {
    expect(kotlinApi).toContain('const val BASE_URL = "https://crm.winstonebd.com"');
  });

  it('authenticated calls carry the device token header the server resolves', () => {
    expect(kotlin).toContain('"x-device-token"');
    for (const path of ['/public/agent/report', '/public/agent/reminders', '/public/ingest/recording']) {
      expect(serverRoute(path)).toContain('resolveApiCaller');
    }
  });

  it('login: every field the app posts is accepted by the server schema', () => {
    const route = serverRoute('/public/agent/login');
    for (const field of ['email', 'password', 'device_label', 'app_version', 'sim_number']) {
      expect(route, field).toContain(field);
    }
    // The app reads these keys from a successful sign-in response.
    for (const key of ['device_token', 'device_id', 'employee_id', 'allowed_roles']) {
      expect(route, key).toContain(key);
    }
  });

  it('report: every submitted field is declared in the server schema', () => {
    const route = serverRoute('/public/agent/report');
    for (const field of [
      'action', 'open', 'submit', 'report_id', 'lead_id', 'recording_id', 'phone_number',
      'category', 'summary', 'note', 'reason', 'follow_up_at', 'ai_decision', 'direction',
      'call_status', 'duration_seconds', 'follow_up_needed', 'follow_up_note',
      'no_follow_up_reason', 'temperature', 'grade', 'evaluation_answers',
      'app_version', 'version_code', 'captured_at', 'connected',
    ]) {
      expect(route, field).toContain(field);
    }
    // The app reads the open-report response keys.
    for (const key of ['pending', 'report_id', 'ok']) expect(route, key).toContain(key);
  });

  it('recording upload: the server reads every critical multipart field the app sends', () => {
    const route = serverRoute('/public/ingest/recording');
    for (const field of [
      'file', 'lead_id', 'phone_number', 'agent_id', 'employee_id', 'lead_name',
      'file_extension', 'duration_seconds', 'call_direction', 'is_two_sided',
      'client_upload_id', 'recorder_source', 'sim_number',
    ]) {
      expect(route, field).toContain(field);
    }
    // Multipart (new builds) and JSON+base64 (old builds) are both accepted.
    expect(route).toContain('multipart/form-data');
    expect(route).toContain('audio_base64');
    // Idempotent replay and the response keys the app consumes.
    for (const key of ['client_upload_id', 'recording_id', 'duplicate']) {
      expect(route, key).toContain(key);
    }
  });

  it('reminders: GET feed exists and returns the reminders array the app parses', () => {
    const route = serverRoute('/public/agent/reminders');
    expect(route).toContain('GET');
    expect(route).toContain('reminders');
    expect(kotlinApi).toContain('/api/public/agent/reminders');
  });
});
