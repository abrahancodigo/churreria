/**
 * Optimización de imágenes de productos
 * =====================================
 * Firestore limita cada documento a 1.048.600 bytes. Guardar la foto de la
 * cámara directamente en base64 (una foto típica ocupa 1,5-4 MB) hace que la
 * escritura falle con "Documents are limited to ... bytes".
 *
 * Este módulo decodifica, redimensiona y recodifica la imagen en el navegador
 * para que el dataURL final pese como mucho ~700 KB, con lo que el documento
 * completo queda siempre por debajo del límite.
 *
 * Todas las funciones lanzan `Error` con un mensaje pensado para el usuario.
 */

// Lado máximo del lado más largo.
const MAX_DIMENSION = 1280;
// Objetivo en caracteres del dataURL (el base64 son ~4/3 de los bytes reales).
const TARGET_LENGTH = 700_000;
// Límite absoluto de archivo aceptado.
const MAX_FILE_SIZE = 20 * 1024 * 1024;
// Calidades JPEG de reserva: si la imagen no cabe, se repite más comprimida.
const JPEG_QUALITIES = [0.82, 0.68, 0.55, 0.42];

/** Decodifica el archivo en un drawable (createImageBitmap con fallback <img>). */
const decode = async (file) => {
    if (typeof createImageBitmap === "function") {
        try {
            const bitmap = await createImageBitmap(file);
            return {
                source: bitmap,
                width: bitmap.width,
                height: bitmap.height,
                close: () => bitmap.close?.(),
            };
        } catch {
            // Navegador sin soporte: seguimos con <img>.
        }
    }

    const objectUrl = URL.createObjectURL(file);
    try {
        const image = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error("No se pudo leer la imagen."));
            el.src = objectUrl;
        });
        return {
            source: image,
            width: image.naturalWidth,
            height: image.naturalHeight,
            close: () => URL.revokeObjectURL(objectUrl),
        };
    } catch (error) {
        URL.revokeObjectURL(objectUrl);
        throw error;
    }
};

/** Dibuja el drawable en un canvas escalado. */
const drawScaled = (source, width, height, scale) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
};

/** ¿Tiene canales alfa? Se muestrea una miniatura para no leer todo el canvas. */
const hasTransparency = (canvas) => {
    try {
        const probe = document.createElement("canvas");
        probe.width = 32;
        probe.height = 32;
        const ctx = probe.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(canvas, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) return true;
        }
    } catch {
        // Si no se puede leer, asumimos opaco (JPEG es seguro).
    }
    return false;
};

/** Copia del canvas rellenando el fondo de blanco (para perder el alfa). */
const flattenOnWhite = (canvas) => {
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    return flat;
};

/** JPEG con escalera de calidades y, si hace falta, reducción de tamaño. */
const encodeJpeg = (canvas) => {
    for (const quality of JPEG_QUALITIES) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= TARGET_LENGTH) return dataUrl;
    }

    // Último recurso: reducir dimensiones y volver a comprimir.
    let current = canvas;
    for (const factor of [0.7, 0.5, 0.35]) {
        const resized = document.createElement("canvas");
        resized.width = Math.max(1, Math.round(current.width * factor));
        resized.height = Math.max(1, Math.round(current.height * factor));
        const ctx = resized.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(current, 0, 0, resized.width, resized.height);
        const dataUrl = resized.toDataURL("image/jpeg", 0.6);
        if (dataUrl.length <= TARGET_LENGTH) return dataUrl;
        current = resized;
    }

    throw new Error(
        "La imagen pesa demasiado aunque se comprima. Usa una foto más pequeña."
    );
};

/**
 * Procesa un archivo de imagen y devuelve el dataURL listo para Firestore.
 * @param {File} file archivo seleccionado en el input
 * @returns {Promise<string>} dataURL optimizada
 * @throws {Error} con mensaje en español para el usuario
 */
export const processImageFile = async (file) => {
    if (!file) throw new Error("Error al cargar la imagen: no se seleccionó ningún archivo.");
    if (!file.type || !file.type.startsWith("image/")) {
        throw new Error("Error al cargar la imagen: el archivo no es una imagen válida.");
    }
    if (file.size > MAX_FILE_SIZE) {
        throw new Error("Error al cargar la imagen: supera los 20 MB permitidos.");
    }

    const { source, width, height, close } = await decode(file);
    try {
        if (!width || !height) {
            throw new Error("Error al cargar la imagen: no se pudieron leer sus dimensiones.");
        }

        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        const canvas = drawScaled(source, width, height, scale);

        const keepsTransparency =
            file.type === "image/png" || file.type === "image/webp";

        if (keepsTransparency && hasTransparency(canvas)) {
            // Logos y recortes: conservamos el alfa reduciendo si hace falta.
            for (const factor of [1, 0.7, 0.5, 0.35]) {
                const piece =
                    factor === 1
                        ? canvas
                        : drawScaled(canvas, canvas.width, canvas.height, factor);
                const dataUrl = piece.toDataURL("image/png");
                if (dataUrl.length <= TARGET_LENGTH) return dataUrl;
            }
            // Sin hueco: fondo blanco y JPEG.
            return encodeJpeg(flattenOnWhite(canvas));
        }

        return encodeJpeg(canvas);
    } finally {
        close?.();
    }
};
