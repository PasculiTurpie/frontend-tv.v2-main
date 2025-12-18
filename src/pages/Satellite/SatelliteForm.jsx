// src/pages/Satellite/SatelliteForm.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import api from "../../utils/api";
import "../../components/styles/theme.css";
import "../../components/styles/forms.css";
import "../../components/styles/tables.css";

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

const normalizeArray = (resp) => {
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.data)) return resp.data;
  return [];
};

const getErrMsg = (e) =>
  e?.response?.data?.message ||
  e?.response?.data?.error ||
  e?.message ||
  "Error desconocido";

const SatelliteForm = () => {
  const [polarizations, setPolarizations] = useState([]);
  const [tipoMap, setTipoMap] = useState({});
  const [loadingTipos, setLoadingTipos] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await api.getPolarizations();
        const arr = normalizeArray(resp);
        if (mounted) setPolarizations(arr);
      } catch (e) {
        console.error("Error fetching polarization data:", e);
        if (mounted) setPolarizations([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTipos(true);
        const res = await api.getTipoEquipo();
        const arr = normalizeArray(res);
        const map = {};
        for (const t of arr) {
          if (t?.tipoNombre && t?._id) {
            map[String(t.tipoNombre).toLowerCase().trim()] = t._id;
          }
        }
        if (mounted) setTipoMap(map);
      } catch (err) {
        console.warn("No se pudo cargar TipoEquipo:", err?.response?.data || err);
      } finally {
        if (mounted) setLoadingTipos(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Resuelve contra backend (no depende del estado)
  const ensureTipoId = async (name = "satelite") => {
    const key = String(name).toLowerCase().trim();

    if (tipoMap[key]) return tipoMap[key];

    const res1 = await api.getTipoEquipo();
    const arr1 = normalizeArray(res1);
    const found1 = arr1.find(
      (t) => String(t?.tipoNombre).toLowerCase().trim() === key
    );
    if (found1?._id) {
      setTipoMap((prev) => ({ ...prev, [key]: found1._id }));
      return found1._id;
    }

    try {
      const created = await api.createTipoEquipo({ tipoNombre: name });
      if (created?._id) {
        setTipoMap((prev) => ({ ...prev, [key]: created._id }));
        return created._id;
      }
    } catch (e) {
      console.warn("createTipoEquipo falló:", e?.response?.data || e);
    }

    const res2 = await api.getTipoEquipo();
    const arr2 = normalizeArray(res2);
    const found2 = arr2.find(
      (t) => String(t?.tipoNombre).toLowerCase().trim() === key
    );
    if (found2?._id) {
      setTipoMap((prev) => ({ ...prev, [key]: found2._id }));
      return found2._id;
    }

    throw new Error("No existe ni se pudo crear el TipoEquipo 'satelite'.");
  };

  return (
    <div className="outlet-main">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to="/listar-satelite">Listar</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Formulario
          </li>
        </ol>
      </nav>

      <Formik
        initialValues={{ satelliteName: "", satelliteUrl: "", satelliteType: "" }}
        validationSchema={SatelliteSchema}
        onSubmit={async (values, { resetForm, setSubmitting }) => {
          if (loadingTipos) {
            Swal.fire({
              icon: "info",
              title: "Cargando tipos…",
              text: "Espera y reintenta.",
            });
            return;
          }

          setSubmitting(true);
          let satId = null;

          try {
            const payloadSat = {
              satelliteName: values.satelliteName.trim(),
              satelliteUrl: values.satelliteUrl.trim(),
              satelliteType: values.satelliteType,
            };
            console.log("payloadSat =>", payloadSat);

            // 1) crear satélite
            const sat = await api.createSatelite(payloadSat);

            satId = sat?._id;
            console.log("sat created =>", sat);

            if (!satId) throw new Error("No se recibió _id del satélite.");

            // 2) asegurar tipo satelite
            const tipoSatId = await ensureTipoId("satelite");
            console.log("tipoSatId =>", tipoSatId);
            if (!tipoSatId) throw new Error("tipoSatId undefined.");

            // 3) crear equipo (OBLIGATORIO)
            const payloadEquipo = {
              nombre: values.satelliteName.trim(),
              marca: "SAT",
              modelo: "GENERIC",
              tipoNombre: tipoSatId,
              satelliteRef: satId,
            };
            console.log("payloadEquipo =>", payloadEquipo);

            try {
              await api.createEquipo(payloadEquipo);
            } catch (e) {
              console.error("POST /equipos falló =>", {
                status: e?.response?.status,
                data: e?.response?.data,
                message: e?.message,
                payloadEquipo,
              });
              throw e;
            }

            const selected = (polarizations || []).find(
              (p) => p?._id === values.satelliteType
            );
            const polarizationName = selected?.typePolarization || "Desconocido";

            await Swal.fire({
              title: "Satélite guardado",
              icon: "success",
              html: `
                <div style="text-align:left">
                  <div><b>Nombre:</b> ${values.satelliteName}</div>
                  <div><b>URL:</b> ${values.satelliteUrl}</div>
                  <div><b>Polarización:</b> ${polarizationName}</div>
                  <hr/>
                  <div><b>Equipo:</b> Creado</div>
                </div>
              `,
            });

            resetForm();
            nameInputRef.current?.focus();
          } catch (error) {
            console.error("SatelliteForm submit error =>", {
              status: error?.response?.status,
              data: error?.response?.data,
              message: error?.message,
            });

            const msg = getErrMsg(error);

            // ✅ rollback SOLO si realmente se creó satélite (satId válido)
            if (satId) {
              try {
                await api.deleteSatelliteId(satId);
                console.warn("Rollback OK: satélite eliminado:", satId);
              } catch (rbErr) {
                console.warn("Rollback falló:", getErrMsg(rbErr));
              }
            } else {
              console.warn("Sin rollback: satélite no alcanzó a crearse (satId null).");
            }

            Swal.fire({
              title: "Error",
              icon: "error",
              text: "No se pudo completar la creación Satélite + Equipo.",
              footer: msg,
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className="form__add">
            <h1 className="form__titulo">Ingresa un satélite</h1>

            <div className="form__group">
              <label htmlFor="satelliteName" className="form__group-label">
                Nombre de Satélite
                <br />
                <Field
                  innerRef={nameInputRef}
                  type="text"
                  className="form__group-input"
                  placeholder="Nombre"
                  name="satelliteName"
                />
              </label>
              {errors.satelliteName && touched.satelliteName && (
                <div className="form__group-error">{errors.satelliteName}</div>
              )}
            </div>

            <div className="form__group">
              <label htmlFor="satelliteUrl" className="form__group-label">
                Url web
                <br />
                <Field
                  type="text"
                  className="form__group-input"
                  placeholder="https://…"
                  name="satelliteUrl"
                />
              </label>
              {errors.satelliteUrl && touched.satelliteUrl && (
                <div className="form__group-error">{errors.satelliteUrl}</div>
              )}
            </div>

            <div className="form__group">
              <label htmlFor="satelliteType" className="form__group-label">
                Selecciona la polaridad
                <br />
                <Field as="select" className="form__group-input" name="satelliteType">
                  <option value={"0"}>--Seleccionar--</option>
                  {(polarizations || []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.typePolarization}
                    </option>
                  ))}
                </Field>
              </label>
              {errors.satelliteType && touched.satelliteType && (
                <div className="form__group-error">{errors.satelliteType}</div>
              )}
            </div>

            <button type="submit" className="button btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Enviar"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default SatelliteForm;
