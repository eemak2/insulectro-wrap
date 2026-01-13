"use client";
import { useMemo, useState } from "react";

const ACTIONS = [
  { id: "call_plan", label: "Generate Call Plan" },
  { id: "objections", label: "Handle Objections" },
  { id: "qual_plan", label: "Qualification Plan" },
  { id: "wrap_summary", label: "Create Wrap Summary" },
];

export default function Home() {
  const [wrap, setWrap] = useState({
    project: "",
    customerType: "PCB Fab",
    application: "High-speed digital (HSD)",
    stage: "Qualification",
    priority: "Reliability / consistency",
    category: "Laminates & Prepregs",
    signal: "Impedance-controlled / low-loss focus (if relevant)",
    thermal: "Thermal cycling / reliability priority",
    mechanical: "Rigid (default) / add notes if flex/rigid-flex",
    supply: "Need stable supply; avoid line-down risk",
    current: "",
  });

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Tell me what you’re building and what matters most (performance, reliability, lead time, cost). If you don’t know, just describe the end use and constraints.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  const wrapSummaryLine = useMemo(() => {
    return `${wrap.customerType} • ${wrap.application} • ${wrap.stage} • Priority: ${wrap.priority} • Category: ${wrap.category}`;
  }, [wrap]);

async function runAction(actionId: string) {
    setLoading(true);
    const next = [...messages, { role: "user", content: `[Action: ${actionId}]` }];

    const r = await fetch("/api/wrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wrap, action: actionId, messages: next }),
    });

    const data = await r.json();
    setLoading(false);

    if (data?.text) {
      setMessages([...next, { role: "assistant", content: data.text }]);
    } else {
      setMessages([
        ...next,
        { role: "assistant", content: `Error: ${data?.error || "Unknown error"}\n${data?.detail || ""}`.trim() },
      ]);
    }
  }

  async function sendChat() {
    if (!draft.trim()) return;
    const next = [...messages, { role: "user", content: draft.trim() }];
    setMessages(next);
    setDraft("");
    setLoading(true);

    const r = await fetch("/api/wrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wrap, action: "chat", messages: next }),
    });

    const data = await r.json();
    setLoading(false);

    if (data?.text) setMessages([...next, { role: "assistant", content: data.text }]);
    else setMessages([...next, { role: "assistant", content: `Error: ${data?.error || "Unknown error"}\n${data?.detail || ""}`.trim() }]);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0 }}>Insulectro Materials Advisor</h1>
          <div style={styles.sub}>
            Technical guidance for PCB materials (incl. EMC / Elite Materials Co. laminate systems).
          </div>
        </div>
        <div style={styles.badge}>{wrapSummaryLine}</div>
      </header>

      <div style={styles.grid}>
        <section style={styles.card}>
          <h2 style={styles.h2}>Project Setup (Add Context)</h2>

          <Field label="Project / Program name (optional)" value={wrap.project} onChange={(v: string)=>setWrap({...wrap, project:v})} />
          <Row>
            <Select label="Customer type" value={wrap.customerType} onChange={(v: string)=>setWrap({...wrap, customerType:v})}
              options={["PCB Fab","OEM","EMS","Printed electronics"]} />
            <Select label="Stage" value={wrap.stage} onChange={(v: string)=>setWrap({...wrap, stage:v})}
              options={["Design / selection","Qualification","Production","Supply disruption"]} />
          </Row>

          <Select label="Application" value={wrap.application} onChange={(v: string)=>setWrap({...wrap, application:v})}
            options={["High-speed digital (HSD)","RF / Microwave","HDI / mSAP","Power / thermal-heavy","Flex / Rigid-flex","General FR-4"]} />

          <Row>
            <Select label="Priority" value={wrap.priority} onChange={(v: string)=>setWrap({...wrap, priority:v})}
              options={["Reliability / consistency","Lead time / availability","Cost / value","Performance / loss","Qualification speed"]} />
            <Select label="Category focus" value={wrap.category} onChange={(v: string)=>setWrap({...wrap, category:v})}
              options={["Laminates & Prepregs","Copper Foil","Process & Lamination materials"]} />
          </Row>

          <Field label="Signal / impedance notes" value={wrap.signal} onChange={(v: string)=>setWrap({...wrap, signal:v})} />
          <Field label="Thermal / reliability notes" value={wrap.thermal} onChange={(v: string)=>setWrap({...wrap, thermal:v})} />
          <Field label="Mechanical / form factor notes" value={wrap.mechanical} onChange={(v: string)=>setWrap({...wrap, mechanical:v})} />
          <Field label="Supply / lead time sensitivity" value={wrap.supply} onChange={(v: string)=>setWrap({...wrap, supply:v})} />
          <Field label="Current material situation (optional)" value={wrap.current} onChange={(v: string)=>setWrap({...wrap, current:v})} />

          <div style={styles.actions}>
            {ACTIONS.map(a => (
              <button key={a.id} onClick={()=>runAction(a.id)} style={styles.button} disabled={loading}>
                {a.label}
              </button>
            ))}
          </div>

          <div style={styles.note}>
            Note: This tool avoids competitor comparisons and does not invent specs or pricing. It will recommend verifying via datasheets/quotes.
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.h2}>Technical Guidance</h2>

          <div style={styles.thread}>
            {messages.map((m, i) => (
              <div key={i} style={m.role === "user" ? styles.msgUser : styles.msgAsst}> 
<div style={styles.msgRole}>{m.role === "user" ? "You" : "Insulectro Advisor"}</div>
                <div style={styles.msgText}>{m.content}</div>
              </div>
            ))}
            {loading && <div style={{ opacity: 0.7 }}>Thinking…</div>}
          </div>

          <div style={styles.chatRow}>
            <input
              value={draft}
              onChange={(e)=>setDraft(e.target.value)}
              placeholder="Ask a question (e.g., ‘How do I qualify an EMC laminate for HSD?’)"
              style={styles.input}
              onKeyDown={(e)=> e.key === "Enter" ? sendChat() : null}
            />
            <button onClick={sendChat} style={styles.button} disabled={loading}>Send</button>
          </div>
        </section>
      </div>
    </div>
  );
}

type RowProps = { children: React.ReactNode };

function Row({ children }: RowProps) {
  return <div style={styles.row}>{children}</div>;
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
};

function Field({ label, value, onChange }: FieldProps) {
  return (
    <label style={styles.label}>
      <div style={styles.labelText}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.inputWide}
      />
    </label>
  );
}

type SelectProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
};

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label style={styles.label}>
      <div style={styles.labelText}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

const styles = {
  page: {
    maxWidth: 1200,
    margin: "28px auto",
    padding: 16,
    fontFamily: "system-ui",
    background: "#ffffff",
    color: "#111111",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    borderBottom: "1px solid #eee",
    paddingBottom: 14,
    marginBottom: 10,
  },

  sub: { color: "#444", marginTop: 6, lineHeight: 1.35 },

  badge: {
    padding: "10px 12px",
    border: "1px solid #e5e5e5",
    borderRadius: 14,
    maxWidth: 420,
    fontSize: 13,
    color: "#111",
    background: "#fff",
    boxShadow: "0 1px 10px rgba(0,0,0,0.04)",
  },

  grid: { display: "grid", gridTemplateColumns: "420px 1fr", gap: 16, marginTop: 16 },

  card: {
    border: "1px solid #e6e6e6",
    borderRadius: 16,
    padding: 16,
    background: "#ffffff",
    boxShadow: "0 2px 18px rgba(0,0,0,0.05)",
  },

  h2: { margin: "0 0 12px 0", fontSize: 18, color: "#b30000" }, // Insulectro-ish red

  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },

  label: { display: "block", marginBottom: 10 },

  labelText: { fontSize: 12, color: "#555", marginBottom: 6 },

  inputWide: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
  },

  select: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "#fff",
    outline: "none",
  },

  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },

  button: {
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #b30000",
    background: "#b30000",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 600,
  },

  note: { marginTop: 12, fontSize: 12, color: "#666", lineHeight: 1.35 },

  thread: {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 12,
    minHeight: 420,
    maxHeight: 520,
    overflow: "auto",
    background: "#fff",
  },

  msgUser: {
    padding: 10,
    borderRadius: 12,
    background: "#fff5f5",          // subtle red tint
    border: "1px solid #ffd6d6",
    marginBottom: 10,
  },

  msgAsst: {
    padding: 10,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #f0f0f0",
    marginBottom: 10,
  },

  msgRole: { fontSize: 12, color: "#666", marginBottom: 6 },

  msgText: { whiteSpace: "pre-wrap", color: "#111" },

  chatRow: { display: "flex", gap: 10, marginTop: 12 },

  input: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ddd",
    outline: "none",
  },
};

