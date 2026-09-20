
describe("averageTalkSecondsOf (ATA)", () => {
  it("averages verified talk over measured connected calls only", () => {
    expect(
      averageTalkSecondsOf([
        { verifiedConnected: true, verifiedSeconds: 120 },
        { verifiedConnected: true, verifiedSeconds: 240 },
        { verifiedConnected: true, verifiedSeconds: null }, // unmeasured: excluded both sides
        { verifiedConnected: false, verifiedSeconds: null }, // not connected: excluded
      ]),
    ).toBe(180);
  });

  it("is null when nothing was measured — never a fake zero", () => {
    expect(averageTalkSecondsOf([{ verifiedConnected: true, verifiedSeconds: null }])).toBeNull();
    expect(averageTalkSecondsOf([])).toBeNull();
  });
});
