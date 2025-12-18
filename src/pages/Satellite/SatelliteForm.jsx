// src/pages/Satellite/SatelliteForm.jsx
import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";

import api from "../../utils/api";
import "../../components/styles/theme.css";
import "../../components/styles/forms.css";
import "../../components/styles/tables.css";

// =========================
// Validación
// =========================
const SatelliteSchema = Yup.object().shape({
  satelliteName: Yup.string().trim().required("Campo obligatorio"),
  satelliteUrl: Yup.string()
    .trim()
    .test(
      "starts-with-http",
      "La URL debe comenzar con http:// o https://",
      (value) => value?.startsWith("http://") || value?.startsWith("https://")
    )
    .url("Debe ser una URL válida")
    .required("La URL es obligatoria"),
  satelliteType: Yup.string()
    .notOneOf(["0", "default", ""], "Debes seleccionar una opción válida.")
    .required("Campo obligatorio"),
});

// =========================
// Helpers
// =========================
const normalizeString = (v) => String(v ?? "").trim();

const pickTipoId = (tipo) => {
  // tu controller sanitize devuelve { id: "..." }
  return tipo?.id || tipo?._id || null;
};

const isEmptySelect = (v) => {
  const val = normalizeString(v);
  return !val || val === "0" || val === "default";
};

const SatelliteForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const createdSatelliteIdRef = useRef(null);

  // Puedes ajustar esto si quieres un valor por defecto
  const initialValues = useMemo(
    () => ({
      satelliteName: "",
      satelliteUrl: "",
      satelliteType: "", // viene desde select (obligatorio según schema)
    }),
    []
  );

  const handleRollbackSatellite = async () => {
    const satId = createdSatelliteIdRef.current;
    if (!satId) return;

    try {
      await api.deleteSatelliteId(satId);
      console.log("Rollback OK: satélite eliminado:", satId);
    } catch (e) {
      console.error("Rollback FAILED (no se pudo eliminar satélite):", satId, e);
    } finally {
      createdSatelliteIdRef.current = null;
    }
  };

  const onSubmit = async (values, { resetForm }) => {
    setLoading(true);
    createdSatelliteIdRef.current = null;

    try {
      // 1) Normaliza datos
      const satelliteName = normalizeString(values.satelliteName);
      const satelliteUrl = normalizeString(values.satelliteUrl);

      // 2) Tipo seleccionado por el usuario
      let satelliteTypeId = normalizeString(values.satelliteType);

      // ✅ Regla clave:
      // Si viene vacío (o default), recién ahí intentamos resolver/crear "satelite"
      // (Esto evita el 409 + error fatal cuando ya existe)
      if (isEmptySelect(satelliteTypeId)) {
        const tipo = await api.getOrCreateTipoEquipo("satelite");
        satelliteTypeId = pickTipoId(tipo);

        if (!satelliteTypeId) {
          throw new Error("No se pudo resolver el TipoEquipo 'satelite'.");
        }
      }

      const payloadSat = {
        satelliteName,
        satelliteUrl,
        satelliteType: satelliteTypeId,
      };

      console.log("payloadSat =>", payloadSat);

      // 3) Crear satélite
      const created = await api.createSatelite(payloadSat);
      console.log("sat created =>", created);

      // guarda ID para rollback si luego falla algo
      const createdId =
        created?._id || created?.id || created?.data?._id || created?.data?.id;
      if (createdId) createdSatelliteIdRef.current = createdId;

      // 4) OK
      await Swal.fire({
        icon: "success",
        title: "Satélite guardado",
        html: `
          <div style="text-align:left">
            <b>Nombre:</b> ${payloadSat.satelliteName}<br/>
            <b>URL:</b> ${payloadSat.satelliteUrl}<br/>
            <b>Tipo:</b> ${payloadSat.satelliteType}<br/>
          </div>
        `,
        confirmButtonText: "OK",
      });

      createdSatelliteIdRef.current = null; // ya no necesitamos rollback
      resetForm();
      navigate("/list-satellite");
    } catch (error) {
      // Log robusto (evita status undefined)
      console.error("SatelliteForm submit error =>", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        raw: error,
      });

      // Si alcanzó a crearse el satélite y luego falló algo, rollback
      await handleRollbackSatellite();

      const backendMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Error al guardar satélite";

      await Swal.fire({
        icon: "error",
        title: "Error",
        text: backendMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="outlet-main">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to="/list-satellite">Listar</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Formulario Satélite
          </li>
        </ol>
      </nav>

      <div className="card">
        <div className="card-header">
          <h2>Crear Satélite</h2>
        </div>

        <div className="card-body">
          <Formik
            initialValues={initialValues}
            validationSchema={SatelliteSchema}
            onSubmit={onSubmit}
          >
            {({ errors, touched }) => (
              <Form className="form">
                {/* Nombre */}
                <div className="form-group">
                  <label htmlFor="satelliteName">Nombre Satélite</label>
                  <Field
                    id="satelliteName"
                    name="satelliteName"
                    className={`form-control ${
                      errors.satelliteName && touched.satelliteName
                        ? "is-invalid"
                        : ""
                    }`}
                    placeholder="INTELSAT 21"
                  />
                  {errors.satelliteName && touched.satelliteName ? (
                    <div className="invalid-feedback">{errors.satelliteName}</div>
                  ) : null}
                </div>

                {/* URL */}
                <div className="form-group">
                  <label htmlFor="satelliteUrl">URL (Lyngsat u otra)</label>
                  <Field
                    id="satelliteUrl"
                    name="satelliteUrl"
                    className={`form-control ${
                      errors.satelliteUrl && touched.satelliteUrl
                        ? "is-invalid"
                        : ""
                    }`}
                    placeholder="https://www.lyngsat.com/Intelsat-21.html"
                  />
                  {errors.satelliteUrl && touched.satelliteUrl ? (
                    <div className="invalid-feedback">{errors.satelliteUrl}</div>
                  ) : null}
                </div>

                {/* Tipo de equipo */}
                <div className="form-group">
                  <label htmlFor="satelliteType">Tipo de Equipo</label>
                  <Field
                    as="select"
                    id="satelliteType"
                    name="satelliteType"
                    className={`form-control ${
                      errors.satelliteType && touched.satelliteType
                        ? "is-invalid"
                        : ""
                    }`}
                  >
                    <option value="">Selecciona…</option>

                    {/* ✅ IMPORTANTE:
                        Aquí debes renderizar tus tipos reales.
                        Si ya lo hacías con state (tipos) + map,
                        reemplaza estas opciones mock por tu lista.
                    */}
                    {/* Ejemplo placeholder */}
                    {/* <option value="68091d071804f0832c24b121">satelite</option> */}
                  </Field>

                  {errors.satelliteType && touched.satelliteType ? (
                    <div className="invalid-feedback">{errors.satelliteType}</div>
                  ) : null}
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Guardando..." : "Guardar"}
                  </button>

                  <Link to="/list-satellite" className="btn btn-secondary">
                    Cancelar
                  </Link>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
};

export default SatelliteForm;
