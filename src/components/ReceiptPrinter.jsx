import { forwardRef, useImperativeHandle } from 'react';
import { useCompany } from "../context/CompanyContext";
import { printDocument } from "../lib/documentPrinter";

const ReceiptPrinter = forwardRef((props, ref) => {
  const { companyInfo } = useCompany();

  useImperativeHandle(ref, () => ({
    print: (data) => {
      setTimeout(() => {
        printDocument({
          ...data,
          type: data.type === 'entry' ? 'ENTRY' : data.type === 'exit' ? 'EXIT' : data.type
        }, companyInfo);
      }, 80);
    }
  }));

  return null;
});

export default ReceiptPrinter;
