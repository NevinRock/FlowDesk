import React, {
  useCallback,
  useState,
  useRef,
  useEffect,
  useMemo,
} from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import "./App.css";

/* =============================================
   Custom Node Components
   ============================================= */

function ImageDropZone({ image, onUpload, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) onUpload(file);
    },
    [onUpload]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  if (image) {
    return (
      <div className="image-drop-zone has-image">
        <img src={image} alt="" className="drop-zone-preview" />
        <div className="drop-zone-overlay">
          <button
            className="drop-zone-btn"
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </button>
          <button className="drop-zone-btn danger" onClick={onClear}>
            Remove
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files[0]) onUpload(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`image-drop-zone empty${dragging ? " dragging" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="drop-zone-icon">&#8682;</div>
      <div className="drop-zone-text">
        Click or drag image here
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) onUpload(e.target.files[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const NODE_COLORS = {
  click: { bg: "#1e3a5f", border: "#3b82f6" },
  wait: { bg: "#3b2e1e", border: "#eab308" },
  check: { bg: "#1e3b3b", border: "#14b8a6" },
  waitUntil: { bg: "#2e1e3b", border: "#a855f7" },
};

function RegularNode({ data, selected }) {
  const c = NODE_COLORS[data.type] || { bg: "#1e293b", border: "#64748b" };
  return (
    <div
      className={`custom-node${selected ? " selected" : ""}`}
      style={{
        background: c.bg,
        borderColor: selected ? "#3b82f6" : c.border,
      }}
    >
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle
        type="target"
        position={Position.Top}
        id="loop-start"
        className="loop-handle-start"
        style={{ left: "30%" }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="loop-end"
        className="loop-handle-end"
        style={{ left: "70%" }}
      />
      <div className="node-label">
        {data.label}
        {data.type === "wait" && ` ${data.time}s`}
      </div>
      {data.image && (
        <img src={data.image} alt="" className="node-thumb" />
      )}
    </div>
  );
}

function LoopNode({ data, selected }) {
  return (
    <div
      className={`custom-node loop-node${selected ? " selected" : ""}`}
      style={{ borderColor: selected ? "#3b82f6" : "#f97316" }}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        id="loop-start"
        className="loop-handle-start"
        style={{ left: "30%" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="loop-end"
        className="loop-handle-end"
        style={{ left: "70%" }}
      />
      <div className="node-label">
        {data.loopProgress
          ? `Loop ${data.loopProgress.current}/${data.loopProgress.total}`
          : `Loop x${data.count}`}
      </div>
    </div>
  );
}

function StartNode({ data, selected }) {
  return (
    <div
      className={`custom-node start-node${selected ? " selected" : ""}`}
      style={{ borderColor: selected ? "#3b82f6" : "#22c55e" }}
    >
      <Handle type="source" position={Position.Right} id="right" />
      <Handle
        type="target"
        position={Position.Top}
        id="loop-start"
        className="loop-handle-start"
        style={{ left: "30%" }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="loop-end"
        className="loop-handle-end"
        style={{ left: "70%" }}
      />
      <div className="node-label">Start</div>
    </div>
  );
}

const nodeTypes = {
  start: StartNode,
  regular: RegularNode,
  loopNode: LoopNode,
};

/* =============================================
   Initial State
   ============================================= */

const INITIAL_NODES = [
  {
    id: "start",
    type: "start",
    data: { label: "Start", type: "start" },
    position: { x: 100, y: 200 },
  },
];

/* =============================================
   App Component
   ============================================= */

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const styledEdges = useMemo(
    () =>
      edges.map((e) =>
        e.id === selectedEdgeId
          ? { ...e, style: { ...e.style, strokeWidth: 3, filter: "drop-shadow(0 0 4px #3b82f6)" } }
          : e
      ),
    [edges, selectedEdgeId]
  );

  // ──── Undo / Redo via refs ────
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const batchRef = useRef(false);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  });

  const takeSnapshot = useCallback(() => {
    if (batchRef.current) return;
    batchRef.current = true;
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
    });
    if (historyRef.current.length > 100) {
      historyRef.current.splice(0, historyRef.current.length - 100);
    }
    redoRef.current = [];
    requestAnimationFrame(() => {
      batchRef.current = false;
    });
  }, []);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    redoRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
    });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
    });
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  // ──── Wrapped change handlers (snapshot before removals) ────
  const handleNodesChange = useCallback(
    (changes) => {
      const safe = changes.filter(
        (c) => !(c.type === "remove" && c.id === "start")
      );
      if (safe.length === 0) return;
      if (safe.some((c) => c.type === "remove")) {
        takeSnapshot();
        if (safe.some((c) => c.type === "remove" && c.id === selectedNodeId)) {
          setSelectedNodeId(null);
        }
      }
      onNodesChange(safe);
    },
    [onNodesChange, takeSnapshot, selectedNodeId]
  );

  const handleEdgesChange = useCallback(
    (changes) => {
      if (changes.some((c) => c.type === "remove")) takeSnapshot();
      onEdgesChange(changes);
    },
    [onEdgesChange, takeSnapshot]
  );

  // ──── Connection validation ────
  const isValidConnection = useCallback((conn) => {
    if (conn.source === conn.target) return false;
    const sh = conn.sourceHandle;
    const th = conn.targetHandle;
    if (sh === "right" && th === "left") return true;
    if (sh === "loop-start" && th === "loop-start") return true;
    if (sh === "loop-end" && th === "loop-end") return true;
    return false;
  }, []);

  // ──── Connect ────
  const onConnect = useCallback(
    (params) => {
      takeSnapshot();
      const isLoopStart = params.sourceHandle === "loop-start";
      const isLoopEnd = params.sourceHandle === "loop-end";
      const isLoop = isLoopStart || isLoopEnd;
      const loopColor = isLoopStart ? "#22c55e" : "#ef4444";
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: isLoop,
            style: isLoop
              ? { stroke: loopColor, strokeDasharray: "5 5", strokeWidth: 2 }
              : { strokeWidth: 2 },
            label: isLoopStart
              ? "Loop Start"
              : isLoopEnd
                ? "Loop End"
                : undefined,
            labelStyle: isLoop
              ? { fill: loopColor, fontWeight: 700, fontSize: 11 }
              : undefined,
          },
          eds
        )
      );
    },
    [takeSnapshot, setEdges]
  );

  // ──── Add node ────
  const addNode = useCallback(
    (type) => {
      takeSnapshot();
      const id = Date.now().toString();
      const isLoop = type === "loop";
      const base = {
        id,
        type: isLoop ? "loopNode" : "regular",
        position: isLoop
          ? { x: 300 + Math.random() * 120, y: 50 + Math.random() * 60 }
          : { x: 300 + Math.random() * 120, y: 200 + Math.random() * 100 },
      };

      const dataMap = {
        click: { label: "Click Image", type: "click", image: null },
        wait: { label: "Wait", type: "wait", time: 1 },
        check: {
          label: "Click Position",
          type: "check",
          x: Math.round(screen.width / 2),
          y: Math.round(screen.height / 2),
        },
        waitUntil: {
          label: "Wait Until",
          type: "waitUntil",
          image: null,
          interval: 1,
        },
        loop: { label: "Loop", type: "loop", count: 3 },
      };

      const data = dataMap[type];
      if (!data) return;
      setNodes((nds) => [...nds, { ...base, data }]);
    },
    [takeSnapshot, setNodes]
  );

  // ──── Delete selected node or edge ────
  const deleteSelected = useCallback(() => {
    if (selectedEdgeId) {
      takeSnapshot();
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
      return;
    }
    if (!selectedNodeId || selectedNodeId === "start") return;
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
      )
    );
    setSelectedNodeId(null);
  }, [selectedNodeId, selectedEdgeId, takeSnapshot, setNodes, setEdges]);

  // ──── Auto layout ────
  const autoLayout = useCallback(() => {
    takeSnapshot();
    const flowEdges = edgesRef.current.filter(
      (e) => e.sourceHandle === "right" && e.targetHandle === "left"
    );
    const loopEdges = edgesRef.current.filter(
      (e) => e.sourceHandle === "loop-start" || e.sourceHandle === "loop-end"
    );
    const currentNodes = nodesRef.current;

    const adj = {};
    const inDeg = {};
    const nodeMap = {};
    for (const n of currentNodes) {
      adj[n.id] = [];
      inDeg[n.id] = 0;
      nodeMap[n.id] = n;
    }
    for (const e of flowEdges) {
      if (adj[e.source]) {
        adj[e.source].push(e.target);
        inDeg[e.target] = (inDeg[e.target] || 0) + 1;
      }
    }

    const queue = Object.keys(inDeg).filter(
      (id) => inDeg[id] === 0 && nodeMap[id]?.type !== "loopNode"
    );
    const sorted = [];
    while (queue.length) {
      const id = queue.shift();
      sorted.push(id);
      for (const next of adj[id] || []) {
        inDeg[next]--;
        if (inDeg[next] === 0) queue.push(next);
      }
    }

    const NODE_W = 180;
    const NODE_GAP = 60;
    const FLOW_Y = 220;
    const LOOP_Y = 50;

    const posMap = {};
    sorted.forEach((id, i) => {
      posMap[id] = { x: 80 + i * (NODE_W + NODE_GAP), y: FLOW_Y };
    });

    for (const n of currentNodes) {
      if (n.type === "loopNode") {
        const startEdge = loopEdges.find(
          (e) => e.source === n.id && e.sourceHandle === "loop-start"
        );
        const endEdge = loopEdges.find(
          (e) => e.source === n.id && e.sourceHandle === "loop-end"
        );
        const startPos = startEdge && posMap[startEdge.target];
        const endPos = endEdge && posMap[endEdge.target];

        if (startPos && endPos) {
          posMap[n.id] = {
            x: (startPos.x + endPos.x) / 2,
            y: LOOP_Y,
          };
        } else if (startPos) {
          posMap[n.id] = { x: startPos.x, y: LOOP_Y };
        } else if (endPos) {
          posMap[n.id] = { x: endPos.x, y: LOOP_Y };
        } else if (!posMap[n.id]) {
          posMap[n.id] = { x: 80, y: LOOP_Y };
        }
      }
    }

    for (const n of currentNodes) {
      if (!posMap[n.id]) {
        posMap[n.id] = n.position;
      }
    }

    setNodes((nds) =>
      nds.map((n) => ({ ...n, position: posMap[n.id] || n.position }))
    );
  }, [takeSnapshot, setNodes]);

  // ──── Node click / pane click ────
  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);
  const onEdgeClick = useCallback((_, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // ──── Snapshot on drag start ────
  const onNodeDragStart = useCallback(() => takeSnapshot(), [takeSnapshot]);

  // ──── Update node data ────
  const updateNode = useCallback(
    (key, value) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? { ...n, data: { ...n.data, [key]: value } }
            : n
        )
      );
    },
    [selectedNodeId, setNodes]
  );

  // Snapshot once per focus session for property inputs
  const inputFocusedRef = useRef(false);
  const handleInputFocus = useCallback(() => {
    if (!inputFocusedRef.current) {
      takeSnapshot();
      inputFocusedRef.current = true;
    }
  }, [takeSnapshot]);
  const handleInputBlur = useCallback(() => {
    inputFocusedRef.current = false;
  }, []);

  // ──── Image upload ────
  const handleImageUpload = useCallback(
    (file) => {
      if (!file) return;
      takeSnapshot();
      const reader = new FileReader();
      reader.onload = () => updateNode("image", reader.result);
      reader.readAsDataURL(file);
    },
    [takeSnapshot, updateNode]
  );

  // ──── Save / Load workflow ────
  const fileInputRef = useRef(null);

  const saveFlow = useCallback(() => {
    const data = JSON.stringify({ nodes: nodesRef.current, edges: edgesRef.current }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
    a.download = `workflow_${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const loadFlow = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const { nodes: savedNodes, edges: savedEdges } = JSON.parse(reader.result);
          if (!Array.isArray(savedNodes) || !Array.isArray(savedEdges)) return;
          takeSnapshot();
          setNodes(savedNodes);
          setEdges(savedEdges);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        } catch {
          /* invalid file */
        }
      };
      reader.readAsText(file);
    },
    [takeSnapshot, setNodes, setEdges]
  );

  // ──── Keyboard shortcuts ────
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Save: Ctrl+S
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveFlow();
        return;
      }
      // Undo: Ctrl+Z
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if (
        (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
        (e.key === "y" && (e.ctrlKey || e.metaKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }
      // Delete: only when not in input fields
      if (!inInput && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        deleteSelected();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [deleteSelected, undo, redo, saveFlow]);

  // ──── Run / Stop flow ────
  const stopFlow = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const runFlow = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const visited = new Set();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop();

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const msg = JSON.parse(line.slice(6));
          if (msg.done) break;

          if (msg.type === "loop") {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === msg.loop_id
                  ? { ...n, data: { ...n.data, loopProgress: { current: msg.current, total: msg.total } } }
                  : n
              )
            );
            continue;
          }

          if (!msg.node) continue;

          const id = msg.node;
          visited.add(id);
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === id)
                return {
                  ...n,
                  style: {
                    border: "3px solid #ef4444",
                    boxShadow: "0 0 20px red",
                    background: "#ffe4e6",
                  },
                };
              if (visited.has(n.id))
                return {
                  ...n,
                  style: {
                    border: "2px solid green",
                    background: "#ecfdf5",
                  },
                };
              return { ...n, style: {} };
            })
          );
        }
      }
    } catch {
      /* aborted or backend offline */
    } finally {
      setNodes((nds) =>
        nds.map((n) => {
          const cleaned = { ...n, style: {} };
          if (n.type === "loopNode" && n.data.loopProgress) {
            const { loopProgress, ...rest } = n.data;
            cleaned.data = rest;
          }
          return cleaned;
        })
      );
      setRunning(false);
      abortRef.current = null;
    }
  };

  // ──── Render ────
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* ── Sidebar ── */}
      <div className="sidebar">
        <h3>Tools</h3>
        <button onClick={() => addNode("click")}>Click Image</button>
        <button onClick={() => addNode("wait")}>Wait</button>
        <button onClick={() => addNode("waitUntil")}>Wait Until</button>
        <button onClick={() => addNode("check")}>Click Position</button>
        <button onClick={() => addNode("loop")}>Loop</button>

        <hr style={{ border: "none", borderTop: "1px solid #334155", margin: "6px 0" }} />

        <button
          className={running ? "stop-btn" : "run-btn"}
          onClick={running ? stopFlow : runFlow}
        >
          {running ? "Stop" : "Run"}
        </button>
        <button onClick={autoLayout}>
          Auto Layout
        </button>

        <hr style={{ border: "none", borderTop: "1px solid #334155", margin: "6px 0" }} />

        <button onClick={saveFlow} title="Save (Ctrl+S)">
          Save
        </button>
        <button onClick={() => fileInputRef.current?.click()}>
          Load
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={(e) => {
            loadFlow(e.target.files[0]);
            e.target.value = "";
          }}
        />

        <div className="undo-redo">
          <button onClick={undo} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button onClick={redo} title="Redo (Ctrl+Y)">
            Redo
          </button>
        </div>

        <div className="shortcuts">
          Del &mdash; Delete
          <br />
          Ctrl+Z &mdash; Undo
          <br />
          Ctrl+Y &mdash; Redo
          <br />
          Ctrl+S &mdash; Save
        </div>
      </div>

      {/* ── Canvas ── */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeDragStart={onNodeDragStart}
          nodeTypes={nodeTypes}
          isValidConnection={isValidConnection}
          deleteKeyCode={null}
          fitView
        >
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "start") return "#22c55e";
              if (n.type === "loopNode") return "#f97316";
              const c = NODE_COLORS[n.data?.type];
              return c ? c.border : "#64748b";
            }}
            style={{ background: "#1e293b" }}
          />
          <Controls />
          <Background color="#334155" gap={20} />
        </ReactFlow>
      </div>

      {/* ── Properties Panel ── */}
      <div className="properties">
        <h3>Properties</h3>

        {selectedNode ? (
          <div>
            <p className="node-type">
              Type: {selectedNode.data.type}
            </p>

            {selectedNode.id !== "start" && (
              <button className="delete-btn" onClick={deleteSelected}>
                Delete Node
              </button>
            )}

            {/* Click Image */}
            {selectedNode.data.type === "click" && (
              <div className="field">
                <label>Target Image</label>
                <ImageDropZone
                  image={selectedNode.data.image}
                  onUpload={handleImageUpload}
                  onClear={() => { takeSnapshot(); updateNode("image", null); }}
                />
              </div>
            )}

            {/* Wait */}
            {selectedNode.data.type === "wait" && (
              <div className="field">
                <label>Wait Time (seconds)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={selectedNode.data.time}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onChange={(e) => updateNode("time", Number(e.target.value))}
                />
              </div>
            )}

            {/* Wait Until */}
            {selectedNode.data.type === "waitUntil" && (
              <>
                <div className="field">
                  <label>Target Image</label>
                  <ImageDropZone
                    image={selectedNode.data.image}
                    onUpload={handleImageUpload}
                    onClear={() => { takeSnapshot(); updateNode("image", null); }}
                  />
                </div>
                <div className="field">
                  <label>Check Interval (seconds)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={selectedNode.data.interval}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onChange={(e) =>
                      updateNode("interval", Number(e.target.value))
                    }
                  />
                </div>
              </>
            )}

            {/* Click Position */}
            {selectedNode.data.type === "check" && (
              <>
                <div className="field">
                  <label>X Position</label>
                  <input
                    type="number"
                    value={selectedNode.data.x}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onChange={(e) => updateNode("x", Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>Y Position</label>
                  <input
                    type="number"
                    value={selectedNode.data.y}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onChange={(e) => updateNode("y", Number(e.target.value))}
                  />
                </div>
              </>
            )}

            {/* Loop */}
            {selectedNode.data.type === "loop" && (
              <div className="field">
                <label>Loop Count</label>
                <input
                  type="number"
                  min={1}
                  value={selectedNode.data.count}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onChange={(e) =>
                    updateNode("count", Number(e.target.value))
                  }
                />
                <p style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>
                  <span style={{ color: "#22c55e" }}>Green</span> handle
                  &rarr; loop start node
                  <br />
                  <span style={{ color: "#ef4444" }}>Red</span> handle
                  &rarr; loop end node
                </p>
              </div>
            )}
          </div>
        ) : (
          <p style={{ opacity: 0.4, fontSize: 13 }}>
            Select a node to edit properties
          </p>
        )}
      </div>
    </div>
  );
}
