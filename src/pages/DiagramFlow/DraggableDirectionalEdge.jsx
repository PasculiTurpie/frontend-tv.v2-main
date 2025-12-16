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

  /* ---------------- Hover + Sticky ---------------- */
  const [hover, setHover] = useState(false);
  const [sticky, setSticky] = useState(false);
  const hideTimerRef = useRef(null);

  const showTooltip = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setHover(true);
  };

  const hideTooltipDelayed = () => {
    if (sticky) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setHover(false);
    }, 120);
  };

  const toggleSticky = (e) => {
    e.stopPropagation();
    setSticky((prev) => !prev);
    setHover(true);
  };

  /* ---- cerrar sticky con ESC o click fuera ---- */
  useEffect(() => {
    if (!sticky) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        setSticky(false);
        setHover(false);
      }
    };

    const onClickOutside = () => {
      setSticky(false);
      setHover(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClickOutside);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClickOutside);
    };
  }, [sticky]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
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

      {/* Hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltipDelayed}
        onClick={toggleSticky}
        style={{ cursor: "pointer" }}
      />

      {/* Tooltip Guardando */}
      {isSaving && (
        <foreignObject
          x={currentLabelX - 40}
          y={currentLabelY - 50}
          width={90}
          height={24}
        >
          <div className="edge-saving-tooltip">Guardando…</div>
        </foreignObject>
      )}

      {/* Tooltip centrado + sticky */}
      {hover && (tooltipBody || data?.multicast) && (
        <foreignObject
          x={currentLabelX - 130}
          y={currentLabelY - 90}
          width={260}
          height={150}
        >
          <div
            className={`edge-tooltip ${sticky ? "edge-tooltip--sticky" : ""}`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltipDelayed}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="edge-tooltip__title">
              {tooltipTitle}
              {sticky && <span className="edge-tooltip__pin">📌</span>}
            </div>
            <div className="edge-tooltip__body">
              {tooltipBody || "Sin descripción"}
            </div>
            {data?.multicast && (
              <div className="edge-tooltip__extra">
                Multicast: {data.multicast}
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </>
  );
}
