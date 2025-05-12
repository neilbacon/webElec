// Tarrifs use local daylight savings time if in effect, for NSW that's UTC+11 in summer and +10 in winter.
// Some tariffs apply Sunday rates on public holidays.

class TariffLine {

    // if there are multiple TariffLines for the same name, they should also have the same price (but it will work anyway).
    constructor(name, dayStart, dayEnd, timeStart, timeEnd, price) {
        this.name = name;           // Off-peak, Peak, Shoulder, Solar
        this.dayStart = dayStart;   // 0 (for Monday) - 6
        this.dayEnd = dayEnd;
        this.timeStart = timeStart; // minutes since midnight
        this.timeEnd = timeEnd;
        this.price = price;         // $/kWh
    }
}

class Sums {
    constructor(sumPower, sumPrice) {
        this.sumPower = sumPower;
        this.sumPrice = sumPrice;
    } 
}

export const dateToIso = s => `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`; // YYYYMMDD -> YYYY-MM-DD
const minuteSinceMidnightToIso = m => `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}:00`; // minutes since midnight -> hh:mm:00

// Convert an ISO date string with explicit timezone offset, e.g. '2016-05-25T09:08:34.123+10:00' to values in localTimeZone 
export function toAEDT(isoWithOffset, localTimeZone) {
    const d = luxon.DateTime.fromISO(isoWithOffset).setZone(localTimeZone);
    return { day: d.weekday - 1, date: d.toFormat('yyyyLLdd'), hour: d.hour, minute: d.minute, minuteSinceMidnight: d.hour * 60 + d.minute };
}

function minSinceMidnight(hhmm) {
    const x = /^(\d{2}):(\d{2})$/.exec(hhmm);
    if (x == null) throw new Error(`Invalid format for tariff time '${hhmm}'`);
    // console.log('hhmm', x);
    return parseInt(x[1]) * 60 + parseInt(x[2]);
}

export class Tariff {
    constructor(filename, isHoliday) {
        this.filename = filename;
        this.isHoliday = isHoliday; 
        this.lines = [];
        this.timezone = "Australia/Sydney"; // for the tariff
        this.state = "N/A"; // "NSW" etc for a tariff that applies Sunday rates for public holidays, "N/A" for one that doesn't
        this.dailySupplyCharge = 0;
        this.lineNo = 0;
        this.clearResult();
    }

    clearResult() {
        this.dates = new Set(); // dates for which we have applied the tariff
        this.resultMap = new Map(); // tariffPeriod -> Sums(sumPower, sumPrice)
    }

    row(row) {
        ++this.lineNo;
        if (this.lineNo == 1) return; // skip header
        // console.log("Row:", row);
        // handle errors from PapaParse
        if (row.errors.length != 0) throw new Error("Parsing errors", row.errors);
        if (row.meta.aborted || row.meta.truncated) throw new Error("Parsing aborted or truncated", row.meta);

        const r = row.data;
        if (r[0] === "Daily") {
            this.timezone = r[3];
            this.state = r[4];
            this.dailySupplyCharge = r[5];
        } else {
            this.lines.push(new TariffLine(r[0], r[1], r[2], minSinceMidnight(r[3]), minSinceMidnight(r[4]), r[5]));
        };
    }

    complete() {
        console.log("Tariff complete:");
    }

    // dates & times from NEM12 are AEST +10:00
    applyTariff(isGeneration, date, intervalMinutes, readings) {
        this.dates.add(date);
        const sumFn = (v, i) => {
            if (v == 0) return; // skip zero values
            const t = this.getTariffLine(isGeneration, date, i * intervalMinutes);
            var s = this.resultMap.get(t.name);
            if (!s) {
                s = new Sums(0, 0);
                this.resultMap.set(t.name, s);
            }
            s.sumPower += t.price > 0 ? v : -v;
            s.sumPrice += v * t.price;
        };
        readings.forEach(sumFn);
    }

    getTariffLine(isGeneration, date, minutesSinceMidnight) {
        const isoDateTime = `${dateToIso(date)}T${minuteSinceMidnightToIso(minutesSinceMidnight)}+10:00`; // '2016-05-25T09:08:34.123+10:00' always +10:00 AEST
        const d = toAEDT(isoDateTime);
        // console.log("Tariff.getTariffLine: d =", d);
        if (this.state != "N/A" && this.isHoliday(this.state, d.date)) {
            // console.log("Tariff.getTariffLine: applying Sunday tariff for public holiday", d);
            d.day = 6; // apply Sunday tariff
        }
        return this.lines.find(t => 
            d.day >= t.dayStart && d.day < t.dayEnd && 
            d.minuteSinceMidnight >= t.timeStart && d.minuteSinceMidnight < t.timeEnd &&
            (isGeneration ? t.price < 0 : t.price > 0)
        );
    }

    computeTotal() {
        this.resultMap.set("Daily Supply", new Sums(0, this.dailySupplyCharge * this.dates.size));
        const total = Array.from(this.resultMap).reduce((sums, [name, s]) => {
            sums.sumPower += s.sumPower;
            sums.sumPrice += s.sumPrice;
            return sums;
        }, new Sums(0, 0));
        this.resultMap.set("Total", total);
    }

}

