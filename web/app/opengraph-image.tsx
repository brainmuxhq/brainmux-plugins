import { ImageResponse } from "next/og";

export const alt = "brainmux — LLM tooling for Claude Code";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "84px",
          background: "#0B0E14",
          color: "#D9E0EA",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, background: "#E8B341" }} />
          <div style={{ display: "flex", fontSize: 42, letterSpacing: -1 }}>
            <span>brain</span>
            <span style={{ color: "#E8B341" }}>mux</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, marginTop: 34, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
          Make Claude Code punch above its quota.
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#A7B0C0", marginTop: 26 }}>
          LLM tooling for Claude Code · run it on cheap brains
        </div>
      </div>
    ),
    { ...size },
  );
}
