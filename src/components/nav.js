import {
    LayoutDashboard,
    Package,
    ArrowRightLeft,
    Receipt,
    FileBarChart2,
    Settings as SettingsIcon,
    Database,
} from "lucide-react";

export const NAV_GROUPS = [
    {
        label: "Almacén",
        items: [
            { name: "Inicio", path: "/", icon: LayoutDashboard },
            { name: "Inventario", path: "/inventory", icon: Package },
            { name: "Nuevo movimiento", path: "/stock-adjustments", icon: ArrowRightLeft },
        ],
    },
    {
        label: "Actividad",
        items: [
            { name: "Historial", path: "/transactions", icon: Receipt },
            { name: "Reportes", path: "/reports", icon: FileBarChart2 },
        ],
    },
    {
        label: "Ajustes",
        adminOnly: true,
        items: [
            { name: "Configuración", path: "/settings", icon: SettingsIcon },
            { name: "Backup", path: "/backup", icon: Database },
        ],
    },
];

export const BOTTOM_TABS = [
    { name: "Almacén", path: "/inventory", icon: Package },
    { name: "Inicio", path: "/", icon: LayoutDashboard, center: true },
    { name: "Historial", path: "/transactions", icon: Receipt },
];
