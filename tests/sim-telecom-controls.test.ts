import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const android = (path: string) => readFileSync(`android/app/src/main/${path}`, "utf8");
describe("Android SIM control integration contract (not handset execution)", () => {
  it("requires the OS-protected in-call binding and explicit dialer role consent", () => {
    const manifest = android("AndroidManifest.xml");
    expect(manifest).toContain('android.permission.BIND_INCALL_SERVICE');
    expect(manifest).toContain('android.telecom.IN_CALL_SERVICE_UI');
    const ui = android("java/com/winstone/connect/ui/SimCallControls.kt");
    expect(ui).toContain('createRequestRoleIntent(RoleManager.ROLE_DIALER)');
    expect(ui).toContain('state.available');
  });
  it("uses actual Telecom controls and observes audio state rather than optimistic toggles", () => {
    const service = android("java/com/winstone/connect/telephony/WinstoneInCallService.kt");
    for (const code of ['service.setMuted(value)', 'service.setAudioRoute(route)', 'call.disconnect()', 'onCallAudioStateChanged', 'call.unregisterCallback(callback)']) expect(service).toContain(code);
    expect(service).not.toContain('queueCallState');
    const live = android("java/com/winstone/connect/ui/LiveCallScreen.kt");
    expect(live).toContain('SimCallControls()');
    expect(live).not.toContain('audio.isMicrophoneMute');
    expect(live).not.toContain('telecom.endCall()');
    expect(live).toContain('ReportSheet(notes = notes)');
  });
  it("keeps system incoming calls usable independently of CRM access", () => {
    const main = android("java/com/winstone/connect/MainActivity.kt");
    expect(main.match(/SystemSimCallScreen\(\)/g)).toHaveLength(2);
    const dialer = android("java/com/winstone/connect/SimDialerActivity.kt");
    expect(dialer).toContain('telecom.placeCall(uri, Bundle())');
    expect(dialer).toContain('telecom.systemDialerPackage');
  });
});