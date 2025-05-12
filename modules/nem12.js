
// Parse NEM12 file
// Officially: https://www.aemo.com.au/-/media/Files/Electricity/NEM12/2023/NEM12-File-Format-Specification.pdf
// Simplified version I used: https://engie.com.au/sites/default/files/2020-09/ned-12-user-guide.pdf
// Note: Timezone used in NEM12 is Australian Eastern Standard Time (AEST) which is UTC+10.

export class Nem12 {

    constructor(tariffs) {
        this.tariffs = tariffs;
        this.rec100 = null;
        this.rec200 = null;
        this.rec300 = null;
        this.rec400 = null;
        this.minDate = "99999999";
        this.maxDate = "00000000";
    }

    applyTariffs() {
        const isGeneration = this.rec200.registerId.startsWith("B"); // else Consumption
        const date = this.rec300.intervalDate.toString(); // YYYYMMDD
        if (date < this.minDate) this.minDate = date;
        if (date > this.maxDate) this.maxDate = date;
        this.tariffs.forEach(t => t.applyTariff(isGeneration, date, this.rec200.intervalMinutes, this.rec300.readings));
    }

    row(row) {
        // console.log("Row:", row);
        // handle errors from PapaParse
        if (row.errors.length != 0) throw new Error("Parsing errors", row.errors);
        if (row.meta.aborted || row.meta.truncated) throw new Error("Parsing aborted or truncated", row.meta);

        const r = row.data;
        switch (r[0]) {
            case 100:
                if (r[1] != "NEM12") throw new Error("Invalid NEM12 file", r[1]);
                this.rec100 = {
                    fileType: r[1],
                    fileGenerationDate: r[2], // Date of file generation (Format: YYYYMMDDHHMM)
                    meteringCompany: r[3],
                    retailerMarketParticipantId: r[4],
                };
                // console.log("rec100", this.rec100);
                break;
            case 200:
                this.rec200 = {
                    NMI: r[1],
                    nmiSuffixes: r[2],          // one for each meter register, e.g. "B1E1", E1/E2 for consumption, B1/B2 for generation
                    registerId: r[3],           // the register that produced the readings in the following rec300 rows
                    suffix: r[4],               // the suffix associated with the above registerId
                    dataStreamId: r[5],         // the data stream that produced the readings in the following rec300 rows
                    meterSerialNumber: r[6],
                    unitOfMeasurement: r[7],    // "KWH"
                    intervalMinutes: r[8],      // the interval length in minutes, usually 5, 15 or 30
                    nextScheduledReadDate: r[9] // the date of the next scheduled read, usually blank, the format is YYYYMMDD
                };
                // console.log("rec200", this.rec200);
                break;
            case 300:
                const intervalsPerDay = 24 * 60 / this.rec200.intervalMinutes;
                var i = 2 + intervalsPerDay;
                this.rec300 = {
                    intervalDate: r[1],         // Date of reading, format is YYYYMMDD
                    readings: r.slice(2, i),    // meter reading, kWh consumed or generated, for each interval in the day  
                    qualityMethod: r[i++],      // actual read data will be indicated by “A”.
                    reasonCode: r[i++],         // code for a Substitute or Final Substitute quality record
                    reasonDescription: r[i++],  // the reason for a Substitute or Final Substitute quality record
                    updateDateTime: r[i++],     // Date of file, date format is YYYYMMDDHHMMSS. likely to be blank
                };
                // console.log("rec300", this.rec300);
                this.applyTariffs();
                break;
            case 400:                           // Interval event record, mandatory where the QualityFlag is ‘V’ in the 300 record or 
                this.rec400 = {                 // where the quality flag is ‘A’ and reason codes 79, 89, and 61 are used                            
                    startInterval: r[1], 
                    endInterval: r[2], 
                    qualityMethod: r[3],
                    reasonCode: r[4],
                    reasonDescription: r[5],
                };
                // console.log("rec400", this.rec400);
                break;
            case 500:
                // console.log("rec500 skipped, B2B details record", r);
                break;
            case 900:
                // console.log("rec900 End of data", r);
                break;
            case null:
                break;
            default:
                console.log(`rec ${r[0]} unhandled`, r);
                break;
        }
    }

    complete() {
        this.tariffs.forEach(t => t.computeTotal());
        console.log("Nem12 complete:");
    }
}


