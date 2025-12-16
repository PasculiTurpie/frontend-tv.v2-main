// src/pages/ChannelDiagram/edges/DraggableDirectionalEdge.jsx
import { getSmoothStepPath, useStore } from "@xyflow/react";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

import "../DiagramFlow.css"; // ⚠️ tu CSS está en DiagramFlow.css
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

  // Centro real (respeta labelPosition si existe)
  const currentLabelX = data?.labelPosition?.x ?? labelX;
  const currentLabelY = data?.labelPosition?.y ?? labelY;

  const buildTooltipFromData = (d) => {
    const start = d?.labelStart || d?.endpointLabels?.source || "";
    const end = d?.labelEnd || d?.endpointLabels?.target || "";
    if (start && end) return `${start} → ${end}`;
    return start || end || "";
  };

  const tooltipTitle =
    data?.tooltipTitle ?? label ?? data?.label ?? id ?? "Etiqueta centro";
  const tooltipBody = data?.tooltip || buildTooltipFromData(data);

  // Color elegido
  const direction = data?.direction ?? "ida";
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

  /* ---------------- Tooltip portal (fixed) ---------------- */
  const transform = useStore((s) => s.transform); // [x,y,zoom]
  const rfDomNode = useStore((s) => s.domNode);

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
      // si está fijado, no lo escondas
      if (!sticky) setHover(false);
    }, 140);
  }, [sticky]);

  useEffect(() => () => clearHideTimer(), []);

  const screenPos = useMemo(() => {
    const [tx, ty, zoom] = Array.isArray(transform) ? transform : [0, 0, 1];
    const x = Number.isFinite(currentLabelX) ? currentLabelX : labelX;
    const y = Number.isFinite(currentLabelY) ? currentLabelY : labelY;

    if (!rfDomNode || typeof rfDomNode.getBoundingClientRect !== "function") {
      return { left: 0, top: 0 };
    }

    const rect = rfDomNode.getBoundingClientRect();
    return {
      left: rect.left + x * zoom + tx,
      top: rect.top + y * zoom + ty,
    };
  }, [transform, rfDomNode, currentLabelX, currentLabelY, labelX, labelY]);

  const tooltipPortal =
    hover && (tooltipBody || data?.multicast)
      ? createPortal(
          <div
            className={`edge-tooltip ${sticky ? "edge-tooltip--sticky" : ""}`}
            style={{
              left: `${screenPos.left + 10}px`,
              top: `${screenPos.top + 10}px`,
            }}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltipDelayed}
            onClick={(e) => {
              e.stopPropagation();
              setSticky((v) => !v); // click = fijar/soltar
            }}
            role="tooltip"
          >
            <div className="edge-tooltip__title">
              <span>{tooltipTitle}</span>
              <span className="edge-tooltip__pin" title="Click para fijar / soltar">
                {sticky ? "📌" : "📍"}
              </span>
            </div>

            <div>{tooltipBody || "Sin descripción"}</div>

            {data?.multicast && (
              <div className="edge-tooltip__extra">Multicast: {data.multicast}</div>
            )}

            <div className="edge-tooltip__extra" style={{ opacity: 0.65 }}>
              {sticky ? "Fijado (click para soltar)" : "Click para fijar"}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {/* Marker único */}
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

      {/* Hover zone (invisible) */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltipDelayed}
      />

      {/* Tooltip guardando */}
      {isSaving && (
        <foreignObject
          x={(currentLabelX ?? labelX) - 40}
          y={(currentLabelY ?? labelY) - 50}
          width={90}
          height={24}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div xmlns="http://www.w3.org/1999/xhtml" className="edge-saving-tooltip">
            Guardando…
          </div>
        </foreignObject>
      )}

      {/* Tooltip principal (portal) */}
      {tooltipPortal}
    </>
  );
}
