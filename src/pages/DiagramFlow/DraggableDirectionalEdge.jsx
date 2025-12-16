// src/pages/ChannelDiagram/edges/DraggableDirectionalEdge.jsx
import { getSmoothStepPath } from "@xyflow/react";
import { useMemo, useState, useRef, useEffect } from "react";

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

  /* ---------------- Path ---------------- */
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

  const currentLabelX = data?.labelPosition?.x ?? labelX;
  const currentLabelY = data?.labelPosition?.y ?? labelY;

  /* ---------------- Tooltip content ---------------- */
  const buildTooltipFromData = (d) => {
    const start = d?.labelStart || d?.endpointLabels?.source || "";
    const end = d?.labelEnd || d?.endpointLabels?.target || "";
    if (start && end) return `${start} → ${end}`;
    return start || end || "";
  };

  const tooltipTitle =
    data?.tooltipTitle ?? label ?? data?.label ?? id ?? "Etiqueta centro";

  const tooltipBody =
    data?.tooltip || buildTooltipFromData(data);

  /* ---------------- Hover estable ---------------- */
  const [hover, setHover] = useState(false);
  const hideTimerRef = useRef(null);

  const showTooltip = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setHover(true);
  };

  const hideTooltipDelayed = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setHover(false);
    }, 120); // delay clave anti-parpadeo
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  /* ---------------- Estilos ---------------- */
  const direction = data?.direction ?? "ida";

  const chosenColor =
    data?.color ||
    style?.stroke ||
    getDirectionColor(direction);

  const animatedStyle = {
    stroke: chosenColor,
    strokeWidth: 2,
    ...style,
  };

  /* ---------------- Marker heredando color ---------------- */
  const markerId = useMemo(() => {
    const safe = String(id || "edge").replace(/[^a-zA-Z0-9_-]/g, "_");
    return `arrowclosed_${safe}`;
  }, [id]);

  const markerUrl = `url(#${markerId})`;

  /* ---------------- Render ---------------- */
  return (
    <>
      {/* Marker */}
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

      {/* Edge visible */}
      <path
        d={edgePath}
        fill="none"
        style={animatedStyle}
        markerEnd={markerUrl}
        className="edge-stroke-animated"
      />

      {/* Hit area para hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltipDelayed}
      />

      {/* Tooltip Guardando */}
      {isSaving && (
        <foreignObject
          x={currentLabelX - 40}
          y={currentLabelY - 50}
          width={90}
          height={24}
        >
          <div
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

      {/* Tooltip estable */}
      {hover && (tooltipBody || data?.multicast) && (
        <foreignObject
          x={currentLabelX + 10}
          y={currentLabelY + 10}
          width={260}
          height={140}
        >
          <div
            style={{
              maxWidth: "fit-content",
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(0,0,0,0.85)",
              color: "#fff",
              fontSize: 12,
              lineHeight: 1.3,
              boxShadow: "0 6px 14px rgba(0,0,0,.3)",
              pointerEvents: "auto",
            }}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltipDelayed}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {tooltipTitle}
            </div>
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
