import {
  Activity,
  AudioLines,
  Bot,
  Box,
  BrainCircuit,
  FileText,
  Image,
  Link,
  Loader2,
  MessageSquare,
  Plus,
  RadioTower,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const API = import.meta.env.VITE_API_URL || "http://localhost:8897";

type Modality = "text" | "url" | "pdf" | "image" | "audio" | "video" | "query";

type RackPoint = {
  id: string;
  source_id: string;
  title: string;
  modality: Modality;
  projection: { x: number; y: number; z: number };
  color: string;
  preview?: string;
  score?: number;
};

type RackSource = {
  id: string;
  title: string;
  modality: Modality;
  summary: string;
  chunks: number;
  created_at: number;
  metadata?: Record<string, unknown>;
};

type SpaceSnapshot = {
  sources: RackSource[];
  points: RackPoint[];
  events: Array<Record<string, unknown>>;
  provider: string;
  dimensions: number;
  model: string;
  projection?: { method: string; basis: string };
};

type Match = {
  id: string;
  source_id: string;
  title: string;
  modality: Modality;
  text: string;
  score: number;
  projection: { x: number; y: number; z: number };
};

type AskResponse = {
  answer: string;
  matches: Match[];
  query_point: RackPoint;
  trace: Array<{ agent: string; status: string; detail: string }>;
  space: SpaceSnapshot;
};

const modalityIcon: Record<Modality, React.ElementType> = {
  text: FileText,
  url: Link,
  pdf: FileText,
  image: Image,
  audio: AudioLines,
  video: Video,
  query: Search,
};

const sampleText = `Gemini Embedding 2 maps text, images, audio, video, and PDFs into one shared semantic vector space. In agentic RAG, the agent first embeds source chunks with a retrieval-document task prefix, then embeds user questions with a question-answering query prefix, retrieves nearest evidence, and synthesizes an answer with citations. Dimensional truncation can reduce storage cost while preserving useful semantic neighborhoods.`;

function scorePct(score: number) {
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function indexFromId(id: string) {
  return Array.from(id).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function cleanAnswerText(value: string) {
  return value
    .replace(/\[[a-f0-9]{8,12}-\d+\]/gi, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function AnswerContent({ answer }: { answer: string }) {
  const cleaned = cleanAnswerText(answer);

  if (!cleaned) {
    return <p>The answer will appear here after the ADK coordinator retrieves evidence from your sources.</p>;
  }

  const blocks = cleaned.split(/\n\s*\n/).filter(Boolean);
  return (
    <div className="answer-content">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isList = lines.length > 1 && lines.every((line) => line.startsWith("- "));
        const hasHeadingAndList =
          lines.length > 2 &&
          lines[0].endsWith(":") &&
          lines.slice(1).every((line) => line.startsWith("- "));
        if (isList) {
          return (
            <ul key={blockIndex}>
              {lines.map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^- /, "")}</li>)}
            </ul>
          );
        }
        if (hasHeadingAndList) {
          return (
            <div className="answer-section" key={blockIndex}>
              <h3>{lines[0].replace(/:$/, "")}</h3>
              <ul>
                {lines.slice(1).map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^- /, "")}</li>)}
              </ul>
            </div>
          );
        }
        return lines.map((line, lineIndex) => {
          if (line.endsWith(":") && line.length < 48) {
            return <h3 key={`${blockIndex}-${lineIndex}`}>{line.replace(/:$/, "")}</h3>;
          }
          if (line.startsWith("- ")) {
            return <ul key={`${blockIndex}-${lineIndex}`}><li>{line.replace(/^- /, "")}</li></ul>;
          }
          return <p key={`${blockIndex}-${lineIndex}`}>{line}</p>;
        });
      })}
    </div>
  );
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Texture();

  const gradient = context.createRadialGradient(64, 64, 3, 64, 64, 62);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.48)");
  gradient.addColorStop(0.58, "rgba(255,255,255,0.14)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function VectorSpace({
  points,
  queryPoint,
  matches,
  selectedId,
  onSelect,
}: {
  points: RackPoint[];
  queryPoint: RackPoint | null;
  matches: Match[];
  selectedId: string | null;
  onSelect: (point: RackPoint | null) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pointMapRef = useRef<Map<string, RackPoint>>(new Map());
  const selectedIdRef = useRef<string | null>(selectedId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!mountRef.current) return;

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x070806, 9, 26);

    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.9, 9.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const frameGroup = new THREE.Group();
    const pointGroup = new THREE.Group();
    scene.add(frameGroup);
    scene.add(pointGroup);

    const grid = new THREE.GridHelper(10, 20, 0xf54e00, 0x303126);
    grid.position.y = -2.8;
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    frameGroup.add(grid);

    const axes = [
      [new THREE.Vector3(-4.8, -2.6, -2.8), new THREE.Vector3(4.8, -2.6, -2.8), 0xf54e00],
      [new THREE.Vector3(-4.8, -2.6, -2.8), new THREE.Vector3(-4.8, 2.8, -2.8), 0x9fc9a2],
      [new THREE.Vector3(-4.8, -2.6, -2.8), new THREE.Vector3(-4.8, -2.6, 2.8), 0x9fbbe0],
    ] as const;
    axes.forEach(([start, end, color]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
      frameGroup.add(new THREE.Line(geometry, material));
    });

    const backdropGeometry = new THREE.BufferGeometry();
    const backdropPositions = new Float32Array(150 * 3);
    for (let index = 0; index < 150; index += 1) {
      backdropPositions[index * 3] = (Math.random() - 0.5) * 12;
      backdropPositions[index * 3 + 1] = (Math.random() - 0.5) * 7;
      backdropPositions[index * 3 + 2] = (Math.random() - 0.5) * 9;
    }
    backdropGeometry.setAttribute("position", new THREE.BufferAttribute(backdropPositions, 3));
    const backdrop = new THREE.Points(
      backdropGeometry,
      new THREE.PointsMaterial({ color: 0xf7f7f4, size: 0.012, transparent: true, opacity: 0.34 })
    );
    frameGroup.add(backdrop);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerTarget = new THREE.Vector2();
    const meshes: THREE.Mesh[] = [];
    const halos: THREE.Sprite[] = [];
    const objectsById = new Map<string, { halo?: THREE.Sprite; base: THREE.Vector3; orbit: number; phase: number; speed: number }>();
    const matchedIds = new Set(matches.map((match) => match.source_id));
    const glowTexture = makeGlowTexture();
    const allPoints = queryPoint ? [...points, queryPoint] : points;
    pointMapRef.current = new Map(allPoints.map((point) => [point.id, point]));

    allPoints.forEach((point) => {
      const position = new THREE.Vector3(point.projection.x * 1.35, point.projection.y * 1.35, point.projection.z * 1.35);
      const isQuery = point.modality === "query";
      const isMatched = matchedIds.has(point.source_id);
      if (isQuery || isMatched) {
        const haloMaterial = new THREE.SpriteMaterial({
          map: glowTexture,
          color: new THREE.Color(isQuery ? "#f54e00" : point.color),
          transparent: true,
          opacity: isQuery ? 0.32 : 0.24,
          depthWrite: false,
        });
        const halo = new THREE.Sprite(haloMaterial);
        halo.position.copy(position);
        halo.scale.setScalar(isQuery ? 0.72 : 0.58);
        halo.userData.baseScale = isQuery ? 0.72 : 0.58;
        halo.userData.baseOpacity = isQuery ? 0.32 : 0.24;
        halo.userData.id = point.id;
        halos.push(halo);
        pointGroup.add(halo);
      }

      const geometry = new THREE.SphereGeometry(0.08, 24, 24);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(point.color),
        transparent: true,
        opacity: point.modality === "query" ? 1 : 0.9,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.userData.id = point.id;
      meshes.push(mesh);
      pointGroup.add(mesh);
      objectsById.set(point.id, {
        halo: halos.find((item) => item.userData.id === point.id),
        base: position,
        orbit: isQuery ? 0.028 : 0.075 + (indexFromId(point.id) % 5) * 0.012,
        phase: (indexFromId(point.id) % 13) * 0.62,
        speed: isQuery ? 0.28 : 0.34 + (indexFromId(point.id) % 7) * 0.035,
      });
    });

    const handlePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      pointerTarget.set(pointer.x, pointer.y);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes)[0];
      renderer.domElement.style.cursor = hit ? "pointer" : "default";
      onSelect(hit ? pointMapRef.current.get(hit.object.userData.id) ?? null : null);
    };

    const handlePointerLeave = () => {
      pointerTarget.set(0, 0);
      renderer.domElement.style.cursor = "default";
      onSelect(null);
    };

    renderer.domElement.addEventListener("pointermove", handlePointer);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);

    let frame = 0;
    let animation = 0;
    const animate = () => {
      frame += 0.01;
      camera.position.x += (pointerTarget.x * 0.18 - camera.position.x) * 0.025;
      camera.position.y += (1.9 + pointerTarget.y * 0.1 - camera.position.y) * 0.025;
      camera.lookAt(0, 0, 0);
      meshes.forEach((mesh, index) => {
        const object = objectsById.get(mesh.userData.id);
        if (object) {
          const theta = frame * object.speed + object.phase;
          const bob = Math.sin(frame * object.speed * 1.7 + object.phase) * object.orbit * 0.48;
          mesh.position.set(
            object.base.x + Math.cos(theta) * object.orbit,
            object.base.y + bob,
            object.base.z + Math.sin(theta) * object.orbit
          );
          mesh.rotation.y += 0.012 + index * 0.0004;
          mesh.rotation.x += 0.006;
          object.halo?.position.copy(mesh.position);
        }
        const pulse = 1 + Math.sin(frame * 2.2 + index) * 0.055;
        mesh.scale.setScalar(mesh.userData.id === selectedIdRef.current ? 1.22 : pulse);
      });
      halos.forEach((halo, index) => {
        const base = halo.userData.baseScale || 0.58;
        const pulse = 1 + Math.sin(frame * 1.7 + index) * 0.08;
        halo.scale.setScalar(base * pulse);
        const material = halo.material as THREE.SpriteMaterial;
        material.opacity = halo.userData.id === selectedIdRef.current ? 0.46 : halo.userData.baseOpacity;
      });
      renderer.render(scene, camera);
      animation = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointermove", handlePointer);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      mount.removeChild(renderer.domElement);
      glowTexture.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
        if (object instanceof THREE.Sprite) {
          object.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [points, queryPoint, matches, onSelect]);

  return <div className="vector-canvas" ref={mountRef} />;
}

function SourceRow({
  source,
  isRemoving,
  onRemove,
}: {
  source: RackSource;
  isRemoving: boolean;
  onRemove: (source: RackSource) => void;
}) {
  const Icon = modalityIcon[source.modality] || Box;
  const embeddingPath = String(source.metadata?.embedding_path || "");
  return (
    <div className="source-row">
      <div className={`modality-dot ${source.modality}`}>
        <Icon size={15} />
      </div>
      <div className="source-copy">
        <div className="source-title">{source.title}</div>
        <div className="source-summary">{source.summary}</div>
        {embeddingPath && <div className="source-meta">{embeddingPath.replace("gemini-", "Gemini ")}</div>}
      </div>
      <div className="source-actions">
        <button className="delete-source" onClick={() => onRemove(source)} disabled={isRemoving} aria-label={`Remove ${source.title}`}>
          {isRemoving ? <Loader2 className="spin" size={13} /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [space, setSpace] = useState<SpaceSnapshot | null>(null);
  const [tab, setTab] = useState<"text" | "url" | "file">("text");
  const [title, setTitle] = useState("Gemini Embedding 2 field note");
  const [text, setText] = useState(sampleText);
  const [url, setUrl] = useState("https://developers.googleblog.com/building-with-gemini-embedding-2/");
  const [notes, setNotes] = useState("Uploaded multimodal source for the agentic RAG workspace.");
  const [question, setQuestion] = useState("How does Gemini Embedding 2 help agentic RAG across modalities?");
  const [answer, setAnswer] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [trace, setTrace] = useState<AskResponse["trace"]>([]);
  const [queryPoint, setQueryPoint] = useState<RackPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<RackPoint | null>(null);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [removingSourceId, setRemovingSourceId] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [qaStatus, setQaStatus] = useState("");
  const [qaError, setQaError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const points = useMemo(() => space?.points ?? [], [space]);
  const sourceCount = space?.sources.length ?? 0;
  const pointCount = space?.points.length ?? 0;
  const provider = space?.provider ?? "loading";
  const projection = space?.projection?.method?.replace("_", " ").toUpperCase() ?? "PCA 3D";

  async function refreshSpace() {
    const res = await fetch(`${API}/space`);
    setSpace(await res.json());
  }

  useEffect(() => {
    refreshSpace().catch(() => undefined);
  }, []);

  async function addSource() {
    setIsAddingSource(true);
    setSourceError("");
    setSourceStatus(tab === "file" ? "Uploading and embedding media..." : "Embedding source...");
    try {
      let res: Response;
      if (tab === "text") {
        res = await fetch(`${API}/sources/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, text, modality: "text" }),
        });
      } else if (tab === "url") {
        res = await fetch(`${API}/sources/url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, title: title || undefined }),
        });
      } else {
        const file = fileRef.current?.files?.[0];
        if (!file) {
          setSourceError("Choose a file first.");
          return;
        }
        const form = new FormData();
        form.append("title", title || file.name);
        form.append("file", file);
        form.append("notes", notes);
        res = await fetch(`${API}/sources/file`, { method: "POST", body: form });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Source ingestion failed.");
      setSpace(data.space);
      setSourceStatus(`${data.source?.title || "Source"} embedded into the map.`);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Source ingestion failed.");
    } finally {
      setIsAddingSource(false);
    }
  }

  async function removeSource(source: RackSource) {
    const confirmed = window.confirm(`Remove "${source.title}" from this local vector space?`);
    if (!confirmed) return;

    setRemovingSourceId(source.id);
    setSourceError("");
    try {
      const res = await fetch(`${API}/sources/${source.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      const data = await res.json();
      setSpace(data.space);
      setMatches((current) => current.filter((match) => match.source_id !== source.id));
      if (selectedPoint?.source_id === source.id) setSelectedPoint(null);
      if (queryPoint) setQueryPoint(null);
      setSourceStatus(`${source.title} removed.`);
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setRemovingSourceId(null);
    }
  }

  async function askQuestion() {
    if (!question.trim()) return;
    setIsAsking(true);
    setQaError("");
    setQaStatus("Retrieving evidence and asking the ADK coordinator...");
    setAnswer("");
    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, top_k: 6 }),
      });
      const data: AskResponse = await res.json();
      if (!res.ok) throw new Error((data as unknown as { detail?: string }).detail || "Question failed.");
      setAnswer(data.answer);
      setMatches(data.matches);
      setTrace(data.trace);
      setQueryPoint(data.query_point);
      setSpace(data.space);
      setQaStatus(`Retrieved ${data.matches.length} citation${data.matches.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setQaError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <BrainCircuit size={22} />
          </div>
          <div>
            <h1>Multi-modal Agentic RAG</h1>
            <p>Gemini Embedding 2 · Google ADK</p>
          </div>
        </div>
        <div className="status-strip">
          <span><RadioTower size={14} /> {provider}</span>
          <span><Box size={14} /> {pointCount} points</span>
          <span><Activity size={14} /> {sourceCount} sources</span>
        </div>
      </header>

      <section className="workspace">
        <aside className="left-rail">
          <section className="panel source-list">
            <div className="panel-heading source-list-heading">
              <div>
                <h2>Indexed sources</h2>
                <p>Remove sources when they should leave the vector space.</p>
              </div>
            </div>
            {space?.sources.map((source) => (
              <SourceRow
                source={source}
                key={source.id}
                isRemoving={removingSourceId === source.id}
                onRemove={removeSource}
              />
            ))}
          </section>

          <section className="panel source-panel">
            <div className="panel-heading">
              <div>
                <h2>Add source</h2>
                <p>Embed new evidence into the shared vector space.</p>
              </div>
              <button className="icon-button" onClick={refreshSpace} aria-label="Refresh embedding space">
                <Activity size={16} />
              </button>
            </div>

            <div className="tabs" role="tablist">
              <button className={tab === "text" ? "active" : ""} onClick={() => setTab("text")}><FileText size={14} /> Text</button>
              <button className={tab === "url" ? "active" : ""} onClick={() => setTab("url")}><Link size={14} /> URL</button>
              <button className={tab === "file" ? "active" : ""} onClick={() => setTab("file")}><Upload size={14} /> File</button>
            </div>

            <label className="field-label">Title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Source title" />

            {tab === "text" && (
              <>
                <label className="field-label">Source text</label>
                <textarea value={text} onChange={(event) => setText(event.target.value)} aria-label="Source text" />
              </>
            )}

            {tab === "url" && (
              <>
                <label className="field-label">URL</label>
                <input value={url} onChange={(event) => setUrl(event.target.value)} aria-label="URL source" />
              </>
            )}

            {tab === "file" && (
              <>
                <label className="field-label">File</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.pdf,image/*,audio/*,video/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedFile(file);
                    if (file && title === "Gemini Embedding 2 field note") setTitle(file.name);
                  }}
                />
                {selectedFile && (
                  <div className="file-preview">
                    <Video size={15} />
                    <span>{selectedFile.name}</span>
                    <strong>{selectedFile.type || "file"} · {formatBytes(selectedFile.size)}</strong>
                  </div>
                )}
                <label className="field-label">Notes</label>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="File notes" />
              </>
            )}

            <button className="primary-button" onClick={addSource} disabled={isAddingSource}>
              {isAddingSource ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} Add source
            </button>
            {(sourceStatus || sourceError) && (
              <div className={`inline-status ${sourceError ? "error" : "success"}`} role="status">
                {sourceError || sourceStatus}
              </div>
            )}
          </section>
        </aside>

        <section className="space-stage">
          <div className="stage-header">
            <div>
              <h2>Embedding Space</h2>
              <p>{space?.dimensions ?? 768}D embeddings · {projection} · one point per source</p>
            </div>
            <div className="stage-tools">
              <div className="modality-key" aria-label="Modality legend">
                {(["Text", "Image", "Audio", "Video", "PDF", "Query"] as const).map((item) => (
                  <span key={item} className={`modality-key-item key-${item.toLowerCase()}`}>{item}</span>
                ))}
              </div>
              <div className="space-readout" aria-label="Embedding space status">
                <span>{sourceCount} sources</span>
                <span>{matches.length ? `${matches.length} matched` : "ready"}</span>
              </div>
            </div>
          </div>
          <VectorSpace
            points={points}
            queryPoint={queryPoint}
            matches={matches}
            selectedId={selectedPoint?.id ?? null}
            onSelect={setSelectedPoint}
          />
          {selectedPoint && (
            <div className="hover-card">
              <div className={`mini-dot ${selectedPoint.modality}`} />
              <strong>{selectedPoint.title}</strong>
              <span>{selectedPoint.modality} · {selectedPoint.id}</span>
              <p>{selectedPoint.preview}</p>
            </div>
          )}
        </section>

        <aside className="right-rail">
          <section className="panel qa-panel">
            <div className="panel-heading">
              <div>
                <h2>Q&A</h2>
                <p>Ask a question and read the grounded answer here.</p>
              </div>
              <Bot size={18} />
            </div>
            <label className="field-label">Question</label>
            <textarea className="question-box" value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Question" />
            <button className="primary-button" onClick={askQuestion} disabled={isAsking}>
              {isAsking ? <Loader2 className="spin" size={16} /> : <Send size={16} />} Ask question
            </button>
            {(qaStatus || qaError) && (
              <div className={`inline-status ${qaError ? "error" : "success"}`} role="status">
                {qaError || qaStatus}
              </div>
            )}
            <div className="answer-box prominent-answer">
              <MessageSquare size={16} />
              <AnswerContent answer={answer} />
            </div>
          </section>

          <section className="panel trace-panel">
            <div className="panel-heading">
              <div>
                <h2>Agent Trace</h2>
                <p>Google ADK tool path</p>
              </div>
              <Sparkles size={18} />
            </div>
            <div className="trace-list">
              {(trace.length ? trace : [
                { agent: "source_ingestor", status: "ready", detail: "Waiting for a question" },
                { agent: "retrieval_tool", status: "ready", detail: "Nearest-neighbor evidence will appear here" },
                { agent: "answer_synthesizer", status: "ready", detail: "Cited answer stream target" },
              ]).map((step) => (
                <div className="trace-row" key={step.agent}>
                  <span>{step.agent}</span>
                  <p>{step.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel citations-panel">
            <div className="panel-heading">
              <div>
                <h2>Citations</h2>
                <p>Sources used for this answer</p>
              </div>
            </div>
            <div className="citation-list">
              {matches.length === 0 && <div className="empty-state">No query yet. Add a source, then ask a question.</div>}
              {matches.map((match) => {
                const Icon = modalityIcon[match.modality] || FileText;
                return (
                  <button
                    className="citation-row"
                    key={match.id}
                    onMouseEnter={() => setSelectedPoint({ ...match, color: "#f54e00", preview: match.text })}
                    onMouseLeave={() => setSelectedPoint(null)}
                  >
                    <div className="citation-top">
                      <span><Icon size={14} /> {match.title}</span>
                      <strong>{scorePct(match.score)}</strong>
                    </div>
                    <div className="score-track" aria-hidden="true"><div style={{ width: scorePct(match.score) }} /></div>
                    <p>{match.text}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
