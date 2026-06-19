export function formatKST(dateInput, format = 'datetime') {
    if (!dateInput)
        return '-';
    let dateStr;
    if (dateInput instanceof Date) {
        dateStr = dateInput.toISOString();
    }
    else {
        dateStr = dateInput;
    }
    const normalized = dateStr.replace(' ', 'T');
    const d = new Date(normalized);
    if (isNaN(d.getTime()))
        return dateStr;
    const opts = {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };
    if (format === 'datetime' || format === 'time') {
        opts.hour = '2-digit';
        opts.minute = '2-digit';
        opts.second = '2-digit';
    }
    return new Intl.DateTimeFormat('ko-KR', opts).format(d);
}
