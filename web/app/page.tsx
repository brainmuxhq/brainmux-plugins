import CopyButton from "./CopyButton";
import StructuredData from "./StructuredData";
import { FAQ } from "./faq";

export default function Home() {
  return (
    <>
      <StructuredData />
      <header>
        <div className="wrap nav">
          <a className="brand" href="#top">
            <span className="dot" />brain<span className="accent">mux</span>
          </a>
          <nav className="nav-right">
            <a href="#products">Products</a>
            <a href="#llmproxy">llmproxy</a>
            <a href="#graphmux">graphmux</a>
            <a href="https://github.com/brainmuxhq/brainmux" className="ghbtn" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </nav>
        </div>
      </header>

      <main className="wrap" id="top">
        {/* HERO — brand */}
        <section className="hero" style={{ borderTop: "none" }}>
          <div>
            <p className="eyebrow">LLM tooling · for Claude Code</p>
            <h1>Make Claude Code punch <span className="accent">above its quota</span>.</h1>
            <p className="lede">
              brainmux builds tools that route your work to the right model — so Claude Code spends your
              Opus quota on architecture and review, not busywork.
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" href="#llmproxy">Explore llmproxy</a>
              <a className="btn btn-ghost" href="https://github.com/brainmuxhq/brainmux" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
            </div>
            <div className="mux" aria-hidden="true" style={{ marginTop: 26 }}>
              <svg viewBox="0 0 520 168" role="img" aria-label="Claude Code routed through bmux to chat, deep and coder brains">
                <defs>
                  <marker id="ah" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#4FD1C5" />
                  </marker>
                </defs>
                <rect x="4" y="66" width="120" height="36" rx="8" fill="#121722" stroke="#2E3749" />
                <text x="64" y="89" textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize="12.5" fill="#D9E0EA">Claude Code</text>
                <rect x="200" y="60" width="92" height="48" rx="9" fill="#1a1305" stroke="#B98C2f" />
                <text x="246" y="84" textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize="14" fill="#E8B341">bmux</text>
                <text x="246" y="99" textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize="9" fill="#B98C2f">:mux</text>
                <g fontFamily="ui-monospace,Menlo,monospace" fontSize="11.5">
                  <rect x="372" y="12" width="144" height="34" rx="8" fill="#121722" stroke="#232A38" />
                  <text x="388" y="33" fill="#D9E0EA">chat</text>
                  <text x="506" y="33" textAnchor="end" fill="#7E889A">:4567</text>
                  <rect x="372" y="67" width="144" height="34" rx="8" fill="#121722" stroke="#232A38" />
                  <text x="388" y="88" fill="#D9E0EA">deep</text>
                  <text x="506" y="88" textAnchor="end" fill="#7E889A">:4568</text>
                  <rect x="372" y="122" width="144" height="34" rx="8" fill="#121722" stroke="#232A38" />
                  <text x="388" y="143" fill="#D9E0EA">coder</text>
                  <text x="506" y="143" textAnchor="end" fill="#7E889A">:4569</text>
                </g>
                <path d="M124,84 H196" stroke="#4FD1C5" strokeWidth="1.4" fill="none" markerEnd="url(#ah)" />
                <path d="M292,84 C330,84 330,29 370,29" stroke="#4FD1C5" strokeWidth="1.4" fill="none" markerEnd="url(#ah)" />
                <path d="M292,84 H370" stroke="#4FD1C5" strokeWidth="1.4" fill="none" markerEnd="url(#ah)" />
                <path d="M292,84 C330,84 330,139 370,139" stroke="#4FD1C5" strokeWidth="1.4" fill="none" markerEnd="url(#ah)" />
              </svg>
            </div>
          </div>
          <div className="term">
            <div className="term-bar"><i /><i /><i /><span className="t">brainmux · open source</span></div>
            <div className="term-body">
              <div className="row"><span className="cmt"># one brand, a family of Claude Code tools</span></div>
              <div className="row"><span className="out">▸ llmproxy </span><span className="ok">live</span></div>
              <div className="row"><span className="out">▸ graphmux </span><span className="ok">live</span><span className="cursor" /></div>
            </div>
          </div>
        </section>

        {/* WHAT IS IT — answer-first block (GEO / AI Overviews) */}
        <section id="what" aria-label="What is brainmux">
          <p className="eyebrow">What is it</p>
          <p className="answer">
            brainmux is LLM tooling for <strong>Claude Code</strong>. <strong>llmproxy</strong> routes Claude Code
            to cheap OpenRouter models through local LiteLLM proxies and delegates the grunt work to them — one key
            reaches thousands of models, the brains run pay-as-you-go and never touch your Anthropic quota, and Opus
            stays the orchestrator. <strong>graphmux</strong> gives those agents a local, deterministic code graph, so
            they ground on your codebase instead of guessing. Each tool wraps a mature open-source core (LiteLLM,
            CodeGraph) in a thin, pinned layer — same core, our packaging.
          </p>
        </section>

        {/* PRODUCTS */}
        <section id="products">
          <div className="sec-head">
            <p className="eyebrow">Products</p>
            <h2>Two tools today. A family in the making.</h2>
          </div>
          <div className="prod">
            <div className="card">
              <div className="top"><h3>llmproxy</h3><span className="badge live">Live · v0.1</span></div>
              <p>
                Run Claude Code on cheap LLM brains and delegate the grunt work — one OpenRouter key,
                thousands of models, your Opus quota untouched.
              </p>
              <a className="explore" href="#llmproxy">Explore llmproxy ↓</a>
            </div>
            <div className="card">
              <div className="top"><h3>graphmux</h3><span className="badge live">Live · v0.1</span></div>
              <p>
                Give Claude Code and bmux delegates a local, deterministic code graph — real callers,
                callees and impact — so agents ground on your codebase instead of guessing.
              </p>
              <a className="explore" href="#graphmux">Explore graphmux ↓</a>
            </div>
          </div>
        </section>

        {/* LLMPROXY deep-dive */}
        <section id="llmproxy">
          <div className="prod-detail">
            <div className="sec-head" style={{ marginBottom: 0 }}>
              <p className="eyebrow">llmproxy · our first tool</p>
              <h2>Run Claude Code on cheap brains.</h2>
              <p>
                Your Opus quota is the bottleneck. llmproxy routes Claude Code to cheap OpenRouter models
                and delegates the grunt work to them — Opus stays the orchestrator; cheap brains do the volume.
              </p>
              <div className="cta-row"><a className="btn btn-ghost" href="#quickstart">Quickstart ↓</a></div>
            </div>
            <div className="term" id="install">
              <div className="term-bar"><i /><i /><i /><span className="t">install · Claude Code</span></div>
              <div className="term-body">
                <div className="row"><span className="prompt">&gt;</span><span>/plugin marketplace add brainmuxhq/brainmux</span><CopyButton text="/plugin marketplace add brainmuxhq/brainmux" /></div>
                <div className="row"><span className="out">✓ added marketplace: brainmux</span></div>
                <div className="row"><span className="prompt">&gt;</span><span>/plugin install llmproxy@brainmux</span><CopyButton text="/plugin install llmproxy@brainmux" /></div>
                <div className="row"><span className="ok">✓ installed llmproxy</span></div>
              </div>
            </div>
          </div>

          <div className="cards3">
            <div className="card"><span className="k">one key</span><h3>Thousands of models</h3><p>A single OpenRouter key reaches DeepSeek, Qwen, GLM, GPT, Gemini and hundreds more — no per-provider setup.</p></div>
            <div className="card"><span className="k">separate meter</span><h3>Never touches your quota</h3><p>The brains run pay-as-you-go on OpenRouter. Your Anthropic subscription quota stays untouched.</p></div>
            <div className="card"><span className="k">orchestrator</span><h3>Opus stays in charge</h3><p>Cheap brains do the volume — bulk edits, detection sweeps. Opus reviews, decides, and fixes.</p></div>
          </div>
        </section>

        {/* HOW */}
        <section id="how">
          <div className="how">
            <div className="sec-head" style={{ marginBottom: 0 }}>
              <p className="eyebrow">How it works</p>
              <h2>One config. One proxy per brain. Routed by port.</h2>
              <p>
                A single <code className="mono accent">brains.yaml</code> (zod-validated) is the source of
                truth. <span className="mono">bmux</span> generates a Docker Compose stack — one LiteLLM
                proxy per brain, isolated by port — and points Claude Code at the brain you choose.
              </p>
            </div>
            <div className="flow">
              <div className="step"><span className="arrow">▸</span><span>brains.yaml <span className="cmt">— your brains (SSOT)</span></span></div>
              <div className="step"><span className="arrow">↓</span><span className="cmt">bmux generate</span></div>
              <div className="step"><span className="arrow">▸</span><span>compose · litellm configs · init.sql</span></div>
              <div className="step"><span className="arrow">↓</span><span className="cmt">bmux up</span></div>
              <div className="step"><span className="arrow">▸</span><span>chat :4567 · deep :4568 · coder :4569</span></div>
              <div className="step"><span className="arrow accent">▸</span><span className="accent">Claude Code, on your cheap brain</span></div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features">
          <div className="sec-head"><p className="eyebrow">What you get</p><h2>A CLI for the whole loop.</h2></div>
          <div className="feat">
            <div className="card"><span className="k">bmux cli</span><h3>Manage the stack</h3><p><code>init</code> · <code>up</code> / <code>down</code> · <code>health</code> · <code>config add-brain</code> / <code>set-model</code> · <code>test</code>. Declarative — edit, regenerate, restart.</p></div>
            <div className="card"><span className="k">delegate</span><h3>Offload grunt work</h3><p><code>bmux delegate coder &quot;…&quot;</code> hands a bounded task to a cheap brain headless. Opus verifies the result — no rubber-stamp.</p></div>
            <div className="card"><span className="k">bmux models</span><h3>Pick from the live catalog</h3><p>Browse the live OpenRouter catalog by price, context and use-case — never a guessed, stale model slug.</p></div>
            <div className="card"><span className="k">observability</span><h3>Spend &amp; logs, per brain</h3><p>Each brain ships the LiteLLM UI for spend, request logs and parameter tuning. Nothing to rebuild.</p></div>
          </div>
        </section>

        {/* QUICKSTART */}
        <section id="quickstart">
          <div className="sec-head"><p className="eyebrow">Quickstart</p><h2>Four commands to a running brain.</h2><p>Requires Docker and an OpenRouter API key.</p></div>
          <div className="term">
            <div className="term-bar"><i /><i /><i /><span className="t">terminal — ~/your-project</span></div>
            <div className="term-body">
              <div className="row"><span className="prompt">&gt;</span><span>/plugin marketplace add brainmuxhq/brainmux</span></div>
              <div className="row"><span className="prompt">&gt;</span><span>/plugin install llmproxy@brainmux</span></div>
              <div className="row"><span className="prompt">$</span><span>bmux init</span></div>
              <div className="row"><span className="prompt">$</span><span>bmux config add-key OPENROUTER_API_KEY</span><span className="cmt">  # hidden prompt — key not echoed</span></div>
              <div className="row"><span className="prompt">$</span><span>bmux up</span></div>
              <div className="row"><span className="prompt">$</span><span>bmux test</span></div>
              <div className="row"><span className="ok">chat OK · deep OK · coder OK</span></div>
            </div>
          </div>
        </section>

        {/* GRAPHMUX deep-dive */}
        <section id="graphmux">
          <div className="prod-detail">
            <div className="sec-head" style={{ marginBottom: 0 }}>
              <p className="eyebrow">graphmux · our second tool</p>
              <h2>Ground agents on your codebase.</h2>
              <p>
                Cheap brains hallucinate about code. graphmux gives them a local, deterministic code graph — real
                callers, callees, impact and verbatim source — so they look up your codebase instead of guessing.
                A thin wrapper over the vendored CodeGraph engine (tree-sitter → local SQLite): no embeddings, no
                cloud, telemetry off.
              </p>
              <div className="cta-row"><a className="btn btn-ghost" href="https://github.com/brainmuxhq/brainmux" target="_blank" rel="noopener noreferrer">GitHub ↗</a></div>
            </div>
            <div className="term">
              <div className="term-bar"><i /><i /><i /><span className="t">install · Claude Code</span></div>
              <div className="term-body">
                <div className="row"><span className="prompt">&gt;</span><span>/plugin install graphmux@brainmux</span><CopyButton text="/plugin install graphmux@brainmux" /></div>
                <div className="row"><span className="ok">✓ installed graphmux</span></div>
                <div className="row"><span className="prompt">$</span><span>gmux install</span><span className="cmt">  # pinned CodeGraph, SHA-verified, telemetry off</span></div>
                <div className="row"><span className="prompt">$</span><span>gmux index .</span><CopyButton text="gmux index ." /></div>
                <div className="row"><span className="ok">✓ indexed · 199 nodes, 499 edges</span></div>
              </div>
            </div>
          </div>

          <div className="cards3">
            <div className="card"><span className="k">deterministic</span><h3>Real call-graph, not guesses</h3><p>tree-sitter-grade callers, callees and blast-radius — exact references, not approximate vector matches.</p></div>
            <div className="card"><span className="k">100% local</span><h3>Your code never leaves</h3><p>Indexes to a local SQLite graph. No embeddings API, no cloud, and the vendored engine&apos;s telemetry is forced off.</p></div>
            <div className="card"><span className="k">grounds delegates</span><h3>Cheap brains stop inventing</h3><p><code>bmux delegate --memory</code> wires the graph into a cheap brain, so it queries real symbols before it acts.</p></div>
          </div>
        </section>

        {/* FAQ — visible + FAQPage JSON-LD source (SEO/GEO) */}
        <section id="faq">
          <div className="sec-head"><p className="eyebrow">FAQ</p><h2>Questions, answered.</h2></div>
          <div className="faq">
            {FAQ.map((f) => (
              <div className="qa" key={f.q}>
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot">
          <span className="brand mono">brain<span className="accent">mux</span></span>
          <span>LLM tooling for Claude Code · Engines: LiteLLM · CodeGraph (MIT)</span>
          <span style={{ display: "flex", gap: 20 }}>
            <a href="https://github.com/brainmuxhq/brainmux" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="/">brainmux.com</a>
            <span>MIT</span>
          </span>
        </div>
      </footer>
    </>
  );
}
