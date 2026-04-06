import React, { useState, useEffect } from "react";
import { db, storage } from "../firebase";
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

function WorkerApp({ user }) {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [afterPhoto, setAfterPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "complaints"), where("status", "in", ["yellow", "blue", "orange"]));
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const acceptTask = async (task) => {
    await updateDoc(doc(db, "complaints", task.id), {
      status: "blue",
      workerUID: user.uid,
      workerName: user.displayName,
      assignedAt: serverTimestamp(),
    });
    setActiveTask({ ...task, status: "blue" });
  };

  const markPending = async (task) => {
    await updateDoc(doc(db, "complaints", task.id), { status: "orange" });
  };

  const handleAfterPhoto = (e) => {
    setAfterPhoto(e.target.files[0]);
  };

  const verifyAndComplete = async () => {
    if (!afterPhoto || !activeTask) return;
    setVerifying(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(afterPhoto);
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
            max_tokens: 100,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: afterPhoto.type, data: base64 } },
                { type: "text", text: "Is this drain clean and clear? Respond ONLY in JSON: {\"pass\": true/false, \"reason\": \"one sentence\"}" }
              ]
            }]
          })
        });
        const data = await response.json();
        const text = data.content[0].text;
        const clean = text.replace(/```json|```/g, "").trim();
        const result = JSON.parse(clean);

        if (result.pass) {
          const storageRef = ref(storage, `after/${Date.now()}_after.jpg`);
          await uploadBytes(storageRef, afterPhoto);
          const afterURL = await getDownloadURL(storageRef);
          await updateDoc(doc(db, "complaints", activeTask.id), {
            status: "green",
            afterPhotoURL: afterURL,
            completedAt: serverTimestamp(),
            aiVerification: result.reason,
          });
          setActiveTask(null);
          setAfterPhoto(null);
          alert("✅ AI Verified! Task marked as Complete.");
        } else {
          alert(`❌ AI says drain not clean: ${result.reason}. Please clean again.`);
        }
        setVerifying(false);
      };
    } catch (e) {
      console.error(e);
      setVerifying(false);
    }
  };

  const statusColor = { red: "#ff4444", yellow: "#ffaa00", blue: "#4444ff", orange: "#ff8800", green: "#44aa44" };
  const toolMap = { Trash: "🪝 Bring hooks & gloves", Silt: "🪛 Bring shovels & pump", Overflow: "💧 Bring pump & barriers", "Broken Pipe": "🔧 Bring pipe tools" };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>My Tasks</h2>
      {activeTask && (
        <div style={styles.activeCard}>
          <h3>🔵 Active Task</h3>
          <img src={activeTask.beforePhotoURL} alt="before" style={styles.preview} />
          <p><b>Problem:</b> {activeTask.aiTag} ({activeTask.aiSeverity})</p>
          <p><b>Description:</b> {activeTask.aiDescription}</p>
          <p><b>Location:</b> {activeTask.gpsLat?.toFixed(4)}, {activeTask.gpsLng?.toFixed(4)}</p>
          <p style={styles.toolTip}>{toolMap[activeTask.aiTag] || "🔧 Bring standard tools"}</p>
          <a href={`https://www.google.com/maps?q=${activeTask.gpsLat},${activeTask.gpsLng}`} target="_blank" rel="noreferrer" style={styles.mapBtn}>
            📍 Open in Maps
          </a>
          <div style={styles.afterSection}>
            <h4>Upload After Photo for AI Verification:</h4>
            <label style={styles.uploadBtn}>
              📷 Take After Photo
              <input type="file" accept="image/*" capture="environment" onChange={handleAfterPhoto} style={{ display: "none" }} />
            </label>
            {afterPhoto && <p style={{ color: "green" }}>✅ Photo ready</p>}
            <button onClick={verifyAndComplete} style={styles.verifyBtn} disabled={!afterPhoto || verifying}>
              {verifying ? "🤖 AI Verifying..." : "🤖 Verify & Complete"}
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 && !activeTask && <p style={styles.empty}>No tasks assigned yet.</p>}
      {tasks.filter(t => t.status === "yellow" && !activeTask).map((task) => (
        <div key={task.id} style={styles.taskCard}>
          <img src={task.beforePhotoURL} alt="before" style={styles.thumb} />
          <div style={styles.taskInfo}>
            <p><b>{task.aiTag}</b> — {task.aiSeverity} severity</p>
            <p style={styles.desc}>{task.aiDescription}</p>
            <p style={styles.desc}>📍 {task.gpsLat?.toFixed(4)}, {task.gpsLng?.toFixed(4)}</p>
            <p style={styles.toolTip}>{toolMap[task.aiTag] || "🔧 Standard tools"}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => acceptTask(task)} style={styles.acceptBtn}>Accept Task</button>
              <button onClick={() => markPending(task)} style={styles.pendingBtn}>Mark Pending</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: { maxWidth: 600, margin: "0 auto", padding: 20 },
  heading: { color: "#333" },
  activeCard: { background: "#e8f4ff", borderRadius: 12, padding: 20, marginBottom: 20, border: "2px solid #4444ff" },
  preview: { width: "100%", borderRadius: 8, marginBottom: 10 },
  taskCard: { background: "white", borderRadius: 12, padding: 15, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", display: "flex", gap: 12 },
  thumb: { width: 90, height: 90, objectFit: "cover", borderRadius: 8 },
  taskInfo: { flex: 1 },
  desc: { color: "#666", fontSize: 13, margin: "3px 0" },
  toolTip: { background: "#fff3cd", padding: "4px 8px", borderRadius: 6, fontSize: 13, marginBottom: 8 },
  acceptBtn: { background: "#44aa44", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer" },
  pendingBtn: { background: "#ff8800", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer" },
  afterSection: { marginTop: 15, borderTop: "1px solid #ccc", paddingTop: 15 },
  uploadBtn: { display: "block", background: "#667eea", color: "white", padding: "10px 16px", borderRadius: 8, textAlign: "center", cursor: "pointer", marginBottom: 8 },
  verifyBtn: { width: "100%", background: "#764ba2", color: "white", border: "none", padding: 12, borderRadius: 8, fontSize: 16, cursor: "pointer" },
  mapBtn: { display: "inline-block", background: "#4285F4", color: "white", padding: "8px 16px", borderRadius: 8, textDecoration: "none", marginBottom: 10 },
  empty: { color: "#888", textAlign: "center", marginTop: 40 },
};

export default WorkerApp;