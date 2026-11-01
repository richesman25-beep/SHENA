"use client";
import { useEffect, useRef, useState } from "react";
import {
  communes,
  departments,
  communeName,
  departmentName,
  type CustomerLocation,
} from "@/lib/geography";
import { useLocation } from "./location-provider";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
export function LocationPicker({ compact = false }: { compact?: boolean }) {
  const { location, setLocation } = useLocation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className={`location-trigger ${compact ? "compact" : ""}`}
        onClick={() => setOpen(true)}
      >
        <Icon name="pin" />
        <span>
          <small>Recevoir mes produits à</small>
          <strong>
            {location
              ? communeName(location.communeId)
              : "Choisir ma localisation"}
          </strong>
          {!compact && (
            <small>
              {location
                ? departmentName(location.departmentId)
                : "Département & commune"}{" "}
              ▾
            </small>
          )}
        </span>
      </button>
      {open &&
        createPortal(
          <LocationDialog
            initial={location}
            onSave={setLocation}
            onClose={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          />,
          document.body,
        )}
    </>
  );
}
function LocationDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: CustomerLocation | null;
  onSave: (v: CustomerLocation | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [department, setDepartment] = useState(initial?.departmentId || "");
  const [commune, setCommune] = useState(initial?.communeId || "");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="location-dialog"
      aria-labelledby="location-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="location-dialog-inner">
        <button
          className="dialog-close"
          aria-label="Fermer la localisation"
          onClick={() => ref.current?.close()}
        >
          ×
        </button>
        <span className="eyebrow">VOTRE QUOTIDIEN, PLUS PRÈS</span>
        <h2 id="location-title">Où souhaitez-vous recevoir vos produits ?</h2>
        <p>
          Choisissez votre commune pour explorer les stocks de démonstration à
          proximité. Aucune position GPS n’est demandée.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ departmentId: department, communeId: commune });
            ref.current?.close();
          }}
        >
          <label>
            Département
            <select
              aria-label="Département"
              required
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setCommune("");
              }}
            >
              <option value="">Sélectionner un département</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Commune
            <select
              aria-label="Commune"
              required
              disabled={!department}
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
            >
              <option value="">Sélectionner une commune</option>
              {communes
                .filter((c) => c.departmentId === department)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <small>
            Référentiel partiel de démonstration : 10 départements, 16 communes.
            Les quartiers ne sont pas assimilés à des communes. Votre choix
            reste sur cet appareil.
          </small>
          <button type="submit" className="button" disabled={!commune}>
            Confirmer ma localisation
          </button>
          <button
            type="button"
            className="country-button"
            onClick={() => {
              onSave(null);
              ref.current?.close();
            }}
          >
            Voir les produits dans toute Haïti
          </button>
        </form>
      </div>
    </dialog>
  );
}
