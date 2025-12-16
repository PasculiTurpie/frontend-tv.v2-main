import { getSmoothStepPath } from "@xyflow/react";
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
  const [edgePath] = useMemo(() => {
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

  /* ---------------------- Tooltip content ---------------------- */
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
  const hideTimerRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [sticky, setSticky] = useState(false);

  // ✅ posición del tooltip en pantalla (clientX/clientY)
  const [tipScreen, setTipScreen] = useState({ left: 0, top: 0 });

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const showTooltip = useCallback((evt) => {
    clearHideTimer();
    setHover(true);

    // ✅ si viene evento (mouse), ancla al punto exacto sobre el edge
    if (evt?.clientX != null && evt?.clientY != null) {
      setTipScreen({ left: evt.clientX, top: evt.clientY });
    }
  }, []);

  const hideTooltipDelayed = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (!sticky) setHover(false);
    }, 120);
  }, [sticky]);

  useEffect(() => {
    return () => clearHideTimer();
  }, []);

  // ✅ mientras no esté sticky, el tooltip sigue al mouse sobre el edge
  const handleMouseMove = useCallback(
    (evt) => {
      if (sticky) return;
      if (evt?.clientX == null || evt?.clientY == null) return;
      setTipScreen({ left: evt.clientX, top: evt.clientY });
    },
    [sticky]
  );

  const tooltipPortal =
    hover && (tooltipBody || data?.multicast)
      ? createPortal(
          <div
            className={`edge-tooltip ${sticky ? "edge-tooltip--sticky" : ""}`}
            style={{
              left: tipScreen.left + 10,
              top: tipScreen.top + 10,
            }}
            onMouseEnter={(e) => showTooltip(e)}
            onMouseLeave={hideTooltipDelayed}
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

            <div className="edge-tooltip__extra" style={{ opacity: 0.75 }}>
              {sticky ? "Fijado (click para soltar)" : "Click para fijar"}
            </div>
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

      {/* ✅ Path invisible para hover + seguimiento del mouse */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={showTooltip}
        onMouseMove={handleMouseMove}
        onMouseLeave={hideTooltipDelayed}
        onClick={(e) => {
          // ✅ click sobre el edge: fija / libera
          e.stopPropagation();
          showTooltip(e);
          setSticky((v) => !v);
        }}
      />

      {/* Tooltip "Guardando…" */}
      {isSaving && (
        <foreignObject
          x={Math.min(sourceX, targetX) + Math.abs(targetX - sourceX) / 2 - 40}
          y={Math.min(sourceY, targetY) + Math.abs(targetY - sourceY) / 2 - 50}
          width={90}
          height={24}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="edge-saving-tooltip"
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
