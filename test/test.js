import { toAEDT } from '../modules/nem12.js';

function test_toAEDT() {
    const dSummer = toAEDT("2025-02-01T23:35:00+10:00"); // Sat, in daylight savings time it's an hour later, so it rolls over to Sun=6
    console.assert(dSummer.day == 6 && dSummer.hour == 0 && dSummer.minute == 35 && dSummer.minuteSinceMidnight == 35, dSummer);
    const dWinter = toAEDT("2025-05-07T03:25:00+10:00"); // Wed, in daylight savings time it's unchanged
    console.assert(dWinter.day == 2 && dWinter.hour == 3 && dWinter.minute == 25 && dWinter.minuteSinceMidnight == 205, dWinter);
    console.log("test_toAEDT() passed 2 tests");
}

function testZones() {
    const zones = Intl.supportedValuesOf('timeZone').filter(z => z.startsWith("Australia/"));
    console.log("zones: ", zones);
    console.log("testZones() passed 1 test");
}

export function test() {
    test_toAEDT();
    testZones();
}