import { useState, useEffect } from "react";
import { 
    ArrowDownLeft, 
    ArrowUpRight,
    X,
    FileText,
    Edit,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Package,
    User
} from "lucide-react";
import { db } from "../firebase.config";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { getProducts } from "../lib/db";
import { doc, getDoc } from "firebase/firestore";

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

    // Cargar usuarios para mostrar email en lugar de UID
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                // Obtenemos todas las transacciones para extraer los UIDs únicos
                const allTransactionsQuery = query(
                    collection(db, "transactions"),
                    orderBy("timestamp", "desc")
                );
                const snapshot = await getDocs(allTransactionsQuery);
                
                const uniqueUserIds = new Set();
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.userId) {
                        uniqueUserIds.add(data.userId);
                    }
                });

                // Obtenemos los datos de cada usuario
                const usersMap = {};
                for (const userId of uniqueUserIds) {
                    try {
                        const userDoc = await getDoc(doc(db, "users", userId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            usersMap[userId] = {
                                email: userData.email || userId,
                                name: userData.name || userData.email || userId
                            };
                        } else {
                            usersMap[userId] = { email: userId, name: userId };
                        }
                    } catch (err) {
                        console.warn(`Error fetching user ${userId}:`, err);
                        usersMap[userId] = { email: userId, name: userId };
                    }
                }
                
                setUsers(usersMap);
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };

        fetchUsers();
    }, []);

    // Fetch entradas cuando cambian las fechas
    useEffect(() => {
        const fetchEntries = async () => {
            try {
                const start = startOfDay(entryStartDate);
                const end = endOfDay(entryEndDate);
                
                const entriesQuery = query(
                    collection(db, "transactions"),
                    where("type", "==", "entry"),
                    orderBy("timestamp", "desc")
                );
                const entriesSnapshot = await getDocs(entriesQuery);
                
                const entriesData = entriesSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(tx => {
                        const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : null;
                        return txDate && txDate >= start && txDate <= end;
                    });
                
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
                    orderBy("timestamp", "desc")
                );
                const exitsSnapshot = await getDocs(exitsQuery);
                
                const exitsData = exitsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(tx => {
                        const txDate = tx.timestamp?.toDate ? tx.timestamp.toDate() : null;
                        return txDate && txDate >= start && txDate <= end;
                    });
                
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

    // Calcular total de entradas
    const totalEntries = entries.reduce((acc, tx) => {
        return acc + (tx.items?.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId);
            return sum + (product ? Number(product.cost || 0) * Number(item.quantity) : 0);
        }, 0) || 0);
    }, 0);

    // Calcular total de salidas
    const totalExits = exits.reduce((acc, tx) => {
        return acc + (tx.items?.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId);
            return sum + (product ? Number(product.cost || 0) * Number(item.quantity) : 0);
        }, 0) || 0);
    }, 0);

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

    // Date Picker Modal
    const DatePickerModal = ({ isOpen, onClose, onSelect, startDate, endDate }) => {
        const [tempStart, setTempStart] = useState(format(startDate, 'yyyy-MM-dd'));
        const [tempEnd, setTempEnd] = useState(format(endDate, 'yyyy-MM-dd'));

        if (!isOpen) return null;

        return (
            <div 
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
                onClick={onClose}
            >
                <div 
                    className="bg-white rounded-3xl shadow-glass-lg p-6 w-full max-w-md animate-scale-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black text-slate-800">Seleccionar Rango</h3>
                        <button 
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Fecha Inicial</label>
                            <input
                                type="date"
                                value={tempStart}
                                onChange={(e) => setTempStart(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl 
                                         focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 
                                         transition-all font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Fecha Final</label>
                            <input
                                type="date"
                                value={tempEnd}
                                onChange={(e) => setTempEnd(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl 
                                         focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 
                                         transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl 
                                     hover:bg-slate-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => {
                                onSelect(parseISO(tempStart), parseISO(tempEnd));
                                onClose();
                            }}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 
                                     text-white font-bold rounded-2xl hover:from-primary-600 hover:to-primary-700 
                                     transition-all shadow-glow-primary"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Panel Component
    const MovementPanel = ({ 
        title, 
        type, 
        data, 
        total, 
        startDate, 
        endDate, 
        onPrevious, 
        onNext, 
        onReset,
        onDateSelect,
        icon: Icon,
        gradient
    }) => {
        const [showDatePicker, setShowDatePicker] = useState(false);
        const isEntry = type === 'entry';

        return (
            <>
                <div className={`bg-gradient-to-br ${gradient} backdrop-blur-xl border border-white/40 
                              shadow-glass-lg rounded-[2.5rem] p-6 lg:p-8 relative overflow-hidden`}>
                    <div className={`absolute top-0 right-0 w-64 h-64 ${isEntry ? 'bg-success-200/20' : 'bg-warning-200/20'} 
                                  blur-[100px] rounded-full -mr-32 -mt-32`}></div>
                    
                    <div className="relative z-10 h-full flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-14 h-14 rounded-2xl ${isEntry ? 'bg-success-gradient shadow-glow-success' : 'bg-warning-gradient shadow-glow-warning'} 
                                              flex items-center justify-center`}>
                                    <Icon className="h-7 w-7 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h2>
                                    <p className="text-sm text-slate-500 font-medium">
                                        {format(startDate, "MMMM yyyy")}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Date Navigation */}
                        <div className="flex items-center gap-2 mb-4">
                            <button
                                onClick={() => onPrevious(type)}
                                className="p-2 rounded-xl bg-white/60 hover:bg-white/90 border border-white/30 
                                         transition-all hover:scale-105"
                                title="Mes anterior"
                            >
                                <ChevronLeft className="h-5 w-5 text-slate-600" />
                            </button>
                            <button
                                onClick={() => setShowDatePicker(true)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 
                                       bg-white/60 hover:bg-white/90 border border-white/30 rounded-xl 
                                       transition-all font-bold text-slate-700 text-sm"
                            >
                                <Calendar className="h-4 w-4" />
                                {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}
                            </button>
                            <button
                                onClick={() => onNext(type)}
                                className="p-2 rounded-xl bg-white/60 hover:bg-white/90 border border-white/30 
                                         transition-all hover:scale-105"
                                title="Mes siguiente"
                            >
                                <ChevronRight className="h-5 w-5 text-slate-600" />
                            </button>
                            <button
                                onClick={() => onReset(type)}
                                className="px-3 py-2 bg-gradient-to-r from-primary-500 to-primary-600 
                                         text-white text-xs font-bold rounded-xl hover:from-primary-600 
                                         hover:to-primary-700 transition-all shadow-glow-primary"
                                title="Mes actual"
                            >
                                Hoy
                            </button>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-hidden bg-white/60 backdrop-blur-sm rounded-2xl border border-white/30">
                            <div className="overflow-y-auto max-h-[400px]">
                                <table className="min-w-full">
                                    <thead className="bg-gradient-to-r from-slate-50 to-white sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Referencia</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Sucursal</th>
                                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="4" className="px-4 py-12 text-center">
                                                    <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto"></div>
                                                    <p className="text-slate-500 font-medium mt-3">Cargando...</p>
                                                </td>
                                            </tr>
                                        ) : data.length > 0 ? (
                                            data.map((tx) => {
                                                const rowTotal = tx.items?.reduce((sum, item) => {
                                                    const product = products.find(p => p.id === item.productId);
                                                    return sum + (product ? Number(product.cost || 0) * Number(item.quantity) : 0);
                                                }, 0) || 0;

                                                return (
                                                    <tr 
                                                        key={tx.id} 
                                                        className="hover:bg-white/80 transition-colors cursor-pointer"
                                                        onClick={() => handleViewTransaction(tx)}
                                                    >
                                                        <td className="px-4 py-3 text-sm font-medium text-slate-700 whitespace-nowrap">
                                                            {tx.timestamp?.toDate ? format(tx.timestamp.toDate(), "dd/MM/yyyy") : '--'}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-bold text-slate-800">
                                                            {tx.reference || 'Sin referencia'}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-600">
                                                            {tx.sucursal || 'Principal'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className={`text-sm font-black ${isEntry ? 'text-success-600' : 'text-warning-600'}`}>
                                                                ${rowTotal.toFixed(2)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="px-4 py-12 text-center">
                                                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl ${isEntry ? 'bg-success-100' : 'bg-warning-100'} 
                                                                  flex items-center justify-center`}>
                                                        <Icon className={`h-8 w-8 ${isEntry ? 'text-success-400' : 'text-warning-400'}`} />
                                                    </div>
                                                    <p className="text-slate-500 font-medium">No hay movimientos en este rango</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Total */}
                        <div className={`mt-4 pt-4 border-t-2 ${isEntry ? 'border-success-200' : 'border-warning-200'}`}>
                            <div className="flex items-center justify-between bg-gradient-to-r from-white/80 to-white/40 
                                          backdrop-blur-sm rounded-2xl px-5 py-4 border border-white/30">
                                <div>
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                                        Total {title}
                                    </span>
                                    <p className="text-xs text-slate-400 mt-0.5">{data.length} movimiento(s) en el rango</p>
                                </div>
                                <span className={`text-3xl font-black ${isEntry ? 'text-success-600' : 'text-warning-600'}`}>
                                    ${total.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Date Picker Modal */}
                <DatePickerModal
                    isOpen={showDatePicker}
                    onClose={() => setShowDatePicker(false)}
                    onSelect={(start, end) => onDateSelect(start, end)}
                    startDate={startDate}
                    endDate={endDate}
                />
            </>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-600 tracking-tight">
                        Movimientos de Almacén
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Control de entradas y salidas</p>
                </div>
                <Link
                    to="/stock-adjustments"
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 
                             text-white font-bold rounded-2xl hover:from-primary-600 hover:to-primary-700 
                             transition-all shadow-glow-primary hover:shadow-lg"
                >
                    <Edit className="h-5 w-5 mr-2" />
                    Nuevo Movimiento
                </Link>
            </header>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MovementPanel
                    title="Entradas"
                    type="entry"
                    data={entries}
                    total={totalEntries}
                    startDate={entryStartDate}
                    endDate={entryEndDate}
                    onPrevious={previousMonth}
                    onNext={nextMonth}
                    onReset={resetToCurrentMonth}
                    onDateSelect={(start, end) => {
                        setEntryStartDate(start);
                        setEntryEndDate(end);
                    }}
                    icon={ArrowDownLeft}
                    gradient="from-white/90 via-success-50/30 to-white/60"
                />

                <MovementPanel
                    title="Salidas"
                    type="exit"
                    data={exits}
                    total={totalExits}
                    startDate={exitStartDate}
                    endDate={exitEndDate}
                    onPrevious={previousMonth}
                    onNext={nextMonth}
                    onReset={resetToCurrentMonth}
                    onDateSelect={(start, end) => {
                        setExitStartDate(start);
                        setExitEndDate(end);
                    }}
                    icon={ArrowUpRight}
                    gradient="from-white/90 via-warning-50/30 to-white/60"
                />
            </div>

            {/* Saldo de Inventario Card */}
            <div className="bg-gradient-to-br from-white/90 via-primary-50/40 to-accent-50/30 
                          backdrop-blur-xl border border-white/40 shadow-glass-lg 
                          rounded-[2.5rem] p-6 lg:p-8 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary-200/20 blur-[120px] rounded-full -mr-48 -mt-48"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-200/20 blur-[100px] rounded-full -ml-32 -mb-32"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 
                                          flex items-center justify-center shadow-glow-primary">
                                <Package className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Saldo de Inventario</h2>
                                <p className="text-sm text-slate-500 font-medium">Valor total del inventario a costo</p>
                            </div>
                        </div>
                    </div>

                    {/* Balance Display */}
                    <div className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm 
                                  rounded-3xl p-8 border-2 border-primary-200 shadow-inner-light">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="text-center md:text-left">
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">
                                    Valor Total del Inventario
                                </p>
                                <p className="text-5xl font-black text-transparent bg-clip-text 
                                            bg-gradient-to-r from-primary-600 to-accent-600">
                                    ${inventoryBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center 
                                                  mx-auto mb-2">
                                        <Package className="h-7 w-7 text-primary-600" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Productos</p>
                                    <p className="text-2xl font-black text-primary-600">{products.length}</p>
                                </div>
                                <div className="text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-accent-100 flex items-center justify-center 
                                                  mx-auto mb-2">
                                        <Package className="h-7 w-7 text-accent-600" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Items</p>
                                    <p className="text-2xl font-black text-accent-600">{totalItems}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Note */}
                    <div className="mt-6 flex items-start gap-3 bg-primary-50/60 backdrop-blur-sm rounded-2xl p-4 border border-primary-100">
                        <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">💡</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-primary-700 mb-1">¿Cómo se calcula?</p>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                El saldo se calcula sumando el <strong>costo × stock</strong> de todos los productos en el inventario. 
                                Este valor representa la inversión total en mercancía disponible.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Detail Modal - Mejorado */}
            {viewingTransaction && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 
                             backdrop-blur-sm p-4 animate-fade-in"
                    onClick={() => setViewingTransaction(null)}
                >
                    <div
                        className="relative bg-white rounded-[2.5rem] shadow-glass-lg max-w-3xl w-full max-h-[90vh] 
                                 overflow-y-auto animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header con Botón de Cerrar */}
                        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 
                                      backdrop-blur-xl border-b border-white/30 px-6 py-5 flex items-center justify-between 
                                      rounded-t-[2.5rem] z-10">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center 
                                    ${viewingTransaction.type === 'entry' 
                                        ? 'bg-success-gradient shadow-glow-success' 
                                        : 'bg-warning-gradient shadow-glow-warning'}`}>
                                    {viewingTransaction.type === 'entry' 
                                        ? <ArrowDownLeft className="h-7 w-7 text-white" />
                                        : <ArrowUpRight className="h-7 w-7 text-white" />
                                    }
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">
                                        {viewingTransaction.type === 'entry' ? 'Entrada de Almacén' : 'Salida de Almacén'}
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium">
                                        {viewingTransaction.reference || 'Sin referencia'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingTransaction(null)}
                                className="p-3 rounded-xl bg-white/60 hover:bg-white text-slate-500 hover:text-danger-600 
                                         transition-all duration-300 hover:scale-110 hover:rotate-90"
                                title="Cerrar"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Info Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="h-4 w-4 text-primary-500" />
                                        <p className="text-xs font-bold text-slate-500 uppercase">Fecha</p>
                                    </div>
                                    <p className="text-sm font-black text-slate-800">
                                        {viewingTransaction.timestamp?.toDate 
                                            ? format(viewingTransaction.timestamp.toDate(), "dd/MM/yyyy")
                                            : '--'
                                        }
                                    </p>
                                </div>
                                <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User className="h-4 w-4 text-primary-500" />
                                        <p className="text-xs font-bold text-slate-500 uppercase">Usuario</p>
                                    </div>
                                    <p className="text-sm font-black text-slate-800 truncate" title={users[viewingTransaction.userId]?.email || viewingTransaction.userId}>
                                        {users[viewingTransaction.userId]?.name || viewingTransaction.userId || 'N/A'}
                                    </p>
                                </div>
                                <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Package className="h-4 w-4 text-primary-500" />
                                        <p className="text-xs font-bold text-slate-500 uppercase">Productos</p>
                                    </div>
                                    <p className="text-sm font-black text-slate-800">
                                        {viewingTransaction.items?.length || 0}
                                    </p>
                                </div>
                                <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="h-4 w-4 text-primary-500" />
                                        <p className="text-xs font-bold text-slate-500 uppercase">Sucursal</p>
                                    </div>
                                    <p className="text-sm font-black text-slate-800">
                                        {viewingTransaction.sucursal || 'Principal'}
                                    </p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Detalle de Productos
                                </h4>
                                <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                                    <table className="min-w-full">
                                        <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">#</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Producto</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Cantidad</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Costo Unit.</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {viewingTransaction.items?.map((item, idx) => {
                                                const product = products.find(p => p.id === item.productId);
                                                const cost = viewingTransaction.type === 'entry' || viewingTransaction.type === 'exit'
                                                    ? Number(product?.cost || item.cost || 0)
                                                    : Number(product?.price || item.price || 0);
                                                const subtotal = cost * Number(item.quantity);
                                                
                                                return (
                                                    <tr key={idx} className="hover:bg-white/60 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-bold text-slate-500">{idx + 1}</td>
                                                        <td className="px-4 py-3 text-sm font-bold text-slate-700">{item.name}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-lg 
                                                                         bg-primary-50 text-primary-700 font-bold text-sm">
                                                                {item.quantity}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                                                            ${cost.toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm font-black text-slate-800">
                                                            ${subtotal.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-gradient-to-r from-primary-50 to-accent-50">
                                            <tr>
                                                <td colSpan="4" className="px-4 py-3 text-right text-sm font-bold text-slate-600 uppercase">Total:</td>
                                                <td className="px-4 py-3 text-right text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-600">
                                                    ${viewingTransaction.total?.toFixed(2) || '0.00'}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Notes */}
                            {viewingTransaction.notes && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Notas / Observaciones</h4>
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                        <p className="text-sm text-slate-700 leading-relaxed">
                                            {viewingTransaction.notes}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Additional Info */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>ID: {viewingTransaction.id}</span>
                                    <span>
                                        {viewingTransaction.timestamp?.toDate 
                                            ? format(viewingTransaction.timestamp.toDate(), "HH:mm:ss")
                                            : '--:--:--'
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
