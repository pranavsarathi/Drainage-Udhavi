import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const makeIcon = (color) => L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [20, 20],
});

const statusColor = { red: "#ff4444", yellow: "#ffaa00", blue: "#4444ff", orange: "#ff8800", green: "#44aa44" };
const statusLabel = { red: "🔴 Complaint Issued", yellow: "🟡 Assigned", blue: "🔵 In Progress", orange: "🟠 Pending", green: "🟢 Completed" };

function Dashboard() {
  const [complaints, setComplaints] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "complaints"), (snap) => {
      setComplaints(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const assignWorker = async (id) => {
    await updateDoc(doc(db, "complaints", id), { status: "yellow" });
  };

  const filtered = filter === "all" ? complaints : complaints.filter(c => c.status === filter);
  const counts = { all: complaints.length, red: 0, yellow: 0, blue: 0, orange: 0, green: 0 };
  complaints.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });

  const center = complaints.find(c => c.gpsLat)
    ? [complaints.find(c => c.gpsLat).gpsLat, complaints.find(c => c.gpsLat).gpsLng]
    : [13.0827, 80.2707];

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Municipal Dashboard</h2>

      <div style={styles.statsRow}>
        {["all", "red", "yellow", "blue", "orange", "green"].map(s => (
          <div key={s} onClick={() => setFilter(s)} style={{ ...styles.statCard, background: s === "all" ? "#667eea" : statusColor[s], opacity: filter === s ? 1 : 0.7, cursor: "pointer" }}>
            <div style={styles.statNum}>{counts[s]}</div>
            <div style={styles.statLabel}>{s === "all" ? "Total" : s.charAt(0).toUpperCase() + s.slice(1)}</div>
          </div>
        ))}
      </div>

      <div style={styles.mapContainer}>
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {complaints.filter(c => c.gpsLat).map(c => (
            <Marker key={c.id} position={[c.gpsLat, c.gpsLng]} icon={makeIcon(statusColor[c.status])}
              eventHandlers={{ click: () => setSelected(c) }}>
              <Popup>
                <b>{c.aiTag}</b> — {c.aiSeverity}<br />
                {statusLabel[c.status]}<br />
                {c.citizenName}<br />
                {c.status === "red" && (
                  <button onClick={() => assignWorker(c.id)} style={styles.assignBtn}>Assign Worker</button>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {selected && (
        <div style={styles.detailCard}>
          <h3>Complaint Detail</h3>
          <div style={{ display: "flex", gap: 10 }}>
            {selected.beforePhotoURL && (
              <div>
                <p style={styles.photoLabel}>Before</p>
                <img src={selected.beforePhotoURL} alt="before" style={styles.detailImg} />
              </div>
            )}
            {selected.afterPhotoURL && (
              <div>
                <p style={styles.photoLabel}>After</p>
                <img src={selected.afterPhotoURL} alt="after" style={styles.detailImg} />
              </div>
            )}
          </div>
          <p><b>Problem:</b> {selected.aiTag} ({selected.aiSeverity})</p>
          <p><b>Description:</b> {selected.aiDescription}</p>
          <p><b>Citizen:</b> {selected.citizenName}</p>
          <p><b>Worker:</b> {selected.workerName || "Not assigned"}</p>
          <p><b>Status:</b> <span style={{ color: statusColor[selected.status] }}>{statusLabel[selected.status]}</span></p>
          {selected.aiVerification && <p><b>AI Verification:</b> {selected.aiVerification}</p>}
          <button onClick={() => setSelected(null)} style={styles.closeBtn}>Close</button>
        </div>
      )}

      <h3 style={styles.heading}>All Complaints</h3>
      {filtered.map(c => (
        <div key={c.id} onClick={() => setSelected(c)} style={{ ...styles.row, borderLeft: `5px solid ${statusColor[c.status]}` }}>
          {c.beforePhotoURL && <img src={c.beforePhotoURL} alt="" style={styles.rowThumb} />}
          <div style={styles.rowInfo}>
            <p style={styles.rowTitle}>{c.aiTag} — {c.aiSeverity} severity</p>
            <p style={styles.rowSub}>{c.citizenName} • {c.aiDescription}</p>
            <p style={{ color: statusColor[c.status], fontSize: 13 }}>{statusLabel[c.status]}</p>
          </div>
          {c.status === "red" && (
            <button onClick={(e) => { e.stopPropagation(); assignWorker(c.id); }} style={styles.assignBtn}>
              Assign
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: { maxWidth: 900, margin: "0 auto", padding: 20 },
  heading: { color: "#333" },
  statsRow: { display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" },
  statCard: { flex: 1, minWidth: 80, color: "white", borderRadius: 10, padding: "12px 8px", textAlign: "center" },
  statNum: { fontSize: 28, fontWeight: "bold" },
  statLabel: { fontSize: 12 },
  mapContainer: { height: 400, borderRadius: 12, overflow: "hidden", marginBottom: 20, border: "2px solid #ddd" },
  detailCard: { background: "white", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" },
  detailImg: { width: 140, height: 100, objectFit: "cover", borderRadius: 8 },
  photoLabel: { fontSize: 12, color: "#888", margin: "0 0 4px" },
  row: { background: "white", borderRadius: 8, padding: 12, marginBottom: 8, display: "flex", gap: 12, alignItems: "center", cursor: "pointer", boxShadow: "0 1px 6px rgba(0,0,0,0.08)" },
  rowThumb: { width: 60, height: 60, objectFit: "cover", borderRadius: 6 },
  rowInfo: { flex: 1 },
  rowTitle: { fontWeight: "bold", margin: 0 },
  rowSub: { color: "#666", fontSize: 13, margin: "3px 0" },
  assignBtn: { background: "#ffaa00", color: "white", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer" },
  closeBtn: { background: "#666", color: "white", border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer", marginTop: 10 },
};

export default Dashboard;