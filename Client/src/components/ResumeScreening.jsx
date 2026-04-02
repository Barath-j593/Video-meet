import { useState, useRef } from "react";

// ─── CONFIG — paste your free Gemini key here ────────────────────────────────
// Get it free (no credit card) at: aistudio.google.com → Get API Key
const GEMINI_KEY = "AIzaSyD54GXR74ajA_HJMdO4_GZATUnmFOTencA";
// Remove the space and add the model endpoint
// Use v1beta for Gemini 1.5 Flash to ensure multimodal (PDF) support
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
// ─── API ─────────────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  try {
    const resp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          maxOutputTokens: 2048, 
          temperature: 0.2 
        },
      }),
    });

    if (!resp.ok) {
      const errorData = await resp.json();
      console.error("Gemini API Error:", errorData);
      return `Error: ${resp.status} - ${errorData.error?.message || 'Unknown error'}`;
    }

    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response text found.";
  } catch (err) {
    console.error("Fetch failed:", err);
    return "Failed to connect to the Gemini API.";
  }
}

async function fileToText(file) {
  // Gemini flash accepts base64 PDF inline
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function extractResumeData(file) {
  const base64 = await fileToText(file);
  const resp = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: "application/pdf", data: base64 } },
        { text: "Extract ALL resume info as JSON: name, email, phone, location, summary, total_years_experience (number), current_role, skills (array), education (array of {degree,field,institution,year}), experience (array of {title,company,start_year,end_year,highlights}), certifications (array), notable_achievements (array with numbers). Reply ONLY valid JSON, no markdown." }
      ]}],
      generationConfig: { maxOutputTokens: 2048, temperature: 0 },
    }),
  });
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return { name: file.name, parse_error: true }; }
}

async function rankResumes(candidates, jobSpec) {
  const summaries = candidates.map((c, i) => `[${i}] ${c.name}: ${JSON.stringify(c.parsedData)}`).join("\n\n");
  const text = await callGemini(
    `Job:\n${jobSpec}\n\nCandidates:\n${summaries}\n\nReturn ONLY a JSON array. Each item: {index, score (0-100), match_level ("Strong"|"Good"|"Fair"|"Weak"), top_strengths (2-3 strings), gaps (1-2 strings), recommendation (1 sentence)}. No markdown.`
  );
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return []; }
}

async function askQuestion(question, candidates, jobSpec) {
  const ctx = candidates.map((c, i) => `Candidate ${i+1} — ${c.name}:\n${JSON.stringify(c.parsedData, null, 2)}`).join("\n\n---\n\n");
  return callGemini(
    `You have ${candidates.length} resumes. Job: "${jobSpec}"\n\n${ctx}\n\nQuestion: ${question}\n\nAnswer with EXACT stats from the data. Use markdown tables when comparing candidates.`
  );
}

// ─── Shared DB — swap with your backend API calls ─────────────────────────────
const DB = { candidates: [], jobSpec: "" };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const initials = (n = "") => n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
const AVATAR_COLORS = ["#C084FC","#34D399","#FB923C","#60A5FA","#F472B6","#A78BFA","#2DD4BF","#FACC15"];
const aColor = (id) => AVATAR_COLORS[id % AVATAR_COLORS.length];

const MATCH = {
  Strong: { bg: "#052e16", text: "#4ade80", dot: "#22c55e" },
  Good:   { bg: "#1e3a5f", text: "#93c5fd", dot: "#60a5fa" },
  Fair:   { bg: "#451a03", text: "#fbbf24", dot: "#f59e0b" },
  Weak:   { bg: "#450a0a", text: "#fca5a5", dot: "#ef4444" },
};

function Avatar({ name, id = 0, size = 38 }) {
  const c = aColor(id);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: c + "20", border: `1.5px solid ${c}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 700, color: c, fontFamily: "'Syne',sans-serif", flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function MarkdownRender({ text }) {
  const lines = (text || "").split("\n");
  const parts = [];
  let buf = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim().startsWith("|")) {
      if (buf.length) { parts.push({ type: "text", lines: [...buf] }); buf = []; }
      const tbl = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { tbl.push(lines[i]); i++; }
      parts.push({ type: "table", lines: tbl });
    } else { buf.push(lines[i]); i++; }
  }
  if (buf.length) parts.push({ type: "text", lines: buf });

  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.75, color: "#e2e8f0" }}>
      {parts.map((p, pi) => {
        if (p.type === "table") {
          const rows = p.lines.filter(l => !/^\|[-| :]+\|$/.test(l.trim()));
          return (
            <div key={pi} style={{ overflowX: "auto", margin: "10px 0" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                {rows.map((row, ri) => {
                  const cells = row.split("|").slice(1, -1).map(c => c.trim());
                  const Tag = ri === 0 ? "th" : "td";
                  return (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? "#1e293b" : "transparent" }}>
                      {cells.map((cell, ci) => (
                        <Tag key={ci} style={{ padding: "7px 12px", border: "1px solid #334155", textAlign: "left", fontWeight: ri === 0 ? 600 : 400, color: ri === 0 ? "#94a3b8" : "#cbd5e1", fontSize: 12 }}>{cell}</Tag>
                      ))}
                    </tr>
                  );
                })}
              </table>
            </div>
          );
        }
        return p.lines.map((line, li) => {
          if (!line.trim()) return <div key={`${pi}-${li}`} style={{ height: 6 }} />;
          const html = line
            .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#f1f5f9'>$1</strong>")
            .replace(/`(.*?)`/g, "<code style='background:#1e293b;padding:1px 6px;border-radius:3px;font-size:11px;color:#7dd3fc'>$1</code>");
          return <p key={`${pi}-${li}`} style={{ margin: "2px 0" }} dangerouslySetInnerHTML={{ __html: html }} />;
        });
      })}
    </div>
  );
}

// ─── JOBSEEKER ────────────────────────────────────────────────────────────────
const STEPS = ["Profile","Experience","Skills & Education","Resume Upload"];

function JobSeekerView({ onSwitch }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    firstName:"",lastName:"",email:"",phone:"",location:"",linkedin:"",portfolio:"",
    currentRole:"",currentCompany:"",yearsExp:"",bio:"",
    degree:"",field:"",institution:"",gradYear:"",
    skills:"",certifications:"",languages:"",
    resume:null,
  });
  const fileRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.firstName.trim()) e.firstName = 1;
      if (!form.lastName.trim()) e.lastName = 1;
      if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 1;
      if (!form.phone.trim()) e.phone = 1;
    }
    if (step === 1 && !form.currentRole.trim()) e.currentRole = 1;
    if (step === 3 && !form.resume) e.resume = 1;
    setErrors(e);
    return !Object.keys(e).length;
  };

  const next = () => validate() && setStep(s => Math.min(s+1, 3));
  const back = () => setStep(s => Math.max(s-1, 0));

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    let parsedData = {};
    try { parsedData = await extractResumeData(form.resume); } catch {}
    DB.candidates.push({
      id: DB.candidates.length,
      name: `${form.firstName} ${form.lastName}`,
      email: form.email, phone: form.phone, location: form.location,
      linkedin: form.linkedin, portfolio: form.portfolio,
      currentRole: form.currentRole, currentCompany: form.currentCompany,
      yearsExp: form.yearsExp, bio: form.bio,
      degree: form.degree, field: form.field, institution: form.institution, gradYear: form.gradYear,
      skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
      certifications: form.certifications.split(",").map(s => s.trim()).filter(Boolean),
      languages: form.languages.split(",").map(s => s.trim()).filter(Boolean),
      resumeName: form.resume?.name,
      parsedData,
      submittedAt: new Date().toISOString(),
    });
    setLoading(false);
    setDone(true);
  };

  const renderField = (k, placeholder, type = "text", wide = false) => (
    <div key={k} style={{ gridColumn: wide ? "span 2" : "span 1" }}>
      <input
        type={type}
        placeholder={placeholder}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        style={{
          width: "100%",
          padding: "11px 14px",
          background: errors[k] ? "#2d1515" : "#0f172a",
          border: `1px solid ${errors[k] ? "#ef4444" : "#1e293b"}`,
          borderRadius: 8,
          color: "#e2e8f0",
          fontSize: 14,
          fontFamily: "'DM Sans',sans-serif",
          outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#7c3aed")}
        onBlur={(e) => (e.target.style.borderColor = errors[k] ? "#ef4444" : "#1e293b")}
      />
    </div>
  );

  const renderTextArea = (k, placeholder, rows = 3) => (
    <div key={k} style={{ gridColumn: "span 2" }}>
      <textarea
        placeholder={placeholder}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        rows={rows}
        style={{
          width: "100%",
          padding: "11px 14px",
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          color: "#e2e8f0",
          fontSize: 14,
          fontFamily: "'DM Sans',sans-serif",
          outline: "none",
          resize: "vertical",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#7c3aed")}
        onBlur={(e) => (e.target.style.borderColor = "#1e293b")}
      />
    </div>
  );

  if (done) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#020817" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: 40 }}>
        <div style={{ width: 70, height: 70, borderRadius: "50%", background: "#10b98115", border: "2px solid #10b98140", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 26 }}>✓</div>
        <h2 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 12 }}>Application Received</h2>
        <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
          Thanks, {form.firstName}. Your profile and resume have been submitted. We'll be in touch soon.
        </p>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 20px", textAlign: "left", marginBottom: 24 }}>
          <div style={{ color: "#f1f5f9", fontWeight: 700, marginBottom: 4, fontFamily: "'Syne',sans-serif" }}>{form.firstName} {form.lastName}</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{form.currentRole} · {form.email}</div>
          {form.resume && <div style={{ color: "#10b981", fontSize: 12, marginTop: 8 }}>📄 {form.resume.name}</div>}
        </div>
        <button onClick={() => { setDone(false); setStep(0); setForm({ firstName:"",lastName:"",email:"",phone:"",location:"",linkedin:"",portfolio:"",currentRole:"",currentCompany:"",yearsExp:"",bio:"",degree:"",field:"",institution:"",gradYear:"",skills:"",certifications:"",languages:"",resume:null }); setErrors({}); }}
          style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
          Submit another application
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 252, background: "#0a0f1e", borderRight: "1px solid #1e293b", padding: "36px 24px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ color: "#7c3aed", fontSize: 10, fontFamily: "'Syne',sans-serif", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>JOB SEEKER</div>
          <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, fontFamily: "'Syne',sans-serif", lineHeight: 1.3 }}>Apply for the position</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 8, background: i === step ? "#7c3aed15" : "transparent" }}>
              <div style={{ width: 27, height: 27, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "'Syne',sans-serif", fontWeight: 700, background: i < step ? "#7c3aed" : i === step ? "#7c3aed20" : "#1e293b", color: i < step ? "#fff" : i === step ? "#7c3aed" : "#475569", border: i === step ? "1px solid #7c3aed40" : "none" }}>
                {i < step ? "✓" : `0${i+1}`}
              </div>
              <div style={{ fontSize: 13, fontWeight: i === step ? 600 : 400, color: i === step ? "#e2e8f0" : i < step ? "#7c3aed" : "#475569" }}>{s}</div>
            </div>
          ))}
        </div>
        <button onClick={onSwitch} style={{ padding: "9px 0", background: "none", border: "1px solid #1e293b", borderRadius: 8, color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>← Switch role</button>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: "auto", padding: "44px 52px" }}>
        <div style={{ maxWidth: 540 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ color: "#7c3aed", fontSize: 10, fontWeight: 700, letterSpacing: 2, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>STEP {step+1} OF 4</div>
            <h2 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 6 }}>{STEPS[step]}</h2>
            <p style={{ color: "#475569", fontSize: 14 }}>{["Your name, contact details and links.","Your current role and work background.","Your education, skills and certifications.","Upload your PDF resume to complete the application."][step]}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {step === 0 && (<>
              {renderField("firstName", "First name *")}
              {renderField("lastName", "Last name *")}
              {renderField("email", "Email address *", "email", true)}
              {renderField("phone", "Phone number *")}
              {renderField("location", "City, Country")}
              {renderField("linkedin", "LinkedIn URL", "text", true)}
              {renderField("portfolio", "Portfolio / Website", "text", true)}
            </>)}

            {step === 1 && (<>
              {renderField("currentRole", "Current / most recent role *", "text", true)}
              {renderField("currentCompany", "Company")}
              {renderField("yearsExp", "Years of experience", "number")}
              {renderTextArea("bio", "Professional summary — what you do and what you're looking for…", 4)}
            </>)}

            {step === 2 && (<>
              {renderField("degree", "Degree (B.Sc, M.Sc, PhD…)")}
              {renderField("field", "Field of study")}
              {renderField("institution", "University / Institution")}
              {renderField("gradYear", "Graduation year", "number")}
              {renderTextArea("skills", "Skills, comma separated — React, Python, Leadership, SQL…", 3)}
              {renderTextArea("certifications", "Certifications, comma separated — AWS, PMP, CFA…", 2)}
              {renderField("languages", "Languages spoken, comma separated", "text", true)}
            </>)}

            {step === 3 && (
              <div style={{ gridColumn: "span 2" }}>
                <div
                  onDragOver={e => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") set("resume", f); }}
                  onClick={() => fileRef.current.click()}
                  style={{ border: `2px dashed ${errors.resume ? "#ef4444" : drag ? "#7c3aed" : form.resume ? "#10b981" : "#1e293b"}`, borderRadius: 12, padding: "44px 24px", textAlign: "center", cursor: "pointer", background: form.resume ? "#10b98108" : drag ? "#7c3aed08" : "#0f172a", transition: "all 0.2s", marginBottom: 14 }}
                >
                  <div style={{ fontSize: 38, marginBottom: 10 }}>{form.resume ? "📄" : "📁"}</div>
                  {form.resume
                    ? <><div style={{ color: "#10b981", fontWeight: 600, marginBottom: 4 }}>{form.resume.name}</div><div style={{ color: "#475569", fontSize: 12 }}>{(form.resume.size/1024).toFixed(0)} KB · Click to replace</div></>
                    : <><div style={{ color: "#94a3b8", fontWeight: 500, marginBottom: 4 }}>Drop your resume or click to browse</div><div style={{ color: "#475569", fontSize: 12 }}>PDF only · Max 10 MB</div></>}
                  <input ref={fileRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={e => { if (e.target.files[0]) set("resume", e.target.files[0]); }} />
                </div>
                {errors.resume && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>Please upload your resume PDF</div>}
                <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ color: "#334155", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>APPLICATION PREVIEW</div>
                  <div style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 2 }}>{form.firstName} {form.lastName}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{form.currentRole}{form.currentCompany ? ` at ${form.currentCompany}` : ""} {form.yearsExp ? `· ${form.yearsExp}yr` : ""}</div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{form.email}</div>
                  {form.skills && <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {form.skills.split(",").slice(0,5).map(s => s.trim()).filter(Boolean).map(s => (
                      <span key={s} style={{ padding: "2px 8px", background: "#7c3aed20", color: "#a78bfa", borderRadius: 4, fontSize: 11 }}>{s}</span>
                    ))}
                  </div>}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
            <button onClick={back} disabled={step === 0} style={{ padding: "11px 22px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: step === 0 ? "#1e293b" : "#94a3b8", fontSize: 14, cursor: step === 0 ? "default" : "pointer", fontFamily: "'DM Sans',sans-serif" }}>← Back</button>
            {step < 3
              ? <button onClick={next} style={{ padding: "11px 28px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Continue →</button>
              : <button onClick={submit} disabled={loading} style={{ padding: "11px 28px", borderRadius: 8, border: "none", background: loading ? "#4c1d95" : "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif" }}>{loading ? "Processing…" : "Submit Application"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── INTERVIEWER ──────────────────────────────────────────────────────────────
function InterviewerView({ onSwitch }) {
  const [tab, setTab] = useState("candidates");
  const [jobSpec, setJobSpec] = useState(DB.jobSpec);
  const [specOpen, setSpecOpen] = useState(false);
  const [specDraft, setSpecDraft] = useState(DB.jobSpec);
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [ranking, setRanking] = useState(false);
  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const chatEnd = useRef();

  const candidates = DB.candidates;

  const saveSpec = () => { DB.jobSpec = specDraft; setJobSpec(specDraft); setSpecOpen(false); };
  const toggleAll = () => selected.size === candidates.length ? setSelected(new Set()) : setSelected(new Set(candidates.map(c => c.id)));
  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleRank = async () => {
    const pool = selected.size > 0 ? candidates.filter(c => selected.has(c.id)) : candidates;
    if (!pool.length || !jobSpec.trim()) return;
    setRanking(true);
    setTab("rankings");
    const res = await rankResumes(pool, jobSpec);
    setRankings(res.sort((a,b) => b.score - a.score).map(r => ({ ...r, candidate: pool[r.index] })));
    setRanking(false);
  };

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    const q = question.trim();
    setQuestion("");
    setAsking(true);
    setChat(p => [...p, { role: "user", text: q }]);
    const pool = selected.size > 0 ? candidates.filter(c => selected.has(c.id)) : candidates;
    const ans = await askQuestion(q, pool, jobSpec);
    setChat(p => [...p, { role: "ai", text: ans }]);
    setAsking(false);
    setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const detailC = detail != null ? candidates.find(c => c.id === detail) : null;

  const Tab = ({ id, label, count }) => (
    <button onClick={() => setTab(id)} style={{ padding: "10px 20px", border: "none", background: "none", borderBottom: tab === id ? "2px solid #7c3aed" : "2px solid transparent", color: tab === id ? "#a78bfa" : "#475569", fontFamily: "'DM Sans',sans-serif", fontWeight: tab === id ? 600 : 400, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
      {label}{count != null && <span style={{ background: tab === id ? "#7c3aed30" : "#1e293b", color: tab === id ? "#a78bfa" : "#64748b", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{count}</span>}
    </button>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#020817", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ background: "#0a0f1e", borderBottom: "1px solid #1e293b", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          {specOpen ? (
            <div style={{ display: "flex", gap: 8 }}>
              <textarea value={specDraft} onChange={e => setSpecDraft(e.target.value)} autoFocus placeholder="Paste job description or requirements…"
                style={{ flex: 1, padding: "8px 12px", background: "#0f172a", border: "1px solid #7c3aed", borderRadius: 8, color: "#e2e8f0", fontSize: 13, fontFamily: "'DM Sans',sans-serif", minHeight: 60, resize: "none", outline: "none" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button onClick={saveSpec} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#7c3aed", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Save</button>
                <button onClick={() => setSpecOpen(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Syne',sans-serif" }}>JOB SPECIFICATION</div>
                <div style={{ fontSize: 13, color: jobSpec ? "#94a3b8" : "#334155", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380 }}>{jobSpec || "No spec set — required for AI ranking"}</div>
              </div>
              <button onClick={() => { setSpecOpen(true); setSpecDraft(jobSpec); }} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>{jobSpec ? "Edit" : "+ Add"}</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {jobSpec && candidates.length > 0 && (
            <button onClick={handleRank} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
              {selected.size > 0 ? `Rank ${selected.size} selected` : "Rank all"}
            </button>
          )}
          <button onClick={onSwitch} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#475569", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Switch role</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#0a0f1e", borderBottom: "1px solid #1e293b", display: "flex", padding: "0 24px", flexShrink: 0 }}>
        <Tab id="candidates" label="Candidates" count={candidates.length} />
        <Tab id="rankings" label="Rankings" count={rankings.length || null} />
        <Tab id="ask" label="Ask AI" count={null} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── CANDIDATES ── */}
        {tab === "candidates" && (
          <>
            <div style={{ width: detailC ? 320 : "100%", borderRight: detailC ? "1px solid #1e293b" : "none", overflowY: "auto", padding: "14px" }}>
              {candidates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 24px", color: "#334155" }}>
                  <div style={{ fontSize: 38, marginBottom: 12 }}>👤</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, color: "#475569", marginBottom: 6 }}>No candidates yet</div>
                  <div style={{ fontSize: 13 }}>Submitted applications will appear here</div>
                </div>
              ) : (<>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 12px", borderBottom: "1px solid #1e293b", marginBottom: 10 }}>
                  <input type="checkbox" checked={selected.size === candidates.length && candidates.length > 0} onChange={toggleAll} style={{ width: 14, height: 14, accentColor: "#7c3aed", cursor: "pointer" }} />
                  <span style={{ fontSize: 12, color: "#475569" }}>{selected.size > 0 ? `${selected.size} selected` : "Select all"}</span>
                </div>
                {candidates.map(c => (
                  <div key={c.id} onClick={() => setDetail(detail === c.id ? null : c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px", borderRadius: 8, background: detail === c.id ? "#7c3aed15" : selected.has(c.id) ? "#7c3aed08" : "transparent", border: `1px solid ${detail === c.id ? "#7c3aed40" : selected.has(c.id) ? "#7c3aed20" : "transparent"}`, marginBottom: 5, cursor: "pointer", transition: "all 0.12s" }}>
                    <input type="checkbox" checked={selected.has(c.id)} onClick={e => { e.stopPropagation(); toggle(c.id); }} style={{ width: 14, height: 14, accentColor: "#7c3aed", cursor: "pointer", flexShrink: 0 }} />
                    <Avatar name={c.name} id={c.id} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                      <div style={{ color: "#475569", fontSize: 11, fontFamily: "'DM Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.currentRole}{c.yearsExp ? ` · ${c.yearsExp}yr` : ""}</div>
                    </div>
                    {c.resumeName && <span style={{ fontSize: 10, color: "#10b981", flexShrink: 0 }}>PDF</span>}
                  </div>
                ))}
              </>)}
            </div>

            {/* Detail */}
            {detailC && (
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #1e293b" }}>
                  <Avatar name={detailC.name} id={detailC.id} size={50} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 19, fontWeight: 800, fontFamily: "'Syne',sans-serif", marginBottom: 3 }}>{detailC.name}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{detailC.currentRole}{detailC.currentCompany ? ` at ${detailC.currentCompany}` : ""}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                      {detailC.email && <span style={{ color: "#7c3aed", fontSize: 12 }}>{detailC.email}</span>}
                      {detailC.phone && <span style={{ color: "#475569", fontSize: 12 }}>{detailC.phone}</span>}
                      {detailC.location && <span style={{ color: "#475569", fontSize: 12 }}>📍 {detailC.location}</span>}
                    </div>
                    {detailC.linkedin && <div style={{ marginTop: 4 }}><span style={{ color: "#475569", fontSize: 12 }}>{detailC.linkedin}</span></div>}
                  </div>
                  <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 17 }}>✕</button>
                </div>

                {[
                  { title: "SKILLS", items: detailC.parsedData?.skills || detailC.skills, c: "#a78bfa", bg: "#7c3aed20" },
                  { title: "CERTIFICATIONS", items: detailC.parsedData?.certifications || detailC.certifications, c: "#4ade80", bg: "#16a34a20" },
                  { title: "LANGUAGES", items: detailC.languages, c: "#fbbf24", bg: "#d9770620" },
                ].filter(s => s.items?.length).map(s => (
                  <div key={s.title} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>{s.title}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {s.items.map(x => <span key={x} style={{ padding: "3px 10px", background: s.bg, color: s.c, borderRadius: 4, fontSize: 12 }}>{x}</span>)}
                    </div>
                  </div>
                ))}

                {detailC.parsedData?.education?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>EDUCATION</div>
                    {detailC.parsedData.education.map((e, i) => (
                      <div key={i} style={{ marginBottom: 10, paddingLeft: 12, borderLeft: "2px solid #1e293b" }}>
                        <div style={{ color: "#e2e8f0", fontWeight: 500, fontSize: 13 }}>{e.degree} {e.field}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{e.institution}{e.year ? ` · ${e.year}` : ""}</div>
                      </div>
                    ))}
                  </div>
                )}

                {detailC.parsedData?.experience?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>EXPERIENCE</div>
                    {detailC.parsedData.experience.map((e, i) => (
                      <div key={i} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: "2px solid #1e293b" }}>
                        <div style={{ color: "#e2e8f0", fontWeight: 500, fontSize: 13 }}>{e.title}</div>
                        <div style={{ color: "#7c3aed", fontSize: 12 }}>{e.company}</div>
                        <div style={{ color: "#475569", fontSize: 11 }}>{e.start_year}{e.end_year ? ` – ${e.end_year}` : " – Present"}</div>
                        {e.highlights?.slice(0,2).map((h, hi) => <div key={hi} style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>· {h}</div>)}
                      </div>
                    ))}
                  </div>
                )}

                {detailC.parsedData?.notable_achievements?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>ACHIEVEMENTS</div>
                    {detailC.parsedData.notable_achievements.map((a, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 5, display: "flex", gap: 6 }}><span style={{ color: "#10b981" }}>★</span>{a}</div>
                    ))}
                  </div>
                )}

                {(detailC.parsedData?.summary || detailC.bio) && (
                  <div>
                    <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>SUMMARY</div>
                    <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>{detailC.parsedData?.summary || detailC.bio}</p>
                  </div>
                )}

                {detailC.resumeName && <div style={{ marginTop: 20, padding: "10px 14px", background: "#10b98110", border: "1px solid #10b98130", borderRadius: 8, fontSize: 12, color: "#10b981" }}>📄 {detailC.resumeName}</div>}
              </div>
            )}
          </>
        )}

        {/* ── RANKINGS ── */}
        {tab === "rankings" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            {ranking ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#475569" }}>
                <div style={{ fontSize: 34, marginBottom: 14 }}>⚙️</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, color: "#64748b", marginBottom: 6 }}>AI is ranking candidates…</div>
                <div style={{ fontSize: 13 }}>Analyzing skills, experience & fit</div>
              </div>
            ) : rankings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#334155" }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>🏆</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, color: "#475569", marginBottom: 6 }}>No rankings yet</div>
                <div style={{ fontSize: 13 }}>Set a job spec and click "Rank" to get AI-powered rankings</div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14, maxWidth: 800 }}>
                {rankings.map((r, pos) => {
                  const m = MATCH[r.match_level] || MATCH.Fair;
                  return (
                    <div key={pos} style={{ background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 12, padding: "20px 22px", display: "grid", gridTemplateColumns: "52px 1fr 68px", gap: 16 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: pos < 3 ? 24 : 14, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#475569", background: "#0f172a", border: "1px solid #1e293b" }}>
                        {["🥇","🥈","🥉"][pos] || `#${pos+1}`}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ color: "#f1f5f9", fontWeight: 700, fontFamily: "'Syne',sans-serif", fontSize: 14 }}>{r.candidate?.name}</span>
                          <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: m.bg, color: m.text, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.dot, display: "inline-block" }} />{r.match_level}
                          </span>
                        </div>
                        <div style={{ color: "#475569", fontSize: 11, fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>{r.candidate?.currentRole}{r.candidate?.yearsExp ? ` · ${r.candidate.yearsExp}yr` : ""}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 9, color: "#334155", fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Syne',sans-serif", marginBottom: 5 }}>STRENGTHS</div>
                            {r.top_strengths?.map((s,i) => <div key={i} style={{ fontSize: 12, color: "#4ade80", display: "flex", gap: 5, marginBottom: 2 }}><span>✓</span>{s}</div>)}
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "#334155", fontWeight: 700, letterSpacing: 1.5, fontFamily: "'Syne',sans-serif", marginBottom: 5 }}>GAPS</div>
                            {r.gaps?.map((g,i) => <div key={i} style={{ fontSize: 12, color: "#f87171", display: "flex", gap: 5, marginBottom: 2 }}><span>✗</span>{g}</div>)}
                          </div>
                        </div>
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e293b", fontSize: 12, color: "#475569", fontStyle: "italic" }}>{r.recommendation}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 34, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: r.score >= 70 ? "#4ade80" : r.score >= 50 ? "#a78bfa" : "#fbbf24" }}>{r.score}</div>
                        <div style={{ fontSize: 11, color: "#334155" }}>/100</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ASK AI ── */}
        {tab === "ask" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 24px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: "#475569" }}>
                Querying: <strong style={{ color: "#a78bfa" }}>{selected.size > 0 ? `${selected.size} selected candidates` : `all ${candidates.length} candidates`}</strong>
              </span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {chat.length === 0 && (
                <div>
                  <div style={{ fontSize: 12, color: "#334155", marginBottom: 10 }}>Suggested questions</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["Compare all candidates' experience in a table","Who has the most relevant skills?","List all education details","Which have leadership experience?","Summarize top 3 with pros and cons","Who has the highest years of experience?"].map(q => (
                      <button key={q} onClick={() => setQuestion(q)} style={{ padding: "6px 13px", borderRadius: 20, border: "1px solid #1e293b", background: "#0f172a", color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {chat.map((msg, i) => (
                <div key={i} style={{ display: "flex", gap: 10, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  {msg.role === "ai" && <div style={{ width: 28, height: 28, borderRadius: 8, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>🤖</div>}
                  <div style={{ maxWidth: "82%", padding: "12px 16px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: msg.role === "user" ? "#7c3aed" : "#0f172a", border: msg.role === "ai" ? "1px solid #1e293b" : "none" }}>
                    {msg.role === "ai" ? <MarkdownRender text={msg.text} /> : <span style={{ color: "#fff", fontSize: 13.5 }}>{msg.text}</span>}
                  </div>
                </div>
              ))}
              {asking && (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🤖</div>
                  <div style={{ padding: "12px 16px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px 12px 12px 2px", color: "#334155", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>Analyzing…</div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid #1e293b", display: "flex", gap: 10, flexShrink: 0 }}>
              <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAsk()} placeholder="Ask about skills, experience, comparisons…"
                style={{ flex: 1, padding: "11px 16px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none" }}
                onFocus={e => e.target.style.borderColor="#7c3aed"} onBlur={e => e.target.style.borderColor="#1e293b"} />
              <button onClick={handleAsk} disabled={!question.trim() || asking} style={{ padding: "11px 22px", borderRadius: 8, border: "none", background: (!question.trim()||asking) ? "#4c1d95" : "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 600, cursor: (!question.trim()||asking) ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif" }}>Ask →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');`;

export default function App({ defaultRole = null }) {
  const [role, setRole] = useState(defaultRole);
  const [tick, setTick] = useState(0);
  const switchRole = () => { setRole(null); setTick(t => t+1); };

  return (
    <>
      <style>{FONTS}{`*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'DM Sans',sans-serif;background:#020817;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px;}input::placeholder,textarea::placeholder{color:#334155;}`}</style>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#020817" }}>
        {/* Header */}
        <div style={{ background: "#0a0f1e", borderBottom: "1px solid #1e293b", padding: "13px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, background: "#7c3aed", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⟨/⟩</div>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 14, fontFamily: "'Syne',sans-serif" }}>ResumeIQ</div>
            <div style={{ color: "#334155", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>AI screening · ranking · Q&A</div>
          </div>
          {role && (
            <div style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 20, background: role === "interviewer" ? "#7c3aed20" : "#10b98120", color: role === "interviewer" ? "#a78bfa" : "#34d399", fontSize: 10, fontWeight: 700, fontFamily: "'Syne',sans-serif", letterSpacing: 1 }}>
              {role === "interviewer" ? "INTERVIEWER" : "JOB SEEKER"}
            </div>
          )}
        </div>

        {/* Landing / App */}
        {!role ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#020817" }}>
            <div style={{ textAlign: "center", maxWidth: 520, padding: "0 24px", width: "100%" }}>
              <div style={{ marginBottom: 44 }}>
                <div style={{ color: "#7c3aed", fontSize: 10, fontWeight: 700, letterSpacing: 3, fontFamily: "'Syne',sans-serif", marginBottom: 14 }}>RESUME INTELLIGENCE PLATFORM</div>
                <h1 style={{ color: "#f1f5f9", fontSize: 36, fontWeight: 800, fontFamily: "'Syne',sans-serif", lineHeight: 1.1, marginBottom: 14 }}>Who are you<br/>here as?</h1>
                <p style={{ color: "#475569", fontSize: 15 }}>Select your role to get the right experience.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { id: "jobseeker", emoji: "👤", title: "Job Seeker", desc: "Fill in your details, upload your resume, and apply.", color: "#10b981", bg: "#10b98110", border: "#10b98130", hborder: "#10b981" },
                  { id: "interviewer", emoji: "🎯", title: "Interviewer", desc: "Review applicants, rank candidates, and query with AI.", color: "#7c3aed", bg: "#7c3aed10", border: "#7c3aed30", hborder: "#7c3aed" },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setRole(opt.id)}
                    style={{ padding: "30px 22px", border: `1px solid ${opt.border}`, borderRadius: 14, background: opt.bg, cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}
                    onMouseOver={e => e.currentTarget.style.borderColor = opt.hborder}
                    onMouseOut={e => e.currentTarget.style.borderColor = opt.border}>
                    <div style={{ fontSize: 30, marginBottom: 12 }}>{opt.emoji}</div>
                    <div style={{ color: opt.color, fontWeight: 800, fontSize: 17, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>{opt.title}</div>
                    <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 36, display: "flex", gap: 20, justifyContent: "center" }}>
                {[["AI PDF parsing","#7c3aed"],["Smart ranking 0-100","#10b981"],["RAG Q&A + tables","#f59e0b"]].map(([label, c]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
                    <span style={{ fontSize: 11, color: "#475569" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {role === "jobseeker"
              ? <JobSeekerView key={tick} onSwitch={switchRole} />
              : <InterviewerView key={tick} onSwitch={switchRole} />}
          </div>
        )}
      </div>
    </>
  );
}