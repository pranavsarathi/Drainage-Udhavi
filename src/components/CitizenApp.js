import React, { useState, useEffect } from "react";
import { db, storage } from "../firebase";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

function CitizenApp({ user }) {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [location, setLocation] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [myComplaints, setMyComplaints] = useState([]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
    const q = query(collection(db, "complaints"), where("citizenUID", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setMyComplaints(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user.uid]);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setAiResult(null);
  };

  const analyzeWithAI = async () => {
    if (!photo) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(photo);
      reader.onload = async () => {
        const base64 = reader.result.split(",")[1];
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.REACT_APP_CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-opus-4-5",
            max_tokens: 300,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: photo.type, data: base64 } },
                { type: "text", text: "Analyze this drainage/drain image. Respond ONLY in JSON: {\"tag\": \"Trash|Silt|Overflow|Broken Pipe|Clear\", \"severity\": \"High|Medium|Low\", \"description\": \"one sentence\", \"suggestion\": \"immediate action for citizen\"}" }
              ]
            }]
          })
        });
        const data = await response.json();
        const text = data.content[0].text;
        const clean = text.replace(/```json|```/g, "").trim();
        setAiResult(JSON.parse(clean));
        setLoading(false);
      };
    } catch (e) {
      console.error(e);
      setAiResult({ tag: "Trash", severity: "Medium", description: "Blocked drain detected", suggestion: "Keep area clear" });
      setLoading(false);
    }
  };

  const submitComplaint = async () => {
    if (!photo || !aiResult || !location) return;
    setLoading(true);
    try {
      const storageRef = ref(storage, `complaints/${Date.now()}_${photo.name}`);
      await uploadBytes(storageRef, photo);
      const photoURL = await getDownloadURL(storageRef);
      await addDoc(collection(db, "complaints"), {
        citizenUID: user.uid,
        citizenName: user.displayName,
        citizenEmail: user.email,
        gpsLat: location.lat,
        gpsLng: location.lng,
        beforePhotoURL: photoURL,
        aiTag: aiResult.tag,
        aiSeverity: aiResult.severity,
        aiDescription: aiResult.description,
        status: "red",
        workerUID: null,
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      setPhoto(null);
      setPreview(null);
      setAiResult(null);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const statusColor = { red: "#ff4444", yellow: "#ffaa00", blue: "#4444ff", orange: "#ff8800", green: "#44aa44" };
  const statusLabel = { red: "🔴 Complaint Issued", yellow: "🟡 Worker Assigned", blue: "🔵 Work In Progress", orange: "🟠 Pending", green: "🟢 Completed" };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Report a Drainage Issue</h2>
      {submitted && <div style={styles.success}>✅ Complaint submitted successfully!</div>}
      <div style={styles.card}>
        <label style={styles.uploadBtn}>
          📷 Take / Upload Photo
          <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
        </label>
        {preview && <img src={preview} alt="preview" style={styles.preview} />}
        {location && <p style={styles.gpsText}>📍 GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>}
        {photo && !aiResult && (
          <button onClick={analyzeWithAI} style={styles.analyzeBtn} disabled={loading}>
            {loading ? "🤖 Analyzing..." : "🤖 Analyze with AI"}
          </button>
        )}
        {aiResult && (
          <div style={styles.aiBox}>
            <h3>AI Analysis Result</h3>
            <p><b>Problem:</b> {aiResult.tag} ({aiResult.severity} severity)</p>
            <p><b>Description:</b> {aiResult.description}</p>
            <p><b>Suggestion:</b> {aiResult.suggestion}</p>
            <button onClick={submitComplaint} style={styles.submitBtn} disabled={loading}>
              {loading ? "Submitting..." : "✅ Submit Complaint"}
            </button>
          </div>
        )}
      </div>

      <h2 style={styles.heading}>My Complaints</h2>
      {myComplaints.length === 0 && <p style={styles.gpsText}>No complaints yet.</p>}
      {myComplaints.map((c) => (
        <div key={c.id} style={{ ...styles.complaintCard, borderLeft: `5px solid ${statusColor[c.status]}` }}>
          <div style={{ display: "flex", gap: 10 }}>
            {c.beforePhotoURL && <img src={c.beforePhotoURL} alt="before" style={styles.thumb} />}
            {c.afterPhotoURL && <img src={c.afterPhotoURL} alt="after" style={styles.thumb} />}
          </div>
          <p><b>{aiResult?.tag || c.aiTag}</b> — {c.aiDescription}</p>
          <p style={{ color: statusColor[c.status] }}>{statusLabel[c.status]}</p>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: { maxWidth: 600, margin: "0 auto", padding: 20 },
  heading: { color: "#333", marginTop: 30 },
  card: { background: "white", borderRadius: 12, padding: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.1)", marginBottom: 20 },
  uploadBtn: { display: "block", background: "#667eea", color: "white", padding: "12px 20px", borderRadius: 8, textAlign: "center", cursor: "pointer", marginBottom: 10 },
  preview: { width: "100%", borderRadius: 8, marginBottom: 10 },
  gpsText: { color: "#888", fontSize: 13 },
  analyzeBtn: { width: "100%", background: "#764ba2", color: "white", border: "none", padding: 12, borderRadius: 8, fontSize: 16, cursor: "pointer" },
  aiBox: { background: "#f0f4ff", borderRadius: 8, padding: 15, marginTop: 10 },
  submitBtn: { width: "100%", background: "#44aa44", color: "white", border: "none", padding: 12, borderRadius: 8, fontSize: 16, cursor: "pointer", marginTop: 10 },
  complaintCard: { background: "white", borderRadius: 8, padding: 15, marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  thumb: { width: 80, height: 80, objectFit: "cover", borderRadius: 6 },
  success: { background: "#d4edda", color: "#155724", padding: 12, borderRadius: 8, marginBottom: 15 },
};

export default CitizenApp;