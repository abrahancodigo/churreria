import { createContext } from "react";

export const CompanyContext = createContext({
    companyInfo: {},
    loading: false
});