const toKey = (state, date) => `${state}_${date}`;

export class Holidays {

    constructor() {
        this.lineNo = 0;
        this.holidays = new Set();
    }
    
    row(row) {
        ++this.lineNo;

        // handle errors from PapaParse
        if (row.errors.length != 0) throw new Error("Parsing errors", row.errors);
        if (row.meta.aborted || row.meta.truncated) throw new Error("Parsing aborted or truncated", row.meta);
        
        if (this.lineNo > 1) {  // skip header row
            const r = row.data;
            this.holidays.add(toKey(r[5].toUpperCase(), r[1])); // e.g. "NSW_20230101"
        };
    }

    complete(results) {
        console.log("holidays complete:", this.holidays);
    }

    isHoliday(state, date) {  // e.g. ("NSW", "20230101")
        return this.holidays.has(toKey(state, date));
    }
}