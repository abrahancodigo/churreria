// Etiqueta de un tipo de transaccion.
//
// Antes vivia dentro de `pages/Transactions.jsx`, lo que obligaba a los reportes
// a importar una pagina entera y creaba un ciclo de imports. Aqui no hay
// dependencias, asi que cualquier vista puede usar la etiqueta.

export const typeLabel = (type) => {
    if (type === "sale") return "Venta";
    if (type === "entry") return "Entrada";
    return "Salida";
};
