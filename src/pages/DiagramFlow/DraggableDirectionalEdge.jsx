import { getSmoothStepPath, useStore } from "@xyflow/react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

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

  /* --------------------------- Color --------------------------- */
  const direction = data?.direction ?? "ida";

  // ✅ PRIORIDAD: color elegido por el usuario (guardado en data.color o style.stroke)
  const chosenColor = data?.color || style?.stroke || getDirectionColor(direction);

  const animatedStyle = {
    stroke: chosenColor,
    strokeWidth: 2,
    ...style,
  };

  /* -------------------- Marker heredando color -------------------- */
  const markerId = useMemo(() => {
    const safe = String(id || "edge").replace(/[^a-zA-Z0-9_-]/g, "_");
    return `arrowclosed_${safe}`;
  }, [id]);

  const markerUrl = `url(#${markerId})`;

  /* --------------------------- Tooltip (Portal) --------------------------- */
  // Transform del canvas (x,y,zoom) + domNode de ReactFlow
  const transform = useStore((s) => s.transform); // [x, y, zoom]
  const rfDomNode = useStore((s) => s.domNode); // contenedor del renderer

  const hideTimerRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [sticky, setSticky] = useState(false);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const showTooltip = useCallback(() => {
    clearHideTimer();
    setHover(true);
  }, []);

  const hideTooltipDelayed = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      // ✅ anti-parpadeo + respeta sticky
      if (!sticky) setHover(false);
    }, 240);
  }, [sticky]);

  useEffect(() => {
    return () => clearHideTimer();
  }, []);

  // Tooltip en el CENTRO del edge (por defecto labelX/labelY)
  const tipPos = useMemo(() => {
    const x = Number.isFinite(currentLabelX) ? currentLabelX : labelX;
    const y = Number.isFinite(currentLabelY) ? currentLabelY : labelY;
    return { x, y };
  }, [currentLabelX, currentLabelY, labelX, labelY]);

  // Convertimos coords del canvas a coords de pantalla (para Portal fixed)
  const screenPos = useMemo(() => {
    const [tx, ty, zoom] = Array.isArray(transform) ? transform : [0, 0, 1];

    // Si no está montado aún, devolvemos algo razonable
    if (!rfDomNode || typeof rfDomNode.getBoundingClientRect !== "function") {
      return { left: 0, top: 0, zoom: 1 };
    }

    const rect = rfDomNode.getBoundingClientRect();

    // canvas(x,y) -> pantalla
    const left = rect.left + tipPos.x * zoom + tx;
    const top = rect.top + tipPos.y * zoom + ty;

    return { left, top, zoom };
  }, [transform, rfDomNode, tipPos.x, tipPos.y]);

  const tooltipPortal =
    hover && (tooltipBody || data?.multicast)
      ? createPortal(
          <div
            // ✅ usa tu CSS existente
            className={`edge-tooltip ${sticky ? "edge-tooltip--sticky" : ""}`}
            style={{
              left: screenPos.left + 10,
              top: screenPos.top + 10,
            }}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltipDelayed}
            onMouseDown={(e) => e.stopPropagation()} // ✅ evita pane click / drag raros
            onClick={(e) => {
              e.stopPropagation();
              setSticky((v) => !v); // click = fija / libera
            }}
            role="tooltip"
          >
            <div className="edge-tooltip__title">
              <span>{tooltipTitle}</span>
              <span className="edge-tooltip__pin">{sticky ? "📌" : ""}</span>
            </div>

            <div className="edge-tooltip__body">{tooltipBody || "Sin descripción"}</div>

            {data?.multicast && (
              <div className="edge-tooltip__extra">Multicast: {data.multicast}</div>
            )}
          </div>,
          document.body
        )
      : null;

  /* ----------------------- Render del Edge ----------------------- */
  return (
    <>
      {/* Definición del marker */}
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

      {/* Línea visible */}
      <path
        d={edgePath}
        fill="none"
        style={animatedStyle}
        markerEnd={markerUrl}
        className="edge-stroke-animated"
      />

      {/* Path invisible para hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltipDelayed}
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

      {/* ✅ Tooltip real (Portal) */}
      {tooltipPortal}
    </>
  );
}
