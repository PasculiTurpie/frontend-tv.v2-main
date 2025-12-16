// src/pages/ChannelDiagram/edges/DraggableDirectionalEdge.jsx
import { getSmoothStepPath } from "@xyflow/react";
import { useMemo, useState } from "react";

import "./DraggableDirectionalEdge.css";
import { getDirectionColor } from "./directionColors";

export default function DraggableDirectionalEdge(props) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    data = {},
    label,
  } = props;

  const isSaving = Boolean(data?.isSaving);

  // path con curva suave tipo "SmoothStep"
  const [edgePath, labelX, labelY] = useMemo(() => {
    return getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 12,
    });
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  /* ---------------------- label arrastrable ---------------------- */
  const currentLabelX = data?.labelPosition?.x ?? labelX;
  const currentLabelY = data?.labelPosition?.y ?? labelY;

  const buildTooltipFromData = (d) => {
    const start = d?.labelStart || d?.endpointLabels?.source || "";
    const end = d?.labelEnd || d?.endpointLabels?.target || "";

    const hasStart = Boolean(start);
    const hasEnd = Boolean(end);

    if (hasStart && hasEnd) return `${start} → ${end}`;
    if (hasStart || hasEnd) return start || end;
    return "";
  };

  const tooltipTitle = data?.tooltipTitle ?? label ?? data?.label ?? id ?? "Etiqueta centro";
  const tooltipBody = data?.tooltip || buildTooltipFromData(data);

  /* --------------------------- Tooltip --------------------------- */
  const [hover, setHover] = useState(false);
  const [mouse, setMouse] = useState({ x: labelX, y: labelY });

  const onHoverMove = (e) => {
    if (typeof e.nativeEvent.offsetX === "number") {
      setMouse({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    }
  };

  /* --------------------------- Estilos --------------------------- */
  const direction = data?.direction ?? "ida";

  // ✅ PRIORIDAD: color elegido por el usuario (guardado en data.color o style.stroke)
  // fallback: color por dirección
  const chosenColor =
    data?.color ||
    style?.stroke ||
    getDirectionColor(direction);

  const animatedStyle = {
    stroke: chosenColor,
    strokeWidth: 2,
    ...style,
  };

  /* -------------------- Marker heredando color -------------------- */
  // ✅ id único por edge para evitar colisiones en el DOM
  const markerId = useMemo(() => {
    const safe = String(id || "edge").replace(/[^a-zA-Z0-9_-]/g, "_");
    return `arrowclosed_${safe}`;
  }, [id]);

  const markerUrl = `url(#${markerId})`;

  /* ----------------------- Render del Edge ----------------------- */
  return (
    <>
      {/* ✅ Definición del marker: hereda stroke/fill desde el path usando context-stroke/fill */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <marker
            id={markerId}
            markerWidth="12"
            markerHeight="12"
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            orient="auto"
            markerUnits="strokeWidth"
          >
            {/* ArrowClosed:
               - Usamos context-stroke/context-fill para heredar el color del edge
               - strokeLinejoin redondea el “cierre” para que se vea más bonito
            */}
            <path
              d="M 2 2 L 10 6 L 2 10 Z"
              fill="context-fill"
              stroke="context-stroke"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
      </svg>

      {/* Línea visible con animación + marker heredando color */}
      <path
        d={edgePath}
        fill="none"
        style={animatedStyle}
        markerEnd={markerUrl}
        className="edge-stroke-animated"
      />

      {/* Path invisible que detecta hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={onHoverMove}
      />

      {/* Tooltip "Guardando…" */}
      {isSaving && (
        <foreignObject
          x={(currentLabelX ?? labelX) - 40}
          y={(currentLabelY ?? labelY) - 50}
          width={90}
          height={24}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              padding: "4px 6px",
              borderRadius: 6,
              background: "rgba(13,110,253,0.85)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              pointerEvents: "none",
            }}
          >
            Guardando…
          </div>
        </foreignObject>
      )}

      {/* Tooltip principal al hover */}
      {hover && (tooltipBody || data?.multicast) && (
        <foreignObject
          x={(mouse.x ?? labelX) + 10}
          y={(mouse.y ?? labelY) + 10}
          width={260}
          height={120}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              maxWidth: "fit-content",
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.8)",
              color: "#fff",
              fontSize: 12,
              lineHeight: 1.3,
              boxShadow: "0 6px 14px rgba(0,0,0,.3)",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltipTitle}</div>
            <div>{tooltipBody || "Sin descripción"}</div>
            {data?.multicast && (
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                Multicast: {data.multicast}
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </>
  );
}
