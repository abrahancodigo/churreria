import { useMemo, useState, useEffect } from "react";
import {
    ArrowDownLeft,
    ArrowUpRight,
    X,
    FileText,
    Edit,
    Calendar,
    Package,
    User,
    Boxes,
    Layers,
    Info,
    ArrowRightLeft,
    ShoppingCart,
} from "lucide-react";
import { db } from "../firebase.config";
import { collection, query, where, getDocs, orderBy, doc, getDoc } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { Link } from "react-router-dom";
import { getProducts } from "../lib/db";
import { formatCurrency } from "../lib/formatters";
import MovementPanel from "../components/MovementPanel";

export default function Dashboard() {
    const [products, setProducts] = useState([]);
    const [users, setUsers] = useState({}); // Mapa de usuarios: { uid: { email, name } }
    const [entries, setEntries] = useState([]);
    const [exits, setExits] = useState([]);
    const [viewingTransaction, setViewingTransaction] = useState(null);
    const [loading, setLoading] = useState(true);

    // Estado para el saldo del inventario
    const [inventoryBalance, setInventoryBalance] = useState(0);
    const [totalItems, setTotalItems] = useState(0);

    // Inicializar con el mes actual
    const currentMonth = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());

    // Estado para fechas - Entradas
    const [entryStartDate, setEntryStartDate] = useState(currentMonth);
    const [entryEndDate, setEntryEndDate] = useState(currentMonthEnd);

    // Estado para fechas - Salidas
    const [exitStartDate, setExitStartDate] = useState(currentMonth);
    const [exitEndDate, setExitEndDate] = useState(currentMonthEnd);

    const productsById = useMemo(
        () => new Map(products.map((product) => [product.id, product])),
        [products],
    );

    useEffect(() => {
        const unsubscribeProducts = getProducts((data) => {
            setProducts(data);

            // Calcular saldo del inventario: costo × stock
            const balance = data.reduce((acc, p) => {
                return acc + (Number(p.cost || 0) * Number(p.stock || 0));
            }, 0);
            const totalItems = data.reduce((acc, p) => acc + Number(p.stock || 0), 0);

            setInventoryBalance(balance);
            setTotalItems(totalItems);
        });

        return () => unsubscribeProducts();
    }, []);

    // Cargar los usuarios que aparecen en los movimientos del periodo actual.
    useEffect(() => {
        const userIds = [...new Set([...entries, ...exits]
            .map((transaction) => transaction.userId)
            .filter((userId) => userId && !users[userId]))];

        if (userIds.length === 0) return undefined;

        let isCurrent = true;
        Promise.all(userIds.map(async (userId) => {
            try {
                const userSnapshot = await getDoc(doc(db, "users", userId));
                const userData = userSnapshot.exists() ? userSnapshot.data() : {};
                const email = userData.email || userId;
                return [userId, { email, name: userData.name || email }];
            } catch (error) {
                console.warn(`No se pudo cargar el usuario ${userId}:`, error);
                return [userId, { email: userId, name: userId }];
            }
        })).then((userEntries) => {
            if (isCurrent) setUsers((current) => ({ ...current, ...Object.fromEntries(userEntries) }));
        });

        return () => { isCurrent = false; };
    }, [entries, exits, users]);

    // Fetch entradas cuando cambian las fechas
    useEffect(() => {
        const fetchEntries = async () => {
            try {
                const start = startOfDay(entryStartDate);
                const end = endOfDay(entryEndDate);

                const entriesQuery = query(
                    collection(db, "transactions"),
                    where("type", "==", "entry"),
                    where("timestamp", ">=", start),
                    where("timestamp", "<=", end),
                    orderBy("timestamp", "desc")
                );
                const entriesSnapshot = await getDocs(entriesQuery);

                const entriesData = entriesSnapshot.docs
                    .map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));

                setEntries(entriesData);
            } catch (error) {
                console.error("Error fetching entries:", error);
                setEntries([]);
            } finally {
                setLoading(false);
            }
        };

        fetchEntries();
    }, [entryStartDate, entryEndDate]);

    // Fetch salidas cuando cambian las fechas
    useEffect(() => {
        const fetchExits = async () => {
            try {
                const start = startOfDay(exitStartDate);
                const end = endOfDay(exitEndDate);

                const exitsQuery = query(
                    collection(db, "transactions"),
                    where("type", "==", "exit"),
                    where("timestamp", ">=", start),
                    where("timestamp", "<=", end),
                    orderBy("timestamp", "desc")
                );
                const exitsSnapshot = await getDocs(exitsQuery);

                const exitsData = exitsSnapshot.docs
                    .map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }));

                setExits(exitsData);
            } catch (error) {
                console.error("Error fetching exits:", error);
                setExits([]);
            } finally {
                setLoading(false);
            }
        };

        fetchExits();
    }, [exitStartDate, exitEndDate]);

    const handleViewTransaction = (tx) => {
        setViewingTransaction(tx);
    };

    const getMovementTotal = (transactions) => transactions.reduce((total, transaction) => (
        total + (transaction.items?.reduce((subtotal, item) => {
            const product = productsById.get(item.productId);
            const cost = Number(product?.cost ?? item.cost ?? 0);
            return subtotal + cost * Number(item.quantity || 0);
        }, 0) || 0)
    ), 0);

    const totalEntries = getMovementTotal(entries);
    const totalExits = getMovementTotal(exits);

    // Navegación de meses
    const previousMonth = (type) => {
        const current = type === 'entry' ? entryStartDate : exitStartDate;
        const prev = new Date(current.getFullYear(), current.getMonth() - 1, 1);
        if (type === 'entry') {
            setEntryStartDate(startOfMonth(prev));
            setEntryEndDate(endOfMonth(prev));
        } else {
            setExitStartDate(startOfMonth(prev));
            setExitEndDate(endOfMonth(prev));
        }
    };

    const nextMonth = (type) => {
        const current = type === 'entry' ? entryStartDate : exitStartDate;
        const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        const now = new Date();

        if (next.getMonth() > now.getMonth() || next.getFullYear() > now.getFullYear()) {
            if (type === 'entry') {
                setEntryStartDate(startOfMonth(now));
                setEntryEndDate(endOfMonth(now));
            } else {
                setExitStartDate(startOfMonth(now));
                setExitEndDate(endOfMonth(now));
            }
        } else {
            if (type === 'entry') {
                setEntryStartDate(startOfMonth(next));
                setEntryEndDate(endOfMonth(next));
            } else {
                setExitStartDate(startOfMonth(next));
                setExitEndDate(endOfMonth(next));
            }
        }
    };

    const resetToCurrentMonth = (type) => {
        const now = new Date();
        if (type === 'entry') {
            setEntryStartDate(startOfMonth(now));
            setEntryEndDate(endOfMonth(now));
        } else {
            setExitStartDate(startOfMonth(now));
            setExitEndDate(endOfMonth(now));
        }
    };

    const kpis = [
        {
            label: "Valor del inventario",
            value: formatCurrency(inventoryBalance),
            hint: "Suma de costo × stock",
            icon: Package,
            tone: "primary",
        },
        {
            label: "Productos",
            value: products.length,
            hint: "Referencias activas",
            icon: Boxes,
            tone: "success",
        },
        {
            label: "Items en stock",
            value: totalItems,
            hint: "Unidades totales",
            icon: Layers,
            tone: "warning",
        },
        {
            label: "Movimientos cargados",
            value: entries.length + exits.length,
            hint: `${entries.length} entradas · ${exits.length} salidas`,
            icon: ArrowRightLeft,
            tone: "danger",
        },
    ];

    const toneClasses = {
        primary: "bg-primary-50 text-primary-700",
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-700",
        neutral: "bg-ink-100 text-ink-600",
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="page-header">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">Resumen de tu tienda</p>
                    <h1 className="page-title">Tu tienda, de un vistazo</h1>
                    <p className="page-subtitle">Existencias y movimientos de almacén en un solo lugar.</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <Link to="/pos" className="btn-primary self-start sm:self-auto">
                        <ShoppingCart className="h-4 w-4" />
                        Nueva venta
                    </Link>
                    <Link to="/stock-adjustments" className="btn-secondary self-start sm:self-auto">
                        <Edit className="h-4 w-4" />
                        Registrar movimiento
                    </Link>
                </div>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpis.map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <div key={kpi.label} className="stat-card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="stat-label">{kpi.label}</p>
                                    <p className="stat-value truncate mt-1">
                                        {kpi.value}
                                    </p>
                                    <p className="text-xs text-ink-500 mt-1">{kpi.hint}</p>
                                </div>
                                <div className={`stat-icon ${toneClasses[kpi.tone]}`}>
                                    <Icon className="h-[18px] w-[18px]" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Movement panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MovementPanel
                    title="Entradas"
                    type="entry"
                    transactions={entries}
                    total={totalEntries}
                    startDate={entryStartDate}
                    endDate={entryEndDate}
                    loading={loading}
                    productsById={productsById}
                    onPrevious={() => previousMonth("entry")}
                    onNext={() => nextMonth("entry")}
                    onReset={() => resetToCurrentMonth("entry")}
                    onViewTransaction={handleViewTransaction}
                    onDateSelect={(start, end) => {
                        setEntryStartDate(start);
                        setEntryEndDate(end);
                    }}
                    icon={ArrowDownLeft}
                />

                <MovementPanel
                    title="Salidas"
                    type="exit"
                    transactions={exits}
                    total={totalExits}
                    startDate={exitStartDate}
                    endDate={exitEndDate}
                    loading={loading}
                    productsById={productsById}
                    onPrevious={() => previousMonth("exit")}
                    onNext={() => nextMonth("exit")}
                    onReset={() => resetToCurrentMonth("exit")}
                    onViewTransaction={handleViewTransaction}
                    onDateSelect={(start, end) => {
                        setExitStartDate(start);
                        setExitEndDate(end);
                    }}
                    icon={ArrowUpRight}
                />
            </div>

            {/* Inventory balance */}
            <section className="surface p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div>
                        <p className="section-label">Saldo de inventario</p>
                        <p className="mt-2 text-3xl font-bold text-ink-900 tracking-tight tabular-nums">
                            {formatCurrency(inventoryBalance)}
                        </p>
                        <p className="mt-1 text-sm text-ink-500">
                            Inversión total en mercancía disponible, valorada a costo.
                        </p>
                    </div>
                    <div className="surface-muted flex items-start gap-2.5 p-4 max-w-sm">
                        <Info className="h-4 w-4 text-ink-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-ink-600 leading-relaxed">
                            Se calcula sumando <strong className="font-semibold text-ink-800">costo × stock</strong> de cada
                            producto del inventario.
                        </p>
                    </div>
                </div>
            </section>

            {/* Transaction Detail Modal */}
            {viewingTransaction && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim/60 p-4 animate-fade-in"
                    onClick={() => setViewingTransaction(null)}
                >
                    <div
                        className="modal-panel relative max-w-3xl w-full max-h-[90dvh] overflow-y-auto animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-surface border-b border-ink-200/70 px-6 py-4 flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                                    viewingTransaction.type === 'entry'
                                        ? 'bg-success-50 text-success-600'
                                        : 'bg-warning-50 text-warning-600'
                                }`}>
                                    {viewingTransaction.type === 'entry'
                                        ? <ArrowDownLeft className="h-5 w-5" />
                                        : <ArrowUpRight className="h-5 w-5" />
                                    }
                                </div>
                                <div className="min-w-0">
                                    <h3 className="section-title">
                                        {viewingTransaction.type === 'entry' ? 'Entrada de almacén' : 'Salida de almacén'}
                                    </h3>
                                    <p className="text-xs text-ink-500 truncate">
                                        {viewingTransaction.reference || 'Sin referencia'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingTransaction(null)}
                                className="btn-icon h-10 w-10 rounded-xl -mr-2"
                                title="Cerrar"
                                aria-label="Cerrar"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Info Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    {
                                        icon: Calendar,
                                        label: "Fecha",
                                        value: viewingTransaction.timestamp?.toDate
                                            ? format(viewingTransaction.timestamp.toDate(), "dd/MM/yyyy")
                                            : '--',
                                    },
                                    {
                                        icon: User,
                                        label: "Usuario",
                                        value: users[viewingTransaction.userId]?.name || viewingTransaction.userId || 'N/A',
                                        title: users[viewingTransaction.userId]?.email || viewingTransaction.userId,
                                    },
                                    {
                                        icon: Package,
                                        label: "Productos",
                                        value: viewingTransaction.items?.length || 0,
                                    },
                                    {
                                        icon: FileText,
                                        label: "Sucursal",
                                        value: viewingTransaction.sucursal || 'Principal',
                                    },
                                ].map((info) => {
                                    const Icon = info.icon;
                                    return (
                                        <div key={info.label} className="surface-muted p-4">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Icon className="h-3.5 w-3.5 text-ink-400" />
                                                <p className="section-label">{info.label}</p>
                                            </div>
                                            <p className="text-sm font-semibold text-ink-900 truncate" title={info.title}>
                                                {info.value}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Items Table */}
                            <div>
                                <h4 className="section-label mb-3">Detalle de productos</h4>
                                <div className="table-shell">
                                    <div className="table-scroll">
                                        <table className="min-w-full">
                                            <thead className="table-head">
                                                <tr>
                                                    <th>#</th>
                                                    <th>Producto</th>
                                                    <th className="text-center">Cantidad</th>
                                                    <th className="text-right">Costo unit.</th>
                                                    <th className="text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="table-body">
                                                {viewingTransaction.items?.map((item, idx) => {
                                                    const product = productsById.get(item.productId);
                                                    const cost = viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit'
                                                        ? Number(product?.cost || item.cost || 0)
                                                        : Number(product?.price || item.price || 0);
                                                    const subtotal = cost * Number(item.quantity);

                                                    return (
                                                        <tr key={idx}>
                                                            <td className="text-ink-400 tabular-nums">{idx + 1}</td>
                                                            <td className="font-medium text-ink-900">{item.name}</td>
                                                            <td className="text-center">
                                                                <span className="badge-primary tabular-nums">{item.quantity}</span>
                                                            </td>
                                                            <td className="text-right tabular-nums">{formatCurrency(cost)}</td>
                                                            <td className="text-right font-semibold text-ink-900 tabular-nums">
                                                                {formatCurrency(subtotal)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-ink-50 border-t border-ink-200">
                                                <tr>
                                                    <td colSpan="4" className="px-4 py-3 text-right section-label">Total</td>
                                                    <td className="px-4 py-3 text-right text-base font-bold text-ink-900 tabular-nums">
                                                        {formatCurrency(viewingTransaction.total)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {viewingTransaction.notes && (
                                <div>
                                    <h4 className="section-label mb-2">Notas y observaciones</h4>
                                    <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                                        <p className="text-sm text-ink-700 leading-relaxed">
                                            {viewingTransaction.notes}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Additional Info */}
                            <div className="surface-muted px-4 py-3 flex items-center justify-between text-xs text-ink-500">
                                <span className="truncate">ID: {viewingTransaction.id}</span>
                                <span className="tabular-nums shrink-0 ml-3">
                                    {viewingTransaction.timestamp?.toDate
                                        ? format(viewingTransaction.timestamp.toDate(), "HH:mm:ss")
                                        : '--:--:--'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
