const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

export function formatCurrency(value) {
    const amount = Number(value);
    return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}
