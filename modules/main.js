import { Holidays } from './holidays.js';
import { Nem12 } from './nem12.js';
import { Tariff, dateToIso } from './tariff.js';

const id = x => document.getElementById(x);

// open modal by id
function openModal(ev, modalId) {
    // console.log('openModal', ev);
    const m = id(modalId);
    // m.style.top = `${ev.clientY}px`;
    m.classList.add('open');
    document.body.classList.add('jw-modal-open');
}

// close currently open modal
function closeModal() {
    document.querySelector('.jw-modal.open').classList.remove('open');
    document.body.classList.remove('jw-modal-open');
}

// close modal by clicking outside of it
function initModal() {
    id('openPotentialUses').addEventListener('click', ev => openModal(ev, 'potentialUses'));
    id('openDailyExplanation').addEventListener('click', ev => openModal(ev, 'dailyExplanation'));
    document.addEventListener('click', event => {
        // console.log('document click');
        if (event.target.classList.contains('jw-modal')) closeModal();
    });
} 

function initHolidays(cb) {
    const url = window.location.href.replace(new RegExp('/[^/]*$'), '/data/australian-public-holidays-combined-2021-2025.csv');
    console.log("Holidays URL: ", url);
    const holidays = new Holidays();
    // header: true makes it return an object for each row, but there are some big text columns we don't want to keep in memory,
    // so don't use this option. Instead we will manually skip the first row.
    Papa.parse(url, {
        delimiter: ',',
        header: false,
        skipEmptyLines: 'greedy',
        download: true,
        step: r => holidays.row(r),
        complete: r => {
            holidays.complete(r);
            cb(holidays);
        },
    });
    return holidays;
}

const fmtPower = v => v.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtPrice = v => v.toLocaleString(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPricePrecise = v => v.toLocaleString(undefined, { style: 'currency', currency: 'AUD', minimumFractionDigits: 5, maximumFractionDigits: 5 });
const fmtDay = x => [ "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Following Mon", "Invalid" ][Math.min(Math.abs(x), 8)];
const fmtTime = x => `${ Math.floor(x / 60).toString().padStart(2, '0')}:${(x % 60).toString().padStart(2, '0')}`;

function renderTariffs(tariffs) {
    console.log("Tariff:", tariffs);
    id('nem12Summary').classList.add('hidden');
    id('powerPlaceholder').classList.add('hidden');
    id('power').classList.remove('hidden');
    const head = [ "Tariff Period", "Day Start", "Day End<br/>(exclusive)", "Time Start", "Time End<br/>(exclusive)", "Price ($/kWh)" ].map(x => `<th>${x}</th>`).join(' ');
    id('tariffDisplay').innerHTML = tariffs.map((t, i) => {
        const rows = t.lines.map(l => `<tr><td>${l.name}</td><td>${fmtDay(l.dayStart)}</td><td>${fmtDay(l.dayEnd)}</td><td>${fmtTime(l.timeStart)}</td><td>${fmtTime(l.timeEnd)}</td><td>${fmtPricePrecise(l.price)}</td></tr>`).join(' ');
        return `<div class="table-container"><span>Tariff ${i + 1}: ${t.filename}<br/>Daily supply charge $${t.dailySupplyCharge}<br/>Timezone ${t.timezone}${t.state == "N/A" ? "" : `, ${t.state} public holidays at Sunday rates`}</span><table><tr>${head}</tr>${rows}</table></div>`;
    }).join(' ');
}

function renderNem12Summary(nem12) {
    id('nem').innerHTML = nem12.rec200.NMI;
    id('fromDate').value = dateToIso(nem12.minDate);
    id('toDate').value   = dateToIso(nem12.maxDate);
    id('nem12Summary').classList.remove('hidden');
}
 
function renderCharges(nem12) {
    const head = [ "Tariff Period", "Energy (kWh)", "Price ($)" ].map(x => `<th>${x}</th>`).join(' ');
    id('charges').innerHTML = nem12.tariffs.map((t, i) => {
        const rows = Array.from(t.resultMap).map( ([k, v]) => `<tr><td>${k}</td><td>${fmtPower(v.sumPower)}</td><td>${fmtPrice(v.sumPrice)}</td></tr>`).join(' ');
        return `<div class="table-container"><span>Tariff ${i + 1}</span><table><tr>${head}</tr>${rows}</table></div>`;
    }).join(' ');
}

const isoToYYYYMMDD = d => d.replace(/-/g, '');

class Main {
    constructor(isHoliday) {
        this.isHoliday = isHoliday;
        this.nem12 = new Nem12();
        id('tariffFile').addEventListener('change', ev => this.parseTariffs(ev.target.files));
        id('powerFile').addEventListener('change', ev => this.parseNem12(ev.target.files[0]));
        id('filterDateRange').addEventListener('click', ev => this.filterDateRange());
        id('resetDateRange').addEventListener('click', ev => this.resetDateRange());
    }

    parseTariffs(files) {
        id('powerFile').value = null;
        id('charges').innerHTML = "";
        // Parse the tariff files using a CSV parser, handing each row to Tariff.row() as it is read.
        const tariffs = [];
        var i = 0;
        for (const f of files) {
            const t = new Tariff(f.name, this.isHoliday);
            tariffs.push(t);
            Papa.parse(f, {
                delimiter: ',',
                header: false,
                skipEmptyLines: 'greedy',
                dynamicTyping: true,
                step: r => t.row(r),
                complete: r => {
                    t.complete(r);
                    if (++i == files.length) {
                        this.nem12.reset(tariffs);
                        renderTariffs(tariffs);
                    }
                }
            });
        };
    };

    parseNem12(file, setSummary = true, dateFilter = null) {
        if (this.nem12.tariffs.length == 0) return;
        // Parse the NEM12 file using a CSV parser, handing each row to Nem12.row() as it is read.
        this.nem12.reset(); // keeps the tarrifs
        if (dateFilter) this.nem12.setDateFilter(dateFilter.start, dateFilter.end);

        Papa.parse(file, {
            delimiter: ',',
            header: false,
            skipEmptyLines: 'greedy',
            dynamicTyping: true,
            step: r => this.nem12.row(r),
            complete: r => {
                this.nem12.complete(r);
                if (setSummary) renderNem12Summary(this.nem12);
                renderCharges(this.nem12);
            }
        });
    }

    filterDateRange() {
        this.parseNem12(id('powerFile').files[0], false, {start: isoToYYYYMMDD(id('fromDate').value), end: isoToYYYYMMDD(id('toDate').value)});
    }

    resetDateRange() {
        this.nem12.resetDateFilter();
        this.parseNem12(id('powerFile').files[0]);
    }   

}

export function init() {
    document.addEventListener('DOMContentLoaded', function () {
        initModal();
        initHolidays(holidays => {
            const main = new Main((state, date) => holidays.isHoliday(state, date));
        });
    });
 }