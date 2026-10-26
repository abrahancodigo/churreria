import { useContext } from "react";
import { CompanyContext } from "../context/company-context";

/** Datos de empresa compartidos; no inicia lecturas por su cuenta. */
export function useCompany() {
    return useContext(CompanyContext).companyInfo;
}
